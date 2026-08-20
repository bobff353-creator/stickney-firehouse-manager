import type { ensureDatabase } from "../db/bootstrap";
import { defaultPermissionsForRank, permissionCatalog, type PermissionKey } from "./permissions";

const ownerAdminEmails = ["bobff353@gmail.com"];

async function employeePermissions(
  db: Awaited<ReturnType<typeof ensureDatabase>>,
  employee: { id: string; rank: string; isAdmin: number },
) {
  if (employee.isAdmin) return new Set(permissionCatalog.map((item) => item.key));
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(employee.rank).all<{ permissionKey: string; allowed: number }>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(employee.id).all<{ permissionKey: string; effect: "allow" | "deny" }>(),
  ]);
  const saved = new Map(rankRows.results.map((row) => [row.permissionKey, Boolean(row.allowed)]));
  const defaults = new Set(defaultPermissionsForRank(employee.rank));
  const selected = new Set(permissionCatalog
    .filter((item) => saved.has(item.key) ? saved.get(item.key) : defaults.has(item.key))
    .map((item) => item.key));
  for (const override of overrides.results) {
    override.effect === "allow"
      ? selected.add(override.permissionKey as PermissionKey)
      : selected.delete(override.permissionKey as PermissionKey);
  }
  selected.add("payroll.view_own");
  return selected;
}

export async function permissionsForEmail(
  email: string,
  db: Awaited<ReturnType<typeof ensureDatabase>>,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (ownerAdminEmails.includes(normalizedEmail)) {
    return new Set(permissionCatalog.map((item) => item.key));
  }
  if (!normalizedEmail) return new Set<PermissionKey>();
  const employee = await db.prepare("SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(normalizedEmail).first<{ id: string; rank: string; isAdmin: number }>();
  return employee ? employeePermissions(db, employee) : new Set<PermissionKey>();
}

export async function hasPermission(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>, permission: PermissionKey) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  return (await permissionsForEmail(email, db)).has(permission);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionCatalog.some((permission) => permission.key === value);
}
