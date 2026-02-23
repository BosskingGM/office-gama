"use client";

import { createContext, useContext, useState } from "react";

type CartItem = {
  product_id: string;     // 👈 AGREGA ESTO
  variant_id: string;
  name: string;
  model_name: string;
  price: number;
  quantity: number;
  stock: number;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (variant_id: string) => void;
  increaseQuantity: (variant_id: string) => void;
  decreaseQuantity: (variant_id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.variant_id === item.variant_id);

      if (existing) {
        if (existing.quantity + item.quantity > existing.stock) {
          alert("No hay suficiente stock disponible");
          return prev;
        }

        return prev.map((p) =>
          p.variant_id === item.variant_id
            ? { ...p, quantity: p.quantity + item.quantity }
            : p
        );
      }

      return [...prev, item];
    });
  };

  const increaseQuantity = (variant_id: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.variant_id === variant_id) {
          if (item.quantity >= item.stock) {
            alert("Stock máximo alcanzado");
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQuantity = (variant_id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variant_id === variant_id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (variant_id: string) => {
    setCart((prev) =>
      prev.filter((item) => item.variant_id !== variant_id)
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
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