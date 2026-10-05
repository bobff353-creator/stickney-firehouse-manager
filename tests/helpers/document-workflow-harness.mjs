import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { compile } from './board-links-harness.mjs';
export async function documentHarness() {
  const pg=new PGlite();
  await pg.exec(`CREATE SCHEMA firehouse;SET search_path=firehouse;CREATE ROLE anon;CREATE ROLE authenticated;
    CREATE TABLE system_meta(key text PRIMARY KEY,value text NOT NULL,updated_at text);
    CREATE TABLE record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number integer,action text,summary text,actor text,changed_at text DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE policies(id text PRIMARY KEY,title text,policy_number text,category text,effective_date text,body text,status text,created_by text,created_at text DEFAULT CURRENT_TIMESTAMP,updated_by text,updated_at text);
    CREATE TABLE employees(id text PRIMARY KEY,name text,active integer);CREATE TABLE employee_profiles(employee_id text PRIMARY KEY,end_date text);
    INSERT INTO employees VALUES('fixture-a','Local Fixture A',1),('fixture-b','Local Fixture B',1),('inactive','Inactive Fixture',0);
    CREATE FUNCTION employee_id_for_login(p_email text) RETURNS text LANGUAGE sql AS $$ SELECT CASE p_email WHEN 'a@example.invalid' THEN 'fixture-a' WHEN 'b@example.invalid' THEN 'fixture-b' ELSE NULL END $$;
    INSERT INTO policies VALUES('legacy-policy','Original fixture policy','1','General','2026-01-01','Original text; show the retained source.','Active','Fixture',CURRENT_TIMESTAMP,'Fixture',CURRENT_TIMESTAMP);
    CREATE FUNCTION public.firehouse_sql(p_sql text,p_mode text,p_secret text) RETURNS jsonb LANGUAGE plpgsql SET search_path=firehouse,public AS $$
    DECLARE answer jsonb; affected bigint;
    BEGIN
      IF p_sql ~ '(;|--|/\\*|\\*/)' THEN RAISE EXCEPTION 'Unsafe query'; END IF;
      IF p_mode='run' THEN EXECUTE p_sql;GET DIAGNOSTICS affected=ROW_COUNT;RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',affected));END IF;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM ('||p_sql||') x' INTO answer;
      IF p_mode='first' THEN RETURN answer->0;END IF;RETURN answer;
    END $$;`);
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20260908032620_portal_atomic_saves.sql',import.meta.url),'utf8').split('-- Finalization')[0]);
  let department='fixture-department';
  const context={getPortalDepartment:async()=>({id:department,isolated:false})};
  const state={failAt:-1};
  const adapter=compile('db/postgres-adapter.ts',{'../app/supabase-server':{},'../app/department-portal':context,'./sql-literal':compile('db/sql-literal.ts',{})});
  const db=adapter.createPostgresD1Adapter(async()=>({rpc:async(_name,args)=>{
    try {
      let statements=args.p_statements;
      if(statements&&state.failAt>=0){statements=statements.map((s,index)=>index===state.failAt?{...s,sql:'INSERT INTO missing_audit VALUES(1)'}:s);state.failAt=-1;}
      const result=await pg.query(statements?'SELECT public.firehouse_sql_batch($1::jsonb,$2) answer':'SELECT public.firehouse_sql($1,$2,$3) answer',statements?[JSON.stringify(statements),args.p_secret]:[args.p_sql,args.p_mode,args.p_secret]);
      return {data:result.rows[0].answer,error:null};
    }catch(error){return {data:null,error:{message:error.message}};}
  }}));
  const model=compile('app/document-workflow.ts',{});
  const store=compile('app/document-workflow-store.ts',{'./department-portal':context,'./document-workflow':model});
  const permissions={hasPermission:async(request,_db,key)=>request.headers.get('x-role')==='admin'||key==='documents.view'&&request.headers.get('x-role')==='member'};
  const api=compile('app/api/document-workflow/route.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../server-permissions':permissions,'../../document-workflow-store':store});
  const resources=compile('app/api/resources/route.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../server-permissions':permissions,'../../document-workflow-store':store,'../../document-workflow':model});
  const request=(body,role='admin',email='a@example.invalid',origin='http://localhost')=>new Request('http://localhost/api/document-workflow?id=legacy-policy',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-role':role,'oai-authenticated-user-email':email,'x-department-id':department,origin},...(body?{body:JSON.stringify(body)}:{})});
  return {pg,db,model,store,api,resources,state,request,context,setDepartment:value=>{department=value;},close:()=>pg.close()};
}
