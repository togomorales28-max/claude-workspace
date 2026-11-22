// Oído local con Whisper (código abierto). Lanza lib/stt_worker.py una vez y le pasa los audios.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const LANG = process.env.WHISPER_LANG || 'es';

let worker = null;
let ready = null;
const waiting = new Map();

function start() {
  if (worker) return ready;
  worker = spawn(PYTHON, [path.join(__dirname, 'stt_worker.py')], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
  let buf = '', err = '';
  ready = new Promise((resolve, reject) => {
    worker.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.ready) { console.log(`  Whisper listo (modelo ${msg.model}).`); resolve(); continue; }
        const w = waiting.get(msg.id);
        if (w) { waiting.delete(msg.id); msg.error ? w.reject(new Error(msg.error)) : w.resolve(msg.text || ''); }
      }
    });
    worker.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    const fail = (why) => {
      const e = new Error(why);
      reject(e);
      for (const w of waiting.values()) w.reject(e);
      waiting.clear(); worker = null; ready = null;
    };
    worker.on('error', (e) => fail(e.code === 'ENOENT'
      ? `No encuentro "${PYTHON}". Instala Python y luego: pip install faster-whisper` : e.message));
    worker.on('exit', (code) => fail(/No module named/.test(err)
      ? 'Falta faster-whisper. Instálalo con: pip install faster-whisper'
      : `Whisper se cerró (${code}): ${err.trim().split('\n').pop() || ''}`));
  });
  ready.catch(() => {});
  return ready;
}

async function transcribe(audio, ext = 'webm') {
  await start();
  const file = path.join(os.tmpdir(), `jarvis-${crypto.randomUUID()}.${ext}`);
  fs.writeFileSync(file, audio);
  const id = crypto.randomUUID();
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error('Whisper tardó demasiado.')); }, 120000);
      waiting.set(id, { resolve: (t) => { clearTimeout(timer); resolve(t); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      worker.stdin.write(JSON.stringify({ id, path: file, lang: LANG }) + '\n');
    });
  } finally {
    fs.unlink(file, () => {});
  }
}

module.exports = { start, transcribe };
