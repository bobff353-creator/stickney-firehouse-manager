import { ensureDatabase } from "../../../db/bootstrap";
import { pendingDailyFleetChecks, weeklyDutyCheckMap, type FleetDailyCheck, type FleetDutyCheck } from "../../lib/fleet-projections";
import { createInventorySupabaseClient } from "../../lib/supabase-server";

const ownerAdminEmails = ["bobff353@gmail.com"];
const shifts = ["morning", "afternoon", "night"] as const;

async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const row = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
  return Boolean(row?.isAdmin);
}

function chicagoNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { day, shift: hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : "night" };
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const canEdit = await isAdmin(request, db);
    const rows = await db.prepare("SELECT id, day_of_week AS dayOfWeek, shift_key AS shiftKey, duty, updated_by AS updatedBy, updated_at AS updatedAt FROM daily_duties ORDER BY CASE day_of_week WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 WHEN 5 THEN 5 WHEN 6 THEN 6 ELSE 7 END, CASE shift_key WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 ELSE 3 END").all();
    const dutyRows = rows.results as Array<{ id: string; dayOfWeek: number; shiftKey: string; duty: string; updatedBy: string; updatedAt: string }>;
    let fleetChecks = new Map<string, FleetDutyCheck[]>();
    let dailyFleetChecks: FleetDailyCheck[] = [];
    const departmentId = request.headers.get("x-department-id")?.trim() || "";
    if (departmentId) {
      try {
        const supabase = await createInventorySupabaseClient();
        [fleetChecks, dailyFleetChecks] = await Promise.all([
          weeklyDutyCheckMap(supabase, departmentId, dutyRows),
          pendingDailyFleetChecks(supabase, departmentId),
        ]);
      } catch (error) {
        console.error("Daily Duties fleet projection failed", error);
      }
    }
    const items = dutyRows.map((row) => ({
      ...row,
      fleetChecks: fleetChecks.get(row.id) || [],
    }));
    const current = chicagoNow();
    const currentDuty = items.find((row) => Number(row.dayOfWeek) === current.day && row.shiftKey === current.shift) ?? null;
    return Response.json({ items, currentDuty, dailyFleetChecks, canEdit });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load daily duties" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await isAdmin(request, db)) return Response.json({ error: "Administrator approval is required to edit Daily Duties." }, { status: 403 });
    const body = await request.json() as { id?: string; dayOfWeek?: number; shiftKey?: string; duty?: string };
    const day = Number(body.dayOfWeek);
    const shift = String(body.shiftKey ?? "");
    const duty = String(body.duty ?? "").trim();
    if (!Number.isInteger(day) || day < 0 || day > 6 || !shifts.includes(shift as typeof shifts[number]) || !duty) return Response.json({ error: "Day, shift, and duty are required." }, { status: 400 });
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Administrator";
    const id = String(body.id || `duty-${day}-${shift}`);
    await db.prepare("INSERT INTO daily_duties (id, day_of_week, shift_key, duty, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(day_of_week, shift_key) DO UPDATE SET duty = excluded.duty, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(id, day, shift, duty, actor).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save daily duty" }, { status: 500 });
  }
}
