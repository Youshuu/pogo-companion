// Service worker: la app funciona sin conexión.
// - Código y estáticos: "stale-while-revalidate" (rápido y se actualiza en segundo plano).
// - data/*.json y config/: "network-first" (siempre intenta el dato más nuevo; si no hay red, usa la copia).
const V = 'pogoc-v1';
const CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icon.svg', 'data/starter.js', 'js/core/scan.js', 'js/ui/scan-vision.js', 'js/ui/tab-scan.js',
  'js/core/constants.js', 'js/core/stats.js', 'js/core/iv.js', 'js/core/pvp.js', 'js/core/pve.js', 'js/data.js',
  'js/ui/kit.js', 'js/ui/tab-home.js', 'js/ui/tab-iv.js', 'js/ui/tab-pvp.js', 'js/ui/tab-pve.js', 'js/ui/tab-types.js', 'js/ui/tab-box.js', 'js/ui/tab-data.js', 'js/ui/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const isData = /\/(data\/[^/]+\.json|config\/.*\.json)$/.test(u.pathname);
  if (isData) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
