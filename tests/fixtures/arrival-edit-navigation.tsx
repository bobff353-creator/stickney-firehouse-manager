import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import QuickPreplan from '../../app/arrival/ui/quick-preplan';
import Editor, {type Draft} from '../../app/arrival/ui/editor';
import {blankPlan} from '../../app/arrival/lib/preplan';
import {preplanDetailDraft} from '../../app/arrival/lib/edit-navigation';
import '../../app/arrival/arrival.css';

const storageKey='fixture-preplan-edit-navigation';
localStorage.removeItem(storageKey);
window.fetch=async()=>{throw new Error('This fictional fixture cannot contact a server.');};
function Fixture(){
 const [draft,setDraft]=useState<Draft>({id:'fixture-preplan',revision:7,kind:'quick',data:{...blankPlan(),name:'Fictional training building',address:'100 Example Street',addressConfirmed:true,scope:'quick',step:5}});
 const [dark,setDark]=useState(false);
 const Component=draft.kind==='full'?Editor:QuickPreplan;
 return <main id="portal-workspace"><div className="arrival-app" data-theme={dark?'dark':'light'}><p>Fictional local test. No department records or server saves.</p><button onClick={()=>setDark(!dark)}>Toggle theme</button><Component key={draft.kind} initial={draft} storageKey={storageKey} onClose={()=>location.reload()} onSaved={()=>{}} onSubmitted={()=>{}} onEditDetails={(current:Draft,label:string)=>setDraft(preplanDetailDraft(current,label))}/></div></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
