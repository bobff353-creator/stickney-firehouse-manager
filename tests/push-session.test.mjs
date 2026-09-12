import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function sessionFixture({grants=['scheduling.view'],signedIn=true,member=true,unlocked=true}={}) {
 const m={exports:{}};
 const client={auth:{getUser:async()=>({data:{user:signedIn?{id:'fixture-user',email:'fixture@example.invalid'}:null},error:null})},from(table){const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='departments'?{id:'fixture-department',name:'Fixture',slug:'stickney-fire-department'}:member?{role:'user',status:'active'}:null,error:null})};return chain;},rpc:async name=>({data:name==='is_platform_owner'?false:[{configured:true,unlocked}],error:null})};
 const deps={'./supabase-server':{createInventorySupabaseClient:async()=>client},'next/headers':{cookies:async()=>({get:()=>({value:'fictional-pin-cookie'})})},'../../db/bootstrap':{ensureDatabase:async()=>({})},'../server-permissions':{permissionsForEmail:async()=>new Set(grants)}};
 new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../app/lib/inventory-session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name],m,m.exports);
 return m.exports;
}
test('push registration accepts schedule-only members without weakening Inventory permissions',async()=>{
 const request=new Request('https://fixture.invalid/api/push/subscriptions');
 for(const grants of [['scheduling.view'],['scheduling.manage'],['field_preplans.view']]) {
  const session=sessionFixture({grants});assert.equal((await session.verifyPushRequest(request)).ok,true);assert.equal((await session.verifyInventoryRequest(request)).status,403);
 }
 assert.equal((await sessionFixture({grants:['inventory.view']}).verifyPushRequest(request)).status,403);
 assert.equal((await sessionFixture({grants:['inventory.view']}).verifyInventoryRequest(request)).ok,true);
});
test('push still requires verified sign-in, current department membership and unlocked PIN',async()=>{
 for(const [options,status] of [[{signedIn:false},401],[{member:false},403],[{unlocked:false},423],[{grants:[]},403]])assert.equal((await sessionFixture(options).verifyPushRequest(new Request('https://fixture.invalid'))).status,status);
});
