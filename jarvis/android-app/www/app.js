'use strict';
/* Jarvis para Android: todo dentro del teléfono.
   Cerebro: llama.cpp + modelo Qwen 2.5 (código abierto). Oído y voz: los de Android, sin conexión. */

const J = window.Capacitor && window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin('Jarvis') : null;
const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'), you: $('you'), reply: $('reply'), form: $('form'), text: $('text'), mic: $('mic'),
  chipBrain: $('chip-brain'), chipNet: $('chip-net'),
  setup: $('setup'), setupDetail: $('setup-detail'), setupProgress: $('setup-progress'), setupBar: $('setup-bar'),
  setupStatus: $('setup-status'), setupDownload: $('setup-download'),
  settings: $('settings'), models: $('models'), device: $('device'), voice: $('voice'), rate: $('rate'),
  continuous: $('continuous'),
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// Modelos de código abierto (Qwen 2.5 Instruct, formato GGUF, cuantizado Q4_K_M).
const HF = 'https://huggingface.co/Qwen';
const MODELS = [
  { id: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', name: 'Ligero', size: '0,5 GB', mb: 470, minRam: 0,
    url: `${HF}/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`,
    note: 'Muy rápido, respuestas sencillas. Para teléfonos de 4 GB.' },
  { id: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', name: 'Equilibrado', size: '1,1 GB', mb: 1070, minRam: 5000,
    url: `${HF}/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf`,
    note: 'Buen español y velocidad aceptable. Recomendado con 6 GB o más.' },
  { id: 'qwen2.5-3b-instruct-q4_k_m.gguf', name: 'Listo', size: '2,0 GB', mb: 1930, minRam: 7500,
    url: `${HF}/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf`,
    note: 'Más inteligente pero lento en teléfonos de gama media. Necesita 8 GB.' },
];

let info = null, ready = false, busy = false, listening = false, stopRequested = false, downloading = null;
const LABELS = { idle: 'EN ESPERA', listening: 'ESCUCHANDO', thinking: 'PENSANDO', speaking: 'HABLANDO', loading: 'CARGANDO CEREBRO' };
function setMode(m) { state.mode = m === 'loading' ? 'thinking' : m; ui.status.textContent = LABELS[m] || m; }
function chip(el, text, ok) { el.textContent = text; el.className = 'chip ' + (ok ? 'ok' : 'warn'); }

function systemPrompt() {
  const now = new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' });
  return 'Eres Jarvis, el asistente personal por voz del usuario. Responde SIEMPRE en español, de forma breve ' +
    '(1 a 3 frases), natural y amable, como si hablaras en voz alta. No uses listas, markdown, emojis ni símbolos. ' +
    'Si no sabes algo con seguridad, dilo. Hoy es ' + now + '.';
}

/* ------------------------------------------------------------------ arranque */
async function boot() {
  if (!J) { ui.status.textContent = 'ABRE ESTO DESDE LA APP JARVIS'; return; }
  J.addListener('token', onToken);
  J.addListener('partial', ({ text }) => { ui.you.textContent = text; });
  J.addListener('level', ({ level }) => { if (listening) state.level = level; });
  J.addListener('listen', ({ state: s }) => { if (s === 'listening') setMode('listening'); });
  J.addListener('download', onDownload);
  J.addListener('speechModel', () => { ui.you.textContent = 'Descargando español sin conexión; mientras tanto uso internet.'; });
  window.addEventListener('online', updateNet); window.addEventListener('offline', updateNet); updateNet();

  ui.continuous.checked = store.get('jarvis-continuous', '1') === '1';
  ui.rate.value = store.get('jarvis-rate', '1');
  info = await J.info();
  ui.device.textContent = `${info.device} · ${(info.ramMB / 1024).toFixed(1)} GB de RAM · ${(info.freeDiskMB / 1024).toFixed(1)} GB libres`;
  loadVoices();

  const chosen = store.get('jarvis-model', '');
  const have = (id) => info.models.some((m) => m.file === id);
  const model = have(chosen) ? chosen : (MODELS.slice().reverse().find((m) => have(m.id)) || {}).id;
  if (model) return startModel(model);
  showSetup();
}

function recommended() {
  return MODELS.slice().reverse().find((m) => info.ramMB >= m.minRam && m.minRam < 7500) || MODELS[0];
}

function showSetup() {
  const m = recommended();
  ui.setup.hidden = false;
  ui.setupDetail.textContent = `Para tu ${info.device} recomiendo el cerebro «${m.name}» (${m.size}). Usa Wi-Fi: después funciona sin internet.`;
  ui.setupDownload.onclick = () => download(m, true);
  chip(ui.chipBrain, 'IA · SIN DESCARGAR', false);
  setMode('idle');
  ui.reply.textContent = '';
}

