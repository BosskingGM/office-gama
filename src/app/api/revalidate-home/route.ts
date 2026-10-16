// Refresca la portada al instante después de cambiar promociones desde el admin.
// Solo la puede llamar un administrador con sesión iniciada.

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getUserFromRequest, isAdminUser } from "@/lib/auth-server";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAdminUser(user.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
