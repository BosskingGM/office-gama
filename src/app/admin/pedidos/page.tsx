"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageOff, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SHIPPING_OPTIONS, mapsLink } from "@/lib/shipping";
import StatusBadge from "@/components/StatusBadge";
import { revalidateStore } from "@/lib/revalidate-client";

/* =========================
   TIPOS Y AYUDAS
========================= */

type Item = {
  id: string;
  quantity: number | null;
  price: number | string | null;
  product_name: string | null;
  variant_name: string | null;
  product_variants: {
    image_url: string | null;
    model_name: string | null;
    products: { name: string | null } | { name: string | null }[] | null;
  } | null;
};

type Order = {
  id: string;
  created_at: string;
  status: string | null;
  total: number | string | null;
  notes: string | null;
  full_name: string | null;
  user_email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  shipping_type: string | null;
  shipping_cost: number | string | null;
  order_items: Item[] | null;
};

type Filter = "pagado" | "enviado" | "entregado" | "cancelado" | "todos";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pagado", label: "Por enviar" },
  { id: "enviado", label: "Enviados" },
  { id: "entregado", label: "Entregados" },
  { id: "cancelado", label: "Cancelados" },
  { id: "todos", label: "Todos" },
];

const TZ = "America/Mexico_City";

const money = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const statusOf = (o: Order) => (o.status ?? "").toLowerCase();

const itemName = (it: Item) => {
  const p = it.product_variants?.products;
  const fromJoin = Array.isArray(p) ? p[0]?.name : p?.name;
  return it.product_name || fromJoin || "Producto";
};

const itemModel = (it: Item) => {
  const m = it.variant_name || it.product_variants?.model_name || "";
  return m && m !== "Único" ? m : "";
};

const isPickup = (o: Order) => o.shipping_type === "pickup";

const shippingLabel = (o: Order) => {
  const key = o.shipping_type as keyof typeof SHIPPING_OPTIONS | null;
  return (key && SHIPPING_OPTIONS[key]?.label) || o.shipping_type || "—";
};

const summary = (o: Order) => {
  const items = o.order_items ?? [];
  if (items.length === 0) return "Sin artículos";
  const first = itemName(items[0]);
  return items.length > 1 ? `${first} y ${items.length - 1} más` : first;
};

const pieces = (o: Order) =>
  (o.order_items ?? []).reduce((acc, it) => acc + (it.quantity ?? 0), 0);

type Msg = { kind: "ok" | "warn" | "error"; text: string };

