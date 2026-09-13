import { ensureDatabase } from '../../../db/bootstrap';
import { hasAnyPermission, hasPermission } from '../../server-permissions';
import { isBoardLinkSection, validateBoardLinkSection } from '../../board-links';
import { BoardLinksConflict, BoardLinksLimit, readBoardLinks, saveBoardLinks } from '../../board-links-store';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasAnyPermission(request, db, ['operations_board.view', 'settings.manage'])) return Response.json({ error: 'Live Operations access is required.' }, { status: 403, headers });
    const checkedAt = new Date().toISOString();
    return Response.json({ settings: await readBoardLinks(db), canEdit: await hasPermission(request, db, 'settings.manage'), confirmed: true, checkedAt }, { headers });
  } catch { return Response.json({ error: 'Saved board links are unavailable. Please retry.' }, { status: 503, headers }); }
}
export async function PUT(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, 'settings.manage')) return Response.json({ error: 'Manage settings permission is required to edit board links.' }, { status: 403, headers });
    const raw = await request.text();
    if (raw.length > 40000) return Response.json({ error: 'This section has too much content.' }, { status: 413, headers });
    let body: { id: string; revision: string; section: unknown };
    let section;
    try {
      body = JSON.parse(raw);
      if (!body || !isBoardLinkSection(body.id) || typeof body.revision !== 'string' || body.revision.length > 80) throw new Error('Choose a valid board section.');
      section = validateBoardLinkSection(body.section);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Check the section fields.' }, { status: 400, headers }); }
    const settings = await saveBoardLinks(db, body.id as Parameters<typeof saveBoardLinks>[1], section, body.revision, request.headers.get('oai-authenticated-user-email') ?? '');
    return Response.json({ settings, canEdit: true, confirmed: true, checkedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof BoardLinksConflict || error instanceof BoardLinksLimit ? error.message : 'The save could not be confirmed. Your draft is still here. Reload saved links to check before retrying.' }, { status: error instanceof BoardLinksConflict ? 409 : error instanceof BoardLinksLimit ? 400 : 503, headers });
  }
}
