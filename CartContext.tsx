"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

export type CartItem = {
  product_id: string;
  variant_id: string;
  name: string;
  model_name: string;
  price: number;
  quantity: number;
  stock: number;
  image_url?: string;
};

type CartContextType = {
  cart: CartItem[];
  /** Total de piezas (suma de cantidades), para el globo del carrito */
  count: number;
  /** Suma de productos, sin envío */
  subtotal: number;
  /** false hasta leer el carrito guardado; evita parpadeos y "carrito vacío" falso */
  hydrated: boolean;

  /** Devuelve true si se agregó al menos 1 pieza (respeta el stock) */
  addToCart: (item: CartItem) => boolean;
  removeFromCart: (variant_id: string) => void;
  increaseQuantity: (variant_id: string) => void;
  decreaseQuantity: (variant_id: string) => void;
  clearCart: () => void;

  /** Carrito lateral */
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;

  /**
   * Actualiza precio, stock y foto desde la base de datos y quita lo que ya
   * no existe o se agotó. Devuelve los nombres de los productos que se
   * quitaron o cambiaron, para avisarle al cliente.
   */
  syncCart: () => Promise<{ removed: string[]; adjusted: string[] }>;
};

const STORAGE_KEY = "officegama_cart";

const CartContext = createContext<CartContextType | undefined>(undefined);

function isValidItem(x: any): x is CartItem {
  return (
    x &&
    typeof x.variant_id === "string" &&
    typeof x.product_id === "string" &&
    typeof x.name === "string" &&
    typeof x.price === "number" &&
    Number.isFinite(x.price) &&
    Number.isInteger(x.quantity) &&
    x.quantity > 0
  );
}

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem).map((i) => ({
      ...i,
      model_name: i.model_name ?? "",
      stock: Number.isFinite(i.stock) ? i.stock : i.quantity,
    }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Cargar carrito al iniciar
  useEffect(() => {
    setCart(readStorage());
    setHydrated(true);
  }, []);

  // Guardar cuando cambie (solo después de haber leído, para no borrarlo)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* modo privado o almacenamiento lleno: el carrito sigue en memoria */
    }
  }, [cart, hydrated]);

  // Sincronizar entre pestañas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCart(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Cerrar el carrito lateral con Escape y bloquear el scroll del fondo
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const addToCart = useCallback(
    (item: CartItem) => {
      const room = (list: CartItem[]) => {
        const already =
          list.find((p) => p.variant_id === item.variant_id)?.quantity ?? 0;
        return Math.max(0, Math.min(item.quantity, item.stock - already));
      };

      // El resultado se calcula contra el carrito actual para poder avisar
      // de inmediato si no cupo nada (sin stock o ya tiene el máximo).
      if (room(cart) === 0) return false;

      setCart((prev) => {
        const canAdd = room(prev);
        if (canAdd === 0) return prev;

        const existing = prev.find((p) => p.variant_id === item.variant_id);
        if (existing) {
          return prev.map((p) =>
            p.variant_id === item.variant_id
              ? {
                  ...p,
                  quantity: p.quantity + canAdd,
                  stock: item.stock,
                  price: item.price,
                }
              : p
          );
        }
        return [...prev, { ...item, quantity: canAdd }];
      });
      return true;
    },
    [cart]
  );

  const increaseQuantity = useCallback((variant_id: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.variant_id === variant_id && item.quantity < item.stock
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }, []);

  const decreaseQuantity = useCallback((variant_id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variant_id === variant_id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((variant_id: string) => {
    setCart((prev) => prev.filter((item) => item.variant_id !== variant_id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nada */
    }
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const syncCart = useCallback(async () => {
    const removed: string[] = [];
    const adjusted: string[] = [];
    if (cart.length === 0) return { removed, adjusted };

    const { data, error } = await supabase
      .from("product_variants")
      .select("id, stock, model_name, image_url, products ( id, name, price )")
      .in(
        "id",
        cart.map((i) => i.variant_id)
      );

    // Si falla la consulta no tocamos el carrito: el servidor valida al pagar.
    if (error || !data) return { removed, adjusted };

    const fresh = new Map<string, any>(data.map((v: any) => [v.id, v] as [string, any]));

    setCart((prev) =>
      prev.flatMap((item) => {
        const v = fresh.get(item.variant_id);
        const product = Array.isArray(v?.products) ? v.products[0] : v?.products;

        if (!v || !product || v.stock <= 0) {
          removed.push(item.name);
          return [];
        }

        const quantity = Math.min(item.quantity, v.stock);
        const price = Number(product.price);

        if (quantity !== item.quantity || price !== item.price) {
          adjusted.push(item.name);
        }

        return [
          {
            ...item,
            name: product.name,
            model_name: v.model_name ?? item.model_name,
            image_url: v.image_url ?? item.image_url,
            price,
            stock: v.stock,
            quantity,
          },
        ];
      })
    );

    return { removed, adjusted };
  }, [cart]);

  const { count, subtotal } = useMemo(
    () => ({
      count: cart.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
    }),
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        count,
        subtotal,
        hydrated,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        isOpen,
        openCart,
        closeCart,
        syncCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
