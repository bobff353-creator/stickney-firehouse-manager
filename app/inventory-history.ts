import type { InventoryRow } from './inventory-index';

export const HISTORY_PAGE_SIZE = 25;
export type HistoryReport = InventoryRow & { id: string; started_at: string; apparatus_id: string; check_type: string };
export type HistoryPage = { reports: HistoryReport[]; nextCursor: string | null };
export type CheckReport = { check: HistoryReport; items: InventoryRow[] };
export type LiveCheckPacket = {
  checks: HistoryReport[];
  checkItems: (InventoryRow & { equipment_id: string })[];
  scbaEntries: InventoryRow[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function reportId(input: string) {
  if (!uuid.test(input)) throw Error('Choose a valid saved report.');
  return input;
}
function date(input: string | null) {
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input) throw Error('Choose a valid date.');
  return input;
}
export function historyParameters(params: URLSearchParams) {
  const allowed = (name: string, values: string[]) => {
    const input = params.get(name);
    if (!input) return null;
    if (!values.includes(input)) throw Error('Choose a valid report filter.');
    return input;
  };
  const from = date(params.get('from')), to = date(params.get('to'));
  if (from && to && from > to) throw Error('The end date must be on or after the start date.');
  const cursor = params.get('cursor');
  let beforeTime = null, beforeId = null;
  if (cursor) {
    if (cursor.length > 150) throw Error('The report page is invalid. Return to the first page.');
    const parts = cursor.split('|');
    if (parts.length !== 2 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(parts[0]) || !Number.isFinite(Date.parse(parts[0]))) throw Error('The report page is invalid. Return to the first page.');
    beforeTime = parts[0]; beforeId = reportId(parts[1]);
  }
  return {
    p_apparatus: params.get('apparatus') ? reportId(params.get('apparatus')!) : null,
    p_type: allowed('type', ['daily', 'weekly', 'inventory', 'air_pack']),
    p_review: allowed('review', ['pending', 'approved', 'changes_requested']),
    p_from: from, p_to: to, p_before_time: beforeTime, p_before_id: beforeId,
  };
}
export function historyPage(rows: HistoryReport[]): HistoryPage {
  const reports = rows.slice(0, HISTORY_PAGE_SIZE), last = reports.at(-1);
  return { reports, nextCursor: rows.length > HISTORY_PAGE_SIZE && last ? `${last.started_at}|${last.id}` : null };
}
