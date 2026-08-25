"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export function InventoryAccessGate({
  unavailable,
  message,
  status,
}: {
  unavailable: boolean;
  message: string;
  status: number;
}) {
  const [pin, setPin] = useState("");
  const [unlockMessage, setUnlockMessage] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const needsPin = status === 423 && !unavailable;

  async function unlockInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setUnlockMessage("Enter your 4 to 6 digit portal PIN.");
      return;
    }
    setUnlocking(true);
    setUnlockMessage("Unlocking Inventory…");
    try {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", pin }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setUnlockMessage(payload.error || "Inventory could not be unlocked.");
        return;
      }
      setPin("");
      window.location.reload();
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <main className="suite-access-page">
      <section className="suite-access-card">
        <span className="suite-access-mark">INV</span>
        <p>Stickney Fire Department</p>
        <h1>{unavailable ? "Secure access is unavailable" : needsPin ? "Unlock Inventory" : "Command Center sign-in required"}</h1>
        <p>{message}</p>
        {needsPin ? (
          <form className="suite-access-pin-form" onSubmit={unlockInventory}>
            <label>
              Portal PIN
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]{4,6}"
                minLength={4}
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </label>
            {unlockMessage ? <p role="status">{unlockMessage}</p> : null}
            <button type="submit" disabled={unlocking}>{unlocking ? "Unlocking…" : "Unlock and reopen Inventory"}</button>
          </form>
        ) : null}
        <Link className={needsPin ? "suite-access-secondary" : undefined} href="/?display=portal">
          {unavailable || needsPin ? "Return to the department portal" : "Sign in and open Inventory"}
        </Link>
      </section>
    </main>
  );
}
