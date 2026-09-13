import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trainingHarness } from './helpers/training-harness.mjs';
import { trainingSources, officialTrainingSource, ifsiSearchUrl } from '../app/lib/training-sources.ts';
import { parseRomeovilleRegistration, parseNipstaEvents } from '../app/lib/training-parsers.ts';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
test('official sites are preset; arbitrary hosts/paths/credentials/ports cannot become fetch targets', () => {
  for (const [id, source] of Object.entries(trainingSources)) assert.equal(officialTrainingSource(id, source.sourceUrl), source.sourceUrl);
  assert.equal(officialTrainingSource('romeoville', 'https://www.romeoville.org/562/Fire-Rescue-Courses'), trainingSources.romeoville.sourceUrl);
  for (const url of ['https://evil.example/','https://127.0.0.1/','https://user:secret@www.romeoville.org/562/Fire-Rescue-Courses','http://www.romeoville.org/562/Fire-Rescue-Courses','https://www.romeoville.org:8443/562/Fire-Rescue-Courses','https://www.romeoville.org/unknown']) assert.throws(() => officialTrainingSource('romeoville',url));
  const future = new URL(ifsiSearchUrl('2028-12-31')); assert.equal(future.searchParams.get('start_date'),'12/31/2028'); assert.equal(future.searchParams.get('end_date'),'12/31/2029');
});
test('Romeoville form parses multi-month, split-day, phase and location text without inventing dates', () => {
  const form = (title, labels) => `<fieldset><legend>${title}</legend><input type="checkbox">${labels.map(label=>`<label>${label}</label>`).join('')}</fieldset>`;
  const result = parseRomeovilleRegistration(form('Rope Operations',['Sept. 14-18, 2026@North Aurora FD'])+form('Haz-Mat',['September 28-October 2, 2026'])+form('Officer',['Phase 1 - Nov. 2-6, 2026; Phase 2 - Nov. 9-13 and Nov. 16-20, 2026'])+form('Past',['January 1-2, 2026']),trainingSources.romeoville.sourceUrl,'2026-09-13');
  assert.equal(result.length,3); assert.equal(result[0].location,'North Aurora FD'); assert.equal(result[1].endDate,'2026-10-02'); assert.equal(result[2].startDate,'2026-11-02'); assert.equal(result[2].endDate,'2026-11-20'); assert.match(result[2].detail,/Phase 2/);
  assert.throws(()=>parseRomeovilleRegistration('<html>Service unavailable</html>','https://example.invalid','2026-09-13'));
});
test('strict future-only rule excludes today and ongoing sessions, then rolls forward without another import',()=>{
  const html=['September 11-18, 2026','September 12-20, 2026','September 13-15, 2026'].map(date=>`<fieldset><legend>Rope Operations</legend><input type="checkbox"><label>${date}</label></fieldset>`).join('');
  assert.deepEqual(parseRomeovilleRegistration(html,trainingSources.romeoville.sourceUrl,'2026-09-12').map(c=>c.startDate),['2026-09-13']);
  assert.deepEqual(parseRomeovilleRegistration(html,trainingSources.romeoville.sourceUrl,'2026-09-13'),[]);
  const events=[{title:'Rope Rescue Fall Session Rental Main',start:'2026-09-11 08:00:00',end:'2026-09-11 16:00:00'},{title:'Rope Rescue Fall Session Rental Main',start:'2026-09-15 08:00:00',end:'2026-09-15 16:00:00'},{title:'Fire Officer New Session Rental Main',start:'2026-09-13 08:00:00',end:'2026-09-15 16:00:00'}];
  assert.deepEqual(parseNipstaEvents(events,['Rope Rescue','Fire Officer'],trainingSources.nipsta.sourceUrl,'2026-09-12').map(c=>c.title),['Fire Officer']);
  assert.match(readFileSync('app/training-class-cards.tsx','utf8'),/course.startDate > today/);
  assert.match(readFileSync('app/operations-board.tsx','utf8'),/const today = clock.toLocaleDateString/);
});

