"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { latestSessionActivity, sessionActivityKey, sessionIsIdle } from "./session-activity";
import { rememberedDeviceRemainingMs } from "./remember-device";
import RememberDeviceOption from "./remember-device-option";

const inactivityLimitMs = 30 * 60 * 1000;
const unlockRefreshThrottleMs = 60 * 1000;
const stationDisplayRefreshMs = 5 * 60 * 1000;

function clearAccessCache() {
  document.cookie = "__Secure-firehouse-access=; Path=/; Max-Age=0; SameSite=Lax; Secure";
}

export default function SessionIdleLock({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: () => Promise<void> | void;
}) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [message, setMessage] = useState("");
  const [stationDisplay, setStationDisplay] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    const syncDisplayMode = () => {
      const requestedDisplay = new URLSearchParams(window.location.search).get("display");
      setStationDisplay(requestedDisplay === "tv" || (requestedDisplay !== "portal" && window.localStorage.getItem("stickney-operations-tv-mode") === "true"));
    };
    syncDisplayMode();
    window.addEventListener("popstate", syncDisplayMode);
    window.addEventListener("firehouse:tv-mode", syncDisplayMode);
    return () => {
      window.removeEventListener("popstate", syncDisplayMode);
      window.removeEventListener("firehouse:tv-mode", syncDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (locked) return;
    let lastActivity = Date.now();
    let lastUnlockRefresh = 0;
    let unlockRefreshTimer: number | undefined;
    let disposed = false;
    let refreshInFlight = false;
    let rememberedDeadline = 0;
    const readActivity = () => {
      try { lastActivity = latestSessionActivity(lastActivity, window.localStorage.getItem(sessionActivityKey), Date.now()); } catch { /* This tab still tracks activity if storage is blocked. */ }
      return lastActivity;
    };
    const shareActivity = () => {
      try { window.localStorage.setItem(sessionActivityKey, String(lastActivity)); } catch { /* Storage is optional; server PIN checks remain authoritative. */ }
    };
    shareActivity();

    const lock = (force = false) => {
      if (stationDisplay && !force) return;
      setLocked(true);
      setPin("");
      setRememberDevice(false);
      setMessage(force
        ? stationDisplay ? "The secure display lease ended. Enter your PIN to reconnect the board." : "Your secure session needs verification. Enter your PIN to continue."
        : "The app locked after 30 minutes without activity. Your unfinished work is still here.");
      void fetch("/api/auth/pin", { method: "DELETE" }).catch(() => undefined);
    };
    const refreshUnlock = async (checkIdle = false) => {
      if (disposed || refreshInFlight) return;
      refreshInFlight = true;
      lastUnlockRefresh = Date.now();
      const response = await fetch("/api/auth/pin", {
        method: "PATCH",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display: stationDisplay ? "tv" : "portal" }),
      }).catch(() => null);
      if (!disposed && response?.ok) {
        const status = await response.json().catch(() => ({}));
        const remaining = rememberedDeviceRemainingMs(status);
        rememberedDeadline = remaining ? Date.now() + remaining : 0;
      }
      refreshInFlight = false;
      if (!disposed && (response?.status === 423 || response?.status === 401)) lock(true);
      else if (!disposed && checkIdle && !rememberedDeadline && !stationDisplay
        && sessionIsIdle(readActivity(), Date.now(), inactivityLimitMs)) lock();
    };
    const scheduleUnlockRefresh = () => {
      if (rememberedDeadline) return; // No activity-based extension of a seven-day lease.
      if (unlockRefreshTimer !== undefined) return;
      const delay = Math.max(0, unlockRefreshThrottleMs - (Date.now() - lastUnlockRefresh));
      unlockRefreshTimer = window.setTimeout(() => {
        unlockRefreshTimer = undefined;
        void refreshUnlock();
      }, delay);
    };
    const shouldStopForLock = () => {
      if (rememberedDeadline) {
        if (Date.now() >= rememberedDeadline) { lock(true); return true; }
        return false;
      }
      if (!stationDisplay && sessionIsIdle(readActivity(), Date.now(), inactivityLimitMs)) {
        // A different tab may have just remembered this browser. Check the shared
        // server cookie before deleting it because of this tab's older idle state.
        void refreshUnlock(true);
        return true;
      }
      return false;
    };
    const recordActivity = () => {
      if (shouldStopForLock()) return;
      lastActivity = Date.now();
      scheduleUnlockRefresh();
      shareActivity();
    };
    const checkInactivity = () => {
      shouldStopForLock();
    };
    const checkVisibility = () => {
      if (shouldStopForLock()) return;
      // Leaving a screen starts the background grace period; returning within it is activity.
      recordActivity();
      if (unlockRefreshTimer !== undefined) { window.clearTimeout(unlockRefreshTimer); unlockRefreshTimer = undefined; }
      void refreshUnlock();
    };

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
    const forceLock = () => lock(true);
    window.addEventListener("firehouse:session-lock", forceLock);
    document.addEventListener("visibilitychange", checkVisibility);
    const timer = window.setInterval(checkInactivity, 15_000);
    const stationDisplayTimer = stationDisplay ? window.setInterval(() => void refreshUnlock(), stationDisplayRefreshMs) : undefined;
    void refreshUnlock();
    return () => {
      disposed = true;
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity, { capture: true }));
      window.removeEventListener("firehouse:session-lock", forceLock);
      document.removeEventListener("visibilitychange", checkVisibility);
      if (unlockRefreshTimer !== undefined) window.clearTimeout(unlockRefreshTimer);
      if (stationDisplayTimer !== undefined) window.clearInterval(stationDisplayTimer);
      window.clearInterval(timer);
    };
  }, [locked, stationDisplay]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unlocking) return;
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Enter your 4 to 6 digit PIN.");
      return;
    }
    setMessage("Unlocking department records...");
    setUnlocking(true);
    try {
    const response = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", pin, rememberDevice }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "The PIN could not be verified.");
      return;
    }
    setPin("");
    setMessage("");
    setLocked(false);
    window.dispatchEvent(new Event("firehouse:session-unlocked"));
    } catch {
      setMessage("Unable to reach the portal. Check your connection and retry; your work is still preserved.");
    } finally {
      setUnlocking(false);
    }
  }

  async function signOut() {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    clearAccessCache();
    await fetch("/api/auth/pin", { method: "DELETE", signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
    await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
    window.location.assign("/");
  }

  return (
    <>
      <div aria-hidden={locked} inert={locked} className={locked ? "app-under-session-lock" : undefined}>{children}</div>
      {locked ? <main className="session-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="session-lock-title">
        <section className="login-card login-waiting-card">
          <span className="login-app-mark" aria-hidden="true">SFD</span>
          <p className="login-eyebrow">APP LOCKED · WORK PRESERVED</p>
          <h1 id="session-lock-title">Enter your portal PIN</h1>
          <p>Your task and screen remain open behind this lock. Unless you remember a personal device, the portal locks after 30 minutes without activity.</p>
          <form onSubmit={unlock}>
            <label>Portal PIN<input autoFocus type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            <RememberDeviceOption checked={rememberDevice} onChange={setRememberDevice} />
            {message ? <p className="login-message" role="status">{message}</p> : null}
            <button className="login-primary" type="submit" disabled={unlocking}>{unlocking ? "Unlocking…" : "Unlock and continue"}</button>
          </form>
          <button type="button" className="login-link-button" onClick={signOut}>Sign out instead</button>
        </section>
      </main> : null}
    </>
  );
}
