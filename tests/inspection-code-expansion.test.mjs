import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {inspectionExpansion,inspectionExpansionSql} from '../scripts/inspection-code-expansion.mjs';
import {inspectionStarter,inspectionSeedSql} from '../scripts/inspection-code-seed.mjs';
import {nfpaInspectionStarter,nfpaInspectionSeedSql} from '../scripts/inspection-nfpa-seed.mjs';
import {nfpa101bInspectionStarter,nfpa101bInspectionSeedSql} from '../scripts/inspection-nfpa101b-seed.mjs';
import {trainingModules} from './helpers/training-modules.mjs';

const load=trainingModules(),codes=load('app/fire-inspections/codes.ts'),model=load('app/fire-inspections/model.ts');
const added=inspectionExpansion(),prior=[...inspectionStarter(),...nfpaInspectionStarter(),...nfpa101bInspectionStarter()];
const identity=r=>[r.data.type,r.data.edition,r.data.section].join('|');
const entries=rows=>rows.map(({key,data})=>({id:key,data,version:1,archived:false,updatedAt:'',updatedBy:''}));

test('600 additions are distinct from every starter locator and retain usable source and adoption metadata',()=>{
 assert.equal(added.length,600);
 assert.equal(new Set(added.map(r=>r.key)).size,600);
 assert.equal(new Set([...prior,...added].map(identity)).size,831);
 for(const type of ['IBC','NFPA 101','NFPA 101B','Local ordinance'])assert.equal(added.filter(r=>r.data.type===type).length,150);
 for(const {data} of added){
  assert.deepEqual(codes.normalizeCode(data),data);
  assert.equal(data.effectiveDate,'');assert.equal(data.frequent,'');
  assert.ok(data.section&&data.category);
  assert.equal(data.jurisdiction,'Village of Stickney, Illinois');
  if(data.type.startsWith('NFPA')){
   assert.equal(new URL(data.sourceUrl).hostname,'link.nfpa.org');
   assert.equal(codes.needsAdoptionReview(data),true);
   assert.match(data.text,/Inspection prompt:/);
   if(data.type==='NFPA 101B')assert.match(data.applicability,/viewer page (18|19|20|32|34|35|36|37|38|39),/);
  }else if(data.type==='IBC'){
   assert.match(data.sourceUrl,/#page=\d+$/);
   assert.match(data.applicability,/18-101.*18-102/);
  }else{
   assert.equal(new URL(data.sourceUrl).hostname,'library.municode.com');
   assert.match(data.sourceUrl,/\/il\/stickney\//);
   assert.match(data.text,/^Published municipal provision:/);
   assert.doesNotMatch(data.text,/SHARE LINK|PRINT SECTION|DOWNLOAD \(DOCX\)|EMAIL SECTION|\bEXPAND\b/);
  }
 }
 assert.throws(()=>inspectionExpansionSql("invalid' OR 1=1"),/verified department ID/);
});

test('all four filters search the increased sets without merging editions or hiding clause sources',()=>{
 const all=entries([...prior,...added]);
 assert.equal(codes.searchCodes(all,'','IBC','2009').length,300);
 assert.equal(codes.searchCodes(all,'','NFPA 101','2027').length,175);
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2002').length,171);
 assert.equal(codes.searchCodes(all,'','Local ordinance').length,184);
 assert.equal(codes.searchCodes(all,'','NFPA 101B','2027').length,0);
 assert.ok(codes.searchCodes(all,'sleep pods','NFPA 101','2027').some(c=>c.data.section==='4.9'));
 assert.ok(codes.searchCodes(all,'day-care closet','NFPA 101B','2002').some(c=>c.data.section==='5.5.1.12'));
 assert.ok(codes.searchCodes(all,'18-353','Local ordinance').some(c=>c.data.category==='Emergency radio coverage'));
 const local=codes.searchCodes(all,'34-2(6) / IFC 903.10','Local ordinance','2009').find(c=>c.data.section==='34-2(6) / IFC 903.10');
 assert.ok(local);assert.match(local.data.text,/300 feet.*100 feet/s);
 assert.match(local.data.applicability,/separate from the IBC/);
 const archived={...all[all.length-1],archived:true};
 assert.equal(codes.searchCodes([archived]).length,0);
});

test('added checkpoints begin unchecked and saved citations retain their original version and source',()=>{
 for(const type of ['IBC','NFPA 101','NFPA 101B','Local ordinance']){
  const entry=entries(added).find(c=>c.data.type===type),checkpoint=model.checkpointFromCode(entry,'fixture-'+type);
  assert.equal(checkpoint.result,'Not checked');assert.equal(checkpoint.observation,'');
  assert.equal(checkpoint.code,'');assert.deepEqual(checkpoint.citations,[]);
  assert.ok(checkpoint.source.includes(entry.data.sourceUrl));
  const inspection=model.emptyInspection();inspection.title='Fixture';inspection.test=true;inspection.sections=['Code library'];inspection.checks=[checkpoint];
  assert.equal(model.findings(inspection).length,0);
  assert.deepEqual(model.normalizeInspection(inspection).checks[0],checkpoint);
  const selected=codes.selectCode(entry),edited={...entry,version:2,data:{...entry.data,title:'Later department edit'}};
  assert.equal(selected.version,1);assert.equal(selected.sourceUrl,entry.data.sourceUrl);
  assert.notEqual(selected.title,edited.data.title);
 }
});

test('the full expansion is atomic, tenant scoped and idempotent, preserving prior and later edits and audits',async()=>{
 const pg=new PGlite();try{
  await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;');
  await pg.exec(readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0]);
  await pg.exec(readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));
  await pg.query(inspectionSeedSql('fixture-department'));
  await pg.query(nfpaInspectionSeedSql('fixture-department'));
  await pg.query(nfpa101bInspectionSeedSql('fixture-department'));
  await pg.query(inspectionSeedSql('other-department',[prior[0]]));
  await pg.exec("UPDATE fire_inspection_code_entries SET payload='prior admin edit',version=2,archived=1 WHERE id='ref-fixture-department-ibc-2009-901-2'");
  const oldRows=(await pg.query('SELECT * FROM fire_inspection_code_entries ORDER BY id')).rows;
  const oldAudits=(await pg.query('SELECT * FROM fire_inspection_code_audit ORDER BY id')).rows;
  const failId='ref-fixture-department-'+added.at(-1).key;
  await pg.exec(`ALTER TABLE fire_inspection_code_audit ADD CONSTRAINT fixture_reject_audit CHECK(code_id<>'${failId}')`);
  await assert.rejects(pg.query(inspectionExpansionSql('fixture-department')),/fixture_reject_audit/);
  assert.deepEqual((await pg.query('SELECT * FROM fire_inspection_code_entries ORDER BY id')).rows,oldRows);
  assert.deepEqual((await pg.query('SELECT * FROM fire_inspection_code_audit ORDER BY id')).rows,oldAudits);
  await pg.exec('ALTER TABLE fire_inspection_code_audit DROP CONSTRAINT fixture_reject_audit');
  assert.equal((await pg.query(inspectionExpansionSql('fixture-department'))).rows[0].inserted,600);
  assert.equal((await pg.query(inspectionExpansionSql('fixture-department'))).rows[0].inserted,0);
  assert.deepEqual((await pg.query("SELECT * FROM fire_inspection_code_entries WHERE id NOT LIKE 'ref-fixture-department-expansion-%' ORDER BY id")).rows,oldRows);
  assert.deepEqual((await pg.query("SELECT * FROM fire_inspection_code_audit WHERE code_id NOT LIKE 'ref-fixture-department-expansion-%' ORDER BY id")).rows,oldAudits);
  const changedId='ref-fixture-department-'+added[0].key;
  await pg.query('UPDATE fire_inspection_code_entries SET payload=$1,version=2,archived=1 WHERE id=$2',['new admin edit',changedId]);
  await pg.query("INSERT INTO fire_inspection_code_audit SELECT id||'-v2',department_id,id,version,payload,archived,'Fixture admin',updated_at FROM fire_inspection_code_entries WHERE id=$1",[changedId]);
  const editedRows=(await pg.query('SELECT * FROM fire_inspection_code_entries ORDER BY id')).rows;
  const editedAudits=(await pg.query('SELECT * FROM fire_inspection_code_audit ORDER BY id')).rows;
  assert.equal((await pg.query(inspectionExpansionSql('fixture-department'))).rows[0].inserted,0);
  assert.deepEqual((await pg.query('SELECT * FROM fire_inspection_code_entries ORDER BY id')).rows,editedRows);
  assert.deepEqual((await pg.query('SELECT * FROM fire_inspection_code_audit ORDER BY id')).rows,editedAudits);
  assert.equal((await pg.query("SELECT count(*)::int n FROM fire_inspection_code_entries WHERE department_id='fixture-department'")).rows[0].n,831);
  assert.equal((await pg.query("SELECT count(*)::int n FROM fire_inspection_code_entries WHERE department_id='other-department'")).rows[0].n,1);
 }finally{await pg.close();}
});
