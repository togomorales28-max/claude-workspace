/* Avisos del panel de cotizaciones (Rojo Ironworks).
   Solo maneja notificaciones push; no guarda ni intercepta las páginas de la web. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Nueva cotización', {
    body: d.body || 'Un cliente acaba de cotizar en tu web.',
    tag: d.tag || 'cotizacion',
    renotify: true,
    icon: 'cotizador-icon-192.png',
    badge: 'cotizador-icon-192.png',
    data: { url: d.url || './admin.html' },
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './admin.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('admin.html') >= 0) { list[i].postMessage('cotizaciones'); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
