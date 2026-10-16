"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ChevronDown,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  ACCOUNT_EVENT,
  fetchFullName,
  firstName,
  initialOf,
} from "@/lib/account";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [fullName, setFullName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { count, hydrated, openCart } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  /* Sesión y rol de administrador */
  useEffect(() => {
    const loadRole = async (u: User | null) => {
      if (!u) {
        setIsAdmin(false);
        setFullName("");
        return;
      }
      fetchFullName(u.id).then(setFullName).catch(() => setFullName(""));
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      setIsAdmin(profile?.role === "admin");
    };

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      loadRole(u);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadRole(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* Si el cliente cambia su nombre en "Mis datos", se refleja aquí */
  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u) setFullName(await fetchFullName(u.id).catch(() => ""));
    };
    window.addEventListener(ACCOUNT_EVENT, refresh);
    return () => window.removeEventListener(ACCOUNT_EVENT, refresh);
  }, []);

  /* Menú de cuenta: cerrar al tocar fuera, con Escape o al cambiar de página */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* Sombra al hacer scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Cerrar el menú móvil al cambiar de página */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Menú móvil: Escape y bloqueo de scroll */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setFullName("");
    setMenuOpen(false);
    setOpen(false);
    router.push("/");
  };

  const linkClass = (href: string) =>
    `relative py-1 transition ${
      pathname === href
        ? "text-brand-strong font-semibold"
        : "text-neutral-700 hover:text-brand-strong"
    }`;

  const cartButton = (
    <button
      onClick={openCart}
      aria-label={`Abrir carrito${count ? `, ${count} piezas` : ""}`}
      className="relative w-11 h-11 grid place-items-center rounded-full hover:bg-brand-soft transition"
    >
      <ShoppingBag size={22} />
      {hydrated && count > 0 && (
        <span className="absolute top-0.5 right-0 min-w-5 h-5 px-1 grid place-items-center bg-brand text-ink text-[11px] font-bold rounded-full ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );

  return (
    <>
      <header
        className={`w-full bg-white sm:bg-white/90 sm:backdrop-blur border-b border-line sticky top-0 z-40 transition-shadow ${
          scrolled ? "shadow-[0_4px_20px_rgba(126,34,206,0.08)]" : ""
        }`}
      >
        <nav
          aria-label="Principal"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-20"
        >
          {/* Logo */}
          <Link href="/" aria-label="Office GaMa, ir al inicio">
            <Image
              src="/logo2.png"
              alt="Office GaMa"
              width={640}
              height={341}
              priority
              sizes="120px"
              className="h-11 sm:h-14 w-auto transition hover:scale-[1.03]"
            />
          </Link>

          {/* Escritorio */}
          <div className="hidden md:flex items-center gap-7 font-medium">
            <Link href="/" className={linkClass("/")}>
              Inicio
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line hover:border-brand hover:bg-brand-soft transition text-sm"
              >
                <ShieldCheck size={15} />
                Admin
              </Link>
            )}

            {cartButton}

            {user ? (
              <div
                ref={menuRef}
                className="relative pl-3 border-l border-line"
              >
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full hover:bg-brand-soft transition"
                >
                  <span className="w-9 h-9 rounded-full bg-brand text-ink grid place-items-center font-bold">
                    {initialOf(fullName, user.email)}
                  </span>
                  <span className="text-sm font-medium max-w-[110px] truncate">
                    {firstName(fullName) || "Mi cuenta"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-500 transition ${
                      menuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-3 w-64 card p-2 z-50 animate-fade-up"
                  >
                    <div className="px-3 py-2.5 mb-1 border-b border-line">
                      <p className="font-semibold truncate">
                        {fullName || "Mi cuenta"}
                      </p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                    </div>
                    {[
                      { href: "/cuenta", label: "Resumen", icon: LayoutGrid },
                      { href: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
                      { href: "/cuenta/perfil", label: "Mis datos", icon: UserIcon },
                      { href: "/cuenta/direcciones", label: "Direcciones", icon: MapPin },
                      { href: "/cuenta/seguridad", label: "Seguridad", icon: Lock },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-brand-soft transition"
                      >
                        <Icon size={17} className="text-neutral-500" />
                        {label}
                      </Link>
                    ))}
                    <div className="mt-1 pt-1 border-t border-line">
                      <button
                        onClick={handleLogout}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-700 hover:bg-brand-soft transition"
                      >
                        <LogOut size={17} className="text-neutral-500" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className={linkClass("/login")}>
                  Iniciar sesión
                </Link>
                <Link href="/registro" className="btn-primary py-2! text-sm">
                  Crear cuenta
                </Link>
              </div>
            )}
          </div>

          {/* Móvil */}
          <div className="md:hidden flex items-center gap-1">
            {cartButton}
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={open}
              className="w-11 h-11 grid place-items-center rounded-full hover:bg-brand-soft transition"
            >
              <Menu size={24} />
            </button>
          </div>
        </nav>
      </header>

      {/* Menú móvil */}
      {open && (
        <div className="fixed inset-0 z-[998] md:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="animate-slide-in-right absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold">Menú</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-1 font-medium">
              <Link
                onClick={() => setOpen(false)}
                href="/"
                className="px-3 py-3 rounded-xl hover:bg-brand-soft transition"
              >
                Inicio
              </Link>
              {user && (
                <>
                  <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    Mi cuenta
                  </p>
                  {[
                    { href: "/cuenta", label: "Resumen", icon: LayoutGrid },
                    { href: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
                    { href: "/cuenta/perfil", label: "Mis datos", icon: UserIcon },
                    { href: "/cuenta/direcciones", label: "Direcciones", icon: MapPin },
                    { href: "/cuenta/seguridad", label: "Seguridad", icon: Lock },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      onClick={() => setOpen(false)}
                      href={href}
                      className="px-3 py-3 rounded-xl hover:bg-brand-soft transition flex items-center gap-3"
                    >
                      <Icon size={18} className="text-neutral-500" /> {label}
                    </Link>
                  ))}
                </>
              )}
              {isAdmin && (
                <Link
                onClick={() => setOpen(false)}
                  href="/admin"
                  className="px-3 py-3 rounded-xl hover:bg-brand-soft transition flex items-center gap-2"
                >
                  <ShieldCheck size={18} /> Panel de administración
                </Link>
              )}
            </div>

            <div className="mt-auto pt-5 border-t border-line space-y-3">
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-brand text-ink grid place-items-center font-bold shrink-0">
                      {initialOf(fullName, user.email)}
                    </span>
                    <div className="min-w-0">
                      {fullName && (
                        <p className="text-sm font-semibold truncate">{fullName}</p>
                      )}
                      <p className="text-xs text-neutral-600 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn-outline w-full"
                  >
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <Link onClick={() => setOpen(false)} href="/registro" className="btn-primary w-full">
                    Crear cuenta
                  </Link>
                  <Link onClick={() => setOpen(false)} href="/login" className="btn-outline w-full">
                    Iniciar sesión
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Carrito lateral */}
      <CartDrawer />
    </>
  );
}
