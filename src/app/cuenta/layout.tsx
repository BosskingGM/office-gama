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

        <nav
          aria-label="Mi cuenta"
          className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:sticky md:top-28"
        >
          {LINKS.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                isActive(href, exact)
                  ? "bg-brand text-ink"
                  : "text-neutral-700 hover:bg-brand-soft"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
