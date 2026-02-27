import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {

});

export async function POST(req: Request) {
  try {
    const { items, shipping, user, customer } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No hay productos en el carrito" },
        { status: 400 }
      );
    }

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

    // Agregar envío como producto
    if (shipping?.shipping_cost > 0) {
      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name:
              shipping.shipping_type === "local"
                ? "Envío local"
                : "Envío nacional",
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
        user_id: user?.id || "",
        items: JSON.stringify(items),

        full_name: customer?.full_name || "",
        phone: customer?.phone || "",
        address: customer?.address || "",
        city: customer?.city || "",
        postal_code: customer?.postal_code || "",

        shipping_type: shipping?.shipping_type || "",
        shipping_cost: shipping?.shipping_cost?.toString() || "0",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión:", error);
    return NextResponse.json(
      { error: "Error creando sesión" },
      { status: 500 }
    );
  }
}