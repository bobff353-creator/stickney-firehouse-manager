const CACHE_NAME = "stickney-firehouse-shell-v2";
const OFFLINE_URL = "/offline.html";
const SAFE_STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/pwa-96.png",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/pwa-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (SAFE_STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || "New Stickney CAD call";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "Open Respond for call details.",
    icon: payload.icon || "/icons/pwa-192.png",
    badge: payload.badge || "/icons/pwa-96.png",
    tag: payload.tag || "stickney-cad-call",
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || "/?page=respond", incidentId: payload.incidentId || "" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?page=respond", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
