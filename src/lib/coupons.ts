// Cupones: validación, reserva y canje. SOLO se importa desde código de servidor.
// Toda la lógica que decide "¿puede usarlo?" vive en la base de datos
// (supabase/coupons.sql → apply_coupon / finalize_coupon), con bloqueo de fila,
// para que dos pagos al mismo tiempo nunca usen el mismo cupón.

import { supabaseAdmin } from "@/lib/supabase-admin";

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

// Una reserva dura lo que dura el pago. Stripe se configura para expirar antes.
export const CARD_RESERVATION_MINUTES = 40;
export const CARD_SESSION_MINUTES = 35;
export const OFFLINE_RESERVATION_MINUTES = 10;

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function normalizeCouponCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}

// Últimos 10 dígitos del teléfono: así "55 1234 5678" y "+52 5512345678" son el mismo.
export function phoneKey(phone: unknown): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export type AppliedCoupon = {
  couponId: string;
  code: string;
  percent: number;
  discount: number; // pesos, ya redondeado a centavos
  replacedSessionId: string | null;
};

export type ApplyResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

function messageFor(status: string, min?: number): string {
  switch (status) {
    case "not_found":
      return "Ese cupón no existe. Revisa que esté bien escrito.";
    case "inactive":
      return "Ese cupón ya no está activo.";
    case "not_started":
      return "Ese cupón todavía no está vigente.";
    case "expired":
      return "Ese cupón ya venció.";
    case "min_subtotal":
      return min && min > 0
        ? `Este cupón aplica en compras de ${money(min)} o más.`
        : "Este cupón no aplica a este carrito.";
    case "already_used":
      return "Ya usaste este cupón. Solo se puede usar una vez por cliente.";
    case "in_progress":
      return "Este cupón está en un pago en proceso. Intenta de nuevo en unos minutos.";
    case "not_first_purchase":
      return "Este cupón es solo para tu primera compra.";
    case "exhausted":
      return "Este cupón ya alcanzó su límite de usos.";
    default:
      return "No pudimos validar el cupón. Intenta de nuevo.";
  }
}

export async function applyCoupon(input: {
  code: string;
  userId: string;
  phone: unknown;
  subtotal: number; // pesos (suma de productos, sin envío)
  ttlMinutes?: number;
  dryRun?: boolean;
}): Promise<ApplyResult> {
  const { data, error } = await supabaseAdmin.rpc("apply_coupon", {
    p_code: input.code,
    p_user_id: input.userId,
    p_phone_key: phoneKey(input.phone),
    p_subtotal: input.subtotal,
    p_ttl_minutes: input.ttlMinutes ?? CARD_RESERVATION_MINUTES,
    p_dry_run: input.dryRun ?? false,
  });

  if (error) {
    console.error("❌ apply_coupon:", error);
    const missing =
      error.code === "42883" || error.code === "PGRST202" || /apply_coupon/i.test(error.message);
    return {
      ok: false,
      error: missing
        ? "Los cupones aún no están activados en la tienda."
        : "No pudimos validar el cupón. Intenta de nuevo.",
    };
  }

  const r = (data ?? {}) as Record<string, unknown>;
  if (r.status !== "ok") {
    return { ok: false, error: messageFor(String(r.status), Number(r.min ?? 0)) };
  }

  return {
    ok: true,
    coupon: {
      couponId: String(r.coupon_id),
      code: String(r.code),
      percent: Number(r.percent),
      discount: Number(r.discount),
      replacedSessionId: typeof r.replaced_session_id === "string" ? r.replaced_session_id : null,
    },
  };
}

// Convierte la reserva en uso definitivo (ya existe el pedido).
export async function finalizeCoupon(input: {
  couponId: string;
  userId: string;
  phone: unknown;
  orderId: string;
  discount: number;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("finalize_coupon", {
    p_coupon_id: input.couponId,
    p_user_id: input.userId,
    p_phone_key: phoneKey(input.phone),
    p_order_id: input.orderId,
    p_discount: input.discount,
  });
  if (error) {
    console.error("❌ finalize_coupon:", error);
    return false;
  }
  return data === true;
}

// Libera una reserva que no llegó a pagarse.
export async function releaseCoupon(couponId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from("coupon_redemptions")
    .delete()
    .eq("coupon_id", couponId)
    .eq("user_id", userId)
    .eq("status", "reserved");
  if (error) console.error("⚠️ No se pudo liberar el cupón:", error);
}

export async function releaseCouponByCart(cartId: string) {
  const { error } = await supabaseAdmin
    .from("coupon_redemptions")
    .delete()
    .eq("cart_id", cartId)
    .eq("status", "reserved");
  if (error) console.error("⚠️ No se pudo liberar el cupón del carrito:", error);
}

// Línea que se agrega a las notas del pedido (la ve el administrador).
export function couponNote(code: string, discount: number) {
  return `Cupón ${code}: -${money(discount)}`;
}
