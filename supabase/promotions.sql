-- Promociones de la portada (se administran desde /admin/promociones).
-- Pégalo completo en Supabase → SQL Editor → New query → Run.

create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  title        text,
  subtitle     text,
  button_text  text,
  link_url     text,
  image_url    text,
  theme        text not null default 'lila',
  active       boolean not null default true,
  sort_order   integer not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.promotions enable row level security;

-- Cualquier visitante ve solo las promociones activas y dentro de su fecha.
drop policy if exists "promos_public_read" on public.promotions;
create policy "promos_public_read" on public.promotions
  for select
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  );

-- Los administradores (profiles.role = 'admin') pueden verlo y editarlo todo.
drop policy if exists "promos_admin_all" on public.promotions;
create policy "promos_admin_all" on public.promotions
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
