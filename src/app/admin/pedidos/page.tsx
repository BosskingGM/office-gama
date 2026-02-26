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

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: string,
    userEmail: string
  ) => {
    setLoading(true);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      alert("No se pudo actualizar el estado");
      setLoading(false);
      return;
    }

  if (newStatus === "enviado") {
  await fetch("/api/send-shipped-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: orderId,
    }),
  });
}

    await fetchOrders();
    setSelectedOrder(null);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pagado":
        return "bg-green-600 text-white";
      case "enviado":
        return "bg-blue-600 text-white";
      case "entregado":
        return "bg-purple-700 text-white";
      case "cancelado":
        return "bg-red-600 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 bg-white min-h-screen text-black">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-black">
        Gestión de Pedidos
      </h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-4 border rounded-xl shadow hover:shadow-lg cursor-pointer 
                       flex flex-col sm:flex-row sm:justify-between sm:items-center 
                       gap-3 bg-white"
            onClick={() => setSelectedOrder(order)}
          >
            <div>
              <p className="font-semibold text-black">
                Pedido #{order.id.slice(0, 8)}
              </p>
              <p className="text-sm text-black break-all">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>

            <div className="sm:text-right">
              <p className="font-bold text-black">
                ${order.total} MXN
              </p>
              <span
                className={`inline-block mt-1 px-3 py-1 rounded-full text-sm ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:w-[520px] max-h-[90vh] overflow-y-auto 
                          p-5 sm:p-6 rounded-t-2xl sm:rounded-2xl shadow-xl relative text-black">
            <button
              className="absolute top-3 right-3 text-red-600 font-bold text-lg"
              onClick={() => setSelectedOrder(null)}
            >
              X
            </button>

            <h2 className="text-lg sm:text-xl font-bold text-black mb-2">
              Pedido #{selectedOrder.id.slice(0, 8)}
            </h2>

            <p className="mb-4 text-black">
              Total: <strong>${selectedOrder.total} MXN</strong>
            </p>

            {/* Información del cliente */}
            <div className="mt-4 p-4 border rounded-xl bg-gray-50 space-y-2 text-sm">
              <h3 className="font-bold text-black">Información del cliente</h3>

              <p><strong>Nombre:</strong> {selectedOrder.full_name}</p>
              <p><strong>Email:</strong> {selectedOrder.user_email}</p>
              <p><strong>Teléfono:</strong> {selectedOrder.phone}</p>
            </div>

            {/* Dirección */}
            <div className="mt-4 p-4 border rounded-xl bg-gray-50 space-y-2 text-sm">
              <h3 className="font-bold text-black">Dirección de envío</h3>

              <p><strong>Dirección:</strong> {selectedOrder.address}</p>
              <p><strong>Ciudad:</strong> {selectedOrder.city}</p>
              <p><strong>Código Postal:</strong> {selectedOrder.postal_code}</p>
              <p><strong>Tipo de envío:</strong> {selectedOrder.shipping_type}</p>
              <p><strong>Costo envío:</strong> ${selectedOrder.shipping_cost} MXN</p>
            </div>

            {/* Productos */}
            <div className="space-y-3 mt-4">
              {selectedOrder.order_items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-center gap-4 border p-3 rounded-lg bg-white"
                >
                  <img
                    src={
                      item.product_variants?.image_url
                        ? item.product_variants.image_url
                        : "https://via.placeholder.com/150"
                    }
                    alt="producto"
                    className="w-full sm:w-20 h-48 sm:h-20 object-cover rounded border"
                  />

                  <div className="text-center sm:text-left">
                    <p className="font-semibold text-black">
                      {item.product_variants?.products?.name}
                    </p>

                    <p className="text-black">
                      Cantidad: {item.quantity}
                    </p>

                    <p className="text-black">
                      Precio: ${item.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de estado */}
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <button
                disabled={loading}
                onClick={() =>
                  handleUpdateStatus(
                    selectedOrder.id,
                    "pagado",
                    selectedOrder.user_email
                  )
                }
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Marcar pagado
              </button>

              <button
                disabled={loading}
                onClick={() =>
                  handleUpdateStatus(
                    selectedOrder.id,
                    "enviado",
                    selectedOrder.user_email
                  )
                }
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Marcar enviado
              </button>

              <button
                disabled={loading}
                onClick={() =>
                  handleUpdateStatus(
                    selectedOrder.id,
                    "entregado",
                    selectedOrder.user_email
                  )
                }
                className="w-full bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-lg"
              >
                Marcar entregado
              </button>

              <button
                disabled={loading}
                onClick={() =>
                  handleUpdateStatus(
                    selectedOrder.id,
                    "cancelado",
                    selectedOrder.user_email
                  )
                }
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}