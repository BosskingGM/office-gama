"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [hideLogo, setHideLogo] = useState(false);
  const { cart } = useCart();

  useEffect(() => {
    // 🔥 Ocultar logo si animación está corriendo
    if (typeof window !== "undefined") {
      const playing = sessionStorage.getItem("homeIntroPlaying");
      if (playing) {
        setHideLogo(true);

        const check = setInterval(() => {
          const stillPlaying = sessionStorage.getItem("homeIntroPlaying");
          if (!stillPlaying) {
            setHideLogo(false);
            clearInterval(check);
          }
        }, 100);
      }
    }

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.role === "admin");
      } else {
        setIsAdmin(false);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <>
      {/* NAVBAR */}
      <nav className="w-full bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">

            {/* LOGO */}
            <Link href="/" className="flex items-center">
              {!hideLogo && (
                <img
                  src="/logo2.png"
                  alt="Office Gama"
                  className="h-12 sm:h-14 w-auto object-contain transition duration-200 hover:scale-[1.03]"
                />
              )}
            </Link>

            {/* DESKTOP */}
            <div className="hidden md:flex gap-8 items-center text-neutral-800 font-medium">

              <Link href="/" className="hover:text-[#d6a8ff] transition duration-200">
                Inicio
              </Link>

              <Link href="/carrito" className="relative text-xl">
                🛒
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-3 bg-[#d6a8ff] text-black text-xs px-2 py-0.5 rounded-full font-semibold shadow-sm">
                    {cart.length}
                  </span>
                )}
              </Link>

              <Link href="/cuenta" className="hover:text-[#d6a8ff] transition duration-200">
                Mis pedidos
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-xl border border-neutral-200 hover:border-[#d6a8ff] hover:bg-[#f3e8ff] transition duration-200"
                >
                  Admin
                </Link>
              )}

              {user ? (
                <>
                  <span className="text-sm text-neutral-600 max-w-[160px] truncate">
                    {user.email}
                  </span>

                  <button
                    onClick={handleLogout}
                    className="text-sm text-neutral-600 hover:text-neutral-900 transition"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-[#d6a8ff] transition duration-200">
                    Login
                  </Link>

                  <Link
                    href="/registro"
                    className="px-4 py-2 rounded-xl bg-[#d6a8ff] text-black hover:opacity-90 transition duration-200"
                  >
                    Registro
                  </Link>
                </>
              )}
            </div>

            {/* MOBILE BUTTON */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden text-2xl text-neutral-800"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      {open && (
        <div className="fixed inset-0 z-[999] md:hidden">

          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl p-6 space-y-6">

            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-neutral-900">
                Menú
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 text-xl hover:text-neutral-900 transition"
              >
                ✕
              </button>
            </div>

            <div className="border-t border-neutral-200" />

            <div className="space-y-4 text-neutral-800 font-medium">
              <Link href="/" onClick={() => setOpen(false)} className="block">
                Inicio
              </Link>

              <Link href="/carrito" onClick={() => setOpen(false)} className="block">
                Carrito ({cart.length})
              </Link>

              <Link href="/cuenta" onClick={() => setOpen(false)} className="block">
                Mis pedidos
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block border border-neutral-200 px-4 py-2 rounded-xl text-center hover:bg-[#f3e8ff] transition"
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="border-t border-neutral-200 pt-4 space-y-3">
              {user ? (
                <>
                  <span className="block text-sm text-neutral-600 break-all">
                    {user.email}
                  </span>
                  <button
                    onClick={() => {
                      handleLogout();
                      setOpen(false);
                    }}
                    className="text-sm text-neutral-600 hover:text-neutral-900 transition"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="block">
                    Login
                  </Link>

                  <Link
                    href="/registro"
                    onClick={() => setOpen(false)}
                    className="block bg-[#d6a8ff] text-black px-4 py-2 rounded-xl text-center"
                  >
                    Registro
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}