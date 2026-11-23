'use strict';
/* Visión de Jarvis: cámara del teléfono + SmolVLM (código abierto) dentro del teléfono.
   SmolVLM describe la foto (en inglés, que es lo que mejor sabe) y el cerebro contesta en español. */

const Vision = (() => {
  const HFV = 'https://huggingface.co/ggml-org';
  const MODELS = [
    { id: 'smolvlm-256m', name: 'Visión ligera', size: '0,3 GB', mb: 290, minRam: 0,
      model: 'SmolVLM-256M-Instruct-Q8_0.gguf', mmproj: 'mmproj-SmolVLM-256M-Instruct-Q8_0.gguf',
      repo: `${HFV}/SmolVLM-256M-Instruct-GGUF`, note: 'Rápida. Reconoce objetos y escenas sencillas.' },
    { id: 'smolvlm-500m', name: 'Visión normal', size: '0,55 GB', mb: 560, minRam: 5000,
      model: 'SmolVLM-500M-Instruct-Q8_0.gguf', mmproj: 'mmproj-SmolVLM-500M-Instruct-Q8_0.gguf',
      repo: `${HFV}/SmolVLM-500M-Instruct-GGUF`, note: 'Más detalle y lee mejor los textos. Recomendada con 6 GB.' },
  ];
  const SEE = /\b(que ves|que estas viendo|mira|mirame|que es esto|que es eso|lee esto|leeme|lee lo que|describe|que tengo|que hay (aqui|enfrente|delante)|reconoce|identifica)\b/;

  const video = $('cam'), btn = $('cam-btn'), seeBtn = $('see');
  const setupCard = $('vision-setup');
  let stream = null, on = false, loadedId = null, downloading = null;

  const have = (f) => info && info.models.some((m) => m.file === f);
  const installed = (v) => have(v.model) && have(v.mmproj);
  const recommended = () => (info && info.ramMB >= 5000 ? MODELS[1] : MODELS[0]);
  function current() {
    const saved = MODELS.find((v) => v.id === store.get('jarvis-vision', ''));
    if (saved && installed(saved)) return saved;
    return MODELS.slice().reverse().find(installed) || null;
  }

  /* ---------------------------------------------------------------- cámara */
  async function start() {
    const v = current();
    if (!v) return showSetup();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    } catch (e) {
      ui.reply.textContent = 'Necesito permiso de cámara para ver. Actívalo en Ajustes del teléfono → Apps → Jarvis → Permisos.';
      return false;
    }
    video.srcObject = stream;
    video.hidden = false;
    document.body.classList.add('seeing');
    on = true; btn.classList.add('live'); btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Apagar visión');
    seeBtn.hidden = false;
    if (loadedId !== v.id) {
      ui.reply.textContent = 'Abriendo los ojos… (unos segundos)';
      try { await J.visionLoad({ model: v.model, mmproj: v.mmproj }); loadedId = v.id; }
      catch (e) { ui.reply.textContent = 'No pude cargar la visión: ' + (e.message || e); stop(); return false; }
    }
    ui.reply.textContent = 'Te veo. Pregúntame «¿qué ves?» o lo que quieras de lo que apuntas.';
    return true;
  }

  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; video.srcObject = null; video.hidden = true;
    document.body.classList.remove('seeing');
    on = false; btn.classList.remove('live'); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Activar visión');
    seeBtn.hidden = true;
    if (loadedId) { J.visionUnload().catch(() => {}); loadedId = null; } // libera memoria
  }

  // Foto del momento, reducida (máx. 512 px) para que el modelo vaya rápido.
  function capture() {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const k = Math.min(1, 512 / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }

  /* ---------------------------------------------------------------- responder */
  async function answer(question) {
    if (!on) {
      const ok = await start();
      if (!ok) { if (!setupCard.hidden) ui.reply.textContent = 'Primero descarga la visión: toca «Descargar visión».'; return; }
      await new Promise((r) => setTimeout(r, 600));
    }
    const img = capture();
    if (!img) { ui.reply.textContent = 'La cámara todavía no está lista, inténtalo otra vez.'; return; }
    ui.status.textContent = 'MIRANDO';
    state.mode = 'thinking';
    ui.reply.textContent = 'Mirando…';
    const wantsText = /\b(lee|leeme|texto|dice|letrero|etiqueta)\b/.test(norm(question));
    const prompt = wantsText
      ? 'Read and transcribe all the visible text in this image exactly. Then briefly say what the object is.'
      : 'Describe this image in detail: the main objects, people, colors, any visible text, and where things are.';
    const { text: desc } = await J.visionDescribe({ image: img, prompt, maxTokens: wantsText ? 200 : 150 });
    if (stopRequested) return;
    ui.status.textContent = 'PENSANDO';
    fullReply = ''; sentenceBuf = '';
    await J.generate({
      text: `[Lo que ve la cámara del usuario ahora mismo, descripción automática en inglés]: ${desc.trim()}\n\n` +
        `Pregunta del usuario: ${question}\n` +
        'Responde en español, en 1 a 3 frases, solo con lo que aparece en la descripción. ' +
        'Si te piden leer un texto, léelo tal cual. Habla como si tú lo estuvieras viendo.',
      maxTokens: 260,
    });
  }

  /* ---------------------------------------------------------------- descarga */
  function showSetup() {
    const v = recommended();
    setupCard.hidden = false;
    $('vision-detail').textContent = `Recomiendo «${v.name}» (${v.size}) para tu teléfono. Usa Wi-Fi.`;
    $('vision-download').onclick = () => download(v);
    $('vision-cancel').onclick = () => { setupCard.hidden = true; };
    return false;
  }

  async function download(v) {
    if (downloading) return;
    if (info.freeDiskMB < v.mb + 200) { $('vision-status').textContent = `No hay espacio: necesitas ${v.size} libres.`; return; }
    downloading = v.id;
    $('vision-download').disabled = true; $('vision-progress').hidden = false;
    render();
    try {
      for (const f of [v.mmproj, v.model]) {
        if (have(f)) continue;
        $('vision-status').textContent = 'Conectando…';
        await J.downloadModel({ url: `${v.repo}/resolve/main/${f}`, file: f });
        info = await J.info();
      }
      downloading = null;
      store.set('jarvis-vision', v.id);
      setupCard.hidden = true;
      render();
      if (!on) await start();
    } catch (e) {
      downloading = null;
      $('vision-download').disabled = false;
      $('vision-status').textContent = 'No se pudo descargar: ' + (e.message || e) + '. Vuelve a intentarlo (continúa donde se quedó).';
      render();
    }
  }

  function onDownload(file, received, total, pct) {
    const v = MODELS.find((x) => x.model === file || x.mmproj === file);
    if (!v) return false;
    const part = file === v.mmproj ? '1 de 2' : '2 de 2';
    $('vision-bar').style.width = pct + '%';
    $('vision-status').textContent = `Descargando (${part})… ${(received / 1048576).toFixed(0)} de ${(total / 1048576).toFixed(0)} MB (${pct} %)`;
    const row = document.querySelector(`[data-vision="${v.id}"] .model-progress`);
    if (row) row.textContent = `Descargando ${part}: ${pct} %`;
    return true;
  }

  /* ---------------------------------------------------------------- ajustes */
  function render() {
    const box = $('vision-models');
    if (!box || !info) return;
    box.innerHTML = '';
    const cur = current(), rec = recommended();
    for (const v of MODELS) {
      const el = document.createElement('div');
      el.className = 'model' + (cur && cur.id === v.id ? ' active' : '');
      el.dataset.vision = v.id;
      el.innerHTML = '<div class="model-head"><span class="model-name"></span><span class="model-tag"></span></div><div class="muted"></div><div class="muted model-progress"></div><div class="model-actions"></div>';
      el.querySelector('.model-name').textContent = `${v.name} · ${v.size}`;
      el.querySelector('.model-tag').textContent = cur && cur.id === v.id ? 'EN USO' : v.id === rec.id ? 'RECOMENDADA' : '';
      el.querySelector('.muted').textContent = v.note;
      const actions = el.querySelector('.model-actions');
      const mk = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = fn; actions.appendChild(b); return b; };
      if (downloading === v.id) mk('Cancelar', 'secondary', () => J.cancelDownload());
      else if (!installed(v)) mk('Descargar', 'primary', () => { ui.settings.hidden = true; showSetup(); download(v); }).disabled = !!downloading;
      else {
        if (!(cur && cur.id === v.id)) mk('Usar', 'primary', () => { store.set('jarvis-vision', v.id); if (on) { stop(); start(); } render(); });
        mk('Borrar', 'secondary', async () => {
          if (on) stop();
          await J.deleteModel({ file: v.model }); await J.deleteModel({ file: v.mmproj });
          info = await J.info(); render();
        });
      }
      box.appendChild(el);
    }
  }

  /* ---------------------------------------------------------------- controles */
  btn.addEventListener('click', () => (on ? stop() : start()));
  seeBtn.addEventListener('click', () => ask('¿Qué ves?'));
  $('open-settings').addEventListener('click', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden && on) stop(); }); // no dejar la cámara encendida

  return {
    active: () => on,
    wantsToSee: (t) => SEE.test(norm(t)),
    answer, onDownload, render, stop,
  };
})();
window.Vision = Vision;
