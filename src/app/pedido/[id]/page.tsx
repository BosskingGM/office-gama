"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SHIPPING_OPTIONS, type ShippingType } from "@/lib/shipping";
import {
  BANK_TRANSFER,
  STORE_ADDRESS_FULL,
  STORE_MAPS_URL,
  STORE_WHATSAPP_URL,
} from "@/lib/store";
import StatusBadge, { statusInfo } from "@/components/StatusBadge";

const money = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function PedidoPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    setJustCreated(new URLSearchParams(window.location.search).get("nuevo") === "1");
  }, []);

  useEffect(() => {
    const load = async () => {
      // Las políticas de la base de datos solo dejan ver los pedidos propios
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id, created_at, status, total, shipping_type, shipping_cost,
          full_name, phone, address, city, postal_code,
          order_items (
            id, quantity, price, product_name, variant_name,
            product_variants ( image_url, model_name, products ( name ) )
          )
        `
        )
        .eq("id", id)
        .maybeSingle();

      if (!error) setOrder(data);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card p-10 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold">No encontramos este pedido</h1>
        <p className="text-sm text-muted">
          Revisa el enlace o entra a tu cuenta para ver tus pedidos.
        </p>
        <Link href="/cuenta/pedidos" className="btn-primary">
          Ver mis pedidos
        </Link>
      </div>
    );
  }

  const pickup = order.shipping_type === "pickup";
  const shippingLabel =
    SHIPPING_OPTIONS[order.shipping_type as ShippingType]?.label ?? "Envío";
  const shippingCost = Number(order.shipping_cost ?? 0);
  const productsTotal = Number(order.total) - shippingCost;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/cuenta/pedidos" className="text-sm text-muted hover:text-brand-strong transition">
        ← Mis pedidos
      </Link>

      <div className="card p-6 sm:p-8 space-y-8">
        {/* Encabezado */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted">
            {new Date(order.created_at).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {justCreated && (
            <p role="status" className="text-sm bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3">
              ¡Pedido registrado! También te enviamos estas instrucciones por correo.
            </p>
          )}
          {statusInfo(order.status).help && (
            <p className="text-sm bg-brand-soft rounded-xl px-4 py-3">
              {statusInfo(order.status).help}
            </p>
          )}
        </header>

        {/* Cómo pagar */}
        {order.status === "revision" && (
          <section className="space-y-3 rounded-2xl border-2 border-brand-strong bg-brand-soft p-5">
            <h2 className="font-bold text-lg">Datos para tu transferencia</h2>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Banco</dt><dd className="font-semibold text-right">{BANK_TRANSFER.bank}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Titular</dt><dd className="font-semibold text-right">{BANK_TRANSFER.holder}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">CLABE</dt><dd className="font-semibold text-right break-all">{BANK_TRANSFER.clabe}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Concepto</dt><dd className="font-semibold text-right">Pedido #{order.id.slice(0, 8).toUpperCase()}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Monto exacto</dt><dd className="font-extrabold text-right">{money(order.total)}</dd></div>
            </dl>
            <a
              href={STORE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full"
            >
              Enviar comprobante por WhatsApp
            </a>
          </section>
        )}

        {order.status === "contra_entrega" && (
          <section className="rounded-2xl border-2 border-brand-strong bg-brand-soft p-5 text-sm space-y-1">
            <h2 className="font-bold text-lg">Pagas al recoger</h2>
            <p>
              Lleva <strong>{money(order.total)}</strong> y recoge tu pedido en la tienda.
            </p>
          </section>
        )}

        {/* Productos */}
        <section className="space-y-4">
          <h2 className="font-bold text-lg">Productos</h2>
          <ul className="space-y-4">
            {(order.order_items ?? []).map((item: any) => {
              const v = item.product_variants;
              const name = item.product_name || v?.products?.name || "Producto";
              const model = item.variant_name || v?.model_name;
              return (
                <li key={item.id} className="flex items-center gap-4">
                  {v?.image_url ? (
                    <img
                      src={v.image_url}
                      alt=""
                      loading="lazy"
                      className="w-16 h-16 object-cover rounded-xl border border-line shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-brand-soft shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm line-clamp-2">{name}</p>
                    <p className="text-xs text-muted">
                      {model ? `${model} · ` : ""}
                      {item.quantity} {item.quantity === 1 ? "pieza" : "piezas"} ×{" "}
                      {money(item.price)}
                    </p>
                  </div>
                  <p className="font-semibold text-sm">
                    {money(item.price * item.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Entrega */}
        <section className="space-y-2">
          <h2 className="font-bold text-lg">{pickup ? "Recolección" : "Entrega"}</h2>
          <div className="border border-line rounded-2xl p-4 text-sm space-y-1">
            <p className="font-semibold">{shippingLabel}</p>
            {order.full_name && <p>{order.full_name}</p>}
            {order.phone && <p className="text-muted">{order.phone}</p>}
            {!pickup && order.address && (
              <p className="text-muted">
                {order.address}, {order.city}, C.P. {order.postal_code}
              </p>
            )}
            {pickup && (
              <p>
                <a
                  href={STORE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-strong hover:underline"
                >
                  {STORE_ADDRESS_FULL}
                </a>
              </p>
            )}
          </div>
        </section>

        {/* Totales */}
        <section className="border-t border-line pt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">Productos</span>
            <span>{money(productsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Envío</span>
            <span>{shippingCost === 0 ? "Gratis" : money(shippingCost)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <span className="font-semibold text-base">Total</span>
            <span className="text-2xl font-extrabold">{money(order.total)}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
