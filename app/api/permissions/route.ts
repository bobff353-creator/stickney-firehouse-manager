import { ensureDatabase } from "../../../db/bootstrap";
import { parseConfirmationStatus } from '../../required-confirmation-policy';
import { isIndividualOnlyPermission, permissionCatalog, resolveEmployeePermissions } from "../../permissions";
import { hasPermission, isPermissionKey, ownerAdminEmails, permissionsForEmail } from "../../server-permissions";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type Employee = { id: string; name: string; rank: string; isAdmin: number; email: string; endDate?: string | null };
type OverrideRow = { employeeId: string; permissionKey: string; effect: "allow" | "deny" };
type RankRow = { rank: string; permissionKey: string; allowed: number };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const actorEmail = (request: Request) => request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
async function revision(db: Db) {
  return (await db.prepare("SELECT value FROM system_meta WHERE key='permissions-revision'").first<{ value: string }>())?.value ?? null;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase(), email = actorEmail(request);
    const before = await revision(db);
    const viewerPermissions = [...await permissionsForEmail(email, db)];
    if (!viewerPermissions.length) return json({ error: "Your login is not linked to an active employee. Ask an administrator to check your employee email.", viewerPermissions: [] }, 403);
    const canManage = viewerPermissions.includes("permissions.manage");
    const isOwner = ownerAdminEmails.includes(email);
    const viewer = { canManagePayroll: viewerPermissions.includes("payroll.manage"), canManageEmployees: viewerPermissions.includes("employees.manage"), canManagePermissions: canManage, isOwner };
    if (!canManage || new URL(request.url).searchParams.get("scope") === "viewer") {
      if (before !== await revision(db)) return json({ error: "Permissions changed during loading. Retry access verification." }, 409);
      return json({ viewerPermissions, viewer, revision: before, isOwner, confirmation:parseConfirmationStatus(request.headers.get('x-portal-confirmation')), identity: `${request.headers.get("x-department-id") ?? ""}:${email}` });
    }
    const [employees, ranks, rankRows, overrideRows] = await Promise.all([
      db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin,COALESCE(ep.email,'') email,ep.end_date endDate FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 ORDER BY e.name COLLATE NOCASE").all<Employee>(),
      db.prepare("SELECT label rank, MIN(sort_order) sortOrder FROM pay_scales GROUP BY label ORDER BY sortOrder,label").all<{ rank: string }>(),
      db.prepare("SELECT rank,permission_key permissionKey,allowed FROM rank_permissions").all<RankRow>(),
      db.prepare("SELECT employee_id employeeId,permission_key permissionKey,effect FROM employee_permission_overrides").all<OverrideRow>(),
    ]);
    const rankSettings = Object.fromEntries(ranks.results.map(({ rank }) => {
      return [rank, resolveEmployeePermissions({ rank, isAdmin: false }, rankRows.results.filter(row => row.rank === rank), [])];
    }));
    const overrides: Record<string, Record<string, "allow" | "deny">> = {};
    for (const row of overrideRows.results) if (isPermissionKey(row.permissionKey)) (overrides[row.employeeId] ??= {})[row.permissionKey] = row.effect;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const employeeRows = employees.results.map(employee => {
      const isOwner = ownerAdminEmails.includes(employee.email.trim().toLowerCase());
      const loginUsable = Boolean(employee.email.trim()) && (!employee.endDate || employee.endDate >= today) && employees.results.filter(other => other.email.trim().toLowerCase() === employee.email.trim().toLowerCase()).length === 1;
      const effectivePermissions = isOwner ? permissionCatalog.map(item => item.key) : loginUsable ? resolveEmployeePermissions(employee, rankRows.results.filter(row => row.rank === employee.rank), overrideRows.results.filter(row => row.employeeId === employee.id)) : [];
      return { id: employee.id, name: employee.name, rank: employee.rank, isAdmin: employee.isAdmin, isOwner, loginLinked: Boolean(employee.email.trim()), effectivePermissions };
    });
    const after = await revision(db);
    if (before !== after) return json({ error: "Permissions changed during loading. Refresh to read the saved set." }, 409);
    return json({ catalog: permissionCatalog, ranks: ranks.results.map(row => row.rank), rankSettings, overrides, employees: employeeRows, viewerPermissions, viewer, revision: after, isOwner });
  } catch { return json({ error: "Permissions could not be verified. Retry before using protected tools." }, 503); }
}

