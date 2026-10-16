-- Cupones de descuento (se administran desde /admin/cupones).
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez.
--
-- Reglas que garantiza la base de datos (no el navegador):
--   • Un cupón se puede usar UNA sola vez por cliente (por cuenta Y por teléfono).
--   • Un pedido lleva máximo un cupón.
--   • "Primera compra" = el cliente no tiene ningún pedido previo (no cancelado),
--     ni con su cuenta ni con su teléfono, y no ha usado otro cupón de primera compra.
--   • Los códigos NO son públicos: los clientes no pueden leer la tabla de cupones;
--     solo el servidor los valida.
--   • Un cupón con usos registrados no se puede borrar (solo desactivar); así nadie
--     puede volver a usarlo recreando el mismo código.

/* =========================
   CUPONES
========================= */

create table if not exists public.coupons (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique
                         check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  description          text,                       -- nota interna / texto para WhatsApp
  percent_off          integer not null check (percent_off between 1 and 90),
  first_purchase_only  boolean not null default false,
  min_subtotal         numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_uses             integer check (max_uses is null or max_uses > 0), -- límite global
  active               boolean not null default true,
  starts_at            timestamptz,
  ends_at              timestamptz,
  created_at           timestamptz not null default now()
);

/* =========================
   USOS (reservas y canjes)
========================= */

create table if not exists public.coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null references public.coupons(id) on delete restrict,
  user_id           uuid not null references auth.users(id) on delete cascade,
  phone_key         text,                          -- últimos 10 dígitos del teléfono
  status            text not null default 'reserved' check (status in ('reserved','used')),
  cart_id           text,
  stripe_session_id text,
  order_id          text,
  discount_amount   numeric(10,2) not null default 0,
  reserved_until    timestamptz,                   -- las reservas vencen solas
  created_at        timestamptz not null default now(),
  used_at           timestamptz,
  -- Nunca dos usos del mismo cupón por la misma cuenta
  unique (coupon_id, user_id)
);

-- ...ni por el mismo teléfono (evita crear cuentas nuevas para repetir el cupón)
create unique index if not exists coupon_redemptions_phone_unique
  on public.coupon_redemptions (coupon_id, phone_key)
  where phone_key is not null;

create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id);
create index if not exists coupon_redemptions_cart_idx on public.coupon_redemptions (cart_id);

/* =========================
   SEGURIDAD (RLS)
========================= */

alter table public.coupons             enable row level security;
alter table public.coupon_redemptions  enable row level security;

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Los administradores pueden VER los usos; solo el servidor los escribe.
drop policy if exists "coupon_redemptions_admin_read" on public.coupon_redemptions;
create policy "coupon_redemptions_admin_read" on public.coupon_redemptions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

/* =========================
   FUNCIONES (solo las llama el servidor)
========================= */