/* =========================
   PÁGINA
========================= */

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filter, setFilter] = useState<Filter>("pagado");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, created_at, status, total, notes, full_name, user_email, phone,
        address, city, postal_code, latitude, longitude, shipping_type, shipping_cost,
        order_items (
          id, quantity, price, product_name, variant_name,
          product_variants ( image_url, model_name, products ( name ) )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(`No se pudieron cargar los pedidos: ${error.message}`);
      return;
    }
    setLoadError("");
    setOrders((data ?? []) as unknown as Order[]);
  }, []);

  useEffect(() => {
    // Los enlaces del dashboard traen ?estado=... y ?q=...
    const params = new URLSearchParams(window.location.search);
    const estado = params.get("estado");
    if (FILTERS.some((f) => f.id === estado)) setFilter(estado as Filter);
    const q = params.get("q");
    if (q) setSearch(q);

    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const closePanel = useCallback(() => {
    setSelectedId(null);
    setMsg(null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) closePanel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selected, busy, closePanel]);

  /* ---------- Acciones ---------- */

  const sendShippedEmail = async (orderId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/send-shipped-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ orderId }),
    });
    return res.ok;
  };

  const changeStatus = async (
    order: Order,
    newStatus: string,
    withEmail = false
  ) => {
    setBusy(true);
    setMsg(null);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    if (error) {
      setMsg({
        kind: "error",
        text: `No se pudo cambiar el estado: ${error.message}`,
      });
      setBusy(false);
      return;
    }

    let result: Msg = {
      kind: "ok",
      text: `Pedido marcado como ${newStatus}.`,
    };

    // Cancelar (o reactivar un cancelado) mueve el inventario en la base de
    // datos (supabase/cancel-restock.sql): se refresca la tienda al instante.
    const wasCancelled = statusOf(order) === "cancelado";
    if (newStatus === "cancelado" || wasCancelled) {
      await revalidateStore();
      result = {
        kind: "ok",
        text:
          newStatus === "cancelado"
            ? "Pedido cancelado. Las piezas regresaron al inventario."
            : `Pedido marcado como ${newStatus}. Las piezas se descontaron de nuevo del inventario.`,
      };
    }

    if (withEmail) {
      const sent = await sendShippedEmail(order.id).catch(() => false);
      result = sent
        ? {
            kind: "ok",
            text: "Pedido marcado como enviado y se avisó al cliente por correo.",
          }
        : {
            kind: "warn",
            text: "El pedido quedó como enviado, pero el correo al cliente no se pudo enviar. Usa “Reenviar correo” para intentarlo de nuevo.",
          };
    }

    await fetchOrders();
    setMsg(result);
    setBusy(false);
  };

  const resendEmail = async (order: Order) => {
    setBusy(true);
    setMsg(null);
    const sent = await sendShippedEmail(order.id).catch(() => false);
    setMsg(
      sent
        ? { kind: "ok", text: "Correo reenviado al cliente." }
        : { kind: "error", text: "No se pudo enviar el correo. Intenta más tarde." }
    );
    setBusy(false);
  };

  const cancelOrder = (order: Order) => {
    const ok = confirm(
      "¿Cancelar este pedido?\n\nLas piezas regresarán automáticamente al inventario."
    );
    if (ok) changeStatus(order, "cancelado");
  };

  /* ---------- Lista filtrada ---------- */

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      pagado: 0,
      enviado: 0,
      entregado: 0,
      cancelado: 0,
      todos: orders.length,
    };
    for (const o of orders) {
      const s = statusOf(o);
      if (s === "pagado" || s === "enviado" || s === "entregado" || s === "cancelado") {
        c[s]++;
      }
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = norm(search.trim().replace(/^#/, ""));
    return orders.filter((o) => {
      if (filter !== "todos" && statusOf(o) !== filter) return false;
      if (!q) return true;
      const hay = norm(
        [
          o.id,
          o.full_name,
          o.user_email,
          o.phone,
          ...(o.order_items ?? []).map(itemName),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return hay.includes(q);
    });
  }, [orders, filter, search]);

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Pedidos</h1>
        <p className="text-sm text-muted mt-1">
          {loading
            ? "Cargando…"
            : `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} en total`}
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, correo, teléfono, producto o número"
            aria-label="Buscar pedidos"
            className="field !pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.id
                  ? "bg-brand border-brand text-ink"
                  : "bg-white border-line hover:border-brand"
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-muted">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="card p-6 text-sm text-danger flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchOrders().finally(() => setLoading(false));
            }}
            className="btn-outline"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="font-semibold">
            {search
              ? "Ningún pedido coincide con la búsqueda"
              : filter === "pagado"
              ? "No hay pedidos por enviar"
              : "No hay pedidos en esta vista"}
          </p>
          {filter !== "todos" && (
            <button
              type="button"
              onClick={() => setFilter("todos")}
              className="btn-outline"
            >
              Ver todos los pedidos
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  setMsg(null);
                  setSelectedId(o.id);
                }}
                className="card card-hover w-full text-left p-4 sm:p-5 flex items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {o.full_name || "Cliente sin nombre"}
                  </p>
                  <p className="text-sm text-secondary truncate">
                    {summary(o)}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    #{o.id.slice(0, 8)} · {formatDate(o.created_at)} ·{" "}
                    {isPickup(o) ? "Recoger en tienda" : shippingLabel(o)}
                    {o.notes ? " · Con aviso" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1.5">
                  <p className="font-bold">{money(o.total)}</p>
                  <StatusBadge status={o.status ?? ""} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* =========================
          DETALLE DEL PEDIDO
      ========================= */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => !busy && closePanel()}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pedido-title"
            className="absolute right-0 top-0 h-full w-full sm:max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right"
          >
            <header className="flex items-start justify-between gap-3 px-5 sm:px-7 py-4 border-b border-line">
              <div className="min-w-0">
                <h2 id="pedido-title" className="text-xl font-extrabold">
                  Pedido #{selected.id.slice(0, 8)}
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  {formatDate(selected.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={selected.status ?? ""} />
                <button
                  type="button"
                  onClick={closePanel}
                  disabled={busy}
                  aria-label="Cerrar"
                  className="p-2 rounded-full hover:bg-neutral-100 disabled:opacity-40"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-6">
              {msg && (
                <p
                  role="status"
                  className={`text-sm rounded-xl border px-4 py-3 ${
                    msg.kind === "ok"
                      ? "bg-green-50 border-green-200 text-green-900"
                      : msg.kind === "warn"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  {msg.text}
                </p>
              )}

              {selected.notes && (
                <div className="rounded-xl border border-peach bg-peach-soft px-4 py-3 text-sm">
                  <strong>Atención:</strong> {selected.notes}
                </div>
              )}

              <Block title="Cliente">
                <p className="font-medium">{selected.full_name || "—"}</p>
                {selected.user_email && (
                  <p>
                    <a
                      href={`mailto:${selected.user_email}`}
                      className="text-brand-strong hover:underline break-all"
                    >
                      {selected.user_email}
                    </a>
                  </p>
                )}
                {selected.phone && (
                  <p>
                    <a
                      href={`tel:${selected.phone}`}
                      className="text-brand-strong hover:underline"
                    >
                      {selected.phone}
                    </a>
                  </p>
                )}
              </Block>

              <Block title="Entrega">
                <p className="font-medium">{shippingLabel(selected)}</p>
                {isPickup(selected) ? (
                  <p className="text-muted">
                    El cliente recoge en la tienda; no hay dirección de envío.
                  </p>
                ) : (
                  <>
                    <p>{selected.address || "—"}</p>
                    <p>
                      {[selected.city, selected.postal_code && `CP ${selected.postal_code}`]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    {selected.latitude != null && selected.longitude != null ? (
                      <a
                        href={mapsLink({ lat: selected.latitude, lng: selected.longitude })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-brand-strong font-semibold hover:underline"
                      >
                        📍 Ver punto exacto en el mapa
                      </a>
                    ) : (
                      <p className="text-muted text-xs mt-1">
                        El cliente no marcó un punto en el mapa.
                      </p>
                    )}
                  </>
                )}
              </Block>

              <Block title="Productos">
                <ul className="space-y-3">
                  {(selected.order_items ?? []).map((it) => {
                    const img = it.product_variants?.image_url;
                    const model = itemModel(it);
                    const qty = it.quantity ?? 0;
                    return (
                      <li key={it.id} className="flex gap-3 items-center">
                        <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-brand-soft grid place-items-center text-neutral-400">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageOff size={18} aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {itemName(it)}
                            {model && (
                              <span className="font-normal text-muted">
                                {" "}
                                · {model}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted">
                            {qty} × {money(it.price)}
                          </p>
                        </div>
                        <p className="font-semibold shrink-0">
                          {money(Number(it.price ?? 0) * qty)}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <dl className="mt-4 pt-4 border-t border-line space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      Productos ({pieces(selected)}{" "}
                      {pieces(selected) === 1 ? "pieza" : "piezas"})
                    </dt>
                    <dd>
                      {money(
                        (selected.order_items ?? []).reduce(
                          (acc, it) =>
                            acc + Number(it.price ?? 0) * (it.quantity ?? 0),
                          0
                        )
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Envío</dt>
                    <dd>
                      {Number(selected.shipping_cost ?? 0) > 0
                        ? money(selected.shipping_cost)
                        : "Gratis"}
                    </dd>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-1">
                    <dt>Total pagado</dt>
                    <dd>{money(selected.total)}</dd>
                  </div>
                </dl>
              </Block>
            </div>

            {/* Acciones */}
            <footer className="border-t border-line px-5 sm:px-7 py-4 space-y-3 bg-white">
              <Actions
                order={selected}
                busy={busy}
                onStatus={changeStatus}
                onResend={resendEmail}
                onCancel={cancelOrder}
              />
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   ACCIONES SEGÚN EL ESTADO
========================= */

function Actions({
  order,
  busy,
  onStatus,
  onResend,
  onCancel,
}: {
  order: Order;
  busy: boolean;
  onStatus: (o: Order, status: string, withEmail?: boolean) => void;
  onResend: (o: Order) => void;
  onCancel: (o: Order) => void;
}) {
  const s = statusOf(order);
  const pickup = isPickup(order);
  const canCancel = s === "pagado" || s === "pendiente" || s === "enviado";

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        {s === "pagado" && !pickup && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(order, "enviado", true)}
            className="btn-primary flex-1"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            Marcar como enviado y avisar
          </button>
        )}

        {s === "pagado" && pickup && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(order, "entregado")}
            className="btn-primary flex-1"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            Ya lo recogió (entregado)
          </button>
        )}

        {s === "enviado" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus(order, "entregado")}
              className="btn-primary flex-1"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              Marcar como entregado
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResend(order)}
              className="btn-outline"
            >
              Reenviar correo
            </button>
          </>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(order)}
            className="btn-outline text-danger"
          >
            Cancelar pedido
          </button>
        )}
      </div>

      {(s === "entregado" || s === "cancelado") && (
        <p className="text-sm text-muted">
          Este pedido ya está {s === "entregado" ? "entregado" : "cancelado"}.
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-ink select-none">
          Corregir estado manualmente
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {["pagado", "enviado", "entregado", "cancelado"]
            .filter((st) => st !== s)
            .map((st) => (
              <button
                key={st}
                type="button"
                disabled={busy}
                onClick={() => onStatus(order, st)}
                className="rounded-full border border-line px-3.5 py-1.5 hover:border-brand hover:bg-brand-soft transition disabled:opacity-50"
              >
                Poner “{st}”
              </button>
            ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          No envía correo. Poner o quitar “cancelado” sí regresa o descuenta las piezas del inventario.
        </p>
      </details>
    </>
  );
}

/* =========================
   BLOQUE DE INFORMACIÓN
========================= */

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      <div className="rounded-2xl border border-line bg-soft p-4 text-sm space-y-1">
        {children}
      </div>
    </section>
  );
}
