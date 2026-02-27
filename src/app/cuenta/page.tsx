"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PerfilPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            quantity,
            price,
            product_variants (
              model_name,
              image_url,
              products (
                name
              )
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders(data || []);
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pagado":
        return "bg-green-100 text-green-700";
      case "pendiente":
        return "bg-yellow-100 text-yellow-700";
      case "enviado":
        return "bg-blue-100 text-blue-700";
      case "cancelado":
        return "bg-red-100 text-red-600";
      default:
        return "bg-neutral-200 text-neutral-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-700 bg-[#faf9ff]">
        Cargando pedidos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9ff] px-6 py-12">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-3xl font-bold text-neutral-900 mb-10">
          Mis pedidos
        </h1>

        {orders.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center text-neutral-600">
            Aún no has realizado ningún pedido.
          </div>
        ) : (
          <div className="space-y-8">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition"
              >
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">

                  <div>
                    <p className="text-base font-semibold text-neutral-900">
                      Pedido #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {new Date(order.created_at).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusStyle(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* PRODUCTOS */}
                <div className="mt-6 border-t border-neutral-200 pt-6 space-y-5">
                  {order.order_items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">

                        <img
                          src={
                            item.product_variants?.image_url ||
                            "https://via.placeholder.com/60"
                          }
                          alt="producto"
                          className="w-16 h-16 object-cover rounded-xl border border-neutral-200"
                        />

                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-neutral-900">
                            {item.product_variants?.products?.name}
                          </span>

                          <span className="text-xs text-neutral-500">
                            Modelo: {item.product_variants?.model_name}
                          </span>

                          <span className="text-xs text-neutral-500">
                            Cantidad: {item.quantity}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-neutral-900">
                        ${(item.price * item.quantity).toFixed(2)} MXN
                      </div>
                    </div>
                  ))}
                </div>

                {/* TOTAL */}
                <div className="mt-6 border-t border-neutral-200 pt-6 flex justify-between text-base font-semibold text-neutral-900">
                  <span>Total</span>
                  <span>${order.total.toFixed(2)} MXN</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}