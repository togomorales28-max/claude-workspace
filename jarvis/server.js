// Jarvis Hub: servidor sin dependencias (Node 18+) que corre en tu PC.
// - Interfaz:        http://localhost:PORT  (y desde el celular por Tailscale, con clave)
// - /api/chat        cerebro: Claude Code (claude -p) u Ollama (IA de código abierto)
// - /api/stt         oído: Whisper local (código abierto)
// - /api/tts         voz: ElevenLabs, Piper (código abierto) o la del navegador
// - /api/gmail/*     Gmail directo con Google, solo lectura; avisos de correos nuevos
// - /api/events      avisos en vivo (correos nuevos) para la app
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ---------- .env ----------
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, '.env'));

const gmail = require('./lib/gmail');
const stt = require('./lib/stt');
const ollama = require('./lib/ollama');

const PORT = Number(process.env.PORT || 7777);
const HOST = '127.0.0.1'; // nunca se abre a la red; el celular entra por "tailscale serve"
const DATA = path.join(__dirname, 'data');
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const WORKDIR = process.env.JARVIS_WORKDIR || os.homedir();
const MODEL = process.env.JARVIS_MODEL || '';
const ALLOWED_TOOLS = (process.env.JARVIS_ALLOWED_TOOLS ?? 'Read Glob Grep WebSearch WebFetch').split(/[\s,]+/).filter(Boolean);
const BRAIN = (process.env.BRAIN || 'claude').toLowerCase(); // claude | ollama
const STT_PROVIDER = (process.env.STT_PROVIDER || 'browser').toLowerCase(); // whisper | browser
const XI_KEY = process.env.ELEVENLABS_API_KEY || '';
const XI_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const XI_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const PIPER_BIN = process.env.PIPER_BIN || 'piper';
const PIPER_MODEL = process.env.PIPER_MODEL || '';
const TTS_PROVIDER = (process.env.TTS_PROVIDER || (XI_KEY ? 'elevenlabs' : PIPER_MODEL ? 'piper' : 'browser')).toLowerCase();
const GMAIL_POLL_MINUTES = Number(process.env.GMAIL_POLL_MINUTES ?? 5);
const OPEN_APP = process.argv.includes('--open');
const CLAUDE_TIMEOUT_MS = 5 * 60 * 1000;

// Clave para entrar desde el celular. Si no la pones en .env, se genera una y se guarda en data/token.
function loadToken() {
  if (process.env.JARVIS_TOKEN) return process.env.JARVIS_TOKEN;
  const f = path.join(DATA, 'token');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {}
  const t = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(f, t, { mode: 0o600 });
  return t;
}
const TOKEN = loadToken();

const SYSTEM_PROMPT = [
  'Eres Jarvis, el asistente personal de voz del usuario.',
  'Tus respuestas se leerán en voz alta: responde en español, breve y natural (1 a 4 frases),',
  'sin markdown, sin listas, sin bloques de código ni URLs largas, salvo que te lo pidan.',
  'Si una herramienta te es denegada, dilo con claridad y explica qué permiso faltaría.',
  'Antes de enviar correos, crear eventos o hacer cambios en el computador, confirma con el usuario.',
  'Cuando recibas un bloque [Correos], úsalo para responder y resume sin leer direcciones de correo completas.',
].join(' ');

// ---------- seguridad ----------
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const isLocal = (req) => LOCAL_HOSTS.has(req.headers.host || '') && !req.headers['x-forwarded-for'] && !req.headers['tailscale-user-login'];
function tokenOk(given) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function isTrusted(req, query, pathname) {
  const origin = req.headers.origin;
  if (origin && origin.replace(/^https?:\/\//, '') !== req.headers.host) return false; // otra web no puede usarla
  // En el PC: la cabecera propia obliga a que la petición venga de la propia página (EventSource no puede enviarla).
  if (isLocal(req)) return req.headers['x-jarvis'] === '1' || (pathname === '/api/events' && req.method === 'GET');
  // Desde fuera (celular por Tailscale): siempre con clave.
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return tokenOk(bearer || query.get('k'));
}

// ---------- utilidades ----------
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Petición demasiado grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  try { return JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}'); }
  catch (e) { throw new Error(e.message === 'Petición demasiado grande' ? e.message : 'JSON inválido'); }
}

// ---------- cerebro: Claude Code ----------
function winQuote(a) { return /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a; }

function askClaude({ text, sessionId, cwd, ephemeral = false }) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--append-system-prompt', SYSTEM_PROMPT];
    if (MODEL) args.push('--model', MODEL);
    if (sessionId) args.push('--resume', sessionId);
    if (ephemeral) args.push('--no-session-persistence');
    if (ALLOWED_TOOLS.length && !ephemeral) args.push('--allowedTools', ...ALLOWED_TOOLS);
    const isWin = process.platform === 'win32';
    const child = spawn(CLAUDE_BIN, isWin ? args.map(winQuote) : args, {
      cwd: cwd && fs.existsSync(cwd) ? cwd : WORKDIR, shell: isWin, env: process.env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude Code tardó demasiado (5 min).')); }, CLAUDE_TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? `No encuentro el comando "${CLAUDE_BIN}". Instala Claude Code o usa BRAIN=ollama.` : e.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const lastJson = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
      if (lastJson) {
        try {
          const r = JSON.parse(lastJson);
          const denied = (r.permission_denials || []).map((d) => d.tool_name).filter(Boolean);
          return resolve({
            reply: (r.result || '').trim() || (r.is_error ? 'Hubo un error en Claude Code.' : '…'),
            sessionId: r.session_id || sessionId || null, isError: !!r.is_error, denied: [...new Set(denied)],
          });
        } catch {}
      }
      reject(new Error((err || out || `Claude Code terminó con código ${code}`).trim().slice(0, 800)));
    });
    child.stdin.end(text);
  });
}

