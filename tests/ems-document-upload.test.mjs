import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../app/ems-document-model.ts';
test('only bounded PDF bytes and safe document paths are accepted',async()=>{
 assert.equal(await model.validEmsPdf(new Blob(['%PDF-1.7 original form'])),true);
 assert.equal(await model.validEmsPdf(new Blob(['<svg>not a PDF</svg>'])),false);
 assert.equal(await model.validEmsPdf(new Blob(['%PDF-',new Uint8Array(model.EMS_MAX_BYTES)])),false);
 const name=model.emsFileName('Patient Assessment','01234567-0123-0123-0123-012345678901');
 assert.equal(model.emsDocument(name).title,'Patient Assessment');
 assert.equal(model.validEmsFileName(name),true);
 for(const path of ['../secret.pdf','departments/other/file.pdf','x.pdf','/etc/passwd'])assert.equal(model.validEmsFileName(path),false);
});
test('actual EMS API enforces permissions and department scope and preserves PDF bytes',async()=>{
 let department='department-a',permissions=new Set(['documents.view','policies.manage']),stored=new Map(),listed=[];
 const storage={put:async(k,stream)=>stored.set(k,await new Response(stream).text()),get:async k=>stored.has(k)?{body:new Blob([stored.get(k)]).stream()}:null,delete:async k=>stored.delete(k)};
 const mocks={
  '../../../db/bootstrap':{ensureDatabase:async()=>({})},
  '../../server-permissions':{hasPermission:async(_r,_db,p)=>permissions.has(p)},
  '../../department-portal':{getPortalDepartment:async()=>({id:department,isolated:true})},
  '../../portal-storage':{getPortalStorage:()=>storage},
  '../../supabase-server':{getSupabaseServerClient:async()=>({storage:{from:()=>({list:async(prefix)=>{listed.push(prefix);return {data:[...stored.keys()].filter(k=>k.startsWith(prefix.replace('departments/department-a/','')+'/')).map(k=>({name:k.slice(k.lastIndexOf('/')+1)})),error:null};}})}})},
  '../../ems-document-model':model,
 };
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync('app/api/ems-documents/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];},Response,Request,File,Blob,FormData,URL,TextDecoder,crypto,console});
 const api=module.exports,headers={'oai-authenticated-user-email':'fixture@example.test','x-department-id':'department-a'};
 const req=(url,options={})=>new Request('https://example.test/api/ems-documents'+url,{headers,...options});
 assert.equal((await api.GET(new Request('https://example.test/api/ems-documents'))).status,401);
 department='other';assert.equal((await api.GET(req(''))).status,401);department='department-a';
 permissions=new Set(['documents.view']);assert.equal((await api.POST(req('',{method:'POST'}))).status,403);
 permissions.add('policies.manage');
 const form=new FormData();form.set('title','Patient Assessment');form.set('file',new File(['%PDF-1.7 unchanged fillable bytes'],'form.pdf',{type:'application/pdf'}));
 const uploaded=await api.POST(req('',{method:'POST',body:form}));assert.equal(uploaded.status,201);
 const {item}=await uploaded.json();const fetched=await api.GET(req('?file='+encodeURIComponent(item.name)));
 assert.equal(await fetched.text(),'%PDF-1.7 unchanged fillable bytes');
 const list=await api.GET(req(''));assert.equal((await list.json()).items.length,1);assert.deepEqual(listed.sort(),['departments/department-a/ems-document-trash','departments/department-a/ems-documents'].sort());
 assert.equal((await api.GET(req('?file=../secret.pdf'))).status,404);
 const editRequest=method=>req('',{method,headers:{...headers,'content-type':'application/json'},body:JSON.stringify({name:item.name})});
 permissions=new Set(['documents.view']);assert.equal((await api.DELETE(editRequest('DELETE'))).status,403);assert.equal((await api.PATCH(editRequest('PATCH'))).status,403);
 permissions.add('policies.manage');assert.equal((await api.DELETE(editRequest('DELETE'))).status,200);
 assert.equal((await api.GET(req('?file='+encodeURIComponent(item.name)))).status,404);
 const removed=await (await api.GET(req(''))).json();assert.equal(removed.items.length,0);assert.equal(removed.deleted[0].name,item.name);
 assert.equal(stored.get('ems-documents/'+item.name),'%PDF-1.7 unchanged fillable bytes');
 permissions.delete('policies.manage');assert.equal((await (await api.GET(req(''))).json()).deleted.length,0);
 permissions.add('policies.manage');assert.equal((await api.PATCH(editRequest('PATCH'))).status,200);
 assert.equal(await (await api.GET(req('?file='+encodeURIComponent(item.name)))).text(),'%PDF-1.7 unchanged fillable bytes');
 assert.equal((await api.DELETE(req('',{method:'DELETE',body:JSON.stringify({name:'../foreign.pdf'})}))).status,400);
 permissions.clear();assert.equal((await api.GET(req('?file='+encodeURIComponent(item.name)))).status,403);
});
