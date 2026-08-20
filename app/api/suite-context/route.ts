import { createInventorySupabaseClient } from "../../lib/supabase-server";
import {
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../lib/inventory-session";

export const dynamic = "force-dynamic";

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  try {
    const supabase = await createInventorySupabaseClient();
    const { data, error } = await supabase
      .from("department_apparatus")
      .select("id,unit_name,unit_type,call_sign,station,cad_unit_id,status,notes,updated_at")
      .eq("department_id", session.context.department.id)
      .order("unit_name");
    if (error) throw error;
    const apparatus = (data || []).map((unit) => ({
      ...unit,
      unitNumber: unit.unit_name || unit.call_sign || "",
      name: unit.unit_type || unit.call_sign || unit.unit_name || "",
      callSign: unit.call_sign || "",
    }));
    return privateJson({
      configured: true,
      department: session.context.department,
      apparatus,
      events: [],
    });
  } catch {
    return privateJson(
      { configured: false, error: "Department apparatus records are unavailable." },
      503,
    );
  }
}
