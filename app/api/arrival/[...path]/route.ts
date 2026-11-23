import { createHash } from "node:crypto";
import { body, handle, HttpError, identity, json, validId } from "../../../arrival/lib/server";
import { importSummary, insert, nativeData, nativeSource, savedRow, savedRows, transaction, update, type Context } from "../../../arrival/lib/native-records";
import { blockers, planSchema, type PlanRecord, type PlanEvent, type PlanData } from "../../../arrival/lib/preplan";
import { normalizeStreet, importEntitySchema, sourceFileUrlAllowed, type ImportEntity } from "../../../arrival/lib/imports";
import { observationSchema, type Observation } from "../../../arrival/lib/observations";
import { hydrantActivitySchema, type HydrantActivity } from "../../../arrival/lib/hydrant-activity";
import { getPortalStorage } from "../../../portal-storage";
import { GET as nativePhoto } from "../../field-preplans/photos/[photoId]/route";
import { GET as nativeAsset } from "../../field-preplans/assets/[assetId]/route";
import { GET as nativeObservations } from "../../field-preplans/observations/route";
import { isSafePhoto } from "../../../upload-security";
import { GET as nativeService } from "../../field-hydrants/service/route";
import { POST as saveNativeObservation } from "../../field-preplans/observations/route";
import { GET as nativeObservationPhoto } from "../../field-preplans/observations/photo/route";

