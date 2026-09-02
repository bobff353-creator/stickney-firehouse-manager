export function portalConnectionState(online: boolean, loading: boolean, error: string, hasLoaded: boolean, saving = false) {
  if (!online) return { label: "Offline", tone: "offline", detail: "Connection lost. On-screen information may be out of date." };
  if (error) return { label: "Needs attention", tone: "offline", detail: "A request failed. Review the message on this screen." };
  if (saving) return { label: "Saving hours", tone: "saving", detail: "Payroll hours are being saved. Keep this screen open." };
  if (loading || !hasLoaded) return { label: "Loading", tone: "saving", detail: "Loading portal access and payroll information." };
  return { label: "Online", tone: "saved", detail: "Browser online. Each screen reports its own data and save status." };
}

/** Bound read requests so a stalled connection does not leave an endless spinner. */
export async function readPortalJson<T>(url: string, unavailable: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || unavailable);
  return body as T;
}
