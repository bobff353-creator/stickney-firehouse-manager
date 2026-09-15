import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getSupabaseBackupHealth, interpretSupabaseBackups, supabaseProjectRef } from '../app/lib/supabase-backup-health.ts';
import { summarizeHealth } from '../app/system-health-model.ts';

const ref='abcdefghijklmnopqrst';
const now=Date.parse('2026-09-15T02:00:00Z');
const recent='2026-09-15T01:00:00Z';
const token='sbp_fcFixtureOnly_NotARealToken';
const options={supabaseUrl:`https://${ref}.supabase.co`,projectRef:ref,token,now};
const payload=(backups=[{status:'COMPLETED',inserted_at:recent}])=>({pitr_enabled:false,backups});

test('host validation never sends credentials to a different or malformed host',async()=>{
  for(const url of ['http://'+ref+'.supabase.co','https://'+ref+'.supabase.co.evil.test','https://evil.test',`https://${ref}.supabase.co@evil.test`,`https://user:password@${ref}.supabase.co`,`https://${ref}.supabase.co:444`,`https://${ref}.supabase.co/path`,`https://${ref}.supabase.co?url=evil`,'bad']){
    assert.equal(supabaseProjectRef(url),null);
    const result=await getSupabaseBackupHealth({...options,supabaseUrl:url,fetcher:()=>{throw Error('must not fetch')}});
    assert.equal(result.value,'Project cannot be verified');
    assert.equal(result.action,undefined);
  }
  assert.equal(supabaseProjectRef(options.supabaseUrl),ref);
});

test('missing, wrong-project, classic and database keys fail closed before the provider call',async()=>{
  for(const patch of [{token:undefined},{token:undefined,projectRef:undefined},{projectRef:'differentprojectxxxx'},{token:'sb_secret_fixture'},{token:'sbp_classicFixture'},{token:'sbp_fcFake\r\nInjected: true'},{requiredAfter:'invalid-date'}]){
    let calls=0;
    const result=await getSupabaseBackupHealth({...options,...patch,fetcher:async()=>{calls++;return Response.json(payload())}});
    assert.equal(calls,0); assert.notEqual(result.state,'healthy'); assert.equal(result.verifiedAt,null);
    assert.equal(result.action.href,`https://supabase.com/dashboard/project/${ref}/database/backups/scheduled`);
  }
});

test('a completed backup uses the documented timestamp and makes one bounded server-only GET',async()=>{
  let calls=0;
  const result=await getSupabaseBackupHealth({...options,fetcher:async(url,init)=>{
    calls++; assert.equal(url,`https://api.supabase.com/v1/projects/${ref}/database/backups`);
    assert.equal(init.method,'GET'); assert.equal(init.headers.Authorization,`Bearer ${token}`);
    assert.equal(init.redirect,'error'); assert.equal(init.cache,'no-store'); assert.ok(init.signal instanceof AbortSignal);
    return Response.json(payload());
  }});
  assert.equal(calls,1); assert.equal(result.state,'healthy'); assert.equal(result.verifiedAt,new Date(now).toISOString());
  assert.match(result.value,/Sep 14, 2026, 8:00 PM Central/);
  assert.match(result.detail,/not included/); assert.doesNotMatch(JSON.stringify(result),new RegExp(token));
});

test('only COMPLETED counts, unsorted rows choose newest, newer failures remain visible',()=>{
  assert.equal(interpretSupabaseBackups(payload([]),now).state,'warning');
  assert.equal(interpretSupabaseBackups(payload([{status:'FAILED',inserted_at:recent}]),now).value,'No completed backup yet');
  const rows=[{status:'COMPLETED',inserted_at:recent},{status:'COMPLETED',inserted_at:'2026-09-14T00:00:00Z'}];
  assert.match(interpretSupabaseBackups(payload(rows),now).value,/8:00 PM/);
  rows.push({status:'FAILED',inserted_at:'2026-09-15T01:30:00Z'});
  assert.match(interpretSupabaseBackups(payload(rows),now).detail,/newer backup has not completed/);
});

test('old, pre-import and future-dated evidence never turns green',()=>{
  assert.equal(interpretSupabaseBackups(payload([{status:'COMPLETED',inserted_at:'2026-09-12T00:00:00Z'}]),now).state,'warning');
  assert.match(interpretSupabaseBackups(payload(),now,'2026-09-15T01:34:58Z').detail,/predates/);
  assert.throws(()=>interpretSupabaseBackups(payload([{status:'COMPLETED',inserted_at:'2099-01-01T00:00:00Z'}]),now));
  assert.throws(()=>interpretSupabaseBackups(payload(),now,'bad-date'));
  assert.equal(interpretSupabaseBackups(payload(),now,'2026-09-15T00:00:00Z').state,'healthy');
});

