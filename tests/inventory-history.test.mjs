import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import * as history from '../app/inventory-history.ts';

const dep='00000000-0000-4000-8000-100000000001', other='00000000-0000-4000-8000-100000000002';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration=fs.readFileSync('supabase/migrations/20260930030314_inventory_history_paging.sql','utf8');

test('real SQL pages all history, bounds summaries, preserves full reports and current work, and enforces tenant RLS',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(`create role authenticated; create role anon;
      create table inventory_checks(id uuid primary key,department_id uuid,apparatus_id uuid,status text,check_type text,started_at timestamptz,started_by text,completed_at timestamptz,review_status text);
      create table inventory_apparatus_profiles(id uuid primary key,department_id uuid,name text);
      create table inventory_compartments(id uuid primary key,department_id uuid,label text,sort_order int);
      create table inventory_equipment(id uuid primary key,department_id uuid,compartment_id uuid,name text,item_order int);
      create table inventory_check_items(id uuid primary key,department_id uuid,check_id uuid,equipment_id uuid,result text,notes text,numeric_reading numeric);
      create table inventory_scba_check_entries(id uuid primary key,department_id uuid,check_id uuid,result text,section text,label text,sort_order int,psi int);
      insert into inventory_apparatus_profiles values('${id(8000)}','${dep}','TEST Engine');
      insert into inventory_compartments values('${id(8001)}','${dep}','TEST Cabinet',1);
      insert into inventory_equipment values('${id(8002)}','${dep}','${id(8001)}','TEST retained asset',1);
      insert into inventory_checks select ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'${dep}','${id(8000)}','completed',case when g%4=0 then 'air_pack' else 'daily' end,'2015-01-01T12:00:00Z','TEST crew','2015-01-01T13:00:00Z',case when g%2=0 then 'pending' else 'approved' end from generate_series(1,75) g;
      insert into inventory_checks values
        ('${id(1001)}','${dep}','${id(8000)}','in_progress','inventory','2010-01-01','TEST crew',null,'pending'),
        ('${id(1002)}','${dep}','${id(8000)}','completed','daily','2010-01-01','TEST crew',now(),'approved'),
        ('${id(9999)}','${other}','${id(8000)}','completed','daily',now(),'OTHER crew',now(),'approved');
      insert into inventory_check_items select gen_random_uuid(),'${dep}','${id(1)}','${id(8002)}',case when g=1 then 'failed' else 'pass' end,'TEST note',g from generate_series(1,1005) g;
      insert into inventory_check_items values(gen_random_uuid(),'${dep}','${id(1001)}','${id(8002)}','pending',null,null), (gen_random_uuid(),'${other}','${id(1)}','${id(8002)}','failed','FORBIDDEN',null);
      insert into inventory_scba_check_entries values(gen_random_uuid(),'${dep}','${id(4)}','pass','pack','TEST Pack',1,4500), (gen_random_uuid(),'${dep}','${id(4)}','failed','rit','TEST RIT',2,0);`);
    await pg.exec(`alter table inventory_scba_check_entries add column equipment_id uuid; update inventory_scba_check_entries set equipment_id='${id(8002)}';`);
    await pg.exec(migration);
    for(const table of ['inventory_checks','inventory_check_items','inventory_scba_check_entries','inventory_equipment','inventory_compartments','inventory_apparatus_profiles']) await pg.exec(`alter table ${table} enable row level security; create policy tenant_read on ${table} for select to authenticated using(department_id='${dep}'::uuid); grant select on ${table} to authenticated;`);
    await pg.exec('grant usage on schema public to authenticated; set role authenticated');
    const page=async(params={})=>(await pg.query('select inventory_check_history_page($1,$2,$3,$4,$5,$6,$7,$8) report',[dep,params.apparatus||null,params.type||null,params.review||null,params.from||null,params.to||null,params.time||null,params.id||null])).rows.map(r=>r.report);
    const seen=[],sizes=[];let cursor={};
    do { const result=history.historyPage(await page(cursor));sizes.push(result.reports.length);seen.push(...result.reports.map(r=>r.id));cursor=result.nextCursor?{time:result.nextCursor.split('|')[0],id:result.nextCursor.split('|')[1]}:null; } while(cursor);
    assert.deepEqual(sizes,[25,25,25,1]);assert.equal(new Set(seen).size,76);assert.ok(!seen.includes(id(9999)));
    const firstPage=history.historyPage(await page());
    await pg.exec('reset role');
    await pg.query("insert into inventory_checks values($1,$2,$3,'completed','daily',now(),'TEST new crew',now(),'approved')",[id(300),dep,id(8000)]);
    await pg.exec('set role authenticated');
    const nextArgs=history.historyParameters(new URLSearchParams({cursor:firstPage.nextCursor}));
    assert.deepEqual(history.historyPage(await page({time:nextArgs.p_before_time,id:nextArgs.p_before_id})).reports.map(r=>r.id),seen.slice(25,50),'A new report must not repeat or skip the next page');
    const air=await page({type:'air_pack'});assert.ok(air.every(r=>r.check_type==='air_pack'));assert.equal(air.find(r=>r.id===id(4)).item_count,2);assert.equal(air.find(r=>r.id===id(4)).issue_count,1);
    assert.ok((await page({review:'pending'})).every(r=>r.review_status==='pending'));
    assert.deepEqual(await page({from:'2016-01-01',to:'2016-01-02'}),[]);
    assert.deepEqual(await page({apparatus:id(8888)}),[]);
    const detail=async(report,department=dep)=>(await pg.query('select inventory_check_report($1,$2) report',[department,report])).rows[0].report;
    const report=await detail(id(1));assert.equal(report.items.length,1005);assert.ok(report.items.every(i=>i.equipment_name==='TEST retained asset'&&i.compartment_label==='TEST Cabinet'));assert.ok(!JSON.stringify(report).includes('FORBIDDEN'));
    const airReport=await detail(id(4));assert.equal(airReport.items[1].numeric_reading,0);assert.equal(airReport.items[1].compartment_label,'R.I.T. bag');
    assert.equal((await pg.query('select inventory_air_check_history($1,$2) entry',[dep,id(8002)])).rows.length,2);
    assert.equal((await pg.query('select inventory_air_check_history($1,$2) entry',[other,id(8002)])).rows.length,0);
    assert.equal(await detail(id(9999),other),null);assert.equal(await detail(id(1001)),null);
    const live=(await pg.query('select inventory_live_check_packet($1) packet',[dep])).rows[0].packet;
    assert.deepEqual(live.checks.map(c=>c.id).sort(),[id(300),id(1001),id(1002)]);assert.equal(live.checkItems.length,1);assert.equal(live.checkItems[0].result,'pending');assert.equal(live.scbaEntries.length,0);
    assert.deepEqual((await pg.query('select inventory_live_check_packet($1) packet',[other])).rows[0].packet,{checks:[],checkItems:[],scbaEntries:[]});
    // Completion-day filtering follows Chicago, including the 23-hour spring DST day.
    await pg.exec('reset role');
    for(const [n,time] of [[201,'2026-03-08T05:59:59Z'],[202,'2026-03-08T06:00:00Z'],[203,'2026-03-09T04:59:59Z'],[204,'2026-03-09T05:00:00Z']]) await pg.query("insert into inventory_checks values($1,$2,$3,'completed','weekly',$4,'TEST crew',$4,'approved')",[id(n),dep,id(8000),time]);
    await pg.exec('set role authenticated');assert.deepEqual((await page({from:'2026-03-08',to:'2026-03-08'})).map(r=>r.id),[id(203),id(202)]);
    await pg.exec('reset role');
    assert.ok((await pg.query("select prosecdef from pg_proc where proname in ('inventory_live_check_packet','inventory_check_report','inventory_check_history_page')")).rows.every(r=>r.prosecdef===false));
    await pg.exec('set role anon');await assert.rejects(pg.query('select inventory_check_report($1,$2)',[dep,id(1)]),/permission denied/);
  } finally { await pg.close(); }
});

