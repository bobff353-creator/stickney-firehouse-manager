import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {nfpa101bInspectionStarter,nfpa101bInspectionSeedSql,nfpa101bBookUrl} from '../scripts/inspection-nfpa101b-seed.mjs';
import {nfpaInspectionStarter,nfpaInspectionSeedSql} from '../scripts/inspection-nfpa-seed.mjs';
import {inspectionStarter,inspectionSeedSql} from '../scripts/inspection-code-seed.mjs';
import {trainingModules} from './helpers/training-modules.mjs';
const load=trainingModules(),codes=load('app/fire-inspections/codes.ts'),model=load('app/fire-inspections/model.ts');
const asEntries=rows=>rows.map(({key,data})=>({id:key,data,version:1,archived:false,updatedAt:'',updatedBy:''}));
const entries=asEntries(nfpa101bInspectionStarter());

test('NFPA 101B retains separate 2002 identity, applicability and original observation prompts',()=>{
 assert.equal(entries.length,21);assert.equal(new Set(entries.map(c=>c.id)).size,21);
 for(const c of entries){assert.deepEqual(codes.normalizeCode(c.data),c.data);assert.equal(c.data.type,'NFPA 101B');assert.equal(c.data.edition,'2002');assert.equal(c.data.sourceUrl,nfpa101bBookUrl);assert.equal(c.data.effectiveDate,'');assert.equal(c.data.frequent,'');assert.equal(codes.needsAdoptionReview(c.data),true);assert.match(c.data.applicability,/Chapter 5 addresses new construction/);assert.match(c.data.applicability,/Chapter 7 addresses alterations/);assert.match(c.data.text,/Inspection prompt:/);}
});

test('search and edition filters keep NFPA 101B, NFPA 101, IBC and local references distinct',()=>{
 const all=[...entries,...asEntries(nfpaInspectionStarter()),...asEntries(inspectionStarter())];
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2002').length,21);
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2027').length,0);
 assert.equal(codes.searchCodes(all,'','NFPA 101','2027').length,25);
 assert.equal(codes.searchCodes(all,'','IBC','2009').length,150);
 assert.ok(codes.searchCodes(all,'locks','NFPA 101B','2002').some(c=>c.data.section==='5.2.1.5'));
 assert.ok(codes.searchCodes(all,'emergency lighting','NFPA 101B','2002').some(c=>c.data.section==='5.9'));
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2002','','Doors and hardware').length,4);
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2002','','',true).length,0);
});

test('NFPA 101B checkpoints save without inventing findings and citations retain their edition and version',()=>{
 const entry=entries.find(c=>c.data.section==='5.2.1.5'),check=model.checkpointFromCode(entry,'test-101b-door');
 assert.equal(check.result,'Not checked');assert.equal(check.observation,'');assert.equal(check.code,'');assert.deepEqual(check.citations,[]);assert.match(check.source,/NFPA 101B 2002/);assert.match(check.source,/ADOPTION NOT VERIFIED/);assert.match(check.source,/https:\/\/link.nfpa.org/);
 const data=model.emptyInspection();data.title='test/inspection';data.test=true;data.sections=['Code library'];data.checks=[check];
 assert.deepEqual(model.normalizeInspection(data).checks[0],check);assert.equal(model.findings(data).length,0);
 const citation=codes.selectCode(entry);const edited={...entry,version:2,data:{...entry.data,title:'Department wording'}};
 assert.equal(citation.title,entry.data.title);assert.equal(citation.version,1);assert.notEqual(citation.title,edited.data.title);assert.equal(citation.type,'NFPA 101B');
});

test('seeding adds only NFPA 101B and preserves all earlier edits, archives and audit versions',async()=>{
 const pg=new PGlite();try{
  await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;');
  await pg.exec(readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0]);
  await pg.exec(readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));
  await pg.query(inspectionSeedSql('fixture-department'));await pg.query(nfpaInspectionSeedSql('fixture-department'));
  await pg.exec("UPDATE fire_inspection_code_entries SET payload='prior edit',version=2,archived=1 WHERE id='ref-fixture-department-ibc-2009-901-2'");
  const prior=(await pg.query('SELECT * FROM fire_inspection_code_entries ORDER BY id')).rows;
  assert.equal((await pg.query(nfpa101bInspectionSeedSql('fixture-department'))).rows[0].inserted,21);
  assert.equal((await pg.query(nfpa101bInspectionSeedSql('fixture-department'))).rows[0].inserted,0);
  assert.deepEqual((await pg.query("SELECT * FROM fire_inspection_code_entries WHERE id NOT LIKE '%-nfpa-101b-%' ORDER BY id")).rows,prior);
  await pg.exec("UPDATE fire_inspection_code_entries SET payload='101B admin edit',version=2,archived=1 WHERE id='ref-fixture-department-nfpa-101b-2002-5-9'");
  assert.equal((await pg.query(nfpa101bInspectionSeedSql('fixture-department'))).rows[0].inserted,0);
  assert.equal((await pg.query("SELECT payload FROM fire_inspection_code_entries WHERE id='ref-fixture-department-nfpa-101b-2002-5-9'")).rows[0].payload,'101B admin edit');
  assert.match((await pg.query("SELECT payload FROM fire_inspection_code_audit WHERE code_id='ref-fixture-department-nfpa-101b-2002-5-9' AND version=1")).rows[0].payload,/Emergency lighting/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM fire_inspection_code_audit')).rows[0].n,231);
 }finally{await pg.close();}
});
