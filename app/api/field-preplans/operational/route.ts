import { ensureDatabase } from "../../../../db/bootstrap";
import { canReadPreplanLifecycle, hasPermission, preplanReadAccess } from "../../../server-permissions";
import type { PermissionKey } from "../../../permissions";
import { calculateHoseLay, calculateTargetHazard, normalizedLevelLabel, parseJson } from "../../../preplans/domain";
import { constructionProfile, occupancyProfile } from "../../../preplans/profiles";
import { nextPublicationStatus } from "../../../preplans/publication-workflow.mjs";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type Body = Record<string, unknown>;
type SnapshotRow = Record<string, unknown>;
type Snapshot = Record<string, unknown> & { plan?:SnapshotRow };

function text(value: unknown, limit = 2_000) { return String(value ?? "").trim().slice(0, limit); }
function integer(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isInteger(parsed) ? parsed : fallback; }
function json(value: unknown, fallback: unknown) {
  try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); }
}
function actor(request: Request) { return text(request.headers.get("oai-authenticated-user-email"), 254).toLowerCase() || "Authenticated user"; }

async function requirePermission(request: Request, db: Db, permission: PermissionKey) {
  if (!await hasPermission(request, db, permission)) throw new Response(JSON.stringify({ error:`${permission} permission is required.` }), { status:403, headers:{ "content-type":"application/json" } });
}

