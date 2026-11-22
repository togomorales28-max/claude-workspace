'use strict';

/* =====================================================================
   1. NÚCLEO HOLOGRÁFICO (canvas)
   ===================================================================== */
const canvas = document.getElementById('orb');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, R = 200;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  R = Math.min(W, H) * 0.34;
}
window.addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// Fragmentos de datos sobre la superficie de la esfera
const shards = Array.from({ length: 1900 }, () => {
  const u = Math.random() * 2 - 1, th = Math.random() * TAU, s = Math.sqrt(1 - u * u);
  return {
    x: s * Math.cos(th), y: u, z: s * Math.sin(th),
    r: rand(0.82, 1.04), len: rand(0.015, 0.11), w: rand(0.7, 2.6),
    tw: Math.random() * TAU, sp: rand(0.5, 3),
  };
});

// Anillos 3D inclinados (como órbitas) con trazos discontinuos
const rings = Array.from({ length: 7 }, (_, i) => ({
  tiltX: rand(-1.2, 1.2), tiltZ: rand(-1, 1), r: rand(0.55, 1.08),
  speed: rand(-0.5, 0.5) || 0.2, dash: Math.floor(rand(18, 70)), fill: rand(0.35, 0.85),
  phase: Math.random() * TAU, width: i < 2 ? 2.2 : rand(0.8, 1.6),
}));

// Marcas radiales del aro exterior (estilo HUD)
const ticks = Array.from({ length: 160 }, (_, i) => ({
  a: (i / 160) * TAU, l: Math.random() < 0.15 ? rand(10, 34) : rand(2, 9), on: Math.random() < 0.8,
}));

const state = { mode: 'idle', level: 0, energy: 0.25 };

function rotate(p, ay, ax) {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const x = p.x * cy + p.z * sy;
  let z = -p.x * sy + p.z * cy;
  const y = p.y * cx - z * sx;
  z = p.y * sx + z * cx;
  return { x, y, z };
}

function gold(alpha, light = 60) { return `hsla(${30 + light / 8}, 100%, ${light}%, ${Math.min(1, alpha)})`; }

