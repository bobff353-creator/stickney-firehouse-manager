export type AladtecMember = {
  member_id: number;
  is_active?: boolean;
  first_name?: string;
  last_name?: string;
};

export type AladtecSchedule = {
  schedule_id: number;
  name?: string;
  positions?: Array<{ position_id: number; label?: string }>;
};

export type AladtecTimeRecord = {
  member_id: number;
  schedule_id: number;
  position_id: number;
  time_type?: string;
  start_datetime: string;
  stop_datetime: string;
};

export type PortalScheduleItem = {
  memberId: number;
  name: string;
  schedule: string;
  position: string;
  timeType: string;
  start: string;
  stop: string;
};

export function normalizeAladtecSchedule(
  members: AladtecMember[],
  schedules: AladtecSchedule[],
  groups: Array<{ time_records?: AladtecTimeRecord[] }>,
) {
  const memberNames = new Map(members.filter((member) => member.is_active !== false).map((member) => [
    member.member_id,
    [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || `Member ${member.member_id}`,
  ]));
  const scheduleNames = new Map(schedules.map((schedule) => [schedule.schedule_id, schedule.name || `Schedule ${schedule.schedule_id}`]));
  const positionNames = new Map<string, string>();
  for (const schedule of schedules) {
    for (const position of schedule.positions ?? []) {
      positionNames.set(`${schedule.schedule_id}:${position.position_id}`, position.label || `Position ${position.position_id}`);
    }
  }
  const items = groups.flatMap((group) => group.time_records ?? []).map((record): PortalScheduleItem | null => {
    const name = memberNames.get(record.member_id);
    if (!name || !record.start_datetime || !record.stop_datetime) return null;
    return {
      memberId: record.member_id,
      name,
      schedule: scheduleNames.get(record.schedule_id) || `Schedule ${record.schedule_id}`,
      position: positionNames.get(`${record.schedule_id}:${record.position_id}`) || `Position ${record.position_id}`,
      timeType: record.time_type || "",
      start: record.start_datetime,
      stop: record.stop_datetime,
    };
  }).filter((item): item is PortalScheduleItem => Boolean(item)).sort((a, b) => a.start.localeCompare(b.start) || a.position.localeCompare(b.position) || a.name.localeCompare(b.name));

  const merged: PortalScheduleItem[] = [];
  for (const item of items) {
    const prior = merged[merged.length - 1];
    if (
      prior &&
      prior.memberId === item.memberId &&
      prior.schedule === item.schedule &&
      prior.position === item.position &&
      prior.timeType === item.timeType &&
      prior.stop === item.start
    ) {
      prior.stop = item.stop;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}
