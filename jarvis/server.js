// Jarvis local: servidor sin dependencias (Node 18+).
// - Sirve la interfaz en http://localhost:PORT
// - /api/chat     -> envía tu mensaje a Claude Code (CLI "claude -p") y devuelve la respuesta
// - /api/tts      -> convierte texto en voz con ElevenLabs (la llave nunca sale de este servidor)
// - /api/sessions -> lista tus chats recientes de Claude Code para retomarlos
// - /api/status   -> qué está configurado
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 7777);
const HOST = '127.0.0.1'; // solo tu computador; nunca expuesto a la red
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const WORKDIR = process.env.JARVIS_WORKDIR || os.homedir();
const MODEL = process.env.JARVIS_MODEL || '';
const ALLOWED_TOOLS = (process.env.JARVIS_ALLOWED_TOOLS ?? 'Read Glob Grep WebSearch WebFetch')
  .split(/[\s,]+/).filter(Boolean);
const XI_KEY = process.env.ELEVENLABS_API_KEY || '';
const XI_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const XI_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const CLAUDE_TIMEOUT_MS = 5 * 60 * 1000;

const SYSTEM_PROMPT = [
  'Eres Jarvis, el asistente personal de voz del usuario.',
  'Tus respuestas se leerán en voz alta: responde en español, breve y natural (1 a 4 frases),',
  'sin markdown, sin listas, sin bloques de código ni URLs largas, salvo que te lo pidan.',
  'Si una herramienta te es denegada, dilo con claridad y explica qué permiso faltaría.',
  'Antes de enviar correos, crear eventos o hacer cambios en el computador, confirma con el usuario.',
].join(' ');

// ---------- seguridad: solo peticiones desde esta misma página ----------
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
function isTrusted(req) {
  if (!ALLOWED_HOSTS.has(req.headers.host || '')) return false; // evita DNS rebinding
  const origin = req.headers.origin;
  if (origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ''))) return false; // evita que otra web la use
  return req.headers['x-jarvis'] === '1'; // cabecera propia => fuerza preflight CORS desde otros orígenes
}

// ---------- utilidades ----------
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Petición demasiado grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// ---------- Claude Code ----------
function winQuote(a) { return /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a; }

function askClaude({ text, sessionId, cwd }) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--append-system-prompt', SYSTEM_PROMPT];
    if (MODEL) args.push('--model', MODEL);
    if (sessionId) args.push('--resume', sessionId);
    if (ALLOWED_TOOLS.length) args.push('--allowedTools', ...ALLOWED_TOOLS);

    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? CLAUDE_BIN : CLAUDE_BIN, isWin ? args.map(winQuote) : args, {
      cwd: cwd && fs.existsSync(cwd) ? cwd : WORKDIR,
      shell: isWin, // en Windows "claude" es un .cmd
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude Code tardó demasiado (5 min).')); }, CLAUDE_TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT'
        ? `No encuentro el comando "${CLAUDE_BIN}". Instala Claude Code o ajusta CLAUDE_BIN en .env.`
        : e.message));
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
            sessionId: r.session_id || sessionId || null,
            isError: !!r.is_error,
            denied: [...new Set(denied)],
          });
        } catch { /* cae al error de abajo */ }
      }
      reject(new Error((err || out || `Claude Code terminó con código ${code}`).trim().slice(0, 800)));
    });

    child.stdin.end(text); // el mensaje va por stdin, nunca como argumento de shell
  });
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
      try { files.push({ p, id: f.slice(0, -6), mtime: fs.statSync(p).mtimeMs }); } catch { /* ignora */ }
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  const out = [];
  for (const f of files.slice(0, limit)) {
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
    } catch { /* ignora archivos ilegibles */ }
    out.push({ id: f.id, title: title || '(sin título)', cwd, updated: new Date(f.mtime).toISOString() });
  }
  return out;
}

// ---------- ElevenLabs ----------
async function tts(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(XI_VOICE)}?output_format=mp3_44100_128`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': XI_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: XI_MODEL }),
  });
  if (!r.ok) throw new Error(`ElevenLabs respondió ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------- archivos estáticos ----------
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Prohibido', 'text/plain');
  fs.readFile(file, (e, data) => {
    if (e) return send(res, 404, 'No encontrado', 'text/plain');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; media-src 'self' blob:",
    });
    res.end(data);
  });
}

// ---------- rutas ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (!pathname.startsWith('/api/')) {
    if (!ALLOWED_HOSTS.has(req.headers.host || '')) return send(res, 403, 'Host no permitido', 'text/plain');
    return serveStatic(req, res);
  }
  if (!isTrusted(req)) return send(res, 403, { error: 'Origen no permitido' });

  try {
    if (pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { voice: !!XI_KEY, tools: ALLOWED_TOOLS, workdir: WORKDIR, model: MODEL || 'por defecto' });
    }
    if (pathname === '/api/sessions' && req.method === 'GET') {
      return send(res, 200, { sessions: listSessions() });
    }
    if (pathname === '/api/chat' && req.method === 'POST') {
      const { text, sessionId, cwd } = await readJson(req);
      if (!text || typeof text !== 'string') return send(res, 400, { error: 'Falta el texto' });
      if (sessionId && !/^[0-9a-f-]{36}$/i.test(sessionId)) return send(res, 400, { error: 'sessionId inválido' });
      const id = crypto.randomUUID().slice(0, 8);
      console.log(`[${id}] Tú: ${text}`);
      const r = await askClaude({ text: text.slice(0, 8000), sessionId, cwd });
      console.log(`[${id}] Jarvis: ${r.reply.slice(0, 200)}${r.denied.length ? `  (denegado: ${r.denied.join(', ')})` : ''}`);
      return send(res, 200, r);
    }
    if (pathname === '/api/tts' && req.method === 'POST') {
      if (!XI_KEY) return send(res, 503, { error: 'Falta ELEVENLABS_API_KEY en .env' });
      const { text } = await readJson(req);
      if (!text) return send(res, 400, { error: 'Falta el texto' });
      return send(res, 200, await tts(String(text)), 'audio/mpeg');
    }
    send(res, 404, { error: 'Ruta no encontrada' });
  } catch (e) {
    console.error('Error:', e.message);
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  JARVIS en línea  ->  http://localhost:${PORT}\n`);
  console.log(`  Voz ElevenLabs:   ${XI_KEY ? 'configurada' : 'NO configurada (usará la voz del navegador)'}`);
  console.log(`  Herramientas:     ${ALLOWED_TOOLS.join(', ') || '(ninguna)'}`);
  console.log(`  Carpeta trabajo:  ${WORKDIR}\n`);
});
