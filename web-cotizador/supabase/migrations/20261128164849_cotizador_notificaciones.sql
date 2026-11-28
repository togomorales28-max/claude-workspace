-- Notificaciones push: al llegar una cotización se llama a la función notify-quote.
-- Las llaves VAPID viven en Supabase Vault (cotizador_vapid_public / cotizador_vapid_private); no están en el repositorio.
create extension if not exists pg_net with schema extensions;

create or replace function public.cotizador_vapid()
returns json language sql stable security definer set search_path = public, vault as $$
  select json_build_object(
    'public',  (select decrypted_secret from vault.decrypted_secrets where name = 'cotizador_vapid_public'),
    'private', (select decrypted_secret from vault.decrypted_secrets where name = 'cotizador_vapid_private')
  );
$$;
revoke all on function public.cotizador_vapid() from public, anon, authenticated;
grant execute on function public.cotizador_vapid() to service_role;

create or replace function public.cotizador_notify_new_quote()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://zhopyamnoxofvplkzcji.supabase.co/functions/v1/notify-quote',
    body := jsonb_build_object('quote_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  return new; -- si falla el aviso, la cotización se guarda de todos modos
end $$;
revoke all on function public.cotizador_notify_new_quote() from public, anon, authenticated;

drop trigger if exists cotizador_notify_new_quote on public.cotizador_quotes;
create trigger cotizador_notify_new_quote after insert on public.cotizador_quotes
  for each row execute function public.cotizador_notify_new_quote();
