import React from 'react';
import {createRoot} from 'react-dom/client';
import EmsDocuments from '../../app/ems-documents';
import '../../app/globals.css';
import '../../app/portal-usability.css';
import '../../app/admin-usability.css';
import '../../app/suite-theme.css';
import '../../app/readability.css';
const params=new URL(location.href).searchParams;
const items:{name:string;title:string;href:string}[]=[];
let writes=0;
window.fetch=async(_url,options)=>{
 if(options?.method==='POST'){
  if(writes++===0)return Response.json({error:'Fixture upload failed. Your selection is kept.'},{status:503});
  const form=options.body as FormData;const item={name:'fixture.pdf',title:String(form.get('title')),href:'#fixture-only'};items.push(item);return Response.json({item},{status:201});
 }
 return Response.json({items,canAdd:params.get('role')!=='member'});
};
createRoot(document.getElementById('root')!).render(<main className="portal-shell" data-theme={params.get('theme')||'light'}><section id="portal-workspace"><p>Fictional local library fixture. No real upload.</p><EmsDocuments/></section></main>);
