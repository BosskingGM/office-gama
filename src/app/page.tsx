"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PRODUCTS_PER_PAGE = 8;

  const categories = [
    "Sacapuntas","Libretas","Washi Tapes","Stickers","Tintas","Sellos",
    "Post It","Plumones","Folders","Plumas","Pegamento","Extras",
    "Marca Textos","Cutters","Lapiceras","Crayolas","Lacre","Gises",
    "Colores","Correctores","Juegos Geométricos","Liquidación",
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
        product_variants ( id, image_url )
      `);

    if (!error && data) setProducts(data);
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;

    const matchesSearch =
      search.trim() === "" ||
      product.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-[#faf9ff]">

      {/* HERO */}
      <div className="py-6 sm:py-10">
        <div className="max-w-3xl mx-auto px-5 text-center space-y-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-900 leading-snug">
            Papelería Importada
            <span className="block text-[#d6a8ff] font-semibold">
              Diseño que inspira
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto">
            Diseños únicos y artículos cuidadosamente seleccionados.
          </p>

          <button
            onClick={() =>
              window.scrollTo({ top: 700, behavior: "smooth" })
            }
            className="bg-[#d6a8ff] hover:opacity-90 text-black px-5 py-1.5 rounded-full text-xs font-medium transition"
          >
            Explorar catálogo
          </button>
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 mb-8">
        <h2 className="text-base font-semibold text-neutral-900 mb-4">
          Categorías
        </h2>

        <div className="flex gap-3 overflow-x-auto pb-3">
          {categories.map((cat, index) => {
            const isActive = selectedCategory === cat;

            return (
              <div
                key={index}
                onClick={() => {
                  setSelectedCategory(isActive ? null : cat);
                  setCurrentPage(1);
                }}
                className={`
                  min-w-max
                  px-4
                  py-1.5
                  rounded-full
                  text-xs
                  font-medium
                  cursor-pointer
                  whitespace-nowrap
                  border
                  transition
                  ${
                    isActive
                      ? "bg-[#d6a8ff] text-black border-[#d6a8ff]"
                      : "bg-white text-neutral-600 border-neutral-200 hover:border-[#d6a8ff]"
                  }
                `}
              >
                {cat}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-7xl mx-auto px-6 pb-20">

        <div className="mb-8 flex justify-center sm:justify-start">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="
              w-full
              sm:w-80
              border
              border-neutral-300
              rounded-full
              px-4
              py-2
              text-sm
              bg-white
              focus:outline-none
              focus:ring-1
              focus:ring-[#d6a8ff]
              transition
            "
          />
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {paginatedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* PAGINACIÓN MINIMAL */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-12">

            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="text-sm text-neutral-500 disabled:opacity-30 hover:text-neutral-900 transition"
            >
              ← Anterior
            </button>

            <span className="text-sm text-neutral-600">
              {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="text-sm text-neutral-500 disabled:opacity-30 hover:text-neutral-900 transition"
            >
              Siguiente →
            </button>

          </div>
        )}

      </div>

    </div>
  );
}