/* Service worker del modo evento (se genera en el build con la lista real
 * de archivos). Guarda la app completa —incluidos el OCR y los stage
 * plots— para que abra y funcione sin conexión. La sincronización (/api/)
 * nunca se guarda en caché. */
const VERSION = "backline-__VERSION__";
const ARCHIVOS = __ARCHIVOS__;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("backline-") && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;
  if (e.request.mode === "navigate") {
    // La página: primero la red (para recibir actualizaciones), si no hay, la guardada.
    e.respondWith(fetch(e.request).catch(() => caches.match("./", { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
    return res;
  })));
});
