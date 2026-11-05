// sw.js
const CACHE_NAME = 'app-cache-v1';
const OFFLINE_PAGE = './index.html';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './app-shell.js'
];

// INSTALL
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Não falha o install se algum asset der 404
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
});

// FETCH
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1) OneSignal: nunca interceptar
  if (url.hostname.includes('onesignal')) return;

  // 2) ⭐ MANIFEST: sempre network (nunca cache)
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3) APIs (worker): sempre network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 4) Demais requisições: network-first com fallback de cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match(OFFLINE_PAGE);
      })
  );
});
