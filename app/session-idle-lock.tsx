"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

const inactivityLimitMs = 30 * 60 * 1000;
const unlockRefreshThrottleMs = 60 * 1000;

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
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (locked) return;
    let lastActivity = Date.now();
    let lastUnlockRefresh = 0;
    let unlockRefreshTimer: number | undefined;

    const lock = () => {
      setLocked(true);
      setPin("");
      setMessage("The app locked after 30 minutes without activity. Your unfinished work is still here.");
      void fetch("/api/auth/pin", { method: "DELETE" }).catch(() => undefined);
    };
    const refreshUnlock = async () => {
      lastUnlockRefresh = Date.now();
      const response = await fetch("/api/auth/pin", { method: "PATCH", cache: "no-store" }).catch(() => null);
      if (response?.status === 423) lock();
    };
    const scheduleUnlockRefresh = () => {
      if (unlockRefreshTimer !== undefined) return;
      const delay = Math.max(0, unlockRefreshThrottleMs - (Date.now() - lastUnlockRefresh));
      unlockRefreshTimer = window.setTimeout(() => {
        unlockRefreshTimer = undefined;
        void refreshUnlock();
      }, delay);
    };
    const recordActivity = () => {
      lastActivity = Date.now();
      scheduleUnlockRefresh();
    };
    const checkInactivity = () => {
      if (Date.now() - lastActivity >= inactivityLimitMs) lock();
    };
    const checkVisibility = () => {
      if (document.visibilityState === "visible") checkInactivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkVisibility);
    const timer = window.setInterval(checkInactivity, 15_000);
    void refreshUnlock();
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", checkVisibility);
      if (unlockRefreshTimer !== undefined) window.clearTimeout(unlockRefreshTimer);
      window.clearInterval(timer);
    };
  }, [locked]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Enter your 4 to 6 digit PIN.");
      return;
    }
    setMessage("Unlocking department records...");
    const response = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", pin }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "The PIN could not be verified.");
      return;
    }
    setPin("");
    setMessage("");
    setLocked(false);
  }

  async function signOut() {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    clearAccessCache();
    await fetch("/api/auth/pin", { method: "DELETE" }).catch(() => undefined);
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/");
  }

  return (
    <>
      <div aria-hidden={locked} className={locked ? "app-under-session-lock" : undefined}>{children}</div>
      {locked ? <main className="session-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="session-lock-title">
        <section className="login-card login-waiting-card">
          <span className="login-app-mark" aria-hidden="true">SFD</span>
          <p className="login-eyebrow">APP LOCKED · WORK PRESERVED</p>
          <h1 id="session-lock-title">Enter your portal PIN</h1>
          <p>For security, the app locked after 30 minutes without activity. The task and screen you were working on remain open behind this lock.</p>
          <form onSubmit={unlock}>
            <label>Portal PIN<input autoFocus type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            {message ? <p className="login-message" role="status">{message}</p> : null}
            <button className="login-primary" type="submit">Unlock and continue</button>
          </form>
          <button type="button" className="login-link-button" onClick={signOut}>Sign out instead</button>
        </section>
      </main> : null}
    </>
  );
}
