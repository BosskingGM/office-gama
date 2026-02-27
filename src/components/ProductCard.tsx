"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProductCard({ product }: any) {
  const images =
    product.product_variants?.map((v: any) => v.image_url) || [];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [images]);

  return (
    <div
      className="
        bg-white
        border border-neutral-200
        rounded-3xl
        overflow-hidden
        transition
        duration-300
        hover:shadow-xl
        flex flex-col
      "
    >
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
      <div className="flex flex-col flex-1 p-4 space-y-2">

        <h2
  className="
    text-neutral-900
    font-semibold
    text-[15px]
    leading-5
    tracking-tight
    line-clamp-2
  "
>
          {product.name}
        </h2>

        <p className="text-neutral-900 font-semibold text-base">
          ${product.price} MXN
        </p>

        {/* Botón elegante */}
<Link
  href={`/producto/${product.id}`}
  className="
    mt-3
    inline-flex
    items-center
    justify-center
    px-5
    py-2.5
    text-sm
    font-medium
    text-white
    bg-black
    rounded-xl
    transition-all
    duration-200
    hover:bg-neutral-800
    active:scale-[0.98]
    shadow-sm
  "
>
  Ver producto
</Link>

      </div>
    </div>
  );
}