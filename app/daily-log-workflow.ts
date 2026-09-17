import { chicagoOperationalContext } from "./operational-day";

export function currentLogShift(now = new Date()) {
  const { minutes } = chicagoOperationalContext(now);
  return minutes >= 360 && minutes < 720 ? "morning" : minutes >= 720 && minutes < 1080 ? "afternoon" : "overnight";
}

export function callIsComplete(call: { timeIn: string }) {
  return /^(?:[01]\d|2[0-3]):?[0-5]\d$/.test(call.timeIn.trim());
}

export const logNoteCategories = ["Station activity", "Equipment issue", "Handoff item"] as const;
export type LogNoteCategory = typeof logNoteCategories[number];
export type LogNoteEntry = { id: string; at: string; category: LogNoteCategory; status: "Open" | "Resolved" | "Recorded"; text: string };

// Human-readable storage keeps older logs, exports, and the existing officer
// handoff compatible. Only our complete, validated blocks are interpreted.
const entryPattern = /\n?--- Log entry ([\w-]+) ---\nRecorded: ([^\n]+)\nCategory: (Station activity|Equipment issue|Handoff item)\nStatus: (Open|Resolved|Recorded)\n([\s\S]*?)\n--- End log entry ---\n?/g;
export function readLogNotes(value: string) {
  const entries: LogNoteEntry[] = [];
  const text = value.replace(entryPattern, (block, id: string, at: string, category: LogNoteCategory, status: LogNoteEntry["status"], body: string) => {
    if (!Number.isFinite(Date.parse(at))) return block;
    entries.push({ id, at, category, status, text: body });
    return "";
  });
  return { text, entries };
}

export function writeLogNotes(text: string, entries: LogNoteEntry[]) {
  if (!entries.length) return text;
  return text + entries.map(entry => `\n--- Log entry ${entry.id} ---\nRecorded: ${entry.at}\nCategory: ${entry.category}\nStatus: ${entry.status}\n${entry.text.replaceAll("--- End log entry ---", "— End log entry —")}\n--- End log entry ---\n`).join("");
}

export function logEntryTime(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
