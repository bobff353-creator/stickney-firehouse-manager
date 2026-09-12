import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as symbols from '../app/preplans/photo-illustrations.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function moduleAt(path,dependencies){
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{if(!(name in dependencies))throw Error('Unexpected import '+name);return dependencies[name];},Response,Request,JSON,Set,Number,Error});
  return module.exports;
}
const store=moduleAt('app/preplans/photo-illustration-store.ts',{'./photo-illustrations':symbols});
const mark={id:'mark-one',symbol:'fdc',x:43,y:55,size:9,rotation:90,label:'Fictional'};
test('symbol validation bounds image-only geometry, size, count and text',()=>{
  assert.deepEqual(symbols.validateIllustrations([mark]),[mark]);
  for(const invalid of [null,{},Array(81).fill(mark),[mark,mark],[{...mark,x:NaN}],[{...mark,y:101}],[{...mark,size:0}],[{...mark,rotation:-1}],[{...mark,symbol:'map-feature'}],[{...mark,label:'x'.repeat(33)}]])assert.throws(()=>symbols.validateIllustrations(invalid));
  assert.deepEqual(symbols.readIllustrations('not-json'),[]);
  assert.deepEqual(symbols.readIllustrations(JSON.stringify([mark])),[mark]);
  assert.equal(new Set(symbols.photoSymbols.map(([id])=>id)).size,symbols.photoSymbols.length);
  assert.equal(symbols.validateIllustrations([{...mark,latitude:99,featureId:'other'}])[0].featureId,undefined,'operational linking fields are never retained');
});
test('Postgres migration and indexed CAS preserve original photos, enforce version and touch parent atomically',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`CREATE SCHEMA firehouse; SET search_path=firehouse;
      CREATE TABLE field_preplans(id text PRIMARY KEY,updated_by text,updated_at text);
      CREATE TABLE field_preplan_photos(id text PRIMARY KEY,preplan_id text REFERENCES field_preplans(id),feature_id text,side text,object_key text,caption text);
      INSERT INTO field_preplans VALUES('plan','original','old');
      INSERT INTO field_preplan_photos VALUES('photo','plan',NULL,'A','private/original.jpg','original caption');`);
    await db.exec(read('supabase/migrations/20260912222701_preplan_photo_illustrations.sql'));
    await db.exec(read('supabase/migrations/20260912222701_preplan_photo_illustrations.sql'));
    let n=0;const sql=store.savePhotoIllustrationsSql.replaceAll('?',()=>'$'+(++n));
    const args=(version,marks=[mark],caption='saved caption')=>[JSON.stringify(marks),caption,'photo','plan',version,JSON.stringify(marks),caption,'fixture'];
    const result=await db.query(sql,args(0));assert.equal(result.rows[0].version,1);
    assert.equal((await db.query('SELECT object_key FROM field_preplan_photos')).rows[0].object_key,'private/original.jpg');
    assert.equal((await db.query('SELECT updated_by FROM field_preplans')).rows[0].updated_by,'fixture');
    assert.equal((await db.query(sql,args(0))).rows.length,0,'stale write rejected');
    assert.equal((await db.query(sql,args(1))).rows.length,0,'no-op creates no new version');
    await db.exec('BEGIN');await db.query(sql,args(1,[],'remove symbols'));await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT illustration_version FROM field_preplan_photos')).rows[0].illustration_version,1,'rollback preserves symbols and version');
    const cross=args(1,[]);cross[3]='different-plan';assert.equal((await db.query(sql,cross)).rows.length,0,'cannot cross a preplan boundary');
    await db.exec("UPDATE field_preplan_photos SET feature_id='mapped-feature'");assert.equal((await db.query(sql,args(1,[]))).rows.length,0,'mapped feature photos are excluded');
    await db.exec("UPDATE field_preplan_photos SET feature_id=NULL,side='B'");assert.equal((await db.query(sql,args(1,[]))).rows[0].version,2,'removing all marks is saved');
    await db.exec('SET enable_seqscan=off');const plan=await db.query('EXPLAIN '+sql,args(2,[{...mark,label:'new'}]));assert.ok(JSON.stringify(plan.rows).includes('Index Scan'),'CAS uses photo primary key');
  }finally{await db.close();}
});
function apiHarness(options={}){
  let writes=0;
  const photo={preplanId:'plan',side:'A',featureId:null,illustrations:'[]',caption:'original',version:0,publicationStatus:'published',createdBy:'fixture',updatedBy:'fixture',...options.photo};
  const db={prepare(sql){return{bind(...args){assert.equal(args[0],'photo');return{first:async()=>options.missing?null:photo};}};}};
  const route=moduleAt('app/api/field-preplans/photos/[photoId]/illustrations/route.ts',{
    '../../../../../../db/bootstrap':{ensureDatabase:async()=>db},
    '../../../../../server-permissions':{hasPermission:async()=>!options.denied,preplanReadAccess:async()=>({}),canReadPreplanLifecycle:()=>!options.hidden},
    '../../../../../preplans/photo-illustrations':symbols,
    '../../../../../preplans/photo-illustration-store':{...store,savePhotoIllustrations:async()=>{writes++;if(options.fail)throw Error('secret database detail');return options.race?null:{id:'photo',version:1};}},
  });
  return{writes:()=>writes,get:()=>route.GET(new Request('http://localhost/api/field-preplans/photos/photo/illustrations'),{params:Promise.resolve({photoId:'photo'})}),patch:body=>route.PATCH(new Request('http://localhost/api/field-preplans/photos/photo/illustrations',{method:'PATCH',headers:{'oai-authenticated-user-email':'fixture@example.invalid'},body:JSON.stringify(body)}),{params:Promise.resolve({photoId:'photo'})})};
}
test('reopening checks fresh metadata with private no-store and current view permission',async()=>{
  const h=apiHarness({photo:{illustrationVersion:4,illustrations:JSON.stringify([mark])}});const response=await h.get();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');const body=await response.json();assert.equal(body.illustrationVersion,4);assert.deepEqual(body.illustrations,[mark]);assert.equal(h.writes(),0);
  assert.equal((await apiHarness({denied:true}).get()).status,403);assert.equal((await apiHarness({hidden:true}).get()).status,404);
});
test('actual API checks attachment permission, lifecycle, version and side before any write',async()=>{
  const body={version:0,caption:'new',illustrations:[mark]};
  for(const [options,status] of [[{denied:true},403],[{hidden:true},404],[{missing:true},404],[{photo:{side:'FEATURE'}},400],[{photo:{featureId:'real-asset'}},400],[{photo:{version:2}},409]]){
    const h=apiHarness(options);assert.equal((await h.patch(body)).status,status);assert.equal(h.writes(),0);
  }
  const h=apiHarness();assert.equal((await h.patch({...body,illustrations:[{...mark,x:-1}]})).status,400);assert.equal(h.writes(),0);
});
test('actual API confirms success/no-op and returns conflicts/failures without exposing internals',async()=>{
  const body={version:0,caption:'new',illustrations:[mark]};
  const h=apiHarness();assert.equal((await h.patch(body)).status,200);assert.equal(h.writes(),1);
  const noOp=apiHarness();assert.equal((await (await noOp.patch({version:0,caption:'original',illustrations:[]})).json()).unchanged,true);assert.equal(noOp.writes(),0);
  for(const [options,status] of [[{race:true},409],[{fail:true},500]]){const h=apiHarness(options);const response=await h.patch(body);assert.equal(response.status,status);assert.ok(!(await response.text()).includes('secret'));}
});
