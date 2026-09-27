import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollDatabaseFixture } from './helpers/payroll-submission-db.mjs';
const cutoffs={period:'2026-09-11',staffingThrough:'2026-09-23',extrasThrough:'2026-09-23'};
async function submit(f){const p=await f.post({...cutoffs,action:'preview'});assert.equal(p.status,200,JSON.stringify(p.body));assert.deepEqual(p.body.blockers,[]);const body={...cutoffs,action:'submit',fingerprint:p.body.fingerprint,confirm:true};const r=await f.post(body);assert.equal(r.status,200,JSON.stringify(r.body));return body;}
async function actualTrade(f){await f.pg.exec("INSERT INTO firehouse.time_entries VALUES('actual24','b','2026-09-11','2026-09-24','shift',6),('actual25','a','2026-09-11','2026-09-25','shift',6)");}

test('actual API and Postgres: preview -> immutable submit -> actual trade -> approved next-period export state; retries apply once',async()=>{
  const f=await payrollDatabaseFixture();try{
    const submitted=await submit(f);
    assert.equal((await f.post(submitted)).body.alreadySaved,true);
    await actualTrade(f);
    const compare=await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'});
    assert.equal(compare.status,200,JSON.stringify(compare.body));assert.equal(compare.body.candidates.length,2);
    for(const c of compare.body.candidates){
      const approval={action:'approve',period:'2026-09-26',sourcePeriod:'2026-09-11',candidateId:c.id,note:'Verified fictional attendance and callback',confirm:true};
      const result=await f.post(approval);assert.equal(result.status,200,JSON.stringify(result.body));
      assert.equal((await f.post(approval)).body.alreadySaved,true);
    }
    assert.equal((await f.get('2026-09-26')).body.incoming.length,2);
    assert.equal((await f.get()).body.submission.document.grossCents,36000,'submitted pay never changed');
    assert.equal((await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'})).body.candidates.length,0);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_adjustments')).rows[0].n,2);
  }finally{await f.pg.close();}
});
test('employee access, cross-origin writes and malformed submissions are denied',async()=>{
  const f=await payrollDatabaseFixture();try{
    f.state.manager=false;assert.equal((await f.get()).status,403);assert.equal((await f.post({...cutoffs,action:'preview'})).status,403);
    f.state.manager=true;assert.equal((await f.post({...cutoffs,action:'preview'},'https://foreign.test')).status,403);
    assert.equal((await f.post({...cutoffs,action:'submit',confirm:true,fingerprint:'made-up'})).status,409);
    assert.equal((await f.post({...cutoffs,period:'2026-02-31',action:'preview'})).status,400);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_submissions')).rows[0].n,0);
  }finally{await f.pg.close();}
});
test('changed preview or changed source during save rejects with no partial snapshot or audit',async()=>{
  const f=await payrollDatabaseFixture();try{
    let p=await f.post({...cutoffs,action:'preview'});
    await f.pg.exec("UPDATE firehouse.time_entries SET hours=7 WHERE id='actual23'");
    assert.equal((await f.post({...cutoffs,action:'submit',fingerprint:p.body.fingerprint,confirm:true})).status,409);
    p=await f.post({...cutoffs,action:'preview'});
    f.state.beforeBatch=pg=>pg.exec("UPDATE firehouse.time_entries SET hours=8 WHERE id='actual23'");
    assert.equal((await f.post({...cutoffs,action:'submit',fingerprint:p.body.fingerprint,confirm:true})).status,409);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_submissions')).rows[0].n,0);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.record_revisions')).rows[0].n,0);
  }finally{await f.pg.close();}
});
test('failed audit rolls back submission; lost response and slow retry return same saved copy',async()=>{
  const f=await payrollDatabaseFixture();try{
    const p=await f.post({...cutoffs,action:'preview'}), body={...cutoffs,action:'submit',fingerprint:p.body.fingerprint,confirm:true};
    f.state.failAudit=true;assert.notEqual((await f.post(body)).status,200);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_submissions')).rows[0].n,0);
    f.state.failAudit=false;f.state.loseResponse=true;assert.notEqual((await f.post(body)).status,200);
    f.state.delayMs=5;assert.equal((await f.post(body)).body.alreadySaved,true);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_submissions')).rows[0].n,1);
  }finally{await f.pg.close();}
});
test('database protects immutable history, target closure, source actual recording and raw browser table access',async()=>{
  const f=await payrollDatabaseFixture();try{
    await submit(f);
    await assert.rejects(f.pg.exec("UPDATE firehouse.payroll_submissions SET document='{}'"),/PAYROLL_SNAPSHOT_LOCKED/);
    await assert.rejects(f.pg.exec('DELETE FROM firehouse.payroll_submissions'),/PAYROLL_SNAPSHOT_LOCKED/);
    await assert.rejects(f.pg.exec("UPDATE firehouse.pay_periods SET status='finalized' WHERE start_date='2026-09-11'"),/PAYROLL_SNAPSHOT_LOCKED/);
    await actualTrade(f); // Early submission must not block actual-entry writes.
    await f.pg.exec("INSERT INTO firehouse.pay_periods VALUES('2026-09-26','2026-10-10','finalized')");
    const p=await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'});
    assert.ok(p.body.blockers.some(b=>b.includes('already closed')));
    assert.equal((await f.post({action:'approve',period:'2026-09-26',sourcePeriod:'2026-09-11',candidateId:p.body.candidates[0].id,note:'Review',confirm:true})).status,409);
    for(const role of ['anon','authenticated']){
      await f.pg.exec(`SET ROLE ${role}`);await assert.rejects(f.pg.query('SELECT * FROM firehouse.payroll_submissions'),/permission denied/);await f.pg.exec('RESET ROLE');
    }
    const security=await f.pg.query("SELECT relrowsecurity FROM pg_class WHERE oid IN ('firehouse.payroll_submissions'::regclass,'firehouse.payroll_adjustments'::regclass,'firehouse.payroll_source_version'::regclass)");
    assert.equal(security.rows.length,3);assert.ok(security.rows.every(r=>r.relrowsecurity));
  }finally{await f.pg.close();}
});
test('stale adjustment and missing handoffs reject; audit failure rolls back carry-forward approval',async()=>{
  const f=await payrollDatabaseFixture();try{
    await submit(f);await actualTrade(f);
    const p=await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'});
    const body={action:'approve',period:'2026-09-26',sourcePeriod:'2026-09-11',candidateId:p.body.candidates[0].id,note:'Verified test evidence',confirm:true};
    f.state.failAudit=true;assert.notEqual((await f.post(body)).status,200);f.state.failAudit=false;
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_adjustments')).rows[0].n,0);
    await f.pg.exec("UPDATE firehouse.daily_log_approvals SET sign_out_at=NULL WHERE log_date='2026-09-25'");
    assert.equal((await f.post(body)).status,409);
    await f.pg.exec("UPDATE firehouse.daily_log_approvals SET sign_out_at='2026-09-27' WHERE log_date='2026-09-25'; UPDATE firehouse.time_entries SET hours=4 WHERE id='actual24'");
    const b=p.body.candidates.find(c=>c.employeeId==='b');
    assert.equal((await f.post({...body,candidateId:b.id})).status,409);
  }finally{await f.pg.close();}
});

