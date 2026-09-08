import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/api/payroll-corrections/route.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function setup({manager=false,linked=true}={}) {
 const rows=new Map(); const queries=[];
 const db={prepare(sql){return {bind(...args){queries.push({sql,args});return {
  async first(){if(sql.includes('FROM employees'))return linked?{id:'member',name:'Test Member',isAdmin:manager?1:0}:null;return rows.has(args[0])?{id:args[0]}:null;},
  async all(){return {results:[]};},
  async run(){if(!rows.has(args[0]))rows.set(args[0],args);return {success:true};}
 };}};}};
 const sandbox={exports:{},Response,Date,ensureDatabase:async()=>db,permissionsForEmail:async()=>new Set(manager?['payroll.manage','payroll.view_own']:['payroll.view_own']),URL};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
 return {...sandbox.exports,rows,queries};
}
const payload={action:'submit',period:'2026-08-26',date:'2026-09-03',note:'Please verify shift hours',token:'00000000-0000-4000-8000-000000000001'};
const request=(body,origin='https://portal.test')=>new Request('https://portal.test/api/payroll-corrections',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-email':'member@example.test'},body:JSON.stringify(body)});
test('correction retries reuse one saved request and never write hours',async()=>{
 const api=setup(); assert.equal((await api.POST(request(payload))).status,200);assert.equal((await api.POST(request(payload))).status,200);
 assert.equal(api.rows.size,1);assert.ok(api.queries.every(q=>!q.sql.includes('time_entries')));
});
test('member cannot resolve a correction',async()=>assert.equal((await setup().POST(request({action:'resolve',id:'x',note:'done'}))).status,403));
test('unlinked requester and foreign origin are rejected',async()=>{
 assert.equal((await setup({linked:false}).POST(request(payload))).status,403);
 assert.equal((await setup().POST(request(payload,'https://foreign.test'))).status,403);
});
test('invalid dates and dates outside period are rejected',async()=>{
 for(const date of ['2026-08-25','2026-09-11','2026-02-31'])assert.equal((await setup().POST(request({...payload,date}))).status,400);
});
test('member GET is restricted to the authenticated author',async()=>{
 const api=setup();assert.equal((await api.GET(new Request('https://portal.test/api/payroll-corrections?period=2026-08-26',{headers:{'oai-authenticated-user-email':'member@example.test'}}))).status,200);
 assert.ok(api.queries.some(q=>q.sql.includes('AND r.actor=?') && q.args.includes('member@example.test')));
});
