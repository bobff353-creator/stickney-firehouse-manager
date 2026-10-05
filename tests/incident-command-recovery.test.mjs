import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { trainingModules } from './helpers/training-modules.mjs';

const load = trainingModules();
const recovery = load('app/incident-command-recovery.ts');
const state = load('app/incident-command-state.ts');
const draft = () => ({ scope:'verified-scope', incidentId:'fixture-call', expectedRevision:0, requestId:crypto.randomUUID(), mutation:{action:'set-radio',radioChannel:'Fictional channel'}, queuedAt:new Date().toISOString() });

test('offline drafts retain the original incident and revision across reload, conflict and expiry', () => {
  const d=draft();
  assert.deepEqual(recovery.parseCommandDraft(JSON.stringify(d),d.scope),d);
  assert.equal(recovery.parseCommandDraft(JSON.stringify(d),'other-account'),null);
  assert.equal(recovery.parseCommandDraft('{bad',d.scope),null);
  assert.match(recovery.commandDraftReview(d,'another-call',0),/another incident/);
  assert.match(recovery.commandDraftReview(d,d.incidentId,1),/board has changed/);
  assert.match(recovery.commandDraftReview(d,d.incidentId,0,Date.now()+25*3600000),/24 hours/);
  assert.equal(recovery.commandDraftReview(d,d.incidentId,0),'');
});
test('timed and critical actions cannot become offline drafts or replay later', () => {
  for(const action of ['set-mayday','end-call','record-benchmark','confirm-par-unit','toggle-par','reset-par','set-par-interval','set-search']) {
    assert.equal(recovery.canDraftCommand({action}),false);
    assert.equal(recovery.parseCommandDraft(JSON.stringify({...draft(),mutation:{action}}),'verified-scope'),null);
  }
  assert.equal(recovery.canDraftCommand({action:'assign-unit'}),true);
});
test('a draft is removed only by an exact server receipt for its save', () => {
  const d=draft(),receipt={ok:true,incidentId:d.incidentId,requestId:d.requestId,savedRevision:1};
  assert.equal(recovery.commandSaveConfirmed(d,receipt),true);
  for(const patch of [{ok:false},{incidentId:'other'},{requestId:'other'},{savedRevision:2}]) assert.equal(recovery.commandSaveConfirmed(d,{...receipt,...patch}),false);
  assert.equal(recovery.commandSaveConfirmed(d,{ok:true}),false);
});
test('an expired PAR remains due when its state is normalized and resumed', () => {
  const s=state.emptyIncidentCommandState();s.par.remainingSeconds=0;
  assert.equal(state.normalizeIncidentCommandState(s).par.remainingSeconds,0);
  const r=state.reduceIncidentCommandState(s,{action:'toggle-par'},{actor:'Fictional officer',now:new Date().toISOString(),validPersonnel:new Set(),validUnits:new Set(),validLevels:new Set()});
  assert.equal(r.state.par.remainingSeconds,0);
});
test('Command Board navigation keeps only the selected incident and clears it when leaving', () => {
  const nav=load('app/portal-navigation.ts');
  const url=nav.portalPageUrl('/','?page=respond&incident=stale','Command Board',{incident:'fixture & call'});
  assert.equal(new URL(url,'http://localhost').searchParams.get('incident'),'fixture & call');
  assert.equal(new URL(nav.portalPageUrl('/',url.split('?')[1],'Dashboard'),'http://localhost').searchParams.has('incident'),false);
});

