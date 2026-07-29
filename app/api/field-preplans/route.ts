import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank } from "../../permissions";

type Point = { lat:number; lng:number };
type Db = Awaited<ReturnType<typeof ensureDatabase>>;
const ownerAdminEmails = ["bobff353@gmail.com"];
const featureTypes = new Set(["alarm","knox","riser","fdc","sprinkler","gas","water","electric","propane","elevator","elevator_room","standpipe","access","hazard"]);

async function access(request:Request, db:Db) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const row = email ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;isAdmin:number}>() : null;
  const admin = ownerAdminEmails.includes(email) || Boolean(row?.isAdmin);
  if (!row && !admin) return { allowed:false, canEdit:false, actor:"" };
  if (admin) return { allowed:true, canEdit:true, actor:row?.name || email };
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(row!.rank).all<{permissionKey:string;allowed:number}>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(row!.id).all<{permissionKey:string;effect:"allow"|"deny"}>(),
  ]);
  const permissions = new Set(rankRows.results.length ? rankRows.results.filter((item) => item.allowed).map((item) => item.permissionKey) : defaultPermissionsForRank(row!.rank));
  for (const item of overrides.results) item.effect === "allow" ? permissions.add(item.permissionKey) : permissions.delete(item.permissionKey);
  return { allowed:permissions.has("field_preplans.view"), canEdit:permissions.has("field_preplans.edit"), actor:row!.name };
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

export async function GET(request:Request) {
  try {
    const db = await ensureDatabase();
    const auth = await access(request, db);
    if (!auth.allowed) return Response.json({ error:"Field preplan access is required." }, { status:403 });
    const [plans, features, photos] = await Promise.all([
      db.prepare("SELECT id,business_name businessName,address,latitude,longitude,a_side_latitude aSideLatitude,a_side_longitude aSideLongitude,footprint,contact_info contactInfo,construction,access_info accessInfo,alarm_system alarmSystem,knox_box knoxBox,riser,fdc,sprinkler_system sprinklerSystem,status,updated_by updatedBy,updated_at updatedAt FROM field_preplans ORDER BY updated_at DESC").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_type featureType,label,latitude,longitude,system_type systemType,service_status serviceStatus,details FROM field_preplan_features ORDER BY created_at").all(),
      db.prepare("SELECT id,preplan_id preplanId,feature_id featureId,side,filename,caption,created_at createdAt FROM field_preplan_photos ORDER BY created_at DESC").all(),
    ]);
    return Response.json({
      canEdit:auth.canEdit,
      preplans:plans.results.map((plan) => ({ ...plan, footprint:JSON.parse(String((plan as {footprint?:string}).footprint || "[]")), features:features.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id), photos:photos.results.filter((item) => (item as {preplanId:string}).preplanId === (plan as {id:string}).id).map((photo) => ({ ...photo, url:`/api/field-preplans/photos/${(photo as {id:string}).id}` })) })),
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
    if (action === "savePreplan") {
      const id = text(body.id, 80) || crypto.randomUUID();
      const businessName = text(body.businessName, 180), address = text(body.address, 240);
      const location = point(body.location), aSide = point(body.aSide), corners = footprint(body.footprint);
      if (!businessName || !location || corners.length < 3) return Response.json({ error:"Business name, map location, and at least three footprint corners are required." }, { status:400 });
      const values = [businessName,address,location.lat,location.lng,aSide?.lat ?? null,aSide?.lng ?? null,JSON.stringify(corners),text(body.contactInfo),text(body.construction),text(body.accessInfo),text(body.alarmSystem),text(body.knoxBox),text(body.riser),text(body.fdc),text(body.sprinklerSystem),text(body.status,40) || "Quick Preplan",auth.actor];
      await db.prepare("INSERT INTO field_preplans(id,business_name,address,latitude,longitude,a_side_latitude,a_side_longitude,footprint,contact_info,construction,access_info,alarm_system,knox_box,riser,fdc,sprinkler_system,status,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,a_side_latitude=excluded.a_side_latitude,a_side_longitude=excluded.a_side_longitude,footprint=excluded.footprint,contact_info=excluded.contact_info,construction=excluded.construction,access_info=excluded.access_info,alarm_system=excluded.alarm_system,knox_box=excluded.knox_box,riser=excluded.riser,fdc=excluded.fdc,sprinkler_system=excluded.sprinkler_system,status=excluded.status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
        .bind(id,...values,auth.actor).run();
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
