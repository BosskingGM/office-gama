// Verifica quién hace una petición a la API usando el token de sesión
// que el navegador manda en la cabecera "Authorization: Bearer <token>".

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getUserFromRequest(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}
