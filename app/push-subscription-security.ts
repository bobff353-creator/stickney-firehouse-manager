// Browser push services only: never turn a saved subscription into an arbitrary
// server-side request. This also protects workers consuming older saved rows.
export function trustedPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname;
    return host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host === "push.services.mozilla.com"
      || /^[a-z0-9-]+\.push\.apple\.com$/.test(host)
      || host === "web.push.apple.com"
      || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
  } catch {
    return false;
  }
}

export function validPushKeys(p256dh: unknown, auth: unknown) {
  // Web Push uses a 65-byte uncompressed P-256 public key and a 16-byte auth secret.
  const decode = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]+={0,2}$/.test(value)
    ? Buffer.from(value, "base64url") : null;
  const publicKey = decode(p256dh), secret = decode(auth);
  return publicKey?.length === 65 && publicKey[0] === 4 && secret?.length === 16;
}

export function assertTrustedPushSubscription(subscription: { endpoint: string; p256dh: string; auth: string }) {
  if (!trustedPushEndpoint(subscription.endpoint) || !validPushKeys(subscription.p256dh, subscription.auth)) {
    // A permanent failure lets the existing outbox retire this row without a request.
    throw Object.assign(new Error("Invalid browser push subscription"), { statusCode: 410 });
  }
}
