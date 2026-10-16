-- Cuenta de cliente: datos personales y direcciones guardadas.
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
--
-- Nota de seguridad: el nombre y teléfono NO se guardan en la tabla "profiles"
-- a propósito. Ahí vive el campo "role" (admin) y no conviene darle a los
-- clientes permiso de editar esa tabla.

create table if not exists public.customer_details (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null default 'Casa',
  full_name    text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  postal_code  text not null,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);

-- Solo una dirección predeterminada por cliente
create unique index if not exists addresses_one_default
  on public.addresses (user_id) where is_default;

alter table public.customer_details enable row level security;
alter table public.addresses        enable row level security;

drop policy if exists "customer_details_own" on public.customer_details;
create policy "customer_details_own" on public.customer_details
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
