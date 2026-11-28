// Manda una notificación push al dueño cuando llega una cotización nueva.
// La llama la base de datos (trigger cotizador_notify_new_quote) con { quote_id }.
// Sólo avisa una vez por cotización y sólo de cotizaciones recientes, así que llamarla a mano no sirve para mandar spam.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Respuesta de prueba para comprobar el envío cifrado (no manda nada)
  if (url.searchParams.has('ping')) return new Response(null, { status: 201 });
  if (req.method !== 'POST') return json({ ok: true });

  let quoteId: number | null = null;
  try { quoteId = Number((await req.json()).quote_id) || null; } catch { /* cuerpo inválido */ }
  if (!quoteId) return json({ error: 'falta quote_id' }, 400);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Marca la cotización como avisada (sólo si es reciente y no se avisó antes)
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: q, error: qErr } = await sb.from('cotizador_quotes')
    .update({ notified: true })
    .eq('id', quoteId).eq('notified', false).gte('created_at', since)
    .select('id, folio, client_name, total, currency, detail')
    .maybeSingle();
  if (qErr) return json({ error: qErr.message }, 500);
  if (!q) return json({ skipped: true });

  const { data: keys, error: kErr } = await sb.rpc('cotizador_vapid');
  if (kErr || !keys?.public || !keys?.private) return json({ error: 'sin llaves VAPID' }, 500);
  webpush.setVapidDetails('https://rojoironworksaz.com', keys.public, keys.private);

  const money = new Intl.NumberFormat(q.currency === 'MXN' ? 'es-MX' : 'en-US', { style: 'currency', currency: q.currency || 'USD', maximumFractionDigits: 0 }).format(Number(q.total) || 0);
  const first = Array.isArray(q.detail) && q.detail[0]?.text ? String(q.detail[0].text).split(' — ')[0] : 'Cotización';
  const payload = JSON.stringify({
    title: `Nueva cotización · ${money}`,
    body: `${q.client_name} — ${first} (${q.folio})`,
    tag: `cotizacion-${q.id}`,
    url: './admin.html',
  });

  const { data: subs } = await sb.from('cotizador_push_subs').select('id, endpoint, p256dh, auth');
  let sent = 0, removed = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from('cotizador_push_subs').delete().eq('id', s.id); removed++; }
    }
  }));
  return json({ quote: q.id, sent, removed, devices: subs?.length ?? 0 });
});
