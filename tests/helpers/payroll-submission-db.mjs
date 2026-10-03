import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash, webcrypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { sqlLiteral } from '../../db/sql-literal.ts';
import { PGlite } from '@electric-sql/pglite';
import * as logic from '../../app/payroll-submission.ts';
import { ACTING_OFFICER_STIPEND_PER_HOUR, PAYROLL_PREMIUM_MULTIPLIER } from '../../app/payroll-calculation.ts';

const root = new URL('../../', import.meta.url);
function moduleFromFile(path, dependencies) {
  const source=fs.readFileSync(new URL(path,root),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
  const scope={exports:{},Error,Response,Request,URL,Date,JSON,Number,Buffer,crypto:webcrypto,...dependencies};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,scope);
  return scope.exports;
}
export async function payrollDatabaseFixture() {
  const pg=new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA firehouse;
    GRANT USAGE ON SCHEMA firehouse TO anon, authenticated;
    CREATE TABLE firehouse.employees(id text PRIMARY KEY,name text,pay_scale_id text,active int);
    CREATE TABLE firehouse.employee_profiles(employee_id text PRIMARY KEY,email text,is_admin int,is_dpw int);
    CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text,regular_rate numeric,overtime_rate numeric,holiday_rate numeric);
    CREATE TABLE firehouse.pay_rate_history(id text PRIMARY KEY,pay_scale_id text,effective_date text,regular_rate numeric,overtime_rate numeric,holiday_rate numeric);
    CREATE TABLE firehouse.payroll_settings(id int PRIMARY KEY,overtime_threshold numeric,dpw_multiplier numeric);
    CREATE TABLE firehouse.pay_periods(start_date text PRIMARY KEY,end_date text,status text);
    CREATE TABLE firehouse.time_entries(id text PRIMARY KEY,employee_id text,period_start text,work_date text,category text,hours numeric);
    CREATE TABLE firehouse.daily_logs(log_date text PRIMARY KEY,updated_by text,shift_notes text);
    CREATE TABLE firehouse.daily_log_staffing(id text PRIMARY KEY,log_date text,employee_id text,shift_key text,time_in text,time_out text);
    CREATE TABLE firehouse.daily_log_calls(id text PRIMARY KEY,log_date text);
    CREATE TABLE firehouse.daily_log_approvals(id text PRIMARY KEY,log_date text,shift_key text,sign_out_at text);
    CREATE TABLE firehouse.station_shift_types(id text PRIMARY KEY,start_time text,end_time text,active int DEFAULT 1);
    CREATE TABLE firehouse.station_schedule_entries(id text PRIMARY KEY,entry_date text,shift_type_id text);
    CREATE TABLE firehouse.station_shift_slots(id text PRIMARY KEY,entry_id text,employee_id text,role text,status text,start_time text,end_time text);
    CREATE TABLE firehouse.record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text);
    CREATE FUNCTION public.firehouse_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=firehouse AS $$
    DECLARE result jsonb; affected bigint;
    BEGIN
      IF p_secret IS DISTINCT FROM 'fictional-test-only' THEN RAISE EXCEPTION 'Denied'; END IF;
      IF length(p_sql)>200000 OR p_sql ~ '(;|--|/\\*|\\*/)' THEN RAISE EXCEPTION 'Unsafe portal query'; END IF;
      IF p_mode='run' THEN EXECUTE p_sql; GET DIAGNOSTICS affected=ROW_COUNT; RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',affected)); END IF;
      IF p_mode='first' THEN EXECUTE 'SELECT to_jsonb(r) FROM ('||p_sql||') r LIMIT 1' INTO result; RETURN result; END IF;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM ('||p_sql||') r' INTO result; RETURN result;
    END $$;
    CREATE FUNCTION public.firehouse_server_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.firehouse_sql(p_sql,p_mode,p_secret) $$;
  `);
  await pg.exec(fs.readFileSync(new URL('supabase/migrations/20260908032620_portal_atomic_saves.sql',root),'utf8'));
  await pg.exec(fs.readFileSync(new URL('supabase/migrations/20260927222152_payroll_early_submissions.sql',root),'utf8'));
  await pg.exec(`SET search_path=firehouse;
    INSERT INTO pay_scales VALUES('ff','Firefighter',20,30,30);
    INSERT INTO employees VALUES('a','Fictional Member A','ff',1),('b','Fictional Member B','ff',1);
    INSERT INTO employee_profiles VALUES('a','admin@example.test',1,0),('b','member@example.test',0,0);
    INSERT INTO payroll_settings VALUES(1,106,1.5);
    INSERT INTO pay_rate_history VALUES('rates','ff','2026-01-01',20,30,30);
    INSERT INTO pay_periods VALUES('2026-09-11','2026-09-25','draft');
    INSERT INTO time_entries VALUES('actual23','a','2026-09-11','2026-09-23','shift',6),('callback24','a','2026-09-11','2026-09-24','callback',2);
    INSERT INTO daily_logs(log_date,updated_by) SELECT d::date::text,'Test Officer' FROM generate_series('2026-09-11'::date,'2026-09-25'::date,interval '1 day') d;
    INSERT INTO daily_log_approvals SELECT log_date||s,log_date,s,'2026-09-26T12:00:00Z' FROM daily_logs CROSS JOIN unnest(ARRAY['morning','afternoon','overnight']) s;
    INSERT INTO station_shift_types(id,start_time,end_time) VALUES('morning','06:00','12:00');
    INSERT INTO station_schedule_entries VALUES('24','2026-09-24','morning'),('25','2026-09-25','morning');
    INSERT INTO station_shift_slots VALUES('slot24','24','a','Officer/AO','filled','',''),('slot25','25','a','Officer/AO','filled','','');
  `);
  const state={manager:true,failAudit:false,delayMs:0,loseResponse:false,beforeBatch:null};
  const adapter=moduleFromFile('db/postgres-adapter.ts',{getSupabaseServerClient:()=>{throw new Error('Live database forbidden in tests');},getPortalDepartment:async()=>({id:'fixture',isolated:false}),sqlLiteral});
  const client={async rpc(name,args){
    try {
      if(state.delayMs) await new Promise(r=>setTimeout(r,state.delayMs));
      const batch=name.endsWith('_batch');
      if(batch&&state.beforeBatch){const fn=state.beforeBatch;state.beforeBatch=null;await fn(pg);}
      let statements=args.p_statements;
      if(batch&&state.failAudit) statements=statements.map(s=>s.sql.includes('INSERT INTO record_revisions')?{...s,sql:'INSERT INTO missing_audit_table VALUES(1)'}:s);
      const {rows}=await pg.query(batch?`SELECT public.${name}($1::jsonb,$2) AS result`:`SELECT public.${name}($1,$2,$3) AS result`,batch?[JSON.stringify(statements),args.p_secret]:[args.p_sql,args.p_mode,args.p_secret]);
      if(batch&&state.loseResponse){state.loseResponse=false;throw new Error('Simulated lost response after commit');}
      return {data:rows[0].result,error:null};
    } catch(error){return {data:null,error};}
  }};
  const db=adapter.createPostgresD1Adapter(async()=>client,'firehouse_sql','fictional-test-only');
  const server=moduleFromFile('app/payroll-submission-server.ts',{...logic,createHash,gzipSync,gunzipSync,ACTING_OFFICER_STIPEND_PER_HOUR,PAYROLL_PREMIUM_MULTIPLIER});
  const api=moduleFromFile('app/api/payroll-submissions/route.ts',{...logic,...server,ensureDatabase:async()=>db,permissionsForEmail:async()=>new Set(state.manager?['payroll.manage']:['payroll.view_own'])});
  const request=(body,origin='https://fixture.test')=>new Request('https://fixture.test/api/payroll-submissions',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-email':'admin@example.test'},body:JSON.stringify(body)});
  return {pg,db,state,server,api,request,async post(body,origin){const response=await api.POST(request(body,origin));return {status:response.status,body:await response.json()};},async get(period='2026-09-11'){const response=await api.GET(new Request(`https://fixture.test/api/payroll-submissions?period=${period}`,{headers:{'oai-authenticated-user-email':'admin@example.test'}}));return {status:response.status,body:await response.json()};}};
}
