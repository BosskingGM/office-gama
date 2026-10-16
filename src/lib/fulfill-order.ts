// Convierte una sesión de Stripe YA PAGADA en un pedido.
// Lo usan dos caminos, y es seguro que corran al mismo tiempo:
//   1) el webhook de Stripe (el camino normal)
//   2) la página "pago confirmado" (red de seguridad si el webhook falló o tarda)
// El índice único en orders.stripe_session_id (ver supabase/delivery-location.sql)
// garantiza que solo uno de los dos cree el pedido.

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { mapsLink } from "@/lib/shipping";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { couponNote, finalizeCoupon } from "@/lib/coupons";

type CartItem = {
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
};

export type FulfillResult =
  | { ok: true; orderId: string; created: boolean }
  // retry  = fallo temporal: Stripe debe reintentar el webhook
  // no_cart = pagó pero el carrito ya no existe: hay que resolverlo a mano
  // not_paid = la sesión aún no está pagada
  | { ok: false; reason: "retry" | "no_cart" | "not_paid"; message: string };

const isMissingColumn = (err: { code?: string; message?: string }) =>
  err.code === "42703" ||
  err.code === "PGRST204" ||
  /column .*(does not exist|schema cache)/i.test(err.message ?? "");

async function findOrderBySession(sessionId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export async function fulfillPaidSession(
  session: Stripe.Checkout.Session
): Promise<FulfillResult> {
  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid", message: "El pago aún no está confirmado" };
  }

  const cartId = session.metadata?.cart_id;
  if (!cartId) {
    console.error("❌ Sesión sin cart_id en metadata:", session.id);
    return { ok: false, reason: "no_cart", message: "Sesión sin carrito asociado" };
  }

  // ¿Ya existe el pedido? (webhook reenviado, o el otro camino ya lo creó)
  const existing = await findOrderBySession(session.id);
  if (existing) return { ok: true, orderId: existing, created: false };

  // Carrito validado por el servidor al momento de crear el pago.
  const { data: cart, error: cartError } = await supabaseAdmin
    .from("checkout_carts")
    .select("*")
    .eq("id", cartId)
    .maybeSingle();

  if (cartError) {
    console.error("❌ Error leyendo carrito:", cartError);
    return { ok: false, reason: "retry", message: "Error leyendo carrito" };
  }

  if (!cart) {
    // Puede que el otro camino acabe de crearlo y borrar el carrito.
    const nowExisting = await findOrderBySession(session.id);
    if (nowExisting) return { ok: true, orderId: nowExisting, created: false };

    console.error(
      `❌ PAGO SIN CARRITO. Revisar en Stripe: session=${session.id}, cart_id=${cartId}`
    );
    return { ok: false, reason: "no_cart", message: "El carrito del pago ya no existe" };
  }

  const items = cart.items as CartItem[];
  const customer = cart.customer as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  const lat = customer?.latitude == null ? NaN : Number(customer.latitude);
  const lng = customer?.longitude == null ? NaN : Number(customer.longitude);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  const total = session.amount_total ? session.amount_total / 100 : 0;

  const baseOrder = {
    stripe_session_id: session.id,
    user_id: cart.user_id,
    user_email: session.customer_details?.email || cart.user_email || null,
    total,
    status: "pagado",
    full_name: str(customer?.full_name),
    phone: str(customer?.phone),
    address: str(customer?.address),
    city: str(customer?.city),
    postal_code: str(customer?.postal_code),
    shipping_type: cart.shipping_type,
    shipping_cost: Number(cart.shipping_cost || 0),
  };

  // Solo se tocan las columnas de ubicación si el cliente puso un pin.
  let locationNote = "";
  let { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(hasPin ? { ...baseOrder, latitude: lat, longitude: lng } : baseOrder)
    .select()
    .single();

  // Red de seguridad: si todavía no se corrió el SQL de ubicación, NUNCA se
  // pierde un pedido ya cobrado; el pin se guarda como enlace en las notas.
  if (orderError && hasPin && isMissingColumn(orderError)) {
    console.warn(
      "⚠️ La tabla orders no tiene latitude/longitude. Ejecuta supabase/delivery-location.sql"
    );
    locationNote = `Ubicación en el mapa: ${mapsLink({ lat, lng })}`;
    ({ data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(baseOrder)
      .select()
      .single());
  }

  if (orderError) {
    // 23505 = el pedido ya existe (los dos caminos corrieron a la vez).
    if (orderError.code === "23505") {
      const id = await findOrderBySession(session.id);
      if (id) return { ok: true, orderId: id, created: false };
    }
    console.error("❌ Error insertando orden:", orderError);
    return { ok: false, reason: "retry", message: "Error guardando orden" };
  }

  console.log("✅ Orden creada:", order.id);

  // Artículos del pedido, con el precio y nombre que validó el servidor.
  const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      price: item.price,
      product_name: item.product_name,
      variant_name: item.variant_name,
    }))
  );
  if (itemsError) console.error("❌ Error insertando artículos:", itemsError);

  // Descontar stock. Si alguien se llevó la última pieza antes, se avisa en el pedido.
  const stockProblems: string[] = [];
  for (const item of items) {
    const { data: ok, error: stockError } = await supabaseAdmin.rpc("decrement_stock", {
      variant_id_input: item.variant_id,
      quantity_input: item.quantity,
    });
    if (stockError || ok === false) {
      console.error("⚠️ No se pudo descontar stock:", item, stockError);
      stockProblems.push(`${item.product_name} (${item.variant_name}) x${item.quantity}`);
    }
  }

  // Cupón: la reserva hecha al iniciar el pago pasa a "usado" (una vez por cliente).
  let couponLine = "";
  if (cart.coupon_id) {
    const discount = Number(cart.discount_amount || 0);
    const code = String(cart.coupon_code || "");
    couponLine = couponNote(code, discount);
    const used = await finalizeCoupon({
      couponId: String(cart.coupon_id),
      userId: String(cart.user_id),
      phone: customer?.phone,
      orderId: String(order.id),
      discount,
    });
    if (!used) {
      // El pago ya se cobró con descuento: el pedido se conserva y se avisa al admin.
      console.error("⚠️ No se pudo registrar el uso del cupón:", code, order.id);
      couponLine += " (REVISAR: no se pudo registrar el uso del cupón)";
    }
  }

  const notes = [
    couponLine,
    stockProblems.length > 0
      ? `Stock insuficiente al confirmar el pago: ${stockProblems.join(", ")}`
      : "",
    itemsError ? "Hubo un error guardando los artículos del pedido; revisar en Stripe" : "",
    locationNote,
  ]
    .filter(Boolean)
    .join(" | ");

  if (notes) await supabaseAdmin.from("orders").update({ notes }).eq("id", order.id);

  // El carrito ya cumplió su función.
  await supabaseAdmin.from("checkout_carts").delete().eq("id", cartId);

  // El stock cambió: se refrescan portada y páginas de producto al instante
  // (si no, mostrarían el stock viejo hasta que venza la caché de 1 minuto).
  try {
    revalidatePath("/");
    revalidatePath("/producto/[id]", "page");
  } catch (err) {
    console.error("No se pudo refrescar la caché:", err);
  }

  // Correo de confirmación al cliente. Si falla, el pedido igual queda guardado.
  await sendOrderConfirmationEmail(order.id);

  return { ok: true, orderId: order.id as string, created: true };
}
