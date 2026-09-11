import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE employees(id TEXT PRIMARY KEY,name TEXT,active INTEGER,pay_scale_id TEXT);
    CREATE TABLE pay_scales(id TEXT,label TEXT);
    CREATE TABLE employee_profiles(employee_id TEXT,acting_officer_eligible INTEGER,email TEXT,is_admin INTEGER);
    INSERT INTO pay_scales VALUES('lt','Lieutenant'),('ff','Firefighter');
    INSERT INTO employees VALUES('officer','Preview Officer',1,'lt'),('member','Preview Member',1,'ff'),('inactive','Former Officer',0,'lt');
    CREATE TABLE chief_board_items(id TEXT PRIMARY KEY,item_type TEXT,title TEXT,body TEXT,event_date TEXT,starts_at TEXT,ends_at TEXT,expires_at TEXT,invite_status TEXT,active INTEGER,created_by TEXT,created_at TEXT,updated_at TEXT,officer_employee_id TEXT REFERENCES employees(id),officer_name TEXT DEFAULT '');
    CREATE TABLE chief_board_attachments(id TEXT,item_id TEXT,filename TEXT,content_type TEXT,size_bytes INTEGER,created_at TEXT);`);
  const db = { prepare(sql) { let args=[]; return { bind(...values){args=values;return this;}, async all(){return {results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)??null;}, async run(){return sqlite.prepare(sql).run(...args);} }; }, async batch(statements){ for(const statement of statements) await statement.run(); } };
  function compile(path, require) {
    const context={exports:{},require,Error,Response,Request,FormData,File,Date,TextEncoder,crypto:webcrypto,process:{env:{}},btoa};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
    return context.exports;
  }
  const officers=compile('../app/board-officers.ts',()=>{throw Error('Unexpected import');});
  const permissions=compile('../app/permissions.ts',()=>{throw Error('Unexpected import');});
  const serverPermissions=compile('../app/server-permissions.ts',()=>permissions);
  const route=compile('../app/api/chief-board/route.ts',(name)=>name.includes('bootstrap')?{ensureDatabase:async()=>db}:name.includes('server-permissions')?serverPermissions:name.includes('board-officers')?officers:{getPortalStorage:()=>null});
  const request=(method,body,admin=true)=>new Request('https://example.test/api/chief-board',{method,headers:{...(admin?{'oai-authenticated-user-email':'bobff353@gmail.com'}:{}),...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
  const note=(officerId='officer')=>{const form=new FormData();for(const [key,value] of Object.entries({itemType:'note',title:'Preview note',body:'Preview only',officerId})) form.set(key,value);return form;};
  return {sqlite,route,request,note};
}

test('officer note persists through POST, fresh GET and PATCH without impersonating its creator',async()=>{
  const {sqlite,route,request,note}=fixture();
  try {
    assert.equal((await route.POST(request('POST',note()))).status,200);
    let result=await (await route.GET(request('GET'))).json();
    assert.equal(result.officers.length,1);
    const saved=result.items[0];
    assert.equal(saved.officerId,'officer');assert.equal(saved.officerName,'Preview Officer');assert.equal(saved.createdBy,'bobff353@gmail.com');
    assert.equal((await route.PATCH(request('PATCH',{id:saved.id,title:'Updated',body:'Still preview',officerId:'officer'}))).status,200);
    result=await (await route.GET(request('GET'))).json();
    assert.equal(result.items[0].title,'Updated');assert.equal(result.items[0].officerId,'officer');
  } finally {sqlite.close();}
});
test('notes reject absent, non-officer and inactive selections and unauthorized saves',async()=>{
  const {sqlite,route,request,note}=fixture();
  try {
    for(const id of ['', 'member','inactive','unknown']) assert.equal((await route.POST(request('POST',note(id)))).status,400);
    assert.equal((await route.POST(request('POST',note(),false))).status,403);
    assert.equal(sqlite.prepare('SELECT count(*) n FROM chief_board_items').get().n,0);
  } finally {sqlite.close();}
});
test('events remain separate and legacy note edits preserve unattributed history',async()=>{
  const {sqlite,route,request,note}=fixture();
  try {
    const form=note('');form.set('itemType','event');form.set('startsAt','2099-01-01T12:00:00Z');form.set('endsAt','2099-01-01T13:00:00Z');
    assert.equal((await route.POST(request('POST',form))).status,200);
    assert.equal(sqlite.prepare('SELECT officer_employee_id FROM chief_board_items').get().officer_employee_id,null);
    sqlite.exec("INSERT INTO chief_board_items(id,item_type,title,body,active,expires_at) VALUES('legacy','note','Old','Old text',1,'')");
    assert.equal((await route.PATCH(request('PATCH',{id:'legacy',title:'Old revised',body:'Preserved',officerId:''}))).status,200);
    assert.equal(sqlite.prepare("SELECT officer_employee_id FROM chief_board_items WHERE id='legacy'").get().officer_employee_id,null);
  } finally {sqlite.close();}
});
