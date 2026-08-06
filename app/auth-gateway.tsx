"use client";

import type { User } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useRef, useState } from "react";
import PayrollApp from "./payroll-app";
import SessionIdleLock from "./session-idle-lock";
import { getSupabaseBrowserClient } from "./supabase-browser";

type Mode = "loading" | "sign-in" | "checking" | "set-pin" | "pin" | "authorized" | "waiting";

function clearAccessCache() {
  document.cookie = "__Secure-firehouse-access=; Path=/; Max-Age=0; SameSite=Lax; Secure";
}

export default function AuthGateway({
  initiallyVerified,
  initialPage,
}: {
  initiallyVerified: boolean;
  initialPage?: "Dashboard" | "Inventory";
}) {
  const [mode, setMode] = useState<Mode>(initiallyVerified ? "authorized" : "loading");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const accessCheckRef = useRef<Promise<void> | null>(null);
  const pinLoginRef = useRef(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => {
      if (data.user) void checkAccess(data.user, !initiallyVerified);
      else {
        clearAccessCache();
        setMode("sign-in");
      }
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        if (event === "SIGNED_OUT") {
          clearAccessCache();
          setUser(null);
          setMode("sign-in");
        }
        return;
      }
      if (event === "SIGNED_IN") {
        if (pinLoginRef.current) return;
        void checkAccess(session.user, !initiallyVerified);
      } else if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        void checkAccess(session.user, false);
      }
    });
    return () => data.subscription.unsubscribe();
    // Access checks deliberately key off auth events; routine refreshes stay non-blocking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess(nextUser: User, blocking = true) {
    if (accessCheckRef.current) return accessCheckRef.current;
    const request = (async () => {
      setUser(nextUser);
      if (blocking) setMode("checking");
      try {
        const response = await fetch("/api/auth/context", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as { pinConfigured?: boolean; pinUnlocked?: boolean };
          if (!payload.pinConfigured) {
            setPin("");
            setPinConfirmation("");
            setMode("set-pin");
            setMessage("");
            return;
          }
          if (payload.pinConfigured && !payload.pinUnlocked) {
            setPin("");
            setMode("pin");
            setMessage("");
            return;
          }
          setMode("authorized");
          setMessage("");
          return;
        }
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 403) {
          clearAccessCache();
          setMode("waiting");
          setMessage(payload.error || "A department administrator must approve access.");
          return;
        }
        if (response.status !== 401 && !blocking) return;
        clearAccessCache();
        await getSupabaseBrowserClient().auth.signOut();
        setUser(null);
        setMode("sign-in");
        setMessage(payload.error || "Your session expired. Please sign in again.");
      } catch {
        if (blocking) {
          setMode("sign-in");
          setMessage("Department access could not be verified. Check the connection and try again.");
        }
      }
    })();
    accessCheckRef.current = request;
    try {
      await request;
    } finally {
      accessCheckRef.current = null;
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Enter your 4 to 6 digit private PIN.");
      return;
    }
    setMode("checking");
    setMessage("Signing in...");
    pinLoginRef.current = true;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, pin }),
      });
      const responsePayload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMode("sign-in");
        setMessage(responsePayload.error || "That email or PIN is not correct.");
        return;
      }
      setPin("");
      window.location.reload();
    } finally {
      pinLoginRef.current = false;
    }
  }

  async function emailSignInLink() {
    if (!email.trim()) {
      setMessage("Enter your invited email address first.");
      return;
    }
    const callback = new URL("/auth/confirm", window.location.origin);
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
    });
    setMessage(error ? error.message : "One-time activation or upgrade email sent. Open it and enter your existing PIN once; future logins will use email and PIN only.");
  }

  async function unlockWithPin(event: FormEvent<HTMLFormElement>) {
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
    setMode("authorized");
  }

  async function createPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Choose a PIN containing 4 to 6 digits.");
      return;
    }
    if (pin !== pinConfirmation) {
      setMessage("The two PIN entries do not match.");
      return;
    }
    setMessage("Saving your portal PIN...");
    const response = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", pin }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "The PIN could not be saved.");
      return;
    }
    setPin("");
    setPinConfirmation("");
    setMessage("");
    setMode("authorized");
  }

  async function signOut() {
    clearAccessCache();
    await fetch("/api/auth/pin", { method: "DELETE" }).catch(() => undefined);
    await getSupabaseBrowserClient().auth.signOut();
    setPin("");
    setUser(null);
    setMode("sign-in");
    setMessage("Signed out.");
  }

  if (mode === "authorized") {
    return (
      <SessionIdleLock onSignOut={signOut}>
        <PayrollApp
          accountEmail={user?.email || ""}
          onSignOut={signOut}
          initialPage={initialPage}
        />
      </SessionIdleLock>
    );
  }

  if (mode === "waiting") {
    return (
      <main className="login-shell">
        <section className="login-card login-waiting-card">
          <span className="login-app-mark" aria-hidden="true">FC</span>
          <p className="login-eyebrow">EMAIL CONFIRMED</p>
          <h1>Department approval needed</h1>
          <p>{message}</p>
          <dl>
            <div><dt>Account</dt><dd>{user?.email}</dd></div>
            <div><dt>Records</dt><dd>Protected until approved</dd></div>
          </dl>
          <button type="button" className="login-primary" onClick={() => user && checkAccess(user)}>Check again</button>
          <button type="button" className="login-link-button" onClick={signOut}>Use a different account</button>
        </section>
      </main>
    );
  }

  if (mode === "set-pin") {
    return (
      <main className="login-shell">
        <section className="login-card login-waiting-card">
          <span className="login-app-mark" aria-hidden="true">SFD</span>
          <p className="login-eyebrow">EMAIL VERIFIED · ONE-TIME SETUP</p>
          <h1>Create your portal PIN</h1>
          <p>Your approved account existed before PIN login was added. Create 4 to 6 digits now; no department records or unfinished work will be removed.</p>
          <dl className="invite-account-summary"><div><dt>Verified account</dt><dd>{user?.email}</dd></div><div><dt>Department</dt><dd>Stickney Fire Department</dd></div></dl>
          <form onSubmit={createPin}>
            <label>New PIN<input autoFocus type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            <label>Confirm PIN<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pinConfirmation} onChange={(event) => setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            {message ? <p className="login-message" role="status">{message}</p> : null}
            <button className="login-primary" type="submit">Save PIN and open the app</button>
          </form>
          <button type="button" className="login-link-button" onClick={signOut}>Use a different account</button>
        </section>
      </main>
    );
  }

  if (mode === "pin") {
    return (
      <main className="login-shell">
        <section className="login-card login-waiting-card">
          <span className="login-app-mark" aria-hidden="true">SFD</span>
          <p className="login-eyebrow">VERIFIED ACCOUNT</p>
          <h1>Enter your portal PIN</h1>
          <p>Your email session is verified. Enter the 4 to 6 digit PIN you created when joining the department app.</p>
          <form onSubmit={unlockWithPin}>
            <label>Portal PIN<input autoFocus type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            {message ? <p className="login-message" role="status">{message}</p> : null}
            <button className="login-primary" type="submit">Unlock app</button>
          </form>
          <button type="button" className="login-link-button" onClick={signOut}>Use a different account</button>
        </section>
      </main>
    );
  }

  if (mode === "loading" || mode === "checking") {
    return (
      <main className="login-shell">
        <section className="login-card login-loading-card">
          <span className="login-app-mark" aria-hidden="true">FC</span>
          <span className="login-spinner" />
          <h1>{mode === "checking" ? "Verifying department access" : "Loading secure sign-in"}</h1>
          <p>{message || "Checking your account securely..."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand">
          <span className="login-app-mark" aria-hidden="true">FC</span>
          <span><b>Firehouse Manager</b><small>Department Operations Portal</small></span>
        </div>
        <div>
          <p className="login-eyebrow">SECURE DEPARTMENT ACCESS</p>
          <h1>One verified account.<br />Your authorized department.</h1>
          <p>Payroll, staffing, daily logs, policies, box cards, apparatus, scheduling, and field operations stay protected behind your confirmed email and department membership.</p>
        </div>
        <small>Department records are separated from unapproved accounts.</small>
      </section>
      <section className="login-card">
        <p className="login-eyebrow">WELCOME BACK</p>
        <h2>Sign in with email and PIN</h2>
        <p>Your Stickney email is your username. After the one-time email confirmation, use your private PIN for every sign-in.</p>
        <form onSubmit={signIn}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Private PIN<input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
          {message ? <p className="login-message" role="status">{message}</p> : null}
          <button className="login-primary" type="submit">Sign in</button>
        </form>
        <button type="button" className="login-link-button" onClick={() => void emailSignInLink()}>First activation or older PIN account? Email one-time upgrade link</button>
        <div className="login-divider"><span>Need an account?</span></div>
        <p className="login-invite-note">A department administrator must add your employee email and send your app invitation.</p>
      </section>
    </main>
  );
}
