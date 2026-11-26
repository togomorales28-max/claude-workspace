-- =====================================================================
-- Turnex · Esquema completo de la base de datos (Supabase / Postgres 15+)
--
-- Es idempotente: se puede correr completo en el SQL Editor de Supabase
-- tantas veces como haga falta sin borrar datos.
--
-- Ideas clave de seguridad:
--   * RLS en todas las tablas: cada barbero solo ve y toca sus filas.
--   * El público nunca lee tablas directamente. Todo pasa por funciones
--     RPC (security definer) que devuelven solo lo necesario.
--   * Las reservas públicas se crean con book_appointment(), que valida
--     en el servidor horario, anticipación y traslapes. El navegador
--     solo hace validaciones de experiencia de usuario.
-- =====================================================================

create extension if not exists btree_gist;  -- necesaria para impedir citas traslapadas

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  phone text check (phone is null or char_length(phone) <= 30),
  minimum_booking_notice_minutes integer not null default 120
    check (minimum_booking_notice_minutes between 0 and 10080),
  timezone text not null default 'America/Hermosillo',
  created_at timestamptz not null default now()
);

create table if not exists public.business_hours (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = domingo
  is_working boolean not null default true,
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index if not exists business_hours_user_idx on public.business_hours (user_id, day_of_week);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  -- NULL = sin precio fijo. Nunca 0, para no mostrar "$0" por error.
  price numeric(10, 2) check (price is null or price > 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists services_user_idx on public.services (user_id);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  -- Copia del nombre y precio: la cita conserva lo que se reservó aunque el servicio cambie.
  service_name text not null,
  service_price numeric(10, 2),
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  customer_email text check (customer_email is null or customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (notes is null or char_length(notes) <= 500),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  -- Permite al cliente ver y cancelar su cita sin cuenta (enlace /cita/:token).
  cancel_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Control de correos: _claimed_at es un bloqueo temporal (UPDATE atómico)
  -- y _sent_at solo se llena cuando Resend confirma el envío.
  booked_claimed_at timestamptz,
  booked_email_sent_at timestamptz,
  reminder_claimed_at timestamptz,
  reminder_email_sent_at timestamptz,
  check (end_time > start_time)
);
create index if not exists appointments_user_fecha_idx on public.appointments (user_id, appointment_date);

-- Impide citas traslapadas del mismo barbero (no solo las que empiezan a la misma hora).
-- Las canceladas no cuentan. Una doble reserva falla con el código 23P01.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_sin_traslape') then
    alter table public.appointments
      add constraint appointments_sin_traslape exclude using gist (
        user_id with =,
        tsrange(appointment_date + start_time, appointment_date + end_time) with &&
      ) where (status <> 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Validación de zona horaria del barbero
-- ---------------------------------------------------------------------

create or replace function public.validar_zona_horaria() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone;
  end if;
  return new;
end $$;

drop trigger if exists profiles_validar_zona on public.profiles;
create trigger profiles_validar_zona
  before insert or update of timezone on public.profiles
  for each row execute function public.validar_zona_horaria();

-- ---------------------------------------------------------------------
-- Alta automática del barbero al registrarse
-- ---------------------------------------------------------------------

create or replace function public.slugificar(p_texto text) returns text
language sql immutable as $$
  select coalesce(nullif(
    left(trim(both '-' from regexp_replace(
      translate(lower(coalesce(p_texto, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g')), 30), ''), 'barbero')
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
  v_base text := public.slugificar(v_nombre);
  v_slug text;
  v_n integer := 1;
begin
  if char_length(v_base) < 3 then v_base := v_base || '-barber'; end if;
  v_slug := v_base;
  while exists (select 1 from public.profiles where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.profiles (user_id, name, slug) values (new.id, left(v_nombre, 80), v_slug)
  on conflict (user_id) do nothing;

  -- Horario inicial: lunes a sábado de 9:00 a 19:00. El barbero lo ajusta después.
  insert into public.business_hours (user_id, day_of_week, is_working, start_time, end_time)
  select new.id, d, true, '09:00', '19:00' from generate_series(1, 6) as d;

  -- Servicios de ejemplo para que la página pública no salga vacía.
  insert into public.services (user_id, name, duration_minutes, price, sort) values
    (new.id, 'Corte de cabello', 30, null, 1),
    (new.id, 'Corte + barba', 60, null, 2);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS: cada barbero solo accede a lo suyo
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.business_hours enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- profiles: sin lectura pública (el teléfono y demás datos quedan privados).
drop policy if exists "profiles: leer el propio" on public.profiles;
create policy "profiles: leer el propio" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "business_hours: todo lo propio" on public.business_hours;
create policy "business_hours: todo lo propio" on public.business_hours
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "services: todo lo propio" on public.services;
create policy "services: todo lo propio" on public.services
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- appointments: el barbero lee, actualiza y borra las suyas. El público no tiene
-- ninguna política: reserva solo a través de book_appointment().
drop policy if exists "appointments: leer las propias" on public.appointments;
create policy "appointments: leer las propias" on public.appointments
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "appointments: actualizar las propias" on public.appointments;
create policy "appointments: actualizar las propias" on public.appointments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "appointments: borrar las propias" on public.appointments;
create policy "appointments: borrar las propias" on public.appointments
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- RPC públicas (anon). Devuelven solo lo que la página pública necesita.
-- ---------------------------------------------------------------------

-- Datos para pintar la página /barbero/:slug. Nunca incluye teléfono ni correo.
create or replace function public.get_public_booking_data(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'barbero', json_build_object(
      'user_id', p.user_id,
      'name', p.name,
      'slug', p.slug,
      'timezone', p.timezone,
      'minimum_booking_notice_minutes', p.minimum_booking_notice_minutes
    ),
    'horarios', coalesce((
      select json_agg(json_build_object('day_of_week', h.day_of_week, 'start_time', h.start_time, 'end_time', h.end_time)
                      order by h.day_of_week, h.start_time)
      from public.business_hours h where h.user_id = p.user_id and h.is_working), '[]'::json),
    'servicios', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price', s.price)
                      order by s.sort, s.created_at)
      from public.services s where s.user_id = p.user_id and s.active), '[]'::json)
  )
  from public.profiles p
  where p.slug = lower(trim(p_slug))
$$;

-- Horas ocupadas de un día: inicio y fin, sin ningún dato del cliente.
create or replace function public.get_booked_slots(p_user_id uuid, p_date date)
returns table (start_time time, end_time time)
language sql stable security definer set search_path = public as $$
  select a.start_time, a.end_time
  from public.appointments a
  where a.user_id = p_user_id and a.appointment_date = p_date and a.status <> 'cancelled'
  order by a.start_time
$$;

-- Crea una reserva pública validando todo en el servidor.
create or replace function public.book_appointment(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_notes text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_perfil public.profiles;
  v_servicio public.services;
  v_fin time;
  v_ahora timestamp;
  v_email text := nullif(lower(trim(p_customer_email)), '');
  v_cita public.appointments;
  c_no_disponible constant text := 'Este horario ya no está disponible. Elige otra hora.';
begin
  select * into v_perfil from public.profiles where slug = lower(trim(p_slug));
  if not found then raise exception 'No encontramos a este barbero.'; end if;

  select * into v_servicio from public.services
   where id = p_service_id and user_id = v_perfil.user_id and active;
  if not found then raise exception 'Este servicio ya no está disponible.'; end if;

  if char_length(trim(coalesce(p_customer_name, ''))) < 2 then
    raise exception 'Escribe tu nombre.';
  end if;
  if char_length(regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Escribe un teléfono de 10 dígitos.';
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.';
  end if;

  -- La hora de fin se calcula aquí, no se confía en la del navegador.
  v_fin := p_start_time + make_interval(mins => v_servicio.duration_minutes);
  if v_fin <= p_start_time then raise exception '%', c_no_disponible; end if; -- pasaría de medianoche

  -- "Ahora" en la zona del barbero, nunca en la del cliente.
  v_ahora := now() at time zone v_perfil.timezone;
  if p_date + p_start_time < v_ahora + make_interval(mins => v_perfil.minimum_booking_notice_minutes) then
    raise exception '%', c_no_disponible;
  end if;
  if p_date > (v_ahora::date + 90) then
    raise exception 'Solo se puede reservar con hasta 90 días de anticipación.';
  end if;

  -- Debe caber completa dentro de uno de los tramos de trabajo de ese día.
  if not exists (
    select 1 from public.business_hours h
     where h.user_id = v_perfil.user_id and h.is_working
       and h.day_of_week = extract(dow from p_date)
       and h.start_time <= p_start_time and h.end_time >= v_fin
  ) then
    raise exception '%', c_no_disponible;
  end if;

  begin
    insert into public.appointments (
      user_id, service_id, service_name, service_price, customer_name, customer_phone,
      customer_email, notes, appointment_date, start_time, end_time, status
    ) values (
      v_perfil.user_id, v_servicio.id, v_servicio.name, v_servicio.price, trim(p_customer_name),
      trim(p_customer_phone), v_email, nullif(trim(p_notes), ''), p_date, p_start_time, v_fin, 'confirmed'
    ) returning * into v_cita;
  exception when exclusion_violation then
    raise exception '%', c_no_disponible;
  end;

  return json_build_object(
    'id', v_cita.id,
    'cancel_token', v_cita.cancel_token,
    'appointment_date', v_cita.appointment_date,
    'start_time', v_cita.start_time,
    'end_time', v_cita.end_time,
    'service_name', v_cita.service_name
  );
end $$;

-- El cliente consulta su cita con el enlace que recibió (sin cuenta).
create or replace function public.get_appointment_by_token(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'customer_name', a.customer_name,
    'service_name', a.service_name,
    'service_price', a.service_price,
    'appointment_date', a.appointment_date,
    'start_time', a.start_time,
    'end_time', a.end_time,
    'status', a.status,
    'barbero', json_build_object('name', p.name, 'slug', p.slug, 'timezone', p.timezone),
    -- Se puede cancelar hasta la hora de inicio, en la zona del barbero.
    'se_puede_cancelar', a.status = 'confirmed'
        and (a.appointment_date + a.start_time) > (now() at time zone p.timezone)
  )
  from public.appointments a join public.profiles p on p.user_id = a.user_id
  where a.cancel_token = p_token
$$;

create or replace function public.cancel_appointment_by_token(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  update public.appointments a set status = 'cancelled'
    from public.profiles p
   where a.cancel_token = p_token and p.user_id = a.user_id
     and a.status = 'confirmed'
     and (a.appointment_date + a.start_time) > (now() at time zone p.timezone)
  returning a.id into v_id;
  if v_id is null then
    raise exception 'Esta cita ya no se puede cancelar.';
  end if;
  return json_build_object('id', v_id, 'status', 'cancelled');
end $$;

-- Permisos de las funciones: solo las públicas quedan abiertas a anon.
revoke all on function public.get_public_booking_data(text) from public;
revoke all on function public.get_booked_slots(uuid, date) from public;
revoke all on function public.book_appointment(text, uuid, date, time, text, text, text, text) from public;
revoke all on function public.get_appointment_by_token(uuid) from public;
revoke all on function public.cancel_appointment_by_token(uuid) from public;
revoke all on function public.handle_new_user() from public;
grant execute on function public.get_public_booking_data(text) to anon, authenticated;
grant execute on function public.get_booked_slots(uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, date, time, text, text, text, text) to anon, authenticated;
grant execute on function public.get_appointment_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_appointment_by_token(uuid) to anon, authenticated;
