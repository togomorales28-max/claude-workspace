// Gmail directo con Google (OAuth "app de escritorio", permiso de SOLO LECTURA).
// Los tokens se guardan únicamente en data/google-token.json de tu PC.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CRED_FILE = process.env.GOOGLE_CREDENTIALS || path.join(ROOT, 'google-oauth.json');
const TOKEN_FILE = path.join(DATA, 'google-token.json');
const STATE_FILE = path.join(DATA, 'gmail-state.json');

const pending = new Map(); // state -> { verifier, redirectUri, at }

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writePrivate(file, obj) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), { mode: 0o600 });
}
function client() {
  const c = readJson(CRED_FILE);
  const k = c && (c.installed || c.web);
  return k && k.client_id ? { id: k.client_id, secret: k.client_secret || '' } : null;
}

function status() {
  return { configured: !!client(), connected: !!(readJson(TOKEN_FILE) || {}).refresh_token };
}

function authUrl(redirectUri) {
  const c = client();
  if (!c) throw new Error('Falta google-oauth.json en la carpeta jarvis (mira el README, sección Gmail).');
  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pending.set(state, { verifier, redirectUri, at: Date.now() });
  const q = new URLSearchParams({
    client_id: c.id, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google rechazó el acceso: ${j.error_description || j.error || r.status}`);
  return j;
}

async function handleCallback(query) {
  const p = pending.get(query.get('state') || '');
  if (!p || Date.now() - p.at > 10 * 60 * 1000) throw new Error('La autorización caducó. Vuelve a pulsar «Conectar Gmail».');
  pending.delete(query.get('state'));
  if (query.get('error')) throw new Error(`Cancelado en Google: ${query.get('error')}`);
  const c = client();
  const t = await tokenRequest({
    code: query.get('code'), client_id: c.id, client_secret: c.secret, redirect_uri: p.redirectUri,
    grant_type: 'authorization_code', code_verifier: p.verifier,
  });
  writePrivate(TOKEN_FILE, { refresh_token: t.refresh_token, access_token: t.access_token, expiry: Date.now() + (t.expires_in - 60) * 1000 });
}

async function accessToken() {
  const tok = readJson(TOKEN_FILE);
  if (!tok || !tok.refresh_token) throw new Error('Gmail no está conectado.');
  if (tok.access_token && Date.now() < tok.expiry) return tok.access_token;
  const c = client();
  const t = await tokenRequest({ client_id: c.id, client_secret: c.secret, refresh_token: tok.refresh_token, grant_type: 'refresh_token' });
  writePrivate(TOKEN_FILE, { ...tok, access_token: t.access_token, expiry: Date.now() + (t.expires_in - 60) * 1000 });
  return t.access_token;
}

async function api(pathAndQuery) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (!r.ok) throw new Error(`Gmail respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Devuelve [{id, from, subject, date, snippet}] (solo cabeceras y vista previa, nunca adjuntos).
async function list(query = 'is:unread in:inbox newer_than:2d', max = 10) {
  const l = await api(`messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`);
  const ids = (l.messages || []).map((m) => m.id);
  return Promise.all(ids.map(async (id) => {
    const m = await api(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    return { id, from: (h.from || '').replace(/<.*>/, '').replace(/"/g, '').trim() || h.from, subject: h.subject || '(sin asunto)', date: h.date || '', snippet: decode(m.snippet || '') };
  }));
}
function decode(s) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function asText(mails) {
  if (!mails.length) return 'No hay correos que coincidan.';
  return mails.map((m, i) => `${i + 1}. De: ${m.from} | Asunto: ${m.subject} | ${m.date}\n   ${m.snippet}`).join('\n');
}

// Revisa periódicamente si llegaron correos nuevos; la primera vez solo marca los existentes como vistos.
function startPoller(minutes, onNew) {
  if (!minutes || minutes <= 0) return;
  let first = !fs.existsSync(STATE_FILE);
  const tick = async () => {
    if (!status().connected) return;
    try {
      const mails = await list('is:unread in:inbox newer_than:1d', 15);
      const state = readJson(STATE_FILE, { seen: [] });
      const seen = new Set(state.seen);
      const fresh = mails.filter((m) => !seen.has(m.id));
      writePrivate(STATE_FILE, { seen: [...new Set([...mails.map((m) => m.id), ...state.seen])].slice(0, 500) });
      if (!first && fresh.length) await onNew(fresh);
      first = false;
    } catch (e) { console.error('Gmail:', e.message); }
  };
  setTimeout(tick, 5000);
  setInterval(tick, minutes * 60 * 1000);
}

async function disconnect() {
  const tok = readJson(TOKEN_FILE);
  if (tok?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: 'POST' }).catch(() => {});
  fs.rmSync(TOKEN_FILE, { force: true });
  fs.rmSync(STATE_FILE, { force: true });
}

module.exports = { status, authUrl, handleCallback, list, asText, startPoller, disconnect };
