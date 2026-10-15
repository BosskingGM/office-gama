"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImageOff, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

type Variant = {
  id: string;
  image_url?: string | null;
  model_name?: string | null;
  stock?: number | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  product_variants?: Variant[];
};

const money = (n: number) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart, openCart } = useCart();

  const variants = product.product_variants ?? [];
  const images = variants
    .map((v) => v.image_url)
    .filter((u): u is string => !!u);

  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Datos de existencias (la portada los manda; si faltan, no adivinamos)
  const hasStockData =
    variants.length > 0 && variants.every((v) => typeof v.stock === "number");
  const totalStock = hasStockData
    ? variants.reduce((acc, v) => acc + (v.stock ?? 0), 0)
    : null;
  const soldOut = totalStock === 0;
  const lowStock = totalStock !== null && totalStock > 0 && totalStock <= 3;

  const single = variants.length === 1 ? variants[0] : null;
  const canQuickAdd =
    hasStockData && single !== null && (single.stock ?? 0) > 0;

  // Las fotos de las variantes rotan solo al pasar el cursor
  const startCycle = () => {
    if (images.length <= 1 || timer.current) return;
    timer.current = setInterval(
      () => setIndex((prev) => (prev + 1) % images.length),
      900
    );
  };
  const stopCycle = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setIndex(0);
  };
  useEffect(() => () => stopCycle(), []); // limpia al desmontar

  const handleQuickAdd = () => {
    if (!single || !canQuickAdd) return;
    const ok = addToCart({
      product_id: product.id,
      variant_id: single.id,
      name: product.name,
      model_name: single.model_name ?? "",
      price: Number(product.price),
      quantity: 1,
      stock: single.stock ?? 0,
      image_url: single.image_url ?? undefined,
    });
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
    openCart();
  };

  const href = `/producto/${product.id}`;

  return (
    <article className="card card-hover overflow-hidden flex flex-col group">
      {/* Imagen */}
      <Link
        href={href}
        className="relative block w-full aspect-square bg-brand-soft overflow-hidden"
        onMouseEnter={startCycle}
        onMouseLeave={stopCycle}
        aria-label={`Ver ${product.name}`}
      >
        {images[index] ? (
          <img
            src={images[index]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              soldOut ? "opacity-60 grayscale-[40%]" : ""
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-400 text-sm">
            <ImageOff size={28} />
            Sin imagen
          </div>
        )}

        {/* Etiquetas */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {soldOut && (
            <span className="bg-ink text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
              Agotado
            </span>
          )}
          {lowStock && (
            <span className="bg-peach text-ink text-[11px] font-semibold px-2.5 py-1 rounded-full">
              {totalStock === 1 ? "Última pieza" : `Últimas ${totalStock}`}
            </span>
          )}
          {product.category === "Liquidación" && !soldOut && (
            <span className="bg-brand text-ink text-[11px] font-semibold px-2.5 py-1 rounded-full">
              Liquidación
            </span>
          )}
        </div>

        {/* Puntos de variantes */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </Link>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4 gap-1">
        {product.category && (
          <p className="text-[11px] uppercase tracking-wide text-muted font-medium">
            {product.category}
          </p>
        )}

        <h2 className="font-semibold text-[15px] leading-5 line-clamp-2 min-h-10">
          <Link href={href} className="hover:text-brand-strong transition">
            {product.name}
          </Link>
        </h2>

        <div className="flex items-end justify-between gap-2 mt-auto pt-2">
          <div>
            <p className="text-lg font-bold leading-none">
              {money(product.price)}
            </p>
            {variants.length > 1 && (
              <p className="text-[11px] text-muted mt-1">
                {variants.length} modelos
              </p>
            )}
          </div>

          {soldOut ? (
            <span className="text-xs font-semibold text-muted pb-0.5">
              No disponible
            </span>
          ) : canQuickAdd ? (
            <button
              onClick={handleQuickAdd}
              aria-label={`Agregar ${product.name} al carrito`}
              className={`btn-primary p-0! w-10 h-10 shrink-0 ${
                added ? "bg-ok! text-white" : ""
              }`}
            >
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}
            </button>
          ) : (
            <Link
              href={href}
              className="btn-outline text-xs px-3.5! py-2! shrink-0"
            >
              Elegir modelo
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