test('actual card renderer drops same-day classes at Central midnight using the already-saved list',()=>{
  const require=createRequire(import.meta.url),target={exports:{}};
  const source=ts.transpileModule(readFileSync('app/training-class-cards.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports',source)(name=>name.endsWith('.css')?{default:{cards:'cards',card:'card'}}:require(name),target,target.exports);
  const courses=[['Past','2026-09-11'],['Today','2026-09-12'],['Tomorrow','2026-09-13'],['Later','2026-09-14']].map(([title,startDate])=>({title,startDate,endDate:'2026-09-20',location:'Test',detail:'',url:'https://example.invalid'}));
  const format=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
  const render=value=>renderToStaticMarkup(createElement(target.exports.TrainingClassCards,{courses,today:format(value)}));
  const before=render('2026-09-13T04:59:59Z'),after=render('2026-09-13T05:00:00Z');
  assert.ok(!before.includes('>Past<')&&!before.includes('>Today<'));assert.ok(before.includes('>Tomorrow<'));
  assert.ok(!after.includes('>Tomorrow<'));assert.ok(after.includes('>Later<'));
  assert.equal(format('2026-01-01T05:59:59Z'),'2025-12-31');assert.equal(format('2026-01-01T06:00:00Z'),'2026-01-01');
});
test('real PostgreSQL preview -> atomic publish preserves saved links, revisions, other feeds and repeat saves', async () => {
  const h=await trainingHarness(); try {
    const { saveBoardLinks, readBoardLinks }=h.load('app/board-links-store.ts');
    const { defaultBoardLinks }=h.load('app/board-links.ts');
    const section={...defaultBoardLinks().sections.romeoville,links:[{id:'user-link',label:'User just saved this',url:'https://www.romeoville.org/562/Fire-Rescue-Courses',note:'Keep this'}]};
    await saveBoardLinks(h.db,'romeoville',section,'','admin');
    for(const id of Object.keys(trainingSources)) {
      const payload={id,sourceUrl:trainingSources[id].sourceUrl,action:'preview'};
      const previewResponse=await h.request(payload); assert.equal(previewResponse.status,200); const preview=await previewResponse.json();
      const reuse=await h.request(payload);assert.equal(reuse.status,200);assert.equal((await reuse.json()).previewId,preview.previewId);
      assert.equal((await h.pg.query('SELECT * FROM firehouse.board_feed_cache WHERE source=$1',[`training_${id}`])).rows.length,0);
      const result=await h.request({...payload,action:'publish',previewId:preview.previewId});assert.equal(result.status,200,await result.clone().text());
      const saved=await result.json(); assert.equal(saved.settings.trainingRevision,preview.previewId);
      const feed=(await h.pg.query('SELECT * FROM firehouse.board_feed_cache WHERE source=$1',[`training_${id}`])).rows[0];assert.equal(feed.payload.upcoming.length,6);assert.equal(feed.status,'ok');
      const writes=h.stats.writes;assert.equal((await h.request({...payload,action:'publish',previewId:preview.previewId})).status,200);assert.equal(h.stats.writes,writes);
    }
    assert.equal(h.stats.imports,3);assert.deepEqual((await readBoardLinks(h.db)).sections.romeoville,section);
    // Normal link editing must preserve the training invalidation revision.
    const links=await readBoardLinks(h.db); await saveBoardLinks(h.db,'news',{...links.sections.news,title:'New headline'},links.revision,'admin'); assert.equal((await readBoardLinks(h.db)).trainingRevision,links.trainingRevision);
  } finally {await h.close();}
});
test('permissions and validation reject before imports; concurrent previews share one durable cooldown', async()=>{
  const h=await trainingHarness();try {
    const payload={id:'nipsta',sourceUrl:trainingSources.nipsta.sourceUrl,action:'preview'};
    for(const role of ['member','revoked','anonymous'])assert.equal((await h.request(payload,role)).status,403);
    assert.equal(h.stats.reads,0);assert.equal(h.stats.writes,0);assert.equal(h.stats.imports,0);
    assert.equal((await h.request({...payload,sourceUrl:'https://evil.example'})).status,400);
    const results=await Promise.all([h.request(payload),h.request(payload)]);assert.ok(results.some(r=>r.status===200));assert.equal(h.stats.imports,1);
    assert.ok(results.every(r=>[200,429].includes(r.status)));
  } finally {await h.close();}
});

test('a preview cannot bypass a later permission removal or expiry',async()=>{
  const h=await trainingHarness();try {
    const payload={id:'romeoville',sourceUrl:trainingSources.romeoville.sourceUrl,action:'preview'};
    const preview=await (await h.request(payload)).json(),publish={...payload,action:'publish',previewId:preview.previewId};
    assert.equal((await h.request(publish,'revoked')).status,403);
    const key='training-preview:stickney:romeoville',row=(await h.pg.query('SELECT value FROM firehouse.system_meta WHERE key=$1',[key])).rows[0];
    const data=JSON.parse(Buffer.from(row.value,'base64').toString());data.expiresAt=Date.now()-1;
    await h.pg.query('UPDATE firehouse.system_meta SET value=$1 WHERE key=$2',[Buffer.from(JSON.stringify(data)).toString('base64'),key]);
    assert.equal((await h.request(publish)).status,409);
    assert.equal((await h.pg.query('SELECT * FROM firehouse.board_feed_cache')).rows.length,0);
    assert.equal((await h.load('app/board-links-store.ts').readBoardLinks(h.db)).revision,'');
  }finally{await h.close();}
});
test('failed import, stale cron results, and failed transaction never clear data or signal successful save',async()=>{
  const h=await trainingHarness();try {
    const payload={id:'ifsi',sourceUrl:trainingSources.ifsi.sourceUrl,action:'preview'};
    h.stats.failImport=true;assert.equal((await h.request(payload)).status,502);assert.equal((await h.request(payload)).status,429);assert.equal(h.stats.imports,1);
    h.stats.failImport=false;await h.pg.query("DELETE FROM firehouse.system_meta WHERE key='training-preview:stickney:ifsi'");
    const preview=await (await h.request(payload)).json();
    const publish={...payload,action:'publish',previewId:preview.previewId};
    h.stats.failBatchAt=2;assert.equal((await h.request(publish)).status,409);
    assert.equal((await h.pg.query('SELECT * FROM firehouse.board_feed_cache')).rows.length,0);
    assert.equal((await h.load('app/board-links-store.ts').readBoardLinks(h.db)).revision,'');
    await h.pg.query("INSERT INTO firehouse.board_feed_cache(source,payload,last_success_at,status) VALUES('training_ifsi','{\"newer\":true}',now(),'ok')");
    assert.equal((await h.request(publish)).status,409);
    assert.deepEqual((await h.pg.query('SELECT payload FROM firehouse.board_feed_cache')).rows[0].payload,{newer:true});
    assert.equal((await h.load('app/board-links-store.ts').readBoardLinks(h.db)).revision,'');
  } finally {await h.close();}
});
test('new import endpoint stays private and existing call cadence is unchanged',()=>{
  const proxy=readFileSync('proxy.ts','utf8');assert.ok(!proxy.slice(0,proxy.indexOf('export async')).includes('/api/training-import'));
  const source=readFileSync('app/operations-board.tsx','utf8');assert.match(source,/rotationPaused \|\| linkEditor \|\| trainingEditor/);assert.match(source,/30000/);
  const api=readFileSync('app/api/board-feeds/route.ts','utf8');assert.ok(!api.includes('loadTrainingProvider'));assert.ok(!api.includes('external-feeds'));
});
