import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank } from "../../permissions";
import { getPortalStorage } from "../../portal-storage";
import { polygonAreaSquareFeet, suggestedFireFlow, type ConstructionGroup, type OccupancyFlowCategory, type SprinklerStandard } from "../../preplan-fire-flow";

type Point = { lat:number; lng:number };
type Db = Awaited<ReturnType<typeof ensureDatabase>>;
const ownerAdminEmails = ["bobff353@gmail.com"];
const featureTypes = new Set(["alarm","knox","riser","fdc","sprinkler","gas","water","electric","propane","elevator","elevator_room","standpipe","access","hazard"]);
const constructionTypes = new Set<ConstructionGroup>(["IA_IB","IIA_IIIA","IV_VA","IIB_IIIB","VB"]);
const occupancyFlowCategories = new Set<OccupancyFlowCategory>(["other","dwelling"]);
const sprinklerStandards = new Set<SprinklerStandard>(["none","nfpa13","nfpa13r","residential"]);
type Bucket = { delete(key:string):Promise<void> };

async function access(request:Request, db:Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const row = email ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;isAdmin:number}>() : null;
  const admin = ownerAdminEmails.includes(email) || Boolean(row?.isAdmin);
  if (!row && !admin) return { allowed:false, canEdit:false, canDelete:false, actor:"" };
  if (admin) return { allowed:true, canEdit:true, canDelete:true, actor:row?.name || email };
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(row!.rank).all<{permissionKey:string;allowed:number}>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(row!.id).all<{permissionKey:string;effect:"allow"|"deny"}>(),
  ]);
  const permissions = new Set(rankRows.results.length ? rankRows.results.filter((item) => item.allowed).map((item) => item.permissionKey) : defaultPermissionsForRank(row!.rank));
  for (const item of overrides.results) {
    if (item.effect === "allow") permissions.add(item.permissionKey);
    else permissions.delete(item.permissionKey);
  }
  return { allowed:permissions.has("field_preplans.view"), canEdit:permissions.has("field_preplans.edit"), canDelete:false, actor:row!.name };
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
    || process.env.GOOGLE_MAPS_BROWSER_KEY?.trim();
  return processKey || "";
}

export async function GET(request:Request) {
  try {
    const db = await ensureDatabase();
    const auth = await access(request, db);
    if (!auth.allowed) return Response.json({ error:"Field preplan access is required." }, { status:403 });
    const [plans, features, photos, imports] = await Promise.all([
      db.prepare("SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,COALESCE(footprint_square_feet,0) footprintSquareFeet,COALESCE(floor_count,1) floorCount,COALESCE(fire_flow_calculation_area,0) fireFlowCalculationArea,COALESCE(construction_type,'VB') constructionType,COALESCE(occupancy_flow_category,'other') occupancyFlowCategory,COALESCE(sprinkler_standard,'none') sprinklerStandard,COALESCE(suggested_fire_flow_gpm,0) suggestedFireFlowGpm,COALESCE(suggested_fire_flow_duration,0) suggestedFireFlowDuration,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,updated_by updatedBy,updated_at updatedAt FROM field_preplans ORDER BY updated_at DESC").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details FROM field_preplan_features ORDER BY created_at").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,business_name businessName,address,source_file sourceFile,source_row sourceRow,status,latitude,longitude,geocode_note geocodeNote,linked_preplan_id linkedPreplanId FROM field_preplan_imports ORDER BY business_name COLLATE NOCASE,address COLLATE NOCASE").all(),
    ]);
    return Response.json({
      canEdit:auth.canEdit,
      canDelete:auth.canDelete,
      preplans:plans.results.map((plan) => ({ ...plan, footprint:JSON.parse(String((plan as {footprint?:string}).footprint || "[]")), features:features.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id), photos:photos.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((photo) => ({ ...photo, url:`/api/field-preplans/photos/${(photo as {id:string}).id}` })) })),
      imports:imports.results,
    });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load preplans." }, { status:500 }); }
}

export async function POST(request:Request) {
  try {
    const db = await ensureDatabase();
    const auth = await access(request, db);
    const body = await request.json() as Record<string,unknown>;
    const action = text(body.action, 40);
    if (action === "deleteFeature") {
      if (!auth.canDelete) return Response.json({ error:"Administrator privileges are required to delete a mapped feature." }, { status:403 });
      const id = text(body.id, 80), preplanId = text(body.preplanId, 80), confirmation = text(body.confirmation, 20);
      if (!id || !preplanId || confirmation !== "DELETE") return Response.json({ error:"Confirm Delete is required before a mapped feature can be removed." }, { status:400 });
      const photos = await db.prepare("SELECT object_key objectKey FROM field_preplan_photos WHERE feature_id=? AND preplan_id=?").bind(id,preplanId).all<{objectKey:string}>();
      const removed = await db.prepare("WITH deleted_photos AS (DELETE FROM field_preplan_photos WHERE feature_id=? AND preplan_id=?) DELETE FROM field_preplan_features WHERE id=? AND preplan_id=? RETURNING id").bind(id,preplanId,id,preplanId).all<{id:string}>();
      if (!removed.results.length) return Response.json({ error:"Mapped feature not found." }, { status:404 });
      const storage = getPortalStorage() as Bucket | null;
      const cleanup = storage ? await Promise.allSettled(photos.results.map((photo) => storage.delete(photo.objectKey))) : [];
      return Response.json({ ok:true, id, photoCleanupPending:cleanup.some((result) => result.status === "rejected") });
    }
    if (action === "deletePreplan") {
      if (!auth.canDelete) return Response.json({ error:"Administrator privileges are required to delete a preplan." }, { status:403 });
      const id = text(body.id, 80), confirmation = text(body.confirmation, 20);
      if (!id || confirmation !== "DELETE") return Response.json({ error:"Confirm Delete is required before a preplan can be removed." }, { status:400 });
      const photos = await db.prepare("SELECT object_key objectKey FROM field_preplan_photos WHERE preplan_id=?").bind(id).all<{objectKey:string}>();
      const removed = await db.prepare("WITH unlinked_imports AS (UPDATE field_preplan_imports SET linked_preplan_id=NULL,status=CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'geocoded' ELSE 'location_required' END,updated_at=CURRENT_TIMESTAMP WHERE linked_preplan_id=?), deleted_photos AS (DELETE FROM field_preplan_photos WHERE preplan_id=?), deleted_features AS (DELETE FROM field_preplan_features WHERE preplan_id=?) DELETE FROM field_preplans WHERE id=? RETURNING id").bind(id,id,id,id).all<{id:string}>();
      if (!removed.results.length) return Response.json({ error:"Preplan not found." }, { status:404 });
      const storage = getPortalStorage() as Bucket | null;
      const cleanup = storage ? await Promise.allSettled(photos.results.map((photo) => storage.delete(photo.objectKey))) : [];
      return Response.json({ ok:true, id, photoCleanupPending:cleanup.some((result) => result.status === "rejected") });
    }
    if (!auth.canEdit) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
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
    return Response.json({ error:"Unsupported preplan action." }, { status:400 });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to save preplan." }, { status:500 }); }
}
