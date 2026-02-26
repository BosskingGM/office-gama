"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import { useCart } from "@/context/CartContext";

export default function ProductPage() {
  const params = useParams();
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
      setSelectedVariant(variantsData?.[0]);
    };

    fetchData();
  }, [id]);

  if (!product || !selectedVariant) return null;

  const handleAddToCart = () => {
    addToCart({
      product_id: product.id,
      variant_id: selectedVariant.id,
      name: product.name,
      model_name: selectedVariant.model_name,
      price: product.price,
      quantity: quantity,
      stock: selectedVariant.stock,
    });

    setAdded(true);
    setQuantity(1);

    setTimeout(() => {
      setAdded(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-5xl mx-auto grid md:grid-cols-2 gap-10">

        <img
          src={selectedVariant.image_url}
          className="rounded-xl w-full object-cover"
        />

        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-black">
            {product.name}
          </h1>

          <p className="text-2xl font-bold text-pink-600">
            ${(product.price * quantity).toFixed(2)} MXN
          </p>

          <div className="flex gap-3 flex-wrap">
            {variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                className={`px-4 py-2 rounded-lg border transition ${
                  selectedVariant.id === variant.id
                    ? "bg-pink-500 text-white"
                    : "bg-white text-black hover:bg-pink-100"
                }`}
              >
                {variant.model_name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setQuantity((prev) => (prev > 1 ? prev - 1 : 1))
              }
              className="bg-pink-100 text-pink-600 hover:bg-pink-500 hover:text-white transition px-4 py-2 rounded-lg font-bold"
            >
              −
            </button>

            <span className="text-xl font-semibold text-black">
              {quantity}
            </span>

            <button
              onClick={() =>
                setQuantity((prev) =>
                  prev < selectedVariant.stock ? prev + 1 : prev
                )
              }
              className="bg-pink-100 text-pink-600 hover:bg-pink-500 hover:text-white transition px-4 py-2 rounded-lg font-bold"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={added}
            className={`px-6 py-3 rounded-xl w-full font-semibold transition ${
              added
                ? "bg-green-500 text-white"
                : "bg-pink-500 hover:bg-pink-600 text-white"
            }`}
          >
            {added ? "✔ Agregado al carrito" : "Agregar al carrito"}
          </button>

        </div>
      </div>
    </div>
  );
}