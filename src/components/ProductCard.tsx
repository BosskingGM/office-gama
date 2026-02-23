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
      rounded-2xl 
      shadow-sm 
      hover:shadow-xl 
      transition 
      duration-300 
      overflow-hidden
      flex 
      flex-col
    ">

      {/* Imagen */}
      <div className="relative w-full aspect-[4/3] bg-gray-100">
        {images[index] ? (
          <img
            src={images[index]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Sin imagen
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4 space-y-2">

        <h2 className="
          text-black 
          font-semibold 
          text-base 
          sm:text-lg 
          line-clamp-2
        ">
          {product.name}
        </h2>

        <p className="
          text-pink-600 
          font-bold 
          text-lg
        ">
          ${product.price} MXN
        </p>

        {/* Botón */}
        <Link
          href={`/producto/${product.id}`}
          className="
            mt-auto
            bg-pink-500 
            hover:bg-pink-600 
            text-white 
            py-2.5 
            rounded-xl 
            text-center 
            font-semibold 
            transition
            w-full
          "
        >
          Ver producto
        </Link>

      </div>
    </div>
  );
}