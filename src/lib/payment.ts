// Métodos de pago. Se usa en el carrito (para mostrar opciones) y en el servidor
// (para validar), así nunca se desincronizan.
//
//  • tarjeta          → Stripe. El pedido nace "pagado" (webhook).
//  • transferencia    → el pedido nace "revision"; el admin aprueba el pago y pasa a "pagado".
//  • efectivo_tienda  → solo con "Recoger en tienda". Nace "contra_entrega"; el admin
//                       lo marca "entregado" cuando el cliente recoge y paga.
//
// En transferencia y efectivo el stock se APARTA al crear el pedido; al cancelarlo
// regresa al inventario (ver supabase/offline-payments.sql).

import type { ShippingType } from "@/lib/shipping";

export const PAYMENT_METHODS = {
  tarjeta: {
    label: "Tarjeta",
    note: "Crédito o débito, pago seguro con Stripe.",
  },
  transferencia: {
    label: "Transferencia",
    note: "Pedido en revisión hasta que validemos tu pago.",
  },
  efectivo_tienda: {
    label: "Pagar al recoger",
    note: "Pagas en la tienda cuando pases por tu pedido.",
  },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && value in PAYMENT_METHODS;
}

// Pagar al recoger solo existe con "Recoger en tienda".
export function paymentMethodsFor(shipping: ShippingType): PaymentMethod[] {
  return shipping === "pickup"
    ? ["tarjeta", "transferencia", "efectivo_tienda"]
    : ["tarjeta", "transferencia"];
}

// Estado con el que nace el pedido según el método (tarjeta lo crea el webhook).
export const OFFLINE_STATUS = {
  transferencia: "revision",
  efectivo_tienda: "contra_entrega",
} as const;
