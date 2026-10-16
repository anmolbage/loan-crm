/* Loan CRM — service worker (app shell cache, offline first) */
const CACHE = 'loan-crm-v1.2.0';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/config.js',
  './js/store.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // cache: 'reload' skips the browser's HTTP cache so the new version never stores old files
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API writes never cached
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // Google API, fonts: browser handles them

  // Network-first for the app shell so updates land quickly, falling back to cache
  // when the phone is offline. cache: 'no-cache' makes the browser re-check every
  // file with GitHub instead of reusing its 10-minute HTTP copy, so a page never
  // mixes an old index.html with a new app.js after an update.
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
