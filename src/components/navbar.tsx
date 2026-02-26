"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const { cart } = useCart();

  useEffect(() => {
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
    <nav className="w-full bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl sm:text-2xl font-bold text-pink-500">
            Office GaMa
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex gap-6 items-center text-black font-medium">
            <Link href="/" className="hover:text-pink-500 transition">
              Inicio
            </Link>

            <Link href="/carrito" className="relative text-xl">
              🛒
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-3 bg-pink-500 text-white text-xs px-2 rounded-full">
                  {cart.length}
                </span>
              )}
            </Link>

            <Link href="/cuenta" className="hover:text-pink-500 transition">
              Mi cuenta
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="bg-black text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
              >
                Admin
              </Link>
            )}

            {user ? (
              <>
                <span className="text-sm text-black">{user.email}</span>

                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:opacity-80 transition"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-pink-500 transition">
                  Login
                </Link>
                <Link href="/registro" className="hover:text-pink-500 transition">
                  Registro
                </Link>
              </>
            )}
          </div>

          {/* Mobile Button */}
          <button
            onClick={() => setOpen(true)}
            className="md:hidden text-2xl text-black"
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />

        {/* Panel */}
        <div
          className={`absolute right-0 top-0 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-6 space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-pink-500">
                Menú
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="border-t" />

            {/* Links */}
            <div className="space-y-4 text-black font-medium">

              <Link href="/" onClick={() => setOpen(false)} className="block hover:text-pink-500 transition">
                Inicio
              </Link>

              <Link href="/carrito" onClick={() => setOpen(false)} className="block hover:text-pink-500 transition">
                Carrito ({cart.length})
              </Link>

              <Link href="/cuenta" onClick={() => setOpen(false)} className="block hover:text-pink-500 transition">
                Mi cuenta
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block bg-pink-500 text-white px-4 py-2 rounded-lg text-center"
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">

              {user ? (
                <>
                  <span className="block text-xs text-gray-500 break-all">
                    {user.email}
                  </span>

                  <button
                    onClick={() => {
                      handleLogout();
                      setOpen(false);
                    }}
                    className="text-sm text-gray-500 hover:text-red-500 transition"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="block hover:text-pink-500 transition">
                    Login
                  </Link>
                  <Link href="/registro" onClick={() => setOpen(false)} className="block hover:text-pink-500 transition">
                    Registro
                  </Link>
                </>
              )}

            </div>

          </div>
        </div>
      </div>
    </nav>
  );
}