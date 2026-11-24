import { scheduleMonthRange } from './schedule-setup-model.ts';
import { validQueueDate } from './task-queue-model.ts';

export type SavedAvailabilityFilters = { period: 'month' | 'upcoming' | 'all' | 'custom'; status: 'all' | 'available' | 'unavailable'; query: string; from: string; through: string };
export const savedAvailabilityPageSize = 10;
type Row = { id: string; availabilityDate: string; status: string; note: string };

/** Filters only the supplied member's loaded rows. Never changes saved availability. */
export function savedAvailabilityPage<T extends Row>(entries: T[], filters: SavedAvailabilityFilters, month: string, today: string, requestedPage: number) {
  let from = '', through = '', error = '';
  if (filters.period === 'month') {
    const range = scheduleMonthRange(month);
    if (range) { from = range.from; through = range.through; }
    else error = 'Choose a valid calendar month.';
  } else if (filters.period === 'upcoming') from = today;
  else if (filters.period === 'custom') {
    from = filters.from; through = filters.through;
    if (!validQueueDate(from) || !validQueueDate(through)) error = 'Choose both dates for this range.';
    else if (through < from) error = 'Through date must be on or after From date.';
  }
  const query = filters.query.trim().toLowerCase();
  const matching = error ? [] : entries.filter(row => (!from || row.availabilityDate >= from) && (!through || row.availabilityDate <= through)
    && (filters.status === 'all' || row.status === filters.status)
    && (!query || `${row.availabilityDate} ${row.note}`.toLowerCase().includes(query)))
    .sort((a, b) => a.availabilityDate.localeCompare(b.availabilityDate) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(matching.length / savedAvailabilityPageSize));
  const page = Math.min(pages, Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1));
  const offset = (page - 1) * savedAvailabilityPageSize;
  return { rows: matching.slice(offset, offset + savedAvailabilityPageSize), total: entries.length, matching: matching.length, page, pages,
    first: matching.length ? offset + 1 : 0, last: Math.min(offset + savedAvailabilityPageSize, matching.length), error };
}