-- Valida el cupón y, si no es simulación, lo RESERVA para ese cliente.
-- Todo ocurre bloqueando la fila del cupón: dos pagos simultáneos no pueden
-- usar el mismo cupón.
create or replace function public.apply_coupon(
  p_code         text,
  p_user_id      uuid,
  p_phone_key    text,
  p_subtotal     numeric,
  p_ttl_minutes  integer default 40,
  p_dry_run      boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c              public.coupons%rowtype;
  v_discount     numeric(10,2);
  v_taken        integer;
  v_old_session  text;
begin
  if p_dry_run then
    select * into c from public.coupons where code = upper(btrim(p_code));
  else
    select * into c from public.coupons where code = upper(btrim(p_code)) for update;
  end if;

  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if not c.active then return jsonb_build_object('status', 'inactive'); end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('status', 'not_started');
  end if;
  if c.ends_at is not null and c.ends_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if p_subtotal < c.min_subtotal then
    return jsonb_build_object('status', 'min_subtotal', 'min', c.min_subtotal);
  end if;

  -- Reservas vencidas (pagos abandonados) liberan el cupón
  if not p_dry_run then
    delete from public.coupon_redemptions
     where coupon_id = c.id and status = 'reserved' and reserved_until < now();
  end if;

  -- ¿Ya lo usó esta persona (misma cuenta o mismo teléfono)?
  if exists (
    select 1 from public.coupon_redemptions x
     where x.coupon_id = c.id and x.status = 'used'
       and (x.user_id = p_user_id or (p_phone_key is not null and x.phone_key = p_phone_key))
  ) then
    return jsonb_build_object('status', 'already_used');
  end if;

  -- ¿Otra cuenta con el mismo teléfono lo tiene en un pago en proceso?
  if p_phone_key is not null and exists (
    select 1 from public.coupon_redemptions x
     where x.coupon_id = c.id and x.status = 'reserved' and x.reserved_until >= now()
       and x.user_id <> p_user_id and x.phone_key = p_phone_key
  ) then
    return jsonb_build_object('status', 'in_progress');
  end if;

  -- Primera compra
  if c.first_purchase_only then
    if exists (
      select 1 from public.orders o
       where lower(coalesce(o.status, '')) <> 'cancelado'
         and (o.user_id = p_user_id
              or (p_phone_key is not null
                  and right(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g'), 10) = p_phone_key))
    ) then
      return jsonb_build_object('status', 'not_first_purchase');
    end if;

    -- Tampoco puede acumular dos cupones distintos de primera compra
    if exists (
      select 1 from public.coupon_redemptions x
        join public.coupons k on k.id = x.coupon_id
       where k.first_purchase_only and x.coupon_id <> c.id and x.user_id = p_user_id
         and (x.status = 'used' or x.reserved_until >= now())
    ) then
      return jsonb_build_object('status', 'not_first_purchase');
    end if;
  end if;

  -- Límite global de usos
  if c.max_uses is not null then
    select count(*) into v_taken
      from public.coupon_redemptions x
     where x.coupon_id = c.id and x.user_id <> p_user_id
       and (x.status = 'used' or x.reserved_until >= now());
    if v_taken >= c.max_uses then
      return jsonb_build_object('status', 'exhausted');
    end if;
  end if;

  v_discount := round(p_subtotal * c.percent_off / 100.0, 2);
  if v_discount <= 0 then
    return jsonb_build_object('status', 'min_subtotal', 'min', c.min_subtotal);
  end if;

  if p_dry_run then
    return jsonb_build_object('status', 'ok', 'coupon_id', c.id, 'code', c.code,
                              'percent', c.percent_off, 'discount', v_discount);
  end if;

  -- Si el mismo cliente ya tenía una reserva (otro intento de pago), se reemplaza
  select stripe_session_id into v_old_session
    from public.coupon_redemptions
   where coupon_id = c.id and user_id = p_user_id and status = 'reserved';

  begin
    insert into public.coupon_redemptions
      (coupon_id, user_id, phone_key, status, discount_amount, reserved_until)
    values
      (c.id, p_user_id, p_phone_key, 'reserved', v_discount,
       now() + make_interval(mins => p_ttl_minutes))
    on conflict (coupon_id, user_id) do update
      set phone_key = excluded.phone_key,
          discount_amount = excluded.discount_amount,
          reserved_until = excluded.reserved_until,
          cart_id = null,
          stripe_session_id = null
      where public.coupon_redemptions.status = 'reserved';
  exception when unique_violation then
    return jsonb_build_object('status', 'already_used');
  end;

  return jsonb_build_object('status', 'ok', 'coupon_id', c.id, 'code', c.code,
                            'percent', c.percent_off, 'discount', v_discount,
                            'replaced_session_id', v_old_session);
end;
$$;

-- Convierte la reserva en uso definitivo cuando el pedido ya existe.
create or replace function public.finalize_coupon(
  p_coupon_id  uuid,
  p_user_id    uuid,
  p_phone_key  text,
  p_order_id   text,
  p_discount   numeric
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupon_redemptions
     set status = 'used', order_id = p_order_id, discount_amount = p_discount,
         used_at = now(), reserved_until = null
   where coupon_id = p_coupon_id and user_id = p_user_id and status = 'reserved';
  if found then return true; end if;

  -- Reintento del mismo pedido: ya estaba registrado
  if exists (
    select 1 from public.coupon_redemptions
     where coupon_id = p_coupon_id and user_id = p_user_id
       and status = 'used' and order_id = p_order_id
  ) then
    return true;
  end if;

  -- La reserva venció y se limpió, pero el pago sí se hizo: se registra igual
  begin
    insert into public.coupon_redemptions
      (coupon_id, user_id, phone_key, status, order_id, discount_amount, used_at)
    values
      (p_coupon_id, p_user_id, p_phone_key, 'used', p_order_id, p_discount, now());
    return true;
  exception when unique_violation then
    return false;
  end;
end;
$$;

revoke all on function public.apply_coupon(text, uuid, text, numeric, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.finalize_coupon(uuid, uuid, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_coupon(text, uuid, text, numeric, integer, boolean)
  to service_role;
grant execute on function public.finalize_coupon(uuid, uuid, text, text, numeric)
  to service_role;

/* =========================
   COLUMNAS NUEVAS EN TABLAS EXISTENTES
========================= */

-- Promoción con botón "Obtener cupón" (lleva a WhatsApp)
alter table public.promotions
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;

-- El carrito validado recuerda el cupón hasta que Stripe confirme el pago
alter table public.checkout_carts
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric(10,2) not null default 0;
