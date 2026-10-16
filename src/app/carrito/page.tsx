"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  Lock,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import AddressFields, {
  type AddrErrors,
  type AddrValue,
} from "@/components/AddressFields";
import { STORE_MAPS_URL, STORE_PICKUP_DATA } from "@/lib/store";
import { joinAddress, splitAddress, norm } from "@/lib/address";
import {
  PAYMENT_METHODS,
  paymentMethodsFor,
  type PaymentMethod,
} from "@/lib/payment";
import {
  LOCAL_COVERAGE_TEXT,
  SHIPPING_OPTIONS,
  isInsideLocalZone,
  isInsideMexico,
  isLocalCpRange,
  matchLocalCity,
  type LatLng,
  type ShippingType,
} from "@/lib/shipping";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const SHIPPING_NOTES: Record<ShippingType, string> = {
  pickup: "Retiro en nuestro local",
  local: `${LOCAL_COVERAGE_TEXT} · costo fijo`,
  paqueteria: "Envío a todo México",
};

const FORM_KEY = "officegama_checkout_form";

type AppliedCoupon = { code: string; percent: number; discount: number; forSubtotal: number };
type CouponCheck =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

type FormState = AddrValue & {
  full_name: string;
  phone: string;
};
type Errors = Partial<Record<keyof FormState | "location", string>>;

type SavedAddress = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string; // texto completo: "Calle y número, Col. Colonia"
  colonia: string | null;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

const EMPTY: FormState = {
  full_name: "",
  phone: "",
  address: "",
  colonia: "",
  city: "",
  postal_code: "",
  latitude: null,
  longitude: null,
  mode: "manual",
};

// Convierte una dirección guardada en los campos del formulario.
function fromSaved(a: SavedAddress): Omit<FormState, "full_name" | "phone"> {
  const { street, colonia } = splitAddress(a.address, a.colonia);
  const hasPin = a.latitude !== null && a.longitude !== null;
  return {
    address: street,
    colonia,
    city: a.city,
    postal_code: a.postal_code,
    latitude: hasPin ? a.latitude : null,
    longitude: hasPin ? a.longitude : null,
    mode: hasPin ? "mapa" : "manual",
  };
}

// Mismas reglas que el servidor (create-checkout-session)
function validate(f: FormState, shippingType: ShippingType): Errors {
  const needsAddress = shippingType !== "pickup";
  const e: Errors = {};
  if (!f.full_name.trim()) e.full_name = "Escribe tu nombre completo";
  if (f.phone.replace(/\D/g, "").length < 10)
    e.phone = "Escribe un teléfono de 10 dígitos";
  if (needsAddress) {
    if (!f.address.trim()) e.address = "Escribe tu calle y número";
    if (!f.colonia.trim()) e.colonia = "Escribe tu colonia";
    if (!f.city.trim()) e.city = "Escribe tu ciudad";
    if (!/^\d{5}$/.test(f.postal_code))
      e.postal_code = "El código postal tiene 5 dígitos";

    const pin: LatLng | null =
      f.latitude !== null && f.longitude !== null
        ? { lat: f.latitude, lng: f.longitude }
        : null;

    if (shippingType === "local") {
      if (!matchLocalCity(f.city))
        e.city = `La entrega local es ${LOCAL_COVERAGE_TEXT.toLowerCase()}`;

      if (pin) {
        if (!isInsideLocalZone(pin))
          e.location = "El pin está fuera de nuestra zona de entrega local (Chalco e Ixtapaluca)";
      } else if (!isLocalCpRange(f.postal_code) && !e.postal_code) {
        // Sin pin, el CP debe estar en el rango de Chalco/Ixtapaluca.
        e.postal_code =
          "Ese código postal no parece de Chalco ni Ixtapaluca. Revísalo o márcalo en el mapa";
      }
    } else if (pin && !isInsideMexico(pin)) {
      e.location = "El pin debe estar dentro de México";
    }
  }
  return e;
}