async function harness(){
  const pg=new PGlite();
  const schema=`
    CREATE TABLE dispatch_incidents(incident_id text primary key,call_type text,address text,city text,responding_units text,longitude float,latitude float,dispatched_at text,source_system text,received_at text,active bigint,cleared_at text);
    CREATE TABLE daily_log_calls(report_number text,call_type text,address text,responding_units text,log_date text,time_out text,time_in text,sort_order bigint);
    CREATE TABLE employees(id text primary key,name text,pay_scale_id text,active bigint);
    CREATE TABLE pay_scales(id text primary key,label text);
    CREATE TABLE employee_profiles(employee_id text);
    CREATE FUNCTION employee_id_for_login(text) RETURNS text LANGUAGE sql AS $$SELECT 'fixture-person'::text$$;
    CREATE TABLE field_preplans(id text,business_name text,address text,latitude float,longitude float,floor_count bigint,construction text,access_info text,knox_box text,alarm_system text,riser text,fdc text,sprinkler_system text,status text,updated_at text);
    CREATE TABLE incident_command_boards(incident_id text primary key,board_state text,revision bigint,updated_by text,updated_at text);
    CREATE TABLE incident_command_events(id text primary key,incident_id text,revision bigint,event_type text,summary text,actor text,event_payload text,created_at text,UNIQUE(incident_id,revision));
    INSERT INTO pay_scales VALUES('fixture-rank','Officer');INSERT INTO employees VALUES('fixture-person','Fictional Officer','fixture-rank',1);INSERT INTO employee_profiles VALUES('fixture-person');
    INSERT INTO dispatch_incidents VALUES('fixture-call','Fixture response','Fictional address','Test city','TEST1',null,null,'2020-01-01','CIS CAD','2020-01-01',1,null),('fixture-newer','Fixture response','New fictional address','Test city','TEST2',null,null,'2099-01-01','CIS CAD','2099-01-01',1,null);
  `;
  await pg.exec('CREATE SCHEMA firehouse; SET search_path=firehouse;'+schema+'CREATE SCHEMA other;SET search_path=other;'+schema+'SET search_path=firehouse;');
  let department={id:'fixture-department',isolated:false},permission=true,failEvent=false,beforeBatch=null;
  const overrides={ [resolve('app/supabase-server.ts')]:{}, [resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>department} };
  const db=trainingModules(overrides)('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>({rpc:async(name,args)=>{
    try{
      const tableSchema=args.p_department==='other-department'?'other':'firehouse';
      await pg.exec(`SET search_path=${tableSchema}`);
      if(name.endsWith('_batch')&&beforeBatch){const callback=beforeBatch;beforeBatch=null;await callback(pg);}
      const run=async(tx,s)=>{if(failEvent&&s.sql.includes('INSERT INTO incident_command_events')){failEvent=false;throw Error('Injected event failure');}const r=await tx.query(s.sql);if(s.requiredChanges!=null&&r.affectedRows!==s.requiredChanges)throw Error('SAVE_CONFLICT');return s.mode==='first'?r.rows[0]??null:s.mode==='all'?r.rows:{success:true,meta:{changes:r.affectedRows}};};
      return{data:name.endsWith('_batch')?await pg.transaction(async tx=>{const out=[];for(const s of args.p_statements)out.push(await run(tx,s));return out;}):await run(pg,{sql:args.p_sql,mode:args.p_mode}),error:null};
    }catch(e){return{data:null,error:{message:e.message}};}
  }}));
  const api=trainingModules({...overrides,[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>permission}})('app/api/incident-command/route.ts');
  const request=(body,person='officer@example.invalid')=>new Request('http://localhost/api/incident-command',{method:'POST',headers:{'oai-authenticated-user-email':person},body:JSON.stringify(body)});
  const body=()=>({incidentId:'fixture-call',expectedRevision:0,requestId:crypto.randomUUID(),mutation:{action:'set-radio',radioChannel:'Fictional channel'}});
  const get=(selected='')=>api.GET(new Request(`http://localhost/api/incident-command${selected?'?incident='+encodeURIComponent(selected):''}`,{headers:{'oai-authenticated-user-email':'officer@example.invalid'}}));
  return{pg,api,request,body,get,close:()=>pg.close(),permission(v){permission=v;},department(v){department=v;},fail(){failEvent=true;},race(cb){beforeBatch=cb;}};
}

