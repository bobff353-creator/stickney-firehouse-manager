import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank } from "../../permissions";
import { polygonAreaSquareFeet, suggestedFireFlow, type ConstructionGroup, type OccupancyFlowCategory, type SprinklerStandard } from "../../preplan-fire-flow";
import { canDeleteLevel, nextSortOrder, type LevelGrade, type LevelLayerType } from "../../preplans/levels.ts";
import { isValidGeometry, parseAliasList, polygonCentroid, type SpaceType } from "../../preplans/spaces.ts";

type Point = { lat:number; lng:number };
type Db = Awaited<ReturnType<typeof ensureDatabase>>;
const ownerAdminEmails = ["bobff353@gmail.com"];
const featureTypes = new Set(["alarm","knox","riser","fdc","sprinkler","gas","water","electric","propane","elevator","elevator_room","standpipe","access","hazard"]);
const constructionTypes = new Set<ConstructionGroup>(["IA_IB","IIA_IIIA","IV_VA","IIB_IIIB","VB"]);
const occupancyFlowCategories = new Set<OccupancyFlowCategory>(["other","dwelling"]);
const sprinklerStandards = new Set<SprinklerStandard>(["none","nfpa13","nfpa13r","residential"]);
const layerTypes = new Set<LevelLayerType>(["arrival","floor","basement","roof","fire_protection","hazmat","iap","water_supply","technical_rescue","custom"]);
const levelGrades = new Set<LevelGrade>(["above_grade","below_grade","grade","n/a"]);
const spaceTypes = new Set<SpaceType>(["room","classroom","office","stairway","elevator_lobby","corridor","mechanical","electrical","boiler_room","sprinkler_room","storage","gymnasium","roof_access","basement","other"]);

async function access(request:Request, db:Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const row = email ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;isAdmin:number}>() : null;
  const admin = ownerAdminEmails.includes(email) || Boolean(row?.isAdmin);
  if (!row && !admin) return { allowed:false, canEdit:false, canManageLayers:false, actor:"" };
  if (admin) return { allowed:true, canEdit:true, canManageLayers:true, actor:row?.name || email };
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(row!.rank).all<{permissionKey:string;allowed:number}>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(row!.id).all<{permissionKey:string;effect:"allow"|"deny"}>(),
  ]);
  const permissions = new Set(rankRows.results.length ? rankRows.results.filter((item) => item.allowed).map((item) => item.permissionKey) : defaultPermissionsForRank(row!.rank));
  for (const item of overrides.results) item.effect === "allow" ? permissions.add(item.permissionKey) : permissions.delete(item.permissionKey);
  return { allowed:permissions.has("field_preplans.view"), canEdit:permissions.has("field_preplans.edit"), canManageLayers:permissions.has("field_preplans.manage_layers"), actor:row!.name };
}

