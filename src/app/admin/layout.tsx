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
      <div className="min-h-screen flex items-center justify-center bg-[#faf9ff] text-neutral-700">
        Verificando permisos...
      </div>
    );
  }

  const linkClass = (path: string) =>
    `block px-4 py-3 rounded-2xl text-sm font-medium transition ${
      pathname === path
        ? "bg-[#d6a8ff] text-black"
        : "text-neutral-700 hover:bg-neutral-100"
    }`;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#faf9ff]">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-neutral-200 p-6">

        <h2 className="text-xl font-bold text-neutral-900 mb-8">
          Admin Panel
        </h2>

        <nav className="flex flex-row md:flex-col gap-3 md:gap-2 overflow-x-auto md:overflow-visible">

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

      {/* CONTENT */}
      <main className="flex-1 p-6 md:p-10">
        {children}
      </main>

    </div>
  );
}