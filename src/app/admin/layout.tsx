"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Package,
  ShieldCheck,
  Store,
  Ticket,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/inventario", label: "Inventario", icon: Package },
  { href: "/admin/promociones", label: "Promociones", icon: Megaphone },
  { href: "/admin/cupones", label: "Cupones", icon: Ticket },
  { href: "/admin/administradores", label: "Administradores", icon: ShieldCheck },
];

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
        router.replace("/login?next=/admin");
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
      <div className="min-h-[60vh] grid place-items-center text-muted">
        Verificando permisos…
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-10 py-2">
      <aside className="md:w-52 shrink-0">
        {/* Celular: cuadrícula 3x2 con todo a la vista (sin scroll lateral).
            Escritorio: barra lateral vertical como antes. */}
        <nav
          aria-label="Administración"
          className="grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-2 md:sticky md:top-28"
        >
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2.5 min-h-[60px] md:min-h-0 px-2 py-2.5 md:px-4 rounded-2xl md:rounded-full text-[11px] leading-tight md:text-sm text-center md:text-left font-semibold transition active:scale-[0.97] ${
                  active
                    ? "bg-brand text-ink shadow-sm"
                    : "bg-white md:bg-transparent border border-line md:border-transparent text-neutral-700 hover:bg-brand-soft"
                }`}
              >
                <Icon size={20} aria-hidden="true" className="shrink-0" />
                <span className="md:whitespace-nowrap">{label}</span>
              </Link>
            );
          })}

          <Link
            href="/"
            className="hidden md:inline-flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-muted hover:bg-brand-soft transition whitespace-nowrap mt-4 border-t border-line rounded-none pt-5"
          >
            <Store size={17} aria-hidden="true" />
            Ver tienda
          </Link>
        </nav>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
