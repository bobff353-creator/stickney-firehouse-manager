import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank } from "../../permissions";
import { polygonAreaSquareFeet, suggestedFireFlow, type ConstructionGroup, type OccupancyFlowCategory, type SprinklerStandard } from "../../preplan-fire-flow";
import { canDeleteLevel, nextSortOrder, type LevelGrade, type LevelLayerType } from "../../preplans/levels.ts";
import { isValidGeometry, parseAliasList, polygonCentroid, type SpaceType } from "../../preplans/spaces.ts";
import type { AlertSeverity, AlertType } from "../../preplans/alerts.ts";
import { isValidNfpaRating, isValidUnNaNumber, type ContainerType, type PhysicalState } from "../../preplans/hazmat.ts";
import { isValidZoneGeometry, type ZoneShape, type ZoneType } from "../../preplans/hazmat-zones.ts";
import { isValidRiskScore, isValidTargetHazardDesignation, type RiskFactorKey } from "../../preplans/risk.ts";
import { isValidHoseSize, isValidSegments, recommendedHoseFeet, totalDistanceFeet, type HoseLaySegment } from "../../preplans/hose-lay.ts";

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
const alertTypes = new Set<AlertType>(["critical_warning","access_problem","command_note","general_note"]);
const alertSeverities = new Set<AlertSeverity>(["informational","advisory","warning","critical"]);
const containerTypes = new Set<ContainerType>(["cylinder","drum","tote","tank","cartridge","pipeline","bag","other"]);
const physicalStates = new Set<PhysicalState>(["solid","liquid","gas","cryogenic","unknown"]);
const zoneTypes = new Set<ZoneType>(["hot","warm","cold","isolation","evacuation","custom"]);
const zoneShapes = new Set<ZoneShape>(["circle","polygon"]);
const riskFactorKeys = new Set<RiskFactorKey>(["life_hazard","special_population","construction","building_size","fire_load","hazmat","access","water_supply","fire_protection","prior_incidents","vacancy_dangerous","below_grade","operational_complexity"]);

