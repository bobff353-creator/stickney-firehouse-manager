import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { departmentToday, employmentStatus } from '../app/employment-status.ts';
import { accountStatus } from '../app/employee-account-status.ts';
import { preplanJobHealth } from '../app/background-job-health.ts';
import { releaseIdentity } from '../app/system-health-model.ts';
const now=new Date('2026-09-29T19:00:00Z');
test('current-staff status respects inclusive start/end dates and Chicago midnight',()=>{
 assert.equal(departmentToday(new Date('2026-09-30T03:00:00Z')),'2026-09-29');
 for(const [employee,status] of [[{active:0},'Ended'],[{endDate:'2026-09-28'},'Ended'],[{endDate:'2026-09-29'},'Active'],[{startDate:'2026-09-30'},'Scheduled'],[{startDate:'2026-09-29'},'Active'],[{},'Active']])assert.equal(employmentStatus(employee,'2026-09-29'),status);
});
test('job status never mistakes failed, stale or unfinished runs for successful checks',()=>{
 assert.equal(preplanJobHealth(null,now).state,'unavailable');
 assert.equal(preplanJobHealth({status:'succeeded',startedAt:now.toISOString(),finishedAt:null,summary:null},now).state,'warning');
 for(const run of [{status:'failed',finishedAt:now.toISOString()},{status:'running',startedAt:now.toISOString()},{status:'succeeded',finishedAt:'2026-09-27T01:00:00Z'},{status:'succeeded',finishedAt:'invalid'}])assert.equal(preplanJobHealth(run,now).state,'warning');
 assert.equal(preplanJobHealth({status:'succeeded',startedAt:now.toISOString(),finishedAt:now.toISOString(),summary:'0 expired'},now).state,'healthy');
});
test('account setup distinguishes invitation, activation and verified personnel link',()=>{
 const e={id:'member',email:'member@example.invalid'},s={accounts:[],invites:[]};
 assert.equal(accountStatus(e,null).label,'Not checked');assert.equal(accountStatus(e,s).label,'Not invited');
 s.invites.push({email:e.email,status:'pending',expiresAt:'2026-10-01T00:00:00Z'});assert.equal(accountStatus(e,s,+now).label,'Invited');assert.equal(accountStatus(e,s,+new Date('2026-10-02')).label,'Invite expired');
 s.accounts.push({id:'account',email:e.email,verified:true,activated:false,employeeId:'member'});assert.equal(accountStatus(e,s).label,'Finish activation');s.accounts[0].activated=true;assert.equal(accountStatus(e,s).label,'Linked');s.accounts[0].employeeId=null;assert.equal(accountStatus(e,s).label,'Activated');
});
test('built release takes precedence over a stale runtime SHA',()=>{
 assert.equal(releaseIdentity({APP_BUILD_SHA:'b'.repeat(40),APP_RELEASE_SHA:'a'.repeat(40),APP_BUILT_AT:now.toISOString()}).commit,'b'.repeat(12));assert.equal(releaseIdentity({APP_BUILT_AT:'bad'}).builtAt,null);
});
function route(file,deps){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in deps,name);return deps[name]},m,m.exports);return m.exports;}
test('cron rejects missing/wrong authorization before using the background database, and records failure',async()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='fixture-secret';let opens=0,writes=[];let fail=false;
 const db={prepare:q=>({bind:(...v)=>({run:async()=>{writes.push([q,v])}})})};
 const api=route('../app/api/cron/daily-refresh/route.ts',{'../../../background-database':{backgroundDatabase:()=>{opens++;return db}},'../../../preplans/expiration-evaluator':{evaluatePreplanExpirations:async()=>{if(fail)throw Error('fixture outage');return{expired:[],upcoming:[],invalid:[],reviewCount:0}}}});
 try{for(const token of ['', 'wrong'])assert.equal((await api.GET(new Request('https://fixture.invalid',{headers:{authorization:'Bearer '+token}}))).status,401);assert.equal(opens,0);
 assert.equal((await api.GET(new Request('https://fixture.invalid',{headers:{authorization:'Bearer fixture-secret'}}))).status,200);assert.ok(writes.some(([q])=>q.includes("status='succeeded'")));
 fail=true;assert.equal((await api.GET(new Request('https://fixture.invalid',{headers:{authorization:'Bearer fixture-secret'}}))).status,503);assert.ok(writes.some(([q])=>q.includes("status='failed'")));
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
test('device test cannot broadcast or target another account subscription',async()=>{
 let sent=[],bound=[],owned=true;
 const db={prepare:q=>({bind:(...v)=>{bound.push(v);return{first:async()=>owned?{id:'device',endpoint:v[0],p256dh:'key',auth:'auth'}:null,run:async()=>({})}}})};
 const api=route('../app/api/push/test/route.ts',{'../../../../db/bootstrap':{ensureDatabase:async()=>db},'../../../cad-push':{webPushPublicConfig:()=>({configured:true}),deliverSchedulerPush:async(s,p)=>sent.push([s,p])},'../../../lib/inventory-session':{verifyPushRequest:async()=>({ok:true,context:{user:{id:'account'},department:{id:'department'}}}),sameOriginInventoryRequest:()=>true,sessionFailureResponse:()=>null},'../../../push-subscription-security':{trustedPushEndpoint:e=>e==='https://push.example.invalid/device'}});
 const req=body=>new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await api.POST(req({}))).status,400);assert.equal(sent.length,0);
 assert.equal((await api.POST(req({endpoint:'https://push.example.invalid/device'}))).status,200);assert.deepEqual(bound[0],['https://push.example.invalid/device','account','department']);assert.equal(sent.length,1);assert.match(sent[0][1].url,/page=home/);
 owned=false;assert.equal((await api.POST(req({endpoint:'https://push.example.invalid/device'}))).status,409);assert.equal(sent.length,1);
});
test('database account linking preserves emails and fails closed for ambiguous or ended employees',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA private;CREATE SCHEMA firehouse;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,last_sign_in_at timestamptz);
 CREATE TABLE public.departments(id uuid,slug text);CREATE TABLE public.department_memberships(user_id uuid,department_id uuid,status text);CREATE TABLE public.portal_pin_credentials(user_id uuid);CREATE TABLE public.department_invites(email text,status text,expires_at timestamptz,department_id uuid);
 CREATE TABLE firehouse.employees(id text PRIMARY KEY,active int);CREATE TABLE firehouse.employee_profiles(employee_id text,email text,start_date text,end_date text);
 CREATE FUNCTION private.portal_has_permission(text) RETURNS boolean LANGUAGE plpgsql AS $$DECLARE n int; BEGIN SELECT count(*) INTO n FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON e.id=ep.employee_id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email; SELECT count(*) INTO n FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON e.id=ep.employee_id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;RETURN false;END $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT null::uuid$$;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
 CREATE FUNCTION public.current_department_ids() RETURNS SETOF uuid LANGUAGE sql AS $$SELECT null::uuid$$;CREATE FUNCTION public.can_manage_department(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE TABLE public.portal_access_emails(email text);ALTER TABLE public.portal_access_emails ENABLE ROW LEVEL SECURITY;CREATE POLICY "Invited portal users can read their own approval" ON public.portal_access_emails USING(true);
 CREATE TABLE public.push_subscriptions(user_id uuid,department_id uuid);ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can add their own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK(true);CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions FOR DELETE USING(true);CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions FOR UPDATE USING(true);CREATE POLICY "Users can view department push subscriptions" ON public.push_subscriptions FOR SELECT USING(true);`);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260929191326_reliability_and_account_setup.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260929192831_owner_employee_account_link.sql',import.meta.url),'utf8'));
 const uid='00000000-0000-4000-8000-000000000001',dept='00000000-0000-4000-8000-000000000002';
 await db.query("INSERT INTO auth.users VALUES($1,'personal@example.invalid',now(),now())",[uid]);await db.query("INSERT INTO public.departments VALUES($1,'stickney-fire-department')",[dept]);await db.query("INSERT INTO public.department_memberships VALUES($1,$2,'active')",[uid,dept]);
 await db.exec("INSERT INTO firehouse.employees VALUES('member',1),('other',1);INSERT INTO firehouse.employee_profiles VALUES('member','work@example.invalid',NULL,NULL),('other','other@example.invalid',NULL,NULL)");
 const identity=async email=>(await db.query('SELECT firehouse.employee_id_for_login($1) AS id',[email])).rows[0].id;
 assert.equal(await identity('personal@example.invalid'),null);
 await db.query("SELECT firehouse.link_employee_account($1,'member','fixture admin')",[uid]);assert.equal(await identity('personal@example.invalid'),'member');assert.equal(await identity('work@example.invalid'),'member');
 assert.equal((await db.query("SELECT email FROM firehouse.employee_profiles WHERE employee_id='member'")).rows[0].email,'work@example.invalid');
 await assert.rejects(db.query("SELECT firehouse.link_employee_account($1,'other','fixture admin')",[uid]));
 await db.exec("UPDATE firehouse.employee_profiles SET end_date='2000-01-01' WHERE employee_id='member'");assert.equal(await identity('personal@example.invalid'),null);
 await db.exec("UPDATE firehouse.employee_profiles SET end_date=NULL,start_date='2999-01-01' WHERE employee_id='member'");assert.equal(await identity('personal@example.invalid'),null);
 await db.exec("UPDATE firehouse.employee_profiles SET start_date=NULL;UPDATE firehouse.employee_profiles SET email='personal@example.invalid' WHERE employee_id='other'");assert.equal(await identity('personal@example.invalid'),null);
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','firehouse.link_employee_account(uuid,text,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
