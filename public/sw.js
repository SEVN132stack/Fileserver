// Minimale service worker voor de PWA. Cachet de app-schil zodat de UI ook
// offline laadt; API-verzoeken gaan altijd naar het netwerk.
const CACHE = 'fileserver-v1';
const SHELL = ['/', '/index.html', '/app.js', '/login.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API, downloads en WebDAV nooit uit cache.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/webdav') || url.pathname.startsWith('/s/')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});
