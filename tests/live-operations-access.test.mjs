import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { resolveEmployeePermissions } from '../app/permissions.ts';

function route(file,deps){
 const compiledModule={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(name=>deps[name]??{},compiledModule,compiledModule.exports);
 return compiledModule.exports;
}
test('all three board API reads deny ungranted members before operational queries; shared Home remains independently allowed',async()=>{
 for(const path of ['dashboard','daily-duties','suite-context']){
  let reads=0,checked=[];
  const permissions=resolveEmployeePermissions({rank:'Firefighter',isAdmin:false},[{permissionKey:'operations_board.view',allowed:1}],[]);
  const db={prepare(){reads++;throw Error('Operational query reached');}};
  const api=route('app/api/'+path+'/route.ts',{
   '../../../db/bootstrap':{ensureDatabase:async()=>db},
   '../../server-permissions':{hasAnyPermission:async(_req,_db,keys)=>{checked=keys;return keys.some(key=>permissions.includes(key));}},
   '../../resend-dispatch-sync':{syncRecentResendDispatches:async()=>{}},
   '../../lib/inventory-session':{verifyInventoryRequest:async()=>({ok:true,context:{grants:permissions,department:{id:'fixture'}}})},
   '../../lib/supabase-server':{createInventorySupabaseClient:async()=>{reads++;throw Error('Operational query reached');}}
  });
  const denied=await api.GET(new Request('https://fixture.invalid/api/'+path+'?scope=live-operations'));
  assert.equal(denied.status,403,path);assert.equal(reads,0,path);assert.match(denied.headers.get('cache-control'),/no-store/);
  if(path==='dashboard'){
   await api.GET(new Request('https://fixture.invalid/api/dashboard'));
   assert.ok(checked.includes('dashboard.view'),'Home permission still considered independently');
  }
 }
});

test('direct board URLs and automatic call overlay require current visible access before mounting',()=>{
 const app=fs.readFileSync(new URL('../app/payroll-app.tsx',import.meta.url),'utf8');
 assert.match(app,/activeNav === "Operations Board" && visibleNav.includes\("Operations Board"\) && <OperationsBoard/);
 assert.match(app,/respondAlertCallId && activeNav === "Operations Board" && visibleNav.includes\("Operations Board"\) && visibleNav.includes\("Respond"\)/);
 assert.match(app,/import \{[^\n]*navPermission[^\n]*\} from "\.\/portal-menu-items"/);
 const menu=fs.readFileSync(new URL('../app/portal-menu-items.ts',import.meta.url),'utf8');
 assert.match(menu,/"Road Closures": "road_closures.view"/);
 const board=fs.readFileSync(new URL('../app/operations-board.tsx',import.meta.url),'utf8');
 assert.match(board,/if \(controller.signal.aborted\) return/);
 assert.match(board,/loadControllerRef.current\?\.abort\(\)/);
 assert.match(board,/setInterval\(\(\) => void load\(\), 30000\)/,'unchanged board detection cadence');
});
