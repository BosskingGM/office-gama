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
        .select(
          `
          *,
          order_items (
            quantity,
            price,
            product_variants (
              model_name
            )
          )
        `
        )
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
        return "bg-[#f3e8ff] text-neutral-800";
      case "pendiente":
        return "bg-neutral-200 text-neutral-800";
      case "enviado":
        return "bg-[#d6a8ff] text-black";
      case "cancelado":
        return "bg-neutral-300 text-neutral-700";
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
      <div className="max-w-5xl mx-auto">

        <h1 className="text-4xl font-bold text-neutral-900 mb-12">
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
                className="bg-white border border-neutral-200 rounded-3xl p-8 space-y-6"
              >
                {/* HEADER */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

                  <div>
                    <p className="text-lg font-semibold text-neutral-900 break-all">
                      Pedido #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold w-fit ${getStatusStyle(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* ITEMS */}
                <div className="border-t border-neutral-200 pt-6 space-y-3">
                  {order.order_items.map(
                    (item: any, index: number) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:justify-between gap-2 text-neutral-800"
                      >
                        <div>
                          {item.product_variants?.model_name}
                          <span className="text-neutral-500 ml-2">
                            x{item.quantity}
                          </span>
                        </div>

                        <div className="font-medium">
                          $
                          {(item.price * item.quantity).toFixed(
                            2
                          )}{" "}
                          MXN
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* TOTAL */}
                <div className="border-t border-neutral-200 pt-6 flex justify-between font-semibold text-neutral-900 text-lg">
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