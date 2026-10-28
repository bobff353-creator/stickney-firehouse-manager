export type EsoObject = Record<string, unknown>;
export const esoObject = (v: unknown): EsoObject => v && typeof v === 'object' && !Array.isArray(v) ? v as EsoObject : {};
export const esoRows = (v: unknown): EsoObject[] => Array.isArray(v) ? v.map(esoObject) : [];
export const esoText = (v: unknown): string => typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
export const esoData = (b: EsoObject, tab: string) => esoObject(esoObject(b[tab]).data);
export const esoGuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export type EsoMedia = {attachmentId:string; filename:string; sha256:string; size:number; contentType:string};
export type EsoSummary = {inspectionId:string; inspectionNumber:string; title:string; address:string; status:string; type:string; inspector:string; scheduledDate:string; actualDates:string[]; photos:number; importedAt:string};
export type EsoFile = EsoMedia;
export function esoLabel(b:EsoObject,tab:string,list:string,id:unknown){
 const values=esoRows(esoObject(esoObject(esoObject(b[tab]).lists)[list]).values);
 return esoText(values.find(v=>v.itemId===id)?.itemName)||esoText(id);
}
export function esoMedia(b:EsoObject):EsoMedia[]{return esoRows(esoObject(b.importEvidence).media).map(m=>({attachmentId:esoText(m.attachmentId),filename:esoText(m.filename),sha256:esoText(m.sha256),size:Number(m.size),contentType:esoText(m.contentType)}));}
export function esoChecks(b:EsoObject){
 const d=esoData(b,'inspectionCodes'),answers=esoRows(d.compliances),rows=esoRows(d.checklistFireCodes);
 const checks=rows.map(row=>({...row,...answers.find(a=>a.inspectionChecklistFireCodeId===row.inspectionChecklistFireCodeId)}));
 const answered=new Set(checks.map(c=>c.complianceId).filter(Boolean));
 return [...checks,...answers.filter(a=>!answered.has(a.complianceId))];
}
export function validateEsoBundle(value:unknown){
 const b=esoObject(value),index=esoObject(b.index),meta=esoData(b,'metadata');
 if(!esoGuid(index.inspectionId)||index.inspectionId!==meta.inspectionId)throw Error('The original ESO inspection IDs must agree.');
 for(const tab of ['metadata','details','history','contacts','inspectionCodes','notes','permits','signatures'])if(!Object.hasOwn(esoObject(b[tab]),'data'))throw Error(`The original ESO ${tab} data is missing.`);
 if(!Object.hasOwn(b,'sourceCodes'))throw Error('The inspection’s original code text is missing.');
 if(!esoText(index.inspectionNumber))throw Error('Preserve the ESO inspection number.');
 if(!['locked','inprogress','scheduled','cancelled'].includes(esoText(meta.inspectionStatusId))||index.inspectionStatusId!==meta.inspectionStatusId)throw Error('Preserve the original ESO status.');
 const referenced=new Set<string>();
 for(const n of esoRows(esoObject(b.notes).data))if(n.noteAttachmentId)referenced.add(esoText(n.noteAttachmentId));
 for(const v of esoRows(esoData(b,'inspectionCodes').violations))for(const a of esoRows(v.attachments))referenced.add(esoText(a.itemId));
 const media=esoMedia(b);
 if(new Set(media.map(m=>m.attachmentId)).size!==media.length||media.length!==referenced.size)throw Error('Each original attachment needs exactly one import descriptor.');
 for(const m of media)if(!referenced.has(m.attachmentId)||!esoGuid(m.attachmentId)||!m.filename||m.filename.length>240||/[\r\n\x00-\x1f]/.test(m.filename)||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isInteger(m.size)||m.size<1||m.size>16777216||!['image/jpeg','image/png','image/webp','application/pdf'].includes(m.contentType))throw Error('An original attachment descriptor is invalid.');
 return b;
}
export function esoSummary(b:EsoObject,importedAt:string):EsoSummary{
 const i=esoObject(b.index),m=esoData(b,'metadata'),d=esoData(b,'details');
 const number=i.isReinspection?esoText(i.reInspectionNumber)||esoText(i.inspectionNumber):esoText(i.inspectionNumber);
 return {inspectionId:esoText(i.inspectionId),inspectionNumber:number,title:esoText(i.occupantName)||esoText(i.buildingName)||esoText(i.propertyName)||esoText(i.address1)||'Name not recorded in ESO',address:esoText(i.address1),status:esoText(m.inspectionStatusId),type:esoText(i.inspectionType),inspector:esoText(i.leadInspectorName),scheduledDate:esoText(d.scheduledDate),actualDates:[...new Set(esoRows(d.times).map(t=>esoText(t.inspectionDate)).filter(Boolean))],photos:esoMedia(b).length,importedAt};
}
export function esoMime(bytes:Uint8Array){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(Array.from(bytes.slice(0,8)).join(',')==='137,80,78,71,13,10,26,10')return 'image/png';
 const first=new TextDecoder().decode(bytes.slice(0,12));
 if(first.startsWith('%PDF-'))return 'application/pdf';
 if(first.startsWith('RIFF')&&first.slice(8)==='WEBP')return 'image/webp';
 return '';
}
