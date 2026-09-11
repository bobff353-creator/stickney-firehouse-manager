import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { permissionCatalog, resolveEmployeePermissions } from '../app/permissions.ts';

function load(file, dependencies={}, expose='') {
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')+expose;
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{if(!(name in dependencies))throw Error('Unstubbed '+file+': '+name);return dependencies[name];},module,module.exports);
  return module.exports;
}
const catalog=load('app/permissions.ts');
const shared=load('app/server-permissions.ts',{'./permissions':catalog});
function fixture({admin=0,overrides={},linked=true,duplicate=false}={}) {
  const employee={id:'test-member',name:'Fictional Member',email:'member@example.invalid',rank:'Firefighter',isAdmin:admin,endDate:null};
  let revision='original'; const persisted=new Map(Object.entries(overrides)); let batches=0;
  const query=(sql,args)=>{
    if(sql.includes("key='permissions-revision'"))return[{value:revision}];
    if(sql.includes('FROM employee_permission_overrides'))return[...persisted].map(([permissionKey,effect])=>({employeeId:employee.id,permissionKey,effect}));
    if(sql.includes('FROM rank_permissions'))return[];
    if(sql.includes('FROM employees')) {
      if(!linked)return[];
      return duplicate?[employee,{...employee,id:'duplicate'}]:[employee];
    }
    if(sql.includes('FROM pay_scales'))return[{rank:'Firefighter',sortOrder:1,ok:1}];
    if(sql.includes('FROM payroll_settings'))return[{overtimeThreshold:106,actingOfficerPremium:1,dpwMultiplier:1.5}];
    return[];
  };
  const db={prepare(sql){return{sql,args:[],bind(...args){this.args=args;return this;},expectChanges(n){this.requiredChanges=n;return this;},async first(){return query(sql,this.args)[0]??null;},async all(){return{results:query(sql,this.args)};},async run(){throw Error('No standalone writes expected');}};},async batch(statements){
    batches++; const next=new Map(persisted); let changed=false;
    for(const {sql,args}of statements){
      if(sql.startsWith('UPDATE system_meta')){if(args[0]!==revision)throw Error('SAVE_CONFLICT');}
      else if(sql.startsWith('INSERT INTO employee_permission_overrides')){if(next.get(args[1])!==args[2])changed=true;next.set(args[1],args[2]);}
      else if(sql.startsWith('DELETE FROM employee_permission_overrides')){changed=next.delete(args[1])||changed;}
      else throw Error('Unexpected fixture write '+sql);
    }
    persisted.clear();for(const [k,v]of next)persisted.set(k,v);if(changed)revision+='-changed';
    return statements.map(()=>({success:true,meta:{changes:1}}));
  }};
  const bootstrap={ensureDatabase:async()=>db};
  const deps={'../../../db/bootstrap':bootstrap,'../../permissions':catalog,'../../server-permissions':shared};
  const api=load('app/api/permissions/route.ts',deps);
  const payroll=load('app/api/payroll/route.ts',{...deps,'../../employee-names':load('app/employee-names.ts'),'../../payroll-rounding':{},'../../payroll-calculation':{}},'\nexport {getViewer as testViewer};');
  const scheduler=load('app/api/station-scheduler/route.ts',{...deps,'../../staffing-eligibility':{staffingRoles:()=>[]},'../../schedule-time':{},'../../station-scheduler-logic':{}},'\nexport {viewer as testViewer};');
  const hydrants=load('app/api/field-hydrants/route.ts',{...deps,'../../hydrant-flow':{}},'\nexport {access as testAccess};');
  const command=load('app/api/command-center/route.ts',{...deps,'../../command-center-analytics':{buildPayrollDetails:()=>[],buildStaffingDetails:()=>[]}});
  const request=(method='GET',body)=>new Request('https://portal.test/api/permissions',{method,headers:{'oai-authenticated-user-email':employee.email,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return{employee,db,api,payroll,scheduler,hydrants,command,request,persisted,get revision(){return revision;},get batches(){return batches;}};
}

test('864 rank/admin/exception combinations preserve explicit decisions and own-timesheet access',()=>{
  let count=0;
  for(const rank of ['Chief','Deputy Chief','Captain','Lieutenant','Firefighter','Temp Firefighter'])for(const isAdmin of [0,1])for(const {key}of permissionCatalog)for(const effect of ['allow','deny']){
    const actual=resolveEmployeePermissions({rank,isAdmin},[{permissionKey:key,allowed:0}],[{permissionKey:key,effect}]);
    assert.equal(actual.includes(key),effect==='allow'||key==='payroll.view_own');count++;
  }
  assert.equal(count,864);
});
test('delegated member grants enable actual payroll, employee, scheduler, command and permission handlers',async()=>{
  const f=fixture({overrides:Object.fromEntries(['payroll.manage','employees.manage','scheduling.manage','command_center.view','permissions.manage'].map(k=>[k,'allow']))});
  const payroll=await f.payroll.testViewer(f.db,f.request());assert.equal(payroll.canManagePayroll,true);assert.equal(payroll.canManageEmployees,true);
  assert.equal((await f.scheduler.testViewer(f.db,f.request())).isAdmin,true);
  assert.equal((await f.command.GET(f.request())).status,200);
  assert.ok((await(await f.api.GET(f.request())).json()).catalog);
  assert.equal((await f.api.PUT(f.request('PUT',{scope:'employee',employeeId:f.employee.id,revision:f.revision,overrides:{'permissions.manage':'allow','inventory.setup.manage':'allow'}}))).status,200);
  assert.equal(f.persisted.get('inventory.setup.manage'),'allow');
});
test('administrator denials are enforced by actual route helpers and GET/PUT',async()=>{
  const f=fixture({admin:1,overrides:Object.fromEntries(['payroll.manage','employees.manage','scheduling.manage','command_center.view','permissions.manage','field_preplans.view','field_preplans.edit'].map(k=>[k,'deny']))});
  const payroll=await f.payroll.testViewer(f.db,f.request());assert.equal(payroll.canManagePayroll,false);assert.equal(payroll.canManageEmployees,false);
  assert.equal((await f.scheduler.testViewer(f.db,f.request())).isAdmin,false);
  assert.equal((await f.command.GET(f.request())).status,403);
  assert.equal((await f.hydrants.testAccess(f.request(),f.db)).view,false);
  assert.equal((await f.hydrants.testAccess(f.request(),f.db)).edit,false);
  assert.equal((await(await f.api.GET(f.request())).json()).catalog,undefined);
  assert.equal((await f.api.PUT(f.request('PUT',{scope:'employee'}))).status,403);
});
test('save, no-op save, clear, stale-editor rejection and required permission handling',async()=>{
  const f=fixture({admin:1});
  const body={scope:'employee',employeeId:f.employee.id,overrides:{'payroll.manage':'deny','payroll.view_own':'deny','unknown':'allow'}};
  assert.equal((await f.api.PUT(f.request('PUT',{...body,revision:f.revision}))).status,200);
  const saved=f.revision;assert.equal(f.persisted.size,1);
  assert.equal((await f.api.PUT(f.request('PUT',{...body,revision:f.revision}))).status,200);assert.equal(f.revision,saved);
  assert.equal((await f.api.PUT(f.request('PUT',{...body,revision:'stale'}))).status,409);assert.equal(f.revision,saved);
  assert.equal((await f.api.PUT(f.request('PUT',{...body,overrides:{},revision:f.revision}))).status,200);assert.equal(f.persisted.size,0);
});
test('unlinked, duplicate-linked and ended employees fail closed consistently',async()=>{
  for(const option of [{linked:false},{duplicate:true}]){const f=fixture(option);assert.equal((await shared.permissionsForEmail(f.employee.email,f.db)).size,0);assert.equal((await f.api.GET(f.request())).status,403);assert.equal((await f.payroll.GET(f.request())).status,403);}
  const f=fixture();f.employee.endDate='2000-01-01';assert.equal((await shared.permissionsForEmail(f.employee.email,f.db)).size,0);assert.equal((await f.payroll.GET(f.request())).status,403);
});

test('removing both schedule permissions denies reads and member writes, including administrators',async()=>{
 for(const admin of [0,1]){const f=fixture({admin,overrides:{'scheduling.view':'deny','scheduling.manage':'deny'}});assert.equal((await f.scheduler.GET(f.request())).status,403);assert.equal((await f.scheduler.POST(f.request('POST',{action:'claimShift'}))).status,403);}
});

test('delegated employee editing cannot promote accounts or change login identities',async()=>{
 const f=fixture({overrides:{'employees.manage':'allow'}});
 const response=await f.payroll.POST(f.request('POST',{action:'saveEmployee',id:f.employee.id,lastName:'Member',firstName:'Fictional',payScaleId:'changed',email:'other@example.invalid',isAdmin:true}));
 assert.equal(response.status,403);assert.match((await response.json()).error,/Manage permissions access/);assert.equal(f.batches,0);
});
test('permission management cannot disguise a protected recovery owner as restricted',async()=>{
  const f=fixture({admin:1});f.employee.email='bobff353@gmail.com';
  assert.equal((await f.api.PUT(f.request('PUT',{scope:'employee',employeeId:f.employee.id,revision:f.revision,overrides:{'permissions.manage':'deny'}}))).status,409);
  const body=await(await f.api.GET(f.request())).json();assert.equal(body.employees[0].isOwner,true);assert.equal(body.viewerPermissions.length,permissionCatalog.length);
});
