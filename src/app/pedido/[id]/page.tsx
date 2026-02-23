"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function PedidoPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            product_variants (
              model_name
            ),
            products (
              name
            )
          )
        `)
        .eq("id", id)
        .single();

      if (!error) {
        setOrder(data);
      }
    };

    fetchOrder();
  }, [id]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Cargando pedido...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-10 py-6">
      <div className="max-w-3xl mx-auto bg-white p-5 sm:p-6 lg:p-8 rounded-2xl shadow">
        
        <h1 className="text-2xl sm:text-3xl font-bold text-green-600 mb-4">
          🎉 Pedido confirmado
        </h1>

        <p className="text-black font-semibold mb-2">
          Número de pedido:
        </p>

        <p className="text-pink-600 font-bold mb-6 break-all">
          {order.id}
        </p>

        <p className="text-black mb-4">
          Estado:
          <span className="ml-2 font-semibold text-yellow-600 break-words">
            {order.status}
          </span>
        </p>

        <h2 className="text-lg sm:text-xl font-bold text-black mb-4">
          Productos:
        </h2>

        <div className="space-y-3 mb-6">
          {order.order_items.map((item: any) => (
            <div
              key={item.id}
              className="bg-gray-100 p-3 sm:p-4 rounded-lg"
            >
              <p className="text-black font-semibold break-words">
                {item.products?.name}
              </p>
              <p className="text-black">
                Modelo: {item.product_variants?.model_name}
              </p>
              <p className="text-black">
                Cantidad: {item.quantity}
              </p>
              <p className="text-pink-600 font-bold">
                ${item.price} MXN
              </p>
            </div>
          ))}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-black">
          Total:
          <span className="text-pink-600 ml-2 break-words">
            ${order.total} MXN
          </span>
        </h2>

        <div className="mt-6 sm:mt-8">
          <Link
            href="/cuenta"
            className="bg-pink-500 text-white px-6 py-3 rounded-full hover:bg-pink-600 transition block w-full sm:w-auto text-center"
          >
            Ver todos mis pedidos
          </Link>
        </div>

      </div>
    </main>
  );
}