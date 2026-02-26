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

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      search.trim() === "" ||
      product.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#faf9ff]">

      {/* HERO PREMIUM */}
      <div className="py-24">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8">


          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 leading-tight">
            Papelería Importada
            <span className="block text-[#d6a8ff]">
              Diseño que inspira
            </span>
          </h1>

          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Diseños únicos, calidad premium y artículos cuidadosamente seleccionados
            para quienes valoran los detalles.
          </p>

          <button
            onClick={() =>
              window.scrollTo({ top: 700, behavior: "smooth" })
            }
            className="bg-[#d6a8ff] hover:opacity-90 text-black px-10 py-4 rounded-2xl font-semibold shadow-md transition"
          >
            Explorar catálogo
          </button>
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <h2 className="text-xl font-semibold text-neutral-900 mb-6">
          Categorías
        </h2>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {categories.map((cat, index) => {
            const isActive = selectedCategory === cat;

            return (
              <div
                key={index}
                onClick={() =>
                  setSelectedCategory(isActive ? null : cat)
                }
                className={`
                  min-w-max
                  px-6
                  py-2
                  rounded-full
                  text-sm
                  font-medium
                  cursor-pointer
                  whitespace-nowrap
                  border
                  transition
                  ${
                    isActive
                      ? "bg-[#d6a8ff] text-black border-[#d6a8ff]"
                      : "bg-white text-neutral-700 border-neutral-200 hover:border-[#d6a8ff] hover:text-neutral-900"
                  }
                `}
              >
                {cat}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-6 pb-20">

        {/* BUSCADOR */}
        <div className="mb-10 flex justify-center sm:justify-start">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full
              sm:w-96
              border
              border-neutral-300
              rounded-2xl
              px-5
              py-3
              text-neutral-900
              bg-white
              focus:outline-none
              focus:ring-2
              focus:ring-[#d6a8ff]
              transition
            "
          />
        </div>

        {/* GRID */}
        <div className="
          grid
          grid-cols-2
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