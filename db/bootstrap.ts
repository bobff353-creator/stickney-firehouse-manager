import policySeed from "./policy-seed.json";
import { stickneyBoxCards } from "./box-card-seed";
import regionalBoxCards from "./regional-box-card-seed.json";
import { formatEmployeeName } from "../app/employee-names";
import { normalizeMilitaryTime } from "../app/military-time";
import { dailyLogPayrollEntries, dailyLogPayrollTotals, type PayrollStaffingRow } from "../app/payroll-hours";
import { holidayForDate } from "../app/holidays";
import { polygonAreaSquareFeet, suggestedFireFlow, type ConstructionGroup, type OccupancyFlowCategory, type Point, type SprinklerStandard } from "../app/preplan-fire-flow";
import { importedBuildingSeeds, importedBuildingSource } from "../app/preplan-imported-buildings";
import { createPostgresD1Adapter } from "./postgres-adapter";
import { apparatus1203Compartments, apparatus1203Equipment, apparatus1203VehicleChecks } from "../app/inventory-1203-import";
import { apparatus1204Compartments, apparatus1204Equipment, apparatus1204VehicleChecks } from "../app/inventory-1204-import";

const payScales = [
  ["deputy-chief-1", "Chief — O'Dowd", 31, 46.5, 46.5, 1],
  ["deputy-chief-2", "Chief — Babinec", 27.22, 40.83, 40.83, 2],
  ["captain", "Captain", 26.5, 39.75, 39.75, 3],
  ["lieutenant", "Lieutenant", 24.86, 37.29, 37.29, 4],
  ["firefighter", "Firefighter", 22, 33, 33, 5],
  ["temp-firefighter", "Temp Firefighter", 20, 30, 30, 6],
] as const;

const employeeSeed = [
  ["aguilar-guilermo", "Aguilar, Guilermo", "firefighter"],
  ["aguinaga-hugo", "Aguinaga, Hugo", "firefighter"],
  ["alonzo-sam", "Alonzo, Sam", "lieutenant"],
  ["anderson-jacob", "Anderson, Jacob", "captain"],
  ["babinec-john", "Babinec, John", "deputy-chief-2"],
  ["boulden-jamal", "Boulden, Jamal", "firefighter"],
  ["brunslik-reid", "Brunslik, Reid", "firefighter"],
  ["chervinko-keith", "Chervinko, Keith", "captain"],
  ["collier-joshua", "Collier, Joshua", "firefighter"],
  ["corsini-mark", "Corsini, Mark", "firefighter"],
  ["czech-doug", "Czech, Doug", "firefighter"],
  ["delgatto-eric", "DelGatto, Eric", "firefighter"],
  ["diaz-anais", "Diaz, Anais", "firefighter"],
  ["durkop-christopher", "Durkop, Christopher", "firefighter"],
  ["eagle-deandre", "Eagle, Deandre", "firefighter"],
  ["espino-leonardo", "Espino, Leonardo", "firefighter"],
  ["focht-eric", "Focht, Eric", "firefighter"],
  ["focht-garrett", "Focht, Garrett", "firefighter"],
  ["iovino-dominic", "Iovino, Dominic", "lieutenant"],
  ["jarom-ethan", "Jarom, Ethan", "firefighter"],
  ["keane-matthew", "Keane, Matthew", "firefighter"],
  ["kummer-hunter", "Kummer, Hunter", "firefighter"],
  ["lewandowski-justin", "Lewandowski, Justin", "lieutenant"],
  ["lopez-joseph", "Lopez, Joseph", "firefighter"],
  ["lukas-colin", "Lukas, Colin", "firefighter"],
  ["maldonado-franklin", "Maldonado, Franklin", "firefighter"],
  ["mulford-kyle", "Mulford, Kyle", "firefighter"],
  ["odowd-jon", "O'Dowd, Jon", "deputy-chief-1"],
  ["ramey-bivian", "Ramey, Bivian", "firefighter"],
  ["raygoza-dainel", "Raygoza, Dainel", "temp-firefighter"],
  ["rodriguze-mark", "Rodriguze, Mark", "temp-firefighter"],
  ["solano-evan", "Solano, Evan", "firefighter"],
  ["sticha-will", "Sticha, Will", "lieutenant"],
  ["szafarczyk-anthony", "Szafarczyk, Anthony", "firefighter"],
  ["tarnowski-joshua", "Tarnowski, Joshua", "firefighter"],
  ["taylor-cherelle", "Taylor, Cherelle", "firefighter"],
  ["valdez-david", "Valdez, David", "temp-firefighter"],
  ["vuelvas-eduardo", "Vuelvas, Eduardo", "firefighter"],
  ["weber-michael", "Weber, Michael", "lieutenant"],
  ["white-danny", "White, Danny", "lieutenant"],
  ["williams-joshua", "Williams, Joshua", "firefighter"],
  ["wyant-robert", "Wyant, Robert", "lieutenant"],
  ["zolo-hrvoje", "Zolo, Hrvoje", "lieutenant"],
] as const;

let ready = false;
const runtimeBootstrapVersion = "stickney-runtime-bootstrap-2026-08-10-callback-rules-v2";
const callbackRulesJson = JSON.stringify({ weekend: { fridayStart: "18:00", sundayEnd: "18:00" }, holiday: true, callTypes: ["Auto accident", "Fire alarm", "Mutual aid", "Auto aid"], backToBackMinutes: 5, minimumHours: 2, roundingMinutes: 15, onDutyFlag: true, overlappingWindowFlag: true, deputyChiefOverride: true });

const policySeedVersion = "stickney-policy-library-2026-07-18";
const boxCardSeedVersion = "regional-box-cards-structured-2026-07-21-v2";
const employeeNameFormatVersion = "employee-names-last-first-2026-07-23";
const callTimeFormatVersion = "daily-log-call-times-military-2026-07-23";
const exactLogPayrollRangeVersion = "daily-log-payroll-2026-07-11-through-2026-07-25-v1";
const actingOfficerStraightStipendVersion = "acting-officer-straight-stipend-2026-07-26-v1";
const preplanFootprintMetricsVersion = "preplan-footprint-metrics-ifc2018-2026-07-29-v1";
const dailyDutySeed = [
  [1, "morning", "Weekly checks on 1201."],
  [1, "afternoon", "Deep clean bathrooms. Scrub floor in bathroom. Wash shower curtains. Clean shower stall."],
  [1, "night", "Sweep/remove debris under gear lockers. Wash apparatus floor."],
  [2, "morning", "Weekly checks on 1203."],
  [2, "afternoon", "Clean grill. Clean exterior patio and perimeter of firehouse of garbage/debris."],
  [2, "night", "Clean laundry room. Wash towels/linens. Clean hose tower, roll any hanging hose."],
  [3, "morning", "Weekly checks on 1205. Complete disinfection of all equipment and vehicle."],
  [3, "afternoon", "Clean all interior firehouse windows."],
  [3, "night", "Remove chairs and wipe down tables with disinfectant training room. Clean board."],
  [4, "morning", "Remove chairs and wipe down tables with disinfectant training room. Clean board. Weekly check on 1210."],
  [4, "afternoon", "Clean all exterior firehouse windows."],
  [4, "night", "Sweep/remove debris under gear lockers. Wash apparatus floor."],
  [5, "morning", "Weekly checks on 1204."],
  [5, "afternoon", "Clean kitchen and pantry. Empty grease trap. Mop floor. Clean out fridge and freezer."],
  [5, "night", "Straighten, disinfect, and mop weight room, second floor and stairwell."],
  [6, "morning", "Weekly checks on 1207. Complete disinfection of all equipment and vehicle."],
  [6, "afternoon", "Inventory and wash light tower. Start and run it on the 1st and 3rd Saturday of the month."],
  [6, "night", "Service cascade system."],
  [0, "morning", "Weekly checks on 1208, 1209, 1211."],
  [0, "afternoon", "Clean day room, including dusting, vacuuming, and disinfecting."],
  [0, "night", "Clean bunkroom. Wash mattress covers. Vacuum and disinfect."],
] as const;

async function normalizeEmployeeNames(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind("employee_name_format_version").first<{ value: string }>();
  if (marker?.value === employeeNameFormatVersion) return;
  const employees = await db.prepare("SELECT id, name FROM employees").all<{ id: string; name: string }>();
  const updates = employees.results
    .map((employee) => ({ ...employee, formatted: formatEmployeeName(employee.name) }))
    .filter((employee) => employee.formatted && employee.formatted !== employee.name)
    .map((employee) => db.prepare("UPDATE employees SET name = ? WHERE id = ?").bind(employee.formatted, employee.id));
  if (updates.length) await db.batch(updates);
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind("employee_name_format_version", employeeNameFormatVersion).run();
}