test('history route validates cursors/filters, scopes every query, and never masks denial or failed reads',async()=>{
  for(const query of ['from=2026-02-30','from=2026-02-02&to=2026-01-01','cursor=broken','type=garbage','review=garbage','apparatus=foreign-string']) assert.throws(()=>history.historyParameters(new URLSearchParams(query)));
  const rows=Array.from({length:26},(_,n)=>({id:id(n+1),started_at:'2026-09-01T12:00:00.123456+00:00'}));
  const paged=history.historyPage(rows);assert.equal(paged.reports.length,25);assert.equal(history.historyParameters(new URLSearchParams({cursor:paged.nextCursor})).p_before_time,rows[0].started_at);
  const state={allowed:true,error:null,data:rows,calls:[]};
  const imports={
    '../../../inventory-history':history,
    '../../../lib/supabase-server':{createInventorySupabaseClient:async()=>({rpc:async(name,args)=>{state.calls.push({name,args});return{data:state.data,error:state.error};}})},
    '../../../lib/inventory-session':{verifyInventoryRequest:async()=>({ok:state.allowed,context:{department:{id:dep}}}),sessionFailureResponse:()=>Response.json({error:'Denied'},{status:403})},
  };
  const compiled=ts.transpileModule(fs.readFileSync('app/api/operations/history/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};new Function('require','exports',compiled)(key=>{assert.ok(imports[key],key);return imports[key];},exports);
  const get=query=>exports.GET(new Request('https://fixture.invalid/api/operations/history?'+query));
  const first=await get('');assert.equal((await first.json()).reports.length,25);assert.match(first.headers.get('cache-control'),/private, no-store/);assert.equal(state.calls[0].args.p_department,dep);
  assert.equal((await get('asset='+id(8002))).status,200);assert.equal(state.calls.at(-1).name,'inventory_air_check_history');assert.equal(state.calls.at(-1).args.p_equipment,id(8002));assert.equal(state.calls.at(-1).args.p_department,dep);
  assert.equal((await get('asset=bad')).status,400);
  state.data=null;assert.equal((await get('check='+id(1))).status,404);assert.equal(state.calls.at(-1).name,'inventory_check_report');
  assert.equal((await get('check=bad')).status,400);
  state.error='Database unavailable';assert.equal((await get('')).status,503);
  state.allowed=false;const count=state.calls.length;assert.equal((await get('')).status,403);assert.equal(state.calls.length,count);
});
