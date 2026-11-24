import test from 'node:test';
import assert from 'node:assert/strict';
import {containerEquipmentPage,isInventoryContainer} from '../app/inventory-container-picker.ts';
const box={id:'box',apparatus_id:'rig',compartment_id:'one',item_type:'toolbox',name:'Tool box'};
const tool=(id,extra={})=>({id,name:'Tool '+id,apparatus_id:'rig',compartment_id:'one',item_type:'individual',parent_equipment_id:null,...extra});
const otherBag={...box,id:'bag',item_type:'bag',name:'EMS bag'};
const entries=[box,otherBag,tool('hammer',{name:'Claw hammer',barcode:'ABC-123',model:'Rescue',serial_number:'SER-4'}),tool('scissors',{parent_equipment_id:'bag'}),tool('inside',{parent_equipment_id:'box'}),tool('retired',{retired_at:'old'}),tool('air',{scba_asset_kind:'pack'}),tool('elsewhere',{compartment_id:'two',compartment_label:'Rear cabinet'}),tool('foreign-rig',{apparatus_id:'different'})];
const get=(query='',extra={})=>containerEquipmentPage(entries,box,{query,scope:'compartment',grouping:'all',page:1,...extra});
test('picker finds names, barcodes, models, serials and current bag names without changing records',()=>{
 const before=structuredClone(entries);
 assert.deepEqual(get().rows.map(x=>x.id),['hammer','scissors']);
 for(const query of ['claw','abc-123','rescue ser-4'])assert.equal(get(query).rows[0].id,'hammer');
 assert.equal(get('ems bag').rows[0].id,'scissors');assert.equal(get('',{grouping:'loose'}).total,1);assert.equal(get('',{grouping:'grouped'}).total,1);
 assert.equal(get('rear',{scope:'rig'}).rows[0].id,'elsewhere');assert.deepEqual(entries,before);
});
test('picker excludes retired, nested, already contained, air and other-rig assets and bounds pages',()=>{
 assert.equal(isInventoryContainer(box,entries),true);assert.equal(isInventoryContainer(tool('legacy'),[tool('child',{parent_equipment_id:'legacy'})]),true);
 const many=Array.from({length:31},(_,i)=>tool(String(i).padStart(2,'0')));
 const all=[1,2,3,4].flatMap(page=>containerEquipmentPage(many,box,{query:'',scope:'rig',grouping:'all',page}).rows);
 assert.equal(all.length,31);assert.equal(new Set(all.map(x=>x.id)).size,31);
 assert.equal(containerEquipmentPage(many,box,{query:'',scope:'rig',grouping:'all',page:99}).page,4);
 assert.equal(get('',{scope:'rig'}).rows.some(x=>['inside','retired','air','foreign-rig','bag','box'].includes(x.id)),false);
});
