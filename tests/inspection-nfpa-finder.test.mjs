import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
const directory=JSON.parse(readFileSync('app/fire-inspections/nfpa-directory.json','utf8'));
const load=trainingModules({[resolve('app/fire-inspections/nfpa-directory.json.ts')]:{default:directory}});
const refs=load('app/fire-inspections/nfpa-references.ts'),model=load('app/fire-inspections/model.ts');

test('all nine observed directory pages are indexed once with official links',()=>{
 assert.equal(directory.entries.length,424);
 assert.equal(new Set(directory.entries.map(e=>e.number)).size,424);
 assert.deepEqual(Array.from({length:9},(_,i)=>directory.entries.filter(e=>e.directoryPage===i+1).length),[48,48,48,48,48,48,48,48,40]);
 for(const ref of directory.entries){
  assert.equal(new URL(ref.url).hostname,'www.nfpa.org');
  for(const edition of ref.editions||[]){assert.equal(new URL(edition.url).hostname,'link.nfpa.org');assert.equal(new URL(edition.url).pathname.split('/').at(-1),edition.year);assert.match(edition.year,/^\d{4}$/);}
 }
 assert.equal(directory.entries.filter(e=>e.editions).length,32);
 assert.equal(directory.entries.flatMap(e=>e.editions||[]).length,41);
});
test('number searches do not conflate NFPA 10, 101, 101A and 101B',()=>{
 for(const number of ['10','101','101A','101B'])for(const prefix of ['','NFPA ','NFPA-'])assert.deepEqual(refs.searchNfpa(prefix+number).map(r=>r.number),['NFPA '+number]);
 assert.equal(refs.searchNfpa('999999').length,0);
 assert.equal(refs.searchNfpa('', '', true).length,424);
 assert.equal(refs.searchNfpa('').length,32);
 // Searches reach specialized entries without having to change the default browse scope.
 assert.ok(refs.searchNfpa('aircraft').some(r=>!r.guide));
 assert.equal(refs.searchNfpa('10','Special hazards').length,0);
});
test('plain language searches surface relevant references and obey topic filters',()=>{
 for(const [q,number] of [['hood','NFPA 96'],['sprinkler service','NFPA 25'],['fire door','NFPA 80'],['battery','NFPA 855'],['extension cord','NFPA 70'],['hot work','NFPA 51B']])assert.ok(refs.searchNfpa(q).some(r=>r.number===number),q);
 assert.ok(refs.searchNfpa('','Special hazards').every(r=>r.guide.group==='Special hazards'));
 assert.equal(refs.searchNfpa('unfindable topic').length,0);
});
test('checkpoint additions preserve selected source editions without manufacturing findings or adoption',()=>{
 const original=model.emptyInspection();original.title='test/inspection';original.test=true;original.codeEdition='Existing department decision';original.codeBasis=[];
 original.representative={name:'Test',role:'Test',state:'Signed',strokes:[[[0,0],[1,1]]],signedAt:'2026-09-25'};original.inspectorAttested=true;
 let i=0;
 const next=refs.addNfpaCheckpoints(original,[{number:'NFPA 10',year:'2022'},{number:'NFPA 96',year:'2024'}],()=>`nfpa-${++i}`);
 assert.equal(next.checks.length,original.checks.length+2);assert.equal(next.codeEdition,original.codeEdition);assert.deepEqual(next.codeBasis,[]);
 assert.equal(next.representative.state,'Not requested');assert.equal(next.inspectorAttested,false);
 for(const c of next.checks.slice(-2)){assert.equal(c.result,'Not checked');assert.equal(c.observation,'');assert.equal(c.correction,'');assert.equal(c.code,'');assert.deepEqual(c.citations,[]);assert.match(c.source,/local adoption and applicability are not verified/);}
 assert.match(next.checks.at(-2).source,/publications\/10\/2022/);assert.match(next.checks.at(-1).source,/publications\/96\/2024/);
 assert.equal(model.findings(next).length,0);
 assert.deepEqual(model.normalizeInspection(next).checks,next.checks);
 assert.equal(original.representative.state,'Signed');
 const again=refs.addNfpaCheckpoints(next,[{number:'NFPA 10',year:'2022'},{number:'NFPA 10',year:'2022'}],()=>`nfpa-${++i}`);
 assert.equal(again,next);
});
test('unknown editions and capacity overflow fail without partial modifications',()=>{
 const data=model.emptyInspection();
 assert.throws(()=>refs.addNfpaCheckpoints(data,[{number:'NFPA 10',year:'1900'}],()=> 'bad'),/verified research edition/);
 assert.throws(()=>refs.addNfpaCheckpoints(data,[{number:'NFPA 99999',year:'2026'}],()=> 'bad'),/inspection reference/);
 const full={...data,checks:Array.from({length:200},(_,i)=>model.freshCheck({id:String(i),label:'Test',section:'Test',source:''}))};
 assert.throws(()=>refs.addNfpaCheckpoints(full,[{number:'NFPA 10',year:'2026'}],()=> 'over-limit'),/200 checkpoints/);
 assert.equal(full.checks.length,200);
});