// Una sola pregunta sin memoria (para resúmenes de correo).
async function think(prompt, brain = BRAIN) {
  if (brain === 'ollama') return ollama.complete([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }]);
  return (await askClaude({ text: prompt, ephemeral: true })).reply;
}

const MAIL_WORDS = /\b(correos?|e-?mails?|gmail|bandeja|inbox|mails?)\b/i;
async function mailContext(text) {
  if (!MAIL_WORDS.test(text) || !gmail.status().connected) return '';
  try {
    const mails = await gmail.list(/\b(todos|hoy|recientes|últimos|ultimos)\b/i.test(text) ? 'in:inbox newer_than:1d' : 'is:unread in:inbox newer_than:3d', 10);
    return `\n\n[Correos de Gmail del usuario, solo lectura]\n${gmail.asText(mails)}`;
  } catch (e) { return `\n\n[Correos] No pude leer Gmail: ${e.message}`; }
}

// Lee ~/.claude/projects/*/*.jsonl para listar tus chats de Claude Code.
function listSessions(limit = 25) {
  const root = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const dir of fs.readdirSync(root)) {
    const full = path.join(root, dir);
    let entries = [];
    try { entries = fs.readdirSync(full); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(full, f);
      try { files.push({ p, id: f.slice(0, -6), mtime: fs.statSync(p).mtimeMs }); } catch {}
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, limit).map((f) => {
    let title = '', cwd = '';
    try {
      const fd = fs.openSync(f.p, 'r');
      const buf = Buffer.alloc(256 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      for (const line of buf.toString('utf8', 0, n).split('\n')) {
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (!cwd && o.cwd) cwd = o.cwd;
        if (!title && o.type === 'user' && o.message && !o.isMeta) {
          const c = o.message.content;
          const t = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((x) => x.type === 'text') || {}).text : '';
          if (t && !t.startsWith('<')) title = t.replace(/\s+/g, ' ').slice(0, 80);
        }
        if (title && cwd) break;
      }
    } catch {}
    return { id: f.id, title: title || '(sin título)', cwd, updated: new Date(f.mtime).toISOString() };
  });
}

// ---------- voz ----------
async function ttsEleven(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(XI_VOICE)}?output_format=mp3_44100_128`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': XI_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: XI_MODEL }),
  });
  if (!r.ok) throw new Error(`ElevenLabs respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}
function ttsPiper(text) {
  return new Promise((resolve, reject) => {
    const out = path.join(os.tmpdir(), `jarvis-${crypto.randomUUID()}.wav`);
    const child = spawn(PIPER_BIN, ['-m', PIPER_MODEL, '-f', out], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => reject(new Error(e.code === 'ENOENT' ? `No encuentro "${PIPER_BIN}". Instálalo con: pip install piper-tts` : e.message)));
    child.on('close', (code) => {
      fs.readFile(out, (e, data) => {
        fs.unlink(out, () => {});
        if (e || code !== 0) return reject(new Error(`Piper falló (${code}): ${err.slice(-300)}`));
        resolve(data);
      });
    });
    child.stdin.end(text.slice(0, 2500).replace(/\s+/g, ' '));
  });
}

