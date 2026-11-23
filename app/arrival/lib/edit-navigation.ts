import { planSchema, steps, systemLabels } from "./preplan.ts";
import type { Draft } from "../ui/editor";

export function preplanDetailDestination(label: string) {
  let step = 5;
  if (/^[ABCD]-side photo$/.test(label)) step = 4;
  else if (Object.values(systemLabels).some(name => label === name || label === `${name} location`) || label === "Hazards") step = 3;
  else if (["Water supply", "Emergency contact", "Main entrance"].includes(label)) step = 2;
  else if (["Construction", "Roof", "Floor count", "Basement", "Occupancy", "Occupant / rescue considerations"].includes(label)) step = 1;
  else if (["Building", "Address", "Location"].includes(label)) step = 0;
  return { step, section: steps[step] };
}

export function preplanDetailDraft(draft: Draft, label: string): Draft {
  return { ...draft, kind: "full", detailTarget: label, data: { ...draft.data, step: preplanDetailDestination(label).step } };
}

export function restoreEditorDraft(initial: Draft, stored: string | null): Draft {
  // Transfers carry the current unsaved quick draft. Never replace it with an older device copy.
  if (initial.kind === "full" || initial.kind === "photos") return initial;
  try {
    const local = JSON.parse(stored || "null");
    if (local?.id === initial.id && planSchema.safeParse(local.data).success) return local;
  } catch {}
  return initial;
}
