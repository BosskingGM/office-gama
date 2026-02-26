"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    "Sacapuntas",
    "Libretas",
    "Washi Tapes",
    "Stickers",
    "Tintas",
    "Sellos",
    "Post It",
    "Plumones",
    "Folders",
    "Plumas",
    "Pegamento",
    "Extras",
    "Marca Textos",
    "Cutters",
    "Lapiceras",
    "Crayolas",
    "Lacre",
    "Gises",
    "Colores",
    "Correctores",
    "Juegos Geométricos",
    "Liquidación",
  ];

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
        category,
        product_variants (
          id,
          image_url
        )
      `);

    if (!error && data) {
      setProducts(data);
    }
  };

  // 🔥 FILTRO COMBINADO (categoría + búsqueda)
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      search.trim() === "" ||
      product.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-white">

      {/* 🎀 HERO SECTION PREMIUM */}
      <div className="bg-gradient-to-r from-pink-100 to-pink-50 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-black">
            Papelería Importada ✨
          </h1>

          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Diseños únicos, calidad premium y artículos que no encontrarás en cualquier tienda.
          </p>

          <button
            onClick={() =>
              window.scrollTo({ top: 600, behavior: "smooth" })
            }
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-xl transition shadow-md"
          >
            Explorar catálogo
          </button>
        </div>
      </div>

      {/* 🏷️ CATEGORÍAS DESLIZABLES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <h2 className="text-xl font-semibold text-black mb-4">
          Categorías
        </h2>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat, index) => {
            const isActive = selectedCategory === cat;

            return (
              <div
                key={index}
                onClick={() =>
                  setSelectedCategory(
                    isActive ? null : cat
                  )
                }
                className={`
                  min-w-max
                  px-5
                  py-2
                  rounded-full
                  text-sm
                  font-medium
                  cursor-pointer
                  whitespace-nowrap
                  shadow-sm
                  transition
                  ${
                    isActive
                      ? "bg-pink-500 text-white"
                      : "bg-pink-50 text-black hover:bg-pink-500 hover:text-white"
                  }
                `}
              >
                {cat}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* 🔍 Buscador (NO MODIFICADO) */}
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

        {/* 🛍 GRID ORIGINAL */}
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