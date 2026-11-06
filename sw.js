// Bei jeder Veröffentlichung VERSION erhöhen, damit alte Caches gelöscht werden.
const VERSION = 'genius-v17';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './fonts/outfit-latin.woff2',
  './js/app.js',
  './js/util.js',
  './js/icons.js',
  './js/state.js',
  './js/audio.js',
  './js/fx.js',
  './js/ui.js',
  './js/creatures.js',
  './js/story.js',
  './js/decoder.js',
  './js/comets.js',
  './js/music.js',
  './js/world.js',
  './js/gl.js',
  './js/scenery.js',
  './js/progress.js',
  './js/art.js',
  './js/perf.js',
  './js/games/index.js',
  './js/games/pyramid.js',
  './js/games/sequence.js',
  './js/games/asteroid.js',
  './js/games/scale.js',
  './js/games/binary.js',
  './js/games/magic.js',
  './js/games/fraction.js',
  './js/games/builder.js',
  './js/games/duel.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !k.startsWith('genius-art')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: sofort aus dem Cache (offline-fähig), im Hintergrund aktualisieren.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
    if (cached) { e.waitUntil(network); return cached; }
    return network;
  }));
});
