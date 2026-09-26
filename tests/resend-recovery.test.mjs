import test from 'node:test';
import assert from 'node:assert/strict';
import { cisHarness } from './helpers/cis-cad-harness.mjs';

const now = Date.parse('2026-09-25T22:00:00Z');
const fixture = (id, time = '2026-09-25T21:59:00Z') => ({ incidentId: id, callType: 'LOCAL TEST ONLY', category: 'test', address: 'Fixture address', city: 'Fixture', narrative: 'Fictional automated test', units: 'TEST', longitude: null, latitude: null, dispatchedAt: time });

test('received email recovery against PostgreSQL', async t => {
  const h = await cisHarness();
  const m = h.load('app/resend-dispatch-recovery.ts');
  try {
    await h.pg.exec(`CREATE TABLE queued(incident_id text PRIMARY KEY);
      CREATE FUNCTION fixture_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('fixture.cad_push',true)='enabled' AND NEW.active=1 THEN INSERT INTO queued VALUES(NEW.incident_id) ON CONFLICT DO NOTHING; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_push AFTER INSERT ON dispatch_incidents FOR EACH ROW EXECUTE FUNCTION fixture_enqueue();`);
    await t.test('fresh call saves once with one notification, without reopening cleared calls', async () => {
      const f = fixture('fresh');
      await m.saveRecoveredDispatch(h.db, 'email-fresh', f, 1, now);
      await h.pg.exec("UPDATE dispatch_incidents SET active=0,cleared_at='2026-09-25T22:01:00Z' WHERE incident_id='fresh'; UPDATE daily_log_calls SET time_in='1701' WHERE report_number='fresh'");
      await m.saveRecoveredDispatch(h.db, 'email-fresh', f, 1, now);
      assert.equal((await h.pg.query('SELECT count(*) n FROM queued')).rows[0].n, 1);
      assert.equal((await h.pg.query('SELECT count(*) n FROM daily_log_calls')).rows[0].n, 1);
      assert.equal((await h.pg.query("SELECT active FROM dispatch_incidents WHERE incident_id='fresh'")).rows[0].active, 0);
      assert.equal((await h.pg.query("SELECT time_in FROM daily_log_calls WHERE report_number='fresh'")).rows[0].time_in, '1701');
    });
    await t.test('hours-old dispatch restores history with its original time and no fresh alarm', async () => {
      await m.saveRecoveredDispatch(h.db, 'email-old', fixture('old', '2026-09-25T09:46:56.685Z'), 1, now);
      assert.deepEqual((await h.pg.query("SELECT active,time_out FROM dispatch_incidents WHERE incident_id='old'")).rows[0], { active: 0, time_out: '0446' });
      assert.equal((await h.pg.query("SELECT count(*) n FROM queued WHERE incident_id='old'")).rows[0].n, 0);
    });
    await t.test('failed Daily Log write rolls back incident and notification; retry succeeds', async () => {
      h.stats.failBatchAt = 2;
      await assert.rejects(m.saveRecoveredDispatch(h.db, 'email-retry', fixture('retry'), 1, now), /transaction failed/i);
      assert.equal((await h.pg.query("SELECT count(*) n FROM dispatch_incidents WHERE incident_id='retry'")).rows[0].n, 0);
      assert.equal((await h.pg.query("SELECT count(*) n FROM queued WHERE incident_id='retry'")).rows[0].n, 0);
      await m.saveRecoveredDispatch(h.db, 'email-retry', fixture('retry'), 1, now);
      assert.equal((await h.pg.query("SELECT count(*) n FROM daily_log_calls WHERE report_number='retry'")).rows[0].n, 1);
    });
    await t.test('CIS authoritative records and their Daily Log data are preserved', async () => {
      await h.pg.exec("INSERT INTO dispatch_incidents(incident_id,source_system,address,active) VALUES('cis','CIS CAD','Authoritative fixture',0); INSERT INTO daily_log_calls(id,report_number,log_date,address) VALUES('cis-log','cis','2026-09-25','Authoritative fixture')");
      await m.saveRecoveredDispatch(h.db, 'email-cis', fixture('cis'), 1, now);
      assert.equal((await h.pg.query("SELECT address FROM daily_log_calls WHERE report_number='cis'")).rows[0].address, 'Authoritative fixture');
    });
    await t.test('bounded pagination filters sender/recipient and a failed email does not block later ones', async () => {
      const summary = id => ({ id, from: 'approved@fixture.invalid', to: ['calls@fixture.invalid'], subject: '[BRYX Dispatch] STIF - TEST', created_at: '2026-09-25T21:59:00Z' });
      const requests = [];
      const get = async path => {
        requests.push(path);
        if (path === '/emails/receiving?limit=100') return { data: [summary('bad'), { ...summary('wrong'), from: 'unapproved@fixture.invalid' }], has_more: true };
        if (path.startsWith('/emails/receiving?limit=100&after=')) return { data: [summary('new'), summary('email-fresh')], has_more: false };
        if (path === '/emails/receiving/bad') throw Error('Simulated network failure');
        if (path === '/emails/receiving/new') return { text: 'incidentId: recovered\ncallType: LOCAL TEST ONLY\nTimestamp: 2026-09-25T21:59:00Z\nLocation: Fixture' };
        throw Error('Unexpected retrieval ' + path);
      };
      const result = await m.recoverResendDispatches(h.db, { apiKey: 'fixture', from: 'approved@fixture.invalid', to: 'calls@fixture.invalid' }, now, get);
      assert.equal(result.recovered, 1); assert.equal(result.failed, 1); assert.equal(result.pending, 1);
      assert.ok(!requests.includes('/emails/receiving/wrong')); assert.ok(!requests.includes('/emails/receiving/email-fresh'));
    });
    await t.test('missing timestamps are rejected rather than guessed; freshness has a firm boundary', () => {
      const parser = h.load('app/dispatch-email.ts');
      assert.equal(parser.parseDispatchJson({ incidentId: 'invalid', type: 'LOCAL TEST' }), null);
      assert.equal(parser.parseDispatchText('Incident ID: invalid\nCall Type: LOCAL TEST'), null);
      assert.equal(m.isFreshDispatch('2026-09-25T21:55:00Z', now), false);
      assert.equal(m.isFreshDispatch('2026-09-25T22:02:00Z', now), false);
    });
    await t.test('scheduled endpoint rejects unauthenticated invocations', async () => {
      const original = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'fixture-only';
      try {
        const route = h.load('app/api/cron/dispatch-recovery/route.ts');
        assert.equal((await route.GET(new Request('https://fixture.invalid/api/cron/dispatch-recovery'))).status, 401);
      } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; }
    });
  } finally { await h.close(); }
});
