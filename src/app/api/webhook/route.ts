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
    console.error("❌ Webhook signature error:", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log("🔥 METADATA RECIBIDA:", session.metadata);

    if (!session.metadata) {
      console.error("❌ Metadata vacía");
      return NextResponse.json({ error: "Metadata vacía" }, { status: 400 });
    }

    const items = session.metadata.items
      ? JSON.parse(session.metadata.items)
      : [];

    const user_id = session.metadata.user_id || null;
    const total = session.amount_total
      ? session.amount_total / 100
      : 0;

    // Evitar duplicados
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existingOrder) {
      console.log("⚠️ Orden ya existente");
      return NextResponse.json({ received: true });
    }

    // INSERT PRINCIPAL
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        stripe_session_id: session.id,
        user_id: user_id,
        user_email: session.customer_details?.email || null,
        total: total, // 👈 usa EXACTAMENTE el nombre real de tu columna
        status: "pagado",
        full_name: session.metadata.full_name || null,
        phone: session.metadata.phone || null,
        address: session.metadata.address || null,
        city: session.metadata.city || null,
        postal_code: session.metadata.postal_code || null,
        shipping_type: session.metadata.shipping_type || null,
        shipping_cost: Number(session.metadata.shipping_cost || 0),
      })
      .select()
      .single();

    if (orderError) {
      console.error("❌ Error insertando orden:", orderError);
      return NextResponse.json(
        { error: "Error guardando orden" },
        { status: 500 }
      );
    }

    console.log("✅ Orden creada:", order.id);

    // INSERT ITEMS
    for (const item of items) {
      const { error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.price,
        });

      if (itemError) {
        console.error("❌ Error insertando item:", itemError);
      }

      // Descontar stock
      await supabase.rpc("decrement_stock", {
        variant_id_input: item.variant_id,
        quantity_input: item.quantity,
      });
    }

    console.log("🎉 Items insertados correctamente");
  }

  return NextResponse.json({ received: true });
}