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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 text-center w-full max-w-lg space-y-5 sm:space-y-6">
        
        <div className="text-green-500 text-4xl sm:text-5xl">
          ✔
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-black">
          ¡Pago exitoso!
        </h1>

        <p className="text-gray-600 text-sm sm:text-base">
          Tu pedido ha sido procesado correctamente.
          Recibirás una confirmación pronto.
        </p>

        <Link
          href="/cuenta"
          className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl block w-full sm:w-auto"
        >
          Ver mis pedidos
        </Link>

        <Link
          href="/"
          className="text-gray-500 hover:text-black block text-sm sm:text-base"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}