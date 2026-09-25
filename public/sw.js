const CACHE = 'cronos-shell-v3';
const BASE = '/prime-tech/';
const CORE = [
  BASE,
  `${BASE}manifest.webmanifest`,
  `${BASE}brand/prime-tech-logo.jpeg`,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request, isNavigation ? { cache: 'no-store' } : undefined)
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (isNavigation) {
          return caches.match(BASE);
        }

        return Response.error();
      }),
  );
});
