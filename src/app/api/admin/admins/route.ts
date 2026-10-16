// Administración de administradores. Solo la puede usar un admin con sesión.
//   GET     → lista de admins (con su correo)
//   POST    → { email } da acceso de admin a una cuenta ya registrada
//   DELETE  → { id } quita el acceso (no a ti mismo, ni al último admin)

import { NextResponse } from "next/server";
import { getUserFromRequest, isAdminUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireAdmin(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAdminUser(user.id))) return null;
  return user;
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

async function listAdmins() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  const admins = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.id);
      return {
        id: row.id as string,
        email: u.user?.email ?? "(sin correo)",
        created_at: u.user?.created_at ?? null,
        last_sign_in_at: u.user?.last_sign_in_at ?? null,
      };
    })
  );
  return admins.sort((a, b) => a.email.localeCompare(b.email));
}

export async function GET(req: Request) {
  const me = await requireAdmin(req);
  if (!me) return bad("No autorizado", 401);
  try {
    return NextResponse.json({ admins: await listAdmins(), me: me.id });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function POST(req: Request) {
  const me = await requireAdmin(req);
  if (!me) return bad("No autorizado", 401);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad("Escribe un correo válido.");
  }

  // Busca la cuenta por correo (la tienda es chica; se recorren las páginas)
  let found: { id: string; email_confirmed_at?: string | null } | null = null;
  for (let page = 1; page <= 20 && !found; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return bad(error.message, 500);
    found =
      data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
    if (data.users.length < 1000) break;
  }
  if (!found) {
    return bad(
      "Esa persona aún no tiene cuenta. Pídele que se registre en la tienda con ese correo y luego agrégala aquí."
    );
  }
  if (!found.email_confirmed_at) {
    return bad(
      "Esa cuenta aún no verificó su correo. Debe confirmarlo primero."
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", found.id)
    .maybeSingle();

  if (existing?.role === "admin") return bad("Esa persona ya es administradora.");

  const { error } = existing
    ? await supabaseAdmin.from("profiles").update({ role: "admin" }).eq("id", found.id)
    : await supabaseAdmin.from("profiles").insert({ id: found.id, role: "admin" });
  if (error) return bad(`No se pudo guardar: ${error.message}`, 500);

  return NextResponse.json({ ok: true, admins: await listAdmins() });
}

export async function DELETE(req: Request) {
  const me = await requireAdmin(req);
  if (!me) return bad("No autorizado", 401);

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return bad("Falta el administrador.");
  if (id === me.id) return bad("No puedes quitarte el acceso a ti mismo.");

  const admins = await listAdmins();
  if (!admins.some((a) => a.id === id)) return bad("Esa cuenta no es administradora.");
  if (admins.length <= 1) return bad("Debe quedar al menos un administrador.");

  // No sabemos el valor "normal" de role en tu tabla; se prueban los usuales.
  let lastError = "";
  for (const value of ["customer", "user", null]) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: value })
      .eq("id", id);
    if (!error) {
      return NextResponse.json({ ok: true, admins: await listAdmins() });
    }
    lastError = error.message;
  }
  return bad(`No se pudo quitar el acceso: ${lastError}`, 500);
}
