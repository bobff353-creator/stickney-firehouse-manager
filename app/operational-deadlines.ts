// Timestamp boundaries need no database mutation to become due. Keep them on a
// local timer, including future alerts not yet included in the visible packet.
export function nextOperationalDeadline(rows: unknown[], now = Date.now(), includeCallExpiry = false) {
  let next = Number.POSITIVE_INFINITY;
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    for (const key of ['effectiveAt', 'expiresAt', 'startsAt', 'endsAt']) {
      const time = Date.parse(String(row[key] ?? ''));
      if (time > now) next = Math.min(next, time);
    }
    if (includeCallExpiry) {
      const expiry = Date.parse(String(row.dispatchedAt ?? '')) + 12 * 3600_000;
      if (expiry > now) next = Math.min(next, expiry + 1);
    }
  }
  return Number.isFinite(next) ? next : 0;
}