test('verified incident selection stays on the chosen call and does not fall back when it clears',async()=>{const h=await harness();try{
  assert.equal((await(await h.get()).json()).incident.incidentId,'fixture-newer');
  const packet=await(await h.get('fixture-call')).json();assert.equal(packet.incident.incidentId,'fixture-call');assert.match(packet.connection.label,/not independently verified/);assert.equal(packet.connection.status,'stale');
  await h.pg.exec("UPDATE firehouse.dispatch_incidents SET active=0,cleared_at='fixture' WHERE incident_id='fixture-call'");
  assert.equal((await(await h.get('fixture-call')).json()).incident,null);
  assert.equal((await h.api.POST(h.request(h.body()))).status,409);
  assert.equal((await(await h.get("fixture-call' OR 1=1 --")).json()).incident,null);
}finally{await h.close();}});
test('lost-response retries confirm one event, while request reuse and receipt-only checks cannot write',async()=>{const h=await harness();try{
  const b=h.body(),r=await h.api.POST(h.request(b));assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).savedRevision,1);
  const retry=await h.api.POST(h.request(b));assert.equal(retry.status,200);assert.equal((await retry.json()).replayed,true);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,1);
  assert.equal((await h.api.POST(h.request({...b,mutation:{action:'set-radio',radioChannel:'Different'}}))).status,409);
  assert.equal((await h.api.POST(h.request({...h.body(),receiptOnly:true}))).status,409);
  assert.equal((await h.pg.query('SELECT revision FROM firehouse.incident_command_boards')).rows[0].revision,1);
  assert.equal((await h.api.POST(h.request(b,'other-officer@example.invalid'))).status,409);
}finally{await h.close();}});
test('concurrent initial creation and stale updates cannot produce orphan events or overwrite a board',async()=>{const h=await harness();try{
  h.race(pg=>pg.query('INSERT INTO firehouse.incident_command_boards VALUES($1,$2,1,$3,$4)',['fixture-call',JSON.stringify({...state.emptyIncidentCommandState(),revision:1,radioChannel:'Other device'}),'Other device','fixture']));
  assert.equal((await h.api.POST(h.request(h.body()))).status,409);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,0);
  const b={...h.body(),expectedRevision:1};
  h.race(pg=>pg.exec('UPDATE firehouse.incident_command_boards SET revision=2'));
  assert.equal((await h.api.POST(h.request(b))).status,409);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,0);
}finally{await h.close();}});
test('an incident clearing during save stops the entire transaction',async()=>{const h=await harness();try{
  h.race(pg=>pg.exec("UPDATE firehouse.dispatch_incidents SET active=0,cleared_at='fixture' WHERE incident_id='fixture-call'"));
  assert.equal((await h.api.POST(h.request(h.body()))).status,409);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_boards')).rows.length,0);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,0);
}finally{await h.close();}});
test('event failure rolls back board changes and leaves the same request safe to retry',async()=>{const h=await harness();try{
  const b=h.body();h.fail();assert.equal((await h.api.POST(h.request(b))).status,503);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_boards')).rows.length,0);
  assert.equal((await h.api.POST(h.request(b))).status,200);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,1);
}finally{await h.close();}});
test('closing an incident remains idempotent after it leaves the active-call list',async()=>{const h=await harness();try{
  const b={...h.body(),mutation:{action:'end-call',confirmation:'END INCIDENT'}};
  const r=await h.api.POST(h.request(b));assert.equal(r.status,200,await r.clone().text());
  assert.equal((await(await h.get('fixture-call')).json()).incident,null);
  const repeat=await h.api.POST(h.request({...b,receiptOnly:true}));assert.equal(repeat.status,200);assert.equal((await repeat.json()).replayed,true);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,1);
  assert.equal((await h.api.POST(h.request({...h.body(),expectedRevision:-1}))).status,400);
  assert.equal((await h.api.POST(h.request({...h.body(),requestId:'unsafe'}))).status,400);
}finally{await h.close();}});
test('permission and department scope protect both drafts and retry receipts',async()=>{const h=await harness();try{
  const b=h.body();const one=await(await h.get('fixture-call')).json();assert.equal((await h.api.POST(h.request(b))).status,200);
  h.permission(false);assert.equal((await h.api.POST(h.request(b))).status,403);assert.equal((await h.get()).status,403);
  h.permission(true);h.department({id:'other-department',isolated:true});const two=await(await h.get('fixture-call')).json();assert.notEqual(one.draftScope,two.draftScope);
  assert.equal((await h.api.POST(h.request(b))).status,200);
  assert.equal((await h.pg.query('SELECT * FROM firehouse.incident_command_events')).rows.length,1);
  assert.equal((await h.pg.query('SELECT * FROM other.incident_command_events')).rows.length,1);
}finally{await h.close();}});
