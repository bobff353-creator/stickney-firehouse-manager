import { createInventorySupabaseClient } from "../../lib/supabase-server";
import { sessionFailureResponse, verifyInventoryRequest } from "../../lib/inventory-session";
import { ensureDatabase } from "../../../db/bootstrap";

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  const portalDb = await ensureDatabase();
  const profile = await portalDb.prepare(
    "SELECT employee_id AS employeeId FROM employee_profiles WHERE lower(email) = ? LIMIT 1",
  ).bind(session.context.user.email).first<{ employeeId: string }>();
  const employeeId = profile?.employeeId || "";
  if (!employeeId) return Response.json({ notices: [] });

  const supabase = await createInventorySupabaseClient();
  const departmentId = session.context.department.id;
  const [exceptionsResult, apparatusResult, equipmentResult] = await Promise.all([
    supabase
      .from("inventory_readiness_exceptions")
      .select("id,apparatus_id,equipment_id,result,priority,notes,opened_at,issue_categories,assigned_employee_names,evidence_photo_id")
      .eq("department_id", departmentId)
      .neq("status", "resolved")
      .contains("assigned_employee_ids", [employeeId])
      .order("opened_at", { ascending: false }),
    supabase.from("inventory_apparatus_profiles").select("id,name").eq("department_id", departmentId),
    supabase.from("inventory_equipment").select("id,name").eq("department_id", departmentId),
  ]);
  if (exceptionsResult.error || apparatusResult.error || equipmentResult.error) {
    return Response.json({ error: "Assigned fleet notices are unavailable." }, { status: 503 });
  }
  const apparatus = new Map((apparatusResult.data || []).map((item) => [item.id, item.name]));
  const equipment = new Map((equipmentResult.data || []).map((item) => [item.id, item.name]));
  return Response.json({
    notices: (exceptionsResult.data || []).map((item) => ({
      ...item,
      apparatusName: apparatus.get(item.apparatus_id) || "Apparatus",
      equipmentName: item.equipment_id ? equipment.get(item.equipment_id) || "Equipment" : "",
      photoUrl: item.evidence_photo_id ? `/api/operations/evidence/${item.evidence_photo_id}` : "",
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}
