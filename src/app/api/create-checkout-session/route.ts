import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {

});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, user_id, shipping } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No hay productos en el carrito" },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: "Usuario no autenticado" },
        { status: 400 }
      );
    }

    const line_items = items.map((item: any) => ({
      price_data: {
        currency: "mxn",
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.quantity),
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/carrito`,
      metadata: {
        user_id: String(user_id),
        items: JSON.stringify(items),
        full_name: shipping.full_name,
        phone: shipping.phone,
        address: shipping.address,
        city: shipping.city,
        postal_code: shipping.postal_code,
        shipping_type: shipping.shipping_type,
        shipping_cost: String(shipping.shipping_cost),
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("STRIPE ERROR:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}