/* ------------------------------------------------------------------ cerebro */
async function download(m, fromSetup) {
  if (downloading) return;
  if (info.freeDiskMB < m.mb + 200) { alertText(`No hay espacio: necesitas ${m.size} libres.`); return; }
  downloading = m.id;
  ui.setupDownload.disabled = true; ui.setupProgress.hidden = false;
  ui.setupStatus.textContent = 'Conectando…';
  renderModels();
  try {
    await J.downloadModel({ url: m.url, file: m.id });
    downloading = null;
    info = await J.info();
    renderModels();
    if (fromSetup || !ready) { ui.setup.hidden = true; await startModel(m.id); }
  } catch (e) {
    downloading = null;
    ui.setupDownload.disabled = false;
    ui.setupStatus.textContent = 'No se pudo descargar: ' + (e.message || e) + '. Revisa la conexión y vuelve a intentarlo (continúa donde se quedó).';
    renderModels();
  }
}

function onDownload({ file, received, total }) {
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  ui.setupBar.style.width = pct + '%';
  ui.setupStatus.textContent = `Descargando… ${(received / 1048576).toFixed(0)} de ${(total / 1048576).toFixed(0)} MB (${pct} %)`;
  const row = document.querySelector(`[data-model="${CSS.escape(file)}"] .model-progress`);
  if (row) row.textContent = `Descargando ${pct} %`;
}

async function startModel(id) {
  ready = false;
  setMode('loading');
  chip(ui.chipBrain, 'IA · CARGANDO', false);
  ui.reply.textContent = 'Despertando… (la primera vez tarda unos segundos)';
  try {
    await J.loadModel({ file: id, ctx: 2048 });
    await J.resetChat({ system: systemPrompt() });
    store.set('jarvis-model', id);
    info = await J.info();
    ready = true;
    const m = MODELS.find((x) => x.id === id);
    chip(ui.chipBrain, `IA · ${m ? m.name.toUpperCase() : 'LISTA'}`, true);
    setMode('idle');
    ui.reply.textContent = 'Listo. Toca el núcleo o el micrófono y háblame.';
    renderModels();
  } catch (e) {
    chip(ui.chipBrain, 'IA · ERROR', false);
    setMode('idle');
    ui.reply.textContent = 'No pude cargar el cerebro: ' + (e.message || e) + ' Prueba un modelo más ligero en Ajustes.';
  }
}

/* ------------------------------------------------------------------ conversación */
let sentenceBuf = '', speakChain = Promise.resolve(), fullReply = '';