export async function PUT(request: Request) {
  try {
    const db = await ensureDatabase();
    const before = await revision(db);
    if (!await hasPermission(request, db, "permissions.manage")) return json({ error: "Manage permissions access is required." }, 403);
    const body = await request.json() as { scope?: string; rank?: string; employeeId?: string; permissions?: string[]; overrides?: Record<string, string>; revision?: string | null };
    if (!before || body.revision !== before) return json({ error: "Permissions changed or this editor is outdated. Reload before saving." }, 409);
    // This compare and every changed row commit together. Database triggers
    // invalidate open sessions only for real changes, never rolled-back saves.
    const writes = [db.prepare("UPDATE system_meta SET value=value WHERE key='permissions-revision' AND value=?").bind(before).expectChanges(1)];
    if (body.scope === "rank") {
      const rank = String(body.rank ?? "").trim();
      if (!rank || !await db.prepare("SELECT 1 ok FROM pay_scales WHERE label=? LIMIT 1").bind(rank).first()) return json({ error: "Select a valid rank." }, 400);
      const selected = new Set((Array.isArray(body.permissions) ? body.permissions : []).filter(isPermissionKey));
      if ([...selected].some(isIndividualOnlyPermission)) return json({ error: "Live Operations is granted individually. Use Member exceptions to add this permission." }, 400);
      selected.add("payroll.view_own");
      for (const item of permissionCatalog) if (!isIndividualOnlyPermission(item.key)) writes.push(db.prepare("INSERT INTO rank_permissions(rank,permission_key,allowed,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(rank,permission_key) DO UPDATE SET allowed=excluded.allowed,updated_at=CURRENT_TIMESTAMP WHERE rank_permissions.allowed IS DISTINCT FROM excluded.allowed").bind(rank, item.key, selected.has(item.key) ? 1 : 0));
    } else if (body.scope === "employee") {
      const employeeId = String(body.employeeId ?? "");
      const employee = await db.prepare("SELECT COALESCE(ep.email,'') email FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1").bind(employeeId).first<{ email: string }>();
      if (!employee) return json({ error: "Select a valid employee." }, 400);
      if (ownerAdminEmails.includes(employee.email.trim().toLowerCase())) return json({ error: "The recovery owner has protected access and cannot be restricted with employee exceptions." }, 409);
      const entries = Object.entries(body.overrides ?? {}).filter(([key, effect]) => key !== "payroll.view_own" && isPermissionKey(key) && (effect === "allow" || effect === "deny"));
      const selected = new Map(entries);
      for (const item of permissionCatalog) {
        const effect = selected.get(item.key);
        writes.push(effect
          ? db.prepare("INSERT INTO employee_permission_overrides(employee_id,permission_key,effect,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(employee_id,permission_key) DO UPDATE SET effect=excluded.effect,updated_at=CURRENT_TIMESTAMP WHERE employee_permission_overrides.effect IS DISTINCT FROM excluded.effect").bind(employeeId, item.key, effect)
          : db.prepare("DELETE FROM employee_permission_overrides WHERE employee_id=? AND permission_key=?").bind(employeeId, item.key));
      }
    } else return json({ error: "Invalid permission scope." }, 400);
    await db.batch(writes);
    return json({ ok: true, saved: true, revision: await revision(db) });
  } catch (error) {
    return json({ error: error instanceof Error && error.message.includes("SAVE_CONFLICT") ? "Another administrator changed permissions. Reload before saving." : "Permissions were not saved. Reload and try again." }, 409);
  }
}
