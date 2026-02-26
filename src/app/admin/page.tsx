"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalVentas: 0,
    totalPedidos: 0,
    enviados: 0,
    ventasMes: 0,
  });

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    const { data: orders } = await supabase
      .from("orders")
      .select("*");

    const { data: items } = await supabase
      .from("order_items")
      .select(`
        quantity,
        product_variants (
          id,
          model_name,
          stock,
          products (
            name
          )
        )
      `);

    if (!orders || !items) return;

    const totalVentas = orders.reduce(
      (acc, o) => acc + Number(o.total),
      0
    );

    const totalPedidos = orders.length;

    const enviados = orders.filter(
      (o) => o.status === "enviado"
    ).length;

    const now = new Date();
    const ventasMes = orders
      .filter((o) => {
        const date = new Date(o.created_at);
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, o) => acc + Number(o.total), 0);

    setStats({
      totalVentas,
      totalPedidos,
      enviados,
      ventasMes,
    });

    const grouped: any = {};

    items.forEach((item: any) => {
      const name =
        item.product_variants?.products?.name ||
        "Producto";

      if (!grouped[name]) grouped[name] = 0;
      grouped[name] += item.quantity;
    });

    const top = Object.entries(grouped)
      .map(([name, qty]) => ({
        name,
        qty,
      }))
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 5);

    setTopProducts(top);

    const low = items
      .filter(
        (item: any) =>
          item.product_variants?.stock <= 5
      )
      .map((item: any) => ({
        name:
          item.product_variants?.products?.name,
        model:
          item.product_variants?.model_name,
        stock:
          item.product_variants?.stock,
      }));

    setLowStock(low);
  }

  return (
    <div className="min-h-screen bg-[#faf9ff] px-6 py-12">
      <div className="max-w-7xl mx-auto space-y-12">

        <h1 className="text-4xl font-bold text-neutral-900">
          Dashboard
        </h1>

        {/* MÉTRICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          <MetricCard
            title="Ventas Totales"
            value={`$${stats.totalVentas} MXN`}
          />

          <MetricCard
            title="Pedidos Totales"
            value={stats.totalPedidos}
          />

          <MetricCard
            title="Pedidos Enviados"
            value={stats.enviados}
          />

          <MetricCard
            title="Ventas del Mes"
            value={`$${stats.ventasMes} MXN`}
            highlight
          />

        </div>

        {/* SECCIONES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* TOP PRODUCTOS */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-semibold text-neutral-900">
              Top productos
            </h2>

            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center border border-neutral-200 rounded-2xl px-5 py-4"
                >
                  <p className="text-neutral-800 font-medium">
                    {p.name}
                  </p>
                  <p className="font-semibold text-neutral-900">
                    {p.qty} vendidos
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* STOCK BAJO */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 space-y-6">
            <h2 className="text-xl font-semibold text-neutral-900">
              Stock bajo
            </h2>

            {lowStock.length === 0 ? (
              <p className="text-neutral-600">
                Todo el inventario está saludable.
              </p>
            ) : (
              <div className="space-y-4">
                {lowStock.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center border border-neutral-200 rounded-2xl px-5 py-4"
                  >
                    <div>
                      <p className="text-neutral-900 font-medium">
                        {p.name}
                      </p>
                      <p className="text-sm text-neutral-500">
                        Modelo: {p.model}
                      </p>
                    </div>
                    <p className="font-semibold text-neutral-900">
                      {p.stock}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: any;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 border transition ${
        highlight
          ? "bg-[#d6a8ff] text-black border-[#d6a8ff]"
          : "bg-white text-neutral-900 border-neutral-200"
      }`}
    >
      <p className="text-sm text-neutral-500">
        {title}
      </p>
      <p className="text-2xl font-bold mt-2">
        {value}
      </p>
    </div>
  );
}