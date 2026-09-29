import {validateSetup,type ReportingSetup} from './setup-model';
import definition from './schema.json';
import type {CadLocationSource} from './cad-location';
export type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
export type Values=Record<string,Json>;
export type Schema={ $ref?:string; type?:string; title?:string; description?:string; format?:string; enum?:Json[]; const?:Json; properties?:Record<string,Schema>; required?:string[]; items?:Schema; anyOf?:Schema[]; oneOf?:Schema[]; discriminator?:{propertyName:string;mapping:Record<string,string>}; minItems?:number;maxItems?:number;minLength?:number;maxLength?:number;minimum?:number;maximum?:number;additionalProperties?:boolean|Schema; 'x-ui-label'?:string;'x-ui-hint'?:string };
export const schemaInfo={version:definition.version,verifiedAt:definition.verifiedAt,sha256:definition.sha256,source:definition.source};
export const schemas=definition.components.schemas as unknown as Record<string,Schema>;
export const ref=(name:string):Schema=>({$ref:`#/components/schemas/${name}`});
export function resolveSchema(node:Schema):Schema{if(node.$ref)return {...schemas[node.$ref.split('/').pop()!],...Object.fromEntries(Object.entries(node).filter(([k])=>k!=='$ref'))};const choices=node.anyOf?.filter(s=>s.type!=='null');if(choices?.length===1)return {...resolveSchema(choices[0]),...Object.fromEntries(Object.entries(node).filter(([k])=>k!=='anyOf'))};return node;}
export function humanLabel(key:string){if(/^[A-Z]{2,3}$/.test(key))return key;return key.replace(/Payload|Value/g,'').replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('||',' · ').replaceAll('_',' ').toLowerCase().replace(/\bneris\b/g,'NERIS').replace(/\bems\b/g,'EMS').replace(/\bcsst\b/g,'CSST').replace(/^./,c=>c.toUpperCase());}
export function textDescription(s:Schema){return (s['x-ui-hint']||s.description||'').replace(/<[^>]*>/g,'').replaceAll('`','').trim();}
export function getAt(value:Json,path:string):Json|undefined{return path.split('.').filter(Boolean).reduce<Json|undefined>((v,k)=>v&&typeof v==='object'?(v as Values)[k]:undefined,value);}
export function setAt(value:Values,path:string,next:Json|undefined):Values{const copy=structuredClone(value),keys=path.split('.');let target=copy;for(const k of keys.slice(0,-1)){if(!target[k]||typeof target[k]!=='object')target[k]={};target=target[k] as Values;}if(next===undefined)delete target[keys.at(-1)!];else target[keys.at(-1)!]=next;return copy;}
export type Section={id:string;title:string;hint:string;paths:string[]};
export const sections:Section[]=[
 {id:'core',title:'1 · Incident',hint:'Identify the report and choose what actually happened.',paths:['base.department_neris_id','base.incident_number','incident_types','special_modifiers']},
 {id:'location',title:'2 · Location',hint:'Confirm the final location, use, and people displaced.',paths:['base.location','base.point','base.polygon','base.location_use','base.people_present','base.displacement_count','base.displacement_causes','base.animals_rescued']},
 {id:'dispatch',title:'3 · Dispatch & times',hint:'Use actual call times. Times retain their UTC offset; nothing is estimated.',paths:['dispatch','tactic_timestamps']},
 {id:'units',title:'4 · Units & people',hint:'Record responding apparatus and the people who actually responded.',paths:['unit_responses']},
 {id:'actions',title:'5 · Actions & aid',hint:'Record actions taken, or select the actual reason no action was taken.',paths:['actions_tactics','aids','nonfd_aids']},
 {id:'details',title:'6 · Fire, EMS & hazards',hint:'Add the modules that match the selected incident types.',paths:['fire_detail','medical_details','hazsit_detail']},
 {id:'emerging',title:'7 · Emerging hazards',hint:'Batteries, electric vehicles, power generation, CSST, and medical oxygen.',paths:['electric_hazards','powergen_hazards','csst_hazard','medical_oxygen_hazard']},
 {id:'exposures',title:'8 · Exposures',hint:'Document each affected exposure separately.',paths:['exposures']},
 {id:'risk',title:'9 · Risk reduction',hint:'Record actual alarm and suppression-system conditions. Unknown is distinct from not present.',paths:['smoke_alarm','fire_alarm','other_alarm','fire_suppression','cooking_fire_suppression']},
 {id:'rescues',title:'10 · Rescues & casualties',hint:'Separate firefighter and civilian outcomes. Include only the NERIS data requested.',paths:['casualty_rescues']},
 {id:'narrative',title:'11 · Narrative',hint:'Describe the outcome and obstacles using verified facts. Avoid personal identifying information.',paths:['base.outcome_narrative','base.impediment_narrative']},
 {id:'files',title:'12 · Attachments',hint:'Keep supporting photos and PDFs with the saved report.',paths:[]},
 {id:'review',title:'13 · Review',hint:'Resolve missing information, then mark your local review complete. This does not submit to NERIS.',paths:[]},
];
export function schemaAt(path:string){let s=schemas.IncidentPayload;for(const key of path.split('.'))s=resolveSchema(s).properties?.[key]||{};return s;}
export function sectionFor(path:string){const dotted=path.replace(/^\//,'').replaceAll('/','.');return sections.find(s=>s.paths.some(p=>dotted===p||dotted.startsWith(`${p}.`)))?.id||'core';}
export type Personnel={id:string;employeeId:string;name:string;unit:string;role:string;reportWriter:boolean;narrative:string};
export type LocalData={status:'Draft'|'Reviewed';test:boolean;title:string;station:string;shift:string;battalion:string;division:string;writer:string;qualityControl:string;onset:string;reviewed:boolean;changeReason:string;cadSourceId:string;cadNotes:string;cadLocation?:CadLocationSource;personnel:Personnel[]};
export type NerisData={schemaVersion:string;payload:Values;local:LocalData;setup?:ReportingSetup};
export type NerisRecord={id:string;kind:'incident'|'settings';data:NerisData;version:number;archived:boolean;updatedAt?:string;createdAt?:string;updatedBy?:string};
export type NerisFile={id:string;recordId:string;filename:string;size:number;contentType:string;createdAt:string};
export type Snapshot={departmentId:string;records:NerisRecord[];members:{id:string;name:string;rank:string}[];attachments:NerisFile[]};
export function newReport():NerisRecord{return{id:crypto.randomUUID(),kind:'incident',version:0,archived:false,data:{schemaVersion:schemaInfo.version,payload:{base:{location:{}},dispatch:{location:{},unit_responses:[]},incident_types:[]},local:{status:'Draft',test:false,title:'',station:'',shift:'',battalion:'',division:'',writer:'',qualityControl:'',onset:'',reviewed:false,changeReason:'',cadSourceId:'',cadNotes:'',personnel:[]}}};}
export function normalizeData(input:unknown):NerisData{
 if(!input||typeof input!=='object')throw Error('A report is required.');
 const d=input as NerisData;
 if(d.schemaVersion!==schemaInfo.version)throw Error('This report uses a different schema version. Keep your draft and request a schema migration.');
 if(!d.payload||Array.isArray(d.payload)||typeof d.payload!=='object')throw Error('Report data must be an object.');
 if(!d.local||!['Draft','Reviewed'].includes(d.local.status)||typeof d.local.test!=='boolean'||typeof d.local.reviewed!=='boolean'||!Array.isArray(d.local.personnel)||d.local.personnel.length>300)throw Error('The local report details are invalid.');
 for(const k of ['title','station','shift','battalion','division','writer','qualityControl','onset','changeReason','cadSourceId','cadNotes'] as const){const v=d.local[k];if(typeof v!=='string'||v.length>(k==='cadNotes'?100000:2000))throw Error('A local report field is invalid or too long.');}
 for(const p of d.local.personnel){if(!p||typeof p!=='object'||typeof p.reportWriter!=='boolean'||['id','employeeId','name','unit','role','narrative'].some(k=>typeof p[k as keyof Personnel]!=='string'||String(p[k as keyof Personnel]).length>2000))throw Error('A personnel entry is invalid or too long.');}
 if(d.setup!==undefined)validateSetup(d.setup);
 if(d.local.cadLocation!==undefined){const s=d.local.cadLocation;if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['id','address','city'].includes(k))||['id','address','city'].some(k=>typeof s[k as keyof CadLocationSource]!=='string'||s[k as keyof CadLocationSource].length>2000))throw Error('The saved CAD address source is invalid or too long.');}
 if(d.local.test&&!d.local.title.toLowerCase().startsWith('test/'))throw Error('Name a test report with test/ at the beginning.');
 if(JSON.stringify(d).length>550000)throw Error('The report is too large. Use attachments for supporting documents.');
 return structuredClone(d);
}
export function reportLabel(r:NerisRecord){return r.data.local.title||String(getAt(r.data.payload,'base.incident_number')||'Untitled draft');}
export function reviewPackage(r:NerisRecord){return{format:'stickney-neris-review-package',version:1,exportedAt:new Date().toISOString(),schema:schemaInfo,delivery:{state:'not_connected',submitted:false,receipt:null},record:r,warning:'Local review package only. Official NERIS validation, enrollment, and receipt reconciliation are required before live submission.'};}
export function elapsedSeconds(start:Json|undefined,end:Json|undefined){if(typeof start!=='string'||typeof end!=='string')return null;const a=Date.parse(start),b=Date.parse(end);return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?(b-a)/1000:null;}
export const officialLinks={userGuide:'https://neris-dev-public.s3.us-east-2.amazonaws.com/docs/NERIS-User-Reference-Guide-V1.4_21JUN2026.pdf',coreSchemas:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Core_Schemas.zip',secondarySchemas:'https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Secondary_Schemas.zip',apiClient:'https://github.com/ulfsri/neris-api-client',partners:'https://neris.fsri.org/integration-partners',partnerRequest:'https://neris.atlassian.net/servicedesk/customer/portal/3/group/6/create/10027',illinois:'https://sfm.illinois.gov/iam/firedepartment/national-emergency-response-information-system--neris-.html',compliance:'https://sfm.illinois.gov/content/dam/soi/en/web/sfm/iam/firedepartment/neris-documents/NERIScompliancereport.pdf',api:'https://api.neris.fsri.org/v1/redoc',enrollment:'https://sfm.illinois.gov/content/dam/soi/en/web/sfm/sfmdocuments/documents/neris-website-documents/NERISIntegrationEnrollment.pdf',framework:'https://github.com/ulfsri/neris-framework',help:'https://neris.atlassian.net/wiki/spaces/NKB'};
