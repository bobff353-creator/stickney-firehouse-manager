'use client';
import {useState} from 'react';
import {useUnsavedWork} from '../use-unsaved-work';
export default function FieldPhotoImport(){
 const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');useUnsavedWork(false,busy);
 async function upload(){setBusy(true);let count=0;try{for(const file of files){setMessage(`Importing ${count+1} of ${files.length} photos…`);const f=new FormData();f.set('photo',file);const r=await fetch('/api/field-preplans/import-photos',{method:'POST',body:f}),b=await r.json();if(!r.ok)throw Error(b.error);count++;}setMessage(`${count} photos confirmed. Existing photos were reused.`);setFiles([]);}catch(e){setMessage(`${count} confirmed. ${(e as Error).message}`);}finally{setBusy(false);}}
 return <details className="field-photo-import"><summary>Import reviewed missing photos</summary><p>Only photos matched to the reviewed import package are accepted. Existing photo IDs are reused.</p><label>Source photos<input type="file" multiple disabled={busy} onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label><button type="button" disabled={busy||!files.length} onClick={()=>void upload()}>Import {files.length||''} photos</button>{message&&<p role="status">{message}</p>}</details>;
}
