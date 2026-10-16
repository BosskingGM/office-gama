"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";

// Corazón para guardar un producto en favoritos.
//  - variant "card": flotante sobre la foto de la tarjeta.
//  - variant "detail": botón redondo junto a "Agregar al carrito".
export default function WishlistButton({
  productId,
  productName,
  variant = "card",
}: {
  productId: string;
  productName: string;
  variant?: "card" | "detail";
}) {
  const { isFav, toggle, hydrated } = useWishlist();
  const active = hydrated && isFav(productId);

  const label = active
    ? `Quitar ${productName} de favoritos`
    : `Guardar ${productName} en favoritos`;

  const base =
    "grid place-items-center rounded-full transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2";

  const size =
    variant === "card"
      ? "absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-9 h-9 bg-white/90 shadow-sm hover:bg-white"
      : "w-13 h-13 shrink-0 border-2 border-line hover:bg-brand-soft hover:border-brand";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      aria-pressed={active}
      aria-label={label}
      title={active ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={`${base} ${size}`}
    >
      <Heart
        size={variant === "card" ? 18 : 22}
        className={active ? "text-brand-strong fill-current" : "text-neutral-600"}
        aria-hidden="true"
      />
    </button>
  );
}
