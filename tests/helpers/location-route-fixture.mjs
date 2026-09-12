import './location-route-loader.mjs';
import {locationTestDatabase,department,user} from './apparatus-location-db.mjs';
export async function locationRouteFixture(){
 const pg=await locationTestDatabase();
 await pg.exec(`SET search_path=firehouse,public;
 CREATE TABLE firehouse.employees(id text,name text,active int,pay_scale_id text);
 CREATE TABLE firehouse.pay_scales(id text,label text);
 CREATE TABLE firehouse.employee_profiles(employee_id text,email text,is_admin int,end_date text);
 CREATE TABLE firehouse.rank_permissions(rank text,permission_key text,allowed int);
 CREATE TABLE firehouse.employee_permission_overrides(employee_id text,permission_key text,effect text);
 INSERT INTO firehouse.pay_scales VALUES('chief','Chief'),('ff','Firefighter');
 INSERT INTO firehouse.employees VALUES('admin','Fixture Admin',1,'chief'),('member','Fixture Member',1,'ff');
 INSERT INTO firehouse.employee_profiles VALUES('admin','admin@fixture.invalid',0,null),('member','member@fixture.invalid',0,null);`);
 const counters={queries:0,requests:0};
 globalThis.__locationFixtureSupabase={async rpc(name,args){counters.queries++;try{
  // Match the CURRENT production RPC's SQL result wrapping, not just pg.query.
  // In particular this rejects INSERT ... RETURNING inside a read subquery.
  if(args.p_mode==='first'){const result=await pg.query('SELECT to_jsonb(portal_row) value FROM ('+args.p_sql+') AS portal_row LIMIT 1');return{data:result.rows[0]?.value??null,error:null};}
  if(args.p_mode==='all'){const result=await pg.query("SELECT COALESCE(jsonb_agg(to_jsonb(portal_row)), '[]'::jsonb) value FROM ("+args.p_sql+') AS portal_row');return{data:result.rows[0].value,error:null};}
  const result=await pg.query(args.p_sql);return{data:{success:true,meta:{changes:result.affectedRows}},error:null};
 }catch(error){return{data:null,error:{message:error.message}};}}};
 process.env.PAYROLL_DEPARTMENT_ID=department;
 process.env.FIREHOUSE_DATABASE_SECRET='local-test-only-not-a-production-credential';
 const routes=await import('../../app/api/apparatus-locations/route.ts'),ingest=await import('../../app/api/apparatus-locations/ingest/route.ts');
 function request(path='/api/apparatus-locations',body,extra={}){return new Request('https://stickney-firehouse-manager.vercel.app'+path,{method:body===undefined?'GET':'POST',headers:{origin:'https://stickney-firehouse-manager.vercel.app','Content-Type':'application/json','x-department-id':department,'x-authenticated-user-id':user,'oai-authenticated-user-email':'admin@fixture.invalid',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 return{pg,routes,ingest,request,counters};
}
