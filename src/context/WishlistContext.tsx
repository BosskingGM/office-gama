"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

// Favoritos:
//  - Con sesión: viven en la tabla "wishlist" (se ven desde cualquier dispositivo).
//  - Sin sesión: se guardan en este navegador y, al iniciar sesión, se pasan
//    solos a la cuenta del cliente.

const KEY = "og-wishlist";

type WishlistCtx = {
  ids: string[];
  count: number;
  hydrated: boolean;
  loggedIn: boolean;
  isFav: (productId: string) => boolean;
  toggle: (productId: string) => Promise<boolean>;
};

const Ctx = createContext<WishlistCtx | null>(null);

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* modo privado o sin espacio: no pasa nada */
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const idsRef = useRef<string[]>([]);
  const userRef = useRef<string | null>(null);
  const run = useRef(0);

  const commit = useCallback((next: string[]) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  const sync = useCallback(
    async (uid: string | null) => {
      const mine = ++run.current;
      userRef.current = uid;
      setUserId(uid);

      if (!uid) {
        commit(readLocal());
        setHydrated(true);
        return;
      }

      // Pasa a la cuenta lo que guardó como invitado
      const local = readLocal();
      if (local.length) {
        const { error } = await supabase
          .from("wishlist")
          .upsert(
            local.map((product_id) => ({ user_id: uid, product_id })),
            { onConflict: "user_id,product_id", ignoreDuplicates: true }
          );
        if (!error) writeLocal([]);
        else console.error("No se pudieron pasar los favoritos:", error.message);
      }

      const { data, error } = await supabase
        .from("wishlist")
        .select("product_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (mine !== run.current) return; // llegó una sesión más nueva
      if (error) {
        console.error("Error al cargar favoritos:", error.message);
        commit(readLocal());
      } else {
        commit((data ?? []).map((r) => String(r.product_id)));
      }
      setHydrated(true);
    },
    [commit]
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fuera del callback para no bloquear el cliente de Supabase
      setTimeout(() => sync(session?.user?.id ?? null), 0);
    });
    return () => subscription.unsubscribe();
  }, [sync]);

  const toggle = useCallback(
    async (productId: string) => {
      const had = idsRef.current.includes(productId);
      const next = had
        ? idsRef.current.filter((x) => x !== productId)
        : [productId, ...idsRef.current];
      commit(next);

      const uid = userRef.current;
      if (!uid) {
        writeLocal(next);
        return !had;
      }

      const { error } = had
        ? await supabase
            .from("wishlist")
            .delete()
            .eq("user_id", uid)
            .eq("product_id", productId)
        : await supabase
            .from("wishlist")
            .insert({ user_id: uid, product_id: productId });

      // 23505 = ya estaba guardado: no es un error real
      if (error && error.code !== "23505") {
        console.error("Error al actualizar favoritos:", error.message);
        commit(
          had
            ? [productId, ...idsRef.current.filter((x) => x !== productId)]
            : idsRef.current.filter((x) => x !== productId)
        );
        return had;
      }
      return !had;
    },
    [commit]
  );

  const value = useMemo<WishlistCtx>(
    () => ({
      ids,
      count: ids.length,
      hydrated,
      loggedIn: !!userId,
      isFav: (id: string) => ids.includes(id),
      toggle,
    }),
    [ids, hydrated, userId, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist debe usarse dentro de WishlistProvider");
  return ctx;
}
