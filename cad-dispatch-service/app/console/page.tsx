import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionToken, SESSION_COOKIE } from "../../lib/auth";
import { ensureDatabase } from "../../lib/bootstrap";
import ConsoleShell from "./console-shell";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  await ensureDatabase();
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return <ConsoleShell name={session.name} email={session.email} role={session.role} />;
}
