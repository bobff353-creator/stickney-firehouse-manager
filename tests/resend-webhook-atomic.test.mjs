import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { cisHarness } from './helpers/cis-cad-harness.mjs';

test('signed synthetic email webhook rolls back incident and log on projection failure, then retries', async () => {
  const h = await cisHarness();
  const config = { RESEND_API_KEY:'synthetic', RESEND_WEBHOOK_SECRET:`whsec_${Buffer.from('synthetic-signing-material').toString('base64')}`, DISPATCH_EMAIL_FROM:'dispatch@example.invalid', DISPATCH_EMAIL_TO:'receiver@example.invalid', FIREHOUSE_DATABASE_SECRET:'synthetic' };
  const prior = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, config);
  try {
    const dispatchedAt = new Date().toISOString();
    globalThis.fetch = async url => {
      assert.equal(url, 'https://api.resend.com/emails/receiving/synthetic-email');
      return Response.json({ text:`Incident ID: SYNTHETIC-EMAIL\nCall Type: LOCAL TEST\nTimestamp: ${dispatchedAt}\nLocation: Synthetic address` });
    };
    const api = h.load('app/api/resend-dispatch/route.ts');
    const body = JSON.stringify({type:'email.received',data:{email_id:'synthetic-email',from:config.DISPATCH_EMAIL_FROM,to:[config.DISPATCH_EMAIL_TO],subject:'[BRYX Dispatch] STIF local test'}});
    const timestamp = String(Math.floor(Date.now()/1000));
    const signature = createHmac('sha256','synthetic-signing-material').update(`synthetic-event.${timestamp}.${body}`).digest('base64');
    const request = (signatureValue = `v1,${signature}`) => new Request('https://fixture.invalid/api/resend-dispatch',{method:'POST',headers:{'svix-id':'synthetic-event','svix-timestamp':timestamp,'svix-signature':signatureValue},body});
    assert.equal((await api.POST(request('invalid'))).status, 401);
    h.stats.failBatchAt = 1;
    assert.equal((await api.POST(request())).status, 500);
    assert.equal((await h.pg.query('SELECT count(*) n FROM dispatch_incidents')).rows[0].n, 0);
    assert.equal(h.stats.pushes.length, 0);
    assert.equal((await api.POST(request())).status, 200);
    assert.equal((await api.POST(request())).status, 200);
    assert.equal((await h.pg.query('SELECT count(*) n FROM dispatch_incidents')).rows[0].n, 1);
    assert.equal((await h.pg.query('SELECT count(*) n FROM daily_log_calls')).rows[0].n, 1);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key,value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
    await h.close();
  }
});
