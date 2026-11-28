-- ═══════════════════════════════════════════════════════════════════
--  Cotizador de herrería · Supabase
--  Pega TODO este archivo en Supabase → SQL Editor → Run.
--  Antes, cambia TU_CORREO@gmail.com (al final) por el correo con el que vas a entrar al panel.
--  Se puede correr varias veces sin borrar tus datos.
-- ═══════════════════════════════════════════════════════════════════

-- Correo(s) del dueño: los únicos que pueden cambiar precios y ver cotizaciones.
create table if not exists public.cotizador_owner (
  email text primary key
);

-- Precios y ajustes (una sola fila). La web la lee; sólo el dueño la cambia.
create table if not exists public.cotizador_config (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Cotizaciones que mandan los clientes desde la web.
create table if not exists public.cotizador_quotes (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  folio        text not null,
  client_name  text not null,
  client_phone text not null,
  contact_via  text not null default 'whatsapp' check (contact_via in ('whatsapp', 'sms')),
  address      text,
  notes        text,
  total        numeric not null check (total >= 0),
  low          numeric,
  high         numeric,
  currency     text,
  detail       jsonb not null default '[]'::jsonb,
  message      text,
  status       text not null default 'nueva' check (status in ('nueva', 'contactado', 'vendida', 'descartada'))
);
create index if not exists cotizador_quotes_created_idx on public.cotizador_quotes (created_at desc);

-- ¿Quien hizo la petición es el dueño? (compara el correo de la sesión con cotizador_owner)
create or replace function public.cotizador_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cotizador_owner o
    where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.cotizador_is_owner() to anon, authenticated;

-- ── Seguridad por filas ──
alter table public.cotizador_owner  enable row level security;
alter table public.cotizador_config enable row level security;
alter table public.cotizador_quotes enable row level security;
-- (cotizador_owner no tiene políticas: nadie la lee ni la cambia desde la web; sólo desde este editor)

drop policy if exists "config: todos leen" on public.cotizador_config;
create policy "config: todos leen" on public.cotizador_config
  for select to anon, authenticated using (true);

drop policy if exists "config: solo el dueño cambia" on public.cotizador_config;
create policy "config: solo el dueño cambia" on public.cotizador_config
  for update to authenticated using (public.cotizador_is_owner()) with check (public.cotizador_is_owner());

drop policy if exists "cotizaciones: cualquiera envía" on public.cotizador_quotes;
create policy "cotizaciones: cualquiera envía" on public.cotizador_quotes
  for insert to anon, authenticated
  with check (
    char_length(client_name) between 1 and 120
    and char_length(client_phone) between 10 and 20
    and status = 'nueva'
    and coalesce(char_length(message), 0) <= 8000
  );

drop policy if exists "cotizaciones: solo el dueño ve" on public.cotizador_quotes;
create policy "cotizaciones: solo el dueño ve" on public.cotizador_quotes
  for select to authenticated using (public.cotizador_is_owner());

drop policy if exists "cotizaciones: solo el dueño actualiza" on public.cotizador_quotes;
create policy "cotizaciones: solo el dueño actualiza" on public.cotizador_quotes
  for update to authenticated using (public.cotizador_is_owner()) with check (public.cotizador_is_owner());

drop policy if exists "cotizaciones: solo el dueño borra" on public.cotizador_quotes;
create policy "cotizaciones: solo el dueño borra" on public.cotizador_quotes
  for delete to authenticated using (public.cotizador_is_owner());

grant select on public.cotizador_config to anon, authenticated;
grant update on public.cotizador_config to authenticated;
grant insert on public.cotizador_quotes to anon, authenticated;
grant select, update, delete on public.cotizador_quotes to authenticated;

-- ── Tiempo real: la web se actualiza sola al cambiar precios y el panel ve cotizaciones nuevas al momento ──
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cotizador_config') then
      execute 'alter publication supabase_realtime add table public.cotizador_config';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cotizador_quotes') then
      execute 'alter publication supabase_realtime add table public.cotizador_quotes';
    end if;
  end if;
end $$;

-- ── Precios iniciales (los de ejemplo; los cambias en el panel). No sobrescribe si ya existen. ──
insert into public.cotizador_config (id, data)
values (1, $cfg${"business": "Mi Herrería", "whatsapp": "+526313029172", "countryCode": "1", "currency": "USD", "unit": "ft", "rangePct": 15, "roundTo": 17, "wastePct": 10, "labor": {"payPerDay": 40, "minPerPerson": 40, "maxPersons": 2}, "disclaimer": "Este es un estimado automático. El precio final puede variar según las medidas exactas, el diseño, los materiales y la instalación. Te confirmamos el precio después de revisar tu proyecto.", "metals": [{"id": "tc2", "name": "Tubo cuadrado 2\" × 2\" cal. 14", "price": 3.0}, {"id": "tc15", "name": "Tubo cuadrado 1½\" × 1½\" cal. 16", "price": 1.8}, {"id": "tc1", "name": "Tubo cuadrado 1\" × 1\" cal. 16", "price": 1.1}, {"id": "tc34", "name": "Tubo cuadrado ¾\" × ¾\" cal. 18", "price": 0.75}, {"id": "bc12", "name": "Barra cuadrada maciza ½\"", "price": 1.0}, {"id": "ang", "name": "Ángulo 1½\" × 1½\" × ⅛\"", "price": 1.6}], "types": [{"id": "porton", "name": "Portón", "mode": "area", "frameMetal": "tc2", "barMetal": "tc1", "rails": 2, "height": 0, "postEvery": 0, "material": 0, "refA": 10, "refB": 24, "refPersons": 2, "refDays": 1, "min": 280, "active": true}, {"id": "reja", "name": "Reja / protección de ventana", "mode": "area", "frameMetal": "tc1", "barMetal": "bc12", "rails": 1, "height": 0, "postEvery": 0, "material": 0, "refA": 4, "refB": 4, "refPersons": 1, "refDays": 0.5, "min": 400, "active": false}, {"id": "barandal", "name": "Barandal", "mode": "lineal", "frameMetal": "tc15", "barMetal": "tc34", "rails": 2, "height": 3, "postEvery": 6, "material": 0, "refA": 10, "refB": 0, "refPersons": 1, "refDays": 1, "min": 200, "active": false}, {"id": "puerta", "name": "Puerta de herrería", "mode": "area", "frameMetal": "tc15", "barMetal": "tc1", "rails": 2, "height": 0, "postEvery": 0, "material": 0, "refA": 3, "refB": 7, "refPersons": 1, "refDays": 1, "min": 0, "active": true}], "designs": [{"id": "sencillo", "name": "Sencillo", "desc": "Líneas rectas, barrotes lisos", "spacing": 5, "pct": 0}, {"id": "medio", "name": "Con detalles", "desc": "Remates, combinación de perfiles", "spacing": 4, "pct": 25}, {"id": "decorado", "name": "Decorado", "desc": "Forja, figuras, lámina cortada", "spacing": 4, "pct": 60}], "features": [{"id": "curvas", "name": "Curvas o arcos", "desc": "Partes dobladas, arco arriba, ondas", "pct": 20, "keywords": "arco, curva, curvo, curveado, onda, ondulado, redondo, media luna"}, {"id": "forja", "name": "Forja y adornos", "desc": "Figuras, flores, lanzas, espirales", "pct": 30, "keywords": "forja, figura, adorno, flor, lanza, punta, roseta, voluta, espiral, decorado, colonial, rustico"}, {"id": "lamina", "name": "Lámina calada o cortada", "desc": "Diseños cortados en lámina o placa", "pct": 25, "keywords": "calado, calada, laser, plasma, perforad, letras, logo, recortad"}, {"id": "peatonal", "name": "Puerta peatonal integrada", "desc": "Puerta chica dentro del portón", "pct": 15, "keywords": "peatonal, puerta chica, puertita, puerta pequena, entrada de personas"}, {"id": "corredizo", "name": "Corredizo o abatible doble", "desc": "Rieles, ruedas, dos hojas", "pct": 10, "keywords": "corrediz, riel, rueda, dos hojas, doble hoja, abatible"}, {"id": "motor", "name": "Preparación para motor", "desc": "Para abrir con control", "pct": 10, "keywords": "motor, automatic, control remoto, electrico"}, {"id": "acabado", "name": "Acabado especial", "desc": "Galvanizado, dos colores, pintura especial", "pct": 10, "keywords": "galvaniz, dos colores, electrostatic, pintura especial, dorado, cobre, oxidado"}, {"id": "acceso", "name": "Difícil acceso o altura", "desc": "Segundo piso, escaleras, andamio", "pct": 15, "keywords": "segundo piso, segunda planta, andamio, azotea, balcon, dificil acceso"}], "examplePrices": true}$cfg$::jsonb)
on conflict (id) do nothing;

-- ══ CAMBIA ESTE CORREO por el tuyo ══
insert into public.cotizador_owner (email) values ('TU_CORREO@gmail.com')
on conflict (email) do nothing;
