const CACHE_NAME = 'my-food-list-shell-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Only cache same-origin GET requests for the static app shell. Supabase API
// calls (a different origin) are intentionally never intercepted here, so
// restaurant data is always read live, never served stale from a cache.
//
// Network-first, cache as offline fallback only. This app ships frequent
// code changes (not just data), so always prefer the live deploy when
// online; the cache exists purely so the shell still loads with no signal.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req)))
  );
});
