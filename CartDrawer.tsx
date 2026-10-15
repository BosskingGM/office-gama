"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function CartDrawer() {
  const {
    cart,
    count,
    subtotal,
    isOpen,
    closeCart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    syncCart,
  } = useCart();

  const [notice, setNotice] = useState("");
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // syncCart cambia cada vez que cambia el carrito; con la ref evitamos que
  // el efecto se dispare en bucle y solo sincronizamos al abrir el panel.
  const syncRef = useRef(syncCart);
  syncRef.current = syncCart;

  useEffect(() => {
    if (!isOpen) return;
    setNotice("");
    closeBtnRef.current?.focus();

    let cancelled = false;
    syncRef.current().then(({ removed, adjusted }) => {
      if (cancelled) return;
      if (removed.length) {
        setNotice(
          `Ya no está disponible: ${removed.join(", ")}. Lo quitamos de tu carrito.`
        );
      } else if (adjusted.length) {
        setNotice(
          `Actualizamos precio o existencias de: ${adjusted.join(", ")}.`
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999]" role="presentation">
      {/* Fondo */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className="animate-slide-in-right absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
      >
        {/* Encabezado */}
        <header className="flex items-center justify-between px-5 h-16 border-b border-line shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag size={20} className="text-brand-strong" />
            Tu carrito
            {count > 0 && (
              <span className="text-sm font-medium text-neutral-500">
                ({count} {count === 1 ? "pieza" : "piezas"})
              </span>
            )}
          </h2>
          <button
            ref={closeBtnRef}
            onClick={closeCart}
            aria-label="Cerrar carrito"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft transition"
          >
            <X size={20} />
          </button>
        </header>

        {notice && (
          <p
            role="status"
            className="mx-5 mt-4 text-sm bg-peach-soft border border-peach text-neutral-800 rounded-xl px-4 py-3"
          >
            {notice}
          </p>
        )}

        {cart.length === 0 ? (
          <div className="flex-1 grid place-items-center px-6 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-brand-soft grid place-items-center">
                <ShoppingBag size={34} className="text-brand-strong" />
              </div>
              <p className="text-lg font-semibold">Tu carrito está vacío</p>
              <p className="text-sm text-muted">
                Agrega tus favoritos y aparecerán aquí.
              </p>
              <Link
                href="/"
                onClick={closeCart}
                className="btn-primary inline-flex"
              >
                Ver productos
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Productos */}
            <ul className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cart.map((item) => (
                <li
                  key={item.variant_id}
                  className="flex gap-4 pb-4 border-b border-line last:border-0"
                >
                  <Link
                    href={`/producto/${item.product_id}`}
                    onClick={closeCart}
                    className="w-20 h-20 rounded-xl overflow-hidden bg-brand-soft shrink-0 grid place-items-center"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag size={22} className="text-brand-strong" />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-5 line-clamp-2">
                          {item.name}
                        </p>
                        {item.model_name && (
                          <p className="text-xs text-muted mt-0.5">
                            {item.model_name}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.variant_id)}
                        aria-label={`Quitar ${item.name}`}
                        className="text-neutral-400 hover:text-danger transition shrink-0 h-fit p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-line rounded-full">
                        <button
                          onClick={() => decreaseQuantity(item.variant_id)}
                          aria-label="Quitar una pieza"
                          className="w-8 h-8 grid place-items-center hover:bg-brand-soft rounded-full transition"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => increaseQuantity(item.variant_id)}
                          disabled={item.quantity >= item.stock}
                          aria-label="Agregar una pieza"
                          className="w-8 h-8 grid place-items-center hover:bg-brand-soft rounded-full transition disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="font-semibold text-sm">
                        {money(item.price * item.quantity)}
                      </p>
                    </div>

                    {item.quantity >= item.stock && (
                      <p className="text-xs text-brand-strong mt-1.5">
                        Máximo disponible: {item.stock}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Pie */}
            <footer className="border-t border-line px-5 py-5 space-y-4 shrink-0 bg-white">
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="text-xl font-bold">{money(subtotal)}</span>
              </div>
              <p className="text-xs text-muted -mt-2">
                El envío se calcula en el siguiente paso.
              </p>

              <Link
                href="/carrito"
                onClick={closeCart}
                className="btn-primary w-full text-base py-3.5"
              >
                Ir a pagar
              </Link>
              <button
                onClick={closeCart}
                className="btn-outline w-full"
              >
                Seguir comprando
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
