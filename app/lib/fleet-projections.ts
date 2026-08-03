import type { SupabaseClient } from "@supabase/supabase-js";

export type FleetDutyCheck = {
  apparatusId: string;
  unit: string;
  status: "pending" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
};

export type FleetDailyCheck = {
  apparatusId: string;
  unit: string;
  status: "pending" | "in_progress";
  startedAt: string | null;
};

export type DailyLogApparatusCheck = {
  id: string;
  apparatusId: string;
  unit: string;
  checkType: string;
  completedAt: string;
  completedBy: string;
  failedItems: number;
};

export type FleetEquipmentIssue = {
  id: string;
  item: string;
  status: string;
  detail: string;
};

const chicagoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function chicagoCalendarDate(input: string | number | Date) {
  return chicagoDateFormatter.format(new Date(input));
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function currentChicagoWeek() {
  const today = chicagoCalendarDate(new Date());
  const anchor = new Date(`${today}T12:00:00Z`);
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  return {
    start: addUtcDays(today, -mondayOffset),
    end: addUtcDays(today, 7 - mondayOffset),
  };
}

export function dailyFleetCheckUrgency(minutes: number) {
  if (minutes < 6 * 60) return "scheduled" as const;
  if (minutes < 7 * 60) return "due_soon" as const;
  return "overdue" as const;
}

function unitsInDuty(duty: string) {
  return [...new Set(duty.match(/\b\d{4}\b/g) || [])];
}

export async function weeklyDutyCheckMap(
  supabase: SupabaseClient,
  departmentId: string,
  duties: Array<{ id?: unknown; duty?: unknown }>,
) {
  const requestedUnits = new Set(
    duties.flatMap((duty) => unitsInDuty(String(duty.duty || ""))),
  );
  const result = new Map<string, FleetDutyCheck[]>();
  if (!departmentId || requestedUnits.size === 0) return result;

  const [{ data: apparatus, error: apparatusError }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId),
    supabase
      .from("inventory_checks")
      .select("id,apparatus_id,status,started_at,completed_at")
      .eq("department_id", departmentId)
      .eq("check_type", "weekly")
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(500),
  ]);
  if (apparatusError || checksError) throw apparatusError || checksError;

  const week = currentChicagoWeek();
  for (const duty of duties) {
    const dutyId = String(duty.id || "");
    const links = unitsInDuty(String(duty.duty || "")).flatMap((unit) => {
      const vehicle = (apparatus || []).find((item) => String(item.name).trim() === unit);
      if (!vehicle) return [];
      const vehicleChecks = (checks || []).filter((check) => check.apparatus_id === vehicle.id);
      const completed = vehicleChecks.find((check) => (
        check.status === "completed"
        && check.completed_at
        && chicagoCalendarDate(check.completed_at) >= week.start
        && chicagoCalendarDate(check.completed_at) < week.end
      ));
      const inProgress = vehicleChecks.find((check) => check.status === "in_progress");
      const active = completed || inProgress;
      return [{
        apparatusId: String(vehicle.id),
        unit,
        status: completed ? "completed" as const : inProgress ? "in_progress" as const : "pending" as const,
        startedAt: active?.started_at ? String(active.started_at) : null,
        completedAt: completed?.completed_at ? String(completed.completed_at) : null,
      }];
    });
    result.set(dutyId, links);
  }
  return result;
}

export async function pendingDailyFleetChecks(
  supabase: SupabaseClient,
  departmentId: string,
): Promise<FleetDailyCheck[]> {
  if (!departmentId) return [];
  const [{ data: configuredItems, error: itemError }, { data: apparatus, error: apparatusError }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from("inventory_equipment")
      .select("apparatus_id")
      .eq("department_id", departmentId)
      .contains("check_types", ["daily"])
      .is("retired_at", null),
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId),
    supabase
      .from("inventory_checks")
      .select("id,apparatus_id,status,started_at,completed_at")
      .eq("department_id", departmentId)
      .eq("check_type", "daily")
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(500),
  ]);
  if (itemError || apparatusError || checksError) throw itemError || apparatusError || checksError;

  const configuredApparatusIds = new Set(
    (configuredItems || []).map((item) => String(item.apparatus_id || "")).filter(Boolean),
  );
  const today = chicagoCalendarDate(new Date());
  return (apparatus || []).flatMap((vehicle) => {
    const apparatusId = String(vehicle.id || "");
    if (!configuredApparatusIds.has(apparatusId)) return [];
    const vehicleChecks = (checks || []).filter((check) => check.apparatus_id === vehicle.id);
    const completedToday = vehicleChecks.some((check) => (
      check.status === "completed"
      && check.completed_at
      && chicagoCalendarDate(check.completed_at) === today
    ));
    if (completedToday) return [];
    const inProgress = vehicleChecks.find((check) => check.status === "in_progress");
    return [{
      apparatusId,
      unit: String(vehicle.name || "Apparatus"),
      status: inProgress ? "in_progress" as const : "pending" as const,
      startedAt: inProgress?.started_at ? String(inProgress.started_at) : null,
    }];
  }).sort((left, right) => left.unit.localeCompare(right.unit, undefined, { numeric: true }));
}

