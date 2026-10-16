"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* =========================================================
   Reportes de inventario y ventas para el dashboard.
   - Valor del inventario (a precio de venta)
   - Dónde hay menos / más stock
   - Qué se vende más, menos o nada
========================================================= */

type Variant = { id: string; model_name: string | null; stock: number | null };
type Product = {
  id: string;
  name: string;
  price: number | string;
  category: string | null;
  product_variants: Variant[] | null;
};
type Item = {
  variant_id: string | null;
  quantity: number | null;
  price: number | string | null;
  product_name: string | null;
};
type Order = {
  status: string | null;
  created_at: string;
  order_items: Item[] | null;
};

// Pedidos que cuentan como venta (igual que el resto del dashboard)
const SALE_STATUSES = ["pagado", "enviado", "entregado"];

const PERIODS = [
  { key: "30", label: "30 días", days: 30 },
  { key: "90", label: "90 días", days: 90 },
  { key: "365", label: "1 año", days: 365 },
  { key: "all", label: "Todo", days: Infinity },
] as const;

const money = (n: number) =>
  n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
const num = (n: number) => n.toLocaleString("es-MX");

export default function InventoryReport() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("90");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [p, o] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, category, product_variants ( id, model_name, stock )"),
      supabase
        .from("orders")
        .select("status, created_at, order_items ( variant_id, quantity, price, product_name )")
        .in("status", SALE_STATUSES),
    ]);
    if (p.error) setError(`No se pudo cargar el inventario: ${p.error.message}`);
    else setProducts((p.data ?? []) as unknown as Product[]);
    if (o.error) setError((e) => e || `No se pudieron cargar las ventas: ${o.error.message}`);
    else setOrders((o.data ?? []) as unknown as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const r = useMemo(() => {
    // ----- Inventario actual -----
    const rows = products.map((p) => {
      const vs = p.product_variants ?? [];
      const stock = vs.reduce((a, v) => a + Math.max(0, v.stock ?? 0), 0);
      const price = Number(p.price) || 0;
      return {
        id: p.id,
        name: p.name,
        category: p.category || "Sin categoría",
        price,
        stock,
        value: stock * price,
        models: vs.length,
        soldOutModels: vs.filter((v) => (v.stock ?? 0) <= 0).length,
      };
    });

    const totalValue = rows.reduce((a, x) => a + x.value, 0);
    const totalPieces = rows.reduce((a, x) => a + x.stock, 0);
    const soldOutProducts = rows.filter((x) => x.stock === 0).length;
    const soldOutModels = rows.reduce((a, x) => a + x.soldOutModels, 0);

    const byCat = new Map<string, { value: number; pieces: number }>();
    for (const x of rows) {
      const c = byCat.get(x.category) ?? { value: 0, pieces: 0 };
      c.value += x.value;
      c.pieces += x.stock;
      byCat.set(x.category, c);
    }
    const cats = [...byCat.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);
    const maxCat = Math.max(...cats.map((c) => c.value), 1);

    // Menos stock (con piezas por reponer; incluye agotados)
    const lowest = [...rows]
      .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"))
      .slice(0, 8);
    // Más stock / dinero parado
    const highest = [...rows].sort((a, b) => b.value - a.value).slice(0, 8);

    // ----- Ventas del periodo -----
    const days = PERIODS.find((x) => x.key === period)!.days;
    const since = days === Infinity ? 0 : Date.now() - days * 86_400_000;

    const variantToProduct = new Map<string, string>();
    for (const p of products)
      for (const v of p.product_variants ?? []) variantToProduct.set(v.id, p.id);

    type Sold = { name: string; qty: number; revenue: number };
    const sold = new Map<string, Sold>(); // por id de producto (o nombre si ya no existe)
    let revenueTotal = 0;
    let piecesTotal = 0;
    for (const o of orders) {
      if (new Date(o.created_at).getTime() < since) continue;
      for (const it of o.order_items ?? []) {
        const qty = it.quantity ?? 0;
        const rev = qty * (Number(it.price) || 0);
        const pid = it.variant_id ? variantToProduct.get(it.variant_id) : undefined;
        const key = pid ?? `n:${it.product_name ?? "Producto"}`;
        const cur = sold.get(key) ?? { name: it.product_name ?? "Producto", qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += rev;
        sold.set(key, cur);
        revenueTotal += rev;
        piecesTotal += qty;
      }
    }
    const soldList = [...sold.values()];
    const best = [...soldList].sort((a, b) => b.qty - a.qty).slice(0, 8);
    const bestMoney = [...soldList].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Los que menos se venden: todo producto del catálogo con existencias,
    // ordenado por piezas vendidas (0 primero) y luego por dinero parado.
    const withSales = rows
      .filter((x) => x.stock > 0)
      .map((x) => ({ ...x, qty: sold.get(x.id)?.qty ?? 0 }));
    const slowest = [...withSales]
      .sort((a, b) => a.qty - b.qty || b.value - a.value)
      .slice(0, 8);
    const noSales = withSales.filter((x) => x.qty === 0);
    const noSalesValue = noSales.reduce((a, x) => a + x.value, 0);

    return {
      totalValue, totalPieces, soldOutProducts, soldOutModels,
      count: rows.length, cats, maxCat, lowest, highest,
      best, bestMoney, slowest, noSales: noSales.length, noSalesValue,
      revenueTotal, piecesTotal,
    };
  }, [products, orders, period]);

  if (loading) {
    return <div className="skeleton h-64" aria-busy="true" />;
  }

  return (
    <section className="space-y-6" aria-labelledby="rep-inv">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 id="rep-inv" className="text-xl sm:text-2xl font-extrabold">
            Reporte de inventario
          </h2>
          <p className="text-sm text-muted mt-1">
            El valor se calcula con el precio de venta (piezas × precio).
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo de ventas">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition ${
                period === p.key
                  ? "bg-brand border-brand text-ink"
                  : "bg-white border-line text-neutral-600 hover:bg-brand-soft"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Valor del inventario" value={money(r.totalValue)} note={`${num(r.totalPieces)} piezas en existencia`} highlight />
        <Kpi label="Productos" value={num(r.count)} note={`${r.soldOutProducts} agotados · ${r.soldOutModels} modelos sin stock`} />
        <Kpi label="Vendido en el periodo" value={money(r.revenueTotal)} note={`${num(r.piecesTotal)} piezas`} />
        <Kpi label="Sin ventas (con stock)" value={num(r.noSales)} note={`${money(r.noSalesValue)} inmovilizado`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Valor por categoría" sub="Dónde está tu dinero en inventario">
          {r.cats.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3">
              {r.cats.slice(0, 10).map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-muted shrink-0">
                      {money(c.value)} · {num(c.pieces)} pzs
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (c.value / r.maxCat) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Más dinero parado en stock" sub="Productos con mayor valor en existencia">
          <List
            rows={r.highest.map((x) => ({
              key: x.id,
              name: x.name,
              left: `${num(x.stock)} pzs × ${money(x.price)}`,
              right: money(x.value),
            }))}
          />
        </Card>

        <Card title="Menos stock" sub="Lo primero que conviene reponer" action={{ href: "/admin/inventario", label: "Ir al inventario" }}>
          <List
            rows={r.lowest.map((x) => ({
              key: x.id,
              name: x.name,
              left: x.models > 1 ? `${x.models} modelos` : "",
              right: x.stock === 0 ? "Agotado" : `${num(x.stock)} pzs`,
              tone: x.stock === 0 ? "bad" : x.stock <= 5 ? "warn" : undefined,
            }))}
          />
        </Card>

        <Card title="Más vendidos" sub="Por piezas, en el periodo elegido">
          {r.best.length === 0 ? (
            <Empty text="Sin ventas en este periodo." />
          ) : (
            <List
              rows={r.best.map((x) => ({
                key: x.name,
                name: x.name,
                left: money(x.revenue),
                right: `${num(x.qty)} pzs`,
              }))}
            />
          )}
        </Card>

        <Card title="Los que menos se venden" sub="Con existencias; los que no se vendieron van primero">
          <List
            rows={r.slowest.map((x) => ({
              key: x.id,
              name: x.name,
              left: `${money(x.value)} en stock`,
              right: x.qty === 0 ? "0 vendidas" : `${num(x.qty)} pzs`,
              tone: x.qty === 0 ? "warn" : undefined,
            }))}
          />
        </Card>

        <Card title="Los que más ingresos dejan" sub="Por dinero vendido en el periodo">
          {r.bestMoney.length === 0 ? (
            <Empty text="Sin ventas en este periodo." />
          ) : (
            <List
              rows={r.bestMoney.map((x) => ({
                key: x.name,
                name: x.name,
                left: `${num(x.qty)} pzs`,
                right: money(x.revenue),
              }))}
            />
          )}
        </Card>
      </div>
    </section>
  );
}

/* ---------- piezas de interfaz ---------- */

function Kpi({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${highlight ? "bg-brand border-brand text-ink" : "card"}`}>
      <p className={`text-sm ${highlight ? "text-ink/70" : "text-muted"}`}>{label}</p>
      <p className="text-xl sm:text-2xl font-extrabold mt-1.5 break-words">{value}</p>
      {note && <p className={`text-xs mt-1.5 ${highlight ? "text-ink/70" : "text-muted"}`}>{note}</p>}
    </div>
  );
}

function Card({
  title, sub, action, children,
}: {
  title: string; sub?: string; action?: { href: string; label: string }; children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-sm font-semibold text-brand-strong hover:underline shrink-0">
            {action.label}
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function List({
  rows,
}: {
  rows: { key: string; name: string; left?: string; right: string; tone?: "bad" | "warn" }[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <ol className="divide-y divide-line">
      {rows.map((x) => (
        <li key={x.key} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <p className="font-medium truncate">{x.name}</p>
            {x.left && <p className="text-xs text-muted truncate">{x.left}</p>}
          </div>
          <span
            className={`shrink-0 text-sm font-semibold rounded-full px-3 py-1 ${
              x.tone === "bad"
                ? "bg-red-100 text-red-700"
                : x.tone === "warn"
                ? "bg-peach-soft text-neutral-800"
                : "text-neutral-700"
            }`}
          >
            {x.right}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Empty({ text = "Aún no hay datos." }: { text?: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}