let t0 = performance.now(), spin = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  const target = { idle: 0.25, listening: 0.55, thinking: 0.9, speaking: 0.6 }[state.mode];
  state.energy += (target - state.energy) * dt * 2;
  const pulse = state.mode === 'speaking' ? state.level : state.mode === 'listening' ? 0.15 + 0.1 * Math.sin(now / 180) : 0;
  spin += dt * (0.15 + state.energy * 0.6);

  const cx = W / 2, cy = H * 0.46, rad = R * (1 + pulse * 0.08);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';

  // Halo
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 1.5);
  g.addColorStop(0, gold(0.32 + pulse * 0.3, 58));
  g.addColorStop(0.45, gold(0.12 + state.energy * 0.08, 45));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const tiltX = 0.35 + Math.sin(now / 5000) * 0.1;

  // Fragmentos de la esfera
  for (const s of shards) {
    const p1 = rotate(s, spin, tiltX), p2 = rotate(s, spin + s.len, tiltX);
    const depth = (p1.z + 1) / 2; // 0 atrás, 1 delante
    const flick = 0.55 + 0.45 * Math.sin(now / 1000 * s.sp + s.tw);
    const a = (0.3 + depth * 0.9) * flick * (0.8 + state.energy * 0.6);
    const k = rad * s.r * (1 + pulse * 0.1 * Math.sin(s.tw));
    ctx.strokeStyle = gold(a, 55 + depth * 25);
    ctx.lineWidth = s.w * (0.6 + depth * 0.8);
    ctx.beginPath();
    ctx.moveTo(cx + p1.x * k, cy + p1.y * k);
    ctx.lineTo(cx + p2.x * k, cy + p2.y * k);
    ctx.stroke();
  }

  // Anillos orbitales
  for (const r of rings) {
    const seg = TAU / r.dash;
    const rot = r.phase + now / 1000 * r.speed * (0.6 + state.energy);
    for (let i = 0; i < r.dash; i++) {
      const a0 = i * seg + rot, a1 = a0 + seg * r.fill;
      let first = true;
      ctx.beginPath();
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (a1 - a0) * (k / 4);
        let p = rotate({ x: Math.cos(a), y: 0, z: Math.sin(a) }, 0, r.tiltX);
        const cz = Math.cos(r.tiltZ), sz = Math.sin(r.tiltZ);
        p = { x: p.x * cz - p.y * sz, y: p.x * sz + p.y * cz, z: p.z };
        p = rotate(p, spin * 0.4, tiltX);
        const x = cx + p.x * rad * r.r, y = cy + p.y * rad * r.r;
        first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false;
        if (k === 2) ctx.strokeStyle = gold(0.35 + (p.z + 1) * 0.35, 64);
      }
      ctx.lineWidth = r.width; ctx.stroke();
    }
  }

  // Aro exterior plano con marcas
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-spin * 0.5);
  for (const tk of ticks) {
    if (!tk.on) continue;
    const r0 = rad * 1.1, r1 = r0 + tk.l * (1 + pulse);
    ctx.strokeStyle = gold(0.6, 62); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(tk.a) * r0, Math.sin(tk.a) * r0);
    ctx.lineTo(Math.cos(tk.a) * r1, Math.sin(tk.a) * r1);
    ctx.stroke();
  }
  ctx.strokeStyle = gold(0.45, 62); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, rad * 1.08, 0.2, TAU * 0.62); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, rad * 1.24, TAU * 0.7, TAU * 0.95); ctx.stroke();
  ctx.restore();

  // Espiral central y núcleo
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin * 1.3);
  ctx.lineWidth = 3.5 + pulse * 3; ctx.strokeStyle = gold(0.85, 72);
  ctx.beginPath();
  for (let a = 0; a < TAU * 1.15; a += 0.05) {
    const rr = rad * (0.08 + a / (TAU * 1.15) * 0.62);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.82;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.rotate(-spin * 2.6);
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = gold(0.5 + pulse * 0.4, 78);
    ctx.beginPath(); ctx.arc(0, 0, rad * (0.07 + i * 0.035) * (1 + pulse * 0.4), i, i + TAU * 0.75); ctx.stroke();
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 0.14);
  core.addColorStop(0, gold(0.9, 92)); core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, rad * 0.14 * (1 + pulse * 0.6), 0, TAU); ctx.fill();
  ctx.restore();

  // Chispas sueltas
  for (let i = 0; i < 90 + state.energy * 120; i++) {
    const a = Math.random() * TAU, rr = rad * rand(0.3, 1.25);
    ctx.fillStyle = gold(0.3 + Math.random() * 0.7, 82);
    ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rand(1, 2.5), rand(1, 2.5));
  }

  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* =====================================================================
   2. INTERFAZ
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const ui = {
  status: $('status'), you: $('you'), reply: $('reply'), form: $('form'), text: $('text'),
  session: $('session'), handsfree: $('handsfree'), tools: $('tools'),
  chipBrain: $('chip-brain'), chipVoice: $('chip-voice'), chipMic: $('chip-mic'),
};
const LABELS = { idle: 'EN ESPERA', listening: 'ESCUCHANDO', thinking: 'PROCESANDO', speaking: 'HABLANDO' };
function setMode(m) { state.mode = m; ui.status.textContent = LABELS[m]; }
function chip(el, label, ok) { el.textContent = label; el.className = 'chip ' + (ok ? 'ok' : 'warn'); }

let sessions = [];
let current = { id: '', cwd: '' };
let voiceOn = false;

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'X-Jarvis': '1', 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) {
    let msg = r.statusText; try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return r;
}

