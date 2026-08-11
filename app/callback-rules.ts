export const CALLBACK_RULE_VERSION = "stickney-callback-rules-2026-08-10-v1";

export type CallbackRuleCall = {
  id: string;
  logDate: string;
  timeOut: string;
  timeIn: string;
  callType: string;
};

export type CallbackRuleEvaluation = {
  ruleVersion: string;
  matches: string[];
  flags: string[];
  suggestedHours: number;
  actualMinutes: number | null;
  automaticallyQualifies: boolean;
};

function militaryMinutes(value: string) {
  const raw = String(value ?? "").replace(/\D/g, "");
  if (!raw) return null;
  const digits = raw.padStart(4, "0").slice(-4);
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function occurrenceMinutes(logDate: string, time: string) {
  const minutes = militaryMinutes(time);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(logDate)
    ? new Date(`${logDate}T00:00:00Z`)
    : null;
  if (minutes === null || !date || Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 60_000) + minutes;
}

export function callbackDurationMinutes(timeOut: string, timeIn: string) {
  const start = militaryMinutes(timeOut);
  let end = militaryMinutes(timeIn);
  if (start === null || end === null) return null;
  if (end < start) end += 24 * 60;
  return end - start;
}

export function callbackSuggestedHours(timeOut: string, timeIn: string) {
  const duration = callbackDurationMinutes(timeOut, timeIn);
  if (duration === null || duration <= 120) return 2;
  return Math.ceil(duration / 15) / 4;
}

export function callbackTypeMatch(callType: string) {
  const normalized = String(callType ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (/\b(mva|mvc|auto accident|automobile accident|motor vehicle accident|vehicle accident)\b/.test(normalized)) return "Auto accident";
  if (/\bfire alarm\b/.test(normalized)) return "Fire alarm";
  if (/\bmutual aid\b/.test(normalized)) return "Mutual aid";
  if (/\bauto aid\b/.test(normalized)) return "Auto aid";
  return null;
}

export function callbackIsWeekendWindow(logDate: string, timeOut: string) {
  const minutes = militaryMinutes(timeOut);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(logDate)
    ? new Date(`${logDate}T12:00:00Z`)
    : null;
  if (minutes === null || !parsed || Number.isNaN(parsed.getTime())) return false;
  const weekday = parsed.getUTCDay();
  return (weekday === 5 && minutes >= 18 * 60)
    || weekday === 6
    || (weekday === 0 && minutes < 18 * 60);
}

function withinMinutes(call: CallbackRuleCall, other: CallbackRuleCall, threshold: number) {
  const left = occurrenceMinutes(call.logDate, call.timeOut);
  const right = occurrenceMinutes(other.logDate, other.timeOut);
  return left !== null && right !== null && Math.abs(left - right) <= threshold;
}

export function evaluateCallbackRules(input: {
  call: CallbackRuleCall;
  holidayName?: string | null;
  otherCalls?: CallbackRuleCall[];
  employeeOnDuty?: boolean;
  submitterIsDeputyChief?: boolean;
  employeeCallbackCalls?: CallbackRuleCall[];
}): CallbackRuleEvaluation {
  const {
    call,
    holidayName,
    otherCalls = [],
    employeeOnDuty = false,
    submitterIsDeputyChief = false,
    employeeCallbackCalls = [],
  } = input;
  const matches: string[] = [];
  const flags: string[] = [];

  if (callbackIsWeekendWindow(call.logDate, call.timeOut)) {
    matches.push("Weekend window: Friday 18:00 through Sunday 17:59");
  }
  if (holidayName) matches.push(`Department holiday: ${holidayName}`);
  const typeMatch = callbackTypeMatch(call.callType);
  if (typeMatch) matches.push(`Qualifying call type: ${typeMatch}`);
  if (otherCalls.some((other) => other.id !== call.id && withinMinutes(call, other, 5))) {
    matches.push("Back-to-back call: another call was dispatched within 5 minutes");
  }
  if (submitterIsDeputyChief) matches.push("Deputy Chief submission override");

  if (employeeOnDuty) {
    flags.push("Member was already on duty at the call time; callback pay requires reviewer approval.");
  }
  if (!matches.length) {
    flags.push("No automatic callback condition matched; reviewer approval is required.");
  }
  if (employeeCallbackCalls.some((other) => other.id !== call.id && withinMinutes(call, other, 119))) {
    flags.push("Another callback for this member falls inside the same 2-hour window; double callback hours require approval.");
  }

  const actualMinutes = callbackDurationMinutes(call.timeOut, call.timeIn);
  if (actualMinutes === null) {
    flags.push("Call Time In is missing or invalid; suggested hours use the 2-hour minimum.");
  }

  return {
    ruleVersion: CALLBACK_RULE_VERSION,
    matches,
    flags,
    suggestedHours: callbackSuggestedHours(call.timeOut, call.timeIn),
    actualMinutes,
    automaticallyQualifies: matches.length > 0,
  };
}

export function parseCallbackRuleList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
