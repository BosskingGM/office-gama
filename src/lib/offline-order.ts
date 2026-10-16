// Crea un pedido que NO se cobra con Stripe (transferencia o pagar al recoger).
// El stock se aparta aquí mismo; si algo falla a la mitad, se deshace todo.

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOfflineOrderEmail } from "@/lib/email";
import { OFFLINE_STATUS } from "@/lib/payment";
import { couponNote, finalizeCoupon } from "@/lib/coupons";

type Item = {
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
};

type Input = {
  userId: string;
  userEmail: string | null;
  method: keyof typeof OFFLINE_STATUS;
  items: Item[];
  shippingType: string;
  shippingCost: number;
  customer: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    postal_code: string;
  };
  latitude: number | null;
  longitude: number | null;
  // Cupón ya validado y RESERVADO por el servidor (ver lib/coupons.ts)
  coupon?: { id: string; code: string; discount: number } | null;
};

export type OfflineResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; status: number };

const isMissingColumn = (err: { code?: string; message?: string }) =>
  err.code === "42703" ||
  err.code === "PGRST204" ||
  /column .*(does not exist|schema cache)/i.test(err.message ?? "");

async function releaseStock(reserved: { variant_id: string; quantity: number }[]) {
  for (const r of reserved) {
    const { error } = await supabaseAdmin.rpc("restore_stock", {
      variant_id_input: r.variant_id,
      quantity_input: r.quantity,
    });
    if (error) console.error("⚠️ No se pudo devolver stock:", r, error);
  }
}

export async function createOfflineOrder(input: Input): Promise<OfflineResult> {
  // 1) Apartar stock (cada descuento es atómico; devuelve false si ya no alcanza).
  const reserved: { variant_id: string; quantity: number }[] = [];
  for (const item of input.items) {
    const { data: ok, error } = await supabaseAdmin.rpc("decrement_stock", {
      variant_id_input: item.variant_id,
      quantity_input: item.quantity,
    });
    if (error || ok === false) {
      await releaseStock(reserved);
      return {
        ok: false,
        status: 409,
        error: `Ya no hay suficientes piezas de ${item.product_name} (${item.variant_name}). Revisa tu carrito.`,
      };
    }
    reserved.push({ variant_id: item.variant_id, quantity: item.quantity });
  }

  // 2) Pedido
  const subtotal = input.items.reduce((a, i) => a + i.price * i.quantity, 0);
  const discount = input.coupon?.discount ?? 0;
  const row: Record<string, unknown> = {
    user_id: input.userId,
    user_email: input.userEmail,
    total: Math.max(0, Math.round((subtotal - discount + input.shippingCost) * 100) / 100),
    status: OFFLINE_STATUS[input.method],
    payment_method: input.method,
    full_name: input.customer.full_name,
    phone: input.customer.phone,
    address: input.customer.address,
    city: input.customer.city,
    postal_code: input.customer.postal_code,
    shipping_type: input.shippingType,
    shipping_cost: input.shippingCost,
  };
  if (input.latitude !== null && input.longitude !== null) {
    row.latitude = input.latitude;
    row.longitude = input.longitude;
  }
  if (input.coupon) row.notes = couponNote(input.coupon.code, input.coupon.discount);

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(row)
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("❌ Error creando pedido offline:", orderError);
    await releaseStock(reserved);
    return {
      ok: false,
      status: 500,
      error:
        orderError && isMissingColumn(orderError)
          ? "Falta ejecutar supabase/offline-payments.sql en Supabase."
          : `No pudimos registrar tu pedido. Intenta de nuevo. (error ${orderError?.code ?? "desconocido"})`,
    };
  }

  // 3) Artículos
  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order.id,
      variant_id: i.variant_id,
      quantity: i.quantity,
      price: i.price,
      product_name: i.product_name,
      variant_name: i.variant_name,
    }))
  );
  if (itemsError) {
    console.error("❌ Error guardando artículos del pedido offline:", itemsError);
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    await releaseStock(reserved);
    return { ok: false, status: 500, error: "No pudimos registrar tu pedido. Intenta de nuevo." };
  }

  // 3b) El cupón pasa de "reservado" a "usado" junto con el pedido. Si no se pudo
  //     (nadie más debería poder), se deshace todo: nunca un cupón gratis.
  if (input.coupon) {
    const used = await finalizeCoupon({
      couponId: input.coupon.id,
      userId: input.userId,
      phone: input.customer.phone,
      orderId: String(order.id),
      discount: input.coupon.discount,
    });
    if (!used) {
      await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      await releaseStock(reserved);
      return {
        ok: false,
        status: 409,
        error: "No pudimos aplicar tu cupón. Quítalo e intenta de nuevo.",
      };
    }
  }

  // 4) La tienda y las páginas de producto deben mostrar el stock nuevo.
  try {
    revalidatePath("/");
    revalidatePath("/producto/[id]", "page");
  } catch (err) {
    console.error("No se pudo refrescar la caché:", err);
  }

  // 5) Instrucciones por correo (si falla, el pedido igual queda guardado).
  await sendOfflineOrderEmail(order.id as string);

  return { ok: true, orderId: order.id as string };
}
