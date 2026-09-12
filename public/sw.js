const CACHE_NAME = "stickney-firehouse-shell-v2";
// IDs only, no call details or credentials. Keep across service-worker upgrades.
const PUSH_RECEIPTS = "stickney-cad-receipts-v1";
const SCHEDULER_RECEIPTS = "stickney-scheduler-receipts-v1";
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
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, PUSH_RECEIPTS, SCHEDULER_RECEIPTS].includes(key)).map((key) => caches.delete(key))))
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

let pushSequence = Promise.resolve();
let schedulerSequence = Promise.resolve();
async function displayCadPush(payload) {
  const routine = payload.kind === 'scheduler';
  const eventId = typeof payload.eventId === "string" && /^[0-9a-f-]{36}$/i.test(payload.eventId) ? payload.eventId : null;
  const receiptUrl = eventId ? new URL(`/__cad_receipt__/${eventId}`, self.location.origin).href : null;
  let receipts = null;
  try {
    if (receiptUrl) {
      receipts = await caches.open(routine ? SCHEDULER_RECEIPTS : PUSH_RECEIPTS);
      if (await receipts.match(receiptUrl)) return;
    }
  } catch { /* Storage failure must not suppress an emergency notification. */ }
  const title = payload.title || "New Stickney CAD call";
  await self.registration.showNotification(title, {
    body: payload.body || "Open Respond for call details.",
    icon: payload.icon || "/icons/pwa-192.png",
    badge: payload.badge || "/icons/pwa-96.png",
    tag: payload.tag || "stickney-cad-call",
    renotify: false,
    requireInteraction: !routine,
    data: { url: payload.url || "/?page=respond", incidentId: payload.incidentId || "", kind: payload.kind || "cad" }
  });
  // Record only after display succeeds: recording beforehand could lose an alert.
  try {
    if (receipts && receiptUrl) {
      await receipts.put(receiptUrl, new Response("", { status: 200 }));
      const keys = await receipts.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 200)).map(key => receipts.delete(key)));
    }
  } catch { /* Stable notification tag still avoids replacing alerts noisily. */ }
}
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  // Routine work never queues in front of incoming CAD notifications, and its
  // receipts cannot evict CAD duplicate protection.
  if (payload.kind === 'scheduler') {
    schedulerSequence = schedulerSequence.catch(() => {}).then(() => displayCadPush(payload));
    event.waitUntil(schedulerSequence);
  } else {
    pushSequence = pushSequence.catch(() => {}).then(() => displayCadPush(payload));
    event.waitUntil(pushSequence);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?page=respond", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    // A routine reminder must not navigate an apparatus/TV off its live call.
    const existing = clients.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && (event.notification.data?.kind !== "scheduler" || url.searchParams.get("page") === "scheduling");
    });
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
