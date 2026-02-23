import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {

});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    console.error("❌ Webhook error:", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // 🎯 Pago completado
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const items = JSON.parse(session.metadata?.items || "[]");
    const user_id = session.metadata?.user_id;
    const user_email = session.customer_details?.email;

    const total = session.amount_total! / 100;

    // 🧠 Evitar órdenes duplicadas
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_session_id", session.id)
      .single();

    if (existingOrder) {
      return NextResponse.json({ received: true });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        stripe_session_id: session.id,
        user_id,
        user_email,
        total,
        status: "pagado",
        full_name: session.metadata?.full_name,
        phone: session.metadata?.phone,
        address: session.metadata?.address,
        city: session.metadata?.city,
        postal_code: session.metadata?.postal_code,
        shipping_type: session.metadata?.shipping_type,
        shipping_cost: Number(session.metadata?.shipping_cost || 0),
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creando orden:", orderError);
      return NextResponse.json({ error: "Error guardando orden" }, { status: 500 });
    }

    // Insertar productos
    for (const item of items) {
      await supabase.from("order_items").insert({
        order_id: order.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        price: item.price,
      });

      await supabase.rpc("decrement_stock", {
        variant_id_input: item.variant_id,
        quantity_input: item.quantity,
      });
    }

    console.log("✅ Orden creada:", order.id);
  }

  return NextResponse.json({ received: true });
}