export default function CarritoPage() {
  const {
    cart,
    count,
    subtotal,
    hydrated,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    syncCart,
    clearCart,
  } = useCart();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [shippingType, setShippingType] = useState<ShippingType>("pickup");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("tarjeta");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  /* Cupón: el servidor lo valida y calcula el monto; aquí solo se muestra */
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const needsAddress = shippingType !== "pickup";
  const shippingCost = SHIPPING_OPTIONS[shippingType].cost; // solo informativo
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = Math.max(0, subtotal - discount + shippingCost);

  /* Sesión */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
  }, []);

  /* Direcciones y datos guardados en la cuenta: llenan el formulario vacío */
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [addrRes, detRes] = await Promise.all([
        supabase
          .from("addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase
          .from("customer_details")
          .select("full_name, phone")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!alive) return;
      const list = (addrRes.data ?? []) as SavedAddress[];
      setSaved(list);
      const def = list[0]; // la predeterminada va primero
      // Solo se llenan los campos que estén vacíos: no pisa lo que ya escribió
      setForm((f) => {
        const d = def ? fromSaved(def) : null;
        const empty = !f.address && !f.postal_code && !f.city;
        return {
          ...f,
          full_name: f.full_name || def?.full_name || detRes.data?.full_name || "",
          phone: f.phone || def?.phone || detRes.data?.phone || "",
          ...(empty && d ? d : {}),
        };
      });
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* Datos de envío recordados en este navegador */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_KEY);
      if (saved) setForm({ ...EMPTY, ...JSON.parse(saved) });
    } catch {
      /* sin datos guardados */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(form));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [form]);

  /* Al entrar, revisa precios y existencias una sola vez */
  const syncRef = useRef(syncCart);
  syncRef.current = syncCart;
  const synced = useRef(false);
  useEffect(() => {
    if (!hydrated || synced.current) return;
    synced.current = true;
    syncRef.current().then(({ removed, adjusted }) => {
      if (removed.length)
        setNotice(
          `Ya no está disponible: ${removed.join(", ")}. Lo quitamos de tu carrito.`
        );
      else if (adjusted.length)
        setNotice(`Actualizamos precio o existencias de: ${adjusted.join(", ")}.`);
    });
  }, [hydrated]);

  /* Pregunta al servidor si el cupón sirve para este carrito (no lo gasta) */
  const checkCoupon = async (code: string): Promise<CouponCheck> => {
    const forSubtotal = subtotal;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Inicia sesión para usar un cupón." };
    try {
      const res = await fetch("/api/validate-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code,
          phone: form.phone,
          items: cart.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        return {
          ok: true,
          coupon: {
            code: data.code,
            percent: data.percent,
            discount: data.discount,
            forSubtotal,
          },
        };
      }
      return { ok: false, error: data.error || "No pudimos validar el cupón." };
    } catch {
      return { ok: false, error: "No pudimos validar el cupón. Revisa tu conexión." };
    }
  };

  const applyCouponCode = async () => {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponError("");
    setCouponBusy(true);
    const r = await checkCoupon(code);
    setCouponBusy(false);
    if (r.ok) {
      setCoupon(r.coupon);
      setCouponInput("");
    } else {
      setCouponError(r.error);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponError("");
  };

  // Si cambian las piezas, el descuento se recalcula (o se quita si ya no aplica).
  useEffect(() => {
    if (!coupon || !hydrated || coupon.forSubtotal === subtotal) return;
    let alive = true;
    (async () => {
      const r = await checkCoupon(coupon.code);
      if (!alive) return;
      if (r.ok) {
        setCoupon((c) => (c && c.code === r.coupon.code ? r.coupon : c));
      } else {
        setCoupon(null);
        setCouponError(r.error);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, coupon?.code, hydrated]);

  const patchForm = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as (keyof FormState)[]) delete next[k];
      if ("latitude" in patch || "mode" in patch) delete next.location;
      return next;
    });
  };

  // Dirección guardada que coincide con lo que hay en el formulario (para el selector).
  const selectedSavedId =
    saved.find((a) => {
      const s = fromSaved(a);
      return (
        a.full_name === form.full_name &&
        a.phone === form.phone &&
        s.address === form.address &&
        norm(s.colonia) === norm(form.colonia) &&
        norm(a.city) === norm(form.city) &&
        a.postal_code === form.postal_code
      );
    })?.id ?? "";

  const chooseShipping = (key: ShippingType) => {
    setShippingType(key);
    setErrors({});
    // "Pagar al recoger" solo existe con recoger en tienda.
    if (!paymentMethodsFor(key).includes(paymentMethod)) setPaymentMethod("tarjeta");
    if (key === "local") {
      // La entrega local solo existe en Chalco e Ixtapaluca: se obliga a elegir.
      setForm((f) => {
        const pinOutside =
          f.latitude !== null &&
          f.longitude !== null &&
          !isInsideLocalZone({ lat: f.latitude, lng: f.longitude });
        return {
          ...f,
          city: matchLocalCity(f.city) ?? "",
          latitude: pinOutside ? null : f.latitude,
          longitude: pinOutside ? null : f.longitude,
        };
      });
    }
  };

  const handleCheckout = async () => {
    setServerError("");

    if (!user) {
      router.push("/login?next=/carrito");
      return;
    }

    const found = validate(form, shippingType);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document
        .getElementById("envio")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      setLoading(true);

      // El servidor identifica al comprador con este token y calcula precios y
      // envío por su cuenta: aquí solo se manda qué variante y cuántas piezas.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login?next=/carrito");
        return;
      }

      const customer = needsAddress
        ? {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            address: joinAddress(form.address, form.colonia),
            city: form.city.trim(),
            postal_code: form.postal_code,
            latitude: form.latitude,
            longitude: form.longitude,
          }
        : {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            ...STORE_PICKUP_DATA,
          };

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
          })),
          shipping: { shipping_type: shippingType },
          payment_method: paymentMethod,
          customer,
          ...(coupon ? { coupon_code: coupon.code } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));

      // El servidor rechazó el cupón (ya usado, vencido, etc.): se quita para no cobrar mal.
      if (!response.ok && data.coupon_error) {
        setCoupon(null);
        setCouponError(data.error || "El cupón ya no es válido.");
        setLoading(false);
        return;
      }

      // Transferencia o pagar al recoger: el pedido ya quedó creado, sin pasar por Stripe.
      if (response.ok && data.orderId) {
        clearCart();
        router.push(`/pedido/${data.orderId}?nuevo=1`);
        return;
      }

      if (response.ok && data.url) {
        window.location.href = data.url;
        return; // seguimos en "Procesando…" mientras redirige
      }
      setServerError(data.error || "No pudimos iniciar el pago. Intenta de nuevo.");
    } catch (error) {
      console.error(error);
      setServerError("Error inesperado. Revisa tu conexión e intenta de nuevo.");
    }
    setLoading(false);
  };

  /* Cargando el carrito guardado */
  if (!hydrated) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-32" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  /* Carrito vacío */
  if (cart.length === 0) {
    return (
      <div className="card p-10 sm:p-14 text-center space-y-5 max-w-md mx-auto">
        <div className="mx-auto w-20 h-20 rounded-full bg-brand-soft grid place-items-center">
          <ShoppingBag size={34} className="text-brand-strong" />
        </div>
        <h1 className="text-2xl font-bold">Tu carrito está vacío</h1>
        <p className="text-sm text-muted">
          Cuando agregues productos, aparecerán aquí.
        </p>
        <Link href="/" className="btn-primary">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  const fieldClass = (k: keyof FormState | "location") =>
    `field ${errors[k] ? "border-danger!" : ""}`;

  const Err = ({ k }: { k: keyof FormState | "location" }) =>
    errors[k] ? (
      <p id={`err-${k}`} role="alert" className="text-xs text-danger mt-1.5">
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl sm:text-4xl font-extrabold">
        Tu carrito{" "}
        <span className="text-lg font-medium text-muted">
          ({count} {count === 1 ? "pieza" : "piezas"})
        </span>
      </h1>

      {notice && (
        <p
          role="status"
          className="text-sm bg-peach-soft border border-peach rounded-xl px-4 py-3"
        >
          {notice}
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-8">
          {/* Productos */}
          <section className="card divide-y divide-line">
            {cart.map((item) => (
              <div key={item.variant_id} className="p-4 sm:p-5 flex gap-4">
                <Link
                  href={`/producto/${item.product_id}`}
                  className="w-24 h-24 rounded-xl overflow-hidden bg-brand-soft shrink-0 grid place-items-center"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag size={24} className="text-brand-strong" />
                  )}
                </Link>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/producto/${item.product_id}`}
                        className="font-semibold leading-5 line-clamp-2 hover:text-brand-strong transition"
                      >
                        {item.name}
                      </Link>
                      {item.model_name && (
                        <p className="text-sm text-muted mt-0.5">
                          {item.model_name}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.variant_id)}
                      aria-label={`Quitar ${item.name}`}
                      className="text-neutral-400 hover:text-danger transition h-fit p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-3">
                    <div className="flex items-center border border-line rounded-full">
                      <button
                        onClick={() => decreaseQuantity(item.variant_id)}
                        aria-label="Quitar una pieza"
                        className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft transition"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => increaseQuantity(item.variant_id)}
                        disabled={item.quantity >= item.stock}
                        aria-label="Agregar una pieza"
                        className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft transition disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {money(item.price * item.quantity)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-muted">
                          {money(item.price)} c/u
                        </p>
                      )}
                    </div>
                  </div>

                  {item.quantity >= item.stock && (
                    <p className="text-xs text-brand-strong mt-2">
                      Máximo disponible: {item.stock}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Envío */}
          <section id="envio" className="card p-5 sm:p-7 space-y-6 scroll-mt-28">
            <h2 className="text-xl font-bold">¿Cómo lo quieres recibir?</h2>

            <div
              role="radiogroup"
              aria-label="Tipo de envío"
              className="grid sm:grid-cols-3 gap-3"
            >
              {(Object.keys(SHIPPING_OPTIONS) as ShippingType[]).map((key) => {
                const opt = SHIPPING_OPTIONS[key];
                const active = shippingType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseShipping(key)}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      active
                        ? "border-brand-strong bg-brand-soft"
                        : "border-line bg-white hover:border-brand"
                    }`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="font-bold mt-1">
                      {opt.cost === 0 ? "Gratis" : money(opt.cost)}
                    </p>
                    <p className="text-xs text-muted mt-1 leading-4">
                      {SHIPPING_NOTES[key]}
                    </p>
                  </button>
                );
              })}
            </div>

            <div>
              <h3 className="font-semibold mb-4">
                {needsAddress ? "Datos de entrega" : "Datos de contacto"}
              </h3>

              {saved.length > 0 && needsAddress && (
                <div className="mb-4">
                  <label
                    htmlFor="saved_address"
                    className="text-sm font-medium mb-1.5 block"
                  >
                    Usar una dirección guardada
                  </label>
                  <select
                    id="saved_address"
                    value={selectedSavedId}
                    onChange={(e) => {
                      const a = saved.find((x) => x.id === e.target.value);
                      if (!a) return;
                      setForm({
                        full_name: a.full_name,
                        phone: a.phone,
                        ...fromSaved(a),
                      });
                      setErrors({});
                    }}
                    className="field"
                  >
                    <option value="">Elegir una dirección…</option>
                    {saved.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} · {a.address}, {a.city}
                        {shippingType === "local" && !matchLocalCity(a.city)
                          ? " (fuera de zona local)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="full_name" className="text-sm font-medium mb-1.5 block">
                    Nombre completo
                  </label>
                  <input
                    id="full_name"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(e) => patchForm({ full_name: e.target.value })}
                    aria-invalid={!!errors.full_name}
                    aria-describedby={errors.full_name ? "err-full_name" : undefined}
                    className={fieldClass("full_name")}
                  />
                  <Err k="full_name" />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10 dígitos"
                    value={form.phone}
                    onChange={(e) => patchForm({ phone: e.target.value })}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "err-phone" : undefined}
                    className={fieldClass("phone")}
                  />
                  <Err k="phone" />
                </div>

                {needsAddress ? (
                  <>
                    {shippingType === "local" && (
                      <p className="sm:col-span-2 text-sm text-neutral-700 bg-brand-soft border border-brand rounded-xl px-4 py-3">
                        <strong>Entrega local disponible únicamente en Chalco e
                        Ixtapaluca.</strong>{" "}
                        Si vives en otra zona, elige{" "}
                        <button
                          type="button"
                          onClick={() => chooseShipping("paqueteria")}
                          className="font-semibold underline"
                        >
                          Paquetería nacional
                        </button>
                        .
                      </p>
                    )}

                    <AddressFields
                      key={shippingType}
                      idPrefix="envio"
                      zone={shippingType === "local" ? "local" : "mexico"}
                      value={form}
                      onChange={patchForm}
                      errors={errors as AddrErrors}
                      onSwitchToParcel={() => chooseShipping("paqueteria")}
                    />
                    {shippingType === "paqueteria" && (
                      <p className="sm:col-span-2 text-xs text-muted -mt-2">
                        El pin en el mapa es opcional: ayuda a que la paquetería ubique tu domicilio con más precisión.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600 bg-peach-soft border border-peach rounded-xl px-4 py-3">
                    <p>
                      Recogerás tu pedido en nuestra tienda. Te avisaremos cuando
                      esté listo.
                    </p>
                    <a
                      href={STORE_MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-brand-strong bg-white border border-peach rounded-full px-4 py-2 hover:bg-brand-soft transition shrink-0"
                    >
                      <MapPin size={16} aria-hidden="true" />
                      Ver ubicación
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Método de pago */}
          <section className="card p-5 sm:p-7 space-y-4">
            <h2 className="text-xl font-bold">¿Cómo vas a pagar?</h2>
            <div
              role="radiogroup"
              aria-label="Método de pago"
              className="grid sm:grid-cols-3 gap-3"
            >
              {paymentMethodsFor(shippingType).map((key) => {
                const active = paymentMethod === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPaymentMethod(key)}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      active
                        ? "border-brand-strong bg-brand-soft"
                        : "border-line bg-white hover:border-brand"
                    }`}
                  >
                    <p className="font-semibold text-sm">{PAYMENT_METHODS[key].label}</p>
                    <p className="text-xs text-muted mt-1 leading-4">
                      {PAYMENT_METHODS[key].note}
                    </p>
                  </button>
                );
              })}
            </div>
            {paymentMethod === "transferencia" && (
              <p className="text-sm bg-brand-soft rounded-xl px-4 py-3">
                Al confirmar te mostraremos los datos bancarios. Tus piezas quedan
                apartadas y el pedido pasa a <strong>revisión</strong> hasta que
                validemos tu pago.
              </p>
            )}
            {paymentMethod === "efectivo_tienda" && (
              <p className="text-sm bg-brand-soft rounded-xl px-4 py-3">
                Apartamos tus piezas y pagas en la tienda al recogerlas.
              </p>
            )}
          </section>
        </div>

        {/* RESUMEN */}
        <aside className="card p-5 sm:p-7 lg:sticky lg:top-28 space-y-5">
          <h2 className="text-xl font-bold">Resumen</h2>

          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                Productos ({count})
              </dt>
              <dd className="font-medium">{money(subtotal)}</dd>
            </div>
            {coupon && (
              <div className="flex justify-between text-ok">
                <dt>
                  Cupón {coupon.code} (−{coupon.percent}%)
                </dt>
                <dd className="font-medium">−{money(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-600">
                Envío ({SHIPPING_OPTIONS[shippingType].label})
              </dt>
              <dd className="font-medium">
                {shippingCost === 0 ? "Gratis" : money(shippingCost)}
              </dd>
            </div>
          </dl>

          {/* Cupón */}
          <div>
            {coupon ? (
              <div className="flex items-center justify-between gap-3 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <span className="flex items-center gap-2 font-medium text-ok min-w-0">
                  <Tag size={16} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">Cupón {coupon.code} aplicado</span>
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs font-semibold text-neutral-600 underline shrink-0"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="coupon" className="text-sm font-medium mb-1.5 block">
                  ¿Tienes un cupón?
                </label>
                <div className="flex gap-2">
                  <input
                    id="coupon"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCouponCode();
                      }
                    }}
                    placeholder="Escribe tu código"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={30}
                    aria-invalid={!!couponError}
                    aria-describedby={couponError ? "err-coupon" : undefined}
                    className="field min-w-0 uppercase"
                  />
                  <button
                    type="button"
                    onClick={applyCouponCode}
                    disabled={couponBusy || !couponInput.trim()}
                    className="btn-outline shrink-0 text-sm px-5!"
                  >
                    {couponBusy ? "…" : "Aplicar"}
                  </button>
                </div>
              </>
            )}
            {couponError && (
              <p id="err-coupon" role="alert" className="text-xs text-danger mt-1.5">
                {couponError}
              </p>
            )}
          </div>

          <div className="flex justify-between items-baseline border-t border-line pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-3xl font-extrabold">{money(total)}</span>
          </div>

          {!user && (
            <p className="text-sm bg-brand-soft rounded-xl px-4 py-3">
              Necesitas una cuenta para pagar. Tu carrito se conserva al
              iniciar sesión.
            </p>
          )}

          {serverError && (
            <div
              role="alert"
              className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="btn-primary w-full text-base py-4"
          >
            {loading ? (
              "Procesando…"
            ) : user ? (
              paymentMethod === "tarjeta" ? (
                <>
                  <Lock size={18} /> Pagar con tarjeta
                </>
              ) : paymentMethod === "transferencia" ? (
                "Confirmar y pagar por transferencia"
              ) : (
                "Confirmar pedido"
              )
            ) : (
              "Iniciar sesión para pagar"
            )}
          </button>

          <p className="text-xs text-muted text-center">
            {paymentMethod === "tarjeta"
              ? "Pago seguro con Stripe. No guardamos los datos de tu tarjeta."
              : "No se hace ningún cargo ahora."}
          </p>
        </aside>
      </div>
    </div>
  );
}
