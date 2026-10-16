// Pide a la tienda que se refresque YA (portada y páginas de producto),
// en lugar de esperar a que venza la caché. Solo funciona con sesión de admin.
// Si falla, la tienda se actualiza sola en un máximo de 1 minuto.

import { supabase } from "@/lib/supabase";

export async function revalidateStore() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/revalidate-home", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* sin consecuencias: la caché vence sola */
  }
}
