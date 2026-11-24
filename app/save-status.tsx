"use client";
import { savedTimeLabel } from "./workflow-status";

export type SaveState = "unsaved" | "saving" | "saved" | "failed" | "loading";
export function SaveStatus({ state, savedAt, detail, onRetry }: {
  state: SaveState; savedAt?: string | Date | null; detail?: string; onRetry?: () => void;
}) {
  return <div className={`workflow-save-status ${state}`} role="status" aria-live="polite">
    <strong>{({ unsaved: "Unsaved changes", saving: "Saving…", saved: "Saved", failed: "Save not confirmed", loading: "Loading saved record…" })[state]}</strong>
    {savedAt && state === "saved" && <small>Confirmed {savedTimeLabel(savedAt)} Central</small>}
    <small>{detail || ({ unsaved: "Use this screen’s save step before leaving.", saving: "Wait here until the save finishes.", saved: "Check any separate Submit or Approve step.", failed: "Keep your edits here. Try saving again.", loading: "Wait for the saved record before making changes." })[state]}</small>
    {state === "failed" && onRetry && <button type="button" onClick={onRetry}>Try saving again</button>}
  </div>;
}
