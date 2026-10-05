import type { CommandAction } from "./incident-command-state";

export type CommandDraft = {
  scope: string;
  incidentId: string;
  expectedRevision: number;
  requestId: string;
  mutation: CommandAction;
  queuedAt: string;
};

// These are proposed changes only. Timed/critical confirmations must be live.
const draftActions = new Set(["set-radio", "assign-position", "add-manual-unit", "assign-unit", "set-building", "set-rit", "set-rehab", "add-hazard", "update-hazard", "remove-hazard", "set-support"]);
export function canDraftCommand(mutation: CommandAction) { return draftActions.has(mutation.action); }
export function commandDraftKey(scope: string) { return `firehouse:command-draft:v1:${scope}`; }

export function parseCommandDraft(raw: string | null, scope: string): CommandDraft | null {
  try {
    const value = JSON.parse(raw || "null") as CommandDraft | null;
    if (!value || value.scope !== scope || !value.incidentId || !value.requestId || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !Number.isFinite(Date.parse(value.queuedAt)) || !value.mutation || !canDraftCommand(value.mutation)) return null;
    return value;
  } catch { return null; }
}

export function commandDraftReview(draft: CommandDraft, incidentId: string | undefined, revision: number | undefined, now = Date.now()) {
  if (draft.incidentId !== incidentId) return "This draft belongs to another incident. It cannot be applied to the current board.";
  const age = now - Date.parse(draft.queuedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 24 * 60 * 60 * 1000) return "This draft is more than 24 hours old or its device time is invalid. Review and re-enter it on the current board.";
  if (draft.expectedRevision !== revision) return "The board has changed since this draft was prepared. Check whether it was already saved; otherwise download the draft and re-enter the change on the latest board.";
  return "";
}

export function commandSaveConfirmed(draft: CommandDraft, receipt: { ok?: boolean; incidentId?: string; requestId?: string; savedRevision?: number }) {
  return receipt.ok === true && receipt.incidentId === draft.incidentId && receipt.requestId === draft.requestId && receipt.savedRevision === draft.expectedRevision + 1;
}
