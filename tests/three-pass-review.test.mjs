import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('app/board-active-calls.tsx', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const exports = {};
const require = createRequire(import.meta.url);
new Function('require','exports',compiled)(id => id.endsWith('.css') ? {default:{summary:'summary'}} : id === './board-sync-clock' ? {synchronizedSlide:()=>0} : id === './military-time' ? {formatMilitaryTime:value=>value} : require(id),exports);

test('unconfirmed call feeds never show a green all-clear', () => {
  const html=renderToStaticMarkup(React.createElement(exports.default,{calls:[],tvMode:true,now:0,confirmed:false}));
  assert.match(html,/Not confirmed/);
  assert.match(html,/Waiting for a successful call update/);
  assert.doesNotMatch(html,/No open calls|>None<|summary clear/);
});
test('confirmed empty and active feeds retain their operational behavior', () => {
  const render=calls=>renderToStaticMarkup(React.createElement(exports.default,{calls,tvMode:true,now:0,confirmed:true}));
  assert.match(render([]),/No open calls/);
  const html=render([{reportNumber:'TEST-1',callType:'Fictional incident',address:'Test address',respondingUnits:'TEST-A',timeOut:'1200'}]);
  assert.match(html,/Fictional incident/);
  assert.match(html,/Test address/);
  assert.doesNotMatch(html,/Not confirmed|No open calls/);
});
test('board and rate form expose truthful availability and save states', () => {
  const board=readFileSync('app/operations-board.tsx','utf8');
  assert.match(board,/confirmed=\{Boolean\(data\)\}/);
  assert.match(board,/Staffing not confirmed/);
  const payroll=readFileSync('app/payroll-app.tsx','utf8');
  assert.match(payroll,/useUnsavedWork\(activeNav === "Rates & Rules" && rulesDirty, rulesSaving\)/);
  assert.match(payroll,/disabled=\{rulesSaving\}/);
  assert.match(payroll,/rulesSaveError \? "failed" : rulesDirty \? "unsaved"/);
  assert.doesNotMatch(payroll,/closed and earlier payroll periods never change/);
  assert.match(payroll,/dirtyCellCount \? "unsaved"/);
  assert.doesNotMatch(payroll,/<SaveStatus[^\n]*originalCellValues.current/);
  const css=readFileSync('app/portal-usability.css','utf8');
  assert.match(css,/\.timesheet-card \.entry-grid td \{[^}]*height: auto; min-height: 52px/);
});