test('simultaneous submit requests and lost approval responses cannot create duplicate records',async()=>{
  const f=await payrollDatabaseFixture();try{
    const preview=await f.post({...cutoffs,action:'preview'});
    const body={...cutoffs,action:'submit',fingerprint:preview.body.fingerprint,confirm:true,document:{grossCents:999999}};
    const responses=await Promise.all([f.post(body),f.post(body)]);
    assert.ok(responses.some(r=>r.status===200));
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM firehouse.payroll_submissions')).rows[0].n,1);
    assert.equal((await f.get()).body.submission.document.grossCents,36000,'client cannot supply its own pay total');
    await actualTrade(f);
    const r=await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'});
    const approval={action:'approve',period:'2026-09-26',sourcePeriod:'2026-09-11',candidateId:r.body.candidates[0].id,note:'Fictional reviewed records',confirm:true,deltaCents:999999};
    f.state.loseResponse=true;assert.equal((await f.post(approval)).status,503);
    assert.equal((await f.post(approval)).body.alreadySaved,true);
    const rows=(await f.get('2026-09-26')).body.incoming;
    assert.equal(rows.length,1);assert.equal(rows[0].deltaCents,-8000,'client cannot supply its own adjustment');
  }finally{await f.pg.close();}
});

test('large immutable documents round trip within the existing gateway bound without dropping evidence',async()=>{
  const f=await payrollDatabaseFixture();try{
    const document={schemaVersion:1,records:Array.from({length:1500},(_,i)=>({id:`fictional-${i}`,note:'Review copy; keep original work date -- exact evidence '.repeat(12)}))};
    assert.ok(JSON.stringify(document).length>200000);
    const encoded=f.server.encodePayrollDocument(document);
    assert.ok(encoded.length<200000);
    await f.db.prepare('INSERT INTO payroll_submissions(id,period_start,document,fingerprint,created_by,created_at) VALUES(?,?,?,?,?,?)').bind('large','2026-09-11',encoded,'large-test','test-only','2026-09-24T12:00:00Z').run();
    assert.deepEqual(JSON.parse(JSON.stringify((await f.server.loadSubmission(f.db,'2026-09-11')).document)),document);
  }finally{await f.pg.close();}
});

test('retired schedule positions are excluded and approved adjustments cannot enter an already submitted receiving period',async()=>{
  const f=await payrollDatabaseFixture();try{
    await f.pg.exec("INSERT INTO firehouse.station_shift_types VALUES('retired','06:00','12:00',0); INSERT INTO firehouse.station_schedule_entries VALUES('old24','2026-09-24','retired'); INSERT INTO firehouse.station_shift_slots VALUES('old-slot','old24','a','Officer/AO','filled','','')");
    await submit(f);await actualTrade(f);
    await f.pg.exec("INSERT INTO firehouse.pay_periods VALUES('2026-09-26','2026-10-10','draft'); INSERT INTO firehouse.payroll_submissions VALUES('target','2026-09-26','{}','target','test-only','2026-10-09')");
    const r=await f.post({action:'reconcile',period:'2026-09-26',sourcePeriod:'2026-09-11'});
    assert.ok(r.body.blockers.some(b=>b.includes('closed/submitted')));
    assert.equal((await f.post({action:'approve',period:'2026-09-26',sourcePeriod:'2026-09-11',candidateId:r.body.candidates[0].id,note:'No target mutation allowed',confirm:true})).status,409);
    await assert.rejects(f.db.prepare('INSERT INTO payroll_adjustments(id,source_period,target_period,employee_id,sequence,delta_cents,document,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('invalid','2026-09-11','2026-09-26','a',1,1,'{}','test-only','now').run(),/PAYROLL_SNAPSHOT_LOCKED/);
  }finally{await f.pg.close();}
});
