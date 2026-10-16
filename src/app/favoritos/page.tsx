"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWishlist } from "@/context/WishlistContext";
import ProductCard from "@/components/ProductCard";

type Variant = {
  id: string;
  image_url?: string | null;
  model_name?: string | null;
  stock?: number | null;
};
type Product = {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  product_variants?: Variant[];
};

// Pública a propósito: un invitado también puede ver sus favoritos
// (se guardan en su navegador y pasan a su cuenta al iniciar sesión).
export default function FavoritosPage() {
  const { ids, hydrated, loggedIn } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Se vuelve a pedir solo cuando cambia la LISTA de productos guardados
  const key = useMemo(() => [...ids].sort().join(","), [ids]);

  useEffect(() => {
    if (!hydrated) return;
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, category, product_variants ( id, image_url, model_name, stock )"
        )
        .in("id", ids);
      if (!alive) return;
      if (error) {
        console.error(error);
        setFailed(true);
      } else {
        setFailed(false);
        setProducts((data ?? []) as Product[]);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);

  // Los más recientes primero; los que ya no existen se omiten
  const shown = useMemo(() => {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
  }, [ids, products]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Mis favoritos</h1>
          <p className="text-sm text-muted mt-1">
            Guarda lo que te gustó y cómpralo cuando quieras.
          </p>
        </div>
        {shown.length > 0 && (
          <p className="text-sm text-muted shrink-0">
            {shown.length} {shown.length === 1 ? "producto" : "productos"}
          </p>
        )}
      </div>

      {hydrated && !loggedIn && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-brand-soft border-0">
          <p className="text-sm flex-1">
            Tus favoritos se guardan en este dispositivo. Inicia sesión o crea
            tu cuenta para verlos desde cualquier lugar.
          </p>
          <div className="flex gap-2">
            <Link href="/login?next=/favoritos" className="btn-outline text-sm py-2!">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="btn-primary text-sm py-2!">
              Crear cuenta
            </Link>
          </div>
        </div>
      )}

      {!hydrated || loading ? (
        <div className="py-20 grid place-items-center text-muted">
          <Loader2 className="animate-spin" aria-label="Cargando favoritos" />
        </div>
      ) : failed ? (
        <p role="alert" className="card p-6 text-center text-danger">
          No pudimos cargar tus favoritos. Intenta de nuevo en un momento.
        </p>
      ) : shown.length === 0 ? (
        <div className="card p-10 sm:p-14 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-soft grid place-items-center">
            <Heart className="text-brand-strong" size={28} aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-lg">Aún no tienes favoritos</p>
            <p className="text-sm text-muted mt-1">
              Toca el corazón de cualquier producto para guardarlo aquí.
            </p>
          </div>
          <Link href="/" className="btn-primary inline-flex">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
