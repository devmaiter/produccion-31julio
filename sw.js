/* La app del 31 de julio vivía en la raíz con un service worker que cacheaba
   esta ruta. Ahora vive en produccion-31-julio/ y la raíz es la Home. Este
   worker reemplaza al viejo, borra sus cachés y se da de baja. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
