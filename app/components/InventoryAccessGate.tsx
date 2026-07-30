import Link from "next/link";

export function InventoryAccessGate({
  unavailable,
  message,
}: {
  unavailable: boolean;
  message: string;
}) {
  return (
    <main className="suite-access-page">
      <section className="suite-access-card">
        <span className="suite-access-mark">INV</span>
        <p>Stickney Fire Department</p>
        <h1>{unavailable ? "Secure access is unavailable" : "Command Center sign-in required"}</h1>
        <p>{message}</p>
        <Link href="/">
          {unavailable ? "Return to the department portal" : "Sign in and open Inventory"}
        </Link>
      </section>
    </main>
  );
}
