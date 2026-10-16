"use client";

import { useState } from "react";
import { Check, ImageOff, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";

type Variant = {
  id: string;
  model_name: string | null;
  image_url: string | null;
  stock: number | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
};

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function ProductDetail({
  product,
  variants,
}: {
  product: Product;
  variants: Variant[];
}) {
  const { addToCart, openCart } = useCart();

  // Empieza en el primer modelo con existencias (o el primero, si todos están agotados)
  const [selectedId, setSelectedId] = useState<string | null>(
    (variants.find((v) => (v.stock ?? 0) > 0) ?? variants[0])?.id ?? null
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const stock = selected?.stock ?? 0;
  const soldOut = stock <= 0;
  const withPhoto = variants.filter((v) => v.image_url);

  const selectVariant = (id: string) => {
    setSelectedId(id);
    setQuantity(1);
    setError("");
  };

  const setQty = (n: number) => {
    if (!Number.isFinite(n)) return;
    setQuantity(Math.min(Math.max(1, Math.floor(n)), Math.max(stock, 1)));
    setError("");
  };

  const handleAdd = () => {
    if (!selected || soldOut) return;

    const ok = addToCart({
      product_id: product.id,
      variant_id: selected.id,
      name: product.name,
      model_name: selected.model_name ?? "",
      price: product.price,
      quantity,
      stock,
      image_url: selected.image_url ?? undefined,
    });

    if (!ok) {
      setError(
        "Ya tienes en tu carrito todas las piezas disponibles de este modelo."
      );
      openCart();
      return;
    }

    setAdded(true);
    setQuantity(1);
    setTimeout(() => setAdded(false), 2000);
    openCart();
  };

  return (
    <div className="card p-3 sm:p-8 lg:p-10">
      <div className="grid md:grid-cols-2 gap-5 sm:gap-8 lg:gap-14 items-start">
        {/* GALERÍA */}
        <div className="space-y-3 md:sticky md:top-28">
          <div className="relative aspect-[5/4] sm:aspect-square rounded-2xl overflow-hidden bg-brand-soft border border-line">
            {selected?.image_url ? (
              <img
                src={selected.image_url}
                alt={`${product.name}${
                  selected.model_name ? ` - ${selected.model_name}` : ""
                }`}
                className={`w-full h-full object-cover ${
                  soldOut ? "opacity-60 grayscale-[40%]" : ""
                }`}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-neutral-400">
                <ImageOff size={40} />
              </div>
            )}
            {soldOut && (
              <span className="absolute top-4 left-4 bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                Agotado
              </span>
            )}
          </div>

          {withPhoto.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {withPhoto.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVariant(v.id)}
                  aria-label={`Ver modelo ${v.model_name ?? ""}`}
                  aria-pressed={v.id === selectedId}
                  className={`shrink-0 w-14 h-14 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition ${
                    v.id === selectedId
                      ? "border-brand-strong"
                      : "border-transparent hover:border-brand"
                  }`}
                >
                  <img
                    src={v.image_url!}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFORMACIÓN */}
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            {product.category && (
              <span className="inline-block bg-brand-soft text-brand-strong text-xs px-3.5 py-1.5 rounded-full font-semibold">
                {product.category}
              </span>
            )}
            <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">
              {product.name}
            </h1>
          </div>

          <div>
            <p className="text-2xl sm:text-3xl font-bold">{money(product.price)}</p>
            {quantity > 1 && (
              <p className="text-sm text-muted mt-1">
                {quantity} piezas: {money(product.price * quantity)}
              </p>
            )}
          </div>

          {product.description && (
            <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* Modelos */}
          {variants.length > 0 && (
            <fieldset>
              <legend className="font-semibold text-sm mb-3">
                Modelo
                {selected?.model_name && (
                  <span className="font-normal text-muted">
                    : {selected.model_name}
                  </span>
                )}
              </legend>
              <div className="flex gap-2.5 flex-wrap">
                {variants.map((v) => {
                  const out = (v.stock ?? 0) <= 0;
                  const active = v.id === selectedId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => selectVariant(v.id)}
                      aria-pressed={active}
                      className={`px-4 py-2 text-sm rounded-full border-2 font-medium transition ${
                        active
                          ? "bg-brand border-brand text-ink"
                          : "bg-white border-line hover:border-brand"
                      } ${out ? "text-neutral-400 line-through" : ""}`}
                    >
                      {v.model_name || "Único"}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Disponibilidad */}
          <p
            className={`text-sm font-medium flex items-center gap-2 ${
              soldOut
                ? "text-danger"
                : stock <= 3
                ? "text-brand-strong"
                : "text-ok"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                soldOut ? "bg-danger" : stock <= 3 ? "bg-brand-strong" : "bg-ok"
              }`}
            />
            {soldOut
              ? "Agotado por ahora"
              : stock <= 3
              ? stock === 1
                ? "Queda 1 pieza"
                : `Quedan ${stock} piezas`
              : "Disponible"}
          </p>

          {/* Cantidad y compra */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <div
              className={`flex items-center border-2 border-line rounded-full self-start ${
                soldOut ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              <button
                onClick={() => setQty(quantity - 1)}
                disabled={quantity <= 1}
                aria-label="Menos"
                className="w-11 h-11 grid place-items-center rounded-full hover:bg-brand-soft disabled:opacity-30 transition"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(stock, 1)}
                value={quantity}
                onChange={(e) => setQty(Number(e.target.value))}
                aria-label="Cantidad"
                className="w-12 text-center font-semibold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQty(quantity + 1)}
                disabled={quantity >= stock}
                aria-label="Más"
                className="w-11 h-11 grid place-items-center rounded-full hover:bg-brand-soft disabled:opacity-30 transition"
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={soldOut || !selected}
              className={`btn-primary flex-1 text-base py-3.5 ${
                added ? "bg-ok! text-white" : ""
              }`}
            >
              {added ? (
                <>
                  <Check size={20} /> Agregado
                </>
              ) : (
                <>
                  <ShoppingBag size={20} />{" "}
                  {soldOut ? "No disponible" : "Agregar al carrito"}
                </>
              )}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-start gap-3 text-sm text-neutral-600 bg-peach-soft border border-peach rounded-2xl px-4 py-3.5">
            <Truck size={18} className="shrink-0 mt-0.5 text-brand-strong" />
            <p>
              Recoge gratis en tienda, entrega local (solo Chalco e Ixtapaluca) o paquetería a todo México.
              El costo se calcula al pagar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
