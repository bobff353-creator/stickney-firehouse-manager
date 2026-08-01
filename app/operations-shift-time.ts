const chicagoClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

export function nextOperationsShiftChange(now: Date) {
  const parts = Object.fromEntries(chicagoClock.formatToParts(now).map((part) => [part.type, part.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const target = minutes < 360 ? 360 : minutes < 720 ? 720 : minutes < 1080 ? 1080 : 1800;
  const remaining = target - minutes;
  const label = target === 720 ? "Noon" : target === 1080 ? "6:00 PM" : "6:00 AM";
  return { label, remaining: `${Math.floor(remaining / 60)}h ${remaining % 60}m` };
}