// ---------- avisos en vivo (Server-Sent Events) ----------
const listeners = new Set();
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of listeners) res.write(data);
}
gmail.startPoller(GMAIL_POLL_MINUTES, async (fresh) => {
  const list = gmail.asText(fresh);
  let text;
  try {
    text = await think(`Me acaban de llegar ${fresh.length} correo(s) nuevo(s). Resúmemelos en voz alta en 1 o 2 frases, diciendo quién escribe y qué quiere; si alguno parece urgente, dilo primero.\n\n[Correos]\n${list}`);
  } catch {
    text = `Tienes ${fresh.length} correo(s) nuevo(s): ` + fresh.map((m) => `${m.from}, «${m.subject}»`).join('; ') + '.';
  }
  console.log(`  [Gmail] ${text}`);
  broadcast({ type: 'mail', count: fresh.length, text });
});

// ---------- abrir como app ----------
function openAppWindow() {
  const url = `http://localhost:${PORT}`;
  const tries = process.platform === 'win32'
    ? [['cmd', ['/c', `start "" msedge --app=${url}`]], ['cmd', ['/c', `start "" ${url}`]]]
    : process.platform === 'darwin'
      ? [['open', ['-na', 'Google Chrome', '--args', `--app=${url}`]], ['open', [url]]]
      : [['google-chrome', [`--app=${url}`]], ['chromium', [`--app=${url}`]], ['xdg-open', [url]]];
  const next = (i) => {
    if (i >= tries.length) return console.log(`  Abre tú mismo: ${url}`);
    const [cmd, args] = tries[i];
    const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: cmd === 'cmd' });
    c.on('error', () => next(i + 1));
    c.on('exit', (code) => { if (code) next(i + 1); });
    c.unref();
  };
  next(0);
}

// ---------- archivos estáticos ----------
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Prohibido', 'text/plain');
  fs.readFile(file, (e, data) => {
    if (e) return send(res, 404, 'No encontrado', 'text/plain');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; media-src 'self' blob:; img-src 'self' data:",
    });
    res.end(data);
  });
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="background:#03060d;color:#f4e6c4;font:16px system-ui;padding:32px;max-width:560px;margin:auto"><h2 style="color:#ffb52e">${title}</h2>${body}</body>`;
}

// ---------- rutas ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const { pathname } = url;

  // Conectar Gmail: solo desde el propio PC (Google devuelve al navegador de este equipo).
  if (pathname === '/auth/google' || pathname === '/auth/google/callback') {
    if (!isLocal(req)) return send(res, 403, page('Solo desde el PC', '<p>Conecta Gmail abriendo Jarvis en tu computador.</p>'), 'text/html; charset=utf-8');
    try {
      if (pathname === '/auth/google') {
        res.writeHead(302, { Location: gmail.authUrl(`http://127.0.0.1:${PORT}/auth/google/callback`) });
        return res.end();
      }
      await gmail.handleCallback(url.searchParams);
      return send(res, 200, page('Gmail conectado', '<p>Listo. Jarvis puede leer (no enviar ni borrar) tu correo. Ya puedes cerrar esta pestaña.</p>'), 'text/html; charset=utf-8');
    } catch (e) {
      return send(res, 400, page('No se pudo conectar Gmail', `<p>${String(e.message).replace(/</g, '&lt;')}</p>`), 'text/html; charset=utf-8');
    }
  }

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
  if (!isTrusted(req, url.searchParams, pathname)) return send(res, 401, { error: 'Falta la clave de Jarvis o no es válida.' });

  try {
    if (pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, {
        voice: TTS_PROVIDER, stt: STT_PROVIDER, brain: BRAIN,
        brains: { claude: true, ollama: await ollama.available() }, ollamaModel: ollama.MODEL,
        gmail: gmail.status(), local: isLocal(req), tools: ALLOWED_TOOLS,
      });
    }
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': hola\n\n');
      listeners.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); listeners.delete(res); });
      return;
    }
    if (pathname === '/api/sessions' && req.method === 'GET') {
      return send(res, 200, { sessions: listSessions() });
    }
    if (pathname === '/api/chat' && req.method === 'POST') {
      const { text, sessionId, cwd, brain: wanted } = await readJson(req);
      if (!text || typeof text !== 'string') return send(res, 400, { error: 'Falta el texto' });
      if (sessionId && !/^[0-9a-f-]{36}$/i.test(sessionId)) return send(res, 400, { error: 'sessionId inválido' });
      const brain = wanted === 'ollama' || wanted === 'claude' ? wanted : BRAIN;
      const id = crypto.randomUUID().slice(0, 8);
      console.log(`[${id}] Tú (${brain}): ${text}`);
      const prompt = text.slice(0, 8000) + await mailContext(text);
      const r = brain === 'ollama'
        ? { ...(await ollama.chat({ text: prompt, sessionId, system: SYSTEM_PROMPT })), denied: [] }
        : await askClaude({ text: prompt, sessionId, cwd });
      console.log(`[${id}] Jarvis: ${r.reply.slice(0, 200)}${r.denied.length ? `  (denegado: ${r.denied.join(', ')})` : ''}`);
      return send(res, 200, { ...r, brain });
    }
    if (pathname === '/api/stt' && req.method === 'POST') {
      const audio = await readBody(req, 15 * 1024 * 1024);
      if (audio.length < 1000) return send(res, 200, { text: '' });
      const ext = /ogg/.test(req.headers['content-type'] || '') ? 'ogg' : /mp4|aac|m4a/.test(req.headers['content-type'] || '') ? 'm4a' : /wav/.test(req.headers['content-type'] || '') ? 'wav' : 'webm';
      return send(res, 200, { text: await stt.transcribe(audio, ext) });
    }
    if (pathname === '/api/tts' && req.method === 'POST') {
      const { text } = await readJson(req);
      if (!text) return send(res, 400, { error: 'Falta el texto' });
      if (TTS_PROVIDER === 'piper') {
        if (!PIPER_MODEL) return send(res, 503, { error: 'Falta PIPER_MODEL en .env' });
        return send(res, 200, await ttsPiper(String(text)), 'audio/wav');
      }
      if (TTS_PROVIDER === 'elevenlabs') {
        if (!XI_KEY) return send(res, 503, { error: 'Falta ELEVENLABS_API_KEY en .env' });
        return send(res, 200, await ttsEleven(String(text)), 'audio/mpeg');
      }
      return send(res, 503, { error: 'Voz del navegador: no hay audio en el servidor' });
    }
    if (pathname === '/api/gmail/summary' && req.method === 'POST') {
      const { brain } = await readJson(req);
      const mails = await gmail.list('is:unread in:inbox newer_than:3d', 10);
      if (!mails.length) return send(res, 200, { text: 'No tienes correos sin leer de los últimos tres días.' });
      const text = await think(`Resúmeme mis correos sin leer en 2 a 4 frases, empezando por lo más importante.\n\n[Correos]\n${gmail.asText(mails)}`, brain === 'ollama' ? 'ollama' : brain === 'claude' ? 'claude' : BRAIN);
      return send(res, 200, { text, count: mails.length });
    }
    if (pathname === '/api/gmail/disconnect' && req.method === 'POST') {
      if (!isLocal(req)) return send(res, 403, { error: 'Desconecta Gmail desde el PC.' });
      await gmail.disconnect();
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'Ruta no encontrada' });
  } catch (e) {
    console.error('Error:', e.message);
    send(res, 500, { error: e.message });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Jarvis ya está encendido en http://localhost:${PORT}`);
    if (OPEN_APP) openAppWindow();
    setTimeout(() => process.exit(0), 1500);
  } else { console.error(e); process.exit(1); }
});

