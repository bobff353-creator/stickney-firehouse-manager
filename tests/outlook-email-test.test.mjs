import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { trainingModules } from './helpers/training-modules.mjs';

const runId = '9ec72be1-bfe1-4fea-a448-21bdd451bfb1';
const env = {OUTLOOK_EMAIL_TEST_ENABLED: 'true', OUTLOOK_EMAIL_TEST_RUN_ID: runId,
  OUTLOOK_EMAIL_TEST_WEBHOOK_URL: 'https://qa.01.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/test/triggers/manual/paths/invoke?sig=local-fixture'};
async function harness() {
  const pg = new PGlite();
  await pg.exec('CREATE TABLE system_meta(key text PRIMARY KEY,value text NOT NULL,updated_at text NOT NULL)');
  let actor = 'bobff353@gmail.com', department = '14a76771-4c24-481b-8def-e6cce005c17b', permitted = true;
  let db;
  const load = trainingModules({
    [resolve('app/supabase-server.ts')]: {},
    [resolve('app/department-portal.ts')]: {getPortalDepartment: async () => ({id: department, isolated: false})},
    [resolve('db/bootstrap.ts')]: {ensureDatabase: async () => db},
    [resolve('app/server-permissions.ts')]: {hasPermission: async () => permitted},
  });
  const client = {async rpc(name, args) {
    try {const result = await pg.query(args.p_mode === 'first' ? `SELECT to_jsonb(r) AS value FROM (${args.p_sql}) r LIMIT 1` : args.p_sql); return {data: args.p_mode === 'first' ? result.rows[0]?.value ?? null : {success: true,meta:{changes:result.affectedRows}},error: null};}
    catch (error) {return {error: {message: error.message},data: null};}
  }};
  db = load('db/postgres-adapter.ts').createPostgresD1Adapter(async () => client);
  const model = load('app/outlook-email-test.ts'), route = load('app/api/outlook-email-test/route.ts');
  const request = (input = {confirmed: true}, headers = {}) => new Request('https://qa.portal/api/outlook-email-test', {method: 'POST',headers: {
    origin: 'https://qa.portal','content-type':'application/json','oai-authenticated-user-email': actor,'x-department-id': department,...headers},body: JSON.stringify(input)});
  return {pg,db,model,route,request,setActor(value) {actor = value;},setDepartment(value) {department = value;},deny() {permitted = false;}};
}
test('Outlook test is off by default and rejects unsafe or unsigned endpoints', async () => {
  const {outlookTestConfig} = trainingModules()('app/outlook-email-test.ts');
  assert.equal(outlookTestConfig({}), null);
  assert.equal(outlookTestConfig({...env,OUTLOOK_EMAIL_TEST_ENABLED:'false'}),null);
  for (const url of ['http://qa.environment.api.powerplatform.com/?sig=x','https://evil.example/?sig=x','https://qa.environment.api.powerplatform.com.evil.example/?sig=x','https://qa.environment.api.powerplatform.com/','https://user:pass@qa.environment.api.powerplatform.com/?sig=x']) {
    assert.equal(outlookTestConfig({...env,OUTLOOK_EMAIL_TEST_WEBHOOK_URL:url}),null);
  }
  assert(outlookTestConfig(env));
});
test('durable one-shot reservation prevents concurrent and later resends; provider acceptance is not delivery', async () => {
  const h = await harness(); let sends = 0;
  try {
    const send = async (url, options) => {
      sends++; assert.equal(options.redirect,'error'); assert.deepEqual(JSON.parse(options.body),{requestId:runId,testOnly:true});
      return Response.json({status:'Accepted',recipient:h.model.outlookTestRecipient,requestId:runId});
    };
    const results = await Promise.all(Array.from({length:8},() => h.model.sendOutlookTest(h.db,'bobff353@gmail.com',h.model.outlookTestConfig(env),send)));
    assert.equal(sends,1); assert.equal(results.filter(result => !result.replayed).length,1);
    const saved = await h.model.readOutlookTest(h.db,runId);
    assert.equal(saved.status,'Accepted'); assert.equal(saved.recipient,'bwyant@stickneyfire.com');
    assert.equal((await h.model.sendOutlookTest(h.db,'bobff353@gmail.com',h.model.outlookTestConfig(env),send)).replayed,true);
    assert.equal(sends,1);
  } finally {await h.pg.close();}
});
test('ambiguous or failed provider calls never resend and never leak credentials', async t => {
  for (const mode of ['timeout','queued','wrong recipient','wrong reference','invalid JSON','failure']) await t.test(mode,async () => {
    const h = await harness(); let sends = 0;
    try {
      const send = async () => {sends++; if(mode==='timeout') throw Error(env.OUTLOOK_EMAIL_TEST_WEBHOOK_URL);
        if(mode==='queued') return new Response(null,{status:202});
        if(mode==='failure') return new Response('private provider details',{status:500});
        if(mode==='invalid JSON') return new Response('not JSON');
        return Response.json({status:'Accepted',recipient:mode==='wrong recipient'?'someone@qa.invalid':h.model.outlookTestRecipient,requestId:mode==='wrong reference'?'other':runId});};
      const result = await h.model.sendOutlookTest(h.db,'bobff353@gmail.com',h.model.outlookTestConfig(env),send);
      assert.equal(result.receipt.status,'Unconfirmed'); assert(!JSON.stringify(result).includes('local-fixture'));
      await h.model.sendOutlookTest(h.db,'bobff353@gmail.com',h.model.outlookTestConfig(env),send); assert.equal(sends,1);
    } finally {await h.pg.close();}
  });
});
test('route denies recipient injection, cross-site requests, wrong department, other users and non-admins', async () => {
  const h = await harness();
  try {
    assert.equal((await h.route.POST(h.request({confirmed:true,to:'other@qa.invalid'}))).status,400);
    assert.equal((await h.route.POST(h.request({confirmed:true},{origin:'https://other.example'}))).status,403);
    assert.equal((await h.route.POST(h.request({confirmed:true},{'x-department-id':'other'}))).status,403);
    h.setDepartment('another-department'); assert.equal((await h.route.POST(h.request())).status,403);
    h.setDepartment(h.model.outlookTestDepartment);h.setActor('other@stickneyfire.com');assert.equal((await h.route.POST(h.request())).status,403);
    h.setActor('bobff353@gmail.com');h.deny();assert.equal((await h.route.POST(h.request())).status,403);
    assert.equal((await h.pg.query('SELECT count(*) n FROM system_meta')).rows[0].n,0);
  } finally {await h.pg.close();}
});

