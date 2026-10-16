import { NextResponse } from "next/server";
import { lookupCp } from "@/lib/postal";

export const dynamic = "force-dynamic";

// GET /api/cp/56600 → { cp, municipio, estado, colonias: [...] }
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cp: string }> }
) {
  const { cp } = await ctx.params;
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: "Código postal inválido" }, { status: 400 });
  }

  const r = await lookupCp(cp);
  if (r.ok) {
    return NextResponse.json(r.info, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }
  return r.reason === "notfound"
    ? NextResponse.json({ error: "No encontramos ese código postal" }, { status: 404 })
    : NextResponse.json({ error: "Servicio de códigos postales no disponible" }, { status: 502 });
}
