import { createInventorySupabaseClient } from "../../lib/supabase-server";
import { verifyInventoryRequest } from "../../lib/inventory-session";
import { fetchUpstream } from "../../lib/upstream-portal";

type DashboardPayload = {
  equipmentIssues?: Array<{ item: string; status: string; detail?: string }>;
  [key: string]: unknown;
};

function title(value: unknown) {
  return String(value || "Issue").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request: Request) {
  const upstream = await fetchUpstream(request, "/api/dashboard");
  if (!upstream.ok) {
    return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
  }
  const payload = await upstream.json() as DashboardPayload;
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return Response.json(payload, { headers: { "Cache-Control": "private, no-store" } });

  try {
    const supabase = await createInventorySupabaseClient();
    const departmentId = session.context.department.id;
    const [exceptionsResult, apparatusResult, equipmentResult] = await Promise.all([
      supabase
        .from("inventory_readiness_exceptions")
        .select("id,apparatus_id,equipment_id,result,notes,issue_categories,assigned_employee_names")
        .eq("department_id", departmentId)
        .neq("status", "resolved")
        .order("opened_at", { ascending: false }),
      supabase
        .from("inventory_apparatus_profiles")
        .select("id,name")
        .eq("department_id", departmentId),
      supabase
        .from("inventory_equipment")
        .select("id,name")
        .eq("department_id", departmentId),
    ]);
    if (exceptionsResult.error || apparatusResult.error || equipmentResult.error) {
      throw exceptionsResult.error || apparatusResult.error || equipmentResult.error;
    }
    const apparatus = new Map((apparatusResult.data || []).map((item) => [item.id, item.name]));
    const equipment = new Map((equipmentResult.data || []).map((item) => [item.id, item.name]));
    const fleetIssues = (exceptionsResult.data || []).map((item) => {
      const unit = apparatus.get(item.apparatus_id) || "Apparatus";
      const equipmentName = item.equipment_id ? equipment.get(item.equipment_id) : null;
      const categories = Array.isArray(item.issue_categories)
        ? item.issue_categories.map(title).join(" / ")
        : "Equipment";
      const assignees = Array.isArray(item.assigned_employee_names) && item.assigned_employee_names.length
        ? ` Assigned: ${item.assigned_employee_names.join(", ")}.`
        : "";
      return {
        item: `${unit} - ${equipmentName || categories}`,
        status: title(item.result),
        detail: `${item.notes || "Repair required."}${assignees}`,
      };
    });
    const combined = [...(payload.equipmentIssues || []), ...fleetIssues];
    payload.equipmentIssues = combined.filter((item, index) => (
      combined.findIndex((candidate) => candidate.item === item.item && candidate.detail === item.detail) === index
    ));
  } catch {
    // The upstream dashboard remains available if Inventory is temporarily unavailable.
  }
  return Response.json(payload, {
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
