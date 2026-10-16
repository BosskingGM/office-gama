// Consulta de códigos postales (SEPOMEX) desde el SERVIDOR.
// Lo usan la ruta /api/cp/[cp] (para el formulario) y create-checkout-session
// (para verificar que un CP sea de Chalco o Ixtapaluca en entrega local).
//
// Fuentes, en orden:
//   1) Copomex, si defines COPOMEX_TOKEN en las variables de entorno (recomendado).
//   2) API comunitaria gratuita de SEPOMEX (sin token, sin garantía de disponibilidad).
// Los resultados se guardan en memoria 24 h para no repetir consultas.

import type { PostalInfo } from "@/lib/address";

type Result =
  | { ok: true; info: PostalInfo }
  | { ok: false; reason: "notfound" | "unavailable" };

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; info: PostalInfo }>();

const asArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : typeof v === "string" && v
    ? [v]
    : [];

// Acepta las formas de respuesta conocidas (Copomex simplificado/completo y similares).
function parse(cp: string, json: unknown): PostalInfo | null {
  let root: any = json;
  if (Array.isArray(root)) {
    const rows = root.map((r: any) => r?.response ?? r).filter(Boolean);
    if (rows.length === 0) return null;
    return {
      cp,
      municipio: String(rows[0].municipio ?? ""),
      estado: String(rows[0].estado ?? ""),
      colonias: Array.from(new Set(rows.map((r: any) => String(r.asentamiento ?? "")).filter(Boolean))),
    };
  }
  if (root?.error === true) return null;
  root = root?.response ?? root;
  const colonias = asArray(root?.asentamiento ?? root?.colonias);
  const municipio = String(root?.municipio ?? "");
  if (!municipio || colonias.length === 0) return null;
  return {
    cp,
    municipio,
    estado: String(root?.estado ?? ""),
    colonias: Array.from(new Set(colonias)).sort((a, b) => a.localeCompare(b, "es")),
  };
}

async function fromUrl(cp: string, url: string): Promise<Result> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, reason: "notfound" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const info = parse(cp, await res.json().catch(() => null));
    return info ? { ok: true, info } : { ok: false, reason: "notfound" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function lookupCp(cp: string): Promise<Result> {
  if (!/^\d{5}$/.test(cp)) return { ok: false, reason: "notfound" };

  const hit = cache.get(cp);
  if (hit && Date.now() - hit.at < TTL_MS) return { ok: true, info: hit.info };

  const urls: string[] = [];
  const token = process.env.COPOMEX_TOKEN;
  if (token) {
    urls.push(
      `https://api.copomex.com/query/info_cp/${cp}?type=simplified&token=${encodeURIComponent(token)}`
    );
  }
  urls.push(`https://api-sepomex.hckdrk.mx/query/info_cp/${cp}?type=simplified`);

  let unavailable = false;
  for (const url of urls) {
    const r = await fromUrl(cp, url);
    if (r.ok) {
      cache.set(cp, { at: Date.now(), info: r.info });
      return r;
    }
    if (r.reason === "unavailable") unavailable = true;
  }
  // Si alguna fuente falló por red, no afirmamos que el CP no existe.
  return { ok: false, reason: unavailable ? "unavailable" : "notfound" };
}
