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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pagado":
        return "bg-green-100 text-green-700";
      case "pendiente":
        return "bg-yellow-100 text-yellow-700";
      case "enviado":
        return "bg-blue-100 text-blue-700";
      case "cancelado":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Cargando pedidos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-10 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-black mb-6 sm:mb-8">
        Mis pedidos
      </h1>

      {orders.length === 0 ? (
        <p className="text-gray-600">
          Aún no has realizado ningún pedido.
        </p>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl shadow p-4 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="text-black font-semibold break-all">
                    Pedido #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(
                      order.created_at
                    ).toLocaleDateString()}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold w-fit ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>

              <div className="border-t pt-4 space-y-2">
                {order.order_items.map(
                  (item: any, index: number) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 text-black"
                    >
                      <div className="break-words">
                        {item.product_variants?.model_name}
                        <span className="text-gray-500 ml-2">
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

              <div className="border-t pt-4 flex flex-col sm:flex-row sm:justify-between gap-2 font-bold text-black">
                <span>Total</span>
                <span>${order.total.toFixed(2)} MXN</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}