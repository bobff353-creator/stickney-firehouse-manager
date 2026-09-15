import 'server-only';
import { after } from 'next/server';
import { locationDatabase } from './apparatus-location-store';
import { syncRecentResendDispatches } from '../resend-dispatch-sync';
import type { OperationalSignal, OperationalScope } from '../operational-signals';
import type { ensureDatabase } from '../../db/bootstrap';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

// Proxy has already verified identity, membership, PIN and the live-view gate.
// Reuse the permissions computed by this request; do not duplicate those queries.
export async function readOperationalSignal(request: Request, permissions: string[], sourceDb: Awaited<ReturnType<typeof ensureDatabase>>): Promise<OperationalSignal | null> {
  const requested = new Set(new URL(request.url).searchParams.get('live')?.split(',') ?? []);
  const scopes: OperationalScope[] = [];
  if (requested.has('respond') && permissions.includes('field_preplans.view')) scopes.push('respond');
  if (requested.has('board') && permissions.includes('operations_board.view')) scopes.push('board');
  if (!scopes.length) return null;
  const department = request.headers.get('x-department-id') ?? '', user = request.headers.get('x-authenticated-user-id') ?? '';
  if (!uuid.test(department) || !uuid.test(user) || department !== process.env.PAYROLL_DEPARTMENT_ID?.trim()) return null;
  try {
    const db = locationDatabase();
    const row = await db.prepare('SELECT issue_operational_view_lease(?::uuid,?::uuid,?::text[]) signal')
      .bind(department, user, `{${scopes.join(',')}}`).first<{ signal: OperationalSignal }>();
    // The old board read also recovered missed inbound email webhooks. Keep that
    // 30-second recovery opportunity, shared across TVs, off the permission path.
    if (scopes.includes('board')) after(async () => {
      try {
        const claim = await db.prepare('SELECT claim_operational_cad_recovery(?::uuid) claimed').bind(department).first<{ claimed: boolean }>();
        if (claim?.claimed) await syncRecentResendDispatches(sourceDb);
      } catch { console.error('Operational CAD recovery will retry on the next security check.'); }
    });
    return row?.signal ?? null;
  } catch {
    // An unapplied migration or failed live service must never slow detection or
    // revoke otherwise valid permissions. The client retains ordinary polling.
    return null;
  }
}