async function preplanExists(db: Db, preplanId: string) {
  return Boolean(await db.prepare("SELECT id FROM field_preplans WHERE id=? LIMIT 1").bind(preplanId).first());
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    await requirePermission(request, db, "field_preplans.view");
    const preplanId = text(new URL(request.url).searchParams.get("preplanId"), 80);
    if (!preplanId || !await preplanExists(db, preplanId)) return Response.json({ error:"Preplan not found." }, { status:404 });
    const lifecycle = await db.prepare("SELECT COALESCE(publication_status,'published') publicationStatus,created_by createdBy,updated_by updatedBy FROM field_preplans WHERE id=? LIMIT 1").bind(preplanId).first();
    const readAccess = await preplanReadAccess(request, db);
    if (!lifecycle || !canReadPreplanLifecycle(lifecycle, readAccess)) return Response.json({ error:"Preplan not found." }, { status:404 });
    const permissionKeys:PermissionKey[]=["field_preplans.edit","field_preplans.publish","field_preplans.review","field_preplans.manage_layers","field_preplans.manage_hazmat","field_preplans.manage_attachments","field_preplans.verify_expiring"];
    const [plan, levels, spaces, alerts, hazmat, zones, annotations, assets, hoseLays, hydrants, apparatus, risks, reviews, revisions, permissionValues] = await Promise.all([
      db.prepare("SELECT publication_status publicationStatus,completeness_status completenessStatus,revision_number revisionNumber,last_verified_at lastVerifiedAt,next_review_date nextReviewDate,target_hazard_level targetHazardLevel,target_hazard_reasons targetHazardReasons,construction_profile constructionProfile,occupancy_profile occupancyProfile FROM field_preplans WHERE id=?").bind(preplanId).first(),
      db.prepare("SELECT id,preplan_id preplanId,name,short_label shortLabel,layer_type layerType,floor_index floorIndex,grade_designation gradeDesignation,sort_order sortOrder,is_default isDefault,respond_visible respondVisible,hidden,archived,background_type backgroundType,background_asset_id backgroundAssetId,background_transform backgroundTransform,opacity,updated_by updatedBy,updated_at updatedAt FROM field_preplan_levels WHERE preplan_id=? ORDER BY archived,sort_order,name").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,display_name name,room_number roomNumber,aliases,cad_keywords cadKeywords,space_type spaceType,geometry,access_notes accessNotes,fire_protection_notes fireProtectionNotes,hazards,archived,updated_by updatedBy,updated_at updatedAt FROM field_preplan_spaces WHERE preplan_id=? ORDER BY archived,display_name").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,space_id spaceId,alert_type alertType,title,instructions message,severity,display_order displayOrder,pin_to_respond pinToRespond,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction,verified_by verifiedBy,verified_at verifiedAt,archived,updated_by updatedBy,updated_at updatedAt FROM field_preplan_alerts WHERE preplan_id=? ORDER BY archived,severity DESC,created_at DESC").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,space_id spaceId,un_na_number unNumber,chemical_name materialName,erg_guide_number ergGuideNumber,quantity,quantity_unit quantityUnit,physical_state physicalState,container_type storageType,exact_location exactLocation,notes,date_verified dateVerified,verified_by verifiedBy,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction,archived,updated_by updatedBy,updated_at updatedAt FROM field_preplan_hazmat WHERE preplan_id=? ORDER BY archived,chemical_name").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,hazmat_id hazmatId,label,zone_type zoneType,geometry,geometry_type geometryType,radius_feet radiusFeet,effective_at effectiveAt,expires_at expiresAt,archived FROM field_preplan_hazmat_zones WHERE preplan_id=? ORDER BY archived,label").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,annotation_type annotationType,operational_subtype operationalSubtype,name,label,geometry,coordinate_space coordinateSpace,line_color lineColor,fill_color fillColor,line_width lineWidth,opacity,effective_at effectiveAt,expires_at expiresAt,expiration_action expirationAction,verified_by verifiedBy,verified_at verifiedAt,archived,updated_by updatedBy,updated_at updatedAt FROM field_preplan_annotations WHERE preplan_id=? ORDER BY archived,sort_order").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,category assetType,original_filename filename,mime_type contentType,file_size sizeBytes,caption,created_by createdBy,created_at createdAt FROM field_preplan_assets WHERE preplan_id=? AND archived=0 ORDER BY sort_order,created_at DESC").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,name,source_hydrant_id sourceHydrantId,destination_side destinationSide,destination_feature_id destinationFeatureId,path,segment_distances segmentDistances,total_distance_feet totalDistanceFeet,hose_size_inches hoseSizeInches,section_length_feet sectionLengthFeet,reserve_feet reserveFeet,recommended_hose_feet recommendedHoseFeet,supply_line_label supplyLineLabel,apparatus_id apparatusId,apparatus_capacity_feet apparatusCapacityFeet,inventory_verified_at inventoryVerifiedAt,notes,archived,updated_by updatedBy,updated_at updatedAt FROM field_preplan_hose_lays WHERE preplan_id=? ORDER BY archived,name").bind(preplanId).all(),
      db.prepare("SELECT id,hydrant_number hydrantNumber,address,service_status serviceStatus FROM field_hydrants ORDER BY hydrant_number,address").all(),
      db.prepare("SELECT id,unit_number unitNumber,name,status,retired_at retiredAt FROM fleet_apparatus ORDER BY unit_number,name").all(),
      db.prepare("SELECT id,preplan_id preplanId,factor,score,explanation,source,manual_override manualOverride,reviewer,reviewed_at reviewedAt,updated_by updatedBy,updated_at updatedAt FROM field_preplan_risk_factors WHERE preplan_id=? ORDER BY factor").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,revision_number revisionNumber,action,comment,actor,created_at createdAt FROM field_preplan_reviews WHERE preplan_id=? ORDER BY created_at DESC").bind(preplanId).all(),
      db.prepare("SELECT id,preplan_id preplanId,revision_number revisionNumber,publication_status publicationStatus,summary,actor,created_at createdAt,restored_from_revision restoredFromRevision FROM field_preplan_revisions WHERE preplan_id=? ORDER BY revision_number DESC").bind(preplanId).all(),
      Promise.all(permissionKeys.map((permission)=>hasPermission(request,db,permission))),
    ]);
    const permissions=Object.fromEntries(permissionKeys.map((permission,index)=>[permission,permissionValues[index]]));
    return Response.json({ plan:plan?{...plan,constructionProfile:constructionProfile(plan.constructionProfile),occupancyProfile:occupancyProfile(plan.occupancyProfile)}:plan, levels:levels.results, spaces:spaces.results, alerts:alerts.results, hazmat:hazmat.results, zones:zones.results, annotations:annotations.results, assets:assets.results, hoseLays:hoseLays.results.map((item)=>({...item,path:parseJson(item.path,[])})), hydrants:hydrants.results, apparatus:apparatus.results, risks:risks.results, reviews:reviews.results, revisions:revisions.results, permissions });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error:error instanceof Error ? error.message : "Unable to load operational preplan." }, { status:500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const body = await request.json() as Body;
    const action = text(body.action, 40);
    const preplanId = text(body.preplanId, 80);
    if (!preplanId || !await preplanExists(db, preplanId)) return Response.json({ error:"Preplan not found." }, { status:404 });
    const user = actor(request);

    if (action === "saveLevel") {
      await requirePermission(request, db, "field_preplans.manage_layers");
      const id = text(body.id, 80) || crypto.randomUUID();
      const name = text(body.name, 100);
      if (!name) return Response.json({ error:"Level name is required." }, { status:400 });
      const shortLabel = text(body.shortLabel, 24) || normalizedLevelLabel(name);
      const isDefault = body.isDefault ? 1 : 0;
      if (isDefault) await db.prepare("UPDATE field_preplan_levels SET is_default=0,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE preplan_id=? AND id<>?").bind(user,preplanId,id).run();
      await db.prepare("INSERT INTO field_preplan_levels(id,preplan_id,name,short_label,layer_type,floor_index,grade_designation,sort_order,is_default,respond_visible,hidden,archived,background_type,background_asset_id,background_transform,opacity,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,short_label=excluded.short_label,layer_type=excluded.layer_type,floor_index=excluded.floor_index,grade_designation=excluded.grade_designation,sort_order=excluded.sort_order,is_default=excluded.is_default,respond_visible=excluded.respond_visible,hidden=excluded.hidden,archived=excluded.archived,background_type=excluded.background_type,background_asset_id=excluded.background_asset_id,background_transform=excluded.background_transform,opacity=excluded.opacity,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,name,shortLabel,text(body.layerType,30)||"floor",body.floorIndex == null ? null : integer(body.floorIndex),text(body.gradeDesignation,30)||"at_grade",integer(body.sortOrder),isDefault,body.respondVisible === false ? 0 : 1,body.hidden?1:0,body.archived?1:0,text(body.backgroundType,30)||"none",text(body.backgroundAssetId,80)||null,json(body.backgroundTransform,{}),Math.max(0,Math.min(1,Number(body.opacity ?? 1))),user,user).run();
      return Response.json({ ok:true,id });
    }

    if (action === "archiveOperationalRecord") {
      const kind=text(body.kind,20),id=text(body.id,80);
      if(!id||!["level","annotation","hoseLay"].includes(kind))return Response.json({error:"A valid operational record is required."},{status:400});
      await requirePermission(request, db, kind==="hoseLay"?"field_preplans.edit":"field_preplans.manage_layers");
      if(kind==="annotation"){
        const record=await db.prepare("SELECT id FROM field_preplan_annotations WHERE id=? AND preplan_id=? AND archived=0").bind(id,preplanId).first();
        if(!record)return Response.json({error:"The active tactical annotation was not found in this preplan."},{status:404});
        await db.prepare("UPDATE field_preplan_annotations SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?").bind(user,id,preplanId).run();
      }else if(kind==="hoseLay"){
        const record=await db.prepare("SELECT id FROM field_preplan_hose_lays WHERE id=? AND preplan_id=? AND archived=0").bind(id,preplanId).first();
        if(!record)return Response.json({error:"The active hose lay was not found in this preplan."},{status:404});
        await db.prepare("UPDATE field_preplan_hose_lays SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?").bind(user,id,preplanId).run();
      }else{
        const level=await db.prepare("SELECT id,is_default isDefault FROM field_preplan_levels WHERE id=? AND preplan_id=? AND archived=0").bind(id,preplanId).first<{id:string;isDefault:number}>();
        if(!level)return Response.json({error:"The active preplan level was not found."},{status:404});
        if(level.isDefault)return Response.json({error:"The default Arrival level cannot be archived."},{status:400});
        const childTables=["field_preplan_spaces","field_preplan_alerts","field_preplan_hazmat","field_preplan_hazmat_zones","field_preplan_annotations","field_preplan_assets","field_preplan_hose_lays"];
        for(const table of childTables){
          if(await db.prepare(`SELECT id FROM ${table} WHERE preplan_id=? AND level_id=? AND archived=0 LIMIT 1`).bind(preplanId,id).first())return Response.json({error:"Archive active records on this level before archiving the level."},{status:409});
        }
        await db.prepare("UPDATE field_preplan_levels SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?").bind(user,id,preplanId).run();
      }
      return Response.json({ok:true,id,kind});
    }

    if (action === "saveSpace") {
      await requirePermission(request, db, "field_preplans.manage_layers");
      const id = text(body.id,80)||crypto.randomUUID(), levelId=text(body.levelId,80), name=text(body.name,120);
      if (!levelId || !name) return Response.json({ error:"Level and room name are required." }, { status:400 });
      const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=? AND archived=0").bind(levelId,preplanId).first();
      if (!level) return Response.json({ error:"Active preplan level not found." }, { status:400 });
      await db.prepare("INSERT INTO field_preplan_spaces(id,preplan_id,level_id,display_name,aliases,cad_keywords,space_type,geometry,coordinate_space,access_notes,fire_protection_notes,hazards,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,display_name=excluded.display_name,aliases=excluded.aliases,cad_keywords=excluded.cad_keywords,space_type=excluded.space_type,geometry=excluded.geometry,coordinate_space=excluded.coordinate_space,access_notes=excluded.access_notes,fire_protection_notes=excluded.fire_protection_notes,hazards=excluded.hazards,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,name,json(body.aliases,[]),json(body.cadKeywords,body.aliases??[]),text(body.spaceType,40)||"room",json(body.geometry,[]),text(body.coordinateSpace,30)||"floor_plan",text(body.accessNotes),text(body.fireProtectionNotes),text(body.hazards),body.archived?1:0,user,user).run();
      return Response.json({ ok:true,id });
    }

    if (action === "saveAlert") {
      await requirePermission(request, db, "field_preplans.edit");
      const id=text(body.id,80)||crypto.randomUUID(), title=text(body.title,160), message=text(body.message,2000);
      if (!title || !message) return Response.json({ error:"Alert title and message are required." }, { status:400 });
      await db.prepare("INSERT INTO field_preplan_alerts(id,preplan_id,level_id,space_id,alert_type,title,instructions,severity,display_order,pin_to_respond,effective_at,expires_at,expiration_action,verification_required,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,space_id=excluded.space_id,alert_type=excluded.alert_type,title=excluded.title,instructions=excluded.instructions,severity=excluded.severity,display_order=excluded.display_order,pin_to_respond=excluded.pin_to_respond,effective_at=excluded.effective_at,expires_at=excluded.expires_at,expiration_action=excluded.expiration_action,verification_required=excluded.verification_required,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,text(body.levelId,80)||null,text(body.spaceId,80)||null,text(body.alertType,40)||"operational",title,message,text(body.severity,30)||"warning",integer(body.displayOrder),body.pinToRespond===false?0:1,text(body.effectiveAt,40)||null,text(body.expiresAt,40)||null,text(body.expirationAction,30)||"require_verification",body.verificationRequired?1:0,body.archived?1:0,user,user).run();
      return Response.json({ ok:true,id });
    }

    if (action === "saveHazmat") {
      await requirePermission(request, db, "field_preplans.manage_hazmat");
      const id=text(body.id,80)||crypto.randomUUID(), materialName=text(body.materialName,180);
      if (!materialName) return Response.json({ error:"Material name is required." }, { status:400 });
      await db.prepare("INSERT INTO field_preplan_hazmat(id,preplan_id,level_id,space_id,mapped,chemical_name,un_na_number,erg_guide_number,quantity,quantity_unit,container_type,physical_state,exact_location,notes,effective_at,expires_at,expiration_action,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,space_id=excluded.space_id,mapped=excluded.mapped,chemical_name=excluded.chemical_name,un_na_number=excluded.un_na_number,erg_guide_number=excluded.erg_guide_number,quantity=excluded.quantity,quantity_unit=excluded.quantity_unit,container_type=excluded.container_type,physical_state=excluded.physical_state,exact_location=excluded.exact_location,notes=excluded.notes,effective_at=excluded.effective_at,expires_at=excluded.expires_at,expiration_action=excluded.expiration_action,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,text(body.levelId,80)||null,text(body.spaceId,80)||null,body.mapped?1:0,materialName,text(body.unNumber,12),text(body.ergGuideNumber,12),body.quantity==null?null:Number(body.quantity),text(body.quantityUnit,30),text(body.storageType,80),text(body.physicalState,30)||"unknown",text(body.exactLocation,240)||"Location not entered",text(body.notes),text(body.effectiveAt,40)||null,text(body.expiresAt,40)||null,text(body.expirationAction,30)||"require_verification",body.archived?1:0,user,user).run();
      return Response.json({ ok:true,id });
    }

    if (action === "saveHazmatZone") {
      await requirePermission(request, db, "field_preplans.manage_hazmat");
      const id=text(body.id,80)||crypto.randomUUID(),hazmatId=text(body.hazmatId,80),label=text(body.label,120),zoneType=text(body.zoneType,40)||"isolation";
      const geometryType=text(body.geometryType,20)||"circle",radiusFeet=body.radiusFeet==null?null:Number(body.radiusFeet);
      if(!hazmatId||!label)return Response.json({error:"HazMat record and zone label are required."},{status:400});
      if(geometryType==="circle"&&(!Number.isFinite(radiusFeet)||Number(radiusFeet)<=0))return Response.json({error:"Circle zones require a positive radius in feet."},{status:400});
      const hazard=await db.prepare("SELECT id,level_id levelId FROM field_preplan_hazmat WHERE id=? AND preplan_id=? AND archived=0").bind(hazmatId,preplanId).first<{id:string;levelId:string|null}>();
      if(!hazard)return Response.json({error:"The selected HazMat record does not belong to this preplan."},{status:400});
      const levelId=text(body.levelId,80)||hazard.levelId||null;
      if(levelId){const level=await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=? AND archived=0").bind(levelId,preplanId).first();if(!level)return Response.json({error:"Active preplan level not found."},{status:400});}
      await db.prepare("INSERT INTO field_preplan_hazmat_zones(id,preplan_id,hazmat_id,level_id,zone_type,geometry_type,geometry,label,radius_feet,fill_color,line_color,opacity,line_width,line_style,effective_at,expires_at,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET hazmat_id=excluded.hazmat_id,level_id=excluded.level_id,zone_type=excluded.zone_type,geometry_type=excluded.geometry_type,geometry=excluded.geometry,label=excluded.label,radius_feet=excluded.radius_feet,fill_color=excluded.fill_color,line_color=excluded.line_color,opacity=excluded.opacity,line_width=excluded.line_width,line_style=excluded.line_style,effective_at=excluded.effective_at,expires_at=excluded.expires_at,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,hazmatId,levelId,zoneType,geometryType,json(body.geometry,{}),label,radiusFeet,text(body.fillColor,20)||"#dc2626",text(body.lineColor,20)||"#991b1b",Math.max(0,Math.min(1,Number(body.opacity??.2))),Math.max(1,Number(body.lineWidth??3)),text(body.lineStyle,20)||"solid",text(body.effectiveAt,40)||null,text(body.expiresAt,40)||null,body.archived?1:0,user,user).run();
      return Response.json({ok:true,id});
    }

    if (action === "saveAnnotation") {
      await requirePermission(request, db, "field_preplans.manage_layers");
      const id=text(body.id,80)||crypto.randomUUID(),levelId=text(body.levelId,80),name=text(body.name,120),annotationType=text(body.annotationType,40);
      if(!levelId||!name||!annotationType)return Response.json({error:"Level, annotation type, and name are required."},{status:400});
      const level=await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=? AND archived=0").bind(levelId,preplanId).first();
      if(!level)return Response.json({error:"Active preplan level not found."},{status:400});
      await db.prepare("INSERT INTO field_preplan_annotations(id,preplan_id,level_id,annotation_type,operational_subtype,name,label,geometry,coordinate_space,line_color,fill_color,line_width,opacity,font_size,rotation,arrow_config,sort_order,effective_at,expires_at,expiration_action,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET annotation_type=excluded.annotation_type,operational_subtype=excluded.operational_subtype,name=excluded.name,label=excluded.label,geometry=excluded.geometry,coordinate_space=excluded.coordinate_space,line_color=excluded.line_color,fill_color=excluded.fill_color,line_width=excluded.line_width,opacity=excluded.opacity,font_size=excluded.font_size,rotation=excluded.rotation,arrow_config=excluded.arrow_config,sort_order=excluded.sort_order,effective_at=excluded.effective_at,expires_at=excluded.expires_at,expiration_action=excluded.expiration_action,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,annotationType,text(body.operationalSubtype,40)||"custom",name,text(body.label,120),json(body.geometry,[]),text(body.coordinateSpace,30)||"floor_plan",text(body.lineColor,20)||"#dc2626",text(body.fillColor,20)||"#dc2626",Number(body.lineWidth??3),Number(body.opacity??.25),Number(body.fontSize??16),Number(body.rotation??0),json(body.arrowConfig,{}),integer(body.sortOrder),text(body.effectiveAt,40)||null,text(body.expiresAt,40)||null,text(body.expirationAction,30)||"require_verification",body.archived?1:0,user,user).run();
      return Response.json({ok:true,id});
    }

    if (action === "saveHoseLay") {
      await requirePermission(request, db, "field_preplans.edit");
      const id=text(body.id,80)||crypto.randomUUID(),name=text(body.name,120),totalDistanceFeet=Number(body.totalDistanceFeet),hoseSizeInches=Number(body.hoseSizeInches);
      const sectionLengthFeet=Math.max(1,integer(body.sectionLengthFeet,100)),reserveFeet=Math.max(0,integer(body.reserveFeet,100));
      const segmentDistances=Array.isArray(body.segmentDistances)?body.segmentDistances.map(Number):[];
      const path=Array.isArray(body.path)?body.path.map((value)=>{const point=value as {x?:unknown;y?:unknown};return {x:Number(point?.x),y:Number(point?.y)};}):[];
      const sourceHydrantId=text(body.sourceHydrantId,80)||null;
      const apparatusCapacityFeet=body.apparatusCapacityFeet==null?null:Math.max(0,integer(body.apparatusCapacityFeet));
      if(!name||!Number.isFinite(totalDistanceFeet)||totalDistanceFeet<0||!Number.isFinite(hoseSizeInches)||hoseSizeInches<=0)return Response.json({error:"Name, route distance, and hose size are required."},{status:400});
      if(segmentDistances.some((distance)=>!Number.isFinite(distance)||distance<=0))return Response.json({error:"Every route segment must be a positive distance in feet."},{status:400});
      if(segmentDistances.length&&Math.abs(segmentDistances.reduce((sum,distance)=>sum+distance,0)-totalDistanceFeet)>.01)return Response.json({error:"Route segment distances must equal the measured route total."},{status:400});
      if(path.length<2||path.length>100||path.some((point)=>!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1))return Response.json({error:"Draw a valid hose route with at least two preplan points."},{status:400});
      if(sourceHydrantId&&!await db.prepare("SELECT id FROM field_hydrants WHERE id=?").bind(sourceHydrantId).first())return Response.json({error:"The selected source hydrant was not found."},{status:400});
      const inventoryVerifiedAt=text(body.inventoryVerifiedAt,40)||null;
      if(apparatusCapacityFeet!=null&&(!text(body.apparatusId,80)||!inventoryVerifiedAt||Number.isNaN(Date.parse(inventoryVerifiedAt))))return Response.json({error:"Verified apparatus capacity requires an apparatus reference and verification date."},{status:400});
      if(text(body.apparatusId,80)&&!await db.prepare("SELECT id FROM fleet_apparatus WHERE id=? AND retired_at IS NULL").bind(text(body.apparatusId,80)).first())return Response.json({error:"The selected active apparatus was not found."},{status:400});
      const result=calculateHoseLay({totalDistanceFeet,sectionLengthFeet,reserveFeet,apparatusCapacityFeet});
      await db.prepare("INSERT INTO field_preplan_hose_lays(id,preplan_id,level_id,name,source_hydrant_id,destination_side,destination_feature_id,path,segment_distances,total_distance_feet,hose_size_inches,section_length_feet,reserve_feet,recommended_hose_feet,supply_line_label,apparatus_id,apparatus_capacity_feet,inventory_verified_at,notes,archived,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,name=excluded.name,source_hydrant_id=excluded.source_hydrant_id,destination_side=excluded.destination_side,destination_feature_id=excluded.destination_feature_id,path=excluded.path,segment_distances=excluded.segment_distances,total_distance_feet=excluded.total_distance_feet,hose_size_inches=excluded.hose_size_inches,section_length_feet=excluded.section_length_feet,reserve_feet=excluded.reserve_feet,recommended_hose_feet=excluded.recommended_hose_feet,supply_line_label=excluded.supply_line_label,apparatus_id=excluded.apparatus_id,apparatus_capacity_feet=excluded.apparatus_capacity_feet,inventory_verified_at=excluded.inventory_verified_at,notes=excluded.notes,archived=excluded.archived,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,text(body.levelId,80)||null,name,sourceHydrantId,text(body.destinationSide,20),text(body.destinationFeatureId,80)||null,json(path,[]),json(segmentDistances,[]),totalDistanceFeet,hoseSizeInches,sectionLengthFeet,reserveFeet,result.recommendedFeet,text(body.supplyLineLabel,80),text(body.apparatusId,80)||null,apparatusCapacityFeet,inventoryVerifiedAt,text(body.notes),body.archived?1:0,user,user).run();
      return Response.json({ok:true,id,calculation:result});
    }

    if (action === "saveRiskFactor") {
      await requirePermission(request, db, "field_preplans.review");
      const id=text(body.id,80)||crypto.randomUUID(),factor=text(body.factor,120),score=Math.max(-100,Math.min(100,integer(body.score))),explanation=text(body.explanation,1000),source=text(body.source,240);
      if(!factor||!explanation||!source)return Response.json({error:"Risk factor, explanation, and source are required."},{status:400});
      await db.prepare("INSERT INTO field_preplan_risk_factors(id,preplan_id,factor,score,explanation,source,manual_override,reviewer,reviewed_at,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?) ON CONFLICT(preplan_id,factor) DO UPDATE SET score=excluded.score,explanation=excluded.explanation,source=excluded.source,manual_override=excluded.manual_override,reviewer=excluded.reviewer,reviewed_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,factor,score,explanation,source,body.manualOverride?1:0,user,user,user).run();
      const factors=await db.prepare("SELECT factor,score,explanation,source,manual_override manualOverride FROM field_preplan_risk_factors WHERE preplan_id=?").bind(preplanId).all<{factor:string;score:number;explanation:string;source:string;manualOverride:number}>();
      const result=calculateTargetHazard(factors.results.map((item)=>({...item,manualOverride:Boolean(item.manualOverride)})),integer(body.targetHazardOverride));
      await db.prepare("UPDATE field_preplans SET target_hazard_level=?,target_hazard_override=?,target_hazard_reasons=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.level,integer(body.targetHazardOverride),JSON.stringify(result.reasons),user,preplanId).run();
      return Response.json({ok:true,id,targetHazard:result});
    }

    if (action === "saveConstructionProfile" || action === "saveOccupancyProfile") {
      await requirePermission(request, db, "field_preplans.edit");
      const isConstruction=action==="saveConstructionProfile";
      const profile=isConstruction?constructionProfile(body.profile):occupancyProfile(body.profile);
      const column=isConstruction?"construction_profile":"occupancy_profile";
      await db.prepare(`UPDATE field_preplans SET ${column}=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(profile),user,preplanId).run();
      return Response.json({ok:true,profile});
    }

    if (action === "verifyRecord") {
      await requirePermission(request, db, "field_preplans.verify_expiring");
      const kind=text(body.kind,20), id=text(body.id,80);
      const tables = { alert:"field_preplan_alerts", hazmat:"field_preplan_hazmat", feature:"field_preplan_features" } as const;
      const table=tables[kind as keyof typeof tables];
      if (!table || !id) return Response.json({ error:"A verifiable record is required." }, { status:400 });
      const verifiedColumn=kind==="hazmat"?"date_verified":"verified_at";
      await db.prepare(`UPDATE ${table} SET verified_by=?,${verifiedColumn}=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?`).bind(user,user,id,preplanId).run();
      return Response.json({ ok:true,id });
    }

    if(action==="reviewExpiringRecord"){
      await requirePermission(request,db,"field_preplans.verify_expiring");
      const kind=text(body.kind,20),id=text(body.id,80),decision=text(body.decision,20);
      const records={alert:{table:"field_preplan_alerts",verifiedAt:"verified_at"},hazmat:{table:"field_preplan_hazmat",verifiedAt:"date_verified"},zone:{table:"field_preplan_hazmat_zones",verifiedAt:""},annotation:{table:"field_preplan_annotations",verifiedAt:"verified_at"}} as const;
      const record=records[kind as keyof typeof records];
      if(!record||!id||!["verify","extend","resolve","archive"].includes(decision))return Response.json({error:"A valid expiring record action is required."},{status:400});
      if(!await db.prepare(`SELECT id FROM ${record.table} WHERE id=? AND preplan_id=?`).bind(id,preplanId).first())return Response.json({error:"The selected expiring record was not found in this preplan."},{status:404});
      if(decision==="extend"){
        const extendDays=integer(body.extendDays);if(extendDays<1||extendDays>365)return Response.json({error:"Expiration may be extended from 1 to 365 days."},{status:400});
        const existing=await db.prepare(`SELECT expires_at expiresAt FROM ${record.table} WHERE id=? AND preplan_id=?`).bind(id,preplanId).first<{expiresAt:string|null}>();
        const currentExpiry=new Date(String(existing?.expiresAt||""));const base=Number.isFinite(currentExpiry.getTime())&&currentExpiry.getTime()>Date.now()?currentExpiry.getTime():Date.now();const parsed=new Date(base+extendDays*86_400_000);
        await db.prepare(`UPDATE ${record.table} SET expires_at=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?`).bind(parsed.toISOString(),user,id,preplanId).run();
      }else if(decision==="verify"){
        const verification=record.verifiedAt?`,verified_by=?,${record.verifiedAt}=CURRENT_TIMESTAMP`:"";
        await db.prepare(`UPDATE ${record.table} SET expires_at=NULL${verification},updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?`).bind(...(record.verifiedAt?[user,user,id,preplanId]:[user,id,preplanId])).run();
      }else{
        await db.prepare(`UPDATE ${record.table} SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND preplan_id=?`).bind(user,id,preplanId).run();
      }
      const current=await db.prepare("SELECT revision_number revisionNumber FROM field_preplans WHERE id=?").bind(preplanId).first<{revisionNumber:number}>();
      await db.prepare("INSERT INTO field_preplan_reviews(id,preplan_id,revision_number,action,comment,actor) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),preplanId,Number(current?.revisionNumber||1),`expiration_${decision}_${kind}`,text(body.comment,1000)||`${decision} ${kind} expiration record`,user).run();
      return Response.json({ok:true,id,kind,decision});
    }

    if (action === "restoreRevision") {
      await requirePermission(request, db, "field_preplans.publish");
      const sourceRevision = integer(body.revisionNumber);
      if (sourceRevision < 1) return Response.json({ error:"A valid source revision is required." }, { status:400 });
      const stored = await db.prepare("SELECT snapshot,summary FROM field_preplan_revisions WHERE preplan_id=? AND revision_number=?").bind(preplanId,sourceRevision).first<{snapshot:string;summary:string}>();
      if (!stored) return Response.json({ error:"The selected revision was not found for this preplan." }, { status:404 });
      const snapshot = parseSnapshot(stored.snapshot,preplanId);
      const current = await db.prepare("SELECT revision_number revisionNumber FROM field_preplans WHERE id=?").bind(preplanId).first<{revisionNumber:number}>();
      const revision = Math.max(1,Number(current?.revisionNumber||1))+1;
      await restoreSnapshot(db,preplanId,snapshot,user);
      await db.prepare("UPDATE field_preplans SET publication_status='published',revision_number=?,published_by=?,published_at=CURRENT_TIMESTAMP,completeness_status=?,last_verified_at=?,next_review_date=?,construction_profile=?,occupancy_profile=?,fire_flow_profile=?,target_hazard_level=?,target_hazard_override=?,target_hazard_reasons=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(revision,user,snapshotValue(snapshot.plan?.completeness_status,"legacy"),snapshotValue(snapshot.plan?.last_verified_at),snapshotValue(snapshot.plan?.next_review_date),snapshotValue(snapshot.plan?.construction_profile,"{}"),snapshotValue(snapshot.plan?.occupancy_profile,"{}"),snapshotValue(snapshot.plan?.fire_flow_profile,"{}"),snapshotValue(snapshot.plan?.target_hazard_level,"low"),snapshotValue(snapshot.plan?.target_hazard_override,0),snapshotValue(snapshot.plan?.target_hazard_reasons,"[]"),user,preplanId).run();
      const restored = await buildSnapshot(db,preplanId);
      const summary = text(body.comment,1000)||`Restored operational layers from revision ${sourceRevision}. Current private attachments and legacy mapped systems were preserved.`;
      await db.prepare("INSERT INTO field_preplan_revisions(id,preplan_id,revision_number,publication_status,snapshot,summary,actor,restored_from_revision) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),preplanId,revision,"published",JSON.stringify(restored),summary,user,sourceRevision).run();
      await db.prepare("INSERT INTO field_preplan_reviews(id,preplan_id,revision_number,action,comment,actor) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),preplanId,revision,"restoreRevision",summary,user).run();
      return Response.json({ok:true,publicationStatus:"published",revisionNumber:revision,restoredFromRevision:sourceRevision});
    }

    if (["submitReview","returnDraft","publish","archive"].includes(action)) {
      const permission:PermissionKey = action === "publish" || action === "archive" ? "field_preplans.publish" : "field_preplans.review";
      await requirePermission(request, db, permission);
      const current = await db.prepare("SELECT revision_number revisionNumber,publication_status publicationStatus FROM field_preplans WHERE id=?").bind(preplanId).first<{revisionNumber:number;publicationStatus:string}>();
      const nextStatus = nextPublicationStatus(current?.publicationStatus, action);
      if (!nextStatus) return Response.json({ error:`${action} is not available while this preplan is ${current?.publicationStatus || "unknown"}.` }, { status:409 });
      const revision = Math.max(1,Number(current?.revisionNumber||1)) + (action === "publish" ? 1 : 0);
      if (action === "publish") {
        const snapshot = await buildSnapshot(db,preplanId);
        await db.prepare("INSERT INTO field_preplan_revisions(id,preplan_id,revision_number,publication_status,snapshot,summary,actor) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),preplanId,revision,nextStatus,JSON.stringify(snapshot),text(body.comment,1000),user).run();
      }
      await db.prepare("UPDATE field_preplans SET publication_status=?,revision_number=?,published_by=CASE WHEN ?='published' THEN ? ELSE published_by END,published_at=CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE published_at END,archived_by=CASE WHEN ?='archived' THEN ? ELSE archived_by END,archived_at=CASE WHEN ?='archived' THEN CURRENT_TIMESTAMP ELSE archived_at END,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(nextStatus,revision,nextStatus,user,nextStatus,nextStatus,user,nextStatus,user,preplanId).run();
      await db.prepare("INSERT INTO field_preplan_reviews(id,preplan_id,revision_number,action,comment,actor) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),preplanId,revision,action,text(body.comment,1000),user).run();
      return Response.json({ ok:true,publicationStatus:nextStatus,revisionNumber:revision });
    }
    return Response.json({ error:"Unsupported operational preplan action." }, { status:400 });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error:error instanceof Error ? error.message : "Unable to update operational preplan." }, { status:500 });
  }
}

async function buildSnapshot(db: Db, preplanId: string) {
  const plan = await db.prepare("SELECT * FROM field_preplans WHERE id=?").bind(preplanId).first();
  const [levels,spaces,features,alerts,hazmat,zones,annotations,assets,hoseLays,risks] = await Promise.all([
    db.prepare("SELECT * FROM field_preplan_levels WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_spaces WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_features WHERE preplan_id=?").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_alerts WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_hazmat WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_hazmat_zones WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_annotations WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT id,preplan_id,level_id,category,original_filename,mime_type,file_size,caption,pin_to_respond,created_by,created_at FROM field_preplan_assets WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_hose_lays WHERE preplan_id=? AND archived=0").bind(preplanId).all(),
    db.prepare("SELECT * FROM field_preplan_risk_factors WHERE preplan_id=?").bind(preplanId).all(),
  ]);
  return { plan,levels:levels.results,spaces:spaces.results,features:features.results,alerts:alerts.results,hazmat:hazmat.results,zones:zones.results,annotations:annotations.results,assets:assets.results,hoseLays:hoseLays.results,risks:risks.results };
}

function snapshotValue(value:unknown,fallback:null|string|number|boolean=null) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : fallback;
}

function parseSnapshot(raw:string,preplanId:string):Snapshot {
  let parsed:unknown;
  try { parsed=JSON.parse(raw); } catch { throw new Error("The selected revision snapshot is not valid JSON."); }
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("The selected revision snapshot is invalid.");
  const snapshot=parsed as Snapshot;
  if(snapshot.plan&&snapshotValue(snapshot.plan.id)!==preplanId)throw new Error("The selected revision does not belong to this preplan.");
  for(const key of ["levels","spaces","alerts","hazmat","zones","annotations","hoseLays","risks"]){
    const rows=snapshot[key];if(!Array.isArray(rows))throw new Error(`The selected revision is missing ${key}.`);
    for(const row of rows){if(!row||typeof row!=="object"||Array.isArray(row)||snapshotValue((row as SnapshotRow).preplan_id)!==preplanId)throw new Error(`The selected revision contains an invalid ${key} record.`);}
  }
  return snapshot;
}

const restoreTables = {
  levels:{table:"field_preplan_levels",columns:["id","preplan_id","name","short_label","layer_type","floor_index","grade_designation","sort_order","is_default","respond_visible","hidden","archived","background_type","background_asset_id","background_transform","opacity","created_by","updated_by"]},
  spaces:{table:"field_preplan_spaces",columns:["id","preplan_id","level_id","display_name","room_number","space_type","aliases","cad_keywords","geometry","coordinate_space","label_x","label_y","typical_occupancy","peak_occupancy","special_population_notes","access_notes","fire_protection_notes","hazards","archived","created_by","updated_by"]},
  alerts:{table:"field_preplan_alerts",columns:["id","preplan_id","level_id","space_id","alert_type","title","instructions","severity","display_order","pin_to_respond","effective_at","expires_at","expiration_action","verification_required","verified_by","verified_at","archived","created_by","updated_by"]},
  hazmat:{table:"field_preplan_hazmat",columns:["id","preplan_id","level_id","space_id","mapped","chemical_name","un_na_number","erg_guide_number","quantity","quantity_unit","container_type","physical_state","exact_location","nfpa_health","nfpa_flammability","nfpa_instability","nfpa_special","date_verified","verified_by","effective_at","expires_at","expiration_action","notes","latitude","longitude","plan_x","plan_y","archived","created_by","updated_by"]},
  zones:{table:"field_preplan_hazmat_zones",columns:["id","preplan_id","hazmat_id","level_id","zone_type","geometry_type","geometry","label","radius_feet","fill_color","line_color","opacity","line_width","line_style","effective_at","expires_at","archived","created_by","updated_by"]},
  annotations:{table:"field_preplan_annotations",columns:["id","preplan_id","level_id","annotation_type","operational_subtype","name","label","geometry","coordinate_space","line_color","fill_color","line_width","opacity","font_size","rotation","arrow_config","measurement","units","sort_order","min_zoom","max_zoom","effective_at","expires_at","expiration_action","verified_by","verified_at","archived","created_by","updated_by"]},
  hoseLays:{table:"field_preplan_hose_lays",columns:["id","preplan_id","level_id","name","source_hydrant_id","destination_side","destination_feature_id","path","segment_distances","total_distance_feet","hose_size_inches","section_length_feet","reserve_feet","recommended_hose_feet","supply_line_label","apparatus_id","apparatus_capacity_feet","inventory_verified_at","notes","archived","created_by","updated_by"]},
} as const;

async function restoreSnapshot(db:Db,preplanId:string,snapshot:Snapshot,user:string){
  for(const [key,config] of Object.entries(restoreTables)){
    const rows=snapshot[key] as SnapshotRow[];
    for(const row of rows){
      const values=config.columns.map((column)=>column==="preplan_id"?preplanId:column==="archived"?0:column==="updated_by"?user:snapshotValue(row[column],column==="created_by"?user:null));
      const updates=config.columns.filter((column)=>!["id","preplan_id","created_by"].includes(column)).map((column)=>`${column}=excluded.${column}`).join(",");
      await db.prepare(`INSERT INTO ${config.table}(${config.columns.join(",")}) VALUES(${config.columns.map(()=>"?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates},updated_at=CURRENT_TIMESTAMP`).bind(...values).run();
    }
    const ids=rows.map((row)=>text(row.id,80)).filter(Boolean);
    const missing=ids.length?` AND id NOT IN (${ids.map(()=>"?").join(",")})`:"";
    await db.prepare(`UPDATE ${config.table} SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE preplan_id=?${missing}`).bind(user,preplanId,...ids).run();
  }
  const risks=snapshot.risks as SnapshotRow[];
  for(const row of risks){
    await db.prepare("INSERT INTO field_preplan_risk_factors(id,preplan_id,factor,score,explanation,source,manual_override,reviewer,reviewed_at,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(preplan_id,factor) DO UPDATE SET score=excluded.score,explanation=excluded.explanation,source=excluded.source,manual_override=excluded.manual_override,reviewer=excluded.reviewer,reviewed_at=excluded.reviewed_at,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
      .bind(snapshotValue(row.id,crypto.randomUUID()),preplanId,snapshotValue(row.factor,"Restored factor"),snapshotValue(row.score,0),snapshotValue(row.explanation,""),snapshotValue(row.source,"Restored revision"),snapshotValue(row.manual_override,0),snapshotValue(row.reviewer),snapshotValue(row.reviewed_at),snapshotValue(row.created_by,user),user).run();
  }
  const factors=risks.map((row)=>text(row.factor,120)).filter(Boolean);
  const missing=factors.length?` AND factor NOT IN (${factors.map(()=>"?").join(",")})`:"";
  await db.prepare(`DELETE FROM field_preplan_risk_factors WHERE preplan_id=?${missing}`).bind(preplanId,...factors).run();
}
