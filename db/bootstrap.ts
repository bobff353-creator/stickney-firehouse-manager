import policySeed from "./policy-seed.json";
import { stickneyBoxCards } from "./box-card-seed";
import regionalBoxCards from "./regional-box-card-seed.json";
import { formatEmployeeName } from "../app/employee-names";
import { normalizeMilitaryTime } from "../app/military-time";

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

const policySeedVersion = "stickney-policy-library-2026-07-18";
const boxCardSeedVersion = "regional-box-cards-structured-2026-07-21-v2";
const employeeNameFormatVersion = "employee-names-last-first-2026-07-23";
const callTimeFormatVersion = "daily-log-call-times-military-2026-07-23";
const delGattoJuly18PayrollRepairVersion = "delgatto-2026-07-18-full-tour-v1";
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

async function repairDelGattoJuly18Payroll(db: Awaited<ReturnType<typeof getDatabaseBinding>>) {
  const markerKey = "payroll_repair_delgatto_2026_07_18";
  const marker = await db.prepare("SELECT value FROM system_meta WHERE key = ? LIMIT 1").bind(markerKey).first<{ value: string }>();
  if (marker?.value === delGattoJuly18PayrollRepairVersion) return;
  await db.prepare("UPDATE time_entries SET hours = 24, updated_at = CURRENT_TIMESTAMP WHERE employee_id = 'delgatto-eric' AND work_date = '2026-07-18' AND category = 'shift' AND hours < 24").run();
  await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(markerKey, delGattoJuly18PayrollRepairVersion).run();
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

async function getDatabaseBinding() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}

export async function ensureDatabase() {
  const db = await getDatabaseBinding();
  if (ready) return db;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS pay_scales (id TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, regular_rate REAL NOT NULL, overtime_rate REAL NOT NULL, holiday_rate REAL NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, pay_scale_id TEXT NOT NULL REFERENCES pay_scales(id), active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS employees_active_sort_idx ON employees(active, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employee_profiles (employee_id TEXT PRIMARY KEY NOT NULL REFERENCES employees(id), employee_number TEXT, start_date TEXT, end_date TEXT, date_of_birth TEXT, phone TEXT, email TEXT, address_line_1 TEXT, city TEXT, state TEXT, postal_code TEXT, employment_type TEXT NOT NULL DEFAULT 'Part-time', is_dpw INTEGER NOT NULL DEFAULT 0, driver_status TEXT NOT NULL DEFAULT '', is_admin INTEGER NOT NULL DEFAULT 0, emergency_name TEXT, emergency_relationship TEXT, emergency_phone TEXT, notes TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS employee_profiles_number_idx ON employee_profiles(employee_number)"),
    db.prepare("CREATE TABLE IF NOT EXISTS payroll_settings (id INTEGER PRIMARY KEY NOT NULL, overtime_threshold REAL NOT NULL DEFAULT 106, acting_officer_premium REAL NOT NULL DEFAULT 1, dpw_multiplier REAL NOT NULL DEFAULT 1.5, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pay_periods (start_date TEXT PRIMARY KEY NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finalized_by TEXT, finalized_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), period_start TEXT NOT NULL REFERENCES pay_periods(start_date), work_date TEXT NOT NULL, category TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS entry_employee_date_category_idx ON time_entries(employee_id, work_date, category)"),
    db.prepare("CREATE INDEX IF NOT EXISTS entry_period_employee_idx ON time_entries(period_start, employee_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_logs (log_date TEXT PRIMARY KEY NOT NULL, shift_notes TEXT NOT NULL DEFAULT '', locked INTEGER NOT NULL DEFAULT 0, admin_unlocked INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, locked_by TEXT, locked_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_staffing (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, employee_id TEXT REFERENCES employees(id), time_in TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', acting_officer INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_staffing_date_shift_idx ON daily_log_staffing(log_date, shift_key, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_calls (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), report_number TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', time_in TEXT NOT NULL DEFAULT '', responding_units TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', call_type TEXT NOT NULL DEFAULT 'EMS', sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_calls_date_sort_idx ON daily_log_calls(log_date, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_approvals (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, sign_in_officer_id TEXT REFERENCES employees(id), sign_in_at TEXT, sign_in_equipment TEXT NOT NULL DEFAULT '{}', sign_in_note TEXT NOT NULL DEFAULT '', reviewed_notes INTEGER NOT NULL DEFAULT 0, sign_out_officer_id TEXT REFERENCES employees(id), sign_out_at TEXT, sign_out_equipment TEXT NOT NULL DEFAULT '{}', sign_out_note TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS log_approval_date_shift_idx ON daily_log_approvals(log_date, shift_key)"),
    db.prepare("CREATE TABLE IF NOT EXISTS important_phone_numbers (id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL, emergency_number TEXT NOT NULL DEFAULT '', non_emergency_number TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS important_phone_category_sort_idx ON important_phone_numbers(category, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, policy_number TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General', effective_date TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Active', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS policies_title_idx ON policies(title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_duties (id TEXT PRIMARY KEY NOT NULL, day_of_week INTEGER NOT NULL, shift_key TEXT NOT NULL, duty TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT 'System', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS daily_duties_day_shift_idx ON daily_duties(day_of_week, shift_key)"),
    db.prepare("CREATE TABLE IF NOT EXISTS chief_board_items (id TEXT PRIMARY KEY NOT NULL, item_type TEXT NOT NULL DEFAULT 'note', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', event_date TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chief_board_active_date_idx ON chief_board_items(active, event_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS box_cards (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', box_number TEXT NOT NULL DEFAULT '', access_notes TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT 'Stickney', document_url TEXT NOT NULL DEFAULT '', document_page INTEGER NOT NULL DEFAULT 0, effective_date TEXT NOT NULL DEFAULT '', review_date TEXT NOT NULL DEFAULT '', layout_data TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Active', created_by TEXT NOT NULL DEFAULT 'System', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS box_cards_title_idx ON box_cards(title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS record_revisions (id TEXT PRIMARY KEY NOT NULL, record_type TEXT NOT NULL, record_id TEXT NOT NULL, revision_number INTEGER NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS record_revision_number_idx ON record_revisions(record_type, record_id, revision_number)"),
  ]);
  try { await db.prepare("ALTER TABLE daily_log_staffing ADD COLUMN acting_officer INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN is_dpw INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN driver_status TEXT NOT NULL DEFAULT ''").run(); } catch { /* Column already exists after migration. */ }
  try { await db.prepare("ALTER TABLE employee_profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }
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
  await db.batch(employeeSeed.map((employee, index) => db.prepare("INSERT INTO employees (id, name, pay_scale_id, active, sort_order) SELECT ?, ?, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM system_meta WHERE key = ?) ON CONFLICT(id) DO NOTHING").bind(employee[0], employee[1], employee[2], index + 1, `employee_deleted:${employee[0]}`)));
  await normalizeEmployeeNames(db);
  await normalizeHistoricalCallTimes(db);
  await repairDelGattoJuly18Payroll(db);
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
  await seedPolicies(db);
  await seedBoxCards(db);
  ready = true;
  return db;
}
