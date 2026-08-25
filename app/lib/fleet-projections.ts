import type { SupabaseClient } from "@supabase/supabase-js";

export type FleetDutyCheck = {
  apparatusId: string;
  unit: string;
  status: "pending" | "in_progress" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  checkType: "daily" | "weekly" | "inventory" | "air_pack";
  startTime: string;
  endTime: string;
};

export type FleetDailyCheck = {
  apparatusId: string;
  unit: string;
  status: "pending" | "in_progress";
  startedAt: string | null;
  checkType: "daily" | "weekly" | "inventory" | "air_pack";
  startTime: string;
  endTime: string;
};

export type RequiredFleetCheck = FleetDailyCheck & {
  checkType: "daily" | "weekly" | "inventory" | "air_pack";
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

export function chicagoWeekForDate(date: string) {
  const anchor = new Date(`${date}T12:00:00Z`);
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  return {
    start: addUtcDays(date, -mondayOffset),
    end: addUtcDays(date, 7 - mondayOffset),
  };
}

export function currentChicagoWeek() {
  return chicagoWeekForDate(chicagoCalendarDate(new Date()));
}

export function dailyFleetCheckUrgency(minutes: number) {
  if (minutes < 6 * 60) return "scheduled" as const;
  if (minutes < 7 * 60) return "due_soon" as const;
  return "overdue" as const;
}

function scheduledCheckCompleted(check: { status?: unknown; completed_at?: unknown; review_status?: unknown }, checkType: string, date: string) {
  if (check.status !== "completed" || !check.completed_at || check.review_status === "changes_requested") return false;
  const completedDate = chicagoCalendarDate(String(check.completed_at));
  if (checkType !== "weekly") return completedDate === date;
  const week = chicagoWeekForDate(date);
  return completedDate >= week.start && completedDate < week.end;
}

export async function weeklyDutyCheckMap(
  supabase: SupabaseClient,
  departmentId: string,
  duties: Array<{ id?: unknown; dayOfWeek?: unknown }>,
  date = chicagoCalendarDate(new Date()),
) {
  const result = new Map<string, FleetDutyCheck[]>();
  if (!departmentId) return result;

  const [{ data: schedules, error: scheduleError }, { data: apparatus, error: apparatusError }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from("inventory_inspection_schedules")
      .select("apparatus_id,check_type,day_of_week,start_time,end_time")
      .eq("department_id", departmentId)
      .eq("active", true)
      .eq("feeds_daily_duties", true),
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId),
    supabase
      .from("inventory_checks")
      .select("id,apparatus_id,check_type,status,started_at,completed_at,review_status")
      .eq("department_id", departmentId)
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(1000),
  ]);
  if (scheduleError || apparatusError || checksError) throw scheduleError || apparatusError || checksError;

  for (const duty of duties) {
    const dutyId = String(duty.id || "");
    const dueDay = Number(duty.dayOfWeek);
    const links = (schedules || []).filter((schedule) => Number(schedule.day_of_week) === dueDay).flatMap((schedule) => {
      const vehicle = (apparatus || []).find((item) => item.id === schedule.apparatus_id);
      if (!vehicle) return [];
      const unit = String(vehicle.name || "Apparatus");
      const checkType = String(schedule.check_type) as FleetDutyCheck["checkType"];
      const vehicleChecks = (checks || []).filter((check) => check.apparatus_id === vehicle.id && check.check_type === checkType);
      const completed = vehicleChecks.find((check) => scheduledCheckCompleted(check, checkType, date));
      const inProgress = vehicleChecks.find((check) => check.status === "in_progress");
      const active = completed || inProgress;
      return [{
        apparatusId: String(vehicle.id),
        unit,
        checkType,
        startTime: String(schedule.start_time).slice(0, 5),
        endTime: String(schedule.end_time).slice(0, 5),
        status: completed ? "completed" as const : inProgress ? "in_progress" as const : "pending" as const,
        startedAt: active?.started_at ? String(active.started_at) : null,
        completedAt: completed?.completed_at ? String(completed.completed_at) : null,
      }];
    }).sort((left, right) => left.unit.localeCompare(right.unit, undefined, { numeric: true }));
    result.set(dutyId, links);
  }
  return result;
}