function clean(t) { return t.replace(/[*#_`>|~]/g, '').replace(/\s+/g, ' ').trim(); }

function onToken({ text }) {
  if (stopRequested) return;
  fullReply += text;
  ui.reply.textContent = clean(fullReply);
  ui.reply.scrollTop = ui.reply.scrollHeight;
  sentenceBuf += text;
  // Habla frase por frase mientras sigue pensando: responde antes.
  // Corta en el primer final de frase que deje al menos 12 letras (las frases muy cortas se juntan con la siguiente).
  const re = /[.!?…:;\n](?=\s)/g;
  let m;
  while ((m = re.exec(sentenceBuf))) {
    const head = sentenceBuf.slice(0, m.index + 1);
    if (clean(head).length > 12) {
      queueSpeak(head);
      sentenceBuf = sentenceBuf.slice(m.index + 1);
      break;
    }
  }
}

function queueSpeak(text) {
  const t = clean(text);
  if (!t || stopRequested) return;
  speakChain = speakChain.then(() => {
    if (stopRequested) return;
    setMode('speaking');
    const fake = setInterval(() => { state.level = 0.25 + Math.random() * 0.6; }, 90);
    return J.speak({ text: t, rate: Number(ui.rate.value) }).catch(() => {}).finally(() => { clearInterval(fake); state.level = 0; });
  });
}

/* ------------------------------------------------------------------ búsqueda en internet */
const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Preguntas sobre cosas actuales: el cerebro local no las sabe, mejor buscar primero.
const NEEDS_WEB = /\b(hoy|ayer|anoche|manana|ahora|actual|actualmente|ultim[oa]s?|reciente|noticias?|partido|juego|jugo|juega|juegan|gano|ganaron|perdio|marcador|resultado|clima|temperatura|llover|lluvia|precio|cuesta|cuanto vale|dolar|euro|bitcoin|eleccion|presidente|estreno|busca|buscar|investiga|internet|google|vs|contra|20[2-3][0-9])\b/;
const NO_ACCESS = /(no tengo acceso|no puedo proporcionar|no dispongo|tiempo real|informacion actualizada|no tengo informacion|no estoy actualizado|mi conocimiento)/;

function webEnabled() { return navigator.onLine && store.get('jarvis-web', '1') === '1'; }

async function webContext(question) {
  setMode('thinking'); ui.status.textContent = 'BUSCANDO EN INTERNET';
  try {
    const { results } = await J.webSearch({ q: question });
    if (!results || !results.length) return '';
    let ctx = '', n = 0;
    for (const r of results) {
      const line = `${++n}. ${r.title} (${r.source}): ${r.snippet}\n`;
      if (ctx.length + line.length > 1400) break;
      ctx += line;
    }
    return ctx;
  } catch { return ''; }
}

function withWeb(question, ctx) {
  const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'full' });
  return `Pregunta del usuario: ${question}\n\nResultados de internet de hoy (${today}):\n${ctx}\n` +
    'Responde la pregunta usando solo estos resultados, en 1 a 3 frases. Si no aparece la respuesta, dilo. No inventes datos.';
}

async function ask(text) {
  text = text.trim();
  if (!text || busy) return;
  if (!ready) { ui.reply.textContent = 'Primero descarga el cerebro.'; return; }
  busy = true; stopRequested = false;
  fullReply = ''; sentenceBuf = ''; speakChain = Promise.resolve();
  ui.you.textContent = text; ui.reply.textContent = '…';
  setMode('thinking');
  try {
    let searched = false;
    if (webEnabled() && NEEDS_WEB.test(norm(text))) {
      const ctx = await webContext(text);
      searched = true;
      setMode('thinking');
      await J.generate({ text: ctx ? withWeb(text, ctx) : text, maxTokens: 300 });
    } else {
      await J.generate({ text, maxTokens: 300 });
    }
    // Si el cerebro dice que no sabe algo actual, buscar y volver a contestar una vez.
    if (!stopRequested && !searched && webEnabled() && NO_ACCESS.test(norm(fullReply))) {
      await J.stopSpeaking().catch(() => {});
      speakChain = Promise.resolve(); sentenceBuf = ''; fullReply = '';
      ui.reply.textContent = 'Déjame buscarlo en internet…';
      const ctx = await webContext(text);
      if (ctx) { setMode('thinking'); await J.generate({ text: withWeb(text, ctx), maxTokens: 300 }); }
    }
    if (!stopRequested && sentenceBuf.trim()) queueSpeak(sentenceBuf);
    sentenceBuf = '';
    if (!clean(fullReply)) ui.reply.textContent = '…';
    await speakChain;
  } catch (e) {
    ui.reply.textContent = 'Error: ' + (e.message || e);
  } finally {
    busy = false;
    setMode('idle');
    if (ui.continuous.checked && !stopRequested && fullReply) setTimeout(listen, 350);
  }
}

async function listen() {
  if (busy || listening || !ready) return;
  listening = true;
  ui.mic.classList.add('live');
  ui.you.textContent = '…';
  setMode('listening');
  try {
    const { text } = await J.listen({ lang: (navigator.language || '').startsWith('es') ? navigator.language : 'es-MX' });
    listening = false; ui.mic.classList.remove('live'); state.level = 0;
    if (text && text.trim()) return ask(text);
    ui.you.textContent = '';
    setMode('idle');
  } catch (e) {
    listening = false; ui.mic.classList.remove('live'); state.level = 0;
    setMode('idle');
    ui.you.textContent = '';
    ui.reply.textContent = e.code === 'not_granted' ? 'Necesito permiso de micrófono para escucharte.' : (e.message || 'No pude escucharte.');
  }
}

async function stopAll() {
  stopRequested = true;
  if (listening) { await J.stopListening(); return; }
  await J.stopGenerate().catch(() => {});
  await J.stopSpeaking().catch(() => {});
  setMode('idle');
}

/* ------------------------------------------------------------------ ajustes */
function renderModels() {
  if (!info) return;
  const rec = recommended().id;
  ui.models.innerHTML = '';
  for (const m of MODELS) {
    const have = info.models.some((x) => x.file === m.id);
    const active = info.loaded === m.id;
    const box = document.createElement('div');
    box.className = 'model' + (active ? ' active' : '');
    box.dataset.model = m.id;
    box.innerHTML = `<div class="model-head"><span class="model-name"></span><span class="model-tag"></span></div>
      <div class="muted"></div><div class="muted model-progress"></div><div class="model-actions"></div>`;
    box.querySelector('.model-name').textContent = `${m.name} · ${m.size}`;
    box.querySelector('.model-tag').textContent = active ? 'EN USO' : m.id === rec ? 'RECOMENDADO' : '';
    box.querySelector('.muted').textContent = m.note + (info.ramMB < m.minRam ? ' Tu teléfono tiene poca memoria para este.' : '');
    const actions = box.querySelector('.model-actions');
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = fn; actions.appendChild(b); return b; };
    if (downloading === m.id) {
      box.querySelector('.model-progress').textContent = 'Descargando…';
      btn('Cancelar', 'secondary', () => J.cancelDownload());
    } else if (!have) {
      btn('Descargar', 'primary', () => download(m, false)).disabled = !!downloading;
    } else {
      if (!active) btn('Usar', 'primary', () => { ui.settings.hidden = true; startModel(m.id); });
      if (!active) btn('Borrar', 'secondary', async () => { await J.deleteModel({ file: m.id }); info = await J.info(); renderModels(); });
    }
    ui.models.appendChild(box);
  }
}

