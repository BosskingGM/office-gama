// Opciones de envío. Se usa tanto en el carrito (para mostrar el precio)
// como en el servidor (para cobrarlo), así nunca se desincronizan.
// El servidor SIEMPRE recalcula el costo desde aquí; el navegador no decide.

export const SHIPPING_OPTIONS = {
  pickup: { label: "Recoger en tienda", cost: 0 },
  local: { label: "Entrega local", cost: 50 },
  paqueteria: { label: "Paquetería nacional", cost: 160 },
} as const;

export type ShippingType = keyof typeof SHIPPING_OPTIONS;

export function isShippingType(value: unknown): value is ShippingType {
  return typeof value === "string" && value in SHIPPING_OPTIONS;
}

/* =========================
   ENTREGA LOCAL
   Solo se entrega en estos municipios.
========================= */

export const LOCAL_CITIES = ["Chalco", "Ixtapaluca"] as const;
export type LocalCity = (typeof LOCAL_CITIES)[number];

export const LOCAL_COVERAGE_TEXT = "Solo Chalco e Ixtapaluca";

// Quita acentos, mayúsculas y espacios para comparar nombres de ciudad.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

// Devuelve el nombre oficial ("Chalco" / "Ixtapaluca") o null si no es zona local.
export function matchLocalCity(value: unknown): LocalCity | null {
  if (typeof value !== "string") return null;
  const n = norm(value);
  if (n === "chalco de diaz covarrubias") return "Chalco"; // nombre oficial de la cabecera
  return LOCAL_CITIES.find((c) => norm(c) === n) ?? null;
}

/* =========================
   MAPA / UBICACIÓN
========================= */

export type LatLng = { lat: number; lng: number };

// Zona aproximada que cubre Chalco e Ixtapaluca. Sirve para rechazar pines
// absurdos (otro estado, CDMX...). Ajusta estos números si cambias la cobertura.
export const LOCAL_ZONE = {
  south: 19.17,
  north: 19.4,
  west: -99.0,
  east: -98.74,
} as const;

// Centro inicial del mapa (zona de entrega local).
export const LOCAL_MAP_CENTER: LatLng = { lat: 19.29, lng: -98.88 };

// México completo, para pines de paquetería.
const MEXICO_BOX = { south: 14.3, north: 32.8, west: -118.6, east: -86.5 };

export function isInsideLocalZone(p: LatLng): boolean {
  return (
    p.lat >= LOCAL_ZONE.south &&
    p.lat <= LOCAL_ZONE.north &&
    p.lng >= LOCAL_ZONE.west &&
    p.lng <= LOCAL_ZONE.east
  );
}

export function isInsideMexico(p: LatLng): boolean {
  return (
    p.lat >= MEXICO_BOX.south &&
    p.lat <= MEXICO_BOX.north &&
    p.lng >= MEXICO_BOX.west &&
    p.lng <= MEXICO_BOX.east
  );
}

// Convierte lo que llegue (número o texto) en coordenada válida, o null.
export function toCoord(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return Math.round(n * 1e6) / 1e6; // 6 decimales ≈ 10 cm
}

export const mapsLink = (p: LatLng) =>
  `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
