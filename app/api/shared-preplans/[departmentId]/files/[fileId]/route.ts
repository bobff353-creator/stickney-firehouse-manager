import { ensureDatabase } from '../../../../../../db/bootstrap';
import { permissionsForEmail } from '../../../../../server-permissions';
import { getSupabaseServerClient } from '../../../../../supabase-server';

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string; fileId: string }> }) {
  const viewer = request.headers.get('x-department-id');
  const source = await params;
  const kind = new URL(request.url).searchParams.get('kind');
  if (!viewer || !/^[a-f0-9-]{36}$/i.test(source.departmentId) || !source.fileId || source.fileId.length > 100 || !['photo','asset'].includes(kind ?? '')) return Response.json({ error: 'File not found.' }, { status: 404 });
  try {
    const permissions = await permissionsForEmail(request.headers.get('oai-authenticated-user-email') ?? '', await ensureDatabase());
    if (!permissions.has('field_preplans.view')) return Response.json({ error: 'Viewing access is required.' }, { status: 403 });
    const client = await getSupabaseServerClient();
    const { data: file, error } = await client.rpc('department_shared_preplan_file', { p_viewer: viewer, p_source: source.departmentId, p_file: source.fileId, p_kind: kind });
    if (error || !file) return Response.json({ error: 'Published preplan file not found.' }, { status: 404 });
    const { data, error: storageError } = await client.storage.from('firehouse-portal').download(file.objectKey);
    if (storageError || !data) return Response.json({ error: 'File is unavailable.' }, { status: 404 });
    const inline = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(file.mimeType);
    return new Response(data.stream(), { headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${String(file.filename ?? 'preplan-file').replace(/["\r\n]/g,'_')}"`,
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return Response.json({ error: 'Shared file could not be loaded.' }, { status: 503 }); }
}