function text(value:unknown, limit=2000) { return String(value ?? "").trim().slice(0, limit); }
function number(value:unknown) { const result = Number(value); return Number.isFinite(result) ? result : Number.NaN; }
function point(value:unknown):Point|null {
  const item = value as Partial<Point> | null;
  const lat = number(item?.lat), lng = number(item?.lng);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function footprint(value:unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(point).filter((item):item is Point => Boolean(item)).slice(0, 80);
}

async function mapsKey() {
  const processKey = process.env.GOOGLE_MAPS_GEOCODING_KEY?.trim()
    || process.env.GOOGLE_MAPS_STREET_VIEW_KEY?.trim()
    || process.env["Maps Platform API Key"]?.trim();
  if (processKey) return processKey;
  try {
    const { env } = await import("@/app/cf-env");
    const runtime = env as unknown as Record<string,string|undefined>;
    return runtime.GOOGLE_MAPS_GEOCODING_KEY?.trim()
      || runtime.GOOGLE_MAPS_STREET_VIEW_KEY?.trim()
      || runtime["Maps Platform API Key"]?.trim()
      || "";
  } catch {
    return "";
  }
}

export async function GET(request:Request) {
  try {
    const db = await ensureDatabase();
    const auth = await access(request, db);
    if (!auth.allowed) return Response.json({ error:"Field preplan access is required." }, { status:403 });
    const [plans, features, photos, imports, levels, spaces] = await Promise.all([
      db.prepare("SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,COALESCE(footprint_square_feet,0) footprintSquareFeet,COALESCE(floor_count,1) floorCount,COALESCE(fire_flow_calculation_area,0) fireFlowCalculationArea,COALESCE(construction_type,'VB') constructionType,COALESCE(occupancy_flow_category,'other') occupancyFlowCategory,COALESCE(sprinkler_standard,'none') sprinklerStandard,COALESCE(suggested_fire_flow_gpm,0) suggestedFireFlowGpm,COALESCE(suggested_fire_flow_duration,0) suggestedFireFlowDuration,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,COALESCE(NULLIF(lifecycle_status,''),'published') lifecycleStatus,COALESCE(revision_number,1) revisionNumber,updated_by updatedBy,updated_at updatedAt FROM field_preplans ORDER BY updated_at DESC").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details FROM field_preplan_features ORDER BY created_at").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,business_name businessName,address,source_file sourceFile,source_row sourceRow,status,latitude,longitude,geocode_note geocodeNote,linked_preplan_id linkedPreplanId FROM field_preplan_imports ORDER BY business_name COLLATE NOCASE,address COLLATE NOCASE").all(),
      db.prepare("SELECT id,preplan_id preplanId,name,short_label shortLabel,layer_type layerType,floor_index floorIndex,grade,sort_order sortOrder,is_default isDefault,respond_visible respondVisible,hidden,background_type backgroundType,background_asset_key backgroundAssetKey,background_transform backgroundTransform,opacity FROM field_preplan_levels ORDER BY preplan_id,sort_order").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,display_name displayName,room_number roomNumber,space_type spaceType,aliases,cad_keywords cadKeywords,geometry,label_position labelPosition,typical_occupancy typicalOccupancy,peak_occupancy peakOccupancy,special_population_notes specialPopulationNotes,access_notes accessNotes,fire_protection_notes fireProtectionNotes,hazards FROM field_preplan_spaces ORDER BY preplan_id,display_name COLLATE NOCASE").all(),
    ]);
    return Response.json({
      canEdit:auth.canEdit,
      canManageLayers:auth.canManageLayers,
      preplans:plans.results.map((plan) => ({
        ...plan,
        footprint:JSON.parse(String((plan as {footprint?:string}).footprint || "[]")),
        features:features.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id),
        photos:photos.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((photo) => ({ ...photo, url:`/api/field-preplans/photos/${(photo as {id:string}).id}` })),
        levels:levels.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((level) => ({ ...level, isDefault:Boolean((level as {isDefault:number}).isDefault), respondVisible:Boolean((level as {respondVisible:number}).respondVisible), hidden:Boolean((level as {hidden:number}).hidden) })),
        spaces:spaces.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((space) => ({ ...space, aliases:JSON.parse(String((space as {aliases?:string}).aliases || "[]")), cadKeywords:JSON.parse(String((space as {cadKeywords?:string}).cadKeywords || "[]")), geometry:JSON.parse(String((space as {geometry?:string}).geometry || "[]")), labelPosition:(space as {labelPosition?:string|null}).labelPosition ? JSON.parse(String((space as {labelPosition?:string}).labelPosition)) : null })),
      })),
      imports:imports.results,
    });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load preplans." }, { status:500 }); }
}

