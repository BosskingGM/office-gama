"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import Image from "next/image";

interface Variant {
  id: string;
  model_name: string;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

interface Props {
  product: Product;
  variants: Variant[];
}

export default function ProductoClient({
  product,
  variants,
}: Props) {
  const { addToCart } = useCart();

  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  const selectedVariant = variants.find(
    (v) => v.id === selectedVariantId
  );

  // 🔥 Cuando cambia la variante, SIEMPRE reinicia cantidad
  useEffect(() => {
    if (!selectedVariant) {
      setQuantity(1);
      return;
    }

    if (selectedVariant.stock === 0) {
      setQuantity(0);
    } else {
      setQuantity(1); // siempre empezar en 1 al cambiar variante
    }
  }, [selectedVariantId]);

  const increaseQuantity = () => {
    if (!selectedVariant) return;

    setQuantity((prev) => {
      if (prev >= selectedVariant.stock) return prev;
      return prev + 1;
    });
  };

  const decreaseQuantity = () => {
    setQuantity((prev) => {
      if (prev <= 1) return 1;
      return prev - 1;
    });
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    if (selectedVariant.stock === 0) return;
    if (quantity > selectedVariant.stock) return;

    addToCart({
      product_id: product.id,
      variant_id: selectedVariant.id,
      name: product.name,
      model_name: selectedVariant.model_name,
      price: product.price,
      quantity,
      stock: selectedVariant.stock,
    } as any);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* Imagen */}
            <div className="lg:w-1/2">
              <div className="relative w-full aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Información */}
            <div className="lg:w-1/2 flex flex-col">

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black mb-4">
                {product.name}
              </h1>

              <p className="text-pink-600 font-bold text-2xl mb-6">
                ${product.price} MXN
              </p>

              {/* Variantes */}
              <label className="block font-semibold text-black mb-3">
                Selecciona modelo:
              </label>

              <div className="flex gap-3 flex-wrap mb-6">
                {variants.map((variant) => {
                  const isSelected =
                    selectedVariantId === variant.id;
                  const isOut = variant.stock === 0;

                  return (
                    <button
                      key={variant.id}
                      onClick={() =>
                        !isOut && setSelectedVariantId(variant.id)
                      }
                      disabled={isOut}
                      className={`
                        px-4 py-2 rounded-full border transition text-sm
                        ${
                          isSelected
                            ? "bg-pink-500 text-white border-pink-500"
                            : "bg-white text-black border-gray-300"
                        }
                        ${
                          isOut
                            ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "hover:border-pink-400"
                        }
                      `}
                    >
                      {variant.model_name}{" "}
                      {isOut
                        ? "(Agotado)"
                        : `(${variant.stock})`}
                    </button>
                  );
                })}
              </div>

              {/* Stock */}
              {selectedVariant && (
                <p className="mb-4 font-semibold text-black">
                  Stock disponible:{" "}
                  <span className="text-pink-600">
                    {selectedVariant.stock}
                  </span>
                </p>
              )}

              {/* Cantidad */}
              {selectedVariant && selectedVariant.stock > 0 && (
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={decreaseQuantity}
                    className="w-10 h-10 border rounded-lg"
                  >
                    -
                  </button>

                  <span className="font-semibold text-lg">
                    {quantity}
                  </span>

                  <button
                    onClick={increaseQuantity}
                    disabled={
                      quantity >= selectedVariant.stock
                    }
                    className="w-10 h-10 border rounded-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Botón */}
              <button
                onClick={handleAddToCart}
                disabled={
                  !selectedVariant ||
                  selectedVariant.stock === 0 ||
                  quantity === 0
                }
                className="
                  w-full 
                  bg-pink-500 
                  hover:bg-pink-600 
                  text-white 
                  py-3 
                  rounded-xl 
                  font-semibold 
                  transition 
                  disabled:bg-gray-400
                "
              >
                Agregar al carrito
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}