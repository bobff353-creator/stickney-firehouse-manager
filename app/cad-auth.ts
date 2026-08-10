// Shared request auth for the CAD dispatch API.
//
// Two audiences hit these routes:
//   • People (dispatchers/officers) in the portal — identified by the
//     `oai-authenticated-user-email` header, same as the rest of the app.
//   • Machines (FD vehicles, partner CAD systems, alarm panels) — identified by
//     a per-agency / per-panel token verified against the raw request body.

import type { ensureDatabase } from "../db/bootstrap";
import { verifyInboundSignature } from "./cad-dispatch-service";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;

const ownerAdminEmails = ["bobff353@gmail.com"];

export type Viewer = { email: string; isAdmin: boolean; displayName: string };

export async function resolveViewer(request: Request, db: Database): Promise<Viewer> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!email) return { email: "", isAdmin: false, displayName: "" };
  if (ownerAdminEmails.includes(email)) return { email, isAdmin: true, displayName: email };
  const profile = await db
    .prepare("SELECT e.name AS name, p.is_admin AS isAdmin FROM employee_profiles p JOIN employees e ON e.id = p.employee_id WHERE lower(p.email) = ? LIMIT 1")
    .bind(email)
    .first<{ name: string; isAdmin: number }>();
  return { email, isAdmin: Boolean(profile?.isAdmin), displayName: profile?.name || email };
}

/** Verify a machine caller against a stored token using the shared body signature scheme. */
export async function verifyMachine(request: Request, body: string, token: string): Promise<boolean> {
  return verifyInboundSignature(
    {
      authorization: request.headers.get("authorization") ?? "",
      signature: request.headers.get("x-cad-signature") ?? "",
    },
    body,
    token,
  );
}
