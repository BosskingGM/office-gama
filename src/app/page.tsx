"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        product_variants (
          id,
          image_url
        )
      `);

    if (!error && data) {
      setProducts(data);
    }
  };

  const filteredProducts =
    search.trim() === ""
      ? products
      : products.filter((product) =>
          product.name.toLowerCase().includes(search.toLowerCase())
        );

  return (
    <div className="min-h-screen bg-white">

      {/* Contenedor profesional centrado */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* 🔍 Buscador */}
        <div className="mb-8 flex justify-center sm:justify-start">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full 
              sm:w-96
              border 
              border-gray-300 
              rounded-xl 
              px-4 
              py-3 
              text-black
              focus:outline-none 
              focus:ring-2 
              focus:ring-pink-500
              transition
            "
          />
        </div>

        {/* 🛍 Grid Responsive Profesional */}
        <div className="
          grid 
          grid-cols-1 
          sm:grid-cols-2 
          lg:grid-cols-3 
          xl:grid-cols-4 
          gap-6
        ">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>

      </div>
    </div>
  );
}