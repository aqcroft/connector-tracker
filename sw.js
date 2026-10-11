// CAT's shell is offline-capable, but navigation must check for the current release.
const BASE = new URL('./', self.registration.scope);
const SCOPE_KEY = new URL(self.registration.scope).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
const VERSION = new URL(self.location.href).searchParams.get('version') || 'dev';
const CACHE_SCHEMA = 16;
const CACHE_PREFIX = 'connector-tracker-v';
const CACHE = `${CACHE_PREFIX}${VERSION}-c${CACHE_SCHEMA}-${SCOPE_KEY}`;
const INDEX = new URL('index.html', BASE).pathname;
const SHELL = ['index.html', 'styles.css', 'ux-v06.css', 'app-meta.js', 'cloud-config.js', 'cloud-client.js', 'connector-qr.js', 'app.js', 'manifest.webmanifest', 'icon.svg'].map(file => new URL(file, BASE).pathname);

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key =>
      key.startsWith(CACHE_PREFIX) && key.endsWith('-' + SCOPE_KEY) && key !== CACHE
    ).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Network-first for page loads. A previous cache-first navigation trapped
  // existing users on stale releases after GitHub Pages had deployed updates.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(INDEX, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(INDEX)) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  })));
});
