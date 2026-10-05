import { normalizeScheduleTime } from './schedule-time.ts';

/** Advisory department rules. No assumed union, payroll or fatigue limits. */
export type ScheduleSafetyRules = { minimumRestHours: number | null; maximumContinuousHours: number | null };
export const emptyScheduleSafetyRules = (): ScheduleSafetyRules => ({ minimumRestHours: null, maximumContinuousHours: null });
export function validateScheduleSafetyRules(value: unknown): ScheduleSafetyRules {
  if (!value || typeof value !== 'object') throw Error('Enter valid schedule review rules.');
  const input = value as Record<string, unknown>;
  const hours = (key: string, maximum: number) => {
    const number = input[key];
    if (number === null) return null;
    if (typeof number !== 'number' || !Number.isFinite(number) || number <= 0 || number > maximum || number * 4 !== Math.round(number * 4)) throw Error('Rule hours must be positive quarter hours within the displayed limits, or left off.');
    return number;
  };
  return { minimumRestHours: hours('minimumRestHours', 72), maximumContinuousHours: hours('maximumContinuousHours', 168) };
}
export type SafetySlot = { id: string; employeeId: string | null; employeeName?: string; entryDate: string; startTime: string; endTime: string; role: string; status: string };
export type SafetyMember = { id: string; name: string; roles: string };
export type ScheduleSafetyIssue = { id: string; kind: 'overlap' | 'qualification' | 'rest' | 'continuous' | 'invalid'; employeeId: string; employeeName: string; date: string; slotIds: string[]; message: string };
export function scheduleWindow(date: string, startTime: string, endTime: string) {
  const base = Date.parse(`${date}T00:00:00Z`) / 60000;
  const from = normalizeScheduleTime(startTime), to = normalizeScheduleTime(endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(base) || new Date(base * 60000).toISOString().slice(0, 10) !== date || !from || !to) return null;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const start = base + minutes(from);
  let end = base + minutes(to);
  if (end <= start) end += 1440;
  return { start, end };
}
const generalRoles = new Set(['Extra member', 'Firefighter', 'Training/Orientation']);
export function scheduleSafetyIssues(slots: SafetySlot[], members: SafetyMember[], rules: ScheduleSafetyRules, from = '', through = '') {
  validateScheduleSafetyRules(rules);
  const byMember = new Map(members.map(member => [member.id, member]));
  const issues: ScheduleSafetyIssue[] = [];
  const groups = new Map<string, Array<{ slot: SafetySlot; start: number; end: number }>>();
  const seen = new Set<string>();
  const add = (kind: ScheduleSafetyIssue['kind'], employeeId: string, records: SafetySlot[], message: string) => {
    const dates = records.map(record => record.entryDate).sort();
    if (from && dates.at(-1)! < from || through && dates[0] > through) return;
    const slotIds = records.map(record => record.id).sort();
    issues.push({ id: `${kind}:${employeeId}:${slotIds.join(':')}`, kind, employeeId, employeeName: byMember.get(employeeId)?.name || records[0].employeeName || 'Member record unavailable', date: dates[0], slotIds, message });
  };
  for (const slot of slots) {
    if (slot.status !== 'filled' || !slot.employeeId || seen.has(slot.id)) continue;
    seen.add(slot.id);
    const member = byMember.get(slot.employeeId);
    let roles: unknown;
    try { roles = JSON.parse(member?.roles || '[]'); } catch { roles = []; }
    if (!member || !generalRoles.has(slot.role) && (!Array.isArray(roles) || !roles.includes(slot.role))) add('qualification', slot.employeeId, [slot], `Verify current qualification for ${slot.role}.`);
    const interval = scheduleWindow(slot.entryDate, slot.startTime, slot.endTime);
    if (!interval) { add('invalid', slot.employeeId, [slot], 'Saved date or shift time is invalid; verify this assignment.'); continue; }
    const own = groups.get(slot.employeeId) || [];
    own.push({ slot, ...interval }); groups.set(slot.employeeId, own);
  }
  for (const [employeeId, records] of groups) {
    records.sort((a, b) => a.start - b.start || a.end - b.end || a.slot.id.localeCompare(b.slot.id));
    let chain: typeof records = [], chainStart = 0, chainEnd = 0;
    const finishChain = () => {
      if (chain.length && rules.maximumContinuousHours !== null && (chainEnd - chainStart) / 60 > rules.maximumContinuousHours) add('continuous', employeeId, chain.map(record => record.slot), `${((chainEnd - chainStart) / 60).toFixed(2)} continuous scheduled hours exceed the ${rules.maximumContinuousHours}-hour review limit.`);
    };
    for (const record of records) {
      for (const previous of chain) if (record.start < previous.end) add('overlap', employeeId, [previous.slot, record.slot], 'Overlapping saved assignments; verify duplicated work or positions.');
      if (!chain.length || record.start > chainEnd) {
        finishChain();
        if (chain.length && rules.minimumRestHours !== null && (record.start - chainEnd) / 60 < rules.minimumRestHours) add('rest', employeeId, [chain.reduce((a, b) => a.end >= b.end ? a : b).slot, record.slot], `${((record.start - chainEnd) / 60).toFixed(2)} hours between tours are below the ${rules.minimumRestHours}-hour review limit.`);
        chain = [record]; chainStart = record.start; chainEnd = record.end;
      } else { chain.push(record); chainEnd = Math.max(chainEnd, record.end); }
    }
    finishChain();
  }
  return issues.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName) || a.id.localeCompare(b.id));
}
