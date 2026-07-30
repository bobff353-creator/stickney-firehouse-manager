"use client";

import type { User } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useState } from "react";
import PayrollApp from "./payroll-app";
import { getSupabaseBrowserClient } from "./supabase-browser";

type Mode = "loading" | "sign-in" | "sign-up" | "checking" | "authorized" | "waiting";

export default function AuthGateway() {
  const [mode, setMode] = useState<Mode>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => {
      if (data.user) void checkAccess(data.user);
      else setMode("sign-in");
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void checkAccess(session.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function checkAccess(nextUser: User) {
    setUser(nextUser);
    setMode("checking");
    const response = await fetch("/api/auth/context", { cache: "no-store" });
    if (response.ok) {
      setMode("authorized");
      setMessage("");
      return;
    }
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 403) {
      setMode("waiting");
      setMessage(payload.error || "Your email is confirmed. A department administrator must approve access.");
      return;
    }
    await getSupabaseBrowserClient().auth.signOut();
    setUser(null);
    setMode("sign-in");
    setMessage(payload.error || "Your session expired. Please sign in again.");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("checking");
    setMessage("Signing in...");
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      setMode("sign-in");
      setMessage(error?.message || "Sign-in could not be completed.");
      return;
    }
    await checkAccess(data.user);
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The two passwords do not match.");
      return;
    }
    setMode("checking");
    setMessage("Creating your account...");
    const callback = new URL("/auth/confirm", window.location.origin);
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) {
      setMode("sign-up");
      setMessage(error.message);
      return;
    }
    if (data.session && data.user) {
      await checkAccess(data.user);
      return;
    }
    setMode("sign-in");
    setPassword("");
    setConfirmPassword("");
    setMessage("Confirmation email sent. Open it to verify your address, then return here to sign in.");
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }
    const callback = new URL("/auth/confirm", window.location.origin);
    callback.searchParams.set("next", "/reset-password");
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callback.toString(),
    });
    setMessage(error ? error.message : "If that account exists, a password reset email was sent.");
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    setUser(null);
    setMode("sign-in");
    setMessage("Signed out.");
  }

  if (mode === "authorized") {
    return (
      <PayrollApp
        accountEmail={user?.email || ""}
        onSignOut={signOut}
      />
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

  const creating = mode === "sign-up";
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
        <p className="login-eyebrow">{creating ? "CREATE ACCOUNT" : "WELCOME BACK"}</p>
        <h2>{creating ? "Set up your verified login" : "Sign in to the portal"}</h2>
        <p>{creating ? "We will email you a confirmation link before the account can be used." : "Use the email and password connected to your department account."}</p>
        <form onSubmit={creating ? signUp : signIn}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password
            <span className="login-password-field">
              <input type={showPassword ? "text" : "password"} autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={creating ? 8 : undefined} required />
              <button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
          {creating ? <label>Confirm password<input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label> : null}
          {message ? <p className="login-message" role="status">{message}</p> : null}
          <button className="login-primary" type="submit">{creating ? "Create account and email confirmation" : "Sign in"}</button>
        </form>
        {!creating ? <button type="button" className="login-link-button" onClick={resetPassword}>Forgot password?</button> : null}
        <div className="login-divider"><span>{creating ? "Already have an account?" : "Need an account?"}</span></div>
        <button type="button" className="login-secondary" onClick={() => { setMode(creating ? "sign-in" : "sign-up"); setMessage(""); }}>
          {creating ? "Return to sign in" : "Create a verified account"}
        </button>
      </section>
    </main>
  );
}
