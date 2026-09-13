import { ifsiScheduleSource } from './lib/training-parsers';

export const boardLinkSections = [
  { id: 'news', title: 'Firefighter Close Calls', label: 'Close Calls', url: 'https://www.firefighterclosecalls.com/', linkLabel: 'Visit Firefighter Close Calls' },
  { id: 'fatalities', title: 'U.S. Firefighter Line-of-Duty Deaths', label: 'Line-of-duty deaths', url: 'https://apps.usfa.fema.gov/firefighter-fatalities/', linkLabel: 'Visit the U.S. Fire Administration fatality reports' },
  { id: 'romeoville', title: 'Romeoville Fire Academy', label: 'Romeoville training', url: 'https://www.romeoville.org/562/Fire-Rescue-Courses', linkLabel: 'Romeoville courses and registration' },
  { id: 'ifsi', title: 'Illinois Fire Service Institute', label: 'IFSI training', url: ifsiScheduleSource, linkLabel: 'IFSI courses and registration' },
  { id: 'nipsta', title: 'NIPSTA Fire & Technical Rescue', label: 'NIPSTA training', url: 'https://nipsta.org/175/Fire-Technical-Rescue-Training', linkLabel: 'NIPSTA courses and registration' },
] as const;
export type BoardLinkSectionId = typeof boardLinkSections[number]['id'];
export type BoardLink = { id: string; label: string; url: string; note: string };
export type BoardLinkSection = { title: string; links: BoardLink[] };
export type BoardLinks = { revision: string; updatedAt: string; trainingRevision?: string; sections: Record<BoardLinkSectionId, BoardLinkSection> };
export type BoardLinksSignal = { settings?: BoardLinks; canEdit: boolean; confirmed: boolean; denied?: boolean; checkedAt: string };
export const maxBoardLinks = 12;
export function boardLinksSignal(settings: BoardLinks, knownRevision: string | null, canEdit: boolean, checkedAt: string): BoardLinksSignal {
  return { ...(knownRevision === settings.revision ? {} : { settings }), canEdit, confirmed: true, checkedAt };
}
export function isBoardLinkSection(id: string): id is BoardLinkSectionId {
  return boardLinkSections.some(section => section.id === id);
}
export function defaultBoardLinks(): BoardLinks {
  return { revision: '', updatedAt: '', sections: Object.fromEntries(boardLinkSections.map(section => [section.id, {
    title: section.title, links: [{ id: `default-${section.id}`, label: section.linkLabel, url: section.url, note: '' }],
  }])) as BoardLinks['sections'] };
}
export function safeBoardLinkUrl(value: string): string {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw new Error('Use a complete https:// website address without spaces.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Use a complete https:// website address.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') ||
    /(^localhost$|\.(localhost|local|internal)$|^[\d.]+$|:)/i.test(url.hostname)) {
    throw new Error('Use a public https:// website address without login credentials.');
  }
  return url.href;
}
function text(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`${label} must be text, up to ${max} characters.`);
  if (required && !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
export function validateBoardLinkSection(value: unknown): BoardLinkSection {
  if (!value || typeof value !== 'object') throw new Error('Choose a section to edit.');
  const section = value as Record<string, unknown>;
  const title = text(section.title, 'Section title', 100);
  if (!Array.isArray(section.links) || section.links.length > maxBoardLinks) throw new Error(`Use no more than ${maxBoardLinks} links per section.`);
  const ids = new Set<string>();
  const links = section.links.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Each link needs a label and website address.');
    const link = raw as Record<string, unknown>;
    const id = text(link.id, 'Link ID', 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Each link must have a unique ID.');
    ids.add(id);
    return { id, label: text(link.label, 'Link label', 120), url: safeBoardLinkUrl(text(link.url, 'Website address', 2048)), note: text(link.note, 'Description', 240, false) };
  });
  return { title, links };
}
