"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPedidos() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          *,
          product_variants (
            *,
            products (*)
          )
        )
      `)
      .order("created_at", { ascending: false });

    setOrders(data || []);
  };

  // 🔥 FORMATO MÉXICO CORRECTO
  const formatMXDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: string
  ) => {
    setLoading(true);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      setLoading(false);
      return;
    }

    if (newStatus === "enviado") {
      await fetch("/api/send-shipped-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
    }

    await fetchOrders();
    setSelectedOrder(null);
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pagado":
        return "bg-neutral-200 text-neutral-900";
      case "enviado":
        return "bg-[#d6a8ff] text-black";
      case "entregado":
        return "bg-neutral-900 text-white";
      case "cancelado":
        return "bg-neutral-300 text-neutral-700";
      default:
        return "bg-neutral-200 text-neutral-800";
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] px-6 py-12">
      <div className="max-w-6xl mx-auto space-y-10">

        <h1 className="text-3xl font-bold text-neutral-900">
          Gestión de pedidos
        </h1>

        {/* LISTA */}
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white border border-neutral-200 rounded-2xl p-6 cursor-pointer hover:shadow-md transition flex flex-col sm:flex-row sm:justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-neutral-900">
                  Pedido #{order.id.slice(0, 8)}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatMXDate(order.created_at)}
                </p>
              </div>

              <div className="sm:text-right">
                <p className="font-semibold text-neutral-900">
                  ${order.total} MXN
                </p>
                <span
                  className={`inline-block mt-2 px-4 py-1 rounded-full text-xs font-medium ${getStatusStyle(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* MODAL */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 space-y-6 relative border border-neutral-200">

              <button
                onClick={() => setSelectedOrder(null)}
                className="absolute top-5 right-6 text-neutral-500 hover:text-neutral-900 text-lg"
              >
                ✕
              </button>

              <h2 className="text-2xl font-semibold text-neutral-900">
                Pedido #{selectedOrder.id.slice(0, 8)}
              </h2>

              <p className="text-sm text-neutral-500">
                {formatMXDate(selectedOrder.created_at)}
              </p>

              <p className="text-neutral-700">
                Total: <strong>${selectedOrder.total} MXN</strong>
              </p>

              {/* Cliente */}
              <Section title="Cliente">
                <p>{selectedOrder.full_name}</p>
                <p>{selectedOrder.user_email}</p>
                <p>{selectedOrder.phone}</p>
              </Section>

              {/* Dirección */}
              <Section title="Dirección">
                <p>{selectedOrder.address}</p>
                <p>{selectedOrder.city}</p>
                <p>CP: {selectedOrder.postal_code}</p>
                <p>Envío: {selectedOrder.shipping_type}</p>
              </Section>

              {/* Productos */}
              <Section title="Productos">
                <div className="space-y-4">
                  {selectedOrder.order_items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border border-neutral-200 rounded-2xl p-4"
                    >
                      <img
                        src={
                          item.product_variants?.image_url ||
                          "https://via.placeholder.com/100"
                        }
                        alt="producto"
                        className="w-20 h-20 object-cover rounded-xl"
                      />

                      <div>
                        <p className="font-medium text-neutral-900">
                          {item.product_variants?.products?.name}
                        </p>
                        <p className="text-sm text-neutral-500">
                          Cantidad: {item.quantity}
                        </p>
                        <p className="text-sm text-neutral-500">
                          Precio: ${item.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* BOTONES */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                {["pagado", "enviado", "entregado", "cancelado"].map(
                  (status) => (
                    <button
                      key={status}
                      disabled={loading}
                      onClick={() =>
                        handleUpdateStatus(selectedOrder.id, status)
                      }
                      className="bg-neutral-900 text-white py-3 rounded-2xl hover:opacity-90 transition text-sm"
                    >
                      Marcar {status}
                    </button>
                  )
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 rounded-2xl p-6 space-y-2">
      <h3 className="font-semibold text-neutral-900">
        {title}
      </h3>
      <div className="text-neutral-700 text-sm space-y-1">
        {children}
      </div>
    </div>
  );
}