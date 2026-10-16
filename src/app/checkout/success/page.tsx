"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  HelpCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { SHIPPING_OPTIONS, type ShippingType } from "@/lib/shipping";
import { STORE_ADDRESS_FULL, STORE_MAPS_URL } from "@/lib/store";
import { WHATSAPP_URL } from "@/lib/account";

const money = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type OrderItem = {
  quantity: number;
  price: number;
  product_name: string | null;
  variant_name: string | null;
};
type PaidOrder = {
  id: string;
  total: number;
  shipping_type: string | null;
  shipping_cost: number | null;
  full_name: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  order_items: OrderItem[] | null;
};

type Phase = "checking" | "paid" | "pending" | "delayed" | "login" | "invalid";

const MAX_ATTEMPTS = 6;
const WAIT_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();

  const [phase, setPhase] = useState<Phase>(sessionId ? "checking" : "invalid");
  const [order, setOrder] = useState<PaidOrder | null>(null);
  const [email, setEmail] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !sessionId) return;
    started.current = true;

    (async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setPhase("login");
          return;
        }
        setEmail(session.user.email ?? "");

        try {
          const res = await fetch(
            `/api/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          const data = await res.json().catch(() => ({}));

          if (data.status === "paid" && data.order) {
            setOrder(data.order as PaidOrder);
            setPhase("paid");
            clearCart(); // solo se vacía cuando el pago YA está verificado
            return;
          }
          if (data.status === "invalid" || data.status === "unauthorized") {
            setPhase(data.status === "unauthorized" ? "login" : "invalid");
            return;
          }
          if (data.status === "unpaid") setPhase("pending");
        } catch {
          /* red caída: se reintenta */
        }

        if (attempt < MAX_ATTEMPTS - 1) await sleep(WAIT_MS);
      }
      setPhase((p) => (p === "pending" ? "pending" : "delayed"));
    })();
  }, [sessionId, clearCart]);

  const ref = sessionId ? sessionId.slice(-10) : "";

  /* ---------- Verificando ---------- */
  if (phase === "checking") {
    return (
      <div className="card p-10 sm:p-14 text-center max-w-xl mx-auto space-y-5" role="status">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-soft grid place-items-center">
          <div className="w-7 h-7 rounded-full border-4 border-brand-strong border-t-transparent animate-spin" />
        </div>
        <h1 className="text-2xl font-bold">Confirmando tu pago…</h1>
        <p className="text-sm text-muted">
          Un momento, estamos registrando tu pedido. No cierres esta página.
        </p>
      </div>
    );
  }

  /* ---------- Estados que no son éxito ---------- */
  if (phase !== "paid" || !order) {
    const key = (phase === "paid" ? "delayed" : phase) as
      | "login"
      | "invalid"
      | "pending"
      | "delayed";
    const info = {
      login: {
        icon: <ShieldAlert size={30} className="text-brand-strong" />,
        title: "Inicia sesión para ver tu pedido",
        text: "Para mostrarte los datos de tu compra necesitamos que entres a tu cuenta.",
      },
      invalid: {
        icon: <HelpCircle size={30} className="text-brand-strong" />,
        title: "No pudimos verificar este enlace",
        text: "Si acabas de pagar, revisa “Mis pedidos”: ahí aparecerá tu compra.",
      },
      pending: {
        icon: <Clock size={30} className="text-brand-strong" />,
        title: "Tu pago aún se está confirmando",
        text: "Tu banco todavía no confirma el cobro. Si se aprueba, verás tu pedido en “Mis pedidos” y te llegará un correo. No necesitas pagar de nuevo.",
      },
      delayed: {
        icon: <Clock size={30} className="text-brand-strong" />,
        title: "Recibimos tu pago, pero tu pedido tarda en registrarse",
        text: "No pagues otra vez. Revisa “Mis pedidos” en unos minutos; si no aparece, escríbenos por WhatsApp con tu código de referencia y lo resolvemos de inmediato.",
      },
    }[key];

    return (
      <div className="card p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-brand-soft grid place-items-center">
          {info.icon}
        </div>
        <h1 className="text-2xl font-bold">{info.title}</h1>
        <p className="text-sm text-neutral-600 leading-relaxed">{info.text}</p>

        {(phase === "delayed" || phase === "pending") && ref && (
          <p className="text-xs text-muted">
            Código de referencia:{" "}
            <span className="font-mono font-semibold text-ink select-all">{ref}</span>
          </p>
        )}

        <div className="space-y-3 pt-1">
          {phase === "login" ? (
            <Link
              href={`/login?next=${encodeURIComponent(
                `/checkout/success?session_id=${sessionId ?? ""}`
              )}`}
              className="btn-primary w-full"
            >
              Iniciar sesión
            </Link>
          ) : (
            <Link href="/cuenta/pedidos" className="btn-primary w-full">
              Ver mis pedidos
            </Link>
          )}
          {(phase === "delayed" || phase === "pending") && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline w-full"
            >
              <MessageCircle size={18} /> Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Pago confirmado ---------- */
  const pickup = order.shipping_type === "pickup";
  const shippingLabel =
    SHIPPING_OPTIONS[order.shipping_type as ShippingType]?.label ?? "Envío";
  const shortId = order.id.slice(0, 8);
  const items = order.order_items ?? [];
  const productsTotal = items.reduce((a, i) => a + i.price * i.quantity, 0);
  const discount =
    Math.round((productsTotal + Number(order.shipping_cost ?? 0) - Number(order.total)) * 100) / 100;

  const steps = pickup
    ? ["Preparamos tu pedido", "Te avisamos cuando esté listo", "Lo recoges en la tienda"]
    : ["Preparamos tu pedido", "Te avisamos cuando salga", "Lo recibes en tu domicilio"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="card p-8 sm:p-10 text-center space-y-4">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mx-auto w-20 h-20 rounded-full bg-brand grid place-items-center"
        >
          <Check size={40} strokeWidth={3} className="text-ink" aria-hidden="true" />
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-extrabold">¡Pago confirmado!</h1>
        <p className="text-neutral-600">
          Gracias por tu compra{order.full_name ? `, ${order.full_name.split(" ")[0]}` : ""}.
        </p>
        <p className="inline-block bg-brand-soft rounded-full px-4 py-1.5 text-sm font-semibold">
          Pedido #{shortId}
        </p>
        {email && (
          <p className="text-sm text-muted">
            Te enviamos la confirmación a <strong className="text-ink">{email}</strong>
          </p>
        )}
      </div>

      {/* Resumen */}
      <section className="card p-5 sm:p-7 space-y-4" aria-labelledby="resumen">
        <h2 id="resumen" className="text-lg font-bold">
          Resumen de tu pedido
        </h2>
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <li key={i} className="py-3 flex justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{it.product_name || "Producto"}</span>
                {it.variant_name && <span className="text-muted"> · {it.variant_name}</span>}
                <span className="text-muted"> × {it.quantity}</span>
              </span>
              <span className="font-semibold shrink-0">{money(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 text-sm border-t border-line pt-4">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Productos</dt>
            <dd className="font-medium">{money(productsTotal)}</dd>
          </div>
          {discount >= 0.01 && (
            <div className="flex justify-between text-ok">
              <dt>Descuento (cupón)</dt>
              <dd className="font-medium">−{money(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-neutral-600">{shippingLabel}</dt>
            <dd className="font-medium">
              {Number(order.shipping_cost ?? 0) > 0 ? money(order.shipping_cost) : "Gratis"}
            </dd>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <dt className="font-semibold">Total pagado</dt>
            <dd className="text-2xl font-extrabold">{money(order.total)}</dd>
          </div>
        </dl>
      </section>

      {/* Entrega */}
      <section className="card p-5 sm:p-7 space-y-3" aria-labelledby="entrega">
        <h2 id="entrega" className="text-lg font-bold flex items-center gap-2">
          <MapPin size={18} className="text-brand-strong" aria-hidden="true" />
          {pickup ? "Recoges en tienda" : "Entrega a domicilio"}
        </h2>
        {pickup ? (
          <>
            <p className="text-sm text-neutral-700">{STORE_ADDRESS_FULL}</p>
            <a
              href={STORE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-brand-strong hover:underline"
            >
              Ver en Google Maps
            </a>
          </>
        ) : (
          <p className="text-sm text-neutral-700 leading-relaxed">
            {order.full_name}
            <br />
            {order.address}
            <br />
            {[order.city, order.postal_code && `C.P. ${order.postal_code}`]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </section>

      {/* Qué sigue */}
      <section className="card p-5 sm:p-7" aria-labelledby="sigue">
        <h2 id="sigue" className="text-lg font-bold mb-4 flex items-center gap-2">
          <PackageCheck size={18} className="text-brand-strong" aria-hidden="true" />
          ¿Qué sigue?
        </h2>
        <ol className="space-y-3">
          {steps.map((text, i) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span
                className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-brand text-ink" : "bg-brand-soft text-neutral-600"
                }`}
              >
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </section>

      {/* Acciones */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href={`/pedido/${order.id}`} className="btn-primary">
          Ver detalle del pedido
        </Link>
        <Link href="/" className="btn-outline">
          Seguir comprando
        </Link>
      </div>

      <p className="text-center text-sm text-muted">
        ¿Dudas con tu pedido?{" "}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-strong hover:underline"
        >
          Escríbenos por WhatsApp
        </a>
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={<div className="card p-10 max-w-xl mx-auto skeleton h-56" aria-hidden="true" />}
    >
      <SuccessContent />
    </Suspense>
  );
}
