import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { bulkDecisionReady } from '../app/equipment-continuity-model.ts';
import { inventoryAdminDestination } from '../app/admin-tasks.ts';

function functionSource(file, name) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(source); ts.forEachChild(node, visit); }
  visit(source); assert.ok(found, `Missing ${name}`); return found;
}

test('actual Inventory navigation checks PIN first, retains local equipment context, and fails closed on outage', async () => {
  const code = ts.transpileModule(functionSource('app/payroll-app.tsx','openInventory'), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for (const status of [200,401,423,503]) {
    const navigations=[],events=[],errors=[],requests=[];
    const scope = { testMember:false, openingInventory:false, URL, Event, inventoryAdminDestination,
      setInventoryError:e=>errors.push(e),setOpeningInventory(){},setMobileMenuOpen(){},setGlobalSearchOpen(){},
      window:{location:{origin:'https://fixture.invalid',assign:path=>navigations.push(path)},dispatchEvent:e=>events.push(e.type)},
      fetch:async(path,options)=>{ requests.push({path,options}); return new Response(null,{status}); },
    };
    const open = new Function(...Object.keys(scope),code+';return openInventory;')(...Object.values(scope));
    await open('equipment','synthetic & item');
    assert.deepEqual(requests,[{path:'/api/auth/pin',options:{method:'PATCH',cache:'no-store'}}]);
    if (status===200||status===401) {
      assert.equal(navigations.length,1);
      const destination=new URL(navigations[0],scope.window.location.origin);
      assert.equal(destination.origin,scope.window.location.origin);
      assert.equal(destination.pathname,'/inventory');
      assert.equal(destination.searchParams.get('equipment'),'synthetic & item');
    } else assert.deepEqual(navigations,[]);
    assert.deepEqual(events,status===423?['firehouse:session-lock']:[]);
    if(status===503)assert.match(errors.at(-1),/could not verify secure access/);
  }
});

const elements=(node,type)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(child=>elements(child,type)):[...(node.type===type?[node]:[]),...elements(node.props?.children,type)];
test('actual bulk editor starts unreviewed, requires failure evidence and retries only unconfirmed rows', async () => {
  const state=[];let cursor=0,fail=true,cancelled=0;
  const calls=[],compiledModule={exports:{}};
  const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];}};
  const code=ts.transpileModule(readFileSync('app/inventory-bulk-review.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const deps={'react':react,'react/jsx-runtime':jsx,'./use-unsaved-work':{useUnsavedWork(){}},'./equipment-continuity-model':{bulkDecisionReady}};
  new Function('require','module','exports',code)(name=>{assert.ok(name in deps,name);return deps[name];},compiledModule,compiledModule.exports);
  const render=()=>{cursor=0;return compiledModule.exports.default({items:[{id:'a',name:'Synthetic A'},{id:'b',name:'Synthetic B'},{id:'c',name:'Unreviewed C'}],onCancel:()=>cancelled++,onSave:async d=>{calls.push(d.id);if(d.id==='b'&&fail){fail=false;throw Error('Synthetic save failure');}return true;}});};
  const save=tree=>elements(tree,'button').find(n=>String(n.props.children).includes('Save reviewed'));
  let tree=render();assert.ok(save(tree).props.disabled);
  assert.ok(elements(tree,'select').every(n=>n.props.value===''));
  elements(tree,'select')[0].props.onChange({target:{value:'pass'}});
  tree=render();elements(tree,'select')[1].props.onChange({target:{value:'failed'}});
  tree=render();elements(tree,'textarea')[1].props.onChange({target:{value:'Individual synthetic fault'}});
  tree=render();save(tree).props.onClick();await new Promise(setImmediate);
  assert.deepEqual(calls,['a'],'failure without its own photo must not be sent');
  tree=render();elements(tree,'input')[0].props.onChange({target:{files:[new File(['synthetic'],'test.jpg',{type:'image/jpeg'})]}});
  tree=render();save(tree).props.onClick();await new Promise(setImmediate);
  assert.deepEqual(calls,['a','b']);assert.equal(state[0][1].state,'failed');assert.equal(state[0][0].state,'saved');
  tree=render();save(tree).props.onClick();await new Promise(setImmediate);
  assert.deepEqual(calls,['a','b','b'],'confirmed rows must not be posted again');
  assert.equal(state[0][1].state,'saved');assert.equal(state[0][2].state,'unreviewed');assert.equal(cancelled,0);
});
