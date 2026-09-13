import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const uid = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const department = '00000000-0000-4000-8000-000000000003';
const elsewhere = '00000000-0000-4000-8000-000000000004';
const session = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

test('remembered devices: actual Postgres migration and authorization contracts', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA extensions;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE EXTENSION pgcrypto SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),not_after timestamptz);
      CREATE TABLE public.departments(id uuid PRIMARY KEY);
      CREATE TABLE public.department_memberships(user_id uuid,department_id uuid,status text,PRIMARY KEY(user_id,department_id));
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.user',true),'')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('session_id',current_setting('request.session',true)) $$;
      CREATE FUNCTION public.is_platform_owner() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      GRANT USAGE ON SCHEMA auth,private,extensions TO authenticated;
      INSERT INTO auth.users VALUES('${uid}'),('${other}');
      INSERT INTO public.departments VALUES('${department}'),('${elsewhere}');
      INSERT INTO public.department_memberships VALUES('${uid}','${department}','active'),('${other}','${department}','active');
      INSERT INTO auth.sessions(id,user_id) VALUES('${session(1)}','${uid}'),('${session(2)}','${uid}'),('${session(3)}','${other}');`);
    await db.exec(migration('20260803211245_member_invites_and_pin_unlock.sql'));
    await db.exec(migration('20260902143524_renew_own_portal_pin_unlock.sql'));
    await db.exec(migration('20260912230102_remembered_portal_devices.sql'));
    // Synthetic fixture only. A low-cost test hash speeds repeated real crypt comparisons.
    await db.exec(`INSERT INTO public.portal_pin_credentials(user_id,pin_hash)
      VALUES('${uid}',extensions.crypt('1234',extensions.gen_salt('bf',4))),
      ('${other}',extensions.crypt('5678',extensions.gen_salt('bf',4)));`);
    const identity = async (user=uid, currentSession=session(1)) => {
      await db.query("SELECT set_config('request.user',$1,false),set_config('request.session',$2,false)",[user,currentSession]);
    };
    const asMember = async (sql, params=[]) => {
      await db.exec('SET ROLE authenticated');
      try { return (await db.query(sql,params)).rows; } finally { await db.exec('RESET ROLE'); }
    };
    const issue = async (pin='1234', dept=department) => (await asMember('SELECT * FROM public.verify_portal_pin_with_device($1,$2)',[pin,dept]))[0];
    const status = async token => (await asMember('SELECT * FROM public.portal_pin_status($1)',[token]))[0];
    const count = async () => Number((await db.query('SELECT count(*) AS n FROM private.portal_remembered_devices')).rows[0].n);
    await identity();
    let first, second;

    await t.test('unchecked flow keeps legacy PIN verification and renewal',async()=>{
      const legacy=(await asMember("SELECT * FROM public.verify_portal_pin('1234')"))[0];
      assert.equal(legacy.ok,true); assert.equal((await status(legacy.unlock_token)).unlocked,true);
      assert.equal((await asMember('SELECT public.renew_own_portal_pin_unlock($1,false) AS ok',[legacy.unlock_token]))[0].ok,true);
      assert.equal(await count(),0);
    });
    await t.test('wrong PIN never issues a device; correct PIN creates an absolute seven-day lease',async()=>{
      assert.equal((await issue('9999')).ok,false); assert.equal(await count(),0);
      first=await issue(); assert.equal(first.ok,true); assert.match(first.unlock_token,/^rd1_[a-f0-9]{64}$/);
      assert.equal((await status(first.unlock_token)).unlocked,true);
      const row=(await db.query('SELECT *,extract(epoch FROM expires_at-created_at) AS seconds FROM private.portal_remembered_devices')).rows[0];
      assert.equal(Number(row.seconds),604800); assert.notEqual(row.token_hash,first.unlock_token);
      assert.notEqual(row.pin_fingerprint,'1234'); assert.equal(row.department_id,department);
    });
    await t.test('new login on another device preserves the first remembered device',async()=>{
      await identity(uid,session(2)); second=await issue();
      assert.equal((await status(second.unlock_token)).unlocked,true);
      await identity(); assert.equal((await status(first.unlock_token)).unlocked,true);
    });
    await t.test('another user, another Auth session, and fabricated token cannot reuse a remembered token',async()=>{
      await identity(other,session(3)); assert.equal((await status(first.unlock_token)).unlocked,false);
      await identity(uid,session(2)); assert.equal((await status(first.unlock_token)).unlocked,false);
      await identity(); assert.equal((await status('rd1_'+'a'.repeat(64))).unlocked,false);
    });
    await t.test('unassigned department and absent Auth session cannot issue a device',async()=>{
      await assert.rejects(issue('1234',elsewhere),/Current department sign-in/);
      await identity(uid,session(99)); await assert.rejects(issue(),/Current department sign-in/); await identity();
    });
    await t.test('status checks and both ordinary/TV renewal cannot move the deadline',async()=>{
      const before=(await db.query('SELECT expires_at FROM private.portal_remembered_devices ORDER BY token_hash')).rows;
      for(const tv of [false,true]) assert.equal((await asMember('SELECT public.renew_own_portal_pin_unlock($1,$2) AS ok',[first.unlock_token,tv]))[0].ok,false);
      const checked=(await asMember('SELECT public.portal_remembered_device_status($1) AS status',[first.unlock_token]))[0].status;
      assert.ok(checked.rememberedUntil && checked.serverNow);
      assert.deepEqual((await db.query('SELECT expires_at FROM private.portal_remembered_devices ORDER BY token_hash')).rows,before);
    });
    await t.test('membership removal and current PIN lock immediately deny remembered access',async()=>{
      await db.query("UPDATE public.department_memberships SET status='inactive' WHERE user_id=$1",[uid]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
      await db.query("UPDATE public.department_memberships SET status='active' WHERE user_id=$1",[uid]);
      for(let i=0;i<5;i++) assert.equal((await issue('9999')).ok,false);
      assert.equal((await status(first.unlock_token)).unlocked,false); assert.equal((await issue()).ok,false);
      await db.query('UPDATE public.portal_pin_credentials SET locked_until=NULL,failed_attempts=0 WHERE user_id=$1',[uid]);
      assert.equal((await status(first.unlock_token)).unlocked,true);
    });
    await t.test('direct database unlock shares remembered authorization',async()=>{
      assert.equal((await asMember('SELECT public.verify_portal_unlock($1) AS ok',[first.unlock_token]))[0].ok,true);
    });
    await t.test('forget is limited to the signed-in session and does not affect another device',async()=>{
      await asMember('SELECT public.forget_own_portal_device($1)',[second.unlock_token]);
      await identity(uid,session(2)); assert.equal((await status(second.unlock_token)).unlocked,true);
      await identity(); await asMember('SELECT public.forget_own_portal_device($1)',[first.unlock_token]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
      await identity(uid,session(2)); assert.equal((await status(second.unlock_token)).unlocked,true); await identity();
    });
    await t.test('Auth sign-out/session deletion and provider session expiration invalidate a lease',async()=>{
      first=await issue(); await db.query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1',[session(1)]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
      await db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=$1',[session(1)]);
      await db.query('DELETE FROM auth.sessions WHERE id=$1',[session(1)]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
      await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session(1),uid]);
    });
    await t.test('the seven-day deadline expires without a save or activity event',async()=>{
      first=await issue(); await db.query("UPDATE private.portal_remembered_devices SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE session_id=$1",[session(1)]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
    });
    await t.test('changing the saved PIN invalidates all remembered devices',async()=>{
      first=await issue(); await db.query("UPDATE public.portal_pin_credentials SET pin_hash=extensions.crypt('4321',extensions.gen_salt('bf',4)) WHERE user_id=$1",[uid]);
      assert.equal((await status(first.unlock_token)).unlocked,false);
      await identity(uid,session(2)); assert.equal((await status(second.unlock_token)).unlocked,false); await identity();
      await db.query("UPDATE public.portal_pin_credentials SET pin_hash=extensions.crypt('1234',extensions.gen_salt('bf',4)) WHERE user_id=$1",[uid]);
    });
    await t.test('remembered device storage is bounded at twenty per user',async()=>{
      for(let i=4;i<=25;i++) {
        await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session(i),uid]);
        await identity(uid,session(i)); await issue();
      }
      assert.equal(await count(),20); await identity();
    });
    await t.test('transaction failure rolls back verification and device notification together',async()=>{
      const before=await count();
      await db.exec('BEGIN'); await issue(); await db.exec('ROLLBACK'); assert.equal(await count(),before);
      assert.equal(Number((await db.query('SELECT count(*) AS n FROM private.portal_remembered_devices WHERE session_id=$1',[session(1)])).rows[0].n),0);
    });
    await t.test('clients cannot read/write device records and anonymous callers cannot mint or verify tokens',async()=>{
      await assert.rejects(asMember('SELECT * FROM private.portal_remembered_devices'),/permission denied/);
      await assert.rejects(asMember('DELETE FROM private.portal_remembered_devices'),/permission denied/);
      await db.exec('SET ROLE anon');
      try { await assert.rejects(db.query("SELECT * FROM public.verify_portal_pin_with_device('1234',$1)",[department]),/permission denied/); }
      finally { await db.exec('RESET ROLE'); }
      const acl=(await db.query("SELECT has_function_privilege('anon','public.portal_remembered_device_status(text)','EXECUTE') AS allowed")).rows[0];
      assert.equal(acl.allowed,false);
    });
    await t.test('issuer session lookup and token checks have usable indexes',async()=>{
      await db.exec('SET enable_seqscan=off');
      const plan=(await db.query('EXPLAIN SELECT id FROM auth.sessions WHERE id=$1 AND user_id=$2',[session(1),uid])).rows;
      assert.match(JSON.stringify(plan),/Index Scan/);
      const tokenPlan=(await db.query('EXPLAIN SELECT expires_at FROM private.portal_remembered_devices WHERE token_hash=$1',['a'.repeat(64)])).rows;
      assert.match(JSON.stringify(tokenPlan),/Index Scan/); await db.exec('RESET enable_seqscan');
    });
  } finally { await db.close(); }
});
