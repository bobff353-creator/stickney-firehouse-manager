import { ensureDatabase } from '../../../db/bootstrap';
import { permissionsForEmail } from '../../server-permissions';
import { getSupabaseServerClient } from '../../supabase-server';

export async function GET(request: Request) {
  const department = request.headers.get('x-department-id');
  if (!department) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  try {
    const permissions = await permissionsForEmail(request.headers.get('oai-authenticated-user-email') ?? '', await ensureDatabase());
    if (!permissions.has('field_preplans.view')) return Response.json({ error: 'Preplan viewing access is required.' }, { status: 403 });
    const client = await getSupabaseServerClient();
    const { data, error } = await client.rpc('department_shared_preplans', { p_viewer: department });
    if (error) throw error;
    return Response.json({ departments: data, canEdit: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Shared hydrants and preplans could not be loaded. Try again.' }, { status: 503 });
  }
}
