"use client";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import PushNotifications from "./push-notifications";
import { readPortalJson } from "./portal-status";
import { startVisiblePolling } from "./visible-poller";
type Alert = { id: string; severity: "critical" | "warning" | "info"; category: string; title: string; detail: string; page: string };
export default function SmartAlerts({ icon, onNavigate }: { icon: ReactNode; onNavigate: (page: string) => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]), [open, setOpen] = useState(false), [error, setError] = useState(""); const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const poller = useRef<ReturnType<typeof startVisiblePolling> | null>(null);
  const load = useCallback(() => poller.current?.refresh(), []);
  const refresh = useCallback(async (signal: AbortSignal) => {
    setRefreshing(true);
    try {
      const result = await readPortalJson<{ alerts?: Alert[] }>("/api/alerts", "Alerts unavailable", signal);
      if (signal.aborted) return;
      setAlerts(result.alerts ?? []); setLoaded(true); setError("");
    } catch { if (!signal.aborted) setError("Alerts could not refresh. Current attention items are not verified. Retry when connected."); }
    finally { if (!signal.aborted) setRefreshing(false); }
  }, []);
  useEffect(() => { const current = startVisiblePolling(refresh); poller.current = current; return () => { current.stop(); poller.current = null; }; }, [refresh]);
  useEffect(() => { const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  return <div className="smart-alerts" ref={root}><button className="notification-button" aria-label={error ? "Smart alerts unavailable" : loaded ? `${alerts.length} smart alerts` : "Loading smart alerts"} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>{icon}{error && <span>!</span>}{!error && alerts.length > 0 && <span>{alerts.length > 99 ? "99+" : alerts.length}</span>}</button>{open && <section className="alert-popover"><header><div><strong>Smart alerts</strong><small>Operational and administrative attention</small></div><button disabled={refreshing} onClick={() => void load()}>{refreshing ? "Refreshing…" : "Refresh"}</button></header>{error ? <p className="alert-error" role="alert">{error}</p> : !loaded ? <p role="status">Checking current alerts…</p> : alerts.length ? <div className="alert-list">{alerts.map((alert) => <button key={alert.id} className={alert.severity} onClick={() => { onNavigate(alert.page); setOpen(false); }}><i>{alert.severity === "critical" ? "!" : alert.severity === "warning" ? "△" : "i"}</i><span><small>{alert.category}</small><strong>{alert.title}</strong><p>{alert.detail}</p></span><b>›</b></button>)}</div> : <div className="alerts-clear"><span>✓</span><strong>No active alerts</strong><p>Current records do not require attention.</p></div>}<footer><PushNotifications/><span>Smart alerts refresh every minute</span></footer></section>}</div>;
}
