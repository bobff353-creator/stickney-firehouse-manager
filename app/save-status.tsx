"use client";
import { savedTimeLabel } from "./workflow-status";

export type SaveState = "unsaved" | "saving" | "saved" | "failed" | "loading";
export function SaveStatus({ state, savedAt, detail, onRetry }: {
  state: SaveState; savedAt?: string | Date | null; detail?: string; onRetry?: () => void;
}) {
  return <div className={`workflow-save-status ${state}`} role="status" aria-live="polite">
    <strong>{({ unsaved: "Unsaved changes", saving: "Saving…", saved: "Saved", failed: "Save failed — Retry", loading: "Loading saved record…" })[state]}</strong>
    {savedAt && state === "saved" && <small>Confirmed {savedTimeLabel(savedAt)} Central</small>}
    {detail && <small>{detail}</small>}
    {state === "failed" && onRetry && <button type="button" onClick={onRetry}>Retry save</button>}
  </div>;
}