async function loadVoices() {
  try {
    const { voices } = await J.voices();
    const saved = store.get('jarvis-voice', '');
    for (const v of voices.sort((a, b) => Number(b.offline) - Number(a.offline))) {
      const o = document.createElement('option');
      o.value = v.name;
      o.textContent = `${v.lang} · ${v.name.replace(/^es-|-x-|#.*/g, ' ').trim()}${v.offline ? ' · sin internet' : ' · necesita internet'}${v.installed ? '' : ' (no descargada)'}`;
      ui.voice.appendChild(o);
    }
    if (saved) { ui.voice.value = saved; J.setVoice({ name: saved }); }
  } catch {}
}

function updateNet() {
  chip(ui.chipNet, navigator.onLine ? 'INTERNET · SÍ' : 'SIN INTERNET · OK', true);
}
function alertText(t) { ui.reply.textContent = t; ui.setupStatus.textContent = t; }

/* ------------------------------------------------------------------ controles */
canvas.addEventListener('click', () => (busy || listening ? stopAll() : listen()));
// El botón es micrófono cuando la caja está vacía y "enviar" cuando hay texto escrito.
function updateButton() {
  const typing = ui.text.value.trim().length > 0;
  $('icon-mic').toggleAttribute('hidden', typing);   // los SVG no tienen la propiedad .hidden
  $('icon-send').toggleAttribute('hidden', !typing);
  ui.mic.setAttribute('aria-label', typing ? 'Enviar' : 'Hablar');
}
ui.text.addEventListener('input', updateButton);
ui.mic.addEventListener('click', () => {
  if (ui.text.value.trim()) return sendTyped();
  return listening || busy ? stopAll() : listen();
});
function sendTyped() {
  const t = ui.text.value; ui.text.value = ''; ui.text.blur(); updateButton();
  ask(t);
}
ui.form.addEventListener('submit', (e) => { e.preventDefault(); sendTyped(); });
$('open-settings').addEventListener('click', () => { renderModels(); ui.settings.hidden = false; });
$('close-settings').addEventListener('click', () => { ui.settings.hidden = true; });
ui.settings.addEventListener('click', (e) => { if (e.target === ui.settings) ui.settings.hidden = true; });
$('web').checked = store.get('jarvis-web', '1') === '1';
$('web').addEventListener('change', (e) => store.set('jarvis-web', e.target.checked ? '1' : '0'));
ui.continuous.addEventListener('change', () => store.set('jarvis-continuous', ui.continuous.checked ? '1' : '0'));
ui.rate.addEventListener('change', () => store.set('jarvis-rate', ui.rate.value));
ui.voice.addEventListener('change', () => { store.set('jarvis-voice', ui.voice.value); J.setVoice({ name: ui.voice.value }); });
$('test-voice').addEventListener('click', () => J.speak({ text: 'Hola, soy Jarvis. Así sueno.', rate: Number(ui.rate.value) }));
$('voice-settings').addEventListener('click', () => J.openVoiceSettings().catch(() => {}));
$('speech-download').addEventListener('click', async () => {
  try {
    await J.downloadSpeechModel({ lang: (navigator.language || '').startsWith('es') ? navigator.language : 'es-MX' });
    $('speech-download').textContent = 'Descarga iniciada (unos minutos, con Wi-Fi)';
  } catch (e) {
    $('speech-download').textContent = 'Hazlo en Ajustes del teléfono → Administración general → Idioma';
  }
});
$('new-chat').addEventListener('click', async () => {
  if (!ready) return;
  await J.resetChat({ system: systemPrompt() });
  ui.you.textContent = ''; ui.reply.textContent = 'Conversación nueva.';
  ui.settings.hidden = true;
});

boot().catch((e) => {
  ui.status.textContent = 'ERROR AL INICIAR';
  ui.reply.textContent = 'Algo falló al arrancar: ' + (e && e.message ? e.message : e) + '. Cierra y vuelve a abrir Jarvis.';
});
