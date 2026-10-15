import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CartItem = {
  variant_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  quantity: number;
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature error:", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Solo se crea el pedido si el dinero realmente ya se cobró.
  if (session.payment_status !== "paid") {
    console.log("⚠️ Sesión completada pero sin pago confirmado:", session.id);
    return NextResponse.json({ received: true });
  }

  const cartId = session.metadata?.cart_id;
  if (!cartId) {
    console.error("❌ Sesión sin cart_id en metadata:", session.id);
    return NextResponse.json({ received: true });
  }

  // Evitar duplicados (Stripe puede reenviar el mismo evento).
  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existingOrder) {
    return NextResponse.json({ received: true });
  }

  // Carrito validado por el servidor al momento de crear el pago.
  const { data: cart, error: cartError } = await supabaseAdmin
    .from("checkout_carts")
    .select("*")
    .eq("id", cartId)
    .maybeSingle();

  if (cartError) {
    console.error("❌ Error leyendo carrito:", cartError);
    // 500 para que Stripe reintente: puede ser un fallo temporal.
    return NextResponse.json({ error: "Error leyendo carrito" }, { status: 500 });
  }

  if (!cart) {
    // El cliente pagó pero el carrito ya no existe. Reintentar no ayuda:
    // se deja registro claro para resolverlo a mano desde Stripe.
    console.error(
      `❌ PAGO SIN CARRITO. Revisar en Stripe: session=${session.id}, cart_id=${cartId}`
    );
    return NextResponse.json({ received: true });
  }

  const items = cart.items as CartItem[];
  const customer = cart.customer as Record<string, string>;
  const total = session.amount_total ? session.amount_total / 100 : 0;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      user_id: cart.user_id,
      user_email: session.customer_details?.email || cart.user_email || null,
      total,
      status: "pagado",
      full_name: customer.full_name || null,
      phone: customer.phone || null,
      address: customer.address || null,
      city: customer.city || null,
      postal_code: customer.postal_code || null,
      shipping_type: cart.shipping_type,
      shipping_cost: Number(cart.shipping_cost || 0),
    })
    .select()
    .single();

  if (orderError) {
    // 23505 = el pedido ya existe (llegaron dos eventos al mismo tiempo).
    if (orderError.code === "23505") {
      return NextResponse.json({ received: true });
    }
    console.error("❌ Error insertando orden:", orderError);
    return NextResponse.json({ error: "Error guardando orden" }, { status: 500 });
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

  if (itemsError) {
    console.error("❌ Error insertando artículos:", itemsError);
  }

  // Descontar stock. Si alguien se llevó la última pieza antes, se avisa en el pedido.
  const stockProblems: string[] = [];

  for (const item of items) {
    const { data: ok, error: stockError } = await supabaseAdmin.rpc(
      "decrement_stock",
      {
        variant_id_input: item.variant_id,
        quantity_input: item.quantity,
      }
    );

    if (stockError || ok === false) {
      console.error("⚠️ No se pudo descontar stock:", item, stockError);
      stockProblems.push(`${item.product_name} (${item.variant_name}) x${item.quantity}`);
    }
  }

  if (stockProblems.length > 0 || itemsError) {
    const notes = [
      stockProblems.length > 0
        ? `Stock insuficiente al confirmar el pago: ${stockProblems.join(", ")}`
        : "",
      itemsError ? "Hubo un error guardando los artículos del pedido; revisar en Stripe" : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await supabaseAdmin.from("orders").update({ notes }).eq("id", order.id);
  }

  // El carrito ya cumplió su función.
  await supabaseAdmin.from("checkout_carts").delete().eq("id", cartId);

  return NextResponse.json({ received: true });
}
