import {useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import MeterCheckEditor,{MeterTemplateEditor} from '../../app/inventory-meter-check';
import {meterResponse,meterSummary,meterIssues} from '../../app/inventory-meter-model';
import type {InventoryRow} from '../../app/inventory-index';
import '../../app/inventory/inventory.css';
import '../../app/suite-theme.css';

const template=JSON.stringify({version:1,title:'Weekly meter inspection',instructions:'Record the actual MSA Altair 5 gas meter and Sensit observations. Complete this with the apparatus weekly check.',source:'Aladtec Meter Weekly Inspection · Form 458'});
function Preview(){
  const [row,setRow]=useState<InventoryRow>({id:'fixture-meter',result:'pending',meter_template:template,meter_response:null,meter_response_version:0});
  const [dirty,setDirty]=useState(false);const onDirty=useCallback((_id:string,value:boolean)=>setDirty(value),[]);
  const [unavailable,setUnavailable]=useState(false);const [readOnly,setReadOnly]=useState(false);const [unit,setUnit]=useState('1203');
  return <main style={{maxWidth:1060,margin:'0 auto',padding:16}}><h1>Apparatus &amp; checks · isolated preview</h1><p>Fictional observations only. This preview does not read or change department records.</p><nav style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}><label>Preview vehicle<select value={unit} onChange={e=>setUnit(e.target.value)}><option>1203</option><option>1204</option></select></label><label><input type="checkbox" checked={unavailable} onChange={e=>setUnavailable(e.target.checked)}/>Simulate failed save</label><label><input type="checkbox" checked={readOnly} onChange={e=>setReadOnly(e.target.checked)}/>Member preview</label><button onClick={()=>setRow(r=>({...r,meter_response_version:Number(r.meter_response_version)+1}))}>Simulate crew update</button></nav>
    <p role="status">{unit==='1203'?'Tuesday':'Friday'} weekly · {dirty?'Unsaved local edits':'No unsaved edits'}</p>
    <MeterCheckEditor item={row} apparatus={unit} employees={[{id:'fixture-member',name:'Fixture Firefighter'}]} busy={false} canCheck={true} preview={readOnly} onDirty={onDirty} onSave={async(response,version,complete,photo)=>{if(unavailable)throw new Error('Save was not confirmed. Your entries are still here.');if(version!==Number(row.meter_response_version))throw new Error('Another crew member saved this entry. Load the latest saved entry.');const saved={...row,meter_response:JSON.stringify(response),meter_response_version:version+1,meter_photo_id:photo?'fixture-photo':row.meter_photo_id || null,result:complete?(meterIssues(response).length?'failed':'pass'):'pending',notes:meterSummary(response)};setRow(saved);return saved;}}/>
    <section style={{marginTop:24}}><h2>Saved report preview</h2><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{row.meter_response?meterSummary(meterResponse(row.meter_response)):'No observations saved.'}</pre></section>
    <MeterTemplateEditor item={row} apparatus={unit} onSave={async(_item,title,instructions)=>{const saved={...row,meter_template:JSON.stringify({...JSON.parse(String(row.meter_template)),title,instructions}),meter_template_version:Number(row.meter_template_version || 0)+1};setRow(saved);return saved;}}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
