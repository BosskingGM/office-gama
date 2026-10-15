"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Solo estas rutas exigen sesión. El resto de la tienda (portada, catálogo,
// producto, carrito) se puede ver sin cuenta; la sesión se pide hasta pagar.
const PROTECTED_PREFIXES = ["/cuenta", "/pedido", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default function AuthListener() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isProtected(pathname)) return;

    const goToLogin = () =>
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);

    // Revisión al entrar a una ruta protegida
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) goToLogin();
    });

    // Si la sesión se cierra o caduca mientras la página está abierta
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) goToLogin();
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
