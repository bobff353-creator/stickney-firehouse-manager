/** A boundary deadline belongs to the shift ending at that time. */
export function fleetCheckShift(endTime: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(endTime);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  if (total > 360 && total <= 720) return "morning";
  if (total > 720 && total <= 1080) return "afternoon";
  return "overnight";
}

export function fleetChecksForShift<T extends { endTime: string }>(checks: T[], shiftKey: string): T[] {
  return checks.filter((check) => fleetCheckShift(check.endTime) === shiftKey);
}
