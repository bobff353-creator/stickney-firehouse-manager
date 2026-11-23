import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hydrantActivitySchema,applyHydrantActivity} from '../app/arrival/lib/hydrant-activity.ts';
import {chicagoDate} from '../app/arrival/lib/preplan.ts';
const entry=(kind='maintenance')=>({id:crypto.randomUUID(),revision:1,kind,performedOn:chicagoDate(),notes:'Packing nut inspected',status:'',flowGpm:kind==='flow'?1000:null});
test('hydrant service requires real work details, a valid date and a positive recorded flow',()=>{
 assert.ok(hydrantActivitySchema.safeParse(entry()).success);
 assert.equal(hydrantActivitySchema.safeParse({...entry(),notes:' '}).success,false);
 assert.equal(hydrantActivitySchema.safeParse({...entry('flow'),flowGpm:0}).success,false);
 assert.equal(hydrantActivitySchema.safeParse({...entry('flow'),performedOn:'2026-02-30'}).success,false);
 assert.equal(hydrantActivitySchema.safeParse({...entry('flushing'),performedOn:'2999-01-01'}).success,false);
});
test('recording flushing preserves an out-of-service status and existing flow reading',()=>{
 const original={status:'Out of service',reportedFlow:800,notes:'Original note'};const next=applyHydrantActivity(original,entry('flushing'));
 assert.equal(next.status,'Out of service');assert.equal(next.reportedFlow,800);assert.equal(next.lastFlushed,chicagoDate());assert.equal(original.lastFlushed,undefined);
});
test('historical work does not replace a newer flow or reopen an out-of-service hydrant',()=>{
 const original={status:'Out of service',statusUpdatedOn:chicagoDate(),reportedFlow:1250,flowTestDate:chicagoDate()};const next=applyHydrantActivity(original,{...entry('flow'),performedOn:'2020-01-01',flowGpm:700,status:'In service'});
 assert.equal(next.status,'Out of service');assert.equal(next.reportedFlow,1250);assert.equal(next.flowTestDate,chicagoDate());
});
test('an explicit current status update and flow reading change only the intended current fields',()=>{
 const original={status:'Out of service',reportedFlow:800,number:'27',address:'200 Test Way',notes:'Maintenance note',flowSourceDate:'2022-01-01'};const next=applyHydrantActivity(original,{...entry('flow'),flowGpm:1250.5,status:'In service'});
 assert.equal(next.status,'In service');assert.equal(next.reportedFlow,1250.5);assert.equal(next.flowTestDate,chicagoDate());assert.equal(next.flowSourceDate,'2022-01-01');assert.equal(next.notes,original.notes);
});
