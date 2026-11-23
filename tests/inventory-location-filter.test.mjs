import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryLocationFilter} from '../app/inventory-location-filter.ts';
const locations=[{id:'cab',apparatus_id:'engine',label:'Cab'},{id:'rear',apparatus_id:'engine',label:'Rear'},{id:'other',apparatus_id:'ambulance',label:'Cab'}];
const item=(id,location,parent=null,type='individual',rig='engine')=>({id,name:'Same name',apparatus_id:rig,compartment_id:location,parent_equipment_id:parent,item_type:type});
const items=[item('bag','cab',null,'bag'),item('tool','cab','bag'),item('loose','cab'),item('box','rear',null,'toolbox'),item('wrench','rear','box'),item('foreign','other',null,'bag','ambulance'),item('orphan','gone'),item('unassigned',null),{...item('retired','cab',null,'kit'),retired_at:'2026-01-01'}];
const run=(locationId='',containerId='',rigId='engine')=>inventoryLocationFilter(items,locations,'engine',{rigId,locationId,containerId});
test('location and container filters use saved IDs and preserve records with duplicate names',()=>{
 const before=structuredClone(items),result=run('cab','bag');
 assert.deepEqual(result.items.map(x=>x.id),['bag','tool']);assert.deepEqual(result.containers.map(x=>x.id),['bag']);assert.deepEqual(items,before);
 assert.deepEqual(run('rear','box').items.map(x=>x.id),['box','wrench']);
 assert.deepEqual(run('cab','loose').items.map(x=>x.id),['bag','loose']);
});
test('a stale container or rig selection cannot hide items in the next location or leak another rig',()=>{
 assert.equal(run('rear','bag').containerId,'');assert.deepEqual(run('rear','bag').items.map(x=>x.id),['box','wrench']);
 assert.equal(run('cab','bag','ambulance').locationId,'');assert.equal(run('cab','bag','ambulance').containerId,'');
 assert.ok(!run().items.some(x=>['foreign','retired'].includes(x.id)));
});
test('unassigned and orphaned saved locations stay reachable, even with no containers',()=>{
 assert.equal(run().hasUnassigned,true);assert.ok(run().locations.some(x=>x.id==='gone'));
 assert.deepEqual(run('gone').items.map(x=>x.id),['orphan']);assert.deepEqual(run('unassigned').items.map(x=>x.id),['unassigned']);
 assert.equal(run('gone').containers.length,0);
});
test('containers with explicit saved children remain selectable before their grouping type is updated',()=>{
 const result=inventoryLocationFilter([item('legacy','cab'),item('child','cab','legacy')],locations,'engine',{rigId:'engine',locationId:'cab',containerId:'legacy'});
 assert.equal(result.containers.length,1);assert.deepEqual(result.items.map(x=>x.id),['legacy','child']);
});
