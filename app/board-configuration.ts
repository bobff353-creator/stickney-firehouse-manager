export const boardSlides = [
  { id: 'equipment', label: 'Equipment & apparatus' },
  { id: 'duty', label: 'Checks & daily duty' },
  { id: 'news', label: 'Close Calls' },
  { id: 'fatalities', label: 'Line-of-duty deaths' },
  { id: 'romeoville', label: 'Romeoville training' },
  { id: 'ifsi', label: 'IFSI training' },
  { id: 'nipsta', label: 'NIPSTA training' },
] as const;
export type BoardSlideId = typeof boardSlides[number]['id'];
export type BoardConfiguration = {
  slides: Array<{ id: BoardSlideId; enabled: boolean; seconds: number }>;
  closeCalls: 'auto' | '3';
  announcement: { title: string; body: string; startsAt: string; endsAt: string; enabled: boolean };
};
export type SavedBoardConfiguration = { revision: string; updatedAt: string; configuration: BoardConfiguration; previous: BoardConfiguration | null };
export type BoardConfigurationSignal = { saved?: SavedBoardConfiguration; confirmed: boolean; canEdit: boolean; denied?: boolean };
export function defaultBoardConfiguration(): BoardConfiguration {
  return { slides: boardSlides.map(({ id }) => ({ id, enabled: true, seconds: 12 })), closeCalls: 'auto', announcement: { title: '', body: '', startsAt: '', endsAt: '', enabled: false } };
}
export function emptyBoardConfiguration(): SavedBoardConfiguration {
  return { revision: '', updatedAt: '', configuration: defaultBoardConfiguration(), previous: null };
}
export function validateBoardConfiguration(input: unknown): BoardConfiguration {
  if (!input || typeof input !== 'object') throw Error('Choose board settings.');
  const value = input as BoardConfiguration;
  if (!Array.isArray(value.slides) || value.slides.length !== boardSlides.length) throw Error('Include each board section once.');
  const seen = new Set<string>();
  const slides = value.slides.map(slide => {
    if (!slide || !boardSlides.some(item => item.id === slide.id) || seen.has(slide.id)) throw Error('Include each board section once.');
    seen.add(slide.id);
    if (typeof slide.enabled !== 'boolean' || !Number.isInteger(slide.seconds) || slide.seconds < 8 || slide.seconds > 60) throw Error('Show each section for 8–60 seconds.');
    return { id: slide.id, enabled: slide.enabled, seconds: slide.seconds };
  });
  if (!slides.some(slide => slide.enabled)) throw Error('Keep at least one rotating section enabled.');
  if (!['auto', '3'].includes(value.closeCalls)) throw Error('Choose a Close Calls layout.');
  const a = value.announcement;
  if (!a || typeof a.enabled !== 'boolean' || typeof a.title !== 'string' || a.title.length > 80 || typeof a.body !== 'string' || a.body.length > 240 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(a.title + a.body)) throw Error('Use a headline up to 80 characters and a message up to 240 characters.');
  for (const date of [a.startsAt, a.endsAt]) if (typeof date !== 'string' || (date && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(date) || !Number.isFinite(Date.parse(date))))) throw Error('Choose valid announcement dates.');
  if (a.enabled && (!a.title.trim() || !a.body.trim() || !a.endsAt)) throw Error('An enabled announcement needs a headline, message, and end time.');
  if (a.startsAt && a.endsAt && Date.parse(a.endsAt) <= Date.parse(a.startsAt)) throw Error('The announcement must end after it starts.');
  return { slides, closeCalls: value.closeCalls, announcement: { title: a.title.trim(), body: a.body.trim(), startsAt: a.startsAt, endsAt: a.endsAt, enabled: a.enabled } };
}
export function boardSlideAt(now: number, config: BoardConfiguration): BoardSlideId {
  const enabled = config.slides.filter(slide => slide.enabled);
  const duration = enabled.reduce((sum, slide) => sum + slide.seconds * 1000, 0);
  let offset = ((now % duration) + duration) % duration;
  for (const slide of enabled) { if (offset < slide.seconds * 1000) return slide.id; offset -= slide.seconds * 1000; }
  return 'equipment';
}
export function announcementIsActive(config: BoardConfiguration, now: number) {
  const a = config.announcement;
  return a.enabled && (!a.startsAt || Date.parse(a.startsAt) <= now) && Date.parse(a.endsAt) > now;
}