export async function completedApparatusChecksForDate(
  supabase: SupabaseClient,
  departmentId: string,
  date: string,
): Promise<DailyLogApparatusCheck[]> {
  if (!departmentId) return [];
  const broadEnd = addUtcDays(date, 2);
  const { data: checks, error } = await supabase
    .from("inventory_checks")
    .select("id,apparatus_id,check_type,started_by,completed_at")
    .eq("department_id", departmentId)
    .eq("status", "completed")
    .gte("completed_at", `${date}T00:00:00Z`)
    .lt("completed_at", `${broadEnd}T00:00:00Z`)
    .order("completed_at", { ascending: true });
  if (error) throw error;
  const datedChecks = (checks || []).filter((check) => (
    check.completed_at && chicagoCalendarDate(check.completed_at) === date
  ));
  if (!datedChecks.length) return [];

  const checkIds = datedChecks.map((check) => check.id);
  const apparatusIds = [...new Set(datedChecks.map((check) => check.apparatus_id))];
  const [{ data: apparatus, error: apparatusError }, { data: results, error: resultError }] = await Promise.all([
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId)
      .in("id", apparatusIds),
    supabase
      .from("inventory_check_items")
      .select("check_id,result")
      .eq("department_id", departmentId)
      .in("check_id", checkIds),
  ]);
  if (apparatusError || resultError) throw apparatusError || resultError;

  return datedChecks.map((check) => ({
    id: String(check.id),
    apparatusId: String(check.apparatus_id),
    unit: String((apparatus || []).find((item) => item.id === check.apparatus_id)?.name || "Apparatus"),
    checkType: String(check.check_type),
    completedAt: String(check.completed_at),
    completedBy: String(check.started_by || "Department member"),
    failedItems: (results || []).filter((item) => (
      item.check_id === check.id && ["failed", "missing", "damaged"].includes(String(item.result))
    )).length,
  }));
}

export async function openFleetEquipmentIssues(
  supabase: SupabaseClient,
  departmentId: string,
): Promise<FleetEquipmentIssue[]> {
  if (!departmentId) return [];
  const { data: exceptions, error } = await supabase
    .from("inventory_readiness_exceptions")
    .select("id,apparatus_id,equipment_id,result,priority,notes,status,opened_at")
    .eq("department_id", departmentId)
    .neq("status", "resolved")
    .order("opened_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!exceptions?.length) return [];

  const apparatusIds = [...new Set(exceptions.map((item) => item.apparatus_id).filter(Boolean))];
  const equipmentIds = [...new Set(exceptions.map((item) => item.equipment_id).filter(Boolean))];
  const [{ data: apparatus }, { data: equipment }] = await Promise.all([
    apparatusIds.length
      ? supabase.from("inventory_apparatus_profiles").select("id,name").eq("department_id", departmentId).in("id", apparatusIds)
      : Promise.resolve({ data: [] }),
    equipmentIds.length
      ? supabase.from("inventory_equipment").select("id,name").eq("department_id", departmentId).in("id", equipmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  return exceptions.map((issue) => {
    const unit = String((apparatus || []).find((item) => item.id === issue.apparatus_id)?.name || "Apparatus");
    const item = String((equipment || []).find((row) => row.id === issue.equipment_id)?.name || "Equipment issue");
    return {
      id: String(issue.id),
      item: `${unit} · ${item}`,
      status: `${String(issue.result || "Issue").replaceAll("_", " ")} · ${String(issue.priority || "medium")} priority`,
      detail: String(issue.notes || "No deficiency note entered."),
    };
  });
}
