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

// Enlace a Google Maps.
export const STORE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  STORE_ADDRESS_FULL
)}`;

// Datos que se guardan en el pedido cuando el cliente elige "Recoger en tienda"
// (el servidor exige dirección, ciudad y código postal en todos los pedidos).
export const STORE_PICKUP_DATA = {
  address: `${STORE.street}, ${STORE.colonia} (recoger en tienda)`,
  city: STORE.city,
  postal_code: STORE.postal_code,
};
