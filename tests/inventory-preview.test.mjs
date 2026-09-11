import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inventoryPreviewItems } from '../app/inventory-preview.ts';

const compartments=[{id:'rear',apparatus_id:'engine',label:'Rear',sort_order:2},{id:'cab',apparatus_id:'engine',label:'Cab',sort_order:1}];
const base={apparatus_id:'engine',compartment_id:'rear',check_types:['daily','inventory'],name:'Radio',quantity_required:2};
test('saved preview excludes other rigs, other checklists and retired assets',()=>{
 const rows=[{...base,id:'active'},{...base,id:'other-rig',apparatus_id:'ambulance'},{...base,id:'other-check',check_types:['weekly']},{...base,id:'retired',retired_at:'2026-09-10'}];
 assert.deepEqual(inventoryPreviewItems(rows,compartments,'engine','daily').map(r=>r.equipment_id),['active']);
 assert.equal(inventoryPreviewItems(rows,compartments,'unknown','inventory').length,0);
});
test('preview follows member compartment and item ordering without mutating saved records',()=>{
 const rows=[{...base,id:'rear'},{...base,id:'cab-second',compartment_id:'cab',item_order:2},{...base,id:'cab-first',compartment_id:'cab',item_order:1}];
 const before=structuredClone(rows);
 const preview=inventoryPreviewItems(rows,compartments,'engine','inventory');
 assert.deepEqual(preview.map(r=>r.equipment_id),['cab-first','cab-second','rear']);
 assert.deepEqual(rows,before);
 assert.equal(preview[0].compartment_label,'Cab');
 assert.equal(preview[0].id,'preview-cab-first');
 assert.equal(preview[0].quantity_required,2);
 assert.equal(preview[0].result,'pending');
 assert.equal(preview[0].checked_at,null);
});
test('preview preserves photos and handles missing locations truthfully',()=>{
 const preview=inventoryPreviewItems([{...base,id:'photo',compartment_id:'missing',photo_url:'/private/photo'}],compartments,'engine','inventory');
 assert.equal(preview[0].photo_url,'/private/photo');
 assert.equal(preview[0].compartment_label,'Location not assigned');
});
test('member preview has disabled result controls and blocks unconfirmed refreshed data',()=>{
 const source=readFileSync(new URL('../app/inventory-operations.tsx',import.meta.url),'utf8');
 assert.match(source,/const itemCanCheck = canCheck && !preview/);
 assert.match(source,/builderTask === "preview" && !refreshError/);
 assert.match(source,/fieldset disabled className="inventory-preview-fieldset"/);
 assert.match(source,/renderActiveItem\(item,true\)/);
 assert.match(source,/Saved|saved template/);
 assert.match(source,/Your change was saved, but the refreshed records could not be loaded/);
});
test('sectioned editor keeps fields mounted and validates hidden sections before saving',()=>{
 const source=readFileSync(new URL('../app/inventory-operations.tsx',import.meta.url),'utf8');
 for(const section of ['basics','checks','asset']) assert.ok(source.includes(`data-editor-section="${section}" hidden={editorSection !== "${section}"}`));
 assert.match(source,/invalid\.closest<HTMLElement>\("\[data-editor-section\]"\)/);
 assert.match(source,/invalid\.focus\(\); invalid\.reportValidity\(\)/);
 assert.match(source,/view === "builder" && <button[^\n]*data-preview="true"/);
});
