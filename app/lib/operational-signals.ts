import 'server-only';
import { locationDatabase } from './apparatus-location-store';
import type { OperationalSignal, OperationalScope } from '../operational-signals';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

// Proxy has already verified identity, membership, PIN and the live-view gate.
// Reuse the permissions computed by this request; do not duplicate those queries.
export async function readOperationalSignal(request: Request, permissions: string[]): Promise<OperationalSignal | null> {
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
    // Incoming email recovery runs independently of authenticated screens.
    return row?.signal ?? null;
  } catch {
    // An unapplied migration or failed live service must never slow detection or
    // revoke otherwise valid permissions. The client retains ordinary polling.
    return null;
  }
}
