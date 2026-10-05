import { createInventorySupabaseClient } from '../../../lib/supabase-server';
import { sessionFailureResponse, verifyInventoryRequest } from '../../../lib/inventory-session';
import { operationsReadiness } from '../../../operations-readiness';
import { privatePacketResponse } from '../../../lib/private-packet-response';

type Row = Record<string, unknown>;
async function pages(query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>) {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await query(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...result.data || []);
    if ((result.data?.length || 0) < 1000) return rows;
  }
}
export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!session.context.grants.some(grant => ['inventory.view', 'operations_board.view'].includes(grant))) return Response.json({ error: 'Operations access is required.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const db = await createInventorySupabaseClient();
    const department = session.context.department.id;
    // No names, assignees, repair costs, narratives or photos in the TV packet.
    const [equipment, workOrders, checks, items, lots, exceptions] = await Promise.all([
      pages((from, to) => db.from('inventory_equipment').select('id,service_status,retired_at,expiration_date,hydro_due_date,scba_asset_kind,last_serviced_date,service_interval_months,service_reminder_months').eq('department_id', department).is('retired_at', null).order('id').range(from, to)),
      pages((from, to) => db.from('inventory_work_orders').select('id,equipment_id,status,priority').eq('department_id', department).not('status', 'in', '(closed,completed,cancelled)').order('id').range(from, to)),
      pages((from, to) => db.from('inventory_checks').select('id,status').eq('department_id', department).eq('status', 'in_progress').order('id').range(from, to)),
      pages((from, to) => db.from('inventory_stock_items').select('id,reorder_point,expiration_tracked').eq('department_id', department).order('id').range(from, to)),
      pages((from, to) => db.from('inventory_stock_lots').select('id,stock_item_id,quantity_on_hand,expires_at').eq('department_id', department).order('id').range(from, to)),
      pages((from, to) => db.from('inventory_readiness_exceptions').select('id,equipment_id,status').eq('department_id', department).neq('status', 'resolved').order('id').range(from, to)),
    ]);
    const byItem = new Map<string, Row[]>();
    for (const lot of lots) {
      const id = String(lot.stock_item_id);
      const group = byItem.get(id) || []; group.push(lot); byItem.set(id, group);
    }
    const stock = items.flatMap<Row>(item => {
      const group = byItem.get(String(item.id)) || [];
      return group.length ? group.map(lot => ({ ...item, lot_id: lot.id, quantity_on_hand: lot.quantity_on_hand, expires_at: lot.expires_at })) : [{ ...item, quantity_on_hand: 0 }];
    });
    const summary = operationsReadiness({ equipment, workOrders, checks, stock, exceptions });
    return privatePacketResponse(request, summary, { fingerprint: { ...summary, asOf: null } });
  } catch {
    return Response.json({ error: 'Operations readiness could not be verified.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
