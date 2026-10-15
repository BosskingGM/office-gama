"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";

type Variant = { id: string; image_url?: string | null; stock?: number | null };
type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  product_variants?: Variant[];
};

const PAGE_SIZE = 12;

const SORTS = {
  default: "Destacados",
  "price-asc": "Precio: menor a mayor",
  "price-desc": "Precio: mayor a menor",
  name: "Nombre: A-Z",
} as const;
type SortKey = keyof typeof SORTS;

const PRICE_RANGES = [
  { key: "all", label: "Cualquier precio", min: 0, max: Infinity },
  { key: "p1", label: "Hasta $50", min: 0, max: 50 },
  { key: "p2", label: "$50 a $100", min: 50, max: 100 },
  { key: "p3", label: "$100 a $200", min: 100, max: 200 },
  { key: "p4", label: "Más de $200", min: 200, max: Infinity },
] as const;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const isSoldOut = (p: Product) => {
  const v = p.product_variants ?? [];
  return (
    v.length > 0 && v.every((x) => typeof x.stock === "number" && x.stock <= 0)
  );
};

export default function Catalog({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("default");
  const [priceKey, setPriceKey] = useState<string>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Solo categorías que sí tienen productos, con su conteo
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.category) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [products]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    const range = PRICE_RANGES.find((r) => r.key === priceKey)!;

    const list = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (q && !normalize(p.name).includes(q)) return false;
      const price = Number(p.price);
      if (price < range.min || price > range.max) return false;
      if (onlyAvailable && isSoldOut(p)) return false;
      return true;
    });

    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "name")
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    else if (sort === "default")
      // Los agotados al final; el resto conserva el orden original
      list.sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));

    return list;
  }, [products, search, category, sort, priceKey, onlyAvailable]);

  const shown = filtered.slice(0, visible);
  const hasFilters =
    !!search || !!category || priceKey !== "all" || onlyAvailable;

  const reset = () => {
    setSearch("");
    setCategory(null);
    setPriceKey("all");
    setOnlyAvailable(false);
    setSort("default");
    setVisible(PAGE_SIZE);
  };

  // Cualquier cambio de filtro regresa a la primera tanda
  const withReset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setVisible(PAGE_SIZE);
    };

  return (
    <div className="space-y-6">
      {/* Categorías */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Explora por categoría</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => withReset(setCategory)(null)}
            aria-pressed={category === null}
            className={`chip ${category === null ? "chip-active" : ""}`}
          >
            Todo ({products.length})
          </button>
          {categories.map(([cat, n]) => (
            <button
              key={cat}
              onClick={() => withReset(setCategory)(category === cat ? null : cat)}
              aria-pressed={category === cat}
              className={`chip ${category === cat ? "chip-active" : ""}`}
            >
              {cat} <span className="opacity-60">({n})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative w-full lg:flex-1 lg:max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none z-10"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            placeholder="Buscar productos…"
            aria-label="Buscar productos"
            className="field rounded-full! pl-11 pr-4 py-2.5! [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:flex lg:flex-wrap lg:gap-3 lg:items-center">
          <select
            value={priceKey}
            onChange={(e) => withReset(setPriceKey)(e.target.value)}
            aria-label="Filtrar por precio"
            className="field w-full! lg:w-auto! min-w-0 rounded-full! py-2.5! px-4! pr-8! text-sm! truncate"
          >
            {PRICE_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Ordenar productos"
            className="field w-full! lg:w-auto! min-w-0 rounded-full! py-2.5! px-4! pr-8! text-sm! truncate"
          >
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => withReset(setOnlyAvailable)(e.target.checked)}
              className="w-4 h-4 accent-[#7e22ce]"
            />
            Solo disponibles
          </label>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex items-center justify-between gap-3 min-h-8" aria-live="polite">
        <p className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
        </p>
        {hasFilters && (
          <button
            onClick={reset}
            className="text-sm text-brand-strong font-medium inline-flex items-center gap-1 hover:underline"
          >
            <X size={14} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Resultados */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <SearchX size={36} className="mx-auto text-brand-strong" />
          <p className="font-semibold text-lg">No encontramos productos</p>
          <p className="text-sm text-muted">
            Prueba con otra búsqueda o quita algunos filtros.
          </p>
          <button onClick={reset} className="btn-primary mt-2">
            Ver todo el catálogo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {shown.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filtered.length > shown.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="btn-outline px-8"
              >
                Mostrar más ({filtered.length - shown.length} restantes)
              </button>
            </div>
          )}
        </>
      )}

      {/* Estilos de las categorías (chips) */}
      <style>{`
        .chip {
          flex-shrink: 0;
          white-space: nowrap;
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 500;
          background: #fff;
          border: 1.5px solid var(--border-soft);
          color: var(--text-secondary);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .chip:hover { border-color: var(--primary); background: var(--primary-soft); }
        .chip-active, .chip-active:hover {
          background: var(--primary);
          border-color: var(--primary);
          color: #1a1523;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
