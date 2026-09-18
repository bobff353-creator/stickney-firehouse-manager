import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { trainingModules } from './training-modules.mjs';

// Exercise the actual board projection and JSX, not a duplicate implementation.
const source = readFileSync(new URL('../../app/operations-board.tsx', import.meta.url), 'utf8');
const projection = source.slice(source.indexOf('      const committed ='), source.indexOf('      setData({ ...result, apparatus:'));
const row = source.split('\n').find(line => line.includes('<section className="board-panel apparatus apparatus-wide">'));
if (!projection || !row) throw new Error('Board apparatus projection or row not found');
const summary = readFileSync(new URL('../../app/board-equipment-summary.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(`
  ${summary}
  export function projectFleet(apparatus, activeCalls) {
    const result = { activeCalls }, fleetResult = { payload: { apparatus } };
    ${projection}
    return fleetStatuses;
  }
  export function ApparatusRow({ apparatus, feedDegraded = false }) {
    const data = { apparatus, equipmentIssues: [] }, dailyFleetChecks = [];
    const dailyChecksNeedAttention = false, dailyCheckUrgency = 'scheduled';
    return (${row});
  }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
const load = trainingModules();
new Function('require', 'exports', 'normalizeFleetApparatusName', 'operationalStatusLabel', compiled)(
  createRequire(import.meta.url), exported,
  load('app/respond-device.ts').normalizeFleetApparatusName,
  load('app/workflow-status.ts').operationalStatusLabel,
);
export const projectFleet = exported.projectFleet;
export const renderApparatusRow = props => renderToStaticMarkup(React.createElement(exported.ApparatusRow, props));
export const renderEquipmentSummary = props => renderToStaticMarkup(React.createElement(exported.BoardEquipmentSummary, props));
