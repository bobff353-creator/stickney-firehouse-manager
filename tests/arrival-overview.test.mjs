import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankPlan} from '../app/arrival/lib/preplan.ts';
import {overviewItems,filterOverview,initialOverview,mapGroups} from '../app/arrival/lib/overview.ts';
import {hydrantNotes} from '../app/arrival/lib/hydrant-display.ts';
test('hydrant presentation removes transfer metadata while preserving maintenance and access facts',()=>{
 const metadata='Imported from FlowMSP on 2026-09-02; source export 2026-09-01. Needs field verification. FlowMSP source ID: 9536afad-b090-4730-acaf-1b61dce138eb. Original FlowMSP GPS coordinates retained; the provider-generated address is display-only. FlowMSP reported flow: 2500 GPM (BLUE). ';
 assert.equal(hydrantNotes(metadata),'');
 assert.equal(hydrantNotes(metadata+'On Ridgeland Ave by alley\n\nOperator nut leak, operator nut cap loose.\nOn Ridgeland Ave by alley\n\nOperator nut leak, operator nut cap loose.'),'On Ridgeland Ave by alley\nOperator nut leak, operator nut cap loose.');
 assert.equal(hydrantNotes('Not draining properly. Needs field verification.'),'Not draining properly. Needs field verification.');
});
test('map uses the published location and does not display incomplete coordinates as zero',()=>{
 const working={...blankPlan(),name:'Unapproved edit',latitude:'0',longitude:'0'},published={...blankPlan(),name:'Approved building',latitude:'41.82',longitude:'-87.77'};
 const record={id:'test',name:'Unapproved edit',address:'Test',working,published,status:'review'};
 const [item]=overviewItems([record],[]);assert.deepEqual(item.position,[41.82,-87.77]);assert.equal(item.name,'Approved building');assert.equal(item.status,'Published');
 assert.equal(overviewItems([{...record,published:null,working:{...working,latitude:'',longitude:''}}],[])[0].position,null);
 assert.equal(filterOverview([item],{...initialOverview,filter:'review'}).length,1);
});
test('wide-map groups preserve every record and keep out-of-service water and selected records individually reachable',()=>{
 const items=Array.from({length:5},(_,i)=>({id:String(i),position:[0,0],status:i===3?'Out of service':'Draft'}));const pixel=()=>({x:100,y:100});const groups=mapGroups(items,pixel,14,'4');assert.deepEqual(groups.map(g=>g.length).sort(),[1,1,3]);assert.equal(groups.flat().length,5);assert.ok(groups.some(g=>g.length===1&&g[0].id==='3'));assert.ok(groups.some(g=>g.length===1&&g[0].id==='4'));assert.equal(mapGroups(items,pixel,18,null).length,5);
});
test('map keeps separate campus outlines and exposes unmapped records in the list',()=>{
 const p={...blankPlan(),name:'Campus',latitude:'41.8',longitude:'-87.7',footprint:{rings:[[[-87.77,41.82],[-87.7698,41.82],[-87.7698,41.8202],[-87.77,41.8202]]]}};
 const items=overviewItems([{id:'one',working:p,published:null,status:'draft'},{id:'two',working:{...p,footprint:undefined,latitude:'',longitude:''},published:null,status:'draft'}],[{id:'water',number:'27',address:'Test',latitude:41.82,longitude:-87.77,status:'Out of service'}]);
 assert.ok(Math.abs(items[0].position[0]-41.8201)<1e-8);assert.equal(items[1].position,null);assert.equal(filterOverview(items,{...initialOverview,filter:'out'}).length,1);assert.equal(filterOverview(items,{...initialOverview,query:'Campus'}).length,2);assert.equal(filterOverview(items,{...initialOverview,buildings:false}).length,1);
});
