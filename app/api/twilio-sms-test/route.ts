import { ensureDatabase } from '../../../db/bootstrap';
import { getPortalDepartment } from '../../department-portal';
import { hasPermission } from '../../server-permissions';
import { smsTestConfig, smsTestDepartment, smsTestRecipientLabel, smsTestRunId, readSmsTest, refreshSmsTest, sendSmsTest } from '../../twilio-sms-test';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function access(request: Request) {
  const actor = request.headers.get('oai-authenticated-user-email')?.toLowerCase() ?? '';
  if (!['bobff353@gmail.com','bwyant@stickneyfire.com'].includes(actor)) return null;
  const department = await getPortalDepartment();
  if (department.id !== smsTestDepartment || request.headers.get('x-department-id') !== department.id) return null;
  const db = await ensureDatabase();
  return await hasPermission(request,db,'settings.manage') ? {db,actor} : null;
}
export async function GET(request: Request) {
  try {
    const authorized = await access(request); if (!authorized) return json({error:'This test is restricted to Bob in Stickney administration.'},403);
    const config = smsTestConfig(), id = smsTestRunId();
    const receipt = config ? await refreshSmsTest(authorized.db,config) : id ? await readSmsTest(authorized.db,id) : null;
    return json({enabled:Boolean(config),recipient:smsTestRecipientLabel,receipt});
  } catch {return json({error:'SMS test status is unavailable.'},503);}
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site' ||
    !request.headers.get('content-type')?.startsWith('application/json')) return json({error:'Open this test inside Firehouse Manager.'},403);
  try {
    const reader = request.body?.getReader(); if (!reader) return json({error:'Confirm the manual test first.'},400);
    let size = 0, body = '';
    try {while (true) {const part = await reader.read();if (part.done) break;size += part.value.byteLength;
      if (size > 256) {await reader.cancel();return json({error:'Only the fixed manual test is allowed.'},400);} body += new TextDecoder().decode(part.value);}}
    finally {reader.releaseLock();}
    let input;try {input = JSON.parse(body);} catch {return json({error:'Invalid manual test confirmation.'},400);}
    if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || input.confirmed !== true) return json({error:'Only the fixed manual test is allowed.'},400);
    const authorized = await access(request);if (!authorized) return json({error:'This test is restricted to Bob in Stickney administration.'},403);
    const config = smsTestConfig();if (!config) return json({error:'Manual SMS testing is off or expired. No text was sent.'},503);
    return json(await sendSmsTest(authorized.db,authorized.actor,config));
  } catch {return json({error:'The attempt could not be confirmed. Refresh its saved status; it will not resend automatically.'},503);}
}
