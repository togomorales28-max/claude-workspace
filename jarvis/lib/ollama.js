// Cerebro de código abierto con Ollama (https://ollama.com). Corre en tu PC, gratis y sin internet.
'use strict';

const crypto = require('crypto');

const URL_BASE = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const conversations = new Map(); // id -> [{role, content}]
const MAX_TURNS = 20;

async function chat({ text, sessionId, system }) {
  const id = sessionId && conversations.has(sessionId) ? sessionId : crypto.randomUUID();
  const history = conversations.get(id) || [];
  const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: text }];
  const reply = await complete(messages);
  history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
  conversations.set(id, history.slice(-MAX_TURNS * 2));
  return { reply, sessionId: id };
}

async function complete(messages) {
  let r;
  try {
    r = await fetch(`${URL_BASE}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, stream: false, keep_alive: '30m' }),
    });
  } catch {
    throw new Error('No puedo hablar con Ollama. Ábrelo (o ejecuta "ollama serve") y vuelve a intentarlo.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(/not found/i.test(j.error || '')
      ? `Falta el modelo ${MODEL}. Descárgalo con: ollama pull ${MODEL}`
      : `Ollama respondió ${r.status}: ${j.error || ''}`);
  }
  return (j.message?.content || '').trim() || '…';
}

async function available() {
  try { const r = await fetch(`${URL_BASE}/api/tags`, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

module.exports = { chat, complete, available, MODEL };
