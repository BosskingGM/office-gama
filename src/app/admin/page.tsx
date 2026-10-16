"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";
import InventoryReport from "@/components/InventoryReport";

/* =========================
   TIPOS Y AYUDAS
========================= */

type OrderRow = {
  id: string;
  total: number | string | null;
  status: string | null;
  created_at: string;
  full_name: string | null;
  order_items: { quantity: number | null; product_name: string | null }[] | null;
};

type LowRow = {
  id: string;
  model_name: string | null;
  stock: number | null;
  products: { name: string | null } | { name: string | null }[] | null;
};

const TZ = "America/Mexico_City";
const LOW_STOCK = 5;
// Pedidos que cuentan como venta: no se incluyen cancelados ni pendientes.
const SALE_STATUSES = ["pagado", "enviado", "entregado"];

const money = (n: number) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

// "2026-10-15" en hora de México, sin importar la zona del navegador.
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const monthKey = (d: Date) => dayKey(d).slice(0, 7);

const prevMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, "0")}`;
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  });

const productName = (row: LowRow) => {
  const p = Array.isArray(row.products) ? row.products[0] : row.products;
  return p?.name || "Producto";
};

/* =========================
   PÁGINA
========================= */

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [low, setLow] = useState<LowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [ordersRes, lowRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, total, status, created_at, full_name, order_items ( quantity, product_name )"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("product_variants")
        .select("id, model_name, stock, products ( name )")
        .lte("stock", LOW_STOCK)
        .order("stock", { ascending: true })
        .limit(50),
    ]);

    if (ordersRes.error) {
      setError(`No se pudieron cargar los pedidos: ${ordersRes.error.message}`);
    } else {
      setOrders((ordersRes.data ?? []) as unknown as OrderRow[]);
    }
    if (lowRes.error) {
      setError((prev) =>
        prev
          ? prev
          : `No se pudo cargar el stock: ${lowRes.error?.message ?? ""}`
      );
    } else {
      setLow((lowRes.data ?? []) as unknown as LowRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(() => {
    const sales = orders.filter((o) =>
      SALE_STATUSES.includes((o.status ?? "").toLowerCase())
    );
    const amount = (o: OrderRow) => Number(o.total ?? 0);

    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = prevMonthKey(thisMonth);

    const monthSales = sales
      .filter((o) => monthKey(new Date(o.created_at)) === thisMonth)
      .reduce((acc, o) => acc + amount(o), 0);
    const prevMonthSales = sales
      .filter((o) => monthKey(new Date(o.created_at)) === lastMonth)
      .reduce((acc, o) => acc + amount(o), 0);

    const totalSales = sales.reduce((acc, o) => acc + amount(o), 0);
    const toShip = orders.filter(
      (o) => (o.status ?? "").toLowerCase() === "pagado"
    ).length;

    // Ventas de los últimos 14 días
    const perDay = new Map<string, number>();
    for (const o of sales) {
      const k = dayKey(new Date(o.created_at));
      perDay.set(k, (perDay.get(k) ?? 0) + amount(o));
    }
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000);
      const key = dayKey(d);
      return {
        key,
        label: d.toLocaleDateString("es-MX", { timeZone: TZ, day: "numeric" }),
        full: d.toLocaleDateString("es-MX", {
          timeZone: TZ,
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        total: perDay.get(key) ?? 0,
      };
    });
    const maxDay = Math.max(...days.map((d) => d.total), 1);
    const last14 = days.reduce((acc, d) => acc + d.total, 0);

    // Más vendidos (solo pedidos que cuentan como venta)
    const qtyByName = new Map<string, number>();
    for (const o of sales) {
      for (const it of o.order_items ?? []) {
        const name = it.product_name || "Producto";
        qtyByName.set(name, (qtyByName.get(name) ?? 0) + (it.quantity ?? 0));
      }
    }
    const top = [...qtyByName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      monthSales,
      prevMonthSales,
      totalSales,
      toShip,
      avgTicket: sales.length ? totalSales / sales.length : 0,
      salesCount: sales.length,
      days,
      maxDay,
      last14,
      top,
      recent: orders.slice(0, 5),
    };
  }, [orders]);

  const delta =
    data.prevMonthSales > 0
      ? Math.round(
          ((data.monthSales - data.prevMonthSales) / data.prevMonthSales) * 100
        )
      : null;

  /* ---------- Carga y error ---------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
        <div className="skeleton h-56" />
      </div>
    );
  }

  if (error && orders.length === 0 && low.length === 0) {
    return (
      <div className="card p-6 text-sm text-danger flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <span>{error}</span>
        <button type="button" onClick={load} className="btn-outline">
          Reintentar
        </button>
      </div>
    );
  }

  /* ---------- Vista ---------- */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Las ventas cuentan pedidos pagados, enviados y entregados. Los
          cancelados no suman.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
        >
          {error}
        </p>
      )}

      {/* Pedidos por enviar: lo más urgente */}
      {data.toShip > 0 && (
        <Link
          href="/admin/pedidos?estado=pagado"
          className="flex items-center justify-between gap-4 rounded-2xl bg-peach-soft border border-peach px-5 py-4 hover:shadow-md transition"
        >
          <span className="font-semibold">
            {data.toShip === 1
              ? "Tienes 1 pedido pagado por atender"
              : `Tienes ${data.toShip} pedidos pagados por atender`}
          </span>
          <span className="text-sm font-semibold text-brand-strong shrink-0">
            Ver pedidos
          </span>
        </Link>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Ventas del mes"
          value={money(data.monthSales)}
          note={
            delta === null
              ? "Sin datos del mes anterior"
              : delta >= 0
              ? `${delta}% más que el mes pasado`
              : `${Math.abs(delta)}% menos que el mes pasado`
          }
          highlight
        />
        <Metric
          label="Por enviar"
          value={String(data.toShip)}
          note="Pedidos pagados"
        />
        <Metric
          label="Ventas totales"
          value={money(data.totalSales)}
          note={`${data.salesCount} ${
            data.salesCount === 1 ? "pedido" : "pedidos"
          }`}
        />
        <Metric
          label="Ticket promedio"
          value={money(data.avgTicket)}
          note="Por pedido"
        />
      </div>

      {/* Ventas por día */}
      <section className="card p-5 sm:p-6" aria-labelledby="ventas-14">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 id="ventas-14" className="text-lg font-bold">
            Ventas de los últimos 14 días
          </h2>
          <p className="text-sm text-muted">{money(data.last14)}</p>
        </div>

        <div
          className="mt-5 flex items-end gap-1.5 sm:gap-2 h-40"
          role="img"
          aria-label={`Ventas por día, últimos 14 días. Total ${money(
            data.last14
          )}.`}
        >
          {data.days.map((d) => {
            const h = d.total > 0 ? Math.max(6, (d.total / data.maxDay) * 100) : 2;
            return (
              <div
                key={d.key}
                className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 min-w-0"
                title={`${d.full}: ${money(d.total)}`}
              >
                <div
                  className={`w-full rounded-t-md ${
                    d.total > 0 ? "bg-brand" : "bg-line"
                  }`}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 sm:gap-2" aria-hidden="true">
          {data.days.map((d) => (
            <span
              key={d.key}
              className="flex-1 text-center text-[11px] text-muted min-w-0"
            >
              {d.label}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos recientes */}
        <section className="card p-5 sm:p-6" aria-labelledby="recientes">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recientes" className="text-lg font-bold">
              Pedidos recientes
            </h2>
            <Link
              href="/admin/pedidos?estado=todos"
              className="text-sm font-semibold text-brand-strong hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {data.recent.length === 0 ? (
            <p className="text-sm text-muted mt-4">Aún no hay pedidos.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {data.recent.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/pedidos?estado=todos&q=${o.id.slice(0, 8)}`}
                    className="flex items-center gap-3 py-3 hover:bg-soft -mx-2 px-2 rounded-xl transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {o.full_name || "Cliente"}
                      </p>
                      <p className="text-sm text-muted">
                        #{o.id.slice(0, 8)} · {shortDate(o.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-semibold">
                        {money(Number(o.total ?? 0))}
                      </p>
                      <StatusBadge status={o.status ?? ""} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Más vendidos */}
        <section className="card p-5 sm:p-6" aria-labelledby="top">
          <h2 id="top" className="text-lg font-bold">
            Más vendidos
          </h2>
          {data.top.length === 0 ? (
            <p className="text-sm text-muted mt-4">
              Cuando haya ventas aparecerán aquí.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-line">
              {data.top.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="text-sm text-secondary shrink-0">
                    {p.qty} {p.qty === 1 ? "pieza" : "piezas"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Stock bajo */}
      <section className="card p-5 sm:p-6" aria-labelledby="stock">
        <div className="flex items-center justify-between gap-4">
          <h2 id="stock" className="text-lg font-bold">
            Stock bajo
          </h2>
          <Link
            href="/admin/inventario"
            className="text-sm font-semibold text-brand-strong hover:underline"
          >
            Ir al inventario
          </Link>
        </div>

        {low.length === 0 ? (
          <p className="text-sm text-muted mt-4">
            Ningún modelo tiene {LOW_STOCK} piezas o menos.
          </p>
        ) : (
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-line">
            {low.map((v) => {
              const out = (v.stock ?? 0) <= 0;
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-4 py-3 sm:border-b sm:border-line"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{productName(v)}</p>
                    {v.model_name && v.model_name !== "Único" && (
                      <p className="text-sm text-muted truncate">
                        {v.model_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      out
                        ? "bg-red-100 text-red-700"
                        : "bg-peach-soft text-neutral-800"
                    }`}
                  >
                    {out ? "Agotado" : `${v.stock} pzs`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Reporte de inventario y ventas */}
      <InventoryReport />
    </div>
  );
}

/* =========================
   TARJETA DE MÉTRICA
========================= */

function Metric({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        highlight ? "bg-brand border-brand text-ink" : "card"
      }`}
    >
      <p className={`text-sm ${highlight ? "text-ink/70" : "text-muted"}`}>
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-extrabold mt-1.5 break-words">
        {value}
      </p>
      {note && (
        <p className={`text-xs mt-1.5 ${highlight ? "text-ink/70" : "text-muted"}`}>
          {note}
        </p>
      )}
    </div>
  );
}
