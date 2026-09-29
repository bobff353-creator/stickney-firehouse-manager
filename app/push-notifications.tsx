"use client";

import { useEffect, useState } from "react";

export type PushState = "checking" | "unsupported" | "unconfigured" | "off" | "on" | "blocked" | "unavailable";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function installedOnAppleDevice() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PushNotifications({ onStateChange }: { onStateChange?: (state: PushState) => void }) {
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [testAccepted, setTestAccepted] = useState(false);
  useEffect(() => { onStateChange?.(state); }, [state,onStateChange]);

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
        if (!response.ok) throw new Error(payload.error || "Unable to check push notifications");
        if (!payload.configured || !payload.publicKey) {
          if (!cancelled) setState("unconfigured");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const subscription = await registration.pushManager.getSubscription();
        let registered = false;
        if (subscription && Notification.permission === 'granted') {
          const check = await fetch('/api/push/subscriptions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'check',endpoint:subscription.endpoint}) });
          if (!check.ok) throw new Error('The server could not verify this device registration.');
          registered = (await check.json()).registered === true;
        }
        if (!cancelled) {
          setPublicKey(payload.publicKey);
          setState(Notification.permission === "denied" ? "blocked" : registered ? "on" : "off");
        }
      } catch (caught) {
        if (!cancelled) {
          setState("unavailable");
          setMessage(caught instanceof Error ? caught.message : "Unable to check push notifications");
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
        throw new Error(permission === "denied" ? "Notifications are blocked in this device’s browser settings." : "Notification permission was not granted.");
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
      if (!response.ok) throw new Error(payload.error || "Unable to register this device");
      setState("on");
      setMessage("Portal device alerts are on for this device. Call alerts and enabled schedule reminders follow your access permissions.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to enable push notifications");
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
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Device alerts could not be turned off. Try again when connected.");
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Push notifications are off for this device.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to turn off push notifications");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    setTestAccepted(false);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Enable push on this device first.');
      const response = await fetch("/api/push/test", { method: "POST", headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint}) });
      const payload = await response.json() as { accepted?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send the test alert");
      setTestAccepted(payload.accepted === 1);
      setMessage(payload.accepted ? "Provider accepted a test for this device. Look for the notification, then tap it to open Home. Receipt is not yet confirmed." : "The provider did not accept the test.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to send the test alert");
    } finally {
      setBusy(false);
    }
  }

  const label = state === "on" ? "Push notifications on · this device" : state === "checking" ? "Checking device alerts..." : state === "unavailable" ? "Device-alert status unavailable" : "Push notifications off · this device";
  return <section className={`push-notification-control ${state}`} aria-label="Push notifications on this device">
    <div><strong>{label}</strong><small>Controls this device only. Includes CAD calls and enabled schedule reminders, based on your access. Tap an alert to open its screen.</small></div>
    {state === "on" ? <div className="push-notification-actions"><button type="button" disabled={busy} onClick={() => void sendTest()}>Send test</button><button type="button" disabled={busy} onClick={() => void disable()}>Turn off</button></div>
      : state === "off" ? <button type="button" disabled={busy || !publicKey} onClick={() => void enable()}>{busy ? "Working..." : "Enable push"}</button>
      : null}
    {state === "blocked" && <p>Notifications are blocked. Allow them in the browser and device notification settings, then reopen the installed app.</p>}
    {state === "unsupported" && <p>This browser does not support background device alerts.</p>}
    {state === "unconfigured" && <p>The department push service is not configured yet.</p>}
    {testAccepted && <div className="push-notification-actions"><button type="button" onClick={()=>{setTestAccepted(false);setMessage('You confirmed seeing the test on this device. Test each phone separately.');}}>I received it</button><button type="button" onClick={()=>{setTestAccepted(false);setMessage('Check browser notification permission, operating-system notification settings and Focus / Do Not Disturb. On iPhone, open the installed Home Screen app. Then send another test.');}}>It did not appear</button></div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
