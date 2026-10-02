const BASE = new URL('./', self.registration.scope);
const SCOPE_KEY = new URL(self.registration.scope).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
const VERSION = new URL(self.location.href).searchParams.get('version') || 'dev';
const CACHE = `connector-tracker-v${VERSION}-${SCOPE_KEY}`;
const SHELL = ['index.html', 'styles.css', 'app-meta.js', 'app.js', 'manifest.webmanifest', 'icon.svg'].map(file => new URL(file, BASE).pathname);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(new URL('index.html', BASE).pathname))));
});
