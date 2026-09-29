import { ensureDatabase } from '../../../db/bootstrap';
import { hasPermission } from '../../server-permissions';
import { backgroundDatabase } from '../../background-database';
import { sameOriginAuthRequest } from '../../request-security';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'employees.manage')) return json({ error: 'Employee management access is required.' }, 403);
    const row = await backgroundDatabase().prepare('SELECT employee_account_setup() AS setup').first<{ setup: unknown }>();
    return json(row?.setup);
  } catch { return json({ error: 'Account setup status is unavailable. No activation or link is being assumed.' }, 503); }
}
export async function POST(request: Request) {
  if (!sameOriginAuthRequest(request)) return json({ error: 'Open account setup from this portal.' }, 403);
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'permissions.manage')) return json({ error: 'Manage permissions access is required to link accounts.' }, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId) || typeof body.employeeId !== 'string' || !body.employeeId || body.employeeId.length > 100) return json({ error: 'Select an account and employee.' }, 400);
    await backgroundDatabase().prepare('SELECT link_employee_account(?,?,?) AS linked').bind(body.userId, body.employeeId, request.headers.get('oai-authenticated-user-email') || '').first();
    return json({ linked: true });
  } catch { return json({ error: 'The link was not saved. Select a current employee and a verified department account that is not linked elsewhere.' }, 409); }
}
