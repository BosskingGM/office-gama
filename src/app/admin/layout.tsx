"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.replace("/");
        return;
      }

      setChecking(false);
    };

    checkAdmin();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        Verificando permisos...
      </div>
    );
  }

  const linkClass = (path: string) =>
    `block px-4 py-2 rounded transition ${
      pathname === path
        ? "bg-pink-500 text-white"
        : "text-black hover:bg-pink-100"
    }`;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white shadow-md md:shadow p-4 md:p-6">
        
        <h2 className="text-lg md:text-xl font-bold text-black mb-4 md:mb-6">
          👑 Admin
        </h2>

        <nav className="flex flex-row md:flex-col gap-2 md:space-y-2 overflow-x-auto md:overflow-visible">
          
          <Link
            href="/admin"
            className={`${linkClass("/admin")} whitespace-nowrap`}
          >
            Dashboard
          </Link>

          <Link
            href="/admin/pedidos"
            className={`${linkClass("/admin/pedidos")} whitespace-nowrap`}
          >
            Pedidos
          </Link>

          <Link
            href="/admin/inventario"
            className={`${linkClass("/admin/inventario")} whitespace-nowrap`}
          >
            Inventario
          </Link>

        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-gray-50 p-4 sm:p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}