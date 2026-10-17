import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

const compiled=ts.transpileModule(readFileSync(new URL('../app/table-viewport.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const compiledModule={exports:{}};
new Function('require','module','exports',compiled)(name=>{assert.equal(name,'react/jsx-runtime');return jsx;},compiledModule,compiledModule.exports);
const Viewport=compiledModule.exports.default;
test('comparison viewport gives keyboard users a named focusable region without discarding columns or actions',()=>{
  const child=jsx.jsx('table',{children:jsx.jsx('tbody',{children:jsx.jsxs('tr',{children:[...Array.from({length:12},(_,i)=>jsx.jsx('td',{children:`Synthetic comparison ${i+1}`},i)),jsx.jsx('td',{children:jsx.jsx('button',{children:'Open full record'})},'action')]})})});
  const html=renderToStaticMarkup(jsx.jsx(Viewport,{label:'Payroll sources',className:'submission-table',children:child}));
  assert.match(html,/role="region" aria-label="Payroll sources" tabindex="0"/);
  assert.match(html,/submission-table accessible-table-viewport/);
  for(let i=1;i<=12;i++)assert.ok(html.includes(`Synthetic comparison ${i}`));
  assert.match(html,/<button>Open full record<\/button>/);
  assert.doesNotMatch(html,/hidden|aria-hidden|display:none/);
});
