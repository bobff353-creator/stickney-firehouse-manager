export type RecoveryStaff = {
  id: string; shiftKey: string; employeeId: string; timeIn: string; timeOut: string; actingOfficer: boolean;
};
export type RecoveryCall = {
  id: string; reportNumber: string; timeOut: string; timeIn: string; respondingUnits: string; address: string; callType: string;
};
export type LogSnapshot = { staffing: RecoveryStaff[]; calls: RecoveryCall[]; shiftNotes: string };
export type RecoveryChoice = "draft" | "saved";
type Section = "staffing" | "calls" | "shiftNotes";
export type LogDifference = {
  key: string; section: Section; id: string; field: string;
  draft: string | boolean | RecoveryStaff | RecoveryCall | undefined;
  saved: string | boolean | RecoveryStaff | RecoveryCall | undefined;
};
const staffFields = ["shiftKey", "employeeId", "timeIn", "timeOut", "actingOfficer"] as const;
const callFields = ["reportNumber", "timeOut", "timeIn", "respondingUnits", "address", "callType"] as const;

// Ignore API-only metadata and empty editor placeholders, just as saving does.
export function logSnapshot(value: LogSnapshot): LogSnapshot {
  return {
    staffing: value.staffing.filter(row => row.employeeId).map(row => ({
      id: row.id, shiftKey: row.shiftKey, employeeId: row.employeeId,
      timeIn: row.timeIn || "", timeOut: row.timeOut || "", actingOfficer: Boolean(row.actingOfficer),
    })),
    calls: value.calls.filter(row => callFields.some(field => row[field] && row[field] !== "EMS")).map(row => ({
      id: row.id, reportNumber: row.reportNumber || "", timeOut: row.timeOut || "", timeIn: row.timeIn || "",
      respondingUnits: row.respondingUnits || "", address: row.address || "", callType: row.callType || "EMS",
    })),
    shiftNotes: value.shiftNotes || "",
  };
}

export function logDifferences(local: LogSnapshot, server: LogSnapshot): LogDifference[] {
  const draft = logSnapshot(local), saved = logSnapshot(server);
  const result: LogDifference[] = [];
  for (const section of ["staffing", "calls"] as const) {
    const mine = new Map(draft[section].map(row => [row.id, row]));
    const theirs = new Map(saved[section].map(row => [row.id, row]));
    const fields = section === "staffing" ? staffFields : callFields;
    // Start in the saved display order; append any local-only rows.
    for (const id of new Set([...theirs.keys(), ...mine.keys()])) {
      const a = mine.get(id), b = theirs.get(id);
      if (!a || !b) {
        result.push({ key: JSON.stringify([section, id]), section, id, field: "row", draft: a, saved: b });
      } else {
        for (const field of fields) {
          const av = (a as unknown as Record<string, string | boolean>)[field];
          const bv = (b as unknown as Record<string, string | boolean>)[field];
          if (av !== bv) result.push({ key: JSON.stringify([section, id, field]), section, id, field, draft: av, saved: bv });
        }
      }
    }
  }
  if (draft.shiftNotes !== saved.shiftNotes) result.push({ key: "shiftNotes", section: "shiftNotes", id: "", field: "shiftNotes", draft: draft.shiftNotes, saved: saved.shiftNotes });
  return result;
}

export function resolveLogDifferences(draft: LogSnapshot, saved: LogSnapshot, choices: Record<string, RecoveryChoice>): LogSnapshot {
  const differences = logDifferences(draft, saved);
  const result = logSnapshot(saved);
  for (const difference of differences) {
    const choice = choices[difference.key];
    if (choice !== "draft" && choice !== "saved") throw new Error("Choose which version to keep for every difference.");
    if (choice === "saved") continue;
    if (difference.section === "shiftNotes") { result.shiftNotes = String(difference.draft ?? ""); continue; }
    const rows = result[difference.section] as (RecoveryStaff | RecoveryCall)[];
    const index = rows.findIndex(row => row.id === difference.id);
    if (difference.field === "row") {
      if (!difference.draft) { if (index >= 0) rows.splice(index, 1); }
      else rows.push({ ...(difference.draft as RecoveryStaff | RecoveryCall) });
    } else {
      Object.assign(rows[index], { [difference.field]: difference.draft });
    }
  }
  return result;
}

export function backupLogRecovery(storage: Pick<Storage, "setItem">, date: string, draft: LogSnapshot, expectedVersion: number | undefined, saved: LogSnapshot, savedVersion: number) {
  // Preserve both full copies before replacing the working draft. Failure is
  // deliberately surfaced so recovery never silently drops a local copy.
  storage.setItem(`sfd-daily-log-draft:${date}:backup:${crypto.randomUUID()}`, JSON.stringify({
    logDate: date, savedAt: new Date().toISOString(), expectedVersion, ...logSnapshot(draft),
    comparedWith: { ...logSnapshot(saved), saveVersion: savedVersion },
  }));
}
