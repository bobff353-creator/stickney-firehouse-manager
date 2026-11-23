import test from 'node:test';
import assert from 'node:assert/strict';
import {checklistContainers,containedProgress} from '../app/inventory-check-containers.ts';
const asset=(id,parent=null,type='individual',rig='engine',location='cab')=>({id,name:id,item_type:type,parent_equipment_id:parent,apparatus_id:rig,compartment_id:location});
const row=(id,result='pending',location='Cab')=>({id:'saved-'+id,equipment_id:id,equipment_name:id,compartment_label:location,result});
const flatten=nodes=>nodes.flatMap(node=>[...(node.row?[node.row]:[]),...flatten(node.children)]);
test('container groups preserve every saved ID, separate results and child progress without changing records',()=>{
 const equipment=[asset('bag',null,'bag'),asset('tool','bag'),asset('spare','bag'),asset('loose')],rows=[row('bag','pass'),row('tool'),row('spare','pass'),row('loose')],before=structuredClone(rows);
 const groups=checklistContainers(rows,equipment),bag=groups.find(node=>node.label==='bag');
 assert.deepEqual(containedProgress(bag),{total:2,pending:1});assert.deepEqual(flatten(groups).map(r=>r.id).sort(),rows.map(r=>r.id).sort());assert.deepEqual(rows,before);
 assert.equal(bag.row.result,'pass');assert.equal(bag.children[0].row.result,'pending');
});
test('search/status filters can retain child access when the container row is not shown',()=>{
 const result=checklistContainers([row('tool')],[asset('box',null,'toolbox'),asset('tool','box')]);
 assert.equal(result[0].label,'box');assert.equal(result[0].row,undefined);assert.equal(result[0].children[0].row.id,'saved-tool');
 const before=checklistContainers([row('box'),row('tool')],[asset('box',null,'toolbox'),asset('tool','box')]);assert.equal(before[0].key,result[0].key,'saving/hiding the parent must not remount child editors');
});
test('orphaned, moved, foreign and cyclic legacy links never hide or duplicate check rows',()=>{
 const equipment=[asset('a','b','kit'),asset('b','a','bag'),asset('orphan','missing'),asset('foreignChild','foreignBox'),asset('foreignBox',null,'bag','ambulance'),asset('movedChild','movedBox'),asset('movedBox',null,'bag','engine','rear')];
 const rows=equipment.map(x=>row(x.id)),groups=checklistContainers(rows,equipment);
 assert.deepEqual(flatten(groups).map(r=>r.id).sort(),rows.map(r=>r.id).sort());
 for(const id of ['orphan','foreignChild','movedChild'])assert.ok(groups.some(node=>node.row?.equipment_id===id));
});
test('saved location differences remain separate and empty containers still open their own check',()=>{
 const groups=checklistContainers([row('bag','pending','Old cab'),row('child','pending','Rear')],[asset('bag',null,'bag'),asset('child','bag')]);
 assert.equal(groups.length,2);assert.equal(groups[0].container,true);assert.deepEqual(containedProgress(groups[0]),{total:0,pending:0});
});
test('duplicate legacy container rows retain unique rendered keys and separate saved IDs',()=>{
 const rows=[row('bag'),{...row('bag'),id:'second-saved-bag'},row('child')],groups=checklistContainers(rows,[asset('bag',null,'bag'),asset('child','bag')]);
 assert.equal(new Set(groups.map(node=>node.key)).size,groups.length);assert.deepEqual(flatten(groups).map(r=>r.id).sort(),rows.map(r=>r.id).sort());
});
test('explicit legacy parent links work even before the bag grouping type was recorded',()=>{
 const equipment=[asset('legacy-bag'),asset('tool','legacy-bag')],full=checklistContainers([row('legacy-bag'),row('tool')],equipment),filtered=checklistContainers([row('tool')],equipment);
 assert.equal(full[0].container,true);assert.equal(full[0].children[0].row.equipment_id,'tool');assert.equal(full[0].key,filtered[0].key);
});
