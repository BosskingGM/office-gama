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
    const getSessionAndRole = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single();

        setIsAdmin(profile?.role === "admin");
      } else {
        setIsAdmin(false);
      }
    };

    getSessionAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single();

        setIsAdmin(profile?.role === "admin");
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="w-full bg-white border-b shadow-sm sticky top-0 z-50">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link
            href="/"
            className="text-xl sm:text-2xl font-bold text-pink-500"
          >
            Office GaMa
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-6 items-center text-black font-medium">

            <Link href="/" className="hover:text-pink-500 transition">
              Inicio
            </Link>

            {/* Carrito */}
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
                <span className="text-sm text-black">
                  {user.email}
                </span>

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
            onClick={() => setOpen(!open)}
            className="md:hidden text-2xl text-black"
          >
            ☰
          </button>

        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white border-t px-6 py-6 space-y-4 text-black font-medium">

          <Link href="/" onClick={() => setOpen(false)} className="block">
            Inicio
          </Link>

          <Link href="/carrito" onClick={() => setOpen(false)} className="block">
            Carrito ({cart.length})
          </Link>

          <Link href="/cuenta" onClick={() => setOpen(false)} className="block">
            Mi cuenta
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block bg-black text-white px-4 py-2 rounded-lg text-center"
            >
              Admin
            </Link>
          )}

          {user ? (
            <>
              <span className="block text-sm">
                {user.email}
              </span>

              <button
                onClick={() => {
                  handleLogout();
                  setOpen(false);
                }}
                className="text-red-500"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="block">
                Login
              </Link>
              <Link href="/registro" onClick={() => setOpen(false)} className="block">
                Registro
              </Link>
            </>
          )}

        </div>
      )}

    </nav>
  );
}