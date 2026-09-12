import 'server-only';
const usfaBase = 'https://apps.usfa.fema.gov/firefighter-fatalities';
type UsfaFatality = { id: number; firstName: string; lastName: string; fdName: string; fdCity: string; stateAbbr: string; deathDt: string };
export async function loadUsfa() {
  const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(new Date()));
  const options = { headers: { 'user-agent': 'Stickney Fire Department Operations Portal/2.0' }, signal: AbortSignal.timeout(8000), cache: 'no-store' } satisfies RequestInit;
  const [latestResponse, countResponse] = await Promise.all([
    fetch(`${usfaBase}/api/fatalityDatums/latest`, options),
    fetch(`${usfaBase}/api/fatalityDatums/page/1/search?deathDtRange=${year}`, options),
  ]);
  if (!latestResponse.ok || !countResponse.ok) throw new Error('USFA source unavailable');
  const latest = await latestResponse.json() as UsfaFatality[];
  const count = await countResponse.json() as { total?: number };
  if (!Array.isArray(latest) || typeof count.total !== 'number' || count.total < 0) throw new Error('USFA data incomplete');
  const items = latest.filter(item => item.deathDt?.startsWith(String(year)))
    .sort((a, b) => b.deathDt.localeCompare(a.deathDt)).slice(0, 5)
    .map(item => ({ id: item.id, name: `${item.firstName} ${item.lastName}`.trim(), department: item.fdName, location: `${item.fdCity}, ${item.stateAbbr}`, deathDate: item.deathDt, url: `${usfaBase}/details?id=${item.id}` }));
  if (count.total > 0 && !items.length) throw new Error('USFA latest records missing');
  return { year, total: count.total, items, source: 'U.S. Fire Administration' };
}
