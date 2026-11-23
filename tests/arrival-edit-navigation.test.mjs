import test from 'node:test';
import assert from 'node:assert/strict';
import { blankPlan, unknowns } from '../app/arrival/lib/preplan.ts';
import { preplanDetailDestination, preplanDetailDraft, restoreEditorDraft } from '../app/arrival/lib/edit-navigation.ts';

test('every unknown detail opens an editable section, including all photo sides', () => {
  const plan = blankPlan();
  for (const label of unknowns(plan)) assert.notEqual(preplanDetailDestination(label).step, 5, label);
  for (const label of ['Construction','Roof','Basement','Occupant / rescue considerations']) assert.equal(preplanDetailDestination(label).step, 1);
  for (const label of ['Fire department connection (FDC)','Gas shutoff','Electrical shutoff','Fire sprinklers location']) assert.equal(preplanDetailDestination(label).step, 3);
  assert.equal(preplanDetailDestination('Emergency contact').step, 2);
  for (const side of ['A','B','C','D']) assert.equal(preplanDetailDestination(`${side}-side photo`).step, 4);
});

test('opening full details preserves the current unsaved draft, IDs, revisions and photos over stale device data', () => {
  const draft = { id:'fixture-plan', revision:7, kind:'quick', data:{...blankPlan(),name:'Current unsaved name',contactName:'Current contact',step:5} };
  const original = structuredClone(draft);
  const stale = {...draft,data:{...draft.data,name:'Older device name',contactName:'Older contact'}};
  const opened = preplanDetailDraft(draft, 'Gas shutoff');
  assert.deepEqual(draft, original);
  assert.equal(opened.kind, 'full');
  assert.equal(opened.id, draft.id);
  assert.equal(opened.revision, 7);
  assert.equal(opened.data.step, 3);
  assert.deepEqual({...opened.data,step:5}, draft.data);
  assert.deepEqual(restoreEditorDraft(opened, JSON.stringify(stale)), opened);
  assert.equal(restoreEditorDraft(draft, JSON.stringify(stale)).data.name, 'Older device name');
  assert.deepEqual(restoreEditorDraft(draft, '{broken'), draft);
  assert.deepEqual(restoreEditorDraft(draft, JSON.stringify({...stale,id:'another-plan'})), draft);
});
