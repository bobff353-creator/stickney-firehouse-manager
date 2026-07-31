const chicagoClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatRespondTime(value: string) {
  const input = value.trim();
  if (!input) return "Not reported";

  const military = input.match(/^(\d{1,2}):?(\d{2})$/);
  if (military) {
    const hours = Number(military[1]);
    const minutes = Number(military[2]);
    if (hours <= 23 && minutes <= 59) {
      const suffix = hours >= 12 ? "PM" : "AM";
      const displayHour = hours % 12 || 12;
      return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
    }
  }

  const date = new Date(input);
  return Number.isNaN(date.valueOf()) ? input : chicagoClock.format(date);
}
