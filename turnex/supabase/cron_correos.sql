-- =====================================================================
-- Turnex · Correos automáticos cada 15 minutos (pg_cron + pg_net)
--
-- Córrelo UNA vez, después de desplegar la Edge Function. Antes cambia
-- los dos valores marcados con  <<<  por los de tu proyecto
-- (Supabase → Project Settings → API). Se guardan en Vault, no en el código.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda (o actualiza) la URL y la anon key en Vault.
do $$
declare
  v_url text := 'https://TU-PROYECTO.supabase.co';  -- <<< tu Project URL
  v_key text := 'TU-ANON-KEY';                       -- <<< tu anon public key
begin
  if exists (select 1 from vault.secrets where name = 'turnex_url') then
    perform vault.update_secret((select id from vault.secrets where name = 'turnex_url'), v_url);
  else
    perform vault.create_secret(v_url, 'turnex_url');
  end if;
  if exists (select 1 from vault.secrets where name = 'turnex_anon_key') then
    perform vault.update_secret((select id from vault.secrets where name = 'turnex_anon_key'), v_key);
  else
    perform vault.create_secret(v_key, 'turnex_anon_key');
  end if;
end $$;

-- Programa la tarea (si ya existía, la reemplaza).
select cron.unschedule(jobid) from cron.job where jobname = 'turnex-correos';
select cron.schedule('turnex-correos', '*/15 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'turnex_url') || '/functions/v1/send-appointment-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'turnex_anon_key')
    ),
    body := '{"job":"pendientes"}'::jsonb
  );
$job$);
