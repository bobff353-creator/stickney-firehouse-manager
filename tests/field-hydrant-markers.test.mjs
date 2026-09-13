import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/field-preplans.tsx',import.meta.url),'utf8');
// Exercise the actual, otherwise private FieldMap renderer; no network, records or effects.
const compiled=ts.transpileModule(source+'\nexport {FieldMap};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const center={lat:41.8189,lng:-87.7734};
const hydrant=(id,offset=0,status='in_service')=>({id,hydrantNumber:id,latitude:center.lat,longitude:center.lng+offset,serviceStatus:status});
function fixture(hydrants,zoom=16,width=1213,height=500){
  let state=0;const calls={selected:[],center:[],zoom:[],stopped:0};
  const compiledModule={exports:{}};
  const react={useState:initial=>[state++===0?{width,height}:initial,()=>{}],useRef:initial=>({current:initial}),useEffect(){}};
  new Function('require','module','exports',compiled)(name=>name==='react'?react:name==='react/jsx-runtime'?require(name):{},compiledModule,compiledModule.exports);
  const tree=compiledModule.exports.FieldMap({apiKey:'',center,zoom,imagery:'aerial',plans:[],hydrants,selected:'',draft:null,mode:'',footprintAccepted:false,operationalOverlay:null,operationalDraft:null,onMapClick(){},onSelect(){},onHydrantSelect:id=>calls.selected.push(id),onCenter:value=>calls.center.push(value),onZoom:value=>calls.zoom.push(value),onProviderChange(){}});
  const nodes=[];function walk(node){if(Array.isArray(node)){node.forEach(walk);return;}if(!node||typeof node!=='object')return;nodes.push(node);walk(node.props?.children);}walk(tree);
  const pins=nodes.filter(node=>node.props?.className?.startsWith('hydrant-map-pin'));
  const clusters=nodes.filter(node=>node.props?.className==='hydrant-cluster');
  return {pins,clusters,calls,click:node=>node.props.onClick({stopPropagation(){calls.stopped++;}})};
}

test('one hydrant always renders its icon and opens its exact record, at overview and street zooms',()=>{
  for(const width of [390,768,1213])for(const zoom of [14,15,16,17,20]){
    const f=fixture([hydrant('preview-1')],zoom,width);
    assert.equal(f.pins.length,1);assert.equal(f.clusters.length,0);
    assert.equal(f.pins[0].props.style.left,'50%');assert.equal(f.pins[0].props.style.top,'50%');
    assert.equal(f.pins[0].props.children.type.name,'HydrantIcon');
    f.click(f.pins[0]);assert.deepEqual(f.calls,{selected:['preview-1'],center:[],zoom:[],stopped:1});
  }
});
test('a singleton preserves its out-of-service symbol and status',()=>{
  const f=fixture([hydrant('preview-oos',0,'out_of_service')]);
  assert.equal(f.pins[0].props.className,'hydrant-map-pin out_of_service');
  assert.equal(f.pins[0].props.children.props.outOfService,true);
  assert.match(f.pins[0].props.title,/out of service/);
});
test('multiple nearby hydrants still show a numbered cluster and zoom without selecting a record',()=>{
  const records=[hydrant('preview-a'),hydrant('preview-b',.00001)];const original=JSON.stringify(records);
  const f=fixture(records);assert.equal(f.pins.length,0);assert.equal(f.clusters.length,1);
  assert.equal(f.clusters[0].props['aria-label'],'2 hydrants · Zoom in');
  assert.deepEqual(f.clusters[0].props.children[1].props.children,['×',2]);
  f.click(f.clusters[0]);assert.deepEqual(f.calls,{selected:[],center:[center],zoom:[18],stopped:1});
  assert.equal(JSON.stringify(records),original);
});
test('singletons and multiple-record clusters coexist, including the dense high-zoom branch',()=>{
  for(const [zoom,offset,count] of [[16,.006,2],[18,.0015,25]]){
    const records=[hydrant('preview-single'),...Array.from({length:count},(_,i)=>hydrant(`preview-group-${i}`,offset))];
    const f=fixture(records,zoom);assert.equal(f.pins.length,1);assert.equal(f.clusters.length,1);
    assert.equal(f.pins[0].key,'preview-single');assert.equal(f.clusters[0].props['aria-label'],`${count} hydrants · Zoom in`);
  }
});
test('empty/offscreen hydrants remain hidden and normal close-up individual rendering is unchanged',()=>{
  const empty=fixture([hydrant('offscreen',1)]);assert.equal(empty.pins.length+empty.clusters.length,0);
  const f=fixture([hydrant('preview-a'),hydrant('preview-b',.00001)],17);
  assert.equal(f.pins.length,2);assert.equal(f.clusters.length,0);
});
test('pressing a hydrant or cluster does not start the fallback map drag/capture gesture',()=>{
  const f=fixture([hydrant('preview-single'),hydrant('preview-a',.006),hydrant('preview-b',.006)]);
  let stopped=0;
  for(const node of [...f.pins,...f.clusters])node.props.onPointerDown({stopPropagation(){stopped++;}});
  assert.equal(stopped,2);assert.deepEqual(f.calls,{selected:[],center:[],zoom:[],stopped:0});
});
