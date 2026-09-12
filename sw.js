/* Service worker: cachea la app para que funcione sin conexión.
   Al subir una versión nueva, cambia 'domino-v1' por 'domino-v2', etc. */
const CACHE = "domino-v7";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./engine.js", "./conocimiento.js", "./partida.js", "./nube.js", "./ui.js",
  "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // stale-while-revalidate: sirve rápido desde caché y actualiza en segundo plano
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(req);
    const net = fetch(req).then(res => { try { c.put(req, res.clone()); } catch (_) {} return res; })
                          .catch(() => cached);
    return cached || net;
  }));
});
