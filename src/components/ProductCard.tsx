"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProductCard({ product }: any) {
  const images =
    product.product_variants?.map(
      (v: any) => v.image_url
    ) || [];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [images]);

  return (
    <div className="
      bg-white
      border
      border-neutral-200
      rounded-3xl
      overflow-hidden
      transition
      duration-300
      hover:shadow-lg
      flex
      flex-col
    ">

      {/* Imagen */}
      <div className="relative w-full aspect-[4/3] bg-neutral-100 overflow-hidden">
        {images[index] ? (
          <img
            src={images[index]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
            Sin imagen
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-5 space-y-3">

        <h2 className="
          text-neutral-900
          font-semibold
          text-base
          sm:text-lg
          line-clamp-2
        ">
          {product.name}
        </h2>

        <p className="
          text-neutral-800
          font-semibold
          text-lg
        ">
          ${product.price} MXN
        </p>

        {/* Botón */}
        <Link
          href={`/producto/${product.id}`}
          className="
            mt-auto
            bg-[#d6a8ff]
            text-black
            py-3
            rounded-2xl
            text-center
            font-semibold
            transition
            hover:opacity-90
            w-full
          "
        >
          Ver producto
        </Link>

      </div>
    </div>
  );
}