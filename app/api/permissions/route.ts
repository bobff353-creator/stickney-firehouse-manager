import { ensureDatabase } from "../../../db/bootstrap";
import { defaultPermissionsForRank, permissionCatalog, type PermissionKey } from "../../permissions";
const ownerAdminEmails = ["bobff353@gmail.com"];

type OverrideRow = { employeeId: string; permissionKey: string; effect: "allow" | "deny" };
type RankRow = { rank: string; permissionKey: string; allowed: number };

async function requirePermissionAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  const row = email ? await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>() : null;
  return Boolean(row?.isAdmin);
}

async function viewerRecord(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  return email ? db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{ id: string; name: string; rank: string; isAdmin: number }>() : null;
}

async function effectivePermissions(db: Awaited<ReturnType<typeof ensureDatabase>>, employee: { id: string; rank: string; isAdmin: number }) {
  if (employee.isAdmin) return permissionCatalog.map((permission) => permission.key);
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(employee.rank).all<{ permissionKey: string; allowed: number }>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(employee.id).all<{ permissionKey: string; effect: "allow" | "deny" }>(),
  ]);
  const selected = new Set(rankRows.results.length ? rankRows.results.filter((row) => row.allowed).map((row) => row.permissionKey) : defaultPermissionsForRank(employee.rank));
  for (const override of overrides.results) override.effect === "allow" ? selected.add(override.permissionKey) : selected.delete(override.permissionKey);
  selected.add("payroll.view_own");
  return [...selected];
}

function validPermission(value: string): value is PermissionKey {
  return permissionCatalog.some((permission) => permission.key === value);
}

export async function GET(request: Request) {
  const db = await ensureDatabase();
  const canManage = await requirePermissionAdmin(request, db);
  if (!canManage) {
    const viewer = await viewerRecord(request, db);
    if (!viewer) return Response.json({ viewerPermissions: defaultPermissionsForRank("") });
    return Response.json({ viewerPermissions: await effectivePermissions(db, viewer) });
  }
  const [employees, ranks, rankRows, overrideRows] = await Promise.all([
    db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 ORDER BY e.name COLLATE NOCASE").all<{ id: string; name: string; rank: string; isAdmin: number }>(),
    db.prepare("SELECT DISTINCT label rank FROM pay_scales ORDER BY sort_order,label").all<{ rank: string }>(),
    db.prepare("SELECT rank,permission_key permissionKey,allowed FROM rank_permissions").all<RankRow>(),
    db.prepare("SELECT employee_id employeeId,permission_key permissionKey,effect FROM employee_permission_overrides").all<OverrideRow>(),
  ]);
  const rankSettings: Record<string, string[]> = {};
  for (const { rank } of ranks.results) {
    const saved = rankRows.results.filter((row) => row.rank === rank);
    rankSettings[rank] = saved.length ? saved.filter((row) => row.allowed).map((row) => row.permissionKey) : defaultPermissionsForRank(rank);
  }
  const overrides: Record<string, Record<string, "allow" | "deny">> = {};
  for (const row of overrideRows.results) (overrides[row.employeeId] ??= {})[row.permissionKey] = row.effect;
  const employeeRows = employees.results.map((employee) => {
    const effective = new Set(employee.isAdmin ? permissionCatalog.map((permission) => permission.key) : rankSettings[employee.rank] ?? defaultPermissionsForRank(employee.rank));
    for (const [key, effect] of Object.entries(overrides[employee.id] ?? {})) effect === "allow" ? effective.add(key as PermissionKey) : effective.delete(key as PermissionKey);
    effective.add("payroll.view_own");
    return { ...employee, effectivePermissions: [...effective] };
  });
  return Response.json({ catalog: permissionCatalog, ranks: ranks.results.map((row) => row.rank), rankSettings, overrides, employees: employeeRows, viewerPermissions: permissionCatalog.map((permission) => permission.key) });
}

export async function PUT(request: Request) {
  const db = await ensureDatabase();
  if (!(await requirePermissionAdmin(request, db))) return Response.json({ error: "Administrator permission required" }, { status: 403 });
  const body = await request.json() as { scope?: string; rank?: string; employeeId?: string; permissions?: string[]; overrides?: Record<string, string> };
  if (body.scope === "rank") {
    const rank = String(body.rank ?? "").trim();
    const rankExists = rank && await db.prepare("SELECT 1 ok FROM pay_scales WHERE label=? LIMIT 1").bind(rank).first();
    if (!rankExists) return Response.json({ error: "Select a valid rank" }, { status: 400 });
    const selected = new Set((body.permissions ?? []).filter(validPermission));
    selected.add("payroll.view_own");
    await db.batch([
      db.prepare("DELETE FROM rank_permissions WHERE rank=?").bind(rank),
      ...permissionCatalog.map((permission) => db.prepare("INSERT INTO rank_permissions (rank,permission_key,allowed,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)").bind(rank, permission.key, selected.has(permission.key) ? 1 : 0)),
    ]);
  } else if (body.scope === "employee") {
    const employeeId = String(body.employeeId ?? "");
    const exists = await db.prepare("SELECT 1 ok FROM employees WHERE id=? AND active=1").bind(employeeId).first();
    if (!exists) return Response.json({ error: "Select a valid employee" }, { status: 400 });
    const entries = Object.entries(body.overrides ?? {}).filter(([key, effect]) => key !== "payroll.view_own" && validPermission(key) && (effect === "allow" || effect === "deny"));
    await db.batch([
      db.prepare("DELETE FROM employee_permission_overrides WHERE employee_id=?").bind(employeeId),
      ...entries.map(([key, effect]) => db.prepare("INSERT INTO employee_permission_overrides (employee_id,permission_key,effect,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)").bind(employeeId, key, effect)),
    ]);
  } else return Response.json({ error: "Invalid permission scope" }, { status: 400 });
  return Response.json({ ok: true });
}
