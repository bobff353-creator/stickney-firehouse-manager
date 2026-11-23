import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { inventoryWorkspaceView, inventoryWorkspaceUrl } from '../app/inventory-workspace-model.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/inventory-workspace-navigation.tsx', import.meta.url), 'utf8');
const targetModule = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => name === './inventory-work-icon' ? { InventoryWorkIcon: () => null } : require(name), targetModule, targetModule.exports);
const Navigation = targetModule.exports.default;

test('workspace addresses survive refresh and do not reopen the prior check or equipment record', () => {
  for (const view of ['fleet','equipment','service','maintenance','reports','setup']) {
    const address = inventoryWorkspaceUrl('https://fixture.invalid/inventory?check=daily&resume=old&equipment=old&workOrder=old&adminTask=old&report=old&apparatus=old', view, 'current-rig');
    const url = new URL(address, 'https://fixture.invalid');
    assert.equal(inventoryWorkspaceView(url.searchParams.get('view')), view);
    assert.equal(url.searchParams.get('apparatus'), 'current-rig');
    for (const key of ['check','resume','equipment','workOrder','adminTask','report']) assert.equal(url.searchParams.has(key), false);
  }
  assert.equal(inventoryWorkspaceView('foreign-page'), '');
  assert.equal(inventoryWorkspaceView(['setup']), '');
  assert.equal(inventoryWorkspaceUrl('https://fixture.invalid/inventory?view=reports', 'due'), '/inventory');
});

test('workspace navigation retains crew destinations while hiding administration and maintenance management without grants', () => {
  const member = renderToStaticMarkup(createElement(Navigation, { current: 'check', canSetup: false, canManageRepairs: false, onNavigate() {} }));
  for (const label of ['Today','Checks','Repairs','Equipment','Saved reports','Inventory counts','Air packs &amp; bottles','Meds &amp; stock','Apparatus status']) assert.ok(member.includes(label), label);
  assert.equal(member.includes('Administration'), false);
  assert.equal(member.includes('Maintenance'), false);
  assert.match(member, /aria-current="page"[^>]*>[^]*?Checks/);
  const admin = renderToStaticMarkup(createElement(Navigation, { current: 'setup', canSetup: true, canManageRepairs: true, onNavigate() {} }));
  assert.ok(admin.includes('Administration'));
  assert.ok(admin.includes('Maintenance'));
  assert.ok(admin.includes('aria-label="Apparatus workspaces"'));
});
