"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { addToCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] =
    useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      const { data: variantsData } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id);

      setProduct(productData);
      setVariants(variantsData || []);
      setSelectedVariant(variantsData?.[0] || null);
      setQuantity(1);
    };

    fetchData();
  }, [id]);

  // 🔥 Ajustar cantidad automáticamente cuando cambia variante
  useEffect(() => {
    if (!selectedVariant) return;

    if (selectedVariant.stock === 0) {
      setQuantity(1);
      return;
    }

    if (quantity > selectedVariant.stock) {
      setQuantity(selectedVariant.stock);
    }
  }, [selectedVariant]);

  if (!product || !selectedVariant) return null;

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
      quantity: quantity,
      stock: selectedVariant.stock,
      image_url: selectedVariant.image_url,
    });

    setAdded(true);
    setQuantity(1);

    setTimeout(() => {
      setAdded(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] px-4 py-10">
      <div className="max-w-6xl mx-auto">

        <button
          onClick={() => router.back()}
          className="mb-8 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition flex items-center gap-2"
        >
          ← Volver al catálogo
        </button>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-10">
          <div className="grid md:grid-cols-2 gap-12 items-start">

            {/* IMAGEN */}
            <div className="flex justify-center">
              <div className="w-4/5 sm:w-full rounded-2xl overflow-hidden border border-neutral-200">
                <img
                  src={selectedVariant.image_url}
                  className="w-full object-cover transition duration-700 hover:scale-105"
                />
              </div>
            </div>

            {/* CONTENIDO */}
            <div className="space-y-6">

              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900">
                  {product.name}
                </h1>

                {product.category && (
                  <span className="inline-block mt-3 bg-[#f3e8ff] text-neutral-800 text-xs px-4 py-1.5 rounded-full font-medium">
                    {product.category}
                  </span>
                )}
              </div>

              <p className="text-3xl font-semibold text-neutral-900">
                ${(product.price * quantity).toFixed(2)} MXN
              </p>

              {product.description && (
                <p className="text-neutral-600 leading-relaxed text-sm sm:text-base">
                  {product.description}
                </p>
              )}

              {/* VARIANTES */}
              <div>
                <p className="font-semibold text-sm text-neutral-900 mb-3">
                  Variantes
                </p>

                <div className="flex gap-3 flex-wrap">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(1); // 🔥 reset inmediato
                      }}
                      className={`px-4 py-2 text-sm rounded-xl border transition ${
                        selectedVariant.id === variant.id
                          ? "bg-[#d6a8ff] text-black border-[#d6a8ff]"
                          : "bg-white text-neutral-800 border-neutral-300 hover:border-[#d6a8ff]"
                      }`}
                    >
                      {variant.model_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* CANTIDAD */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() =>
                    setQuantity((prev) => (prev > 1 ? prev - 1 : 1))
                  }
                  className="border border-neutral-300 px-4 py-2 rounded-xl text-neutral-800 hover:bg-[#f3e8ff] transition"
                >
                  −
                </button>

                <span className="text-lg font-semibold text-neutral-900 w-8 text-center">
                  {quantity}
                </span>

                <button
                  onClick={() =>
                    setQuantity((prev) =>
                      prev < selectedVariant.stock ? prev + 1 : prev
                    )
                  }
                  disabled={quantity >= selectedVariant.stock}
                  className="border border-neutral-300 px-4 py-2 rounded-xl text-neutral-800 hover:bg-[#f3e8ff] transition disabled:opacity-40"
                >
                  +
                </button>
              </div>

              {/* BOTÓN AGREGAR */}
              <button
                onClick={handleAddToCart}
                disabled={
                  added ||
                  selectedVariant.stock === 0 ||
                  quantity === 0
                }
                className={`mt-4 px-6 py-4 rounded-2xl w-full font-semibold transition ${
                  added
                    ? "bg-neutral-900 text-white"
                    : "bg-[#d6a8ff] text-black hover:opacity-90"
                }`}
              >
                {added ? "Producto agregado" : "Agregar al carrito"}
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}