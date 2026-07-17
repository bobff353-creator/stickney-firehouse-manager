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

export async function ensureDatabase() {
  const { env } = await import("cloudflare:workers");
  if (ready) return env.DB;
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS pay_scales (id TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, regular_rate REAL NOT NULL, overtime_rate REAL NOT NULL, holiday_rate REAL NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, pay_scale_id TEXT NOT NULL REFERENCES pay_scales(id), active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS employees_active_sort_idx ON employees(active, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employee_profiles (employee_id TEXT PRIMARY KEY NOT NULL REFERENCES employees(id), employee_number TEXT, start_date TEXT, end_date TEXT, date_of_birth TEXT, phone TEXT, email TEXT, address_line_1 TEXT, city TEXT, state TEXT, postal_code TEXT, employment_type TEXT NOT NULL DEFAULT 'Part-time', emergency_name TEXT, emergency_relationship TEXT, emergency_phone TEXT, notes TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS employee_profiles_number_idx ON employee_profiles(employee_number)"),
    db.prepare("CREATE TABLE IF NOT EXISTS payroll_settings (id INTEGER PRIMARY KEY NOT NULL, overtime_threshold REAL NOT NULL DEFAULT 106, acting_officer_premium REAL NOT NULL DEFAULT 1, dpw_multiplier REAL NOT NULL DEFAULT 1.5, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pay_periods (start_date TEXT PRIMARY KEY NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY NOT NULL, employee_id TEXT NOT NULL REFERENCES employees(id), period_start TEXT NOT NULL REFERENCES pay_periods(start_date), work_date TEXT NOT NULL, category TEXT NOT NULL, hours REAL NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS entry_employee_date_category_idx ON time_entries(employee_id, work_date, category)"),
    db.prepare("CREATE INDEX IF NOT EXISTS entry_period_employee_idx ON time_entries(period_start, employee_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_logs (log_date TEXT PRIMARY KEY NOT NULL, shift_notes TEXT NOT NULL DEFAULT '', locked INTEGER NOT NULL DEFAULT 0, admin_unlocked INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_staffing (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, employee_id TEXT REFERENCES employees(id), time_in TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', acting_officer INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_staffing_date_shift_idx ON daily_log_staffing(log_date, shift_key, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_calls (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), report_number TEXT NOT NULL DEFAULT '', time_out TEXT NOT NULL DEFAULT '', time_in TEXT NOT NULL DEFAULT '', responding_units TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', call_type TEXT NOT NULL DEFAULT 'EMS', sort_order INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS log_calls_date_sort_idx ON daily_log_calls(log_date, sort_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS daily_log_approvals (id TEXT PRIMARY KEY NOT NULL, log_date TEXT NOT NULL REFERENCES daily_logs(log_date), shift_key TEXT NOT NULL, sign_in_officer_id TEXT REFERENCES employees(id), sign_in_at TEXT, sign_in_equipment TEXT NOT NULL DEFAULT '{}', sign_in_note TEXT NOT NULL DEFAULT '', reviewed_notes INTEGER NOT NULL DEFAULT 0, sign_out_officer_id TEXT REFERENCES employees(id), sign_out_at TEXT, sign_out_equipment TEXT NOT NULL DEFAULT '{}', sign_out_note TEXT NOT NULL DEFAULT '')"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS log_approval_date_shift_idx ON daily_log_approvals(log_date, shift_key)"),
  ]);
  try { await db.prepare("ALTER TABLE daily_log_staffing ADD COLUMN acting_officer INTEGER NOT NULL DEFAULT 0").run(); } catch { /* Column already exists after migration. */ }

  await db.prepare("INSERT OR IGNORE INTO payroll_settings (id, overtime_threshold, acting_officer_premium, dpw_multiplier) VALUES (1, 106, 1, 1.5)").run();
  await db.batch(payScales.map((scale) => db.prepare("INSERT OR IGNORE INTO pay_scales (id, label, regular_rate, overtime_rate, holiday_rate, sort_order) VALUES (?, ?, ?, ?, ?, ?)").bind(...scale)));
  await db.batch(employeeSeed.map((employee, index) => db.prepare("INSERT OR IGNORE INTO employees (id, name, pay_scale_id, active, sort_order) VALUES (?, ?, ?, 1, ?)").bind(employee[0], employee[1], employee[2], index + 1)));
  ready = true;
  return db;
}