async function init() {
  try {
    const s = await (await api('/api/status')).json();
    voiceOn = s.voice;
    chip(ui.chipVoice, s.voice ? 'VOZ · ELEVENLABS' : 'VOZ · NAVEGADOR', s.voice);
    chip(ui.chipBrain, 'CEREBRO · CLAUDE CODE', true);
    ui.tools.textContent = 'Permisos: ' + (s.tools.join(' · ') || 'ninguno');
  } catch (e) { chip(ui.chipBrain, 'CEREBRO · SIN CONEXIÓN', false); }
  try {
    sessions = (await (await api('/api/sessions')).json()).sessions;
    for (const s of sessions) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.title}  ·  ${new Date(s.updated).toLocaleDateString()}`;
      ui.session.appendChild(o);
    }
  } catch {}
  chip(ui.chipMic, Recognition ? 'MIC · LISTO' : 'MIC · NO SOPORTADO', !!Recognition);
}

ui.session.addEventListener('change', () => {
  const s = sessions.find((x) => x.id === ui.session.value);
  current = s ? { id: s.id, cwd: s.cwd } : { id: '', cwd: '' };
  ui.reply.textContent = s ? `Conectado al chat: ${s.title}` : 'Nueva conversación.';
});

/* =====================================================================
   3. OÍDO (reconocimiento de voz del navegador)
   ===================================================================== */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, busy = false;

function listen() {
  if (!Recognition || busy || listening) return;
  rec = new Recognition();
  rec.lang = navigator.language && navigator.language.startsWith('es') ? navigator.language : 'es-ES';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onstart = () => { listening = true; setMode('listening'); ui.you.textContent = '…'; };
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    ui.you.textContent = (finalText + interim).trim();
  };
  rec.onerror = (ev) => {
    if (ev.error === 'not-allowed') chip(ui.chipMic, 'MIC · BLOQUEADO', false);
  };
  rec.onend = () => {
    listening = false;
    const t = finalText.trim();
    if (t) send(t);
    else { setMode('idle'); if (ui.handsfree.checked) setTimeout(listen, 400); }
  };
  rec.start();
}
function stopListening() { if (rec && listening) rec.stop(); }

/* =====================================================================
   4. CEREBRO + VOZ
   ===================================================================== */
async function send(text) {
  busy = true;
  ui.you.textContent = text;
  ui.reply.textContent = '';
  setMode('thinking');
  try {
    const r = await (await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text, sessionId: current.id || undefined, cwd: current.cwd || undefined }),
    })).json();
    if (r.sessionId) current.id = r.sessionId;
    let reply = r.reply;
    ui.reply.textContent = reply;
    if (r.denied && r.denied.length) {
      ui.reply.textContent += `\n[Permiso denegado: ${r.denied.join(', ')}. Añádelo a JARVIS_ALLOWED_TOOLS en .env si quieres permitirlo.]`;
    }
    await speak(reply);
  } catch (e) {
    ui.reply.textContent = 'Error: ' + e.message;
    await speak('Tuve un problema. Revisa la consola del servidor.');
  } finally {
    busy = false;
    setMode('idle');
    if (ui.handsfree.checked) setTimeout(listen, 500);
  }
}

let audioCtx = null;
async function speak(text) {
  if (!text) return;
  setMode('speaking');
  if (voiceOn) {
    try {
      const blob = await (await api('/api/tts', { method: 'POST', body: JSON.stringify({ text }) })).blob();
      return await playBlob(blob);
    } catch (e) {
      console.warn('ElevenLabs falló, uso la voz del navegador:', e.message);
    }
  }
  return browserSpeak(text);
}

function playBlob(blob) {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(blob));
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(audio);
    const an = audioCtx.createAnalyser(); an.fftSize = 512;
    src.connect(an); an.connect(audioCtx.destination);
    const data = new Uint8Array(an.frequencyBinCount);
    let raf;
    const tick = () => {
      an.getByteTimeDomainData(data);
      let sum = 0; for (const v of data) sum += ((v - 128) / 128) ** 2;
      state.level = Math.min(1, Math.sqrt(sum / data.length) * 4);
      raf = requestAnimationFrame(tick);
    };
    audio.onended = audio.onerror = () => { cancelAnimationFrame(raf); state.level = 0; URL.revokeObjectURL(audio.src); resolve(); };
    audioCtx.resume().then(() => audio.play()).then(tick).catch(() => resolve());
  });
}

function browserSpeak(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    const fake = setInterval(() => { state.level = 0.3 + Math.random() * 0.5; }, 90);
    u.onend = u.onerror = () => { clearInterval(fake); state.level = 0; resolve(); };
    speechSynthesis.speak(u);
  });
}

/* =====================================================================
   5. CONTROLES
   ===================================================================== */
canvas.addEventListener('click', () => (listening ? stopListening() : listen()));
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== ui.text) {
    e.preventDefault();
    listening ? stopListening() : listen();
  }
});
ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = ui.text.value.trim();
  if (t && !busy) { ui.text.value = ''; send(t); }
});
ui.handsfree.addEventListener('change', () => { if (ui.handsfree.checked) listen(); });

init();
