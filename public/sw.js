const CACHE = "sfd-operations-v2";
const SHELL = ["/", "/manifest.webmanifest?v=2", "/stickney-fd-patch.jpg?v=2"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); if (response.ok && new URL(event.request.url).origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))));
});
