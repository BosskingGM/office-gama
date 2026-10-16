// El carrito pregunta aquí "¿este cupón sirve y cuánto descuenta?".
// Es solo una consulta: NO reserva ni gasta el cupón (eso pasa al pagar,
// en create-checkout-session). El monto sale de los precios reales de la base
// de datos, no de lo que mande el navegador.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-server";
import { COUPON_CODE_RE, applyCoupon, normalizeCouponCode } from "@/lib/coupons";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Freno contra quien intente adivinar códigos: 10 intentos por cuenta cada 10 min.
// (En memoria: es una barrera básica por instancia del servidor.)
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooMany(userId: string) {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || entry.resetAt < now) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return reply({ valid: false, error: "Inicia sesión para usar un cupón." }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return reply({ valid: false, error: "Solicitud inválida" }, 400);

  const code = normalizeCouponCode(body.code);
  if (!code) return reply({ valid: false, error: "Escribe tu código de cupón." }, 400);

  if (tooMany(user.id)) {
    return reply(
      { valid: false, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
      429
    );
  }
  if (!COUPON_CODE_RE.test(code)) {
    return reply({ valid: false, error: "Ese cupón no existe. Revisa que esté bien escrito." }, 400);
  }

  // Subtotal real del carrito (precio de la base de datos × cantidad)
  const raw: unknown = body.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
    return reply({ valid: false, error: "Tu carrito está vacío." }, 400);
  }
  const wanted = new Map<string, number>();
  for (const it of raw as { variant_id?: unknown; quantity?: unknown }[]) {
    const id = typeof it?.variant_id === "string" ? it.variant_id : "";
    const qty = Number(it?.quantity);
    if (!UUID_RE.test(id) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return reply({ valid: false, error: "Carrito inválido." }, 400);
    }
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  const { data: variants, error } = await supabaseAdmin
    .from("product_variants")
    .select("id, products ( price )")
    .in("id", Array.from(wanted.keys()));
  if (error) {
    console.error("Error leyendo variantes:", error);
    return reply({ valid: false, error: "No pudimos validar el cupón." }, 500);
  }

  let subtotalCents = 0;
  for (const v of (variants || []) as any[]) {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    if (!product) continue;
    subtotalCents += Math.round(Number(product.price) * 100) * (wanted.get(v.id) || 0);
  }

  const result = await applyCoupon({
    code,
    userId: user.id,
    phone: body.phone,
    subtotal: subtotalCents / 100,
    dryRun: true,
  });

  if (!result.ok) return reply({ valid: false, error: result.error }, 409);

  return reply({
    valid: true,
    code: result.coupon.code,
    percent: result.coupon.percent,
    discount: result.coupon.discount,
  });
}
