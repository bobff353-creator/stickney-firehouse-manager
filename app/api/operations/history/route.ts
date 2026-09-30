import { createInventorySupabaseClient } from '../../../lib/supabase-server';
import { verifyInventoryRequest, sessionFailureResponse } from '../../../lib/inventory-session';
import { historyParameters, historyPage, reportId, type HistoryReport } from '../../../inventory-history';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  const params = new URL(request.url).searchParams;
  let args;
  try { args = params.has('check') ? { p_check: reportId(params.get('check') || '') } : historyParameters(params); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid report filters.' }, 400); }
  try {
    const db = await createInventorySupabaseClient();
    const detail = 'p_check' in args;
    const asset = params.get('asset');
    let assetId;
    try { assetId = asset ? reportId(asset) : null; } catch { return json({ error: 'Choose a valid saved air asset.' }, 400); }
    const rpcArgs = assetId && !detail ? { p_equipment: assetId, p_before_time: args.p_before_time, p_before_id: args.p_before_id } : args;
    const result = await db.rpc(detail ? 'inventory_check_report' : assetId ? 'inventory_air_check_history' : 'inventory_check_history_page', { ...rpcArgs, p_department: session.context.department.id });
    if (result.error) throw result.error;
    if (detail) return result.data ? json(result.data) : json({ error: 'This completed report is unavailable in your department.' }, 404);
    return json(historyPage((result.data || []) as HistoryReport[]));
  } catch { return json({ error: 'Inspection history is temporarily unavailable. Try again.' }, 503); }
}
