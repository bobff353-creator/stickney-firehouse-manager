import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { compile } from './helpers/board-links-harness.mjs';
const model = compile('app/schedule-safety.ts', { './schedule-time.ts': compile('app/schedule-time.ts', {}) });
async function fixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA firehouse; SET search_path=firehouse;
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE system_meta(key text PRIMARY KEY,value text,updated_at text);
    CREATE TABLE record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
    CREATE TABLE employees(id text PRIMARY KEY,name text,pay_scale_id text,active int);
    CREATE TABLE pay_scales(id text PRIMARY KEY,label text);
    CREATE TABLE employee_profiles(employee_id text PRIMARY KEY,email text,is_admin int,station_roles text,driver_status text,single_role int,acting_officer_eligible int);
    INSERT INTO employees VALUES('local-fixture','Fictional Test Member','ff',1); INSERT INTO pay_scales VALUES('ff','Firefighter');
    INSERT INTO employee_profiles VALUES('local-fixture','fixture@example.invalid',0,'[]','',0,0);
    CREATE FUNCTION employee_id_for_login(email text) RETURNS text LANGUAGE sql AS $$ SELECT 'local-fixture'::text $$;
    CREATE FUNCTION public.firehouse_sql(p_sql text,p_mode text,p_secret text) RETURNS jsonb LANGUAGE plpgsql SET search_path=firehouse,public AS $$
    DECLARE answer jsonb; count_rows bigint;
    BEGIN
      IF p_sql ~ '(;|--|/\\*|\\*/)' THEN RAISE EXCEPTION 'Unsafe query'; END IF;
      IF p_mode='run' THEN EXECUTE p_sql; GET DIAGNOSTICS count_rows=ROW_COUNT; RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',count_rows)); END IF;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM ('||p_sql||') x' INTO answer;
      IF p_mode='first' THEN RETURN answer->0; END IF; RETURN answer;
    END $$;`);
  await pg.exec(readFileSync(new URL('../supabase/migrations/20260908032620_portal_atomic_saves.sql',import.meta.url),'utf8').split('-- Finalization')[0]);
  let department='local-department-a';
  const departmentApi = { getPortalDepartment: async () => ({id:department,isolated:false}) };
  const store = compile('app/schedule-safety-store.ts', { './schedule-safety': model, './department-portal': departmentApi });
  const adapter = compile('db/postgres-adapter.ts', { '../app/supabase-server': {}, '../app/department-portal': departmentApi, './sql-literal': compile('db/sql-literal.ts', {}) });
  const state={failAudit:false};
  const db=adapter.createPostgresD1Adapter(async()=>({rpc:async(name,args)=>{
    try {
      let statements=args.p_statements;
      if(state.failAudit && statements) statements=statements.map(s=>s.sql.includes('INSERT INTO record_revisions')?{...s,sql:'INSERT INTO missing_audit VALUES(1)'}:s);
      const {rows}=await pg.query(statements ? `SELECT public.firehouse_sql_batch($1::jsonb,$2) AS result` : 'SELECT public.firehouse_sql($1,$2,$3) AS result', statements ? [JSON.stringify(statements),args.p_secret] : [args.p_sql,args.p_mode,args.p_secret]);
      return {data:rows[0].result,error:null};
    } catch(error) { return {data:null,error:{message:error.message}}; }
  }}));
  const permissions={hasAnyPermission:async()=>true,hasPermission:async request=>request.headers.get('x-role')==='admin'};
  const api = compile('app/api/station-scheduler/route.ts', {
    '../../server-permissions': permissions, '../../staffing-eligibility': compile('app/staffing-eligibility.ts',{}),
    '../../scheduler-reminders':{}, '../../scheduler-push-worker':{scheduleSchedulerPushDelivery:()=>{}}, '../../cad-push':{}, '../../scheduler-member-view':{},
    '../../../db/bootstrap':{ensureDatabase:async()=>db}, '../../schedule-time':{}, '../../station-distribution':{}, '../../station-scheduler-logic':{},
    '../../schedule-safety':model, '../../schedule-safety-store':store,
  });
  return {pg,db,store,state,setDepartment:value=>{department=value;},request:async(body,role='admin')=>api.POST(new Request('http://localhost/api/station-scheduler',{method:'POST',headers:{'content-type':'application/json','x-role':role,'oai-authenticated-user-email':'fixture@example.invalid'},body:JSON.stringify(body)}))};
}
const draft={minimumRestHours:8,maximumContinuousHours:24};
test('real settings and audit save together, repeat no-op is stable, and keys stay department scoped',async()=>{
  const h=await fixture();try{
    assert.deepEqual((await h.store.readScheduleSafety(h.db)).rules,model.emptyScheduleSafetyRules());
    const r=await h.request({action:'saveScheduleSafety',revision:'',rules:draft}); assert.equal(r.status,200,await r.clone().text());
    const {saved}=await r.json(); assert.deepEqual(saved.rules,draft);
    assert.match(saved.revision,/^[0-9a-f-]{36}$/);
    await h.request({action:'saveScheduleSafety',revision:saved.revision,rules:draft});
    assert.equal((await h.pg.query('SELECT count(*) n FROM record_revisions')).rows[0].n,1);
    h.setDepartment('local-department-b'); assert.deepEqual((await h.store.readScheduleSafety(h.db)).rules,model.emptyScheduleSafetyRules());
    h.setDepartment('local-department-a'); assert.equal((await h.store.readScheduleSafety(h.db)).revision,saved.revision);
  }finally{await h.pg.close();}
});
test('unauthorized, invalid and stale actions cannot write settings or audit',async()=>{
  const h=await fixture();try{
    assert.equal((await h.request({action:'saveScheduleSafety',revision:'',rules:draft},'member')).status,403);
    for(const rules of [null,{}, {...draft,minimumRestHours:-1}]) assert.equal((await h.request({action:'saveScheduleSafety',revision:'',rules})).status,400);
    const first=await h.store.saveScheduleSafety(h.db,draft,'','Fixture');
    assert.equal((await h.request({action:'saveScheduleSafety',revision:'',rules:{...draft,minimumRestHours:12}})).status,409);
    assert.deepEqual((await h.store.readScheduleSafety(h.db)).rules,first.rules);
    assert.equal((await h.pg.query('SELECT count(*) n FROM record_revisions')).rows[0].n,1);
  }finally{await h.pg.close();}
});
test('failed audit rolls back settings and concurrent saves produce one winner',async()=>{
  const h=await fixture();try{
    h.state.failAudit=true; assert.equal((await h.request({action:'saveScheduleSafety',revision:'',rules:draft})).status,500);
    assert.equal((await h.pg.query('SELECT count(*) n FROM system_meta')).rows[0].n,0);
    h.state.failAudit=false;
    const results=await Promise.all([8,12].map(minimumRestHours=>h.request({action:'saveScheduleSafety',revision:'',rules:{...draft,minimumRestHours}})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await h.pg.query('SELECT count(*) n FROM record_revisions')).rows[0].n,1);
  }finally{await h.pg.close();}
});
