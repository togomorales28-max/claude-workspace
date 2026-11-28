-- Tablas, permisos y tiempo real del cotizador de Rojo Ironworks.
-- Dueño(s): la primera cuenta que se registra queda como dueño.
create table if not exists public.cotizador_owner (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.cotizador_config (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cotizador_quotes (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  folio        text not null,
  client_name  text not null,
  client_phone text not null,
  contact_via  text not null check (contact_via in ('whatsapp', 'sms')),
  address      text,
  notes        text,
  total        numeric not null check (total >= 0),
  low          numeric,
  high         numeric,
  currency     text,
  detail       jsonb not null default '[]'::jsonb,
  message      text,
  status       text not null default 'nueva' check (status in ('nueva', 'contactado', 'vendida', 'descartada')),
  notified     boolean not null default false
);
create index if not exists cotizador_quotes_created_idx on public.cotizador_quotes (created_at desc);

-- Suscripciones de notificaciones del panel (un registro por teléfono/computadora del dueño)
create table if not exists public.cotizador_push_subs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  owner_email text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  device     text
);

create or replace function public.cotizador_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cotizador_owner o
    where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.cotizador_is_owner() from public;
grant execute on function public.cotizador_is_owner() to anon, authenticated;

alter table public.cotizador_owner     enable row level security;
alter table public.cotizador_config    enable row level security;
alter table public.cotizador_quotes    enable row level security;
alter table public.cotizador_push_subs enable row level security;

create policy "config: todos leen" on public.cotizador_config
  for select to anon, authenticated using (true);
create policy "config: solo el dueño cambia" on public.cotizador_config
  for update to authenticated using (public.cotizador_is_owner()) with check (public.cotizador_is_owner());

create policy "cotizaciones: cualquiera envía" on public.cotizador_quotes
  for insert to anon, authenticated
  with check (
    char_length(client_name) between 1 and 120
    and client_phone ~ '^\+[0-9]{8,15}$'
    and status = 'nueva'
    and notified = false
    and coalesce(char_length(message), 0) <= 8000
    and coalesce(char_length(notes), 0) <= 2000
  );
create policy "cotizaciones: solo el dueño ve" on public.cotizador_quotes
  for select to authenticated using (public.cotizador_is_owner());
create policy "cotizaciones: solo el dueño actualiza" on public.cotizador_quotes
  for update to authenticated using (public.cotizador_is_owner()) with check (public.cotizador_is_owner());
create policy "cotizaciones: solo el dueño borra" on public.cotizador_quotes
  for delete to authenticated using (public.cotizador_is_owner());

create policy "avisos: el dueño administra los suyos" on public.cotizador_push_subs
  for all to authenticated
  using (public.cotizador_is_owner() and lower(owner_email) = lower(auth.jwt() ->> 'email'))
  with check (public.cotizador_is_owner() and lower(owner_email) = lower(auth.jwt() ->> 'email'));

revoke all on public.cotizador_owner from anon, authenticated;
revoke all on public.cotizador_config from anon, authenticated;
revoke all on public.cotizador_quotes from anon, authenticated;
revoke all on public.cotizador_push_subs from anon, authenticated;
grant select on public.cotizador_config to anon, authenticated;
grant update (data, updated_at) on public.cotizador_config to authenticated;
grant insert (folio, client_name, client_phone, contact_via, address, notes, total, low, high, currency, detail, message) on public.cotizador_quotes to anon, authenticated;
grant select, delete on public.cotizador_quotes to authenticated;
grant update (status) on public.cotizador_quotes to authenticated;
grant select, insert, delete on public.cotizador_push_subs to authenticated;

-- Tiempo real
alter publication supabase_realtime add table public.cotizador_config;
alter publication supabase_realtime add table public.cotizador_quotes;

-- La primera cuenta registrada se confirma sola y queda como dueño (después, nadie más obtiene permisos).
create or replace function public.cotizador_first_user_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cotizador_owner) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;

create or replace function public.cotizador_first_user_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and not exists (select 1 from public.cotizador_owner) then
    insert into public.cotizador_owner (email) values (lower(new.email)) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists cotizador_first_user_confirm on auth.users;
create trigger cotizador_first_user_confirm before insert on auth.users
  for each row execute function public.cotizador_first_user_confirm();
drop trigger if exists cotizador_first_user_owner on auth.users;
create trigger cotizador_first_user_owner after insert on auth.users
  for each row execute function public.cotizador_first_user_owner();

revoke all on function public.cotizador_first_user_confirm() from public, anon, authenticated;
revoke all on function public.cotizador_first_user_owner() from public, anon, authenticated;
