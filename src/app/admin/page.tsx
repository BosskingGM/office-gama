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
    <div className="px-4 sm:px-6 lg:px-10 py-6 bg-gradient-to-br from-gray-100 to-gray-200 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-black mb-6 sm:mb-8">
        📊 Dashboard Empresarial
      </h1>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-10">
        <Card
          title="Ventas Totales"
          value={`$${stats.totalVentas} MXN`}
          color="bg-green-600"
        />
        <Card
          title="Pedidos Totales"
          value={stats.totalPedidos}
          color="bg-blue-600"
        />
        <Card
          title="Pedidos Enviados"
          value={stats.enviados}
          color="bg-purple-600"
        />
        <Card
          title="Ventas del Mes"
          value={`$${stats.ventasMes} MXN`}
          color="bg-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">

        {/* TOP PRODUCTOS */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-xl">
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-black">
            🏆 Top Productos Más Vendidos
          </h2>

          <div className="space-y-3 sm:space-y-4">
            {topProducts.map((p, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-gray-100 p-3 sm:p-4 rounded-xl"
              >
                <p className="text-black font-medium break-words">
                  {p.name}
                </p>
                <p className="text-black font-bold">
                  {p.qty} vendidos
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* POCO STOCK */}
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-xl">
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-black">
            🚨 Productos con Poco Stock
          </h2>

          {lowStock.length === 0 ? (
            <p className="text-green-600 font-medium">
              Todo el stock está saludable
            </p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {lowStock.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-red-100 p-3 sm:p-4 rounded-xl"
                >
                  <div>
                    <p className="text-black font-medium break-words">
                      {p.name}
                    </p>
                    <p className="text-sm text-black">
                      Modelo: {p.model}
                    </p>
                  </div>
                  <p className="text-red-600 font-bold">
                    Stock: {p.stock}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: any;
  color: string;
}) {
  return (
    <div
      className={`${color} text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg`}
    >
      <p className="text-xs sm:text-sm opacity-80">
        {title}
      </p>
      <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2 break-words">
        {value}
      </p>
    </div>
  );
}