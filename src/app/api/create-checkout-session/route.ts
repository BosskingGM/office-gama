import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-server";
import { createOfflineOrder } from "@/lib/offline-order";
import { isPaymentMethod, paymentMethodsFor } from "@/lib/payment";
import {
  CARD_RESERVATION_MINUTES,
  CARD_SESSION_MINUTES,
  COUPON_CODE_RE,
  OFFLINE_RESERVATION_MINUTES,
  applyCoupon,
  normalizeCouponCode,
  releaseCoupon,
  type AppliedCoupon,
} from "@/lib/coupons";
import {
  LOCAL_COVERAGE_TEXT,
  SHIPPING_OPTIONS,
  isInsideLocalZone,
  isInsideMexico,
  isLocalCpRange,
  isShippingType,
  matchLocalCity,
  toCoord,
} from "@/lib/shipping";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QTY_PER_ITEM = 99;
const MAX_DIFFERENT_ITEMS = 40;

type RequestItem = { variant_id: string; quantity: number };

function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function cleanText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  // Cupón reservado para este pago. Si algo falla antes de terminar, se libera.
  let reservation: { couponId: string; userId: string } | null = null;
  const releaseReservation = async () => {
    if (!reservation) return;
    const r = reservation;
    reservation = null;
    await releaseCoupon(r.couponId, r.userId);
  };
  const bail = async (message: string, status = 400, extra: Record<string, unknown> = {}) => {
    await releaseReservation();
    return NextResponse.json({ error: message, ...extra }, { status });
  };

  try {
    // 1) Quién compra: se verifica con el token de sesión, no con lo que diga el navegador.
    const user = await getUserFromRequest(req);
    if (!user) {
      return fail("Debes iniciar sesión para pagar", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) return fail("Solicitud inválida");

    // 2) Carrito: solo se aceptan variant_id y cantidad. El precio NUNCA viene del navegador.
    const rawItems: unknown = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return fail("No hay productos en el carrito");
    }
    if (rawItems.length > MAX_DIFFERENT_ITEMS) {
      return fail("El carrito tiene demasiados productos distintos");
    }

    // Se juntan duplicados por si el mismo variant_id llega dos veces.
    const wanted = new Map<string, number>();
    for (const raw of rawItems as RequestItem[]) {
      const variantId = cleanText(raw?.variant_id, 64);
      const qty = Number(raw?.quantity);
      if (!UUID_RE.test(variantId) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
        return fail("Cantidad inválida en el carrito");
      }
      wanted.set(variantId, (wanted.get(variantId) || 0) + qty);
    }

    // 3) Datos de envío.
    const shippingType = body.shipping?.shipping_type;
    if (!isShippingType(shippingType)) {
      return fail("Tipo de envío inválido");
    }
    const shippingCost = SHIPPING_OPTIONS[shippingType].cost;

    // Método de pago (por defecto tarjeta, como antes). "Pagar al recoger" solo con pickup.
    const paymentMethod = body.payment_method ?? "tarjeta";
    if (!isPaymentMethod(paymentMethod) || !paymentMethodsFor(shippingType).includes(paymentMethod)) {
      return fail("Ese método de pago no está disponible para este tipo de entrega");
    }

    const customer = {
      full_name: cleanText(body.customer?.full_name),
      phone: cleanText(body.customer?.phone, 30),
      address: cleanText(body.customer?.address, 300),
      city: cleanText(body.customer?.city, 100),
      postal_code: cleanText(body.customer?.postal_code, 10),
    };

    if (
      !customer.full_name ||
      !customer.phone ||
      !customer.address ||
      !customer.city ||
      !customer.postal_code
    ) {
      return fail("Completa todos los datos de envío");
    }
    if (customer.phone.replace(/\D/g, "").length < 10) {
      return fail("El teléfono debe tener al menos 10 dígitos");
    }
    if (!/^\d{5}$/.test(customer.postal_code)) {
      return fail("El código postal debe tener 5 dígitos");
    }

    // Ubicación marcada en el mapa (opcional salvo en entrega local).
    // Recoger en tienda no necesita pin.
    let latitude = toCoord(body.customer?.latitude, 90);
    let longitude = toCoord(body.customer?.longitude, 180);
    if (latitude === null || longitude === null) {
      latitude = null;
      longitude = null;
    }
    const pin = latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;

    if (shippingType === "pickup") {
      latitude = null;
      longitude = null;
    } else if (shippingType === "local") {
      // La entrega local SOLO existe en Chalco e Ixtapaluca.
      const city = matchLocalCity(customer.city);
      if (!city) {
        return fail(`La entrega local es válida únicamente en: ${LOCAL_COVERAGE_TEXT.replace("Solo ", "")}. Elige paquetería para otras zonas.`);
      }
      customer.city = city; // nombre oficial, sin variaciones de escritura

      if (pin) {
        if (!isInsideLocalZone(pin)) {
          return fail("El punto marcado está fuera de nuestra zona de entrega local (Chalco e Ixtapaluca)");
        }
      } else if (!isLocalCpRange(customer.postal_code)) {
        // Sin pin, el CP debe estar en el rango de Chalco/Ixtapaluca.
        return fail(
          "Ese código postal no parece de Chalco ni Ixtapaluca. Marca tu ubicación en el mapa o elige paquetería."
        );
      }
    } else if (pin && !isInsideMexico(pin)) {
      return fail("El punto marcado en el mapa debe estar dentro de México");
    }

    // 4) Precios y existencias reales, leídos de la base de datos.
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id, model_name, stock, image_url, products ( id, name, price )")
      .in("id", Array.from(wanted.keys()));

    if (variantsError) {
      console.error("Error leyendo variantes:", variantsError);
      return fail("No se pudo validar el carrito", 500);
    }

    const byId = new Map(
      (variants || []).map((v: any) => [v.id as string, v])
    );

    const cartItems: {
      variant_id: string;
      product_name: string;
      variant_name: string;
      price: number;
      quantity: number;
    }[] = [];
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const [variantId, quantity] of wanted) {
      const v: any = byId.get(variantId);
      const product = Array.isArray(v?.products) ? v.products[0] : v?.products;

      if (!v || !product) {
        return fail("Un producto de tu carrito ya no está disponible");
      }
      if (v.stock < quantity) {
        const label = `${product.name} (${v.model_name})`;
        return fail(
          v.stock <= 0
            ? `${label} está agotado`
            : `Solo quedan ${v.stock} piezas de ${label}`
        );
      }

      const price = Number(product.price);
      cartItems.push({
        variant_id: variantId,
        product_name: product.name,
        variant_name: v.model_name,
        price,
        quantity,
      });

      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: {
            name: `${product.name} - ${v.model_name}`,
            ...(typeof v.image_url === "string" && v.image_url.startsWith("https://")
              ? { images: [v.image_url] }
              : {}),
          },
          unit_amount: Math.round(price * 100),
        },
        quantity,
      });
    }

    // 4b) Cupón (opcional). El descuento SIEMPRE lo calcula el servidor sobre los
    //     precios reales; la reserva evita que el mismo cupón se use dos veces.
    const subtotalCents = cartItems.reduce(
      (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
      0
    );
    const couponCode = normalizeCouponCode(body.coupon_code);
    let coupon: AppliedCoupon | null = null;

    if (couponCode) {
      if (!COUPON_CODE_RE.test(couponCode)) {
        return fail("Ese cupón no existe. Revisa que esté bien escrito.", 409, {
          coupon_error: true,
        });
      }
      const applied = await applyCoupon({
        code: couponCode,
        userId: user.id,
        phone: customer.phone,
        subtotal: subtotalCents / 100,
        ttlMinutes:
          paymentMethod === "tarjeta" ? CARD_RESERVATION_MINUTES : OFFLINE_RESERVATION_MINUTES,
      });
      if (!applied.ok) {
        return fail(applied.error, 409, { coupon_error: true });
      }
      coupon = applied.coupon;
      reservation = { couponId: coupon.couponId, userId: user.id };

      // Si este cliente dejó un pago a medias con el mismo cupón, ese pago se cancela.
      if (coupon.replacedSessionId) {
        try {
          await stripe.checkout.sessions.expire(coupon.replacedSessionId);
        } catch {
          /* ya había vencido o se había pagado */
        }
      }
    }
    const discountCents = coupon ? Math.round(coupon.discount * 100) : 0;

    // Transferencia o pagar al recoger: no pasa por Stripe; el pedido se crea aquí.
    if (paymentMethod !== "tarjeta") {
      const result = await createOfflineOrder({
        userId: user.id,
        userEmail: user.email ?? null,
        method: paymentMethod,
        items: cartItems,
        shippingType,
        shippingCost,
        customer,
        latitude,
        longitude,
        coupon: coupon
          ? { id: coupon.couponId, code: coupon.code, discount: coupon.discount }
          : null,
      });
      if (result.ok) {
        reservation = null; // el pedido ya consumió la reserva
        return NextResponse.json({ orderId: result.orderId });
      }
      return bail(result.error, result.status);
    }

    // Stripe no cobra menos de $10 MXN
    if (coupon && subtotalCents - discountCents + Math.round(shippingCost * 100) < 1000) {
      return bail(
        "Con este cupón el total queda por debajo del mínimo para pagar con tarjeta. Elige otro método de pago.",
        409,
        { coupon_error: true }
      );
    }

    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: "mxn",
          product_data: { name: SHIPPING_OPTIONS[shippingType].label },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // 5) El carrito validado se guarda en la base de datos; a Stripe solo se le pasa su id.
    //    (La metadata de Stripe admite máximo 500 caracteres por campo.)
    //    De paso se limpian carritos viejos que nunca se pagaron.
    await supabaseAdmin
      .from("checkout_carts")
      .delete()
      .lt("created_at", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());

    const { data: cart, error: cartError } = await supabaseAdmin
      .from("checkout_carts")
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        items: cartItems,
        customer: { ...customer, latitude, longitude },
        shipping_type: shippingType,
        shipping_cost: shippingCost,
        ...(coupon
          ? {
              coupon_id: coupon.couponId,
              coupon_code: coupon.code,
              discount_amount: coupon.discount,
            }
          : {}),
      })
      .select("id")
      .single();

    if (cartError || !cart) {
      console.error("Error guardando carrito:", cartError);
      return bail("No se pudo preparar el pago", 500);
    }

    // La reserva queda ligada a este carrito (para liberarla si el pago expira).
    if (coupon) {
      await supabaseAdmin
        .from("coupon_redemptions")
        .update({ cart_id: String(cart.id) })
        .eq("coupon_id", coupon.couponId)
        .eq("user_id", user.id)
        .eq("status", "reserved");
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

    // El descuento va como un cupón de Stripe de monto fijo (solo sobre productos,
    // nunca sobre el envío) para que Stripe cobre exactamente el total correcto.
    const stripeCoupon = coupon
      ? await stripe.coupons.create({
          amount_off: discountCents,
          currency: "mxn",
          duration: "once",
          max_redemptions: 1,
          name: `Cupón ${coupon.code}`.slice(0, 40),
        })
      : null;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      ...(stripeCoupon ? { discounts: [{ coupon: stripeCoupon.id }] } : {}),
      // Con cupón, el pago expira antes que la reserva: así el cupón no queda atorado.
      ...(coupon
        ? { expires_at: Math.floor(Date.now() / 1000) + CARD_SESSION_MINUTES * 60 }
        : {}),
      customer_email: user.email ?? undefined,
      client_reference_id: cart.id,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/carrito`,
      metadata: { cart_id: cart.id, user_id: user.id },
    });

    if (coupon) {
      await supabaseAdmin
        .from("coupon_redemptions")
        .update({ stripe_session_id: session.id })
        .eq("coupon_id", coupon.couponId)
        .eq("user_id", user.id)
        .eq("status", "reserved");
    }

    // A partir de aquí el webhook (o la página de éxito) consume la reserva.
    reservation = null;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión:", error);
    await releaseReservation();
    return fail("Error creando sesión de pago", 500);
  }
}
