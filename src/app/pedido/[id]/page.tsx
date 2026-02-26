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
      <div className="min-h-screen flex items-center justify-center bg-[#faf9ff] text-neutral-700">
        Cargando pedido...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf9ff] px-6 py-12">
      <div className="max-w-3xl mx-auto bg-white border border-neutral-200 p-10 rounded-3xl space-y-10">

        {/* HEADER */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-neutral-900">
            Pedido confirmado
          </h1>

          <p className="text-neutral-500 text-sm">
            Gracias por tu compra. Aquí están los detalles de tu pedido.
          </p>
        </div>

        {/* INFO PEDIDO */}
        <div className="border border-neutral-200 rounded-2xl p-6 space-y-3">
          <div>
            <p className="text-sm text-neutral-500">
              Número de pedido
            </p>
            <p className="font-semibold text-neutral-900 break-all">
              {order.id}
            </p>
          </div>

          <div>
            <p className="text-sm text-neutral-500">
              Estado
            </p>
            <span className="inline-block mt-1 px-4 py-1 rounded-full text-xs font-medium bg-[#d6a8ff] text-black">
              {order.status}
            </span>
          </div>
        </div>

        {/* PRODUCTOS */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Productos
          </h2>

          {order.order_items.map((item: any) => (
            <div
              key={item.id}
              className="border border-neutral-200 rounded-2xl p-6 space-y-1"
            >
              <p className="font-medium text-neutral-900 break-words">
                {item.products?.name}
              </p>

              <p className="text-sm text-neutral-500">
                Modelo: {item.product_variants?.model_name}
              </p>

              <p className="text-sm text-neutral-500">
                Cantidad: {item.quantity}
              </p>

              <p className="font-semibold text-neutral-900 mt-2">
                ${item.price} MXN
              </p>
            </div>
          ))}
        </div>

        {/* TOTAL */}
        <div className="border-t pt-6 flex justify-between items-center">
          <span className="text-lg font-semibold text-neutral-900">
            Total
          </span>
          <span className="text-xl font-bold text-neutral-900">
            ${order.total} MXN
          </span>
        </div>

        {/* BOTÓN */}
        <div className="pt-6">
          <Link
            href="/cuenta"
            className="block w-full sm:w-auto text-center bg-[#d6a8ff] text-black px-6 py-4 rounded-2xl font-semibold hover:opacity-90 transition"
          >
            Ver todos mis pedidos
          </Link>
        </div>

      </div>
    </main>
  );
}