async function access(request:Request, db:Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const row = email ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;isAdmin:number}>() : null;
  const admin = ownerAdminEmails.includes(email) || Boolean(row?.isAdmin);
  if (!row && !admin) return { allowed:false, canEdit:false, canManageLayers:false, canManageHazmat:false, actor:"" };
  if (admin) return { allowed:true, canEdit:true, canManageLayers:true, canManageHazmat:true, actor:row?.name || email };
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(row!.rank).all<{permissionKey:string;allowed:number}>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(row!.id).all<{permissionKey:string;effect:"allow"|"deny"}>(),
  ]);
  const permissions = new Set(rankRows.results.length ? rankRows.results.filter((item) => item.allowed).map((item) => item.permissionKey) : defaultPermissionsForRank(row!.rank));
  for (const item of overrides.results) item.effect === "allow" ? permissions.add(item.permissionKey) : permissions.delete(item.permissionKey);
  return { allowed:permissions.has("field_preplans.view"), canEdit:permissions.has("field_preplans.edit"), canManageLayers:permissions.has("field_preplans.manage_layers"), canManageHazmat:permissions.has("field_preplans.manage_hazmat"), actor:row!.name };
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
    const [plans, features, photos, imports, levels, spaces, alerts, hazmat, hazmatZones, riskFactors, hoseLays] = await Promise.all([
      db.prepare("SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,COALESCE(footprint_square_feet,0) footprintSquareFeet,COALESCE(floor_count,1) floorCount,COALESCE(fire_flow_calculation_area,0) fireFlowCalculationArea,COALESCE(construction_type,'VB') constructionType,COALESCE(occupancy_flow_category,'other') occupancyFlowCategory,COALESCE(sprinkler_standard,'none') sprinklerStandard,COALESCE(suggested_fire_flow_gpm,0) suggestedFireFlowGpm,COALESCE(suggested_fire_flow_duration,0) suggestedFireFlowDuration,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,COALESCE(NULLIF(lifecycle_status,''),'published') lifecycleStatus,COALESCE(revision_number,1) revisionNumber,COALESCE(target_hazard,0) targetHazard,COALESCE(NULLIF(target_hazard_reasons,''),'[]') targetHazardReasons,COALESCE(NULLIF(risk_override_classification,''),'') riskOverrideClassification,COALESCE(risk_reviewed_by,'') riskReviewedBy,risk_reviewed_at riskReviewedAt,updated_by updatedBy,updated_at updatedAt FROM field_preplans ORDER BY updated_at DESC").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details FROM field_preplan_features ORDER BY created_at").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,business_name businessName,address,source_file sourceFile,source_row sourceRow,status,latitude,longitude,geocode_note geocodeNote,linked_preplan_id linkedPreplanId FROM field_preplan_imports ORDER BY business_name COLLATE NOCASE,address COLLATE NOCASE").all(),
      db.prepare("SELECT id,preplan_id preplanId,name,short_label shortLabel,layer_type layerType,floor_index floorIndex,grade,sort_order sortOrder,is_default isDefault,respond_visible respondVisible,hidden,background_type backgroundType,background_asset_key backgroundAssetKey,background_transform backgroundTransform,opacity FROM field_preplan_levels ORDER BY preplan_id,sort_order").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,display_name displayName,room_number roomNumber,space_type spaceType,aliases,cad_keywords cadKeywords,geometry,label_position labelPosition,typical_occupancy typicalOccupancy,peak_occupancy peakOccupancy,special_population_notes specialPopulationNotes,access_notes accessNotes,fire_protection_notes fireProtectionNotes,hazards FROM field_preplan_spaces ORDER BY preplan_id,display_name COLLATE NOCASE").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,alert_type alertType,title,instructions,severity,display_order displayOrder,pin_to_respond pinToRespond,effective_at effectiveAt,expires_at expiresAt,verification_required verificationRequired,verified_by verifiedBy,verified_at verifiedAt,archived FROM field_preplan_alerts WHERE archived=0 ORDER BY preplan_id,CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 WHEN 'advisory' THEN 2 ELSE 3 END,display_order").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,mapped,chemical_name chemicalName,un_na_number unNaNumber,erg_guide_number ergGuideNumber,quantity,quantity_unit quantityUnit,container_type containerType,physical_state physicalState,exact_location exactLocation,nfpa_health nfpaHealth,nfpa_flammability nfpaFlammability,nfpa_instability nfpaInstability,nfpa_special nfpaSpecial,sds_asset_id sdsAssetId,photo_asset_id photoAssetId,date_verified dateVerified,verified_by verifiedBy,notes FROM field_preplan_hazmat ORDER BY preplan_id,chemical_name COLLATE NOCASE").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,hazmat_id hazmatId,zone_type zoneType,shape,label,center_lat centerLat,center_lng centerLng,radius_feet radiusFeet,polygon,line_color lineColor,line_width lineWidth,line_style lineStyle,fill_opacity fillOpacity FROM field_preplan_hazmat_zones ORDER BY preplan_id").all(),
      db.prepare("SELECT id,preplan_id preplanId,factor_key factorKey,score,explanation,source FROM field_preplan_risk_factors ORDER BY preplan_id,score DESC").all(),
      db.prepare("SELECT id,preplan_id preplanId,level_id levelId,source_hydrant_id sourceHydrantId,destination_lat destinationLat,destination_lng destinationLng,destination_side destinationSide,destination_feature_id destinationFeatureId,segments,hose_size_inches hoseSizeInches,section_length_feet sectionLengthFeet,reserve_feet reserveFeet,supply_line_label supplyLineLabel,assigned_apparatus_label assignedApparatusLabel,verified_available_feet verifiedAvailableFeet,notes FROM field_preplan_hose_lays ORDER BY preplan_id").all(),
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
        alerts:alerts.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((alertRow) => ({ ...alertRow, pinToRespond:Boolean((alertRow as {pinToRespond:number}).pinToRespond), verificationRequired:Boolean((alertRow as {verificationRequired:number}).verificationRequired), archived:Boolean((alertRow as {archived:number}).archived) })),
        hazmat:hazmat.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((item) => ({ ...item, mapped:Boolean((item as {mapped:number}).mapped) })),
        hazmatZones:hazmatZones.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((zone) => ({ ...zone, polygon:JSON.parse(String((zone as {polygon?:string}).polygon || "[]")) })),
        riskFactors:riskFactors.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id),
        targetHazard:Boolean((plan as {targetHazard:number}).targetHazard),
        targetHazardReasons:JSON.parse(String((plan as {targetHazardReasons?:string}).targetHazardReasons || "[]")),
        hoseLays:hoseLays.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((item) => ({ ...item, segments:JSON.parse(String((item as {segments?:string}).segments || "[]")) })),
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
    if (action === "saveAlert") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const levelId = text(body.levelId, 80) || null;
      if (levelId) {
        const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first();
        if (!level) return Response.json({ error:"The selected level does not belong to this preplan." }, { status:400 });
      }
      const title = text(body.title, 160);
      if (!title) return Response.json({ error:"Alert title is required." }, { status:400 });
      const requestedType = text(body.alertType, 30) as AlertType;
      const alertType = alertTypes.has(requestedType) ? requestedType : "general_note";
      const requestedSeverity = text(body.severity, 20) as AlertSeverity;
      const severity = alertSeverities.has(requestedSeverity) ? requestedSeverity : "advisory";
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_alerts(id,preplan_id,level_id,alert_type,title,instructions,severity,display_order,pin_to_respond,effective_at,expires_at,verification_required,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,alert_type=excluded.alert_type,title=excluded.title,instructions=excluded.instructions,severity=excluded.severity,display_order=excluded.display_order,pin_to_respond=excluded.pin_to_respond,effective_at=excluded.effective_at,expires_at=excluded.expires_at,verification_required=excluded.verification_required,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,alertType,title,text(body.instructions,4000),severity,Math.trunc(number(body.displayOrder))||0,body.pinToRespond===true?1:0,body.effectiveAt?text(body.effectiveAt,40):null,body.expiresAt?text(body.expiresAt,40):null,body.verificationRequired===true?1:0,auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "verifyAlert") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const id = text(body.id, 80);
      const alert = await db.prepare("SELECT id FROM field_preplan_alerts WHERE id=?").bind(id).first();
      if (!alert) return Response.json({ error:"Alert not found." }, { status:404 });
      await db.prepare("UPDATE field_preplan_alerts SET verified_by=?,verified_at=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(auth.actor,auth.actor,id).run();
      return Response.json({ ok:true });
    }
    if (action === "deleteAlert") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("UPDATE field_preplan_alerts SET archived=1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(auth.actor,id).run();
      return Response.json({ ok:true });
    }
    if (action === "saveHazmat") {
      if (!auth.canManageHazmat) return Response.json({ error:"Field preplan HazMat management permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const levelId = text(body.levelId, 80) || null;
      if (levelId) {
        const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first();
        if (!level) return Response.json({ error:"The selected level does not belong to this preplan." }, { status:400 });
      }
      const chemicalName = text(body.chemicalName, 160);
      if (!chemicalName) return Response.json({ error:"Chemical name is required." }, { status:400 });
      const unNaNumber = text(body.unNaNumber, 12).toUpperCase();
      if (unNaNumber && !isValidUnNaNumber(unNaNumber)) return Response.json({ error:"UN/NA number must look like UN1017 or NA9191." }, { status:400 });
      const requestedContainer = text(body.containerType, 20) as ContainerType;
      const containerType = containerTypes.has(requestedContainer) ? requestedContainer : "other";
      const requestedState = text(body.physicalState, 20) as PhysicalState;
      const physicalState = physicalStates.has(requestedState) ? requestedState : "unknown";
      const ratings = [number(body.nfpaHealth),number(body.nfpaFlammability),number(body.nfpaInstability)].map((value) => Number.isFinite(value) ? Math.trunc(value) : 0);
      if (!ratings.every(isValidNfpaRating)) return Response.json({ error:"NFPA 704 ratings must be whole numbers from 0 to 4." }, { status:400 });
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_hazmat(id,preplan_id,level_id,mapped,chemical_name,un_na_number,erg_guide_number,quantity,quantity_unit,container_type,physical_state,exact_location,nfpa_health,nfpa_flammability,nfpa_instability,nfpa_special,date_verified,verified_by,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,mapped=excluded.mapped,chemical_name=excluded.chemical_name,un_na_number=excluded.un_na_number,erg_guide_number=excluded.erg_guide_number,quantity=excluded.quantity,quantity_unit=excluded.quantity_unit,container_type=excluded.container_type,physical_state=excluded.physical_state,exact_location=excluded.exact_location,nfpa_health=excluded.nfpa_health,nfpa_flammability=excluded.nfpa_flammability,nfpa_instability=excluded.nfpa_instability,nfpa_special=excluded.nfpa_special,date_verified=excluded.date_verified,verified_by=excluded.verified_by,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,body.mapped===true?1:0,chemicalName,unNaNumber,text(body.ergGuideNumber,10),Number.isFinite(number(body.quantity))?number(body.quantity):null,text(body.quantityUnit,20),containerType,physicalState,text(body.exactLocation,240),ratings[0],ratings[1],ratings[2],text(body.nfpaSpecial,10),body.dateVerified?text(body.dateVerified,40):null,auth.actor,text(body.notes,2000),auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "deleteHazmat") {
      if (!auth.canManageHazmat) return Response.json({ error:"Field preplan HazMat management permission is required." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("DELETE FROM field_preplan_hazmat WHERE id=?").bind(id).run();
      await db.prepare("UPDATE field_preplan_hazmat_zones SET hazmat_id=NULL WHERE hazmat_id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    if (action === "saveHazmatZone") {
      if (!auth.canManageHazmat) return Response.json({ error:"Field preplan HazMat management permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const levelId = text(body.levelId, 80) || null;
      if (levelId) {
        const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first();
        if (!level) return Response.json({ error:"The selected level does not belong to this preplan." }, { status:400 });
      }
      const hazmatId = text(body.hazmatId, 80) || null;
      if (hazmatId) {
        const hazmatRecord = await db.prepare("SELECT id FROM field_preplan_hazmat WHERE id=? AND preplan_id=?").bind(hazmatId,preplanId).first();
        if (!hazmatRecord) return Response.json({ error:"The selected HazMat record does not belong to this preplan." }, { status:400 });
      }
      const requestedType = text(body.zoneType, 20) as ZoneType;
      const zoneType = zoneTypes.has(requestedType) ? requestedType : "isolation";
      const requestedShape = text(body.shape, 10) as ZoneShape;
      const shape = zoneShapes.has(requestedShape) ? requestedShape : "circle";
      const centerLat = Number.isFinite(number(body.centerLat)) ? number(body.centerLat) : null;
      const centerLng = Number.isFinite(number(body.centerLng)) ? number(body.centerLng) : null;
      const radiusFeet = Number.isFinite(number(body.radiusFeet)) ? number(body.radiusFeet) : null;
      const polygon = Array.isArray(body.polygon) ? (body.polygon as unknown[]).slice(0,200).map((item) => point(item)).filter((item):item is Point => Boolean(item)).map((p) => ({ lat:p.lat, lng:p.lng })) : [];
      const zoneGeometry = { shape, centerLat, centerLng, radiusFeet, polygon };
      if (!isValidZoneGeometry(zoneGeometry)) return Response.json({ error: shape === "circle" ? "A circle zone needs a valid center point and radius (feet) greater than zero." : "A polygon zone needs at least 3 valid points." }, { status:400 });
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_hazmat_zones(id,preplan_id,level_id,hazmat_id,zone_type,shape,label,center_lat,center_lng,radius_feet,polygon,line_color,line_width,line_style,fill_opacity,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,hazmat_id=excluded.hazmat_id,zone_type=excluded.zone_type,shape=excluded.shape,label=excluded.label,center_lat=excluded.center_lat,center_lng=excluded.center_lng,radius_feet=excluded.radius_feet,polygon=excluded.polygon,line_color=excluded.line_color,line_width=excluded.line_width,line_style=excluded.line_style,fill_opacity=excluded.fill_opacity,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,hazmatId,zoneType,shape,text(body.label,120),centerLat,centerLng,radiusFeet,JSON.stringify(polygon),text(body.lineColor,10)||"#b52222",Number.isFinite(number(body.lineWidth))?number(body.lineWidth):2,text(body.lineStyle,10)||"solid",Number.isFinite(number(body.fillOpacity))?Math.min(1,Math.max(0,number(body.fillOpacity))):.18,auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "deleteHazmatZone") {
      if (!auth.canManageHazmat) return Response.json({ error:"Field preplan HazMat management permission is required." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("DELETE FROM field_preplan_hazmat_zones WHERE id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    if (action === "saveRiskFactor") {
      if (!auth.canManageLayers) return Response.json({ error:"Officer permission is required to update the risk assessment." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const requestedFactor = text(body.factorKey, 40) as RiskFactorKey;
      if (!riskFactorKeys.has(requestedFactor)) return Response.json({ error:"Unknown risk factor." }, { status:400 });
      const score = Math.trunc(number(body.score));
      if (!isValidRiskScore(score)) return Response.json({ error:"Risk factor score must be a whole number from 0 to 4." }, { status:400 });
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_risk_factors(id,preplan_id,factor_key,score,explanation,source,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(preplan_id,factor_key) DO UPDATE SET score=excluded.score,explanation=excluded.explanation,source=excluded.source,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,requestedFactor,score,text(body.explanation,2000),text(body.source,240),auth.actor,auth.actor).run();
      return Response.json({ ok:true, id });
    }
    if (action === "deleteRiskFactor") {
      if (!auth.canManageLayers) return Response.json({ error:"Officer permission is required to update the risk assessment." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("DELETE FROM field_preplan_risk_factors WHERE id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    if (action === "saveTargetHazard") {
      if (!auth.canManageLayers) return Response.json({ error:"Officer permission is required to designate a target hazard." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const targetHazard = body.targetHazard === true;
      const reasons = Array.isArray(body.targetHazardReasons) ? (body.targetHazardReasons as unknown[]).map((item) => text(item,200)).filter(Boolean).slice(0,20) : [];
      if (targetHazard && !isValidTargetHazardDesignation(reasons)) return Response.json({ error:"A Target Hazard designation requires at least one stated reason." }, { status:400 });
      const overrideClassification = text(body.riskOverrideClassification, 20);
      if (overrideClassification && !["low","moderate","high","critical"].includes(overrideClassification)) return Response.json({ error:"Invalid risk classification override." }, { status:400 });
      await db.prepare("UPDATE field_preplans SET target_hazard=?,target_hazard_reasons=?,risk_override_classification=?,risk_reviewed_by=?,risk_reviewed_at=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(targetHazard?1:0,JSON.stringify(reasons),overrideClassification,auth.actor,auth.actor,preplanId).run();
      return Response.json({ ok:true });
    }
    if (action === "saveHoseLay") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const preplanId = text(body.preplanId, 80);
      const plan = preplanId ? await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first() : null;
      if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
      const levelId = text(body.levelId, 80) || null;
      if (levelId) {
        const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first();
        if (!level) return Response.json({ error:"The selected level does not belong to this preplan." }, { status:400 });
      }
      const sourceHydrantId = text(body.sourceHydrantId, 80) || null;
      if (sourceHydrantId) {
        const hydrant = await db.prepare("SELECT id FROM field_hydrants WHERE id=?").bind(sourceHydrantId).first();
        if (!hydrant) return Response.json({ error:"Source hydrant not found." }, { status:400 });
      }
      const destinationFeatureId = text(body.destinationFeatureId, 80) || null;
      if (destinationFeatureId) {
        const feature = await db.prepare("SELECT id FROM field_preplan_features WHERE id=? AND preplan_id=?").bind(destinationFeatureId,preplanId).first();
        if (!feature) return Response.json({ error:"The destination feature does not belong to this preplan." }, { status:400 });
      }
      const segments = Array.isArray(body.segments) ? (body.segments as unknown[]).slice(0,50).map((item) => {
        const raw = item as Partial<HoseLaySegment> | null;
        return { fromLat:number(raw?.fromLat), fromLng:number(raw?.fromLng), toLat:number(raw?.toLat), toLng:number(raw?.toLng) };
      }) : [];
      if (!isValidSegments(segments)) return Response.json({ error:"At least one valid measured segment (from/to coordinates) is required." }, { status:400 });
      const hoseSizeInches = number(body.hoseSizeInches);
      if (!isValidHoseSize(hoseSizeInches)) return Response.json({ error:"Hose size must be one of the standard sizes (1.75, 2.5, 3, 4, 5 inches)." }, { status:400 });
      const sectionLengthFeet = Number.isFinite(number(body.sectionLengthFeet)) && number(body.sectionLengthFeet) > 0 ? number(body.sectionLengthFeet) : 100;
      const reserveFeet = Number.isFinite(number(body.reserveFeet)) && number(body.reserveFeet) >= 0 ? number(body.reserveFeet) : 100;
      const verifiedAvailableFeet = Number.isFinite(number(body.verifiedAvailableFeet)) ? number(body.verifiedAvailableFeet) : null;
      const id = text(body.id, 80) || crypto.randomUUID();
      await db.prepare("INSERT INTO field_preplan_hose_lays(id,preplan_id,level_id,source_hydrant_id,destination_lat,destination_lng,destination_side,destination_feature_id,segments,hose_size_inches,section_length_feet,reserve_feet,supply_line_label,assigned_apparatus_label,verified_available_feet,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET level_id=excluded.level_id,source_hydrant_id=excluded.source_hydrant_id,destination_lat=excluded.destination_lat,destination_lng=excluded.destination_lng,destination_side=excluded.destination_side,destination_feature_id=excluded.destination_feature_id,segments=excluded.segments,hose_size_inches=excluded.hose_size_inches,section_length_feet=excluded.section_length_feet,reserve_feet=excluded.reserve_feet,supply_line_label=excluded.supply_line_label,assigned_apparatus_label=excluded.assigned_apparatus_label,verified_available_feet=excluded.verified_available_feet,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,preplanId,levelId,sourceHydrantId,Number.isFinite(number(body.destinationLat))?number(body.destinationLat):null,Number.isFinite(number(body.destinationLng))?number(body.destinationLng):null,text(body.destinationSide,4),destinationFeatureId,JSON.stringify(segments),hoseSizeInches,sectionLengthFeet,reserveFeet,text(body.supplyLineLabel,80),text(body.assignedApparatusLabel,80),verifiedAvailableFeet,text(body.notes,2000),auth.actor,auth.actor).run();
      return Response.json({ ok:true, id, totalDistanceFeet:Math.round(totalDistanceFeet(segments)), recommendedFeet:recommendedHoseFeet(totalDistanceFeet(segments),reserveFeet,sectionLengthFeet) });
    }
    if (action === "deleteHoseLay") {
      if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
      const id = text(body.id, 80);
      await db.prepare("DELETE FROM field_preplan_hose_lays WHERE id=?").bind(id).run();
      return Response.json({ ok:true });
    }
    return Response.json({ error:"Unsupported preplan action." }, { status:400 });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to save preplan." }, { status:500 }); }
}
