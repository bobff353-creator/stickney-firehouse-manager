import { ensureDatabase } from '../../../db/bootstrap';
import { getPortalDepartment } from '../../department-portal';
import { hasPermission } from '../../server-permissions';
import { outlookTestConfig, outlookTestDepartment, outlookTestRecipient, readOutlookTest, sendOutlookTest } from '../../outlook-email-test';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function access(request: Request) {
  const actor = request.headers.get('oai-authenticated-user-email')?.toLowerCase() ?? '';
  if (!['bobff353@gmail.com', outlookTestRecipient].includes(actor)) return null;
  const department = await getPortalDepartment();
  if (department.id !== outlookTestDepartment || request.headers.get('x-department-id') !== department.id) return null;
  const db = await ensureDatabase();
  return await hasPermission(request, db, 'settings.manage') ? { db, actor } : null;
}
export async function GET(request: Request) {
  try {
    const authorized = await access(request);
    if (!authorized) return json({ error: 'This test is restricted to Bob in Stickney administration.' }, 403);
    const config = outlookTestConfig();
    return json({ enabled: Boolean(config), recipient: outlookTestRecipient,
      receipt: config ? await readOutlookTest(authorized.db, config.requestId) : null });
  } catch { return json({ error: 'The email test status could not be checked.' }, 503); }
}
export async function POST(request: Request) {
  // A cross-site form or background polling request cannot initiate a test.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site' ||
    !request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Open this test inside Firehouse Manager.' }, 403);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Confirm the manual test first.' }, 400);
    let body = ''; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 256) { await reader.cancel(); return json({ error: 'Only the fixed manual test is allowed.' }, 400); }
        body += new TextDecoder().decode(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const input = JSON.parse(body);
    if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || input.confirmed !== true) return json({ error: 'Only the fixed manual test is allowed.' }, 400);
    const authorized = await access(request);
    if (!authorized) return json({ error: 'This test is restricted to Bob in Stickney administration.' }, 403);
    const config = outlookTestConfig();
    if (!config) return json({ error: 'Manual Outlook testing is off. No email was sent.' }, 503);
    return json(await sendOutlookTest(authorized.db, authorized.actor, config));
  } catch { return json({ error: 'The test could not be confirmed. Refresh its status before taking any other action; it will not resend automatically.' }, 503); }
}
