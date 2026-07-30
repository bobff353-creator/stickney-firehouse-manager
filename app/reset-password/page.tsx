"use client";

import Link from "next/link";
import Image from "next/image";
import { type FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../supabase-browser";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The two passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card login-reset-card">
        <Image src="/stickney-fd-patch.jpg?v=2" width={72} height={72} alt="Stickney Fire Department" />
        <p className="login-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password</h1>
        <p>Use at least 8 characters. This password will protect every portal area your department authorizes.</p>
        <form onSubmit={save}>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
          {message ? <p className="login-message" role="status">{message}</p> : null}
          <button className="login-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save new password"}</button>
        </form>
        <Link className="login-text-link" href="/">Return to sign in</Link>
      </section>
    </main>
  );
}
