import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {nfpaInspectionStarter,nfpaInspectionSeedSql,nfpaBookUrl} from '../scripts/inspection-nfpa-seed.mjs';
import {inspectionStarter,inspectionSeedSql} from '../scripts/inspection-code-seed.mjs';
import {trainingModules} from './helpers/training-modules.mjs';
const load=trainingModules(),codes=load('app/fire-inspections/codes.ts'),model=load('app/fire-inspections/model.ts');
const entries=nfpaInspectionStarter().map(({key,data})=>({id:key,data,version:1,archived:false,updatedAt:'',updatedBy:''}));
test('25 NFPA prompts retain 2027 identity and do not claim local adoption',()=>{
 const nfpa=entries.filter(c=>c.data.type==='NFPA 101');assert.equal(nfpa.length,25);assert.equal(new Set(entries.map(c=>c.id)).size,26);
 for(const c of entries)assert.deepEqual(codes.normalizeCode(c.data),c.data);
 for(const c of nfpa){assert.equal(c.data.edition,'2027');assert.equal(c.data.sourceUrl,nfpaBookUrl);assert.equal(c.data.effectiveDate,'');assert.equal(c.data.frequent,'');assert.equal(codes.needsAdoptionReview(c.data),true);assert.match(c.data.applicability,/2015/);assert.match(c.data.text,/section locator/);}
 const adoption=entries.find(c=>c.data.type==='State rule');assert.equal(adoption.data.edition,'2015');assert.match(adoption.data.sourceUrl,/041001000000070R/);
 assert.equal(codes.searchCodes(entries,'','NFPA 101','2015').length,0);
});
test('NFPA and IBC filters remain separate and search finds useful inspection topics',()=>{
 const all=[...entries,...inspectionStarter().map(({key,data})=>({id:key,data,version:1,archived:false}))];
 assert.equal(codes.searchCodes(all,'','NFPA 101','2027').length,25);assert.equal(codes.searchCodes(all,'','IBC','2009').length,150);
 assert.ok(codes.searchCodes(all,'extinguisher','NFPA 101','2027').some(c=>c.data.section==='9.9'));
 assert.ok(codes.searchCodes(all,'emergency lighting','NFPA 101','2027').some(c=>c.data.section==='7.9'));
 assert.ok(codes.searchCodes(all,'','NFPA 101','2027','','Water systems').length>=3);
 const selected=codes.selectCode(entries[0]);entries[0].data={...entries[0].data,frequent:'yes'};assert.equal(selected.frequent,'');assert.equal(codes.searchCodes(entries,'','NFPA 101','2027','','',true).length,1);
});
test('adding a code checkpoint never invents observations, results, citations, or signatures',()=>{
 const entry=entries.find(c=>c.data.section==='9.9'),check=model.checkpointFromCode(entry,'fixture-check');
 assert.equal(check.result,'Not checked');assert.equal(check.observation,'');assert.equal(check.code,'');assert.deepEqual(check.citations,[]);assert.equal(check.label,entry.data.title);assert.match(check.source,/2027/);assert.match(check.source,/ADOPTION NOT VERIFIED/);
 const data=model.emptyInspection();data.title='test/inspection';data.test=true;data.sections=['Code library'];data.checks=[check];data.representative={...model.blankSignature(),state:'Signed',name:'Fictional',strokes:[[[0,0],[1,1]]]};
 const normalized=model.normalizeInspection(data);assert.deepEqual(normalized.checks[0],check);
 const changed=model.updateInspectionDetail(data,'checks',[]);assert.equal(changed.representative.state,'Not requested');assert.equal(changed.inspectorAttested,false);
 assert.throws(()=>model.checkpointFromCode({...entry,archived:true},'archived'));
 const long=model.checkpointFromCode({...entry,data:{...entry.data,text:'X'.repeat(40000)}},'long');assert.equal(long.source.length,4000);assert.match(long.source,/Source: https:/);
});
test('NFPA seeding is idempotent and preserves existing IBC edits and original citation versions',async()=>{
 const pg=new PGlite();try{
  await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;');
  await pg.exec(readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0]);
  await pg.exec(readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));
  await pg.query(inspectionSeedSql('fixture-department'));
  await pg.exec("UPDATE fire_inspection_code_entries SET payload='prior edit',version=2 WHERE id='ref-fixture-department-ibc-2009-901-2'");
  assert.equal((await pg.query(nfpaInspectionSeedSql('fixture-department'))).rows[0].inserted,26);
  assert.equal((await pg.query(nfpaInspectionSeedSql('fixture-department'))).rows[0].inserted,0);
  assert.equal((await pg.query("SELECT payload FROM fire_inspection_code_entries WHERE id='ref-fixture-department-ibc-2009-901-2'")).rows[0].payload,'prior edit');
  assert.equal((await pg.query('SELECT count(*)::int n FROM fire_inspection_code_audit')).rows[0].n,210);
  assert.equal((await pg.query("SELECT count(*)::int n FROM fire_inspection_code_entries WHERE department_id='fixture-department'")).rows[0].n,210);
 }finally{await pg.close();}
});
