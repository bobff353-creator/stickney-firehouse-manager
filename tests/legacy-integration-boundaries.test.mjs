import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
function fixture({isolated=false,allowed=true,failScope=false}={}) {
 let databaseCalls=0,backgroundCalls=0;
 const load=trainingModules({
  [resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>{if(failScope)throw Error('Scope unavailable');return{id:'fictional-department',isolated};}},
  [resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>{databaseCalls++;return{};}},
  [resolve('app/server-permissions.ts')]:{hasPermission:async()=>allowed,hasAnyPermission:async()=>allowed},
  [resolve('app/background-database.ts')]:{backgroundDatabase:()=>{backgroundCalls++;return{prepare:()=>({first:async()=>({setup:{accounts:[]}}),bind:()=>({first:async()=>({linked:true})})})};}},
 });
 return{load,counts:()=>({databaseCalls,backgroundCalls})};
}
const request=(method='GET')=>new Request('https://fixture.invalid/api/employee-accounts',{method,headers:{origin:'https://fixture.invalid','content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({userId:'00000000-0000-4000-8000-000000000001',employeeId:'fictional'})}:{})});
test('other-department portals never reach Stickney account linking or external schedule credentials',async()=>{
 const f=fixture({isolated:true});const accounts=f.load('app/api/employee-accounts/route.ts'),schedule=f.load('app/api/aladtec-schedule/route.ts');
 assert.equal((await accounts.GET(request())).status,503);assert.equal((await accounts.POST(request('POST'))).status,503);assert.equal((await schedule.GET(request())).status,503);assert.deepEqual(f.counts(),{databaseCalls:0,backgroundCalls:0});
});
test('denied and unavailable department access fails closed before privileged account operations',async()=>{
 for(const options of [{allowed:false},{failScope:true}]){const f=fixture(options),api=f.load('app/api/employee-accounts/route.ts'),schedule=f.load('app/api/aladtec-schedule/route.ts');const status=options.failScope?503:403;assert.equal((await api.GET(request())).status,status);assert.equal((await api.POST(request('POST'))).status,status);assert.equal((await schedule.GET(request())).status,status);assert.equal(f.counts().backgroundCalls,0);}
});
test('authorized primary-department account status retains its existing read-only response',async()=>{
 const f=fixture(),api=f.load('app/api/employee-accounts/route.ts');const response=await api.GET(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{accounts:[]});assert.equal(f.counts().backgroundCalls,1);assert.match(response.headers.get('cache-control'),/no-store/);
});
