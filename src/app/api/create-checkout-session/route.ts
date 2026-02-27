import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {

});

export async function POST(req: Request) {
  try {
    const { items, shipping } = await req.json();

    const line_items = items.map((item: any) => ({
      price_data: {
        currency: "mxn",
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // 🔥 ENVÍO REAL AGREGADO A STRIPE
    if (shipping.shipping_cost > 0) {
      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name:
              shipping.shipping_type === "local"
                ? "Envío local"
                : "Estafeta nacional",
          },
          unit_amount: Math.round(shipping.shipping_cost * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/carrito`,
      metadata: {
        shipping_type: shipping.shipping_type,
        shipping_cost: shipping.shipping_cost.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error creando sesión" },
      { status: 500 }
    );
  }
}