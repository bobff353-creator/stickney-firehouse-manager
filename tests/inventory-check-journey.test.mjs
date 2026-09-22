import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/inventory-check-flow.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { initialCheckSection, canSubmitInspection, stockExpiryDays } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const operations = await readFile(new URL('../app/inventory-operations.tsx', import.meta.url), 'utf8');
test('start at first pending section without treating an empty check as complete', () => {
  assert.equal(initialCheckSection([{id:'cab',pending:0},{id:'rear',pending:2}]), 'rear');
  assert.equal(initialCheckSection([]), 'review');
  assert.equal(canSubmitInspection(0, 0, false, false, true), false);
});
test('submission requires all results, no drafts, no write in flight and check access', () => {
  assert.equal(canSubmitInspection(12, 0, false, false, true), true);
  for (const args of [[12,1,false,false,true],[12,0,true,false,true],[12,0,false,true,true],[12,0,false,false,false]]) assert.equal(canSubmitInspection(...args), false);
});
test('unknown expiration is not represented as a valid date', () => {
  assert.equal(stockExpiryDays(null), null);
  assert.equal(stockExpiryDays('Invalid Date'), null);
  assert.equal(stockExpiryDays('2026-09-21', new Date('2026-09-21T12:00:00').getTime()), 0);
  assert.ok(stockExpiryDays('2020-01-01') < 0);
});
test('air drafts stay mounted and block submission; navigation is guarded', () => {
  assert.match(operations, /key=\{value\(entry, "id"\)\}/);
  assert.match(operations, /draft\.dirty && draft\.revision !== revision/);
  assert.match(operations, /const unsavedCheck = unsavedReadings \|\| unsavedScba/);
  assert.match(operations, /hidden=\{currentSection === "review"\}/);
  assert.match(operations, /if \(!confirmLeavingWork\(\)\) return;/);
});
test('save acknowledgement is separate from refresh, duplicate requests and notification claims', () => {
  assert.match(operations, /mutationPending\.current \|\| itemSavePending\.current/);
  assert.match(operations, /load\(\{ background: true, fresh: true \}\)/);
  assert.match(operations, /This does not send an email, text, or push notification/);
  assert.match(operations, /Do not repeat a stock adjustment until you verify the quantity/);
  assert.match(operations, /item\.lots\.length === 1/);
  assert.match(operations, /Choose the actual lot/);
});