test('adding a department event cannot email employees when event invitations are off, even with a provider key', async () => {
  const previous = {flag:process.env.CHIEF_EVENT_EMAIL_SENDING_ENABLED,key:process.env.RESEND_API_KEY,to:process.env.DISPATCH_EMAIL_TO};
  delete process.env.CHIEF_EVENT_EMAIL_SENDING_ENABLED;process.env.RESEND_API_KEY='local-fixture';process.env.DISPATCH_EMAIL_TO='qa@qa.invalid';
  let fetched = 0, savedStatus;
  const oldFetch = globalThis.fetch;globalThis.fetch = async () => {fetched++;throw Error('Unexpected outbound email');};
  const db = {prepare(sql) {return {bind(...values) {if(sql.startsWith('UPDATE chief_board_items')) savedStatus=values[0];return this;},async run(){return {success:true};},async all(){return {results:[{email:'employee@qa.invalid'}]};}};},async batch(){return [];}};
  const route = trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>true},[resolve('app/portal-storage.ts')]:{getPortalStorage:()=>null}})('app/api/chief-board/route.ts');
  try {
    const form = new FormData();for(const [key,value] of Object.entries({itemType:'event',title:'Local fixture',body:'No real records',startsAt:'2030-01-01T12:00:00Z',endsAt:'2030-01-01T13:00:00Z'})) form.set(key,value);
    const response = await route.POST(new Request('https://qa.portal/api/chief-board',{method:'POST',body:form}));
    assert.equal(response.status,200);assert.deepEqual((await response.json()).invite,{status:'disabled',sent:0,failed:0});assert.equal(savedStatus,'disabled:0:0');assert.equal(fetched,0);
  } finally {
    globalThis.fetch=oldFetch;
    for(const [name,value] of [['CHIEF_EVENT_EMAIL_SENDING_ENABLED',previous.flag],['RESEND_API_KEY',previous.key],['DISPATCH_EMAIL_TO',previous.to]]) {if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});
