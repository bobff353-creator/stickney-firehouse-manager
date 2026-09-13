import { ensureDatabase } from '../../../db/bootstrap';
import { hasPermission } from '../../server-permissions';
import { isTrainingSource, officialTrainingSource } from '../../lib/training-sources';
import { loadTrainingProvider } from '../../lib/external-feeds';
import { previewTraining, publishTraining, TrainingImportError } from '../../lib/training-import-store';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'settings.manage')) return Response.json({ error: 'Manage settings permission is required.' }, { status: 403, headers });
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: 'Request is too large.' }, { status: 413, headers });
    let body;
    try {
      body = JSON.parse(raw);
      if (!body || !isTrainingSource(body.id) || !['preview', 'publish'].includes(body.action)) throw Error('Choose a supported training provider.');
      officialTrainingSource(body.id, body.sourceUrl);
      if (body.action === 'publish' && (typeof body.previewId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.previewId))) throw Error('Test the source before saving.');
    } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400, headers }); }
    if (body.action === 'preview') {
      const preview = await previewTraining(db, body.id, () => loadTrainingProvider(body.id));
      return Response.json({ previewId: preview.id, expiresAt: preview.expiresAt, data: preview.data }, { headers });
    }
    const settings = await publishTraining(db, body.id, body.previewId, request.headers.get('oai-authenticated-user-email') ?? '');
    return Response.json({ settings, canEdit: true, confirmed: true, checkedAt: new Date().toISOString() }, { headers });
  } catch (error) { return Response.json({ error: error instanceof TrainingImportError ? error.message : 'Training import is unavailable. Saved classes have not changed.' }, { status: error instanceof TrainingImportError ? error.status : 503, headers }); }
}
