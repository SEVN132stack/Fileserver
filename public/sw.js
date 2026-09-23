// Service worker voor de PWA. Cachet de app-schil (stale-while-revalidate) zodat
// de UI ook offline laadt, met een offline-fallback voor navigatie. API-,
// download- en WebDAV-verzoeken gaan altijd naar het netwerk.
const CACHE = 'fileserver-v3';
const SHELL = [
  '/', '/index.html', '/app.js', '/login.html', '/manifest.json', '/offline.html',
  '/crypto.js', '/keyring.js', '/rsync.js', '/webauthn.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const BYPASS = ['/api', '/webdav', '/tus', '/metrics', '/s/', '/g/'];

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (BYPASS.some((p) => url.pathname.startsWith(p))) return;

  // Navigatie: netwerk eerst, val bij offline terug op de gecachete schil of
  // een nette offline-pagina.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('/') || caches.match('/offline.html'))));
    return;
  }

  // Statische assets: stale-while-revalidate — direct uit cache serveren en op
  // de achtergrond verversen.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