export const dynamic="force-dynamic";
export const runtime="nodejs";
type RouteContext={params:Promise<{path:string[]}>};
type FileRecord={id:string;planId:string;name:string;type:string;size:number;key:string};
type StoredObservation=Observation&{photoKey?:string;requestHash?:string};
const canWork=(c:Context)=>["field_preplans.edit","field_preplans.review","field_preplans.publish"].some(p=>c.permissions.has(p as "field_preplans.edit"));
function requirePermission(c:Context,p:"field_preplans.edit"|"field_preplans.review"|"field_preplans.publish"|"field_preplans.manage_attachments"){if(!c.permissions.has(p))throw new HttpError(403,"Your account does not have permission for this action.");}
function visiblePlan(c:Context,p:PlanRecord){if(!canWork(c)){if(!p.published)throw new HttpError(404,"Published preplan not found.");return {...p,working:p.published,status:"published" as const};}return p;}
async function allPlans(request:Request,c:Context){
  const [native,saved]=await Promise.all([nativeData(request,c),savedRows<PlanRecord>(c,"plan")]);
  const map=new Map(native.plans.map(plan=>[plan.id,plan]));for(const plan of saved)map.set(plan.id,plan);
  return {native,plans:[...map.values()].filter(plan=>canWork(c)||plan.published).map(plan=>visiblePlan(c,plan)).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))};
}
async function getPlan(request:Request,c:Context,id:string){const saved=await savedRow<PlanRecord>(c,"plan",id);if(saved)return visiblePlan(c,saved);const native=await nativeData(request,c),plan=native.plans.find(plan=>plan.id===id);if(!plan)throw new HttpError(404,"This preplan was not found in your department.");return visiblePlan(c,plan);}
function event(c:Context,id:string,action:string,revision:number,note=""){const value:PlanEvent={action,revision,at:new Date().toISOString(),note};return insert(c,"event",crypto.randomUUID(),id,1,value);}
async function checkFiles(request:Request,c:Context,id:string,data:PlanData){
  const native=await nativeData(request,c),source=native.plans.find(plan=>plan.id===id),allowed=new Set(source?.working.photos.map(photo=>photo.id)||[]),seen=new Set<string>();
  for(const photo of data.photos){if(seen.has(photo.id))throw new HttpError(400,"A photo was added more than once.");seen.add(photo.id);if(allowed.has(photo.id))continue;const stored=await savedRow<FileRecord>(c,"file",photo.id);if(!stored||stored.planId!==id||stored.type!==photo.type)throw new HttpError(400,"A file does not belong to this building. Upload it again.");}
}
async function savePlan(request:Request,c:Context,id:string,create=false){
  requirePermission(c,"field_preplans.edit");const input=await body(request),parsed=planSchema.safeParse(input.data);if(!parsed.success)throw new HttpError(422,"Check the preplan fields and try again.");
  const data=parsed.data;if(!data.name||!data.address)throw new HttpError(422,"Enter a building name and street address to save a draft.");
  const at=new Date().toISOString(),old=await savedRow<PlanRecord>(c,"plan",id);
  if(create){
    if(old){if(JSON.stringify(old.working)===JSON.stringify(data))return json({plan:old});throw new HttpError(409,"This record ID already contains saved work. Reopen that preplan.");}
    const existing=(await allPlans(request,c)).plans.filter(plan=>normalizeStreet(plan.working.address.split(",")[0])===normalizeStreet(data.address.split(",")[0])&&(!plan.working.city||!data.city||plan.working.city.toLowerCase()===data.city.toLowerCase()));
    if(existing.length)throw new HttpError(409,`A saved preplan already uses this address: ${existing[0].name}. Open that building instead of creating a duplicate.`);
    if(data.photos.length)throw new HttpError(400,"Save the building before uploading photos.");
    const plan:PlanRecord={id,name:data.name,address:data.address,working:data,published:null,status:"draft",revision:1,publishedRevision:null,publishedAt:null,createdAt:at,updatedAt:at};
    await transaction(c,[insert(c,"plan",id,null,1,plan),event(c,id,"Created",1,"Field visit started.")]);return json({plan},201);
  }
  const previous=old||await getPlan(request,c,id);
  if(input.revision!==previous.revision)throw new HttpError(409,"A newer version was saved. Your device draft is kept. Export it, then reopen the saved record.");
  if(!old&&data.imported?.importedAt!==previous.working.imported?.importedAt)throw new HttpError(409,"The Stickney source record changed. Reopen it before saving your working copy.");
  await checkFiles(request,c,id,data);
  const plan:PlanRecord={...previous,name:data.name,address:data.address,working:data,status:"draft",revision:previous.revision+1,updatedAt:at};
  await transaction(c,[old?update(c,"plan",id,previous.revision,plan):insert(c,"plan",id,null,plan.revision,plan),event(c,id,"Draft saved",plan.revision,"Published arrival version unchanged.")]);return json({plan});
}
async function transition(request:Request,c:Context,id:string){
  const input=await body(request),stored=await savedRow<PlanRecord>(c,"plan",id),previous=stored||await getPlan(request,c,id);if(input.revision!==previous.revision)throw new HttpError(409,"This record changed. Reopen it before reviewing.");
  const action=input.action,note=String(input.note||"").trim().slice(0,2000),at=new Date().toISOString();let plan:PlanRecord={...previous,revision:previous.revision+1,updatedAt:at};
  if(action==="submit"){requirePermission(c,"field_preplans.edit");if(previous.status!=="draft")throw new HttpError(409,"Only a working draft can be sent for review.");const missing=blockers(previous.working);if(missing.length)throw new HttpError(422,missing[0].text);plan.status="review";}
  else if(action==="return"){requirePermission(c,"field_preplans.review");if(previous.status!=="review"||!note)throw new HttpError(422,"Add a correction note before returning the visit.");plan.status="draft";}
  else if(action==="publish"){requirePermission(c,"field_preplans.publish");if(previous.status!=="review"||input.acknowledged!==true)throw new HttpError(422,"Review the visit and acknowledge remaining unknowns before publishing.");const missing=blockers(previous.working);if(missing.length)throw new HttpError(422,missing[0].text);plan={...plan,status:"published",published:structuredClone(previous.working),publishedAt:at,publishedRevision:plan.revision};}
  else throw new HttpError(400,"Unknown review action.");
  const statements=[stored?update(c,"plan",id,previous.revision,plan):insert(c,"plan",id,null,plan.revision,plan),event(c,id,action==="publish"?"Published":action==="submit"?"Sent for review":"Returned for correction",plan.revision,note)];
  // Updating a working copy never changes the existing approved Stickney record.
  // Publication synchronizes its core fields with a source-version check.
  if(action==="publish"){
    const native=(await nativeData(request,c)).nativePlans.find(row=>row.id===id);
    if(native){if(previous.working.imported?.importedAt!==native.updatedAt)throw new HttpError(409,"The underlying Stickney record changed. Reopen its source details before publishing; no records were replaced.");
      const p=plan.published!;p.imported={...p.imported!,importedAt:at};plan.working=structuredClone(p);
      statements[0]=stored?update(c,"plan",id,previous.revision,plan):insert(c,"plan",id,null,plan.revision,plan);
      const sys=(key:keyof PlanData["systems"])=>p.systems[key].answer==="No"?"None":p.systems[key].answer==="Yes"?(p.systems[key].location||"Present · location not recorded"):"Unknown";
      statements.push(c.db.prepare("UPDATE field_preplans SET publication_status='published',business_name=?,address=?,access_info=?,construction=?,alarm_system=?,knox_box=?,fdc=?,sprinkler_system=?,updated_by=?,updated_at=? WHERE id=? AND updated_at=?").bind(p.name,[p.address,p.city,p.region].filter(Boolean).join(", "),p.access,p.construction,sys("alarm"),sys("keybox"),sys("fdc"),sys("sprinklers"),c.email,at,id,native.updatedAt).expectChanges(1));
    }
    else {
      const p=plan.published!,lat=Number(p.latitude),lng=Number(p.longitude);
      if(p.latitude.trim()&&p.longitude.trim()&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){
        const footprint=p.footprint?.rings[0]?.map(([lng,lat])=>({lat,lng}))||[];
        const sys=(key:keyof PlanData["systems"])=>p.systems[key].answer==="No"?"None":p.systems[key].answer==="Yes"?(p.systems[key].location||"Present · location not recorded"):"Unknown";
        statements.push(c.db.prepare("INSERT INTO field_preplans(id,business_name,address,latitude,longitude,footprint,floor_count,construction_type,sprinkler_standard,construction,access_info,alarm_system,knox_box,fdc,sprinkler_system,status,publication_status,created_by,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,'unknown','unknown',?,?,?,?,?,?,'Arrival Preplan','published',?,?,?)").bind(id,p.name,[p.address,p.city,p.region].filter(Boolean).join(", "),lat,lng,JSON.stringify(footprint),p.floors?Number(p.floors):0,p.construction,p.access,sys("alarm"),sys("keybox"),sys("fdc"),sys("sprinklers"),c.email,c.email,at).expectChanges(1));
        p.imported={recordId:`native-${id}`,sources:["Stickney Firehouse Manager"],importedAt:at,linkedHydrantIds:p.imported?.linkedHydrantIds||[]};plan.working=structuredClone(p);statements[0]=stored?update(c,"plan",id,previous.revision,plan):insert(c,"plan",id,null,plan.revision,plan);
      }
    }
    if(native||plan.published?.imported?.recordId===`native-${id}`){
      const files=await savedRows<FileRecord>(c,"file",id);
      for(const photo of plan.published!.photos){const file=files.find(file=>file.id===photo.id);if(!file)continue;
        if(photo.side==="Plan"||photo.type==="application/pdf")statements.push(c.db.prepare("INSERT INTO field_preplan_assets(id,preplan_id,category,original_filename,object_key,mime_type,file_size,caption,created_by,updated_by) VALUES(?,?,'floor_plan',?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET caption=excluded.caption,updated_by=excluded.updated_by").bind(`arrival-${file.id}`,id,file.name,file.key,file.type,file.size,photo.caption,c.email,c.email));
        else statements.push(c.db.prepare("INSERT INTO field_preplan_photos(id,preplan_id,side,filename,object_key,caption,created_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET caption=excluded.caption").bind(`arrival-${file.id}`,id,photo.side,file.name,file.key,photo.caption,c.email));
      }
    }
  }
  await transaction(c,statements);return json({plan});
}
async function serveFile(request:Request,c:Context,id:string){
  if(id.startsWith("native-photo-"))return nativePhoto(request,{params:Promise.resolve({photoId:id.slice(13)})});
  if(id.startsWith("native-asset-"))return nativeAsset(request,{params:Promise.resolve({assetId:id.slice(13)})});
  const file=await savedRow<FileRecord>(c,"file",id);if(!file)throw new HttpError(404,"File not found.");const accessible=await getPlan(request,c,file.planId);if(!canWork(c)&&!accessible.published?.photos.some(photo=>photo.id===id))throw new HttpError(404,"Published file not found.");const object=await getPortalStorage().get(file.key);if(!object)throw new HttpError(404,"The saved file is unavailable.");return new Response(object.body,{headers:{"content-type":file.type,"content-disposition":`inline; filename="${file.name.replace(/["\r\n]/g,"_")}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
async function uploadFile(request:Request,c:Context){requirePermission(c,"field_preplans.manage_attachments");if(Number(request.headers.get("content-length"))>9*1024*1024)throw new HttpError(413,"Choose a file under 8 MB.");const form=await request.formData(),planId=validId(form.get("planId"));await getPlan(request,c,planId);const file=form.get("file");if(!(file instanceof File)||!file.size||file.size>8*1024*1024||!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type))throw new HttpError(422,"Choose a JPG, PNG, WebP or PDF under 8 MB.");if(file.type==="application/pdf"){if(new TextDecoder().decode((await file.arrayBuffer()).slice(0,5))!=="%PDF-")throw new HttpError(422,"Choose a valid PDF.");}else if(!await isSafePhoto(file))throw new HttpError(422,"Choose a supported photo. Convert HEIC to JPG first.");const id=crypto.randomUUID(),key=`arrival-preplans/${planId}/${id}`,record:FileRecord={id,planId,key,name:file.name.replace(/["\r\n\\]/g,"_").slice(0,250),type:file.type,size:file.size};await getPortalStorage().put(key,file.stream(),{httpMetadata:{contentType:file.type}});await transaction(c,[insert(c,"file",id,planId,1,record)]);return json({file:{id,name:record.name,type:file.type}},201);}

function forwarded(request:Request,path:string){return new Request(new URL(path,request.url),{headers:request.headers});}
async function hydrants(request:Request,c:Context,path:string[]):Promise<Response>{
  const native=await nativeData(request,c),id=path[1],planId=new URL(request.url).searchParams.get("planId");
  if(!id){let rows=native.hydrants;if(planId){const plan=await getPlan(request,c,validId(planId)),ids=(plan.published||plan.working).imported?.linkedHydrantIds||[];rows=rows.filter(row=>ids.includes(row.id));}return json({hydrants:rows,limited:false});}
  validId(id);const h=native.hydrants.find(row=>row.id===id),source=native.nativeHydrants.find(row=>row.id===id);if(!h||!source)throw new HttpError(404,"This active hydrant was not found.");
  if(request.method==="POST"){
    requirePermission(c,"field_preplans.edit");const parsed=hydrantActivitySchema.safeParse(await body(request));if(!parsed.success)throw new HttpError(422,parsed.error.issues[0].message);const input=parsed.data,old=await savedRow<HydrantActivity&{hash:string}>(c,"hydrant_activity",input.id),{revision,...details}=input,hash=createHash("sha256").update(JSON.stringify({hydrantId:id,...details})).digest("hex");
    if(old){if(old.hash!==hash)throw new HttpError(409,"This service entry was already saved with different details.");return hydrants(new Request(request.url,{headers:request.headers}),c,path);}
    if(revision!==h.revision)throw new HttpError(409,"This hydrant changed. Reload its latest details before saving your entry.");
    const at=new Date().toISOString(),entry:HydrantActivity&{hash:string}={id:input.id,kind:input.kind,performedOn:input.performedOn,notes:input.notes,status:input.status||null,flowGpm:input.flowGpm,at,hash};
    const status=input.status&&input.performedOn>=(source.updatedAt||"").slice(0,10)?(input.status==="In service"?"in_service":input.status==="Out of service"?"out_of_service":"unknown"):source.serviceStatus;
    const statements=[insert(c,"hydrant_activity",input.id,id,1,entry),c.db.prepare("UPDATE field_hydrants SET service_status=?,updated_by=?,updated_at=? WHERE id=? AND updated_at IS NOT DISTINCT FROM ?").bind(status,c.email,at,id,source.updatedAt||null).expectChanges(1)];
    if(input.kind==="flushing")statements.push(c.db.prepare("INSERT INTO field_hydrant_flushes(id,hydrant_id,flushed_at,flushed_by,water_clear,issues,notes) VALUES(?,?,?,?,0,'',?)").bind(input.id,id,`${input.performedOn}T12:00:00Z`,c.email,input.notes||"Flushing recorded; water clarity was not entered.").expectChanges(1));
    else {statements.push(c.db.prepare("INSERT INTO field_hydrant_service_events(id,hydrant_id,kind,performed_on,flow_gpm,notes,actor,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(input.id,id,input.kind,input.performedOn,input.flowGpm,input.notes,c.email,at).expectChanges(1));if(input.kind==="flow"&&input.performedOn>=(source.reportedFlowDate||"").slice(0,10))statements.push(c.db.prepare("UPDATE field_hydrants SET reported_flow=?,reported_flow_date=? WHERE id=?").bind(input.flowGpm,input.performedOn,id).expectChanges(1));}
    await transaction(c,statements);return hydrants(new Request(request.url,{headers:request.headers}),c,path);
  }
  const serviceResponse=await nativeService(forwarded(request,`/api/field-hydrants/service?hydrantId=${encodeURIComponent(id)}`));if(!serviceResponse.ok)throw new HttpError(503,"Hydrant history could not be verified.");
  const service=await serviceResponse.json() as {events:{id:string;kind:"flow"|"maintenance";performedOn:string;notes:string;flowGpm:number|null;createdAt:string}[]};
  const history=new Map<string,HydrantActivity>(service.events.map(row=>[row.id,{...row,at:row.createdAt,status:null}]));for(const row of source.flushes)history.set(row.id,{id:row.id,kind:"flushing",performedOn:row.flushedAt.slice(0,10),notes:row.notes,status:null,flowGpm:null,at:row.flushedAt});for(const row of await savedRows<HydrantActivity>(c,"hydrant_activity",id))history.set(row.id,row);
  return json({hydrant:h,activities:[...history.values()].sort((a,b)=>b.performedOn.localeCompare(a.performedOn)||b.at.localeCompare(a.at)),limited:false});
}
async function observationList(request:Request,c:Context){
  const response=await nativeObservations(request);if(!response.ok)throw new HttpError(503,"Saved Stickney observations could not be verified.");
  const body=await response.json() as {observations:{id:string;preplanId:string|null;address:string;note:string;priority:string;status:string;createdAt:string;photoUrl?:string|null}[]};
  const rows=new Map<string,StoredObservation>(body.observations.map(row=>[row.id,{id:row.id,planId:row.preplanId,address:row.address,text:row.note,priority:row.priority==="urgent"?"crew-alert":"note",state:["reviewed","resolved"].includes(row.status)?row.status as "reviewed"|"resolved":"unreviewed",revision:1,createdAt:row.createdAt,updatedAt:row.createdAt,reviewNote:"",hasPhoto:Boolean(row.photoUrl),photoName:null,photoType:null}]));
  for(const row of await savedRows<StoredObservation>(c,"observation"))rows.set(row.id,row);
  const visible=new Set((await allPlans(request,c)).plans.map(plan=>plan.id));
  return [...rows.values()].filter(row=>!row.planId||visible.has(row.planId));
}
async function observations(request:Request,c:Context,path:string[]):Promise<Response>{
  const id=path[1],url=new URL(request.url);
  if(id&&path[2]==="photo"){
    const item=(await observationList(request,c)).find(row=>row.id===id);if(!item)throw new HttpError(404,"Observation not found.");if(item.photoKey){const object=await getPortalStorage().get(item.photoKey);if(!object)throw new HttpError(404,"Photo unavailable.");return new Response(object.body,{headers:{"content-type":item.photoType||"image/jpeg","cache-control":"private, no-store","x-content-type-options":"nosniff"}});}return nativeObservationPhoto(forwarded(request,`/api/field-preplans/observations/photo?id=${encodeURIComponent(id)}`));
  }
  if(request.method==="GET"){let rows=await observationList(request,c);const planId=url.searchParams.get("planId");if(planId){await getPlan(request,c,validId(planId));rows=rows.filter(row=>row.planId===planId);}if(url.searchParams.get("active")==="1")rows=rows.filter(row=>row.state!=="resolved");return json({observations:rows.map(({photoKey,requestHash,...row})=>row),limited:false});}
  if(request.method==="PATCH"&&id){requirePermission(c,"field_preplans.review");const input=await body(request),old=await savedRow<StoredObservation>(c,"observation",id),previous=old||(await observationList(request,c)).find(row=>row.id===id);if(!previous)throw new HttpError(404,"Observation not found.");if(input.revision!==previous.revision)throw new HttpError(409,"This observation changed. Reload before reviewing.");if(!["unreviewed","reviewed","resolved"].includes(String(input.state)))throw new HttpError(422,"Choose a review state.");const item:StoredObservation={...previous,state:input.state as Observation["state"],reviewNote:String(input.note||"").slice(0,2000),revision:previous.revision+1,updatedAt:new Date().toISOString()};const statements=[old?update(c,"observation",id,previous.revision,item):insert(c,"observation",id,item.planId,item.revision,item),c.db.prepare("UPDATE field_preplan_observations SET status=? WHERE id=?").bind(item.state,id)];await transaction(c,statements);return json({observation:item});}
  if(request.method==="POST"&&!id){requirePermission(c,"field_preplans.edit");if(Number(request.headers.get("content-length"))>13*1024*1024)throw new HttpError(413,"Choose a photo under 12 MB.");const form=await request.formData();let raw:unknown;try{raw=JSON.parse(String(form.get("data")));}catch{throw new HttpError(400,"The observation could not be read.");}const parsed=observationSchema.safeParse(raw);if(!parsed.success)throw new HttpError(422,parsed.error.issues[0].message);const input=parsed.data;let address=input.address;if(input.planId){const plan=await getPlan(request,c,input.planId);address=address||plan.address;}if(!address)throw new HttpError(422,"Choose a building or enter the address.");const photo=form.get("photo");if(photo instanceof File&&photo.size){requirePermission(c,"field_preplans.manage_attachments");if(photo.size>12*1024*1024||!await isSafePhoto(photo))throw new HttpError(422,"Choose a supported photo under 12 MB.");}
    const hash=createHash("sha256").update(JSON.stringify(input)).update(photo instanceof File?Buffer.from(await photo.arrayBuffer()):Buffer.alloc(0)).digest("hex"),old=await savedRow<StoredObservation>(c,"observation",input.id);if(old){if(old.requestHash!==hash)throw new HttpError(409,"This observation was already saved with different details.");return json({observation:old});}
    const at=new Date().toISOString(),native=(await nativeData(request,c)).nativePlans.some(plan=>plan.id===input.planId);
    if(native||!input.planId){const nativeForm=new FormData();for(const[k,v]of Object.entries({id:input.id,preplanId:input.planId||"",address,note:input.text,priority:input.priority==="crew-alert"?"urgent":"routine"}))nativeForm.set(k,v);if(photo instanceof File)nativeForm.set("photo",photo);const headers=new Headers(request.headers);headers.delete("content-type");const response=await saveNativeObservation(new Request(new URL("/api/field-preplans/observations",request.url),{method:"POST",headers,body:nativeForm}));if(!response.ok){const error=await response.json() as {error?:string};throw new HttpError(response.status,error.error||"Observation was not saved.");}}
    let key:string|undefined;if(!native&&input.planId&&photo instanceof File&&photo.size){key=`arrival-preplans/observations/${input.id}/${hash}`;await getPortalStorage().put(key,photo.stream(),{httpMetadata:{contentType:photo.type}});}
    const item:StoredObservation={...input,address,state:"unreviewed",revision:1,createdAt:at,updatedAt:at,reviewNote:"",hasPhoto:photo instanceof File&&photo.size>0,photoType:photo instanceof File?photo.type:null,photoName:photo instanceof File?photo.name:null,photoKey:key,requestHash:hash};await transaction(c,[insert(c,"observation",input.id,input.planId,1,item)]);return json({observation:item},201);
  }
  throw new HttpError(405,"Observation action not supported.");
}
type StoredImport={source:ImportEntity;complete:boolean;copied:{source_key:string;file_id:string}[]};
async function importSources(request:Request,c:Context){const native=await nativeData(request,c),sources:ImportEntity[]=native.nativePlans.filter(row=>native.plans.some(plan=>plan.id===row.id)).map(row=>nativeSource(row,native.plans.find(plan=>plan.id===row.id)!,native.assets.filter(asset=>asset.preplanId===row.id)));for(const row of native.imports.filter(row=>!row.linkedPreplanId))sources.push({id:`queue-${row.id}`,kind:row.status==="review_required"?"held":"queue",name:row.businessName,address:row.address,keys:[`queue:${row.id}`],sourcePublished:false,sourcePublishedAt:null,sourceStatus:row.status,warnings:row.geocodeNote?[row.geocodeNote]:[],files:[],raw:row.sourcePayload||{}});return sources;}
async function imports(request:Request,c:Context,path:string[]):Promise<Response>{
  const id=path[1],method=request.method;
  if(id==="file"&&method==="POST"){
    requirePermission(c,"field_preplans.manage_attachments");const form=await request.formData(),recordId=validId(form.get("recordId")),key=validId(form.get("key")),stored=await savedRow<StoredImport>(c,"import",recordId),file=form.get("file"),spec=stored?.source.files.find(item=>item.key===key);
    if(!stored||!spec||!(file instanceof File))throw new HttpError(422,"Choose the original file for this source record.");const bytes=Buffer.from(await file.arrayBuffer());if(file.size>8*1024*1024||!spec.sha256||createHash("sha256").update(bytes).digest("hex")!==spec.sha256)throw new HttpError(422,"The selected file does not match the source package.");
    const fileId=`import-${createHash("sha256").update(`${recordId}:${key}`).digest("hex").slice(0,48)}`,objectKey=`arrival-preplans/imports/${recordId}/${fileId}`,planId=`plan-${recordId}`;await getPortalStorage().put(objectKey,file.stream(),{httpMetadata:{contentType:spec.type}});
    const record:FileRecord={id:fileId,planId,name:spec.name,type:spec.type,size:file.size,key:objectKey};const revisionRow=await c.db.prepare("SELECT revision FROM arrival_preplan_records WHERE kind='import' AND id=?").bind(recordId).first<{revision:number}>();if(!revisionRow)throw new HttpError(404,"Source record not found.");stored.copied=[...stored.copied.filter(item=>item.source_key!==key),{source_key:key,file_id:fileId}];const statements=[update(c,"import",recordId,revisionRow.revision,stored)];if(!await savedRow(c,"file",fileId))statements.push(insert(c,"file",fileId,planId,1,record));await transaction(c,statements);return json({ok:true});
  }
  const sources=await importSources(request,c),stored=canWork(c)?await savedRows<StoredImport>(c,"import"):[];
  if(!id&&method==="GET")return json({records:[...sources.map(source=>importSummary(source)),...stored.map(item=>({...importSummary(item.source,item.complete),copiedFiles:item.copied.length,entityId:`plan-${item.source.id}`}))],limited:false});
  if(!id&&method==="POST"){
    requirePermission(c,"field_preplans.edit");const parsed=importEntitySchema.safeParse(await body(request));if(!parsed.success)throw new HttpError(422,"Check the Arrival source package format.");const source=parsed.data;if(source.files.some(file=>!sourceFileUrlAllowed(file.originalUrl)))throw new HttpError(422,"Source files must come from the connected Stickney or FlowMSP records.");const old=await savedRow<StoredImport>(c,"import",source.id);if(old)return json({record:{id:source.id,complete:old.complete},reused:true});
    const nativeMatch=sources.find(item=>item.keys.some(key=>source.keys.includes(key)));if(nativeMatch)throw new HttpError(409,"This source is already connected to a Stickney record. Open the saved preplan instead of importing it again.");
    await transaction(c,[insert(c,"import",source.id,null,1,{source,complete:false,copied:[]} satisfies StoredImport)]);return json({record:{id:source.id,complete:false},reused:false},201);
  }
  if(id){validId(id);const item=stored.find(item=>item.source.id===id),source=item?.source||sources.find(item=>item.id===id);if(!source)throw new HttpError(404,"Source record not found.");if(method==="GET")return json({source,record:importSummary(source,item?.complete??true),copied:item?.copied||[]});
    if(method==="POST"&&item){requirePermission(c,"field_preplans.edit");const input=await body(request);if(input.action!=="complete")throw new HttpError(400,"Unknown source action.");if(source.files.some(file=>file.sha256&&!item.copied.some(copy=>copy.source_key===file.key)))throw new HttpError(422,"Copy the original files before completing this source.");const revisionRow=await c.db.prepare("SELECT revision FROM arrival_preplan_records WHERE kind='import' AND id=?").bind(id).first<{revision:number}>();if(!revisionRow)throw new HttpError(404,"Source not found.");const statements=[update(c,"import",id,revisionRow.revision,{...item,complete:true})];
      if(source.kind==="plan"&&source.plan){const planId=`plan-${id}`,existing=await savedRow(c,"plan",planId);if(!existing){const data=structuredClone(source.plan),at=new Date().toISOString();data.imported={recordId:id,sources:source.keys,importedAt:at,linkedHydrantIds:[]};data.photos=source.files.flatMap(file=>{const copy=item.copied.find(row=>row.source_key===file.key);return copy?[{id:copy.file_id,name:file.name,type:file.type,caption:file.caption,side:file.side}]:[];});const plan:PlanRecord={id:planId,name:data.name,address:data.address,working:data,published:null,status:"draft",revision:1,publishedRevision:null,publishedAt:null,createdAt:at,updatedAt:at};statements.push(insert(c,"plan",planId,null,1,plan));}}
      await transaction(c,statements);return json({record:importSummary(source),ok:true});
    }
  }
  throw new HttpError(405,"Source action not supported.");
}

async function dispatch(request:Request,route:RouteContext){const path=(await route.params).path,c=await identity(request),url=new URL(request.url),method=request.method,id=path[1];
  if(path[0]==="session"&&method==="GET")return json({user:{id:`${c.department.id}:${createHash("sha256").update(c.email).digest("hex").slice(0,16)}`,name:c.email},permissions:[...c.permissions],department:c.department});
  if(path[0]==="plans"){
    if(!id&&method==="GET")return json({plans:(await allPlans(request,c)).plans,limited:false});
    if(!id&&method==="POST"){const input=await request.clone().json() as {id?:unknown};return savePlan(request,c,validId(input.id),true);}
    if(id){validId(id);if(path[2]==="transition"&&method==="POST")return transition(request,c,id);if(method==="PUT")return savePlan(request,c,id);if(method==="GET")return json({plan:await getPlan(request,c,id),events:await savedRows<PlanEvent>(c,"event",id)});}
  }
  if(path[0]==="files"){if(id&&method==="GET")return serveFile(request,c,validId(id));if(!id&&method==="POST")return uploadFile(request,c);}
  if(path[0]==="hydrants")return hydrants(request,c,path);
  if(path[0]==="observations")return observations(request,c,path);
  if(path[0]==="imports")return imports(request,c,path);
  throw new HttpError(404,"Preplan action not found.");
}
export function GET(request:Request,route:RouteContext){return handle(()=>dispatch(request,route));}
export function POST(request:Request,route:RouteContext){return handle(()=>dispatch(request,route));}
export function PUT(request:Request,route:RouteContext){return handle(()=>dispatch(request,route));}
export function PATCH(request:Request,route:RouteContext){return handle(()=>dispatch(request,route));}
