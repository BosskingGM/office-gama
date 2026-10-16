import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-server";
import { lookupCp } from "@/lib/postal";
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

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: Request) {
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

      // El código postal se verifica contra SEPOMEX cuando el servicio responde.
      const cpResult = await lookupCp(customer.postal_code);
      if (!cpResult.ok && cpResult.reason === "notfound") {
        return fail("No encontramos ese código postal. Revísalo e intenta de nuevo.");
      }
      if (cpResult.ok && cpResult.info.municipio && !matchLocalCity(cpResult.info.municipio)) {
        return fail(
          `Ese código postal es de ${cpResult.info.municipio}. La entrega local es válida únicamente en Chalco e Ixtapaluca. Elige paquetería para otras zonas.`
        );
      }

      if (pin) {
        if (!isInsideLocalZone(pin)) {
          return fail("El punto marcado está fuera de nuestra zona de entrega local (Chalco e Ixtapaluca)");
        }
      } else {
        // Sin pin: el municipio confirmado por SEPOMEX, o (si el servicio no lo da
        // o está caído) que el CP esté en el rango de Chalco/Ixtapaluca.
        const confirmed = cpResult.ok && !!cpResult.info.municipio;
        if (!confirmed && !isLocalCpRange(customer.postal_code)) {
          return fail(
            "Ese código postal no parece de Chalco ni Ixtapaluca. Marca tu ubicación en el mapa o elige paquetería."
          );
        }
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
      })
      .select("id")
      .single();

    if (cartError || !cart) {
      console.error("Error guardando carrito:", cartError);
      return fail("No se pudo preparar el pago", 500);
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      customer_email: user.email ?? undefined,
      client_reference_id: cart.id,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/carrito`,
      metadata: { cart_id: cart.id, user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creando sesión:", error);
    return fail("Error creando sesión de pago", 500);
  }
}
