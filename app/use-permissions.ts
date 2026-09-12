"use client";

import { useEffect, useSyncExternalStore } from "react";

type Access = { verified: boolean; permissions: string[]; revision: string | null; error: string; identity: string; checking: boolean };
const empty: Access = { verified: false, permissions: [], revision: null, error: "", identity: "", checking: false };
let state = empty;
const listeners = new Set<() => void>();
let pending: Promise<Access> | null = null;
let controller: AbortController | null = null;
let generation = 0;
function publish(next: Access) { state = next; listeners.forEach(notify => notify()); }

export function refreshPermissions() {
  if (pending) return pending;
  const requestGeneration = generation;
  controller = new AbortController();
  const requestController = controller;
  publish({ ...state, checking: true });
  const request = (async () => {
    // Retry one transient failure, never an expired/locked/denied login. Failed
    // verification clears grants immediately; a retry never authorizes offline.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let retryable = true;
      try {
        const response = await fetch("/api/permissions?scope=viewer", { cache: "no-store", signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(10000)]) });
        retryable = response.status === 409 || response.status >= 500;
        const payload = await response.json() as { viewerPermissions?: string[]; revision?: string; identity?: string; error?: string };
        if (!response.ok || !Array.isArray(payload.viewerPermissions)) throw new Error(payload.error || "Your permissions could not be verified.");
        const next = { verified: true, permissions: payload.viewerPermissions, revision: payload.revision ?? null, identity: payload.identity ?? "", error: "", checking: false };
        if (requestGeneration === generation) publish(next);
        break;
      } catch (error) {
        if (requestGeneration !== generation || requestController.signal.aborted) break;
        const retry = retryable && attempt === 0;
        const message = error instanceof Error && error.name === "TimeoutError"
          ? "The access check took too long. Your saved inspection results are still stored."
          : error instanceof TypeError ? "The connection was interrupted. Reconnect to verify access."
          : error instanceof Error ? error.message : "Reconnect to verify access.";
        publish({ ...empty, error: message, checking: retry });
        if (!retry) break;
      }
    }
    return state;
  })().finally(() => { if (pending === request) { pending = null; controller = null; } });
  pending = request;
  return pending;
}

export function permissionsChanged() {
  window.dispatchEvent(new Event("firehouse:permissions-changed"));
  // The message contains no grants or identity; receivers always verify on the server.
  try { const channel = new BroadcastChannel("firehouse-permissions"); channel.postMessage("changed"); channel.close(); } catch { /* focus/poll fallback */ }
  return refreshPermissions();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
    if (!listeners.size) { generation += 1; state = empty; controller?.abort(); controller = null; pending = null; }
  };
}

export function usePermissions() {
  const access = useSyncExternalStore(subscribe, () => state, () => empty);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") void refreshPermissions(); };
    const offline = () => { generation += 1; controller?.abort(); controller = null; pending = null; publish({ ...empty, error: "Offline. Reconnect to verify your current access." }); };
    void refreshPermissions();
    const timer = window.setInterval(refresh, 15000);
    let channel: BroadcastChannel | null = null;
    try { channel = new BroadcastChannel("firehouse-permissions"); channel.onmessage = refresh; } catch { /* timer fallback */ }
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    window.addEventListener("firehouse:permissions-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer); channel?.close();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      window.removeEventListener("firehouse:permissions-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return access;
}