async function normalizeHistoricalCallTimes(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind("call_time_format_version").first<{ value: string }>();
  if (marker?.value === callTimeFormatVersion) return;
  const calls = await db.prepare("SELECT id, time_out AS timeOut, time_in AS timeIn FROM daily_log_calls").all<{ id: string; timeOut: string; timeIn: string }>();
  const updates = calls.results.flatMap((call) => {
    const timeOut = normalizeMilitaryTime(call.timeOut);
    const timeIn = normalizeMilitaryTime(call.timeIn);
    if (timeOut === null || timeIn === null || (timeOut === call.timeOut && timeIn === call.timeIn)) return [];
    return [db.prepare("UPDATE daily_log_calls SET time_out = ?, time_in = ? WHERE id = ?").bind(timeOut, timeIn, call.id)];
  });
  if (updates.length) await db.batch(updates);
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind("call_time_format_version", callTimeFormatVersion).run();
}

function historicalPayrollPeriod(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDate();
  if (day >= 26) {
    const start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
    parsed.setUTCMonth(parsed.getUTCMonth() + 1, 10);
    return { start, end: parsed.toISOString().slice(0, 10) };
  }
  if (day >= 11) {
    const start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-11`;
    parsed.setUTCDate(25);
    return { start, end: parsed.toISOString().slice(0, 10) };
  }
  parsed.setUTCMonth(parsed.getUTCMonth() - 1);
  const start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 10);
  return { start, end: parsed.toISOString().slice(0, 10) };
}

function datesInRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function reconcileExactLogPayrollRange(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const markerKey = "exact_daily_log_payroll_2026_07_11_2026_07_25";
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind(markerKey).first<{ value: string }>();
  if (marker?.value === exactLogPayrollRangeVersion) return;
  const dpwRows = await db.prepare("SELECT employee_id AS employeeId FROM employee_profiles WHERE is_dpw = 1").all<{ employeeId: string }>();
  const dpwEmployees = new Set(dpwRows.results.map((row) => row.employeeId));
  for (const logDate of datesInRange("2026-07-11", "2026-07-25")) {
    const staffing = await db.prepare("SELECT employee_id AS employeeId, time_in AS timeIn, time_out AS timeOut, shift_key AS shiftKey, acting_officer AS actingOfficer FROM daily_log_staffing WHERE log_date = ? AND employee_id IS NOT NULL").bind(logDate).all<PayrollStaffingRow>();
    const totals = dailyLogPayrollTotals(staffing.results, holidayForDate(logDate));
    const period = historicalPayrollPeriod(logDate);
    const writes = [
      db.prepare("INSERT OR IGNORE INTO pay_periods (start_date, end_date, status) VALUES (?, ?, 'draft')").bind(period.start, period.end),
      // Replace only Daily Log-derived categories. Explicit callback, drill,
      // and work-detail entries remain exactly as entered.
      db.prepare("DELETE FROM time_entries WHERE work_date = ? AND (category IN ('shift', 'holiday', 'actingOfficer', 'dailyLogDpw') OR (category = 'dpw' AND employee_id IN (SELECT employee_id FROM employee_profiles WHERE is_dpw = 1)))").bind(logDate),
    ];
    for (const entry of dailyLogPayrollEntries(totals, dpwEmployees)) {
      writes.push(db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), entry.employeeId, period.start, logDate, entry.category, entry.hours));
    }
    await db.batch(writes);
  }
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(markerKey, exactLogPayrollRangeVersion).run();
}

async function enforceActingOfficerStraightStipend(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const markerKey = "acting_officer_straight_stipend_version";
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind(markerKey).first<{ value: string }>();
  if (marker?.value === actingOfficerStraightStipendVersion) return;
  await db.batch([
    db.prepare("UPDATE payroll_settings SET acting_officer_premium = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1"),
    db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(markerKey, actingOfficerStraightStipendVersion),
  ]);
}

async function backfillPreplanFootprintMetrics(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const markerKey = "preplan_footprint_metrics_version";
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind(markerKey).first<{ value: string }>();
  if (marker?.value === preplanFootprintMetricsVersion) return;
  const rows = await db.prepare("SELECT id,footprint,floor_count floorCount,construction_type constructionType,occupancy_flow_category occupancyFlowCategory,sprinkler_standard sprinklerStandard FROM field_preplans").all<{ id:string;footprint:string;floorCount:number;constructionType:ConstructionGroup;occupancyFlowCategory:OccupancyFlowCategory;sprinklerStandard:SprinklerStandard }>();
  const writes = rows.results.flatMap((row) => {
    try {
      const points = JSON.parse(row.footprint || "[]") as Point[];
      const footprintSquareFeet = Math.round(polygonAreaSquareFeet(points));
      const recommendation = suggestedFireFlow({ footprintSquareFeet, floorCount:row.floorCount || 1, constructionType:row.constructionType || "VB", occupancyFlowCategory:row.occupancyFlowCategory || "other", sprinklerStandard:row.sprinklerStandard || "none" });
      return [db.prepare("UPDATE field_preplans SET footprint_square_feet=?,fire_flow_calculation_area=?,suggested_fire_flow_gpm=?,suggested_fire_flow_duration=? WHERE id=?").bind(footprintSquareFeet,recommendation?.calculationArea ?? 0,recommendation?.suggestedGpm ?? 0,recommendation?.durationHours ?? 0,row.id)];
    } catch {
      return [];
    }
  });
  if (writes.length) await db.batch(writes);
  await db.prepare("INSERT INTO system_meta (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(markerKey,preplanFootprintMetricsVersion).run();
}

async function seedPolicies(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind("policy_seed_version").first<{ value: string }>();
  if (marker?.value === policySeedVersion) return;

  for (let index = 0; index < policySeed.length; index += 20) {
    const chunk = policySeed.slice(index, index + 20);
    await db.batch(chunk.map((policy) => db.prepare(
      "INSERT INTO policies (id, title, policy_number, category, effective_date, body, status, created_by, created_at, updated_by, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'Active', 'Policy PDF import', CURRENT_TIMESTAMP, 'Policy PDF import', CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM policies WHERE policy_number = ?)"
    ).bind(policy.id, policy.title, policy.policyNumber, policy.category, policy.effectiveDate, policy.body, policy.policyNumber)));
  }

  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind("policy_seed_version", policySeedVersion).run();
}

async function seedBoxCards(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind("box_card_seed_version").first<{ value: string }>();
  if (marker?.value === boxCardSeedVersion) return;
  const boxCards = [
    ...stickneyBoxCards.map((card) => ({ ...card, department: "Stickney", documentUrl: "/stickney-box-cards.pdf" })),
    ...regionalBoxCards,
  ];
  for (let index = 0; index < boxCards.length; index += 20) {
    const chunk = boxCards.slice(index, index + 20);
    await db.batch(chunk.map((card) => db.prepare(
      "INSERT INTO box_cards (id, title, address, box_number, access_notes, details, department, document_url, document_page, effective_date, review_date, layout_data, status, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Box card PDF import', CURRENT_TIMESTAMP, 'Box card PDF import', CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, address = excluded.address, box_number = excluded.box_number, access_notes = CASE WHEN box_cards.access_notes = '' OR box_cards.access_notes LIKE 'Official MABAS Division 11 response card.%' THEN excluded.access_notes ELSE box_cards.access_notes END, department = excluded.department, document_url = excluded.document_url, document_page = excluded.document_page, effective_date = excluded.effective_date, review_date = excluded.review_date, layout_data = CASE WHEN box_cards.layout_data = '' THEN excluded.layout_data ELSE box_cards.layout_data END, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP"
    ).bind(card.id, card.title, card.address, card.boxNumber, card.accessNotes, "Structured from the attached approved MABAS Division 11 PDF. The original source remains attached below for verification.", card.department, card.documentUrl, card.documentPage, card.effectiveDate, card.reviewDate, JSON.stringify(card.layout))));
  }
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind("box_card_seed_version", boxCardSeedVersion).run();
}

async function importApproved1203WeeklyCheck(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const actor="1203 Weekly Check form import - submitted 2026-07-21";
  let apparatus=await db.prepare("SELECT id FROM fleet_apparatus WHERE unit_number='1203' COLLATE NOCASE LIMIT 1").first<{id:string}>();
  if(!apparatus){
    const id="fleet-1203-approved-form";
    await db.prepare("INSERT OR IGNORE INTO fleet_apparatus(id,unit_number,name,asset_type,status,notes,created_by,updated_by) VALUES(?, '1203', '1203', 'Apparatus', 'status_not_reported', 'Created from the approved 1203 Weekly Check form; complete Fleet details in Manage Apparatus.', ?, ?)").bind(id,actor,actor).run();
    apparatus=await db.prepare("SELECT id FROM fleet_apparatus WHERE unit_number='1203' COLLATE NOCASE LIMIT 1").first<{id:string}>();
  }
  if(!apparatus)return;
  for(let index=0;index<apparatus1203Compartments.length;index++){
    const label=apparatus1203Compartments[index],id=`1203-compartment-${index+1}`;
    await db.prepare("INSERT OR IGNORE INTO inventory_compartments(id,apparatus_id,label,side,details,sort_order,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)").bind(id,apparatus.id,label,label.toLowerCase().includes("officer")?"officer":label.toLowerCase().includes("driver")?"driver":label.toLowerCase().includes("rear")?"rear":"",`Imported from approved 1203 Weekly Check form.`,index,actor,actor).run();
  }
  for(let index=0;index<apparatus1203Equipment.length;index++){
    const item=apparatus1203Equipment[index],compartmentIndex=apparatus1203Compartments.indexOf(item.compartment as typeof apparatus1203Compartments[number]);
    if(compartmentIndex<0)continue;
    await db.prepare("INSERT OR IGNORE INTO inventory_equipment(id,apparatus_id,compartment_id,name,category,quantity,condition,service_status,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(`1203-equipment-${index+1}`,apparatus.id,`1203-compartment-${compartmentIndex+1}`,item.name,item.category||"Apparatus equipment",item.quantity||1,"not_recorded","requires_check","Imported from approved 1203 Weekly Check form; current presence and condition must be confirmed during the next check.",actor,actor).run();
  }
  await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_templates(id,apparatus_id,name,source,active,created_by) VALUES('1203-weekly-check',?,'1203 Weekly Apparatus Check','Stickney Members Only form 251 - submitted 2026-07-21',1,?)").bind(apparatus.id,actor).run();
  for(let index=0;index<apparatus1203VehicleChecks.length;index++)await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_items(id,template_id,equipment_id,label,section_name,sort_order) VALUES(?, '1203-weekly-check', NULL, ?, 'Vehicle / pump', ?)").bind(`1203-vehicle-check-${index+1}`,apparatus1203VehicleChecks[index],index).run();
  for(let index=0;index<apparatus1203Equipment.length;index++)await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_items(id,template_id,equipment_id,label,section_name,sort_order) VALUES(?, '1203-weekly-check', ?, ?, ?, ?)").bind(`1203-equipment-check-${index+1}`,`1203-equipment-${index+1}`,apparatus1203Equipment[index].name,apparatus1203Equipment[index].compartment,100+index).run();
}

async function importApproved1204WeeklyCheck(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const actor="1204 Weekly Check form import - submitted 2026-07-31";
  let apparatus=await db.prepare("SELECT id FROM fleet_apparatus WHERE unit_number='1204' COLLATE NOCASE LIMIT 1").first<{id:string}>();
  if(!apparatus){
    const id="fleet-1204-approved-form";
    await db.prepare("INSERT OR IGNORE INTO fleet_apparatus(id,unit_number,name,asset_type,status,notes,created_by,updated_by) VALUES(?, '1204', '1204', 'Apparatus', 'status_not_reported', 'Created from the approved 1204 Weekly Check form; complete Fleet details in Manage Apparatus.', ?, ?)").bind(id,actor,actor).run();
    apparatus=await db.prepare("SELECT id FROM fleet_apparatus WHERE unit_number='1204' COLLATE NOCASE LIMIT 1").first<{id:string}>();
  }
  if(!apparatus)return;
  for(let index=0;index<apparatus1204Compartments.length;index++){
    const label=apparatus1204Compartments[index],id=`1204-compartment-${index+1}`;
    await db.prepare("INSERT OR IGNORE INTO inventory_compartments(id,apparatus_id,label,side,details,sort_order,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)").bind(id,apparatus.id,label,label.toLowerCase().includes("rear")?"rear":"",`Imported from approved 1204 Weekly Check form.`,index,actor,actor).run();
  }
  for(let index=0;index<apparatus1204Equipment.length;index++){
    const item=apparatus1204Equipment[index],compartmentIndex=apparatus1204Compartments.indexOf(item.compartment as typeof apparatus1204Compartments[number]);if(compartmentIndex<0)continue;
    await db.prepare("INSERT OR IGNORE INTO inventory_equipment(id,apparatus_id,compartment_id,name,category,quantity,condition,service_status,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(`1204-equipment-${index+1}`,apparatus.id,`1204-compartment-${compartmentIndex+1}`,item.name,item.category||"Apparatus equipment",item.quantity||1,"not_recorded","requires_check","Imported from approved 1204 Weekly Check form; current presence and condition must be confirmed during the next check.",actor,actor).run();
  }
  await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_templates(id,apparatus_id,name,source,active,created_by) VALUES('1204-weekly-check',?,'1204 Weekly Apparatus Check','Stickney Members Only form 439 - submitted 2026-07-31',1,?)").bind(apparatus.id,actor).run();
  for(let index=0;index<apparatus1204VehicleChecks.length;index++)await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_items(id,template_id,equipment_id,label,section_name,sort_order) VALUES(?, '1204-weekly-check', NULL, ?, 'Vehicle / pump / tools', ?)").bind(`1204-vehicle-check-${index+1}`,apparatus1204VehicleChecks[index],index).run();
  for(let index=0;index<apparatus1204Equipment.length;index++)await db.prepare("INSERT OR IGNORE INTO inventory_weekly_check_items(id,template_id,equipment_id,label,section_name,sort_order) VALUES(?, '1204-weekly-check', ?, ?, ?, ?)").bind(`1204-equipment-check-${index+1}`,`1204-equipment-${index+1}`,apparatus1204Equipment[index].name,apparatus1204Equipment[index].compartment,100+index).run();
}

async function getDatabaseBinding() {
  return createPostgresD1Adapter();
}

async function initializeDatabase(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS pay_scales (id TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, regular_rate REAL NOT NULL, overtime_rate REAL NOT NULL, holiday_rate REAL NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pay_rate_history (id TEXT PRIMARY KEY NOT NULL, pay_scale_id TEXT NOT NULL REFERENCES pay_scales(id), effective_date TEXT NOT NULL, regular_rate REAL NOT NULL, overtime_rate REAL NOT NULL, holiday_rate REAL NOT NULL, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS pay_rate_history_scale_date_idx ON pay_rate_history(pay_scale_id, effective_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS pay_rate_history_effective_idx ON pay_rate_history(effective_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, pay_scale_id TEXT NOT NULL REFERENCES pay_scales(id), active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS employees_active_sort_idx ON employees(active, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employee_profiles (employee_id TEXT PRIMARY KEY NOT NULL REFERENCES employees(id), employee_number TEXT, start_date TEXT, end_date TEXT, date_of_birth TEXT, phone TEXT, email TEXT, schedule_sms_opt_in INTEGER NOT NULL DEFAULT 0, address_line_1 TEXT, city TEXT, state TEXT, postal_code TEXT, employment_type TEXT NOT NULL DEFAULT 'Part-time', is_dpw INTEGER NOT NULL DEFAULT 0, driver_status TEXT NOT NULL DEFAULT '', acting_officer_eligible INTEGER NOT NULL DEFAULT 0, is_admin INTEGER NOT NULL DEFAULT 0, emergency_name TEXT, emergency_relationship TEXT, emergency_phone TEXT, photo_updated_at TEXT, notes TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS employee_profiles_number_idx ON employee_profiles(employee_number)"),
    db.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, department_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, failure_count INTEGER NOT NULL DEFAULT 0, last_success_at TEXT, last_error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS push_subscriptions_active_department_idx ON push_subscriptions(department_id, active)"),
    db.prepare("CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id, active)"),
    db.prepare("CREATE TABLE IF NOT EXISTS rank_permissions (rank TEXT NOT NULL, permission_key TEXT NOT NULL, allowed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(rank,permission_key))"),
    db.prepare("CREATE TABLE IF NOT EXISTS employee_permission_overrides (employee_id TEXT NOT NULL REFERENCES employees(id), permission_key TEXT NOT NULL, effect TEXT NOT NULL CHECK(effect IN ('allow','deny')), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(employee_id,permission_key))"),
    db.prepare("CREATE TABLE IF NOT EXISTS payroll_settings (id INTEGER PRIMARY KEY NOT NULL, overtime_threshold REAL NOT NULL DEFAULT 106, acting_officer_premium REAL NOT NULL DEFAULT 1, dpw_multiplier REAL NOT NULL DEFAULT 1.5, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pay_periods (start_date TEXT PRIMARY KEY NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_by TEXT, finalized_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), period_start TEXT NOT NULL REFERENCES pay_periods(start_date), work_date TEXT NOT NULL, category TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS entry_employee_date_category_idx ON time_entries(employee_id, work_date, category)"),
    db.prepare("CREATE INDEX IF NOT EXISTS entry_period_employee_idx ON time_entries(period_start, employee_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_detail_requests (id TEXT PRIMARY KEY NOT NULL, work_date TEXT NOT NULL, requesting_officer_id TEXT NOT NULL REFERENCES employees(id), approver_id TEXT NOT NULL REFERENCES employees(id), start_time TEXT NOT NULL, end_time TEXT NOT NULL, total_hours REAL NOT NULL, work_type TEXT NOT NULL, description TEXT NOT NULL, certified INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, approved_by TEXT, approved_at TEXT, rejection_note TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE INDEX IF NOT EXISTS work_detail_status_date_idx ON work_detail_requests(status, work_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_detail_members (request_id TEXT NOT NULL REFERENCES work_detail_requests(id), employee_id TEXT NOT NULL REFERENCES employees(id), UNIQUE(request_id, employee_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_detail_postings (request_id TEXT NOT NULL REFERENCES work_detail_requests(id), employee_id TEXT NOT NULL REFERENCES employees(id), hours REAL NOT NULL, posted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(request_id, employee_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_rotations (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, cycle_days INTEGER NOT NULL, duty_days TEXT NOT NULL, role TEXT NOT NULL, coverage_plan_id TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_rotation_members (rotation_id TEXT NOT NULL REFERENCES schedule_rotations(id), employee_id TEXT NOT NULL REFERENCES employees(id), UNIQUE(rotation_id, employee_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_assignments (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT REFERENCES employees(id), work_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, role TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual', rotation_id TEXT REFERENCES schedule_rotations(id), status TEXT NOT NULL DEFAULT 'assigned', emergency INTEGER NOT NULL DEFAULT 0, required_rank TEXT NOT NULL DEFAULT '', claim_deadline TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_assignment_date_idx ON schedule_assignments(work_date)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS schedule_assignment_unique_idx ON schedule_assignments(employee_id, work_date, start_time, role)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_requests (id TEXT PRIMARY KEY NOT NULL, request_type TEXT NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), assignment_id TEXT REFERENCES schedule_assignments(id), target_employee_id TEXT REFERENCES employees(id), start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', repeat_mode TEXT NOT NULL DEFAULT 'none', repeat_interval INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', target_status TEXT NOT NULL DEFAULT 'not_required', notes TEXT NOT NULL DEFAULT '', reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_request_status_idx ON schedule_requests(status, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_coverage_rules (id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, role TEXT NOT NULL, minimum_staff INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_coverage_rule_active_idx ON schedule_coverage_rules(active, role)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_shift_patterns (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT 'red', start_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, recurrence_days INTEGER NOT NULL, coverage_plan_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_shift_pattern_active_idx ON schedule_shift_patterns(active, start_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_staffing_overrides (id TEXT PRIMARY KEY NOT NULL, pattern_id TEXT NOT NULL REFERENCES schedule_shift_patterns(id), name TEXT NOT NULL, condition_type TEXT NOT NULL, role TEXT NOT NULL, minimum_staff INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_staffing_override_pattern_idx ON schedule_staffing_overrides(pattern_id, active)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_notifications (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), title TEXT NOT NULL, message TEXT NOT NULL, in_app INTEGER NOT NULL DEFAULT 1, event_type TEXT NOT NULL DEFAULT 'general', email INTEGER NOT NULL DEFAULT 0, sms INTEGER NOT NULL DEFAULT 0, delivery_status TEXT NOT NULL DEFAULT 'queued', read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, scheduled_for TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_notification_employee_idx ON schedule_notifications(employee_id, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS schedule_notification_rules (event_type TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, delivery_timings TEXT NOT NULL DEFAULT '[\"immediate\"]', updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_logs (log_date TEXT PRIMARY KEY NOT NULL, shift_notes TEXT NOT NULL DEFAULT '', locked INTEGER NOT NULL DEFAULT 0, admin_unlocked INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, locked_by TEXT, locked_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_staffing (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, employee_id TEXT REFERENCES employees(id), time_in TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', acting_officer INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_staffing_date_shift_idx ON daily_log_staffing(log_date, shift_key, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_calls (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), report_number TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', time_in TEXT NOT NULL DEFAULT '', responding_units TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', call_type TEXT NOT NULL DEFAULT 'EMS', sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_calls_date_sort_idx ON daily_log_calls(log_date, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS callback_review_settings (id TEXT PRIMARY KEY NOT NULL, reviewer_employee_id TEXT NOT NULL REFERENCES employees(id), rules_json TEXT NOT NULL DEFAULT '{}', updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_callback_submissions (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), call_id TEXT NOT NULL, report_number TEXT NOT NULL DEFAULT '', employee_id TEXT NOT NULL REFERENCES employees(id), reviewer_employee_id TEXT NOT NULL REFERENCES employees(id), status TEXT NOT NULL DEFAULT 'pending', submitted_by TEXT NOT NULL, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT, reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '', call_type TEXT NOT NULL DEFAULT '', call_time_out TEXT NOT NULL DEFAULT '', call_time_in TEXT NOT NULL DEFAULT '', rule_version TEXT NOT NULL DEFAULT '', rule_matches TEXT NOT NULL DEFAULT '[]', rule_flags TEXT NOT NULL DEFAULT '[]', suggested_hours REAL NOT NULL DEFAULT 2, actual_minutes INTEGER, approved_hours REAL NOT NULL DEFAULT 0, submitted_by_employee_id TEXT REFERENCES employees(id), submitted_by_rank TEXT NOT NULL DEFAULT '', UNIQUE(call_id, employee_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS daily_log_callbacks_status_idx ON daily_log_callback_submissions(status, submitted_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS daily_log_callbacks_reviewer_idx ON daily_log_callback_submissions(reviewer_employee_id, status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS callback_payroll_aggregates (employee_id TEXT NOT NULL REFERENCES employees(id), work_date TEXT NOT NULL, manual_baseline_hours REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(employee_id,work_date))"),
    db.prepare("CREATE TABLE IF NOT EXISTS dispatch_incidents (incident_id TEXT PRIMARY KEY NOT NULL, resend_email_id TEXT NOT NULL UNIQUE, call_type TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', narrative TEXT NOT NULL DEFAULT '', responding_units TEXT NOT NULL DEFAULT '', longitude REAL, latitude REAL, dispatched_at TEXT NOT NULL, time_out TEXT NOT NULL DEFAULT '', attachment_count INTEGER NOT NULL DEFAULT 0, source_payload TEXT NOT NULL DEFAULT '{}', source_system TEXT NOT NULL DEFAULT 'CAD email', received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cleared_at TEXT, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE INDEX IF NOT EXISTS dispatch_incidents_active_time_idx ON dispatch_incidents(active, dispatched_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS cad_inbound_receipts (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, dedupe_key TEXT NOT NULL, external_event_id TEXT NOT NULL DEFAULT '', external_incident_id TEXT NOT NULL DEFAULT '', event_type TEXT NOT NULL DEFAULT '', payload_format TEXT NOT NULL DEFAULT '', raw_payload TEXT NOT NULL, normalized_payload TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL, error_message TEXT NOT NULL DEFAULT '', duplicate_of TEXT, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS cad_inbound_provider_dedupe_idx ON cad_inbound_receipts(provider, dedupe_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS cad_inbound_provider_received_idx ON cad_inbound_receipts(provider, received_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS incident_command_boards (incident_id TEXT PRIMARY KEY NOT NULL, board_state TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS incident_command_events (id TEXT PRIMARY KEY NOT NULL, incident_id TEXT NOT NULL, revision INTEGER NOT NULL, event_type TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, event_payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS incident_command_event_revision_idx ON incident_command_events(incident_id,revision)"),
    db.prepare("CREATE INDEX IF NOT EXISTS incident_command_events_incident_time_idx ON incident_command_events(incident_id,created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_approvals (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, sign_in_officer_id TEXT REFERENCES employees(id), sign_in_at TEXT, sign_in_equipment TEXT NOT NULL DEFAULT '{}', sign_in_note TEXT NOT NULL DEFAULT '', reviewed_notes INTEGER NOT NULL DEFAULT 0, sign_out_officer_id TEXT REFERENCES employees(id), sign_out_at TEXT, sign_out_equipment TEXT NOT NULL DEFAULT '{}', sign_out_note TEXT NOT NULL DEFAULT '', fleet_duties_acknowledged INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS log_approval_date_shift_idx ON daily_log_approvals(log_date, shift_key)"),
    db.prepare("CREATE TABLE IF NOT EXISTS important_phone_numbers (id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL, emergency_number TEXT NOT NULL DEFAULT '', non_emergency_number TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS important_phone_category_sort_idx ON important_phone_numbers(category, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, policy_number TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General', effective_date TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Active', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS policies_title_idx ON policies(title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_duties (id TEXT PRIMARY KEY NOT NULL, day_of_week INTEGER NOT NULL, shift_key TEXT NOT NULL, duty TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS daily_duties_day_shift_idx ON daily_duties(day_of_week, shift_key)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chief_board_items (id TEXT PRIMARY KEY NOT NULL, item_type TEXT NOT NULL DEFAULT 'note', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '', starts_at TEXT NOT NULL DEFAULT '', ends_at TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL DEFAULT '', invite_status TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chief_board_active_date_idx ON chief_board_items(active, event_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chief_board_attachments (id TEXT PRIMARY KEY NOT NULL, item_id TEXT NOT NULL REFERENCES chief_board_items(id), object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'application/octet-stream', size_bytes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chief_board_attachment_item_idx ON chief_board_attachments(item_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_preplans (id TEXT PRIMARY KEY NOT NULL, business_name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL, longitude REAL NOT NULL, a_side_latitude REAL, a_side_longitude REAL, footprint TEXT NOT NULL DEFAULT '[]', footprint_square_feet REAL NOT NULL DEFAULT 0, floor_count INTEGER NOT NULL DEFAULT 1, fire_flow_calculation_area REAL NOT NULL DEFAULT 0, construction_type TEXT NOT NULL DEFAULT 'VB', occupancy_flow_category TEXT NOT NULL DEFAULT 'other', sprinkler_standard TEXT NOT NULL DEFAULT 'none', suggested_fire_flow_gpm REAL NOT NULL DEFAULT 0, suggested_fire_flow_duration REAL NOT NULL DEFAULT 0, contact_info TEXT NOT NULL DEFAULT '', construction TEXT NOT NULL DEFAULT '', access_info TEXT NOT NULL DEFAULT '', alarm_system TEXT NOT NULL DEFAULT '', knox_box TEXT NOT NULL DEFAULT '', riser TEXT NOT NULL DEFAULT '', fdc TEXT NOT NULL DEFAULT '', sprinkler_system TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Quick Preplan', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_preplan_location_idx ON field_preplans(latitude,longitude)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_preplan_imports (id TEXT PRIMARY KEY NOT NULL, business_name TEXT NOT NULL, address TEXT NOT NULL, source_file TEXT NOT NULL, source_row INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'location_required', latitude REAL, longitude REAL, geocode_note TEXT NOT NULL DEFAULT '', linked_preplan_id TEXT REFERENCES field_preplans(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_file,source_row))"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_preplan_import_status_idx ON field_preplan_imports(status,business_name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_preplan_features (id TEXT PRIMARY KEY NOT NULL, preplan_id TEXT NOT NULL REFERENCES field_preplans(id), feature_type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL, longitude REAL NOT NULL, system_type TEXT NOT NULL DEFAULT '', service_status TEXT NOT NULL DEFAULT 'in_service', details TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_preplan_feature_preplan_idx ON field_preplan_features(preplan_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_preplan_photos (id TEXT PRIMARY KEY NOT NULL, preplan_id TEXT NOT NULL REFERENCES field_preplans(id), feature_id TEXT REFERENCES field_preplan_features(id), side TEXT NOT NULL DEFAULT '', object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'image/jpeg', size_bytes INTEGER NOT NULL DEFAULT 0, caption TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_preplan_photo_preplan_idx ON field_preplan_photos(preplan_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_hydrants (id TEXT PRIMARY KEY NOT NULL, hydrant_number TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL, longitude REAL NOT NULL, service_status TEXT NOT NULL DEFAULT 'in_service', manufacturer TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', port_count INTEGER NOT NULL DEFAULT 2, port_sizes TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_hydrant_location_idx ON field_hydrants(latitude,longitude)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS field_hydrant_number_idx ON field_hydrants(hydrant_number) WHERE hydrant_number<>''"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_hydrant_flushes (id TEXT PRIMARY KEY NOT NULL, hydrant_id TEXT NOT NULL REFERENCES field_hydrants(id), flushed_at TEXT NOT NULL, flushed_by TEXT NOT NULL, water_clear INTEGER NOT NULL DEFAULT 0, issues TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_hydrant_flush_hydrant_idx ON field_hydrant_flushes(hydrant_id,flushed_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS field_hydrant_flow_tests (id TEXT PRIMARY KEY NOT NULL, test_hydrant_id TEXT NOT NULL REFERENCES field_hydrants(id), flow_hydrant_id TEXT REFERENCES field_hydrants(id), tested_at TEXT NOT NULL, static_pressure REAL NOT NULL, residual_pressure REAL NOT NULL, desired_residual REAL NOT NULL DEFAULT 20, outlet_diameter REAL NOT NULL, pitot_pressure REAL NOT NULL, discharge_coefficient REAL NOT NULL, measured_flow REAL NOT NULL, available_flow REAL NOT NULL, tested_by TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS field_hydrant_test_hydrant_idx ON field_hydrant_flow_tests(test_hydrant_id,tested_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS box_cards (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', box_number TEXT NOT NULL DEFAULT '', access_notes TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT 'Stickney', document_url TEXT NOT NULL DEFAULT '', document_page INTEGER NOT NULL DEFAULT 0, effective_date TEXT NOT NULL DEFAULT '', review_date TEXT NOT NULL DEFAULT '', layout_data TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Active', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS box_cards_title_idx ON box_cards(title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS record_revisions (id TEXT PRIMARY KEY NOT NULL, record_type TEXT NOT NULL, record_id TEXT NOT NULL, revision_number INTEGER NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS record_revision_number_idx ON record_revisions(record_type, record_id, revision_number)"),
    // Station Scheduler
    db.prepare("CREATE TABLE IF NOT EXISTS station_shift_types (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, anchor_date TEXT NOT NULL DEFAULT '', repeat_every_days INTEGER NOT NULL DEFAULT 0 CHECK(repeat_every_days BETWEEN 0 AND 365), color TEXT NOT NULL DEFAULT 'red', active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_shift_types_active_idx ON station_shift_types(active, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_shift_type_roles (id TEXT PRIMARY KEY NOT NULL, shift_type_id TEXT NOT NULL REFERENCES station_shift_types(id), role TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, UNIQUE(shift_type_id, role))"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_schedule_entries (id TEXT PRIMARY KEY NOT NULL, entry_date TEXT NOT NULL, shift_type_id TEXT NOT NULL REFERENCES station_shift_types(id), created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(entry_date, shift_type_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_schedule_entry_date_idx ON station_schedule_entries(entry_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_shift_slots (id TEXT PRIMARY KEY NOT NULL, entry_id TEXT NOT NULL REFERENCES station_schedule_entries(id), role TEXT NOT NULL, employee_id TEXT REFERENCES employees(id), status TEXT NOT NULL DEFAULT 'open', sort_order INTEGER NOT NULL DEFAULT 0, start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '', is_extra INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_shift_slot_entry_idx ON station_shift_slots(entry_id, sort_order)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_shift_slot_employee_idx ON station_shift_slots(employee_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_standing_assignments (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), shift_type_id TEXT NOT NULL REFERENCES station_shift_types(id), role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id, shift_type_id, role))"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_trade_requests (id TEXT PRIMARY KEY NOT NULL, slot_id TEXT NOT NULL REFERENCES station_shift_slots(id), role TEXT NOT NULL, from_employee_id TEXT NOT NULL REFERENCES employees(id), target_employee_id TEXT REFERENCES employees(id), accepted_by_employee_id TEXT REFERENCES employees(id), note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_trade_status_idx ON station_trade_requests(status, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_shift_claims (id TEXT PRIMARY KEY NOT NULL, slot_id TEXT NOT NULL REFERENCES station_shift_slots(id), role TEXT NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_shift_claim_status_idx ON station_shift_claims(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_shift_claim_slot_idx ON station_shift_claims(slot_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_time_off_requests (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), type TEXT NOT NULL, approver_employee_id TEXT NOT NULL REFERENCES employees(id), note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_time_off_status_idx ON station_time_off_requests(status, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_time_off_dates (request_id TEXT NOT NULL REFERENCES station_time_off_requests(id), off_date TEXT NOT NULL, UNIQUE(request_id, off_date))"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_unavailability (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), off_date TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'time_off', request_id TEXT REFERENCES station_time_off_requests(id), UNIQUE(employee_id, off_date))"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_availability (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), availability_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','unavailable')), all_day INTEGER NOT NULL DEFAULT 1, start_time TEXT NOT NULL DEFAULT '06:00', end_time TEXT NOT NULL DEFAULT '18:00', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id, availability_date))"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_availability_date_idx ON station_availability(availability_date, status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_reminder_rules (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', offsets TEXT NOT NULL DEFAULT '[]', email_enabled INTEGER NOT NULL DEFAULT 1, text_enabled INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_ot_settings (mode TEXT PRIMARY KEY NOT NULL, exempt_off_duty INTEGER NOT NULL DEFAULT 1, exempt_already_scheduled INTEGER NOT NULL DEFAULT 1, exempt_declined INTEGER NOT NULL DEFAULT 1, exempt_recently_mandated INTEGER NOT NULL DEFAULT 1, recent_days INTEGER NOT NULL DEFAULT 14, exempt_max_consecutive INTEGER NOT NULL DEFAULT 1, max_consecutive INTEGER NOT NULL DEFAULT 2, priority_order TEXT NOT NULL DEFAULT '[]', custom_rules TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_ot_timing (id INTEGER PRIMARY KEY NOT NULL, award_days_out INTEGER NOT NULL DEFAULT 7, complete_by_days_out INTEGER NOT NULL DEFAULT 2, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_ot_interest (id TEXT PRIMARY KEY NOT NULL, slot_id TEXT NOT NULL REFERENCES station_shift_slots(id), employee_id TEXT NOT NULL REFERENCES employees(id), response TEXT NOT NULL, responded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(slot_id, employee_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_ot_offers (id TEXT PRIMARY KEY NOT NULL, slot_id TEXT NOT NULL REFERENCES station_shift_slots(id), employee_id TEXT NOT NULL REFERENCES employees(id), mode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'offered', rank INTEGER NOT NULL DEFAULT 0, offered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, responded_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_ot_offer_slot_idx ON station_ot_offers(slot_id, rank)"),
    db.prepare("CREATE INDEX IF NOT EXISTS station_ot_offer_employee_idx ON station_ot_offers(employee_id, status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS station_distribution_weights (id INTEGER PRIMARY KEY NOT NULL, seniority_weight REAL NOT NULL DEFAULT 1, hours_weight REAL NOT NULL DEFAULT 1, custom_weight REAL NOT NULL DEFAULT 0, custom_label TEXT NOT NULL DEFAULT 'Cross-trained', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  ]);
  for (let index=0; index<importedBuildingSeeds.length; index+=40) {
    await db.batch(importedBuildingSeeds.slice(index,index+40).map((item) => db.prepare("INSERT INTO field_preplan_imports(id,business_name,address,source_file,source_row) VALUES(?,?,?,?,?) ON CONFLICT(source_file,source_row) DO UPDATE SET business_name=excluded.business_name,address=excluded.address,updated_at=CURRENT_TIMESTAMP").bind(`coopy-buildings-${String(item.sourceRow).padStart(3,"0")}`,item.businessName.trim(),item.address.trim(),importedBuildingSource,item.sourceRow)));
  }
  await db.prepare("UPDATE field_preplan_imports SET linked_preplan_id=(SELECT id FROM field_preplans WHERE lower(trim(field_preplans.address))=lower(trim(field_preplan_imports.address)) AND lower(trim(field_preplans.business_name))=lower(trim(field_preplan_imports.business_name)) LIMIT 1),status='completed',updated_at=CURRENT_TIMESTAMP WHERE linked_preplan_id IS NULL AND EXISTS (SELECT 1 FROM field_preplans WHERE lower(trim(field_preplans.address))=lower(trim(field_preplan_imports.address)) AND lower(trim(field_preplans.business_name))=lower(trim(field_preplan_imports.business_name)))").run();
  try { await db.prepare("ALTER TABLE daily_log_staffing ADD COLUMN acting_officer INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_approvals ADD COLUMN fleet_duties_acknowledged INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN is_dpw INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN driver_status TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN acting_officer_eligible INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN photo_updated_at TEXT").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN schedule_sms_opt_in INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE dispatch_incidents ADD COLUMN source_system TEXT NOT NULL DEFAULT 'CAD email'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_notifications ADD COLUMN event_type TEXT NOT NULL DEFAULT 'general'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_notifications ADD COLUMN scheduled_for TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE chief_board_items ADD COLUMN starts_at TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE chief_board_items ADD COLUMN ends_at TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE chief_board_items ADD COLUMN expires_at TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE chief_board_items ADD COLUMN invite_status TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN footprint_square_feet REAL NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN floor_count INTEGER NOT NULL DEFAULT 1").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN fire_flow_calculation_area REAL NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN construction_type TEXT NOT NULL DEFAULT 'VB'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN occupancy_flow_category TEXT NOT NULL DEFAULT 'other'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN sprinkler_standard TEXT NOT NULL DEFAULT 'none'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN suggested_fire_flow_gpm REAL NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplans ADD COLUMN suggested_fire_flow_duration REAL NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplan_imports ADD COLUMN latitude REAL").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplan_imports ADD COLUMN longitude REAL").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE field_preplan_imports ADD COLUMN geocode_note TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE station_shift_slots ADD COLUMN start_time TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE station_shift_slots ADD COLUMN end_time TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE station_shift_slots ADD COLUMN is_extra INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN call_type TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN call_time_out TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN call_time_in TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN rule_version TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN rule_matches TEXT NOT NULL DEFAULT '[]'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN rule_flags TEXT NOT NULL DEFAULT '[]'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN suggested_hours REAL NOT NULL DEFAULT 2").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN actual_minutes INTEGER").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN approved_hours REAL NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN submitted_by_employee_id TEXT REFERENCES employees(id)").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE daily_log_callback_submissions ADD COLUMN submitted_by_rank TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  await backfillPreplanFootprintMetrics(db);
  await db.batch([
    ["shift_request", "Shift requests", 1, 1, 0, '["immediate"]'],
    ["open_shift", "Open shifts", 1, 1, 1, '["immediate","24_hours_before","2_hours_before"]'],
    ["extra_detail", "Extra details / work details", 1, 1, 0, '["immediate","24_hours_before"]'],
    ["schedule_assignment", "Assigned shifts", 1, 1, 0, '["immediate","24_hours_before"]'],
    ["trade", "Trades and give-aways", 1, 1, 0, '["immediate"]'],
    ["rotation", "Rotation changes", 1, 1, 0, '["immediate"]'],
  ].map((rule) => db.prepare("INSERT OR IGNORE INTO schedule_notification_rules(event_type,label,active,email_enabled,sms_enabled,delivery_timings) VALUES(?,?,?,?,?,?)").bind(...rule)));
  await db.prepare("INSERT OR IGNORE INTO rank_permissions(rank,permission_key,allowed) SELECT DISTINCT label,'field_preplans.view',1 FROM pay_scales").run();
  await db.prepare("INSERT OR IGNORE INTO rank_permissions(rank,permission_key,allowed) SELECT DISTINCT label,'field_preplans.edit',CASE WHEN lower(label) LIKE '%chief%' OR lower(label) LIKE '%captain%' OR lower(label) LIKE '%lieutenant%' OR lower(label) LIKE '%firefighter%' OR lower(label)='ff' THEN 1 ELSE 0 END FROM pay_scales").run();
  try { await db.prepare("ALTER TABLE schedule_assignments ADD COLUMN required_rank TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_assignments ADD COLUMN claim_deadline TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_requests ADD COLUMN target_status TEXT NOT NULL DEFAULT 'not_required'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_requests ADD COLUMN repeat_interval INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_coverage_rules ADD COLUMN plan_id TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE schedule_rotations ADD COLUMN coverage_plan_id TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  await db.prepare("UPDATE schedule_coverage_rules SET plan_id='legacy-'||(SELECT MIN(grouped.id) FROM schedule_coverage_rules AS grouped WHERE grouped.name=schedule_coverage_rules.name AND grouped.start_time=schedule_coverage_rules.start_time AND grouped.end_time=schedule_coverage_rules.end_time AND grouped.days_of_week=schedule_coverage_rules.days_of_week) WHERE plan_id=''").run();
  try { await db.prepare("ALTER TABLE policies ADD COLUMN updated_by TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN updated_by TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN department TEXT NOT NULL DEFAULT 'Stickney'").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN document_url TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN document_page INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN effective_date TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN review_date TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE box_cards ADD COLUMN layout_data TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  for (const sql of [
    "ALTER TABLE pay_periods ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE pay_periods ADD COLUMN created_at TEXT", "ALTER TABLE pay_periods ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE pay_periods ADD COLUMN finalized_by TEXT", "ALTER TABLE pay_periods ADD COLUMN finalized_at TEXT",
    "ALTER TABLE daily_logs ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE daily_logs ADD COLUMN created_at TEXT", "ALTER TABLE daily_logs ADD COLUMN updated_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE daily_logs ADD COLUMN locked_by TEXT", "ALTER TABLE daily_logs ADD COLUMN locked_at TEXT",
    "ALTER TABLE policies ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'", "ALTER TABLE policies ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE policies ADD COLUMN created_at TEXT",
    "ALTER TABLE box_cards ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'", "ALTER TABLE box_cards ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System'", "ALTER TABLE box_cards ADD COLUMN created_at TEXT"
  ]) { try { await db.prepare(sql).run(); } catch { /* Column already exists. */ } }
  await db.batch([
    db.prepare("UPDATE pay_periods SET created_at = COALESCE(created_at, updated_at)"),
    db.prepare("UPDATE daily_logs SET created_at = COALESCE(created_at, updated_at)"),
    db.prepare("UPDATE policies SET created_at = COALESCE(created_at, updated_at)"),
    db.prepare("UPDATE box_cards SET created_at = COALESCE(created_at, updated_at)"),
  ]);

  await db.prepare("INSERT OR IGNORE INTO payroll_settings (id, overtime_threshold, acting_officer_premium, dpw_multiplier) VALUES (1, 106, 1, 1.5)").run();
  await db.batch(payScales.map((scale) => db.prepare("INSERT OR IGNORE INTO pay_scales (id, label, regular_rate, overtime_rate, holiday_rate, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(...scale)));
  await db.prepare("INSERT OR IGNORE INTO pay_rate_history (id, pay_scale_id, effective_date, regular_rate, overtime_rate, holiday_rate, created_by) SELECT 'initial-' || id, id, '1900-01-01', regular_rate, overtime_rate, holiday_rate, 'System' FROM pay_scales").run();
  await db.batch(employeeSeed.map((employee, index) => db.prepare("INSERT INTO employees (id, name, pay_scale_id, active, sort_order) SELECT ?, ?, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM system_meta WHERE key = ?) ON CONFLICT(id) DO NOTHING").bind(employee[0], employee[1], employee[2], index + 1, `employee_deleted:${employee[0]}`)));
  await normalizeEmployeeNames(db);
  await normalizeHistoricalCallTimes(db);
  const rosterImport = [
    ["aguinaga-hugo", "(708) 543-3980", "Cleared", 0],
    ["boulden-jamal", "(773) 213-3598", "Ambulance Only", 0],
    ["brunslik-reid", "(708) 431-4546", "Ambulance Only", 0],
    ["collier-joshua", "(224) 238-6603", "Cleared", 0],
    ["corsini-mark", "", "Cleared", 0],
    ["czech-doug", "(708) 207-8790", "Cleared", 1],
    ["delgatto-eric", "(708) 679-1496", "Cleared", 0],
    ["durkop-christopher", "(630) 767-3540", "Ambulance Only", 0],
    ["eagle-deandre", "", "Cleared", 0],
    ["espino-leonardo", "(708) 770-9334", "Ambulance Only", 0],
    ["focht-eric", "(630) 746-2034", "Cleared", 0],
    ["focht-garrett", "(630) 470-2497", "Cleared", 0],
    ["jarom-ethan", "(708) 837-4448", "Cleared", 0],
    ["keane-matthew", "(708) 990-4568", "Cleared", 0],
    ["kummer-hunter", "", "Cleared", 0],
    ["lopez-joseph", "(708) 979-0668", "Cleared", 0],
    ["lukas-colin", "(708) 218-6210", "Not Cleared", 0],
    ["maldonado-franklin", "", "Cleared", 0],
    ["mulford-kyle", "(815) 931-2824", "Ambulance Only", 0],
    ["ramey-bivian", "", "Ambulance Only", 0],
    ["raygoza-dainel", "", "Not Cleared", 0],
    ["rodriguze-mark", "(773) 986-1363", "Not Cleared", 0],
    ["solano-evan", "(773) 499-3541", "Ambulance Only", 0],
    ["szafarczyk-anthony", "(312) 206-4773", "Not Cleared", 0],
    ["tarnowski-joshua", "(708) 446-5799", "Cleared", 0],
    ["taylor-cherelle", "(773) 563-3494", "Ambulance Only", 0],
    ["valdez-david", "(708) 307-4625", "Not Cleared", 0],
    ["vuelvas-eduardo", "", "Ambulance Only", 0],
    ["williams-joshua", "(773) 792-5600", "Cleared", 0],
  ] as const;
  for (const [employeeId, phone, driverStatus, isDpw] of rosterImport) {
    await db.prepare("INSERT INTO employee_profiles (employee_id) SELECT ? WHERE EXISTS (SELECT 1 FROM employees WHERE id = ?) ON CONFLICT(employee_id) DO NOTHING").bind(employeeId, employeeId).run();
    await db.prepare("UPDATE employee_profiles SET phone = CASE WHEN (phone IS NULL OR phone = '') AND ? <> '' THEN ? ELSE phone END, driver_status = CASE WHEN driver_status = '' THEN ? ELSE driver_status END, is_dpw = CASE WHEN ? = 1 AND driver_status = '' THEN 1 ELSE is_dpw END, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?").bind(phone, phone, driverStatus, isDpw, employeeId).run();
  }
  await enforceActingOfficerStraightStipend(db);
  await db.prepare("INSERT INTO callback_review_settings(id,reviewer_employee_id,updated_by) SELECT 'default','wyant-robert','Administrator setup' WHERE EXISTS (SELECT 1 FROM employees WHERE id='wyant-robert') ON CONFLICT(id) DO NOTHING").run();
  await db.prepare("UPDATE callback_review_settings SET rules_json=?,updated_at=datetime('now') WHERE id='default'").bind(callbackRulesJson).run();
  await reconcileExactLogPayrollRange(db);
  const phoneSeed = [
    ["fire-berwyn", "fire", "Berwyn Fire Department", "", "(708) 484-1644", "", 1],
    ["fire-cicero", "fire", "Cicero Fire Department", "", "(708) 652-2130", "", 2],
    ["fire-forest-park", "fire", "Forest Park Fire Department", "", "(708) 366-2425", "", 3],
    ["fire-lyons", "fire", "Lyons Fire Department", "", "(708) 447-2700", "", 4],
    ["fire-oak-park", "fire", "Oak Park Fire Department", "", "(708) 445-3300", "", 5],
    ["fire-river-forest", "fire", "River Forest Fire Department", "", "(708) 366-7129", "", 6],
    ["fire-forest-view", "fire", "Forest View Fire Department", "", "(708) 458-1180", "", 7],
    ["fire-la-grange", "fire", "La Grange Fire Department", "", "(708) 579-2337", "", 8],
    ["fire-countryside", "fire", "Countryside Fire Department", "", "(708) 354-2500", "", 9],
    ["fire-hinsdale", "fire", "Hinsdale Fire Department", "", "(630) 789-7070", "", 10],
    ["fire-brookfield", "fire", "Brookfield Fire Department", "", "(708) 485-8131", "", 11],
    ["hospital-macneal", "hospital", "MacNeal Hospital", "", "(708) 783-9100", "", 1],
    ["hospital-loretto", "hospital", "Loretto Hospital", "", "(773) 626-4300", "", 2],
    ["hospital-lagrange", "hospital", "UChicago Medicine AdventHealth La Grange", "", "(708) 245-9000", "", 3],
    ["hospital-oak-park", "hospital", "Rush Oak Park Hospital", "", "(708) 383-9300", "", 4],
    ["hospital-hines", "hospital", "Hines VA Hospital", "", "(708) 202-8387", "", 5],
    ["hospital-loyola", "hospital", "Loyola University Medical Center", "", "(888) 584-7888", "", 6],
    ["hospital-madden", "hospital", "Madden Mental Health Center", "", "(708) 338-7400", "", 7],
    ["hospital-christ", "hospital", "Advocate Christ Medical Center", "", "(708) 684-8000", "", 8],
    ["misc-mwrd", "misc", "MWRD", "", "(312) 751-5600", "", 1],
    ["misc-ipa", "misc", "I.P.A.", "", "(708) 345-9780", "", 2],
    ["misc-police", "misc", "Police", "", "(708) 366-7125", "", 3],
    ["misc-dpw", "misc", "DPW", "", "(708) 749-3313", "", 4],
    ["misc-cook-dispatch", "misc", "Cicero Consolidated Dispatch", "", "(708) 974-7721", "", 5],
  ] as const;
  await db.batch(phoneSeed.map((row) => db.prepare("INSERT OR IGNORE INTO important_phone_numbers (id, category, name, emergency_number, non_emergency_number, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(...row)));
  await db.prepare("UPDATE important_phone_numbers SET name = 'Cicero Consolidated Dispatch', emergency_number = '', updated_at = CURRENT_TIMESTAMP WHERE id = 'misc-cook-dispatch'").run();
  await db.prepare("UPDATE important_phone_numbers SET emergency_number = '', updated_at = CURRENT_TIMESTAMP WHERE emergency_number = '911'").run();
  await db.batch(dailyDutySeed.map(([day, shift, duty]) => db.prepare("INSERT OR IGNORE INTO daily_duties (id, day_of_week, shift_key, duty, updated_by) VALUES (?, ?, ?, ?, 'Daily Duties.xlsx import')").bind(`duty-${day}-${shift}`, day, shift, duty)));
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS fleet_apparatus (id TEXT PRIMARY KEY NOT NULL, unit_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, asset_type TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'in_service', manufacturer TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', year INTEGER, vin TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', retired_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_compartments (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), label TEXT NOT NULL, side TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS inventory_compartments_apparatus_idx ON inventory_compartments(apparatus_id,sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_equipment (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), compartment_id TEXT REFERENCES inventory_compartments(id), name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', manufacturer TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', serial_number TEXT NOT NULL DEFAULT '', asset_number TEXT NOT NULL DEFAULT '', barcode TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1, condition TEXT NOT NULL DEFAULT 'serviceable', service_status TEXT NOT NULL DEFAULT 'in_service', expiration_date TEXT NOT NULL DEFAULT '', inspection_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', retired_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS inventory_equipment_apparatus_idx ON inventory_equipment(apparatus_id,compartment_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_photos (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), compartment_id TEXT REFERENCES inventory_compartments(id), equipment_id TEXT REFERENCES inventory_equipment(id), photo_type TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS inventory_photos_current_idx ON inventory_photos(apparatus_id,COALESCE(compartment_id,''),COALESCE(equipment_id,''),photo_type)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_hotspots (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), compartment_id TEXT NOT NULL REFERENCES inventory_compartments(id), photo_id TEXT NOT NULL REFERENCES inventory_photos(id), x_basis_points INTEGER NOT NULL, y_basis_points INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_readiness (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), status TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', checked_by TEXT NOT NULL, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_audit_events (id TEXT PRIMARY KEY NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, record_type TEXT NOT NULL, record_id TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_weekly_check_templates (id TEXT PRIMARY KEY NOT NULL, apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), name TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_weekly_check_items (id TEXT PRIMARY KEY NOT NULL, template_id TEXT NOT NULL REFERENCES inventory_weekly_check_templates(id), equipment_id TEXT REFERENCES inventory_equipment(id), label TEXT NOT NULL, section_name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_weekly_checks (id TEXT PRIMARY KEY NOT NULL, template_id TEXT NOT NULL REFERENCES inventory_weekly_check_templates(id), apparatus_id TEXT NOT NULL REFERENCES fleet_apparatus(id), status TEXT NOT NULL DEFAULT 'in_progress', performed_by TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, notes TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE TABLE IF NOT EXISTS inventory_weekly_check_results (id TEXT PRIMARY KEY NOT NULL, check_id TEXT NOT NULL REFERENCES inventory_weekly_checks(id), item_id TEXT NOT NULL REFERENCES inventory_weekly_check_items(id), result TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', UNIQUE(check_id,item_id))"),
  ]);
  await importApproved1203WeeklyCheck(db);
  await importApproved1204WeeklyCheck(db);
  await seedPolicies(db);
  await seedBoxCards(db);
  // Station Scheduler: employee scheduler attributes + singleton defaults.
  for (const sql of [
    "ALTER TABLE employee_profiles ADD COLUMN station_roles TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE employee_profiles ADD COLUMN station_hours_this_period REAL NOT NULL DEFAULT 0",
    "ALTER TABLE employee_profiles ADD COLUMN station_ot_hours REAL NOT NULL DEFAULT 0",
    "ALTER TABLE employee_profiles ADD COLUMN station_mandatory_hours REAL NOT NULL DEFAULT 0",
    "ALTER TABLE employee_profiles ADD COLUMN station_off_duty INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE employee_profiles ADD COLUMN station_last_mandated TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE employee_profiles ADD COLUMN station_consecutive_mandatory INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE employee_profiles ADD COLUMN station_notify_email INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE employee_profiles ADD COLUMN station_notify_text INTEGER NOT NULL DEFAULT 0",
  ]) { try { await db.prepare(sql).run(); } catch { /* Column already exists after migration. */ } }
  for (const sql of [
    "ALTER TABLE station_shift_types ADD COLUMN anchor_date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE station_shift_types ADD COLUMN repeat_every_days INTEGER NOT NULL DEFAULT 0",
  ]) { try { await db.prepare(sql).run(); } catch { /* Column already exists after migration. */ } }
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO station_ot_settings(mode, exempt_declined, priority_order, custom_rules) VALUES('voluntary', 1, '[\"leastOT\",\"mostSeniority\"]', '[]')"),
    db.prepare("INSERT OR IGNORE INTO station_ot_settings(mode, exempt_declined, priority_order, custom_rules) VALUES('mandatory', 0, '[\"leastMandatory\",\"leastSeniority\"]', '[]')"),
    db.prepare("INSERT OR IGNORE INTO station_ot_timing(id, award_days_out, complete_by_days_out) VALUES(1, 7, 2)"),
    db.prepare("INSERT OR IGNORE INTO station_distribution_weights(id, seniority_weight, hours_weight, custom_weight, custom_label) VALUES(1, 1, 1, 0.5, 'Cross-trained')"),
  ]);
  await db.batch([
    ["station-shift-request", "shift_request", "Shift request updates", '["7 days before","2 days before"]', 1, 0, "Requesting member and approvers", 1],
    ["station-request-deadline", "request_deadline", "Response deadline reminders", '["2 days before","1 day before"]', 1, 1, "Eligible members only", 1],
    ["station-open-shift-blast", "open_shift_blast", "Open shift blasts", '["immediate","2 days before"]', 1, 1, "Eligible members only", 1],
  ].map((rule) => db.prepare("INSERT OR IGNORE INTO station_reminder_rules(id, type, label, offsets, email_enabled, text_enabled, target, enabled) VALUES(?,?,?,?,?,?,?,?)").bind(...rule)));
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES ('runtime_bootstrap_version', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(runtimeBootstrapVersion).run();
  ready = true;
  return db;
}

let initializationPromise: Promise<Awaited<ReturnType<typeof getDatabaseBinding>>> | null = null;

export async function ensureDatabase() {
  const db = await getDatabaseBinding();
  if (ready) return db;

  try {
    const marker = await db.prepare("SELECT value FROM system_meta WHERE key = 'runtime_bootstrap_version' LIMIT 1").first<{ value: string }>();
    if (marker?.value === runtimeBootstrapVersion) {
      ready = true;
      return db;
    }
    // A stale (or missing) runtime marker falls through to initializeDatabase,
    // which is fully idempotent (CREATE TABLE IF NOT EXISTS / ALTER guards /
    // marker-gated seeds) and runs once per version bump to apply new schema —
    // e.g. the Station Scheduler station_* tables added on 2026-08-07.
  } catch {
    // A new database does not have system_meta yet and needs the full bootstrap.
  }

  initializationPromise ??= initializeDatabase(db);
  try {
    return await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}
