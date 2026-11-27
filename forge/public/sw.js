/* Service worker de FORGE: funciona sin conexión después de la primera visita. */
const CACHE = 'forge-v1';
const CORE = ['./', './index.html', './widget.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// La app envía las URLs que ya cargó para guardarlas (JS/CSS/fuentes con hash).
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'cache-urls' && Array.isArray(e.data.urls)) {
    const same = e.data.urls.filter((u) => typeof u === 'string' && u.startsWith(self.location.origin));
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(same.map((u) => c.add(u).catch(() => undefined)))));
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: primero la red (para recibir actualizaciones), si no hay conexión usar la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req, { ignoreSearch: true, ignoreVary: true })) || (await caches.match(url.pathname.endsWith('widget.html') ? './widget.html' : './index.html', { ignoreVary: true }))),
    );
    return;
  }

  // Archivos con hash: primero la copia guardada.
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
