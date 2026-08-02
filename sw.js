/* Service Worker de Producción FVB.
   Permite abrir la app SIN internet en visitas posteriores: guarda en caché la
   página y el SDK de Firebase. Los datos en vivo (Firestore) NO se interceptan:
   Firestore maneja su propio modo offline con caché local (IndexedDB). */

const CACHE = "fvb-offline-v3";

/* App shell + módulos de entrada de Firebase (sus sub-módulos se cachean solos
   la primera vez que se cargan, gracias al handler de fetch). */
const ASSETS = [
  "./",
  "./index.html",
  "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled: si alguna URL falla (p. ej. sin red al instalar) no rompe el SW.
    await Promise.allSettled(ASSETS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // No interceptar el tráfico de backend de Firebase/Google: Firestore gestiona
  // su propia sincronización y persistencia offline.
  if (/(^|\.)googleapis\.com$/.test(url.hostname) ||
      /firebaseio\.com$/.test(url.hostname) ||
      /firebasestorage\.(app|googleapis\.com)$/.test(url.hostname) ||
      url.hostname.endsWith("firebase.googleapis.com")) {
    return;
  }

  // App shell + SDK de Firebase: responder desde caché y refrescar en segundo
  // plano (stale-while-revalidate) para funcionar offline y actualizarse online.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
