const chicagoClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const chicagoMilitaryClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
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

export function formatRespondMilitaryTime(value: string) {
  const input = value.trim();
  if (!input) return "Not reported";

  const military = input.match(/^(\d{1,2}):?(\d{2})$/);
  if (military) {
    const hours = Number(military[1]);
    const minutes = Number(military[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
    }
  }

  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) return input;
  const parts = chicagoMilitaryClock.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return hour && minute ? `${hour}${minute}` : input;
}
