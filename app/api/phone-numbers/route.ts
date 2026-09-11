import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";

const categories = ["fire", "hospital", "misc"];

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const rows = await db.prepare("SELECT id, category, name, emergency_number AS emergencyNumber, non_emergency_number AS nonEmergencyNumber, notes, sort_order AS sortOrder FROM important_phone_numbers ORDER BY CASE category WHEN 'fire' THEN 1 WHEN 'hospital' THEN 2 ELSE 3 END, sort_order, name").all();
    return Response.json({ numbers: rows.results, canEdit: await hasPermission(request, db, "settings.manage") });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load phone numbers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "settings.manage")) return Response.json({ error: "Department settings permission is required." }, { status: 403 });
    if (!await hasPermission(request, db, "settings.manage")) return Response.json({ error: "Department settings permission is required to edit this directory." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "save");
    if (action === "delete") {
      await db.prepare("DELETE FROM important_phone_numbers WHERE id = ?").bind(String(body.id ?? "")).run();
      return Response.json({ ok: true });
    }
    const id = String(body.id || crypto.randomUUID());
    const category = String(body.category ?? "misc");
    const name = String(body.name ?? "").trim();
    if (!categories.includes(category) || !name) return Response.json({ error: "A contact name and section are required." }, { status: 400 });
    await db.prepare("INSERT INTO important_phone_numbers (id, category, name, emergency_number, non_emergency_number, notes, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET category = excluded.category, name = excluded.name, emergency_number = excluded.emergency_number, non_emergency_number = excluded.non_emergency_number, notes = excluded.notes, sort_order = excluded.sort_order, updated_at = CURRENT_TIMESTAMP").bind(id, category, name, String(body.emergencyNumber ?? "").trim(), String(body.nonEmergencyNumber ?? "").trim(), String(body.notes ?? "").trim(), Number(body.sortOrder ?? 0)).run();
    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save phone number" }, { status: 500 });
  }
}
