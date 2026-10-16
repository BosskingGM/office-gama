// Ayudas compartidas para direcciones (carrito y /cuenta/direcciones).
// La dirección se guarda como UN solo texto ("Calle y número, Col. Colonia"),
// que es lo que ya esperan el servidor, los correos y el panel de pedidos.

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const COL_SEP = ", Col. ";

export function joinAddress(street: string, colonia: string): string {
  const s = street.trim();
  const c = colonia.trim();
  return c ? `${s}${COL_SEP}${c}` : s;
}

// Inverso de joinAddress. Con direcciones antiguas (sin colonia) devuelve todo como calle.
export function splitAddress(
  address: string,
  colonia?: string | null
): { street: string; colonia: string } {
  const c = (colonia ?? "").trim();
  if (c && address.endsWith(`${COL_SEP}${c}`)) {
    return { street: address.slice(0, -(COL_SEP.length + c.length)), colonia: c };
  }
  return { street: address, colonia: c };
}

export type AddressMode = "manual" | "mapa";
