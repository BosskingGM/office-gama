import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillPaidSession } from "@/lib/fulfill-order";
import { releaseCouponByCart } from "@/lib/coupons";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

  // El pago expiró sin completarse: el cupón reservado vuelve a estar disponible.
  if (event.type === "checkout.session.expired") {
    const expired = event.data.object as Stripe.Checkout.Session;
    const cartId = expired.metadata?.cart_id;
    if (cartId) await releaseCouponByCart(cartId);
    return NextResponse.json({ received: true });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const result = await fulfillPaidSession(session);

  if (!result.ok && result.reason === "retry") {
    // 500 para que Stripe reintente: puede ser un fallo temporal.
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  // not_paid / no_cart: reintentar no ayuda; ya quedó registro en los logs.
  return NextResponse.json({ received: true });
}
