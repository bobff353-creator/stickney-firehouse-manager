import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
function load(path,deps={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(!(name in deps))throw Error(name);return deps[name];},m,m.exports);return m.exports;}
const {confirmationExemptRequest,parseConfirmationStatus}=load('../app/required-confirmation-policy.ts');
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
test('required confirmation is versioned, personal, durable and off by default',async t=>{
 const pg=new PGlite();
 try{
  await pg.exec(`CREATE SCHEMA firehouse;CREATE SCHEMA private;CREATE SCHEMA auth;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('fixture.user',true),'')::uuid $$;
   CREATE TABLE auth.users(id uuid,email text,deleted_at timestamptz,banned_until timestamptz);
   CREATE TABLE public.platform_owners(email text);
   CREATE TABLE public.department_memberships(department_id uuid,user_id uuid,status text);
   CREATE TABLE firehouse.employees(id text,active int);
   CREATE TABLE firehouse.employee_profiles(employee_id text,email text,is_admin int,end_date text);
   INSERT INTO auth.users VALUES('${user}','member@fixture.invalid',NULL,NULL),('${other}','other@fixture.invalid',NULL,NULL);
   INSERT INTO public.department_memberships SELECT '14a76771-4c24-481b-8def-e6cce005c17b',id,'active' FROM auth.users;
   INSERT INTO firehouse.employees VALUES('one',1),('two',1);
   INSERT INTO firehouse.employee_profiles VALUES('one','member@fixture.invalid',0,NULL),('two','other@fixture.invalid',0,NULL);
   SELECT set_config('fixture.user','${user}',false);`);
  await pg.exec(read('../supabase/migrations/20260912194856_required_member_confirmation.sql'));
  const status=async()=> (await pg.query('SELECT public.portal_confirmation_status() value')).rows[0].value;
  const save=async(version,message='Fictional message only',enabled=true)=> (await pg.query('SELECT firehouse.save_portal_confirmation($1) id',[Buffer.from(JSON.stringify({version,title:'Fixture confirmation',message,enabled,actor:'fixture-admin'})).toString('base64')])).rows[0].id;
  const confirm=(version,recipient=user)=>pg.query('SELECT firehouse.confirm_portal_message($1,$2)',[version,recipient]);
  assert.equal((await status()).required,false);
  let version;
  await t.test('enabling creates a required version; receipt is only recorded after confirmation',async()=>{
   version=await save(null);assert.equal((await status()).required,true);
   assert.equal((await pg.query('SELECT count(*) n FROM firehouse.portal_confirmation_receipts')).rows[0].n,0);
   await confirm(version);assert.equal((await status()).required,false);await confirm(version);
   assert.equal((await pg.query('SELECT count(*) n FROM firehouse.portal_confirmation_receipts')).rows[0].n,1);
  });
  await t.test('another member must confirm independently; cannot forge somebody else receipt',async()=>{
   await pg.query("SELECT set_config('fixture.user',$1,false)",[other]);assert.equal((await status()).required,true);await assert.rejects(confirm(version,user),/own message/);
   await confirm(version,other);assert.equal((await status()).required,false);await pg.query("SELECT set_config('fixture.user',$1,false)",[user]);
  });
  await t.test('no-op saves retain confirmations; edits invalidate old versions and reject stale editors',async()=>{
   assert.equal(await save(version),version);assert.equal((await status()).required,false);
   const old=version;version=await save(old,'Changed fictional message');assert.notEqual(version,old);assert.equal((await status()).required,true);
   await assert.rejects(confirm(old),/CONFLICT/);await assert.rejects(save(old,'stale editor'),/CONFLICT/);
   await confirm(version);assert.equal((await status()).required,false);
  });
  await t.test('failed transaction records neither message nor confirmation',async()=>{
   await pg.exec('BEGIN');const rolledBack=await save(version,'Unsaved message');await confirm(rolledBack);await pg.exec('ROLLBACK');assert.equal((await status()).version,version);assert.equal((await status()).required,false);
  });
  await t.test('disabling opens regular tools; re-enabling requires a fresh confirmation',async()=>{
   version=await save(version,'Changed fictional message',false);assert.equal((await status()).required,false);
   version=await save(version,'Changed fictional message',true);assert.equal((await status()).required,true);
  });
  await t.test('administrators can recover settings, but changing membership cannot bypass authentication',async()=>{
   await pg.exec('UPDATE firehouse.employee_profiles SET is_admin=1');assert.equal((await status()).exempt,true);assert.equal((await status()).required,false);
   await pg.exec("UPDATE public.department_memberships SET status='inactive'");await assert.rejects(status(),/Department access/);
   await pg.exec("UPDATE public.department_memberships SET status='active'; UPDATE auth.users SET banned_until=now()+interval '1 day'");await assert.rejects(status(),/Current account/);
   await pg.exec("UPDATE auth.users SET banned_until=NULL; SELECT set_config('fixture.user','',false)");await assert.rejects(status(),/Sign in/);
  });
  await t.test('exposed status is read-only and no raw messages/receipts are granted',async()=>{
   await pg.exec(`GRANT USAGE ON SCHEMA private TO authenticated; SELECT set_config('fixture.user','${user}',false); SET ROLE authenticated;`);
   assert.equal((await status()).exempt,true);
   await assert.rejects(pg.query('SELECT * FROM firehouse.portal_confirmation_receipts'),/permission denied/);
   await pg.exec('RESET ROLE');
   assert.equal((await pg.query("SELECT has_function_privilege('anon','public.portal_confirmation_status()','EXECUTE') allowed")).rows[0].allowed,false);
   assert.equal((await pg.query("SELECT has_function_privilege('authenticated','firehouse.save_portal_confirmation(text)','EXECUTE') allowed")).rows[0].allowed,false);
   assert.equal((await pg.query("SELECT has_table_privilege('authenticated','firehouse.portal_confirmation_receipts','SELECT') allowed")).rows[0].allowed,false);
  });
 }finally{await pg.close();}
});
test('regular tools cannot escape the gate, while live call dependencies stay available',()=>{
 for(const path of ['/api/respond','/api/respond/street-view','/api/field-preplans/operational','/api/field-preplans/assets/fixture','/api/apparatus-locations','/api/dashboard?scope=live-operations','/api/suite-context?scope=live-operations','/api/daily-duties?scope=live-operations','/api/permissions?scope=viewer'])assert.equal(confirmationExemptRequest(new URL(path,'https://fixture.invalid'),'GET'),true,path);
 for(const path of ['/api/payroll','/api/station-scheduler','/api/operations','/api/permissions','/api/dashboard','/api/suite-context','/api/auth/invites'])for(const method of ['GET','POST','PUT'])assert.equal(confirmationExemptRequest(new URL(path,'https://fixture.invalid'),method),false,path+method);
 assert.equal(confirmationExemptRequest(new URL('https://fixture.invalid/api/dashboard?scope=live-operations'),'POST'),false);
 assert.equal(parseConfirmationStatus('false'),null);assert.equal(parseConfirmationStatus('{"required":false}'),null);
});
test('confirmation handlers require permission, explicit consent and trusted identity',async()=>{
 let writes=0,allowed=false,lastArgs=[];
 const db={prepare(){const statement={bind(...args){lastArgs=args;return statement;},first:async()=>{writes++;return {version:user};}};return statement;}};
 const api=load('../app/api/required-confirmation/route.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../server-permissions':{hasPermission:async()=>allowed}});
 const request=(method,body,identity=user)=>new Request('https://fixture.invalid/api/required-confirmation',{method,headers:{'Content-Type':'application/json',...(identity?{'x-authenticated-user-id':identity}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api.PUT(request('PUT',{enabled:true}))).status,403);assert.equal(writes,0);allowed=true;
 assert.equal((await api.PUT(request('PUT',{enabled:true,title:'x',message:''}))).status,400);
 assert.equal((await api.POST(request('POST',{version:user,confirmed:false}))).status,400);assert.equal(writes,0);
 assert.equal((await api.POST(request('POST',{version:user,confirmed:true,userId:other}))).status,200);assert.deepEqual(lastArgs,[user,user]);
 assert.equal((await api.POST(request('POST',{version:user,confirmed:true},''))).status,401);
});