export async function POST(request:Request) {
  try {
    const db = await ensureDatabase();
    const auth = await access(request, db);
    if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
    const body = await request.json() as Record<string,unknown>;
    const action = text(body.action, 40);
    if (action === "batchGeocodeImports") {
      const key = await mapsKey();
      if (!key) return Response.json({ error:"Google geocoding is not configured." }, { status:503 });
      const pending = await db.prepare("SELECT id,address FROM field_preplan_imports WHERE linked_preplan_id IS NULL AND status IN ('location_required','geocode_failed') ORDER BY source_row LIMIT 20").all<{id:string;address:string}>();
      let geocoded = 0, failed = 0;
      for (const item of pending.results) {
        const query = /,\s*(IL|Illinois)\b/i.test(item.address) ? item.address : `${item.address}, Stickney, IL`;
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("address", query);
        url.searchParams.set("components", "country:US");
        url.searchParams.set("key", key);
        try {
          const response = await fetch(url, { cache:"no-store" });
          const result = await response.json() as {status?:string;results?:Array<{formatted_address?:string;geometry?:{location?:{lat?:number;lng?:number}}}>};
          const location = result.results?.[0]?.geometry?.location;
          const latitude = Number(location?.lat), longitude = Number(location?.lng);
          if (response.ok && result.status === "OK" && latitude >= 41 && latitude <= 42.5 && longitude >= -88.5 && longitude <= -87) {
            await db.prepare("UPDATE field_preplan_imports SET latitude=?,longitude=?,geocode_note=?,status='geocoded',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(latitude,longitude,text(result.results?.[0]?.formatted_address,240),item.id).run();
            geocoded += 1;
          } else {
            await db.prepare("UPDATE field_preplan_imports SET latitude=NULL,longitude=NULL,geocode_note=?,status='geocode_failed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(text(result.status||"No matching address",240),item.id).run();
            failed += 1;
          }
        } catch {
          await db.prepare("UPDATE field_preplan_imports SET latitude=NULL,longitude=NULL,geocode_note='Geocoding request failed',status='geocode_failed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(item.id).run();
          failed += 1;
        }
      }
      const remaining = await db.prepare("SELECT COUNT(*) total FROM field_preplan_imports WHERE linked_preplan_id IS NULL AND status='location_required'").first<{total:number}>();
      return Response.json({ ok:true, processed:pending.results.length, geocoded, failed, remaining:Number(remaining?.total||0) });
    }
    if (action === "savePreplan") {
      const id = text(body.id, 80) || crypto.randomUUID();
      const importId = text(body.importId, 80);
      const businessName = text(body.businessName, 180), address = text(body.address, 240);
      const location = point(body.location), aSide = point(body.aSide), corners = footprint(body.footprint);
      if (!businessName || !location || corners.length < 3) return Response.json({ error:"Business name, map location, and at least three footprint corners are required." }, { status:400 });
      const floorCount = Math.max(1, Math.min(99, Math.trunc(number(body.floorCount) || 1)));
      const requestedConstruction = text(body.constructionType, 20) as ConstructionGroup;
      const constructionType = constructionTypes.has(requestedConstruction) ? requestedConstruction : "VB";
      const requestedOccupancy = text(body.occupancyFlowCategory, 20) as OccupancyFlowCategory;
      const occupancyFlowCategory = occupancyFlowCategories.has(requestedOccupancy) ? requestedOccupancy : "other";
      const requestedSprinkler = text(body.sprinklerStandard, 20) as SprinklerStandard;
      let sprinklerStandard = sprinklerStandards.has(requestedSprinkler) ? requestedSprinkler : "none";
      if ((occupancyFlowCategory === "dwelling") !== (sprinklerStandard === "residential") && sprinklerStandard !== "none") sprinklerStandard = "none";
      const footprintSquareFeet = Math.round(polygonAreaSquareFeet(corners));
      if (footprintSquareFeet < 10) return Response.json({ error:"The footprint is too small to represent a building. Zoom in and place the corner points again." }, { status:400 });
      const recommendation = suggestedFireFlow({ footprintSquareFeet, floorCount, constructionType, occupancyFlowCategory, sprinklerStandard });
      const values = [businessName,address,location.lat,location.lng,aSide?.lat ?? null,aSide?.lng ?? null,JSON.stringify(corners),footprintSquareFeet,floorCount,recommendation?.calculationArea ?? 0,constructionType,occupancyFlowCategory,sprinklerStandard,recommendation?.suggestedGpm ?? 0,recommendation?.durationHours ?? 0,text(body.contactInfo),text(body.construction),text(body.accessInfo),text(body.alarmSystem),text(body.knoxBox),text(body.riser),text(body.fdc),text(body.sprinklerSystem),text(body.status,40) || "Quick Preplan",auth.actor];
      await db.prepare("INSERT INTO field_preplans(id,business_name,address,latitude,longitude,a_side_latitude,a_side_longitude,footprint,footprint_square_feet,floor_count,fire_flow_calculation_area,construction_type,occupancy_flow_category,sprinkler_standard,suggested_fire_flow_gpm,suggested_fire_flow_duration,contact_info,construction,access_info,alarm_system,knox_box,riser,fdc,sprinkler_system,status,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,a_side_latitude=excluded.a_side_latitude,a_side_longitude=excluded.a_side_longitude,footprint=excluded.footprint,footprint_square_feet=excluded.footprint_square_feet,floor_count=excluded.floor_count,fire_flow_calculation_area=excluded.fire_flow_calculation_area,construction_type=excluded.construction_type,occupancy_flow_category=excluded.occupancy_flow_category,sprinkler_standard=excluded.sprinkler_standard,suggested_fire_flow_gpm=excluded.suggested_fire_flow_gpm,suggested_fire_flow_duration=excluded.suggested_fire_flow_duration,contact_info=excluded.contact_info,construction=excluded.construction,access_info=excluded.access_info,alarm_system=excluded.alarm_system,knox_box=excluded.knox_box,riser=excluded.riser,fdc=excluded.fdc,sprinkler_system=excluded.sprinkler_system,status=excluded.status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,...values,auth.actor).run();
      if (importId) await db.prepare("UPDATE field_preplan_imports SET linked_preplan_id=?,status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id,importId).run();
      return Response.json({ ok:true, id });
    }
    if (action === "saveFeature") {
      const preplanId = text(body.preplanId, 80), id = text(body.id, 80) || crypto.randomUUID(), featureType = text(body.featureType, 40);
      const location = point(body.location);
      if (!preplanId || !featureTypes.has(featureType) || !location) return Response.json({ error:"Choose a valid preplan feature and map location." }, { status:400 });
      const plan = await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first();
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      await db.prepare("INSERT INTO field_preplan_features(id,preplan_id,feature_type,label,latitude,longitude,system_type,service_status,details,created_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET feature_type=excluded.feature_type,label=excluded.label,latitude=excluded.latitude,longitude=excluded.longitude,system_type=excluded.system_type,service_status=excluded.service_status,details=excluded.details,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,featureType,text(body.label,120),location.lat,location.lng,text(body.systemType,80),text(body.serviceStatus,40) || "in_service",text(body.details),auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "saveLevel") {
      if (!auth.canManageLayers) return Response.json({ error:"Field preplan layer management permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const requestedLayerType = text(body.layerType, 30) as LevelLayerType;
      const layerType = layerTypes.has(requestedLayerType) ? requestedLayerType : "custom";
      if (layerType === "arrival") return Response.json({ error:"Only the automatically created Arrival level may use the arrival layer type." }, { status:400 });
      const name = text(body.name, 80);
      if (!name) return Response.json({ error:"Level name is required." }, { status:400 });
      const requestedGrade = text(body.grade, 20) as LevelGrade;
      const grade = levelGrades.has(requestedGrade) ? requestedGrade : "n/a";
      const id = text(body.id, 80) || crypto.randomUUID();
      const existing = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(id,preplanId).first();
      const existingCount = existing ? null : await db.prepare("SELECT COUNT(*) total FROM field_preplan_levels WHERE preplan_id=?").bind(preplanId).first<{total:number}>();
      const sortOrder = existing ? number(body.sortOrder) || 0 : nextSortOrder([{ sortOrder:Number(existingCount?.total || 0) - 1 }]);
      await db.prepare("INSERT INTO field_preplan_levels(id,preplan_id,name,short_label,layer_type,floor_index,grade,sort_order,is_default,respond_visible,hidden,background_type,background_asset_key,background_transform,opacity,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,short_label=excluded.short_label,layer_type=excluded.layer_type,floor_index=excluded.floor_index,grade=excluded.grade,sort_order=excluded.sort_order,respond_visible=excluded.respond_visible,hidden=excluded.hidden,background_type=excluded.background_type,background_asset_key=excluded.background_asset_key,background_transform=excluded.background_transform,opacity=excluded.opacity,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,name,text(body.shortLabel,20)||name.slice(0,20).toUpperCase(),layerType,Math.trunc(number(body.floorIndex)||0),grade,sortOrder,body.respondVisible===false?0:1,body.hidden===true?1:0,text(body.backgroundType,10)||"none",body.backgroundAssetKey?text(body.backgroundAssetKey,240):null,text(body.backgroundTransform,2000)||"{}",Number.isFinite(number(body.opacity))?Math.min(1,Math.max(0,number(body.opacity))):1,auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "deleteLevel") {
      if (!auth.canManageLayers) return Response.json({ error:"Field preplan layer management permission is required." }, { status:403 });
      const id = text(body.id, 80);
      const level = await db.prepare("SELECT id,layer_type layerType,is_default isDefault,preplan_id preplanId FROM field_preplan_levels WHERE id=?").bind(id).first<{id:string;layerType:LevelLayerType;isDefault:number;preplanId:string}>();
      if (!level) return Response.json({ error:"Level not found." }, { status:404 });
      if (!canDeleteLevel({ layerType:level.layerType, isDefault:Boolean(level.isDefault) })) return Response.json({ error:"The Arrival level cannot be deleted." }, { status:400 });
      await db.prepare("DELETE FROM field_preplan_spaces WHERE level_id=?").bind(id).run();
      await db.prepare("DELETE FROM field_preplan_levels WHERE id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    if (action === "saveSpace") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80), levelId = text(body.levelId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const level = levelId ? await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first() : null;
      if (!level) return Response.json({ error:"The selected level does not belong to this preplan." }, { status:400 });
      const displayName = text(body.displayName, 120);
      if (!displayName) return Response.json({ error:"Room name is required." }, { status:400 });
      const requestedSpaceType = text(body.spaceType, 30) as SpaceType;
      const spaceType = spaceTypes.has(requestedSpaceType) ? requestedSpaceType : "room";
      const rawGeometry = Array.isArray(body.geometry) ? (body.geometry as unknown[]).slice(0,200).map((item) => ({ x:number((item as {x?:unknown})?.x), y:number((item as {y?:unknown})?.y) })).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)) : [];
      if (rawGeometry.length && !isValidGeometry(rawGeometry)) return Response.json({ error:"Room outline must have at least 3 points, each within the floor plan bounds." }, { status:400 });
      const aliases = Array.isArray(body.aliases) ? (body.aliases as unknown[]).map((item) => text(item,80)).filter(Boolean).slice(0,40) : parseAliasList(text(body.aliasesText,2000));
      const cadKeywords = Array.isArray(body.cadKeywords) ? (body.cadKeywords as unknown[]).map((item) => text(item,80)).filter(Boolean).slice(0,40) : [];
      const labelPosition = rawGeometry.length ? polygonCentroid(rawGeometry) : null;
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_spaces(id,preplan_id,level_id,display_name,room_number,space_type,aliases,cad_keywords,geometry,label_position,typical_occupancy,peak_occupancy,special_population_notes,access_notes,fire_protection_notes,hazards,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,display_name=excluded.display_name,room_number=excluded.room_number,space_type=excluded.space_type,aliases=excluded.aliases,cad_keywords=excluded.cad_keywords,geometry=excluded.geometry,label_position=excluded.label_position,typical_occupancy=excluded.typical_occupancy,peak_occupancy=excluded.peak_occupancy,special_population_notes=excluded.special_population_notes,access_notes=excluded.access_notes,fire_protection_notes=excluded.fire_protection_notes,hazards=excluded.hazards,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,displayName,text(body.roomNumber,20),spaceType,JSON.stringify(aliases),JSON.stringify(cadKeywords),JSON.stringify(rawGeometry),labelPosition?JSON.stringify(labelPosition):null,Number.isFinite(number(body.typicalOccupancy))?Math.trunc(number(body.typicalOccupancy)):null,Number.isFinite(number(body.peakOccupancy))?Math.trunc(number(body.peakOccupancy)):null,text(body.specialPopulationNotes,2000),text(body.accessNotes,2000),text(body.fireProtectionNotes,2000),text(body.hazards,2000),auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "deleteSpace") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("DELETE FROM field_preplan_spaces WHERE id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    return Response.json({ error:"Unsupported preplan action." }, { status:400 });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to save preplan." }, { status:500 }); }
}
