export const reminderTimings = ["immediate", "1 hour before", "2 hours before", "1 day before", "2 days before", "3 days before", "7 days before", "14 days before", "30 days before"];
export function validReminderTiming(value: string) {
  if (value === "immediate") return true;
  const match = /^(\d+) (hour|day)s? before$/.exec(value);
  return Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= (match[2] === "day" ? 60 : 168));
}
export function reminderAudience(type: string) {
  return type === "shift_request" ? "Requesting member and schedule approvers" : "Current members eligible and available for the position who have not already requested it";
}
export function reminderExplanation(type: string) {
  if (type === "shift_request") return "Immediate sends when a request is submitted or reviewed. Other timings remind about pending requests before the shift starts.";
  if (type === "request_deadline") return "Reminds before the request deadline you set below. No deadline means no deadline reminder. Immediate sends when you set or change a deadline.";
  return "Immediate sends when an open position is created or its details change. Other timings count back from the shift start. Filled positions stop receiving reminders.";
}
