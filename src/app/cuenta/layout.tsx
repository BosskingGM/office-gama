"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  LayoutGrid,
  Lock,
  MapPin,
  Package,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ACCOUNT_EVENT,
  fetchFullName,
  firstName,
  initialOf,
} from "@/lib/account";

const LINKS = [
  { href: "/cuenta", label: "Resumen", icon: LayoutGrid, exact: true },
  { href: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/cuenta/perfil", label: "Mis datos", icon: UserIcon },
  { href: "/cuenta/direcciones", label: "Direcciones", icon: MapPin },
  { href: "/cuenta/seguridad", label: "Seguridad", icon: Lock },
];

export default function CuentaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!alive) return;
      setEmail(user?.email ?? null);
      if (user) {
        const n = await fetchFullName(user.id).catch(() => "");
        if (alive) setName(n);
      }
      if (alive) setReady(true);
    };
    load();
    window.addEventListener(ACCOUNT_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_EVENT, load);
    };
  }, []);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-5 md:gap-10">
      <aside className="md:w-60 shrink-0 space-y-4">
        {/* Tarjeta del cliente */}
        <div className="card p-4 md:p-5 flex md:flex-col items-center md:items-start gap-3.5">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-brand text-ink grid place-items-center text-xl md:text-2xl font-extrabold shrink-0">
            {ready ? initialOf(name, email) : ""}
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">
              {ready ? (firstName(name) ? `Hola, ${firstName(name)}` : "Mi cuenta") : "…"}
            </p>
            <p className="text-xs text-muted truncate">{email ?? ""}</p>
          </div>
        </div>

        {/* Celular: cuadrícula 3x2 con todo a la vista (sin scroll lateral).
            Escritorio: barra lateral vertical como antes. */}
        <nav
          aria-label="Mi cuenta"
          className="grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-2 md:sticky md:top-28"
        >
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
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
        </nav>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
