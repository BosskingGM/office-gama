// La página "pago confirmado" pregunta aquí por su pedido.
// Verifica el pago directamente con Stripe (no confía en el navegador) y, si el
// webhook aún no creó el pedido, lo crea. Solo responde al dueño de la compra.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-server";
import { fulfillPaidSession } from "@/lib/fulfill-order";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!SESSION_RE.test(sessionId)) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  // Solo quien hizo la compra puede ver su pedido.
  if (session.metadata?.user_id !== user.id) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ status: "unpaid" });
  }

  const result = await fulfillPaidSession(session);
  if (!result.ok) {
    // "processing": puede ser temporal, la página vuelve a preguntar.
    return NextResponse.json({ status: result.reason === "no_cart" ? "problem" : "processing" });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      `id, total, status, shipping_type, shipping_cost, full_name, address, city, postal_code,
       order_items ( quantity, price, product_name, variant_name )`
    )
    .eq("id", result.orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ status: "processing" });
  return NextResponse.json({ status: "paid", order });
}
