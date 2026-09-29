import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import definition from './schema.json';
import {getAt,humanLabel,type Json,type Values,type NerisData,sectionFor} from './model';
// The published API uses escaped colons in patterns, invalid under JS's /u flag.
// Preserve those patterns and evaluate with the compatible non-unicode flag.
const ajv=new Ajv2020({allErrors:true,strict:false,validateFormats:true,allowUnionTypes:true,unicodeRegExp:false});addFormats(ajv);
const validate=ajv.compile({$ref:'#/components/schemas/IncidentPayload',components:definition.components});
export type Issue={path:string;section:string;message:string};
export function validateReport(data:NerisData):Issue[]{
 const payload=data.payload,issues:Issue[]=[];
 const add=(path:string,message:string)=>issues.push({path,section:sectionFor(path),message});
 validate(payload);
 for(const e of validate.errors||[]){
  if(e.keyword==='anyOf'||e.keyword==='oneOf')continue;
  const path=e.instancePath+(e.keyword==='required'?`/${e.params.missingProperty}`:''),parts=path.split('/').filter(p=>p&&p!=='base');
  const label=parts.map(p=>/^\d+$/.test(p)?`entry ${Number(p)+1}`:humanLabel(p).replace(/\bid\b/gi,'ID')).join(' › ')||'Report';
  let message=`${label}: check this value against the field instructions.`;
  if(e.keyword==='required')message=`Enter ${label}.`;
  else if(e.keyword==='enum'||e.keyword==='const')message=`${label}: choose an official option from the list.`;
  else if(e.keyword==='format')message=e.params.format==='date-time'?`${label}: enter a complete date and time, then choose its time zone.`:`${label}: enter a valid ${humanLabel(String(e.params.format)).toLowerCase()}.`;
  else if(e.keyword==='minItems')message=`${label}: add at least ${e.params.limit} ${e.params.limit===1?'entry':'entries'}.`;
  else if(e.keyword==='maxItems')message=`${label}: keep no more than ${e.params.limit} entries.`;
  else if(e.keyword==='minLength')message=`${label}: enter at least ${e.params.limit} characters.`;
  else if(e.keyword==='maxLength')message=`${label}: shorten this to ${e.params.limit} characters or fewer.`;
  else if(e.keyword==='minimum'||e.keyword==='exclusiveMinimum')message=`${label}: enter a number ${e.keyword==='minimum'?'at least':'greater than'} ${e.params.limit}.`;
  else if(e.keyword==='maximum'||e.keyword==='exclusiveMaximum')message=`${label}: enter a number ${e.keyword==='maximum'?'no greater than':'less than'} ${e.params.limit}.`;
  else if(e.keyword==='uniqueItems')message=`${label}: remove the repeated entry.`;
  else if(e.keyword==='type')message=`${label}: enter ${e.params.type==='integer'?'a whole number':e.params.type==='number'?'a number':'a value in the format shown by this field'}.`;
  add(path,message);
 }
 const types=Array.isArray(payload.incident_types)?payload.incident_types as Values[]:[],typeNames=types.map(t=>String(t.type||''));
 if(types.filter(t=>t.primary===true).length>1)add('/incident_types','Only one incident type may be primary.');
 if(new Set(typeNames).size!==typeNames.length)add('/incident_types','Each incident type may be selected only once.');
 for(const [field,prefix]of [['fire_detail','FIRE'],['hazsit_detail','HAZSIT'],['medical_details','MEDICAL']])if(payload[field]!=null&&!typeNames.some(t=>t.startsWith(`${prefix}||`)))add(`/${field}`,`This module requires a ${prefix} incident type.`);
 const aids=Array.isArray(payload.aids)?payload.aids as Values[]:[];
 const aidIds=aids.map(a=>a.department_neris_id);if(new Set(aidIds).size!==aidIds.length)add('/aids','Aid departments must be unique.');
 if(aidIds.includes(getAt(payload,'base.department_neris_id')??null))add('/aids','Aid cannot be given to or received from the reporting department itself.');
 const supportOnly=aids.length>0&&aids.every(a=>a.aid_type==='SUPPORT_AID'&&a.aid_direction==='GIVEN');
 if(!supportOnly&&typeNames.some(t=>t.startsWith('FIRE||STRUCTURE_FIRE')))for(const f of ['smoke_alarm','fire_alarm','other_alarm','fire_suppression'])if(!payload[f])add(`/${f}`,'Structure fires require this alarm / suppression module.');
 if(!supportOnly&&typeNames.includes('FIRE||STRUCTURE_FIRE||CONFINED_COOKING_APPLIANCE_FIRE')&&!payload.cooking_fire_suppression)add('/cooking_fire_suppression','Confined cooking-appliance fires require cooking suppression details.');
 const time=(path:string)=>{const v=getAt(payload,path);return typeof v==='string'?Date.parse(v):NaN;};
 for(const[a,b]of [['call_arrival','call_answered'],['call_answered','call_create'],['call_arrival','call_create']])if(time(`dispatch.${a}`)>time(`dispatch.${b}`))add(`/dispatch/${b}`,`${a.replaceAll('_',' ')} cannot be after ${b.replaceAll('_',' ')}.`);
 for(const key of ['unit_responses','dispatch.unit_responses']){const units=getAt(payload,key);if(Array.isArray(units))units.forEach((u,index)=>{const v=u as Values;if(!v?.unit_neris_id&&!v?.reported_unit_id)add(`/${key.replaceAll('.','/')}/${index}`,'Enter the NERIS unit ID or the actual reported unit ID.');});}
 function walk(value:Json,path:string,depth=0){if(depth>24)return;if(Array.isArray(value)){if(value.includes('NONE')&&value.length>1&&/(ppe_items|actions|impediments|suppression_appliances|investigation_types)$/.test(path))add(path,'None cannot be combined with another choice.');value.forEach((v,i)=>walk(v,`${path}/${i}`,depth+1));return;}if(value&&typeof value==='object'){
   if(path.endsWith('/in_use')&&value.in_use!==true&&value.intended!=null)add(`${path}/intended`,'Intended use can be set only when the location is in use.');
   if(path.includes('/chemicals/')&&value.release!=null&&value.release_occurred!==true)add(`${path}/release`,'Release details require confirmation that a release occurred.');
   if(/^\/electric_hazards\/\d+$/.test(path)&&value.involved_in_crash!=null&&!String(value.type).includes('ELECTRIC_VEHICLE'))add(`${path}/involved_in_crash`,'Crash involvement applies only to electric vehicle types.');
   for(const[k,v]of Object.entries(value))walk(v,`${path}/${k}`,depth+1);
 }}walk(payload,'');
 if(Array.isArray(payload.casualty_rescues))payload.casualty_rescues.forEach((v,i)=>{const c=v as Values,p=`/casualty_rescues/${i}`;if(c.type==='FF'&&getAt(c,'rescue.presence_known')!=null)add(p,'Presence known applies only to non-firefighters.');if(c.type!=='FF'){for(const path of ['rank','years_of_service','rescue.mayday','casualty.injury_or_noninjury.ff_injury_details'])if(getAt(c,path)!=null)add(`${p}/${path.replaceAll('.','/')}`,'This field applies only to firefighters.');}});
 // These are explicit local review safeguards, not additional state-mandated fields.
 const location=getAt(payload,'base.location');
 const locationRecorded=location&&typeof location==='object'&&!Array.isArray(location)&&['street','complete_number','additional_info','site','structure','marker','cross_streets'].some(k=>{const v=(location as Values)[k];return typeof v==='string'?Boolean(v.trim()):Array.isArray(v)&&v.length>0;});
 if(!locationRecorded&&!getAt(payload,'base.point.coordinates')&&!getAt(payload,'base.polygon.coordinates'))add('/base/location','Record the incident address, location description, or verified map geometry before local review.');
 if(!data.local.title.trim())add('/local/title','Give this report a title (local review requirement).');
 if(!data.local.writer.trim())add('/local/writer','Identify the report writer (local review requirement).');
 if(!data.local.reviewed)add('/local/reviewed','Confirm that you reviewed the facts and understand this is not a NERIS submission.');
 return issues.filter((v,i,a)=>a.findIndex(x=>x.path===v.path&&x.message===v.message)===i).slice(0,200);
}
