import type {PlanRecord} from "./preplan";
import { GET as nativePlans } from "../../api/field-preplans/route";
import { GET as nativeHydrants } from "../../api/field-hydrants/route";
import type { ImportEntity, ImportSummary } from "./imports";
import { HttpError, type identity } from "./server";

export type Context=Awaited<ReturnType<typeof identity>>;
export {toArrival,toHydrant} from './native-model';
import {toArrival,toHydrant,type NativePlan,type NativeHydrant,type NativeImport,type Asset} from './native-model';
import type {NativeOperational} from './native-model';
export async function nativeData(request:Request,context:Context){
  const [plansResponse,hydrantsResponse,assetRows]=await Promise.all([nativePlans(request),nativeHydrants(request),context.db.prepare("SELECT id,preplan_id preplanId,original_filename filename,caption,mime_type contentType,file_size sizeBytes FROM field_preplan_assets WHERE archived=0").all<Asset>()]);
  if(!plansResponse.ok||!hydrantsResponse.ok)throw new HttpError(503,"Saved Stickney records could not be loaded. Retry before changing a preplan.");
  const plans=await plansResponse.json() as {preplans:NativePlan[];imports:NativeImport[]};const hydrants=await hydrantsResponse.json() as {hydrants:NativeHydrant[]};
  const [profiles,levels,alerts,hazmat,spaces,annotations,hoseLays]=await Promise.all([
    context.db.prepare("SELECT id,construction_profile constructionProfile,occupancy_profile occupancyProfile FROM field_preplans").all<{id:string;constructionProfile:string;occupancyProfile:string}>(),
    context.db.prepare("SELECT id,preplan_id preplanId,name,archived FROM field_preplan_levels").all(),
    context.db.prepare("SELECT id,preplan_id preplanId,title,instructions message,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction,archived FROM field_preplan_alerts").all(),
    context.db.prepare("SELECT * FROM field_preplan_hazmat").all(),context.db.prepare("SELECT * FROM field_preplan_spaces").all(),context.db.prepare("SELECT * FROM field_preplan_annotations").all(),context.db.prepare("SELECT * FROM field_preplan_hose_lays").all(),
  ]);
  const parse=(value?:string)=>{try{return JSON.parse(value||"{}");}catch{return {};}};
  const enhanced=plans.preplans.map(plan=>{const profile=profiles.results.find(row=>row.id===plan.id);const operational:NativeOperational={constructionProfile:parse(profile?.constructionProfile),occupancyProfile:parse(profile?.occupancyProfile),levels:levels.results.filter(row=>row.preplanId===plan.id&&!row.archived) as {id:string;name:string}[],alerts:alerts.results.filter(row=>row.preplanId===plan.id) as NativeOperational["alerts"],hazmat:hazmat.results.filter(row=>row.preplan_id===plan.id),spaces:spaces.results.filter(row=>row.preplan_id===plan.id),annotations:annotations.results.filter(row=>row.preplan_id===plan.id),hoseLays:hoseLays.results.filter(row=>row.preplan_id===plan.id)};return {...plan,operational};});
  return {nativePlans:enhanced,nativeHydrants:hydrants.hydrants,plans:enhanced.filter(plan=>plan.publicationStatus!=="archived").map(plan=>toArrival(plan,assetRows.results.filter(asset=>asset.preplanId===plan.id))),hydrants:hydrants.hydrants.filter(row=>row.serviceStatus!=="archived").map(toHydrant),imports:plans.imports,assets:assetRows.results};
}
export function nativeSource(row:NativePlan,plan:PlanRecord,assets:Asset[]):ImportEntity {
  return {id:`native-${row.id}`,kind:"plan",name:row.businessName,address:row.address,keys:[`stickney:${row.id}`],plan:plan.working,sourcePublished:row.publicationStatus==="published",sourcePublishedAt:null,sourceStatus:row.publicationStatus,warnings:row.fieldInfo?.map(info=>info.reviewNotes).filter(Boolean)||[],files:assets.map(asset=>({key:asset.id,name:asset.filename,type:asset.contentType as "application/pdf",size:asset.sizeBytes,sha256:null,caption:asset.caption||"",originalUrl:`https://stickney-firehouse-manager-fire-pre-plan-pro.vercel.app/api/field-preplans/assets/${asset.id}`,side:"Plan"})),raw:row};
}
export function importSummary(source:ImportEntity,complete=true):ImportSummary{return {id:source.id,kind:source.kind,name:source.name,address:source.address,sourceStatus:source.sourceStatus,warnings:source.warnings,fileCount:source.files.length,copiedFiles:0,linkedFiles:source.files.length,complete,entityId:source.kind==="plan"?source.keys[0]?.replace(/^stickney:/,"")||source.id:source.id};}
export async function savedRows<T>(context:Context,kind:string,parent?:string):Promise<T[]>{const result=await context.db.prepare(`SELECT payload FROM arrival_preplan_records WHERE kind=?${parent?" AND parent_id=?":""} ORDER BY updated_at DESC`).bind(...(parent?[kind,parent]:[kind])).all<{payload:string}>();return result.results.map(row=>JSON.parse(row.payload) as T);}
export async function savedRow<T>(context:Context,kind:string,id:string):Promise<T|null>{const row=await context.db.prepare("SELECT payload FROM arrival_preplan_records WHERE kind=? AND id=?").bind(kind,id).first<{payload:string}>();return row?JSON.parse(row.payload) as T:null;}
export function insert(context:Context,kind:string,id:string,parent:string|null,revision:number,payload:unknown){return context.db.prepare("INSERT INTO arrival_preplan_records(kind,id,parent_id,revision,payload,created_by,updated_at) VALUES(?,?,?,?,?,?,?)").bind(kind,id,parent,revision,JSON.stringify(payload),context.email,new Date().toISOString()).expectChanges(1);}
export function update(context:Context,kind:string,id:string,revision:number,payload:unknown){return context.db.prepare("UPDATE arrival_preplan_records SET revision=revision+1,payload=?,updated_at=? WHERE kind=? AND id=? AND revision=?").bind(JSON.stringify(payload),new Date().toISOString(),kind,id,revision).expectChanges(1);}
export async function transaction(context:Context,statements:ReturnType<Context["db"]["prepare"]>[]){try{await context.db.batch(statements);}catch{throw new HttpError(409,"This record changed, or the save could not be confirmed. Keep your device draft, reopen the saved record, and try again.");}}