test('PITR uses a validated recovery point, not an obsolete scheduled backup',()=>{
  const data={...payload([{status:'COMPLETED',inserted_at:'2026-09-01T00:00:00Z'}]),pitr_enabled:true,physical_backup_data:{earliest_physical_backup_date_unix:now/1000-86400,latest_physical_backup_date_unix:now/1000-60}};
  assert.equal(interpretSupabaseBackups(data,now).state,'healthy');
  assert.match(interpretSupabaseBackups(data,now).value,/Recovery point/);
  data.physical_backup_data.latest_physical_backup_date_unix=0;
  assert.throws(()=>interpretSupabaseBackups(data,now));
});

test('provider denial, throttling, timeout, invalid JSON and malformed schema cannot leak or retain success',async()=>{
  const initial=await getSupabaseBackupHealth({...options,fetcher:async()=>Response.json(payload())});
  assert.equal(initial.state,'healthy');
  const responses=[401,403,429,500,503].map(status=>async()=>Response.json({error:token},{status}));
  responses.push(async()=>{throw Error(token)},async()=>new Response('<html>failed</html>'),async()=>Response.json({}),async()=>Response.json(payload([{status:'COMPLETED',inserted_at:null}])));
  for(const fetcher of responses){
    const result=await getSupabaseBackupHealth({...options,fetcher});
    assert.equal(result.state,'warning'); assert.equal(result.verifiedAt,null);
    assert.doesNotMatch(JSON.stringify(result),new RegExp(token)); assert.doesNotMatch(result.value,/Sep 14/);
  }
});

test('summary never claims services are online if a core check failed and excludes unconfigured independent backups',()=>{
  const checks=['database','users','file-storage','database-usage','storage-usage','database-backup'].map(id=>({id,state:'healthy'}));
  checks.push({id:'file-backup',state:'unavailable'},{id:'deployment',state:'warning'});
  assert.equal(summarizeHealth(checks,recent).state,'healthy');
  checks[5].state='unavailable';
  assert.match(summarizeHealth(checks,recent).label,/online · database backup status needs attention/);
  checks[0].state='warning';
  assert.doesNotMatch(summarizeHealth(checks,recent).label,/online/);
});

const source=fs.readFileSync(new URL('../app/api/system-health/route.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function routeHarness(allowed){
  let providerCalls=0;
  const modules={
    '../../../db/bootstrap':{ensureDatabase:async()=>({prepare:()=>({first:async()=>({online:1,count:50,databaseBytes:100,storageBytes:200,objectCount:24,bucketCount:2,authUserCount:2,monitoringSince:'2026-09-01T00:00:00Z',attemptCount24h:0,failedCount24h:0})})})},
    '../../server-permissions':{hasPermission:async(_r,_db,p)=>{assert.equal(p,'settings.manage');return allowed}},
    '../../supabase-config':{getPublicSupabaseConfig:()=>({url:options.supabaseUrl})},
    '../../lib/supabase-backup-health':{getSupabaseBackupHealth:async(o)=>{providerCalls++;assert.equal(o.projectRef,ref);return {id:'database-backup',state:'healthy',value:'fixture-only'}}},
    '../../system-health-model':{summarizeHealth},
  };
  const exports={};vm.runInNewContext(code,{exports,Response,Date,process:{env:{SUPABASE_BACKUP_PROJECT_REF:ref,SUPABASE_BACKUP_ACCESS_TOKEN:token,VERCEL_ENV:'preview'}},require:n=>{assert.ok(n in modules,n);return modules[n]}});
  return {get:exports.GET,calls:()=>providerCalls};
}
test('API denies unauthorized users before requesting provider metadata',async()=>{
  const h=routeHarness(false);assert.equal((await h.get(new Request('https://portal.test/api/system-health'))).status,403);assert.equal(h.calls(),0);
});
test('authorized API integrates sanitized backup status and is never publicly cached',async()=>{
  const h=routeHarness(true);const res=await h.get(new Request('https://portal.test/api/system-health'));
  assert.equal(res.status,200);assert.equal(h.calls(),1);assert.match(res.headers.get('cache-control'),/private, no-store/);
  const data=await res.json(); assert.equal(data.checks.find(x=>x.id==='database-backup').value,'fixture-only');
  assert.equal(data.checks.find(x=>x.id==='deployment').statusLabel,'Preview');
  assert.equal(data.checks.find(x=>x.id==='file-backup').value,'Not configured');
  assert.doesNotMatch(JSON.stringify(data),new RegExp(token));
});
