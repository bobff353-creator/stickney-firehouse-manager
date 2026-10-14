import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';import {trainingHarness} from './helpers/training-harness.mjs';
const {inspectionTasks,trainingTasks,repairTasks,taskDueState,chicagoQueueDate,sortQueue}=trainingModules()('app/task-queue-model.ts');
const names=new Map([['member-a','Fixture member A'],['member-b','Fixture member B']]);
const row=(id,kind,data)=>({id,kind,payload:JSON.stringify(data)});
test('dates are real calendar dates and department-day comparisons survive DST and UTC midnight',()=>{
  assert.equal(chicagoQueueDate(new Date('2026-10-14T02:00:00Z')),'2026-10-13');
  assert.equal(chicagoQueueDate(new Date('2026-11-01T06:30:00Z')),'2026-11-01');
  for(const [date,expected]of [['2026-10-12','Overdue'],['2026-10-13','Today'],['2026-11-12','Next 30 days'],['2026-11-13','Later'],['','Date needed'],['2026-02-30','Date needs review']])assert.equal(taskDueState({dueDate:date,invalidDate:false},'2026-10-13'),expected);
});
test('inspection queue keeps open observations, skips canceled/test/finished visits, and links the exact record',()=>{
  const tasks=inspectionTasks([row('visit','inspection',{title:'Fixture visit',status:'Scheduled',scheduledDate:'2026-10-13',team:{assignees:[{id:'member-a'}]}}),row('done','inspection',{status:'Completed',checks:[]}),row('test','inspection',{test:true,status:'Scheduled'}),row('canceled','inspection',{status:'Canceled'}),row('correction','inspection',{status:'Completed',checks:[{result:'Needs attention',dueDate:'2026-10-10'},{result:'Needs attention',dueDate:'2026-02-30'},{result:'Corrected on site',dueDate:'2026-01-01'}]})],names);
  assert.deepEqual(tasks.map(t=>t.id),['inspection:visit','inspection:correction']);assert.deepEqual(tasks[0].assignees,['Fixture member A']);
  assert.equal(new URL(tasks[0].href,'http://localhost').searchParams.get('inspectionRecord'),'visit');
  assert.equal(tasks[1].dueDate,'2026-10-10');assert.equal(taskDueState(tasks[1],'2026-10-13'),'Date needs review');
});
test('training completion only clears members linked by assignment ID, with test/draft completions excluded',()=>{
  const rows=[row('assignment','assignment',{status:'saved',employeeIds:['member-a','member-b']}),row('completion','completion',{status:'completed',assignmentId:'assignment',employeeIds:['member-a']}),row('test','completion',{status:'completed',test:true,assignmentId:'assignment',employeeIds:['member-b']}),row('draft','completion',{status:'draft',assignmentId:'assignment',employeeIds:['member-b']}),row('wrong','completion',{status:'completed',assignmentId:'another',employeeIds:['member-b']})];
  assert.deepEqual(trainingTasks(rows,names)[0].assignedIds,['member-b']);
  rows.push(row('last','completion',{status:'completed',assignmentId:'assignment',employeeIds:['member-b']}));assert.equal(trainingTasks(rows,names).length,0);
});
test('credential reminders retain undated records and exclude drafts/test data; links use the existing credentials tab',()=>{
  const tasks=trainingTasks([row('saved','credential',{status:'saved',title:'Fixture credential',employeeIds:['member-a'],dueDate:''}),row('draft','credential',{status:'draft'}),row('test','credential',{status:'saved',test:true})],names);
  assert.equal(tasks.length,1);assert.equal(taskDueState(tasks[0],'2026-10-13'),'Date needed');
  assert.equal(new URL(tasks[0].href,'http://localhost').searchParams.get('trainingTab'),'Credentials & task books');
  assert.throws(()=>trainingTasks([{id:'broken',kind:'assignment',payload:'null'}],names));
});
test('repairs preserve stable assignments and convert zoned due instants without inferring text-only assignees',()=>{
  const tasks=repairTasks([{id:'repair',status:'open',due_at:'2026-10-14T02:00:00Z',assigned_employee_ids:['member-a'],assigned_employee_names:['Fixture member A']},{id:'text',status:'open',due_at:'invalid',assigned_to:'Fixture contractor'},{id:'closed',status:'closed'}]);
  assert.equal(tasks.length,2);assert.equal(tasks[0].dueDate,'2026-10-13');assert.deepEqual(tasks[1].assignedIds,[]);assert.equal(tasks[1].invalidDate,true);
  assert.equal(new URL(tasks[0].href,'http://localhost').searchParams.get('workOrder'),'repair');
  assert.equal(repairTasks([{id:'bad-calendar',status:'open',due_at:'2026-02-30T12:00:00Z'}])[0].invalidDate,true);
  assert.deepEqual(sortQueue(tasks,'2026-10-13').map(t=>t.id),['repair:repair','repair:text']);
});
test('queue API preserves owner-only sources, verified inventory session, department isolation and explicit partial failures',async()=>{
  const h=await trainingHarness();try{
    await h.pg.exec(`CREATE TABLE employees(id text PRIMARY KEY,name text,active integer);INSERT INTO employees VALUES('member-a','Fixture member A',1);CREATE FUNCTION employee_id_for_login(text) RETURNS text LANGUAGE sql AS 'SELECT ''member-a''::text';`);
    for(const table of ['fire_inspection_pilot_records','training_pilot_records'])await h.pg.exec(`CREATE TABLE ${table}(id text PRIMARY KEY,department_id text,kind text,payload text,archived integer);`);
    for(const [id,dept,archived,testFlag]of [['own','fixture-department',0,false],['other','other-department',0,false],['archived','fixture-department',1,false],['test','fixture-department',0,true]])await h.pg.query('INSERT INTO training_pilot_records VALUES($1,$2,$3,$4,$5)',[id,dept,'assignment',JSON.stringify({status:'saved',test:testFlag,employeeIds:['member-a']}),archived]);
    let permissions=new Set(['dashboard.view']),inventoryOk=false;const queried=[];
    const load=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>({...h.db,prepare:sql=>{queried.push(sql);return h.db.prepare(sql);}})},[resolve('app/server-permissions.ts')]:{permissionsForEmail:async()=>permissions},[resolve('app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>inventoryOk?{ok:true,context:{department:{id:'other-department'},user:{email:'member@example.invalid'}}}:{ok:false}},[resolve('app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>{throw Error('A mismatched session must not reach inventory');}}});
    const api=load('app/api/task-queue/route.ts'),get=(email='member@example.invalid',dept='fixture-department')=>api.GET(new Request('http://localhost/api/task-queue',{headers:{'oai-authenticated-user-email':email,'x-department-id':dept}}));
    assert.equal((await api.GET(new Request('http://localhost/api/task-queue'))).status,401);
    const member=await(await get()).json();assert.deepEqual(member.items,[]);assert.equal(member.privateAccess,false);assert.ok(!queried.some(sql=>sql.includes('pilot_records')));
    const owner=await(await get('bobff353@gmail.com')).json();assert.deepEqual(owner.items.map(t=>t.id),['assignment:own']);assert.deepEqual(owner.viewerIds,['member-a','pilot-owner']);
    assert.deepEqual((await(await get('bobff353@gmail.com','other-department')).json()).items.map(t=>t.id),['assignment:other']);
    permissions.add('inventory.view');inventoryOk=true;const partial=await(await get()).json();assert.deepEqual(partial.sources,[{name:'Repairs',state:'unavailable'}]);assert.deepEqual(partial.items,[]);
    permissions=new Set();assert.equal((await get()).status,403);
    assert.equal(h.stats.writes,0);
  }finally{await h.close();}
});
