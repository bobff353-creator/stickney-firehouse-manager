// Preplan publication lifecycle domain logic (Preplan 2.0).
// Pure functions only — no database access — so this stays independently testable.

export type LifecycleStatus = "draft" | "in_review" | "published" | "archived";

const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  draft: ["in_review", "archived"],
  in_review: ["draft", "published", "archived"],
  published: ["archived", "draft"],
  archived: ["draft", "published"],
};

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type LifecyclePermissionKey =
  | "field_preplans.edit"
  | "field_preplans.review"
  | "field_preplans.publish"
  | "field_preplans.delete";

/** Which permission key is required to move a record between the given states. */
export function permissionForTransition(to: LifecycleStatus): LifecyclePermissionKey {
  if (to === "published") return "field_preplans.publish";
  if (to === "in_review") return "field_preplans.review";
  if (to === "archived") return "field_preplans.delete";
  return "field_preplans.edit";
}

/** Legacy records saved before the lifecycle column existed must appear published, not vanish. */
export function backfillLifecycleStatus(rawStatus: string | null | undefined): LifecycleStatus {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "draft" || normalized === "in_review" || normalized === "published" || normalized === "archived") {
    return normalized as LifecycleStatus;
  }
  // Legacy `status` values like "Quick Preplan" or "Complete" described completeness, not
  // publication state — every pre-v2 record was already visible to firefighters in Respond.
  return "published";
}

export function isVisibleInRespond(status: LifecycleStatus): boolean {
  return status === "published";
}

export function isVisibleToEditor(status: LifecycleStatus, isOwnerOrEditor: boolean): boolean {
  if (status === "published") return true;
  if (status === "archived") return isOwnerOrEditor;
  return isOwnerOrEditor;
}

export function nextRevisionNumber(currentRevision: number | null | undefined): number {
  const current = Number(currentRevision);
  return Number.isFinite(current) && current > 0 ? current + 1 : 1;
}
