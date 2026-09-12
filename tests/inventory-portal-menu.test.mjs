import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function compile(path,dependencies={}){const exports={};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in dependencies))throw Error('Unexpected dependency '+name);return dependencies[name];},URLSearchParams});return exports;}
const navigation=compile('app/portal-navigation.ts');
const menu=compile('app/portal-menu-items.ts',{'./portal-navigation':navigation});

test('shared portal navigation fails closed and honors individual grants/removals',()=>{
  assert.deepEqual(Array.from(menu.portalNavigationForPermissions(null)),[]);
  assert.deepEqual(Array.from(menu.portalNavigationForPermissions([])),[]);
  assert.deepEqual(Array.from(menu.portalNavigationForPermissions(['inventory.view'])),['Inventory']);
  assert.ok(menu.portalNavigationForPermissions(['employees.view']).includes('Employees'));
  assert.ok(menu.portalNavigationForPermissions(['employees.manage']).includes('Employees'));
  const all=[...new Set(Object.values(menu.navPermission))];
  assert.equal(menu.portalNavigationForPermissions(all).length,navigation.portalPages.length);
  for(const grant of all){const allowed=menu.portalNavigationForPermissions(all.filter(value=>value!==grant));for(const page of navigation.portalPages.filter(page=>menu.navPermission[page]===grant))assert.ok(!allowed.includes(page),`${page} must hide when ${grant} is removed`);}
  assert.ok(!menu.portalNavigationForPermissions(['inventory.view','field_preplans.view']).includes('Operations Board'));
  assert.ok(menu.portalNavigationForPermissions(['operations_board.view']).includes('Operations Board'));
});

test('inventory shares portal labels and routes without carrying apparatus/check query state',()=>{
  assert.deepEqual(Array.from(menu.featuredNavItems,item=>item.label),['Home','Respond','Live Operations','Maps & Preplans','Daily Log','Station Schedule','Apparatus Checks']);
  assert.ok(menu.adminNavGroups.some(group=>group.label==='Station Duties'&&group.items.some(item=>item.page==='Daily Duties')));
  for(const page of navigation.portalPages){const url=navigation.portalPageUrl('/','',page);assert.equal(navigation.portalPageFromSearch(url.slice(1)),page);assert.ok(!/[?&](apparatus|check)=/.test(url));}
});

test('menu does not fetch, poll, prefetch or remount the inventory workspace',()=>{
  const source=read('app/components/PortalModuleMenu.tsx'),inventory=read('app/inventory-live.tsx');
  assert.doesNotMatch(source,/fetch\(|setInterval|usePermissions|payroll-app|SmartAlerts|from ["']next\/link/);
  assert.match(source,/portalNavigationForPermissions\(permissions\)/);
  assert.match(inventory,/permissions = access\.verified \? access\.permissions : \[\]/);
  assert.match(inventory,/<PortalModuleMenu permissions=\{permissions\} currentPage="Inventory"/);
  assert.match(source,/page === currentPage[\s\S]*event\.preventDefault\(\); setOpen\(false\); return/);
  assert.match(source,/confirmLeavingWork\(\)/);
  assert.match(read('app/payroll-app.tsx'),/portalNavigationForPermissions\(permissions\)/);
});

test('navigation is a focus-managed modal with explicit trigger, close and print hiding',()=>{
  const source=read('app/components/PortalModuleMenu.tsx'),css=read('app/components/portal-module-menu.css');
  assert.match(source,/useState\(false\)/);assert.match(source,/showModal\(\)/);assert.match(source,/panel\.close\(\)/);
  assert.match(source,/trigger\.current\.focus\(\{ preventScroll: true \}\)/);assert.match(source,/previousOverflow/);
  assert.match(source,/aria-expanded=\{open\}/);assert.match(source,/onCancel=/);assert.match(source,/Close navigation/);
  assert.match(css,/min-height:44px/);assert.match(css,/@media print/);assert.match(css,/max-width:820px/);
});
