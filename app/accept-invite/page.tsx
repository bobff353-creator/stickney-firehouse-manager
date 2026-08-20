"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../supabase-browser";

type Step = "checking" | "pin" | "error";

export default function AcceptInvitePage() {
  const [step, setStep] = useState<Step>("checking");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [temporaryPin, setTemporaryPin] = useState("");
  const [message, setMessage] = useState("Confirming your department invitation...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const client = getSupabaseBrowserClient();
      const { data: userData } = await client.auth.getUser();
      if (!active) return;
      if (!userData.user?.email) {
        setStep("error");
        setMessage("This invitation link is no longer signed in. Ask an administrator to resend the invite.");
        return;
      }
      setEmail(userData.user.email);
      const { error: acceptError } = await client.rpc("accept_department_invite");
      const context = await fetch("/api/auth/context", { cache: "no-store" });
      if (!active) return;
      if (!context.ok) {
        const payload = await context.json().catch(() => ({})) as { error?: string };
        setStep("error");
        setMessage(payload.error || acceptError?.message || "The department invitation could not be accepted.");
        return;
      }
      setStep("pin");
      setMessage("");
    })();
    return () => { active = false; };
  }, []);

  async function savePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Choose a PIN containing 4 to 6 digits.");
      return;
    }
    if (pin !== confirmation) {
      setMessage("The two PIN entries do not match.");
      return;
    }
    if (!/^\d{4,6}$/.test(temporaryPin)) {
      setMessage("Enter your 4 to 6 digit employee number as the temporary PIN.");
      return;
    }
    setSaving(true);
    setMessage("Saving your secure device PIN...");
    const response = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", temporaryPin, pin }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setSaving(false);
      setMessage(payload.error || "The PIN could not be saved.");
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card login-reset-card">
        <span className="login-app-mark" aria-hidden="true">SFD</span>
        <p className="login-eyebrow">STICKNEY FIRE DEPARTMENT</p>
        {step === "checking" ? <>
          <span className="login-spinner" />
          <h1>Joining the operations portal</h1>
          <p>{message}</p>
        </> : step === "error" ? <>
          <h1>Invitation needs attention</h1>
          <p className="login-message" role="alert">{message}</p>
          <Link className="login-text-link" href="/">Return to secure sign-in</Link>
        </> : <>
          <h1>Activate your portal login</h1>
          <p>Your Stickney email is your username. Enter your employee number once, then replace it with a private 4 to 6 digit PIN.</p>
          <dl className="invite-account-summary"><div><dt>Confirmed account</dt><dd>{email}</dd></div><div><dt>Department</dt><dd>Stickney Fire Department</dd></div></dl>
          <form onSubmit={savePin}>
            <label>Temporary PIN (your employee number)<input autoFocus type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={temporaryPin} onChange={(event) => setTemporaryPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            <label>New private PIN<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            <label>Confirm PIN<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
            {message ? <p className="login-message" role="status">{message}</p> : null}
            <button className="login-primary" type="submit" disabled={saving}>{saving ? "Activating login..." : "Create private PIN and open app"}</button>
          </form>
          <small className="pin-security-note">Your employee number works only for activation and is never stored as your portal PIN. Five incorrect PIN attempts lock entry for 15 minutes.</small>
        </>}
      </section>
    </main>
  );
}
