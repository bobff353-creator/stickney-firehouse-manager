import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
function load(file, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require','module','exports',code)(name => { if (!(name in dependencies)) throw Error(`Missing ${name}`); return dependencies[name]; },mod,mod.exports);
  return mod.exports;
}
const signals = load('app/operational-signals.ts');
const { createOperationalLiveClient, createOperationalRefreshQueue } = load('app/operational-live-client.ts', { './operational-signals': signals });
const { nextOperationalDeadline } = load('app/operational-deadlines.ts');
const dept = '00000000-0000-4000-8000-000000000010', user = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const sql = fs.readFileSync(new URL('../supabase/migrations/20260915175213_operational_change_signals.sql', import.meta.url), 'utf8');
const sources = [...sql.matchAll(/\('(firehouse|public)','([^']+)','([^']+)'\)/g)].map(match => ({ schema: match[1], table: match[2], sections: match[3] }));

test('database signals: committed revisions, safe failure, exact source scope and private leases', async t => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE SCHEMA firehouse; CREATE SCHEMA auth; CREATE SCHEMA realtime;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.departments(id uuid PRIMARY KEY,slug text); INSERT INTO public.departments VALUES('${dept}','stickney-fire-department'),('${other}','other-department');
      CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${user}'),('${other}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.user',true),'')::uuid $$;
      CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.topic',true) $$;
      CREATE TABLE realtime.messages(topic text,event text,payload jsonb,extension text,private boolean,inserted_at timestamp DEFAULT now());
      ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,realtime,firehouse TO authenticated;
      GRANT SELECT,INSERT ON realtime.messages TO authenticated;
      CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,is_private boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
        IF current_setting('test.fail_broadcast',true)='true' THEN RETURN; END IF;
        INSERT INTO realtime.messages(payload,event,topic,extension,private) VALUES(payload,event,topic,'broadcast',is_private);
      END $$;`);
    for (const source of sources) await pg.exec(`CREATE TABLE ${source.schema}.${source.table}(id text PRIMARY KEY,department_id uuid,status text);`);
    await pg.exec(sql);
    const versions = async () => (await pg.query('SELECT section,revision,queued FROM firehouse.operational_revisions ORDER BY section')).rows;
    await t.test('install does not emit anything; a rolled-back CAD write has no signal', async () => {
      assert.equal((await versions()).length, 0);
      await pg.exec("BEGIN; INSERT INTO firehouse.dispatch_incidents(id,status) VALUES('not-real','fixture'); ROLLBACK;");
      assert.equal((await versions()).length, 0);
      assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,0);
    });
    await t.test('saved CAD change reaches only Respond and dashboard, without call details', async () => {
      await pg.exec("INSERT INTO firehouse.dispatch_incidents(id,status) VALUES('local-fixture','saved');");
      assert.deepEqual((await versions()).map(row=>row.section), ['dashboard','respond']);
      const messages = (await pg.query('SELECT * FROM realtime.messages')).rows;
      assert.equal(messages.length,2); assert.ok(messages.every(message=>message.private));
      assert.deepEqual(Object.keys(messages[0].payload).sort(), ['id','revision','section']);
      assert.ok((await versions()).every(row=>row.queued));
      await pg.exec("UPDATE firehouse.dispatch_incidents SET status=status WHERE id='local-fixture'");
      assert.ok((await versions()).every(row=>Number(row.revision)===1),'no-op updates do not broadcast');
    });
    await t.test('failed broadcast never drops the saved call; durable revision forces fallback',async()=>{
      await pg.exec("SET test.fail_broadcast='true'; UPDATE firehouse.dispatch_incidents SET status='changed' WHERE id='local-fixture'");
      assert.equal((await pg.query("SELECT status FROM firehouse.dispatch_incidents WHERE id='local-fixture'")).rows[0].status,'changed');
      assert.ok((await versions()).every(row=>Number(row.revision)===2&&!row.queued));
      await pg.exec("SET test.fail_broadcast='false'");
    });
    await t.test('rig-check completion updates board components, not Respond; other departments are excluded',async()=>{
      await pg.query("INSERT INTO public.inventory_checks VALUES('check',$1,'completed')",[dept]);
      assert.equal(Number((await versions()).find(row=>row.section==='respond').revision),2);
      assert.equal(Number((await versions()).find(row=>row.section==='dashboard').revision),3);
      assert.equal(Number((await versions()).find(row=>row.section==='duties').revision),1);
      const before=JSON.stringify(await versions());
      await pg.query("INSERT INTO public.inventory_checks VALUES('other',$1,'completed')",[other]);
      assert.equal(JSON.stringify(await versions()),before);
    });
    await t.test('all mapped writers, including deletes, create revisions',async()=>{
      assert.ok(sources.length>=40);
      for(const source of sources){
        const before = new Map((await versions()).map(row=>[row.section,Number(row.revision)]));
        await pg.query(`INSERT INTO ${source.schema}.${source.table} VALUES('coverage',$1,'fixture')`,[dept]);
        await pg.exec(`DELETE FROM ${source.schema}.${source.table} WHERE id='coverage'`);
        const after = new Map((await versions()).map(row=>[row.section,Number(row.revision)]));
        for(const section of source.sections.split(','))assert.equal(after.get(section),(before.get(section)||0)+2,source.table+':'+section);
      }
    });
    await t.test('server-issued lease allows only that user/topic; no client broadcast or lease forgery',async()=>{
      const {rows:[{signal}]}=await pg.query('SELECT firehouse.issue_operational_view_lease($1,$2,$3) signal',[dept,user,['respond']]);
      const topic=signal.leases[0].topic;
      assert.equal(signal.leases.length,1); assert.equal(signal.userId,user);
      await pg.query('SELECT set_config(\'request.user\',$1,false),set_config(\'request.topic\',$2,false)',[user,topic]);
      await pg.exec('SET ROLE authenticated');
      assert.ok((await pg.query('SELECT * FROM realtime.messages')).rows.length>0);
      await assert.rejects(pg.query('SELECT firehouse.issue_operational_view_lease($1,$2,$3)',[dept,user,['board']]),/permission denied/);
      await assert.rejects(pg.exec("INSERT INTO realtime.messages(topic,extension,private,payload) VALUES('fake','broadcast',true,'{}')"),/row-level security/);
      await pg.query('SELECT set_config(\'request.user\',$1,false)',[other]);
      assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,0);
      await pg.exec('RESET ROLE');
      await pg.query("UPDATE firehouse.operational_view_leases SET expires_at=now()-interval '1 minute'");
      await pg.query('SELECT set_config(\'request.user\',$1,false)',[user]);await pg.exec('SET ROLE authenticated');
      assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,0);await pg.exec('RESET ROLE');
    });
    await t.test('CAD email recovery is claimed only once per 30 seconds across TVs',async()=>{
      assert.equal((await pg.query('SELECT firehouse.claim_operational_cad_recovery($1) ok',[dept])).rows[0].ok,true);
      assert.equal((await pg.query('SELECT firehouse.claim_operational_cad_recovery($1) ok',[dept])).rows[0].ok,false);
    });
  } finally { await pg.close(); }
});

function fixture() {
  let now=Date.parse('2026-09-15T12:00:01Z'), catchups=0;
  const connections=[],events=[];
  const client=createOperationalLiveClient({ now:()=>now,catchUp:async()=>{catchups++;},connect(topic,change,status){const connection={topic,change,status,closed:false};connections.push(connection);return()=>{connection.closed=true;};} });
  client.subscribe({scope:'respond',sections:['respond'],changed:parts=>events.push(parts.join(',')),status:()=>{}});
  const packet=(revision='1',scope='respond')=>({departmentId:dept,userId:user,serverTime:new Date(now).toISOString(),leases:[{scope,topic:`operations:${dept}:${scope}:${Math.floor(now/60000)}`,expiresAt:new Date(Math.floor(now/60000)*60000+60000).toISOString(),queued:true,revisions:{[scope==='respond'?'respond':'dashboard']:revision}}]});
  return {client,connections,events,packet,advance:ms=>{now+=ms;},catchups:()=>catchups};
}
test('live client deduplicates, catches up on join, and detects dropped messages using revisions',async()=>{
  const f=fixture();f.client.accept(f.packet());assert.equal(f.client.healthy('respond'),false);
  f.connections[0].status(true);await Promise.resolve();assert.equal(f.client.healthy('respond'),true);assert.equal(f.catchups(),1);
  f.events.length=0;f.connections[0].change({section:'respond',revision:'2'});f.connections[0].change({section:'respond',revision:'2'});
  assert.deepEqual(f.events,['respond']);f.client.accept(f.packet('1'));assert.deepEqual(f.events,['respond'],'older snapshot cannot undo a live event');
  f.client.accept(f.packet('3'));assert.deepEqual(f.events,['respond','respond'],'missed websocket message caught by security snapshot');
  f.advance(26000);assert.equal(f.client.healthy('respond'),false,'stale authorization cannot keep slow polling enabled');
});
test('disconnect, denied lease, expiry, and stale callbacks return to fallback',async()=>{
  const f=fixture();f.client.accept(f.packet());f.connections[0].status(true);await Promise.resolve();f.connections[0].status(false);assert.equal(f.client.healthy('respond'),false);
  f.client.accept(null);f.events.length=0;f.connections[0].change({section:'respond',revision:'99'});assert.deepEqual(f.events,[]);
  f.client.accept(f.packet());const current=f.connections.at(-1);current.status(true);await Promise.resolve();f.advance(60000);assert.equal(f.client.healthy('respond'),false);current.change({section:'respond',revision:'50'});assert.deepEqual(f.events,['respond']);
});
test('board event only wakes affected subscribers; invalid/public/cross-department topics rejected',()=>{
  const f=fixture();let duties=0,dashboard=0;
  f.client.subscribe({scope:'board',sections:['duties'],changed:()=>duties++,status:()=>{}});
  f.client.subscribe({scope:'board',sections:['dashboard'],changed:()=>dashboard++,status:()=>{}});
  f.client.accept(f.packet('0','board'));f.connections.at(-1).change({section:'duties',revision:'1'});assert.equal(duties,1);assert.equal(dashboard,0);
  f.connections.at(-1).change({section:'respond',revision:'999'});assert.equal(duties,1);
  const invalid=f.packet('1','board');invalid.leases[0].topic='operations:someone-else:board:1';f.client.accept(invalid);assert.equal(f.client.healthy('board'),false);
});
test('events during an outstanding fetch coalesce to one catch-up fetch, then disposal stops updates',async()=>{
  let release,reads=0;const blocked=new Promise(resolve=>{release=resolve;});
  const q=createOperationalRefreshQueue(async()=>{reads++;if(reads===1)await blocked;});
  const initial=q.request();void q.request();void q.request();assert.equal(reads,1);release();await initial;assert.equal(reads,2);
  q.dispose();await q.request();assert.equal(reads,2);
});
test('future alerts and call expiry schedule a refresh without any new database write',()=>{
  const now=Date.parse('2026-09-15T12:00:00Z');
  assert.equal(nextOperationalDeadline([{effectiveAt:'2026-09-15T12:01:00Z'},{expiresAt:'2026-09-15T12:03:00Z'}],now),now+60000);
  assert.equal(nextOperationalDeadline([{dispatchedAt:'2026-09-15T00:01:00Z'}],now,true),now+60001);
  assert.equal(nextOperationalDeadline([{expiresAt:'bad'},{expiresAt:'2026-09-15T11:00:00Z'}],now),0);
});

test('a failed subscription cannot invalidate a verified permission response',()=>{
  const client=createOperationalLiveClient({now:()=>Date.parse('2026-09-15T12:00:01Z'),catchUp:async()=>{},connect(){throw Error('Socket unavailable');}});
  client.subscribe({scope:'respond',sections:['respond'],changed:()=>{},status:()=>{}});
  assert.doesNotThrow(()=>client.accept(fixture().packet()));assert.equal(client.healthy('respond'),false);
  const stop=signals.listenOperationalSignals(()=>{throw Error('Broken optional subscriber');});
  assert.doesNotThrow(()=>signals.publishOperationalSignal(null));stop();
});

test('server grants live scopes only for the verified department and matching permissions',async()=>{
  const saved=process.env.PAYROLL_DEPARTMENT_ID;process.env.PAYROLL_DEPARTMENT_ID=dept;
  const reads=[],tasks=[];
  const server=load('app/lib/operational-signals.ts',{
    'server-only':{},'next/server':{after:fn=>tasks.push(fn)},
    './apparatus-location-store':{locationDatabase:()=>({prepare(query){return{bind(...args){reads.push({query,args});return this;},first:async()=>({signal:{verified:true}})};}})},
    '../resend-dispatch-sync':{syncRecentResendDispatches:async()=>{}},
  });
  const request=(department=dept)=>new Request('https://fixture.invalid/api/permissions?scope=viewer&live=board,respond,forged',{headers:{'x-department-id':department,'x-authenticated-user-id':user}});
  try{
    assert.equal(await server.readOperationalSignal(request(),[],{}),null);assert.equal(reads.length,0);
    assert.equal(await server.readOperationalSignal(request(other),['operations_board.view'],{}),null);assert.equal(reads.length,0);
    await server.readOperationalSignal(request(),['field_preplans.view'],{});assert.deepEqual(reads[0].args,[dept,user,'{respond}']);assert.equal(tasks.length,0);
    await server.readOperationalSignal(request(),['operations_board.view'],{});assert.deepEqual(reads[1].args,[dept,user,'{board}']);assert.equal(tasks.length,1);
  }finally{if(saved===undefined)delete process.env.PAYROLL_DEPARTMENT_ID;else process.env.PAYROLL_DEPARTMENT_ID=saved;}
});

test('channel joins wait for a post-subscription security read, even during another catch-up',async()=>{
  const previousFetch=globalThis.fetch;const replies=[];
  const api=load('app/use-permissions.ts',{react:{},'./operational-signals':{operationalQuery:()=>'',publishOperationalSignal:()=>{}}});
  globalThis.fetch=()=>new Promise(resolve=>replies.push(resolve));
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const answer=()=>Response.json({viewerPermissions:['field_preplans.view'],identity:'fixture'});
  try{
    const initial=api.refreshPermissions();
    const catchup=api.refreshPermissionsAfterCurrent();assert.equal(catchup,api.refreshPermissionsAfterCurrent());assert.equal(replies.length,1);
    replies[0](answer());await initial;await flush();assert.equal(replies.length,2);
    const joined=api.refreshPermissionsAfterCurrent();assert.notEqual(joined,catchup);
    replies[1](answer());await catchup;await flush();assert.equal(replies.length,3,'join during GET requires another GET after it');
    replies[2](answer());await joined;
  }finally{globalThis.fetch=previousFetch;}
});
