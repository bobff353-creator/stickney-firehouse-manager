import { ensureDatabase } from '../../../db/bootstrap';
import { hasPermission } from '../../server-permissions';
import { validateBoardConfiguration } from '../../board-configuration';
import { BoardConfigurationConflict, readBoardConfiguration, saveBoardConfiguration } from '../../board-configuration-store';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'settings.manage')) return Response.json({ error: 'Administrator access is required.' }, { status: 403, headers });
    return Response.json({ saved: await readBoardConfiguration(db) }, { headers });
  } catch { return Response.json({ error: 'Saved settings could not be loaded. Retry before editing.' }, { status: 503, headers }); }
}
export async function PUT(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'settings.manage')) return Response.json({ error: 'Administrator access is required.' }, { status: 403, headers });
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 8000) throw Error('Board settings are too long.');
      body = JSON.parse(raw);
      if (!body || typeof body.revision !== 'string' || body.revision.length > 80) throw Error('Reload saved settings before publishing.');
      body.configuration = validateBoardConfiguration(body.configuration);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Invalid board settings.' }, { status: 400, headers }); }
    return Response.json({ saved: await saveBoardConfiguration(db, body.configuration, body.revision, request.headers.get('oai-authenticated-user-email') ?? '') }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof BoardConfigurationConflict ? error.message : 'Publishing could not be confirmed. Your draft is kept. Retry or reload saved settings.' }, { status: error instanceof BoardConfigurationConflict ? 409 : 503, headers });
  }
}
