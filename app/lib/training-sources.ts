export const trainingSources = {
  romeoville: { id: 'romeoville', name: 'Romeoville Fire Academy', shortName: 'Romeoville', sourceUrl: 'https://www.romeoville.org/FormCenter/Fire-Academy-13/Fire-Classes-Online-Registration-Fire-Ac-370' },
  ifsi: { id: 'ifsi', name: 'Illinois Fire Service Institute', shortName: 'IFSI', sourceUrl: 'https://www.fsi.illinois.edu/content/courses/schedule/' },
  nipsta: { id: 'nipsta', name: 'NIPSTA Fire & Technical Rescue', shortName: 'NIPSTA', sourceUrl: 'https://secure.rec1.com/IL/nipsta-il/Public-Calendar-Main-Calendar/76202fcal' },
} as const;
export type TrainingSourceId = keyof typeof trainingSources;
export function isTrainingSource(value: unknown): value is TrainingSourceId { return typeof value === 'string' && Object.hasOwn(trainingSources, value); }
// Never fetch an administrator-supplied arbitrary URL. Recognize official entry
// pages and normalize them to the tested integration for that provider.
export function officialTrainingSource(id: TrainingSourceId, value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw Error('Use the official schedule link.');
  let url: URL; try { url = new URL(value.trim()); } catch { throw Error('Use a complete official https:// schedule link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw Error('Use the official secure schedule link.');
  const key = `${url.hostname}${url.pathname.replace(/\/$/, '')}`;
  const allowed: Record<TrainingSourceId, string[]> = {
    romeoville: ['www.romeoville.org/562/Fire-Rescue-Courses', 'www.romeoville.org/FormCenter/Fire-Academy-13/Fire-Classes-Online-Registration-Fire-Ac-370'],
    ifsi: ['www.fsi.illinois.edu/content/courses/schedule', 'www.fsi.illinois.edu/content/courses/schedule/results.cfm'],
    nipsta: ['nipsta.org/175/Fire-Technical-Rescue-Training', 'www.nipsta.org/175/Fire-Technical-Rescue-Training', 'secure.rec1.com/IL/nipsta-il/Public-Calendar-Main-Calendar/76202fcal'],
  };
  if (!allowed[id].includes(key)) throw Error(`That is not a supported ${trainingSources[id].shortName} schedule. Select Use official site.`);
  return trainingSources[id].sourceUrl;
}
export function ifsiSearchUrl(today: string) {
  const end = new Date(`${today}T12:00:00Z`); end.setUTCFullYear(end.getUTCFullYear() + 1);
  const format = (day: string) => `${day.slice(5, 7)}/${day.slice(8, 10)}/${day.slice(0, 4)}`;
  const url = new URL('results.cfm', trainingSources.ifsi.sourceUrl);
  url.search = new URLSearchParams({ action: 'search', keywords: '', start_date: format(today), end_date: format(end.toISOString().slice(0, 10)), cost: '', delivery: 'any', city: '', county: '', course: '', program: '' }).toString();
  return url.href;
}
