import webpush from "web-push";

type PushDatabase = {
  prepare(sql: string): {
    bind(...values: Array<string | number | null | undefined>): {
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

export type CadPushIncident = {
  incidentId: string;
  callType: string;
  timeOut: string;
  narrative: string;
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushRuntimeEnv = {
  WEB_PUSH_VAPID_PUBLIC_KEY?: string;
  WEB_PUSH_VAPID_PRIVATE_KEY?: string;
  WEB_PUSH_VAPID_SUBJECT?: string;
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function cadNotesPreview(value: string, limit = 140) {
  const cleaned = compact(value);
  if (!cleaned) return "No CAD notes provided.";
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(1, limit - 3)).trimEnd()}...`;
}

export function buildCadPushPayload(incident: CadPushIncident) {
  const callType = compact(incident.callType) || "New CAD call";
  const callNumber = compact(incident.incidentId) || "Pending";
  const timeOut = compact(incident.timeOut) || "----";
  return {
    title: callType,
    body: `Call ${callNumber} - Time out ${timeOut}\n${cadNotesPreview(incident.narrative)}`,
    icon: "/icons/pwa-192.png",
    badge: "/icons/pwa-96.png",
    tag: `cad-${callNumber}`,
    incidentId: callNumber,
    url: `/?page=respond&call=${encodeURIComponent(callNumber)}`,
  };
}

function runtimeConfig() {
  const runtime = process.env as PushRuntimeEnv;
  const publicKey = runtime.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = runtime.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || "";
  const subject = runtime.WEB_PUSH_VAPID_SUBJECT?.trim() || "https://stickney-firehouse-manager.vercel.app/";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
}

export function webPushPublicConfig() {
  const { publicKey, configured } = runtimeConfig();
  return { configured, publicKey: configured ? publicKey : "" };
}

export async function sendCadPushNotifications(
  db: PushDatabase,
  incident: CadPushIncident,
  target?: { userId: string; departmentId: string },
) {
  const config = runtimeConfig();
  if (!config.configured) return { configured: false, delivered: 0, failed: 0 };

  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const statement = target
      ? db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1 AND user_id = ? AND department_id = ? ORDER BY created_at").bind(target.userId, target.departmentId)
      : db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE active = 1 ORDER BY created_at").bind();
    const rows = await statement.all<StoredPushSubscription>();
    const payload = JSON.stringify(buildCadPushPayload(incident));
    let delivered = 0;
    let failed = 0;

    await Promise.all(rows.results.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 300, urgency: "high" },
        );
        delivered += 1;
        try {
          await db.prepare(
            "UPDATE push_subscriptions SET failure_count = 0, last_success_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).bind(subscription.id).run();
        } catch {
          // Delivery succeeded; bookkeeping must never reject CAD ingestion.
        }
      } catch (caught) {
        failed += 1;
        const statusCode = typeof caught === "object" && caught && "statusCode" in caught
          ? Number((caught as { statusCode?: unknown }).statusCode)
          : 0;
        const deactivate = statusCode === 404 || statusCode === 410;
        const message = caught instanceof Error ? caught.message.slice(0, 240) : "Push delivery failed";
        try {
          await db.prepare(
            "UPDATE push_subscriptions SET active = ?, failure_count = failure_count + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).bind(deactivate ? 0 : 1, message, subscription.id).run();
        } catch {
          // A failed subscription must not make the dispatch webhook fail.
        }
      }
    }));

    return { configured: true, delivered, failed };
  } catch {
    return { configured: true, delivered: 0, failed: 1 };
  }
}
