"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";
import Link from "next/link";

export default function SuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9ff] flex items-center justify-center px-6 py-16">
      <div className="bg-white border border-neutral-200 rounded-3xl p-10 sm:p-14 text-center w-full max-w-xl space-y-8">

        {/* ICONO */}
        <div className="mx-auto w-20 h-20 rounded-full bg-[#f3e8ff] flex items-center justify-center text-3xl">
          ✓
        </div>

        {/* TITULO */}
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900">
          Pago confirmado
        </h1>

        {/* DESCRIPCION */}
        <p className="text-neutral-600 leading-relaxed">
          Tu pedido ha sido procesado correctamente.
          Recibirás un correo de confirmación con los detalles de tu compra.
        </p>

        {/* BOTONES */}
        <div className="space-y-4 pt-4">

          <Link
            href="/cuenta"
            className="block w-full bg-[#d6a8ff] text-black font-semibold py-4 rounded-2xl hover:opacity-90 transition"
          >
            Ver mis pedidos
          </Link>

          <Link
            href="/"
            className="block w-full border border-neutral-300 text-neutral-700 py-4 rounded-2xl hover:bg-neutral-100 transition"
          >
            Volver a la tienda
          </Link>

        </div>
      </div>
    </div>
  );
}