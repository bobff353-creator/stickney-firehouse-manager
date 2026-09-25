'use client';
/* eslint-disable @next/next/no-img-element -- Private images require browser session cookies; the server image optimizer has no owner session. */
import {useState} from 'react';
import type {InspectionFile} from './model';
export function EvidencePhotos({files,label,onAdd}:{files:InspectionFile[];label:string;onAdd?:(file:File,caption:string)=>Promise<void>}) {
 const [caption,setCaption]=useState('');
 return <section className="fi-evidence"><h4>Photos · {label}</h4><div className="fi-photo-grid">{files.filter(f=>f.contentType.startsWith('image/')).map(f=><figure key={f.id}><a href={`/api/fire-inspections/files/${encodeURIComponent(f.id)}`} target="_blank" rel="noreferrer"><img src={`/api/fire-inspections/files/${encodeURIComponent(f.id)}?inline=1`} alt={f.caption||`Evidence for ${label}`} loading="lazy"/></a><figcaption>{f.caption||f.filename}</figcaption></figure>)}</div>{onAdd&&<><label className="fi-field">Photo caption / location<input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="What the photo shows and where" maxLength={1000}/></label><label className="fi-field">Add deficiency photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file){await onAdd(file,caption);}}}/><small>JPG, PNG, or WebP, up to 4 MB. Progress saves before the photo uploads.</small></label></>}</section>;
}
