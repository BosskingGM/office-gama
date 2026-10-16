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
    <div className="flex flex-col md:flex-row gap-6 md:gap-10 py-2">
      <aside className="md:w-52 shrink-0">
        <nav
          aria-label="Administración"
          className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar md:sticky md:top-28"
        >
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                isActive(href)
                  ? "bg-brand text-ink"
                  : "text-neutral-700 hover:bg-brand-soft"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}

          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-medium text-muted hover:bg-brand-soft transition whitespace-nowrap md:mt-4 md:border-t md:border-line md:rounded-none md:pt-5"
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
