import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const literal=v=>v==null?'NULL':typeof v==='number'?(Number.isFinite(v)?String(v):'NULL'):`'${String(v).replaceAll("'","''")}'`;
const insert=(table,row)=>`INSERT INTO firehouse.${table}(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(literal).join(',')}) ON CONFLICT DO NOTHING;`;
export function prepareFieldReconciliation(before,pack,flow,hyds){
 if(before.departmentId!=='14a76771-4c24-481b-8def-e6cce005c17b')throw Error('The verified Stickney department snapshot is required.');
 if(flow.some(f=>f.customerSlug!=='stickneyfire')||hyds.some(h=>h.customerSlug&&h.customerSlug!=='stickneyfire'))throw Error('Only Stickney-owned FlowMSP records may be imported.');
 const native=before.tables,existing=new Map(native.field_preplans.map(p=>[p.id,p])),queue=new Map(native.field_preplan_imports.map(p=>[p.id,p])),nativeHyd=new Map(native.field_hydrants.map(h=>[h.id,h]));
 const originalPhotos=new Set(native.field_preplan_photos.map(p=>p.id)),locations=new Map(flow.map(f=>[f.id,f])),flowHyd=new Map(hyds.map(h=>[h.id,h]));
 const sql=[],photos=[],groups=pack.records.filter(r=>r.kind==='plan'),seenFlow=new Set(),seenNative=new Set(),flowMap=new Map();let added=0,linked=0;
 const importedAt=pack.createdAt;
 for(const group of groups){
  const ids=group.raw.Stickney.map(p=>p.id),flowIds=group.keys.filter(k=>k.startsWith('flowmsp:')).map(k=>k.slice(8)),id=ids[0]||flowIds[0];
  if(!id)throw Error('Plan group has no stable source ID.');
  for(const sid of ids){if(!existing.has(sid)||seenNative.has(sid))throw Error('Invalid or repeated Stickney ID.');seenNative.add(sid);}
  const sources=flowIds.map(fid=>{if(seenFlow.has(fid)||!locations.has(fid))throw Error('Missing or repeated FlowMSP ID.');seenFlow.add(fid);flowMap.set(fid,id);return locations.get(fid);});
  const source=sources[0],b=source?.building||{},p=group.plan;
  if(!existing.has(id)){
   const latitude=Number(p.latitude),longitude=Number(p.longitude),ring=p.footprint?.rings?.[0]?.map(([lng,lat])=>({lat,lng}))||[];
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<40||latitude>43||longitude< -90||longitude> -86)throw Error('A new building has no supported local map position.');
   const construction={constructionType:b.constructionType||'',roofType:b.roofType||'',roofSupportSystem:b.roofConstruction||'',floorsAboveGrade:Number(source?.storey)||null,floorsBelowGrade:source?.storeyBelow??null,notes:b.roofMaterial?'Roof material: '+b.roofMaterial:''};
   const occupancy={classification:b.occupancyType||'',scheduleNotes:[b.hoursOfOperation,b.normalPopulation?'Normal population: '+b.normalPopulation:''].filter(Boolean).join('\n')};
   sql.push(insert('field_preplans',{id,business_name:p.name,address:p.address,latitude,longitude,footprint:JSON.stringify(ring),footprint_square_feet:0,floor_count:Number(source?.storey)||0,construction_type:'unknown',occupancy_flow_category:'other',sprinkler_standard:'unknown',construction:b.constructionType||'',access_info:b.notes||'',alarm_system:b.fireAlarm||'Unknown',knox_box:'Unknown',riser:b.standPipe||'Unknown',fdc:'Unknown',sprinkler_system:b.sprinklered||'Unknown',contact_info:[b.ownerContact,b.ownerPhone].filter(Boolean).join('\n'),status:'Quick Preplan',publication_status:'draft',completeness_status:'incomplete',construction_profile:JSON.stringify(construction),occupancy_profile:JSON.stringify(occupancy),target_hazard_level:source?.isHighHazard?'high':'low',created_by:'flowmsp-import',updated_by:'flowmsp-import',created_at:importedAt,updated_at:importedAt}));added++;
  }
  const specs=group.files.filter(f=>f.sha256&&!originalPhotos.has(f.key)).map(f=>({...f,id:f.key,preplanId:id}));
  for(const f of specs){if(!f.key.startsWith('flow-'))throw Error('An original private photo must not be reimported.');if(photos.some(p=>p.id===f.id))throw Error('Duplicate photo ID.');photos.push(f);}
  for(const source of sources){const oldDetailed=group.raw.FlowMSP.find(f=>f.id===source.id);const payload={...source,...(oldDetailed?.images?{images:oldDetailed.images}:{}),integrationPhotos:specs};sql.push(insert('field_preplan_external_details',{source_system:'flowmsp',external_id:source.id,preplan_id:id,payload:JSON.stringify(payload),review_notes:group.warnings.filter(w=>!w.includes('PDF documents')).join('\n'),imported_at:importedAt}));}
  for(const key of group.keys.filter(k=>k.startsWith('queue:'))){const q=queue.get(key.slice(6));if(!q)throw Error('Queue record is missing.');if(q.linked_preplan_id&&q.linked_preplan_id!==id)throw Error('Existing queue link must not be replaced.');if(!q.linked_preplan_id){sql.push(`UPDATE firehouse.field_preplan_imports SET linked_preplan_id=${literal(id)},status='completed' WHERE id=${literal(q.id)} AND linked_preplan_id IS NULL;`);linked++;}}
 }
 // Every FlowMSP location must resolve once, while ambiguous legacy records remain untouched.
 if(seenFlow.size!==flow.length)throw Error('Not every FlowMSP location is accounted for.');
 for(const record of pack.records.filter(r=>r.kind==='hydrant')){
  const h=record.raw.Stickney,f=flowHyd.get(record.raw.FlowMSP.id);
  if(!h||!nativeHyd.has(h.id)||!f)throw Error('Hydrant must resolve to an existing Stickney ID.');
  if(Number.isFinite(Number(f.flow))&&Number(f.flow)>0)sql.push(insert('field_hydrant_service_events',{id:'flowmsp-flow-'+f.id,hydrant_id:h.id,kind:'flow',performed_on:null,flow_gpm:Number(f.flow),notes:'',actor:'flowmsp-import',created_at:importedAt,source_system:'flowmsp',source_external_id:f.id}));
 }
 for(const record of pack.records.filter(r=>r.kind==='held'&&r.raw.Stickney?.length))for(const p of record.raw.Stickney)sql.push(insert('field_preplan_external_details',{source_system:'legacy_review',external_id:p.id,preplan_id:p.id,payload:'{}',review_notes:record.warnings.join('\n'),imported_at:importedAt}));
 for(const record of pack.records.filter(r=>r.kind==='held'&&r.raw.queue?.length))for(const q of record.raw.queue)sql.push(`UPDATE firehouse.field_preplan_imports SET status='review_required',geocode_note=concat_ws(E'\\n',NULLIF(geocode_note,''),${literal('Identity needs review: '+record.warnings.join('\n'))}) WHERE id=${literal(q.id)} AND linked_preplan_id IS NULL AND status<>'review_required';`);
 const summary={existingPlans:existing.size,addedPlans:added,totalPlans:existing.size+added,flowLocations:seenFlow.size,existingHydrants:nativeHyd.size,addedHydrants:0,addedQueueLinks:linked,missingPhotos:photos.length,retainedDocuments:native.field_preplan_assets.length,heldItems:pack.records.filter(r=>r.kind==='held').map(r=>({id:r.id,name:r.name,address:r.address,reason:r.warnings.join('\n')}))};
 return {sql:sql.join('\n'),summary,photos,flowMap:Object.fromEntries(flowMap)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [snapshotPath,packagePath,locationPath,hydrantPath,out]=process.argv.slice(2);if(!out)throw Error('Pass snapshot, reviewed package, current locations, current hydrants and an output prefix.');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const result=prepareFieldReconciliation(read(snapshotPath),read(packagePath),read(locationPath).data,read(hydrantPath).data);
 fs.writeFileSync(out+'.sql',result.sql);fs.writeFileSync(out+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary));
}
