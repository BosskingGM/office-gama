-- Ubicación exacta de entrega (pin en el mapa).
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
--
-- ⚠️ EJECÚTALO ANTES de desplegar el código nuevo: el webhook y el panel de
-- pedidos ya leen/escriben estas columnas y fallarían si no existen.

alter table public.orders
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

-- Para que el cliente pueda guardar un pin en sus direcciones guardadas (opcional,
-- por si más adelante lo agregas a /cuenta/direcciones).
alter table public.addresses
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