server.listen(PORT, HOST, async () => {
  const voz = { elevenlabs: `ElevenLabs${XI_KEY ? '' : ' (FALTA LA LLAVE)'}`, piper: `Piper (${PIPER_MODEL || 'FALTA PIPER_MODEL'})`, browser: 'voz del navegador / teléfono' };
  const g = gmail.status();
  console.log(`\n  JARVIS en línea  ->  http://localhost:${PORT}\n`);
  console.log(`  Cerebro:          ${BRAIN === 'ollama' ? `Ollama (${ollama.MODEL})${await ollama.available() ? '' : ' — NO ESTÁ ABIERTO'}` : 'Claude Code'}`);
  console.log(`  Oído:             ${STT_PROVIDER === 'whisper' ? 'Whisper local' : 'reconocimiento del navegador'}`);
  console.log(`  Voz:              ${voz[TTS_PROVIDER] || TTS_PROVIDER}`);
  console.log(`  Gmail:            ${g.connected ? `conectado (avisos cada ${GMAIL_POLL_MINUTES} min)` : g.configured ? 'listo para conectar en la app' : 'sin configurar'}`);
  console.log(`  Herramientas PC:  ${ALLOWED_TOOLS.join(', ') || '(ninguna)'}`);
  console.log(`\n  Clave para el celular: ${TOKEN}`);
  console.log('  (guárdala; con "tailscale serve" el celular entra a https://<tu-pc>.<tu-red>.ts.net)\n');
  if (STT_PROVIDER === 'whisper') stt.start().catch((e) => console.error(`  Whisper: ${e.message}`));
  if (OPEN_APP) openAppWindow();
});
