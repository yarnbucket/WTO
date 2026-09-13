const CACHE = 'wto-shell-v6';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './wto-icon.svg',
  './wto-icon-192.png',
  './wto-icon-512.png',
  './wto-apple-touch-icon-180.png',
  './wto-icon-maskable-512.png',
  './wto-welcome-trophy-room.png',
  './Whatstheodds.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const useNetworkFirst =
    event.request.mode === 'navigate' ||
    /\.json($|\?)/.test(url.pathname) ||
    url.pathname.endsWith('/manifest.webmanifest');

  if (useNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached =>
        cached ||
        fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
      )
  );
});
