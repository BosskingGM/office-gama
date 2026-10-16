// Datos de la tienda física. Es el ÚNICO lugar donde vive la dirección:
// carrito, footer y página de pedido la leen de aquí.

export const STORE = {
  street: "Texcaltlipoca",
  colonia: "Culturas de México",
  city: "Chalco de Díaz Covarrubias",
  state: "Estado de México",
  postal_code: "56607",
} as const;

// Dirección completa, como se muestra al público.
export const STORE_ADDRESS_FULL =
  "Texcaltlipoca, Culturas de México, 56607 Chalco de Díaz Covarrubias, Méx.";

// Versión corta para tarjetas y avisos (sin código postal).
export const STORE_ADDRESS_SHORT =
  "Texcaltlipoca, Culturas de México, Chalco de Díaz Covarrubias";

// Ubicación exacta del local en Google Maps (Plus Code).
// TODOS los enlaces "ver en el mapa" del sitio y de los correos usan este valor.
export const STORE_PLUS_CODE =
  "739W+M35 Chalco de Díaz Covarrubias, Estado de México";

export const STORE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  STORE_PLUS_CODE
)}`;

// Datos que se guardan en el pedido cuando el cliente elige "Recoger en tienda"
// (el servidor exige dirección, ciudad y código postal en todos los pedidos).
export const STORE_PICKUP_DATA = {
  address: `${STORE.street}, ${STORE.colonia} (recoger en tienda)`,
  city: STORE.city,
  postal_code: STORE.postal_code,
};

// WhatsApp de la tienda (comprobantes de transferencia, dudas).
export const STORE_WHATSAPP_URL = "https://wa.me/525618060088";

// Datos para pagos por transferencia. Se muestran al cliente al terminar su
// pedido y en el correo.
export const BANK_TRANSFER = {
  bank: "Clip",
  holder: "Giovanni Garcia Morales",
  clabe: "730969100004718476",
} as const;
