import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {trainingModules} from './helpers/training-modules.mjs';
const config={requestId:'4baa5de9-b29c-48ed-913c-c77ce7a885a5',account:'AC'+'a'.repeat(32),token:'b'.repeat(32),to:'+15555550123',from:'+15555550900'};
const message=(status='queued',patch={})=>({sid:'SM'+'c'.repeat(32),account_sid:config.account,to:config.to,status,...patch});
async function harness(){
 const pg=new PGlite();await pg.exec('CREATE TABLE system_meta(key text PRIMARY KEY,value text NOT NULL,updated_at text NOT NULL)');let db,actor='bobff353@gmail.com',department='14a76771-4c24-481b-8def-e6cce005c17b',permitted=true;
 const load=trainingModules({[resolve('app/supabase-server.ts')]:{},[resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>({id:department,isolated:false})},[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>permitted}});
 const client={async rpc(name,args){try{const result=await pg.query(args.p_mode==='first'?`SELECT to_jsonb(r) AS value FROM (${args.p_sql}) r LIMIT 1`:args.p_sql);return {data:args.p_mode==='first'?result.rows[0]?.value??null:{success:true,meta:{changes:result.affectedRows}},error:null};}catch(error){return {data:null,error:{message:error.message}};}}};
 db=load('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>client);
 const model=load('app/twilio-sms-test.ts'),route=load('app/api/twilio-sms-test/route.ts');
 const request=(body={confirmed:true},headers={})=>new Request('https://qa.portal/api/twilio-sms-test',{method:'POST',headers:{origin:'https://qa.portal','content-type':'application/json','oai-authenticated-user-email':actor,'x-department-id':department,...headers},body:JSON.stringify(body)});
 return {pg,db,model,route,request,actor(value){actor=value;},department(value){department=value;},deny(){permitted=false;}};
}
test('direct SMS defaults off; invalid runs, expired windows and unapproved recipient fail closed',()=>{
 const {smsTestConfig,smsTestRunId}=trainingModules()('app/twilio-sms-test.ts');assert.equal(smsTestConfig({}),null);
 assert.equal(smsTestRunId({TWILIO_SMS_TEST_RUN_ID:'another-id'}),null);
 const env={TWILIO_SMS_TEST_ENABLED:'true',TWILIO_SMS_TEST_RUN_ID:config.requestId,TWILIO_SMS_TEST_ACCOUNT_SID:config.account,TWILIO_SMS_TEST_AUTH_TOKEN:config.token,TWILIO_SMS_TEST_TO:config.to,TWILIO_SMS_TEST_FROM:config.from,TWILIO_SMS_TEST_EXPIRES_AT:'2030-01-01T00:00:00Z'};
 assert.equal(smsTestConfig(env),null);assert.equal(smsTestConfig({...env,TWILIO_SMS_TEST_ENABLED:'false'}),null);assert.equal(smsTestConfig({...env,TWILIO_SMS_TEST_EXPIRES_AT:'2000-01-01T00:00:00Z'}),null);
});
test('concurrent clicks send once through a trial account, using only the approved trial template',async()=>{
 const h=await harness();let sends=0,lookups=0;
 try{const fetch=async(url,options)=>{assert(url.startsWith('https://api.twilio.com/2010-04-01/Accounts/'+config.account));assert.equal(options.redirect,'error');
  if(options.method==='GET'){lookups++;return Response.json({sid:config.account,type:'Trial',status:'active'});}
  sends++;assert.deepEqual([...new URLSearchParams(options.body)],[['To',config.to],['From',config.from],['Body','sms_customer_support']]);return Response.json(message(),{status:201});};
 const results=await Promise.all(Array.from({length:8},()=>h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,fetch)));
 assert.equal(sends,1);assert.equal(lookups,1);assert.equal(results.filter(x=>!x.replayed).length,1);const receipt=await h.model.readSmsTest(h.db,config.requestId);assert.equal(receipt.status,'Accepted');assert.equal(receipt.recipient,'Phone ending 5300');assert(!JSON.stringify(receipt).includes(config.to));assert(!JSON.stringify(receipt).includes(config.token));
 await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,fetch);assert.equal(sends,1);
 }finally{await h.pg.close();}
});
test('paid, suspended, foreign and unreachable accounts cannot send a text',async t=>{
 for(const account of [{sid:config.account,type:'Full',status:'active'},{sid:config.account,type:'Trial',status:'suspended'},{sid:'other',type:'Trial',status:'active'},null])await t.test(JSON.stringify(account),async()=>{const h=await harness();let posts=0;try{const result=await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,async(url,options)=>{if(options.method==='POST')posts++;return account?Response.json(account):new Response(null,{status:401});});assert.equal(result.receipt.status,'Failed');assert.equal(posts,0);}finally{await h.pg.close();}});
});
test('a timeout after dispatch is saved as unconfirmed and never retried',async()=>{
 const h=await harness();let sends=0;try{const fetch=async(url,options)=>{if(options.method==='GET')return Response.json({sid:config.account,type:'Trial',status:'active'});sends++;throw Error('Credential-bearing provider error');};const result=await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,fetch);assert.equal(result.receipt.status,'Unconfirmed');assert(!JSON.stringify(result).includes('Credential-bearing'));await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,fetch);assert.equal(sends,1);}finally{await h.pg.close();}
});
test('status refresh only reads the saved message and requires matching account, ID and recipient',async()=>{
 const h=await harness();try{await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,async(url,options)=>options.method==='GET'?Response.json({sid:config.account,type:'Trial',status:'active'}):Response.json(message(),{status:201}));
 for(const patch of [{to:'+15555550999'},{account_sid:'other'},{sid:'SM'+'d'.repeat(32)}]){const saved=await h.model.refreshSmsTest(h.db,config,async(url,options)=>{assert.equal(options.method,'GET');assert(url.endsWith('/Messages/'+message().sid+'.json'));return Response.json(message('delivered',patch));});assert.equal(saved.status,'Accepted');}
 const sent=await h.model.refreshSmsTest(h.db,config,async()=>Response.json(message('sent')));assert.equal(sent.status,'Sent');const delivered=await h.model.refreshSmsTest(h.db,config,async()=>Response.json(message('delivered')));assert.equal(delivered.status,'Delivered');await h.model.refreshSmsTest(h.db,config,async()=>{throw Error('Terminal receipts need no polling');});assert.equal((await h.model.readSmsTest(h.db,config.requestId)).status,'Delivered');
 }finally{await h.pg.close();}
});
test('route rejects recipient/content injection, cross-site calls, other departments, non-Bob callers and non-admins',async()=>{
 const h=await harness();try{assert.equal((await h.route.POST(h.request({confirmed:true,to:config.to}))).status,400);assert.equal((await h.route.POST(h.request({confirmed:true,body:'custom'}))).status,400);assert.equal((await h.route.POST(h.request({confirmed:true},{origin:'https://other.example'}))).status,403);assert.equal((await h.route.POST(h.request({confirmed:true},{'x-department-id':'other'}))).status,403);h.department('other');assert.equal((await h.route.POST(h.request())).status,403);h.department(h.model.smsTestDepartment);h.actor('other@stickneyfire.com');assert.equal((await h.route.POST(h.request())).status,403);h.actor('bobff353@gmail.com');h.deny();assert.equal((await h.route.POST(h.request())).status,403);assert.equal((await h.pg.query('SELECT count(*) n FROM system_meta')).rows[0].n,0);}finally{await h.pg.close();}
});
test('a delayed refresh cannot overwrite a concurrently saved Delivered receipt',async()=>{
 const h=await harness();try{
  await h.model.sendSmsTest(h.db,'bobff353@gmail.com',config,async(url,options)=>options.method==='GET'?Response.json({sid:config.account,type:'Trial',status:'active'}):Response.json(message(),{status:201}));
  let release,started;const entered=new Promise(resolve=>{started=resolve;});
  const late=h.model.refreshSmsTest(h.db,config,async()=>{started();return new Promise(resolve=>{release=resolve;});});
  await entered;await h.model.refreshSmsTest(h.db,config,async()=>Response.json(message('delivered')));release(Response.json(message('sent')));
  assert.equal((await late).status,'Delivered');assert.equal((await h.model.readSmsTest(h.db,config.requestId)).status,'Delivered');
 }finally{await h.pg.close();}
});
test('the public inbound sink has no reply, body access, storage or provider call',async()=>{
 const route=trainingModules()('app/api/twilio-sms-test/inbound/route.ts');
 const response=await route.POST();assert.equal(response.status,204);assert.equal(await response.text(),'');
 const source=readFileSync('app/api/twilio-sms-test/inbound/route.ts','utf8');assert(!/fetch\(|ensureDatabase\(|request\./.test(source));
 const proxy=readFileSync('proxy.ts','utf8');assert(proxy.includes("request.method === 'POST' && pathname === '/api/twilio-sms-test/inbound'"));assert(!proxy.includes("pathname === '/api/twilio-sms-test')"));
});
