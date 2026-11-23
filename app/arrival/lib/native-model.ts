import {createHash} from 'node:crypto';
import {blankPlan,blankDetails,type PlanData,type PlanRecord} from './preplan.ts';
import {parsePreplanContacts} from '../../preplan-contacts.ts';
import {operationalNotes,recordedHydrantFlow} from '../../preplans/field-workspace-data.ts';
import type {HydrantRecord} from './hydrant-activity.ts';
import {isOperationallyVisible,lifecycleState} from '../../preplans/domain.ts';
export type NativeOperational={constructionProfile?:Record<string,unknown>;occupancyProfile?:Record<string,unknown>;levels?:{id:string;name:string}[];alerts?:{title:string;message:string;archived?:number;effectiveAt?:string;expiresAt?:string;expirationAction?:"hide"|"mark_expired"|"require_verification"}[];[key:string]:unknown};
type Photo={id:string;side:string;filename:string;caption:string;featureId?:string|null};
export type NativePlan={id:string;businessName:string;address:string;publicationStatus:string;updatedAt:string;updatedBy:string;latitude:number;longitude:number;footprint:{lat:number;lng:number}[];contactInfo:string;construction:string;accessInfo:string;floorCount:number;constructionType:string;alarmSystem:string;knoxBox:string;riser:string;fdc:string;sprinklerSystem:string;photos:Photo[];features:{id:string;featureType:string;label:string;details:string;serviceStatus:string}[];fieldInfo?:{record:{hydrants?:{id:string}[];building?:Record<string,unknown>;highHazardDescription?:string};reviewNotes:string}[]};
export type NativeHydrant={id:string;hydrantNumber:string;address:string;latitude:number;longitude:number;serviceStatus:string;reportedFlow?:number|null;reportedFlowDate?:string|null;updatedAt?:string;notes:string;flushes:{id:string;flushedAt:string;notes:string}[];flowTests:{availableFlow:number;testedAt:string}[]};
export type NativeImport={id:string;businessName:string;address:string;status:string;linkedPreplanId:string|null;geocodeNote:string;sourcePayload?:Record<string,unknown>};
export type Asset={id:string;preplanId:string;filename:string;caption:string;contentType:string;sizeBytes:number};
export function hydrantRevision(row:NativeHydrant){return parseInt(createHash("sha256").update(JSON.stringify([row.updatedAt,row.serviceStatus,row.reportedFlow,row.flushes,row.flowTests])).digest("hex").slice(0,7),16)+1;}
export function toHydrant(row:NativeHydrant):HydrantRecord {const test=row.flowTests[0],flowDate=test&&(!row.reportedFlowDate||Date.parse(test.testedAt)>=Date.parse(row.reportedFlowDate))?test.testedAt:row.reportedFlowDate||null;return {id:row.id,recordId:row.id,revision:hydrantRevision(row),number:row.hydrantNumber,address:row.address,latitude:row.latitude,longitude:row.longitude,status:row.serviceStatus==="out_of_service"?"Out of service":row.serviceStatus==="in_service"?"In service":"Unknown",reportedFlow:recordedHydrantFlow(row),flowSourceDate:flowDate,statusSourceDate:row.updatedAt||null,flowTestDate:flowDate||undefined,lastFlushed:row.flushes[0]?.flushedAt,notes:operationalNotes(row.notes),sources:["Stickney Firehouse Manager"]};}
function system(value:string){return {answer:(!value||/unknown|not entered/i.test(value)?"Unknown":/^(no|none)$/i.test(value)?"No":"Yes") as "Unknown"|"Yes"|"No",location:value,status:"Not checked" as const};}
function photoType(filename:string):PlanData["photos"][number]["type"]{return /\.png$/i.test(filename)?"image/png":/\.webp$/i.test(filename)?"image/webp":"image/jpeg";}
export function splitNativeAddress(value:string){
  const match=value.match(/^(.+?),\s*([^,]+),\s*((?:IL|Illinois)\b.*)$/i);
  if(match)return {address:match[1].trim(),city:match[2].trim(),region:match[3].trim()};
  const plain=value.match(/^(.+?)\s*,?\s*\b(Stickney|Berwyn|Chicago|Cicero|Lyons|Forest View|McCook)\s*,?\s+((?:IL|Illinois)\b.*)$/i);
  return plain?{address:plain[1].replace(/,\s*$/,"").trim(),city:plain[2],region:plain[3].trim()}:{address:value,city:"",region:""};
}
export function toArrival(row:NativePlan & {operational?:NativeOperational},assets:Asset[]=[]):PlanRecord {
  const p=blankPlan(),contacts=parsePreplanContacts(row.contactInfo),details=blankDetails();
  details.standpipe= {...details.standpipe,...system(row.riser),type:row.riser};
  const seen=new Set<string>();
  p.photos=row.photos.map(photo=>{const side:PlanData["photos"][number]["side"]=(/^[ABCD]$/.test(photo.side)&&!photo.featureId&&!seen.has(photo.side)?photo.side:"Overview") as PlanData["photos"][number]["side"];seen.add(side);return {id:`native-photo-${photo.id}`,name:photo.filename||"Saved building photo",caption:photo.caption||"",side,type:photoType(photo.filename||"")};});
  p.photos.push(...assets.map(asset=>({id:`native-asset-${asset.id}`,name:asset.filename,caption:asset.caption||"",side:"Plan" as const,type:(["application/pdf","image/png","image/jpeg","image/webp"].includes(asset.contentType)?asset.contentType:"application/pdf") as PlanData["photos"][number]["type"]})));
  Object.assign(p,{name:row.businessName,address:row.address,city:"",region:"",visited:"",addressConfirmed:false,floors:row.floorCount?String(row.floorCount):"",construction:operationalNotes(row.construction)||"Unknown",access:operationalNotes(row.accessInfo),contactName:contacts[0]?.name||"",contactPhone:contacts[0]?.phones[0]?.number||"",notes:row.contactInfo?`Saved Stickney contacts:\n${row.contactInfo}`:"",latitude:Number.isFinite(row.latitude)?String(row.latitude):"",longitude:Number.isFinite(row.longitude)?String(row.longitude):"",basement:"Unknown",roof:"Unknown",scope:"quick",details,imported:{recordId:`native-${row.id}`,sources:["Stickney Firehouse Manager"],importedAt:row.updatedAt,linkedHydrantIds:[...new Set(row.fieldInfo?.flatMap(info=>info.record.hydrants?.map(h=>h.id)||[])||[])]}});
  p.systems={sprinklers:system(row.sprinklerSystem),fdc:system(row.fdc),alarm:system(row.alarmSystem),keybox:system(row.knoxBox),gas:system(""),electric:system("")};
  Object.assign(p,splitNativeAddress(row.address));
  const warnings=row.features.filter(feature=>feature.featureType==="hazard"||feature.serviceStatus==="out_of_service").map(feature=>[feature.label,feature.details,feature.serviceStatus==="out_of_service"?"Out of service":""].filter(Boolean).join(" · "));
  warnings.push(...row.fieldInfo?.map(info=>info.record.highHazardDescription||"").filter(Boolean)||[]);p.hazardNotes=warnings.join("\n");p.hazardStatus="Unknown";
  const profile=row.operational?.constructionProfile,occupancy=row.operational?.occupancyProfile;
  if(profile?.roofType)p.roof=String(profile.roofType);
  if(profile?.constructionType)p.construction=String(profile.constructionType);
  if(profile?.basementType&&String(profile.basementType).toLowerCase()!=="unknown")p.basement=/^(no|none|no basement)$/i.test(String(profile.basementType))?"No":"Yes";
  if(occupancy?.classification)p.occupancy=String(occupancy.classification);
  if(occupancy?.assistanceNeeded)p.lifeSafety=String(occupancy.assistanceNeeded);
  if(row.operational?.levels)details.levels=row.operational.levels.map(level=>({id:level.id,name:level.name,notes:"Saved Stickney floor / level"}));
  const alerts=row.operational?.alerts?.filter(alert=>!alert.archived&&isOperationallyVisible(alert))||[];
  if(alerts.length){p.hazardNotes=[p.hazardNotes,...alerts.map(alert=>`${alert.title}: ${alert.message}${lifecycleState(alert)==="expired"?" · expired / verify":""}`)].filter(Boolean).join("\n");p.hazardStatus="Present";}
  for(const [nativeType,key] of [["gas","gas"],["electric","electric"]] as const){const feature=row.features.find(feature=>feature.featureType===nativeType);if(feature)p.systems[key]={answer:"Yes",location:[feature.label,feature.details].filter(Boolean).join(" · ")||"Saved mapped location · see Stickney source",status:feature.serviceStatus==="out_of_service"?"Out of service":"Not checked"};}
  if(row.footprint.length>=3)p.footprint={rings:[row.footprint.map(point=>[point.lng,point.lat])],source:"source-import",sourceId:row.id,sourceYear:"Unknown",checkedAt:null,checked:false,sourceAreaSqFt:null};
  const status=row.publicationStatus==="published"?"published":row.publicationStatus==="in_review"?"review":"draft";
  return {id:row.id,name:p.name,address:p.address,working:p,published:status==="published"?p:null,status,revision:1,publishedRevision:status==="published"?1:null,publishedAt:null,updatedAt:row.updatedAt,createdAt:row.updatedAt};
}
