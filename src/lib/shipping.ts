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
