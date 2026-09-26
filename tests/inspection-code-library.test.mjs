import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {inspectionStarter,inspectionSeedSql,bookUrl} from '../scripts/inspection-code-seed.mjs';
import {trainingModules} from './helpers/training-modules.mjs';
const {normalizeCode,searchCodes,selectCode,localAmendmentQuery}=trainingModules()('app/fire-inspections/codes.ts');
const entries=inspectionStarter().map(({key,data})=>({id:key,data,version:1,archived:false}));

test('starter has 150 distinct IBC 2009 locators and 34 linked local provisions',()=>{
 const ibc=entries.filter(c=>c.data.type==='IBC'),local=entries.filter(c=>c.data.type==='Local ordinance');
 assert.equal(ibc.length,150);assert.equal(local.length,34);assert.equal(new Set(entries.map(c=>c.id)).size,184);
 for(const e of entries){assert.deepEqual(normalizeCode(e.data),e.data);assert.equal(e.data.edition,'2009');assert.ok(e.data.category);assert.equal(e.data.frequent,'');assert.equal(e.data.effectiveDate,'');assert.ok(new URL(e.data.sourceUrl).protocol==='https:');}
 for(const e of ibc){const u=new URL(e.data.sourceUrl);assert.ok(e.data.sourceUrl.startsWith(bookUrl));assert.match(u.hash,/^#page=\d+$/);assert.ok(Number(u.hash.split('=')[1])>=122);assert.match(e.data.text,/not the complete code text/);}
 assert.ok(ibc.find(c=>c.data.section==='903.3.5').data.applicability.includes('STICKNEY AMENDMENT:'));
 assert.ok(local.find(c=>c.data.section.includes('912.1.1')).data.text.includes('unclear'));
});

test('edition, topic, type, frequent, archive and multiword search compose without dropping references',()=>{
 const future={...entries[0],id:'fictional-future',data:{...entries[0].data,edition:'2099',category:'Fictional test topic',frequent:'yes',title:'Fictional alarm reference'}};
 assert.equal(searchCodes(entries).length,184);assert.equal(searchCodes([...entries,future],'','IBC','2009').length,150);
 assert.deepEqual(searchCodes([...entries,future],'alarm reference','IBC','2099','','Fictional test topic',true).map(c=>c.id),['fictional-future']);
 assert.equal(searchCodes([{...future,archived:true}]).length,0);
 assert.ok(searchCodes(entries,'','IBC','2009','','Exit doors').length>10);
 assert.ok(searchCodes(entries,'903.3.5','Local ordinance','2009').every(c=>c.data.type==='Local ordinance'));
 assert.equal(searchCodes(entries,'','','','','',true).length,0);
 const old=selectCode(future),updated={...future,version:2,data:{...future.data,text:'Changed after selection'}};
 assert.notEqual(old.text,selectCode(updated).text);assert.equal(old.version,1);
});

test('local-change links find parent amendments as well as direct and child provisions',()=>{
 for(const section of ['903.2.1.2','903.3.5','903.4','907.2.7','1006.3']) {
  const entry=entries.find(c=>c.data.type==='IBC'&&c.data.section===section);
  const query=localAmendmentQuery(entries,entry.data);
  assert.ok(searchCodes(entries,query,'Local ordinance','2009').length>0,section);
 }
 assert.equal(localAmendmentQuery(entries,entries.find(c=>c.data.type==='IBC'&&c.data.section==='903.2.1.2').data),'903.2');
});

test('seed is atomic, repeatable and preserves department data, edits, archives and citation audits',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;');
  const base=readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0];
  await pg.exec(base);await pg.exec(readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));
  const sql=inspectionSeedSql('fixture-department');assert.equal((await pg.query(sql)).rows[0].inserted,184);
  assert.equal((await pg.query('SELECT COUNT(*)::int n FROM fire_inspection_code_audit')).rows[0].n,184);
  await pg.exec("UPDATE fire_inspection_code_entries SET payload='user edit preserved',version=2,archived=1 WHERE id='ref-fixture-department-ibc-2009-901-2'");
  assert.equal((await pg.query(sql)).rows[0].inserted,0);
  assert.deepEqual((await pg.query("SELECT payload,version,archived FROM fire_inspection_code_entries WHERE id='ref-fixture-department-ibc-2009-901-2'")).rows[0],{payload:'user edit preserved',version:2,archived:1});
  const old=(await pg.query("SELECT payload FROM fire_inspection_code_audit WHERE code_id='ref-fixture-department-ibc-2009-901-2'")).rows[0];assert.equal(JSON.parse(old.payload).edition,'2009');
  assert.equal((await pg.query(inspectionSeedSql('second-department'))).rows[0].inserted,184);
  assert.equal((await pg.query("SELECT COUNT(*)::int n FROM fire_inspection_code_entries WHERE department_id='fixture-department'")).rows[0].n,184);
  await pg.exec("CREATE FUNCTION reject_code_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;CREATE TRIGGER reject_code_audit BEFORE INSERT ON fire_inspection_code_audit FOR EACH ROW EXECUTE FUNCTION reject_code_audit();");
  await assert.rejects(()=>pg.query(inspectionSeedSql('rollback-department')),/test failure/);
  assert.equal((await pg.query("SELECT COUNT(*)::int n FROM fire_inspection_code_entries WHERE department_id='rollback-department'")).rows[0].n,0);
 }finally{await pg.close();}
});
