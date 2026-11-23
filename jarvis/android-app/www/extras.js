'use strict';
/* Gmail (solo lectura, ordenado por importancia) y ver la pantalla (burbuja flotante). */

/* ================================================================== Gmail */
const Gmail = (() => {
  const MAIL = /\b(correos?|e-?mails?|gmail|mails?|bandeja|inbox)\b/;
  const connected = () => store.get('jarvis-gmail', '0') === '1';
  const short = (t, n) => (t.length > n ? t.slice(0, n - 1).trim() + '…' : t);
  const who = (m) => short(m.from.replace(/\s*\(.*?\)\s*/g, ' ').trim(), 32);

  function summary(mails) {
    if (!mails.length) return { speak: 'No tienes correos sin leer de los últimos tres días.', show: 'Sin correos nuevos.' };
    const useful = mails.filter((m) => m.score > -2);
    const noise = mails.length - useful.length;
    const parts = [`Tienes ${mails.length} correo${mails.length === 1 ? '' : 's'} sin leer.`];
    if (useful.length) {
      const [first, ...rest] = useful;
      parts.push(`Lo más importante: de ${who(first)}, «${short(first.subject, 70)}».`);
      if (rest.length) parts.push('Después: ' + rest.slice(0, 3).map((m) => `de ${who(m)}, «${short(m.subject, 50)}»`).join('; ') + '.');
      if (rest.length > 3) parts.push(`Y ${rest.length - 3} más.`);
    }
    if (noise) parts.push(`Además, ${noise} ${noise === 1 ? 'es promoción o notificación' : 'son promociones o notificaciones'} sin importancia.`);
    const show = mails.map((m, i) => `${i + 1}. ${m.score >= 3 ? '★ ' : m.score <= -2 ? '· ' : ''}${who(m)} — ${short(m.subject, 80)}`).join('\n');
    return { speak: parts.join(' '), show };
  }

  async function answer() {
    ui.status.textContent = 'REVISANDO GMAIL';
    state.mode = 'thinking';
    let mails;
    try {
      ({ mails } = await J.gmailUnread({ interactive: true }));
      store.set('jarvis-gmail', '1'); render();
    } catch (e) {
      ui.reply.textContent = e.code === 'setup'
        ? 'Para leer tu Gmail falta registrar Jarvis en Google una vez. Abre Ajustes → Gmail y sigue la guía.'
        : (e.message || 'No pude leer Gmail.');
      queueSpeak(e.code === 'setup' ? 'Falta registrar Jarvis en Google. Abre Ajustes, Gmail.' : 'No pude leer tu Gmail.');
      return;
    }
    const s = summary(mails);
    ui.reply.textContent = s.speak + '\n\n' + s.show;
    fullReply = s.speak;
    for (const sentence of s.speak.split(/(?<=[.!?…])\s+/)) queueSpeak(sentence);
  }

  async function connect() {
    try {
      await J.gmailConnect();
      store.set('jarvis-gmail', '1');
      $('gmail-state').textContent = 'Conectado (solo lectura).';
    } catch (e) {
      $('gmail-state').textContent = e.code === 'setup' ? 'Falta el registro en Google: sigue la guía de abajo.' : (e.message || 'No se pudo conectar.');
      $('gmail-guide').open = true;
    }
    render();
  }

  async function render() {
    $('gmail-state').textContent = connected() ? 'Conectado (solo lectura).' : 'Sin conectar.';
    $('gmail-connect').textContent = connected() ? 'Volver a autorizar' : 'Conectar Gmail';
    try {
      const { package: pkg, sha1 } = await J.signingInfo();
      $('gmail-pkg').textContent = pkg; $('gmail-sha1').textContent = sha1;
    } catch {}
  }

  $('gmail-connect').addEventListener('click', connect);
  $('gmail-summary').addEventListener('click', () => { ui.settings.hidden = true; ask('Resume mis correos'); });
  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => {
      const t = $(b.dataset.copy).textContent;
      try { await navigator.clipboard.writeText(t); b.textContent = 'Copiado'; }
      catch { const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); }
      setTimeout(() => { b.textContent = 'Copiar'; }, 1500);
    });
  }
  $('open-settings').addEventListener('click', render);

  return { wants: (t) => MAIL.test(norm(t)), answer };
})();
window.Gmail = Gmail;

/* ================================================================== Pantalla */
const ScreenView = (() => {
  const SCREEN = /\b(mi pantalla|la pantalla|ve (mi|la) pantalla|ver pantalla)\b/;
  const btn = $('screen-toggle'), chipEl = $('chip-screen');

  async function refresh() {
    let st = { running: false };
    try { st = await J.screenStatus(); } catch {}
    chip(chipEl, st.running ? 'PANTALLA · SÍ' : 'PANTALLA', !!st.running);
    btn.textContent = st.running ? 'Dejar de ver la pantalla' : 'Ver pantalla (burbuja flotante)';
    return st.running;
  }

  async function start() {
    const v = window.Vision && Vision.current();
    if (!v) { ui.settings.hidden = true; ui.reply.textContent = 'Primero descarga la visión: toca el botón de la cámara.'; return false; }
    try {
      await J.screenStart({ model: v.model, mmproj: v.mmproj });
      ui.reply.textContent = 'Listo. Ve a cualquier app y toca la burbuja dorada «J»: te diré qué hay en tu pantalla. Para apagarlo usa la notificación o este botón.';
    } catch (e) {
      ui.reply.textContent = e.message || 'No pude ver la pantalla.';
    }
    ui.settings.hidden = true;
    setTimeout(refresh, 800);
    return true;
  }

  async function toggle() {
    if (await refresh()) { await J.screenStop(); setTimeout(refresh, 500); }
    else await start();
  }

  btn.addEventListener('click', toggle);
  chipEl.addEventListener('click', toggle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (J) refresh();

  return { wants: (t) => SCREEN.test(norm(t)), start };
})();
window.ScreenView = ScreenView;