export async function pendingDailyFleetChecks(
  supabase: SupabaseClient,
  departmentId: string,
  date = chicagoCalendarDate(new Date()),
): Promise<FleetDailyCheck[]> {
  if (!departmentId) return [];
  const dueDay = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [{ data: schedules, error: scheduleError }, { data: apparatus, error: apparatusError }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from("inventory_inspection_schedules")
      .select("apparatus_id,check_type,start_time,end_time")
      .eq("department_id", departmentId)
      .eq("day_of_week", dueDay)
      .eq("active", true)
      .eq("feeds_operations_board", true),
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId),
    supabase
      .from("inventory_checks")
      .select("id,apparatus_id,check_type,status,started_at,completed_at,review_status")
      .eq("department_id", departmentId)
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(1000),
  ]);
  if (scheduleError || apparatusError || checksError) throw scheduleError || apparatusError || checksError;

  return (schedules || []).flatMap((schedule) => {
    const vehicle = (apparatus || []).find((item) => item.id === schedule.apparatus_id);
    if (!vehicle) return [];
    const apparatusId = String(vehicle.id);
    const checkType = String(schedule.check_type) as FleetDailyCheck["checkType"];
    const vehicleChecks = (checks || []).filter((check) => check.apparatus_id === vehicle.id && check.check_type === checkType);
    if (vehicleChecks.some((check) => scheduledCheckCompleted(check, checkType, date))) return [];
    const inProgress = vehicleChecks.find((check) => check.status === "in_progress");
    return [{
      apparatusId,
      unit: String(vehicle.name || "Apparatus"),
      checkType,
      startTime: String(schedule.start_time).slice(0, 5),
      endTime: String(schedule.end_time).slice(0, 5),
      status: inProgress ? "in_progress" as const : "pending" as const,
      startedAt: inProgress?.started_at ? String(inProgress.started_at) : null,
    }];
  }).sort((left, right) => `${left.startTime} ${left.unit} ${left.checkType}`.localeCompare(`${right.startTime} ${right.unit} ${right.checkType}`, undefined, { numeric: true }));
}

export async function incompleteRequiredFleetChecks(
  supabase: SupabaseClient,
  departmentId: string,
  date: string,
): Promise<RequiredFleetCheck[]> {
  const dueDay = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [{ data: schedules, error: scheduleError }, { data: apparatus, error: apparatusError }, { data: checks, error: checksError }] = await Promise.all([
    supabase
      .from("inventory_inspection_schedules")
      .select("apparatus_id,check_type,start_time,end_time")
      .eq("department_id", departmentId)
      .eq("day_of_week", dueDay)
      .eq("active", true)
      .eq("require_officer_signoff", true),
    supabase
      .from("inventory_apparatus_profiles")
      .select("id,name")
      .eq("department_id", departmentId),
    supabase
      .from("inventory_checks")
      .select("id,apparatus_id,check_type,status,started_at,completed_at,review_status")
      .eq("department_id", departmentId)
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(1000),
  ]);
  if (scheduleError || apparatusError || checksError) throw scheduleError || apparatusError || checksError;
  return (schedules || []).flatMap((schedule) => {
    const vehicle = (apparatus || []).find((item) => item.id === schedule.apparatus_id);
    if (!vehicle) return [];
    const checkType = String(schedule.check_type) as RequiredFleetCheck["checkType"];
    const vehicleChecks = (checks || []).filter((check) => check.apparatus_id === vehicle.id && check.check_type === checkType);
    if (vehicleChecks.some((check) => scheduledCheckCompleted(check, checkType, date))) return [];
    const inProgress = vehicleChecks.find((check) => check.status === "in_progress");
    return [{
      apparatusId: String(vehicle.id),
      unit: String(vehicle.name || "Apparatus"),
      checkType,
      startTime: String(schedule.start_time).slice(0, 5),
      endTime: String(schedule.end_time).slice(0, 5),
      status: inProgress ? "in_progress" as const : "pending" as const,
      startedAt: inProgress?.started_at ? String(inProgress.started_at) : null,
    }];
  });
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
