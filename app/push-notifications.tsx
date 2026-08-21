"use client";

import { useEffect, useState } from "react";

type PushState = "checking" | "unsupported" | "unconfigured" | "off" | "on" | "blocked";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function installedOnAppleDevice() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PushNotifications() {
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const response = await fetch("/api/push/subscriptions", { cache: "no-store" });
        const payload = await response.json() as { configured?: boolean; publicKey?: string; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to check CAD alerts");
        if (!payload.configured || !payload.publicKey) {
          if (!cancelled) setState("unconfigured");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setPublicKey(payload.publicKey);
          setState(Notification.permission === "denied" ? "blocked" : subscription ? "on" : "off");
        }
      } catch (caught) {
        if (!cancelled) {
          setState("off");
          setMessage(caught instanceof Error ? caught.message : "Unable to check CAD alerts");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (appleMobile && !installedOnAppleDevice()) {
        throw new Error("On iPhone or iPad, add this portal to the Home Screen, open the installed app, then enable alerts here.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        throw new Error(permission === "denied" ? "Notifications are blocked in this phone's settings." : "Notification permission was not granted.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to register this phone");
      setState("on");
      setMessage("CAD phone alerts are on for this device.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to enable CAD alerts");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("CAD phone alerts are off for this device.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to turn off CAD alerts");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const payload = await response.json() as { delivered?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send the test alert");
      setMessage(payload.delivered ? "Test alert sent to your registered devices." : "No registered device received the test.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to send the test alert");
    } finally {
      setBusy(false);
    }
  }

  const label = state === "on" ? "CAD phone alerts on" : state === "checking" ? "Checking phone alerts..." : "CAD phone alerts off";
  return <section className={`push-notification-control ${state}`} aria-label="CAD phone notifications">
    <div><strong>{label}</strong><small>Call type - call number - time out - CAD notes</small></div>
    {state === "on" ? <div className="push-notification-actions"><button type="button" disabled={busy} onClick={() => void sendTest()}>Send test</button><button type="button" disabled={busy} onClick={() => void disable()}>Turn off</button></div>
      : state === "off" ? <button type="button" disabled={busy || !publicKey} onClick={() => void enable()}>{busy ? "Working..." : "Enable"}</button>
      : null}
    {state === "blocked" && <p>Notifications are blocked. Allow them in the phone’s notification settings, then reopen the installed app.</p>}
    {state === "unsupported" && <p>This browser does not support background phone alerts.</p>}
    {state === "unconfigured" && <p>The department push service is not configured yet.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
