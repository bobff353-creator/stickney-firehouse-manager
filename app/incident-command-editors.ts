import type { IncidentCommandState } from "./incident-command-state";

export type CommandEditor<T> = { draft: T; baseline: T; saved: T; conflict: boolean };
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function newCommandEditor<T>(value: T): CommandEditor<T> {
  return { draft: value, baseline: value, saved: value, conflict: false };
}

/** Unrelated board updates must not replace wording an officer is still entering. */
export function reconcileCommandEditor<T>(editor: CommandEditor<T>, saved: T): CommandEditor<T> {
  if (same(editor.draft, saved) || (!editor.conflict && same(editor.draft, editor.baseline))) return newCommandEditor(saved);
  return { ...editor, saved, conflict: !same(editor.baseline, saved) };
}

export function changeCommandEditor<T>(editor: CommandEditor<T>, draft: T): CommandEditor<T> {
  return same(draft, editor.saved) ? newCommandEditor(editor.saved) : { ...editor, draft };
}

/** Keeping a draft is an explicit review of the latest saved value, never an automatic merge. */
export function reviewCommandEditor<T>(editor: CommandEditor<T>, keepDraft: boolean): CommandEditor<T> {
  return keepDraft ? { ...editor, baseline: editor.saved, conflict: false } : newCommandEditor(editor.saved);
}

export type CommandEditors = {
  scope: string;
  radio: CommandEditor<string>;
  rit: CommandEditor<IncidentCommandState["rit"]>;
  rehab: CommandEditor<IncidentCommandState["rehab"]>;
};

export function reconcileCommandEditors(current: CommandEditors | null, scope: string, state: IncidentCommandState): CommandEditors {
  const existing = current?.scope === scope ? current : null;
  return {
    scope,
    radio: existing ? reconcileCommandEditor(existing.radio, state.radioChannel) : newCommandEditor(state.radioChannel),
    rit: existing ? reconcileCommandEditor(existing.rit, state.rit) : newCommandEditor(state.rit),
    rehab: existing ? reconcileCommandEditor(existing.rehab, state.rehab) : newCommandEditor(state.rehab),
  };
}

export function commandEditorDirty(editor: CommandEditor<unknown>) {
  return !same(editor.draft, editor.saved);
}
