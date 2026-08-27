import { randomUUID } from "node:crypto";
import { ensureDatabase } from "../../../db/bootstrap";
import { sameOriginInventoryRequest } from "../../lib/inventory-session";
import { hasPermission } from "../../server-permissions";

type Point = { lat: number; lng: number };
type ClosureRow = {
  id: string; roadName: string; reason: string; pathJson: string;
  detourLatitude: number; detourLongitude: number; status: "active" | "cleared";
  startedAt: string; expectedClearAt: string | null; createdBy: string;
  clearedBy: string | null; clearedAt: string | null; clearNote: string;
};

function point(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const lat = Number(candidate.lat), lng = Number(candidate.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function serialize(row: ClosureRow) {
  let path: Point[] = [];
  try { path = (JSON.parse(row.pathJson) as unknown[]).map(point).filter((item): item is Point => Boolean(item)); } catch { path = []; }
  return { ...row, path, detourPoint: { lat: Number(row.detourLatitude), lng: Number(row.detourLongitude) }, pathJson: undefined };
}

async function closureRows(db: Awaited<ReturnType<typeof ensureDatabase>>) {
  return db.prepare("SELECT id, road_name roadName, reason, path_json pathJson, detour_latitude detourLatitude, detour_longitude detourLongitude, status, started_at startedAt, expected_clear_at expectedClearAt, created_by createdBy, cleared_by clearedBy, cleared_at clearedAt, clear_note clearNote FROM road_closures ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, datetime(started_at) DESC LIMIT 100").all<ClosureRow>();
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "operations_board.view")) return Response.json({ error: "Live Operations access is required." }, { status: 403 });
    const [rows, canManage] = await Promise.all([closureRows(db), hasPermission(request, db, "incident_command.manage")]);
    return Response.json({ closures: rows.results.map(serialize), canManage }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load road closures" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOriginInventoryRequest(request)) return Response.json({ error: "This request must come from the department portal." }, { status: 403 });
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "incident_command.manage")) return Response.json({ error: "Incident command permission is required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Department administrator";
    if (body.action === "locate") {
      const address = String(body.address || "").trim().slice(0, 240);
      const apiKey = process.env.GOOGLE_MAPS_GEOCODING_KEY?.trim() || process.env.GOOGLE_MAPS_STREET_VIEW_KEY?.trim() || process.env.GOOGLE_MAPS_BROWSER_KEY?.trim();
      if (!address) return Response.json({ error: "Enter a street, intersection, or address." }, { status: 400 });
      if (!apiKey) return Response.json({ error: "Google address lookup is not configured." }, { status: 503 });
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", /,\s*(IL|Illinois)\b/i.test(address) ? address : `${address}, Stickney, IL`);
      url.searchParams.set("components", "country:US");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json() as { status?:string;results?:Array<{formatted_address?:string;geometry?:{location?:Point}}> };
      const location = point(result.results?.[0]?.geometry?.location);
      if (!response.ok || result.status !== "OK" || !location || location.lat < 41 || location.lat > 42.5 || location.lng < -88.5 || location.lng > -87) {
        return Response.json({ error: "No nearby matching road or intersection was found." }, { status: 404 });
      }
      return Response.json({ location, formattedAddress: String(result.results?.[0]?.formatted_address || address).slice(0, 240) });
    }
    if (body.action === "clear") {
      const id = String(body.id || "").trim(), clearNote = String(body.clearNote || "").trim().slice(0, 500);
      if (!id) return Response.json({ error: "Choose a road closure to reopen." }, { status: 400 });
      await db.prepare("UPDATE road_closures SET status='cleared', cleared_by=?, cleared_at=CURRENT_TIMESTAMP, clear_note=?, updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(actor, clearNote, actor, id).run();
    } else {
      const roadName = String(body.roadName || "").trim().slice(0, 120);
      const reason = String(body.reason || "").trim().slice(0, 500);
      const path = Array.isArray(body.path) ? body.path.map(point).filter((item): item is Point => Boolean(item)).slice(0, 80) : [];
      const detourPoint = point(body.detourPoint);
      const expectedClearAt = String(body.expectedClearAt || "").trim();
      if (!roadName) return Response.json({ error: "Enter the road name." }, { status: 400 });
      if (path.length < 2) return Response.json({ error: "Trace at least two points along the closed road." }, { status: 400 });
      if (!detourPoint) return Response.json({ error: "Select a safe bypass point for responding crews." }, { status: 400 });
      if (expectedClearAt && !Number.isFinite(Date.parse(expectedClearAt))) return Response.json({ error: "Enter a valid expected reopening time." }, { status: 400 });
      await db.prepare("INSERT INTO road_closures (id,road_name,reason,path_json,detour_latitude,detour_longitude,status,started_at,expected_clear_at,created_by,updated_by) VALUES (?,?,?,?,?,?,'active',CURRENT_TIMESTAMP,?,?,?)")
        .bind(randomUUID(), roadName, reason, JSON.stringify(path), detourPoint.lat, detourPoint.lng, expectedClearAt || null, actor, actor).run();
    }
    const rows = await closureRows(db);
    return Response.json({ ok: true, closures: rows.results.map(serialize) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update road closures" }, { status: 500 });
  }
}
