import type { ensureDatabase } from "../db/bootstrap";
import { defaultPermissionsForRank, permissionCatalog, type PermissionKey } from "./permissions";

const ownerAdminEmails = ["bobff353@gmail.com", "bwyant@stickneyfire.com"];

export async function hasPermission(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>, permission: PermissionKey) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const employee = await db.prepare("SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{ id: string; rank: string; isAdmin: number }>();
  if (!employee) return false;
  if (permission === "payroll.view_own") return true;
  if (employee.isAdmin) return true;
  const [rankRows, override] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(employee.rank).all<{ permissionKey: string; allowed: number }>(),
    db.prepare("SELECT effect FROM employee_permission_overrides WHERE employee_id=? AND permission_key=? LIMIT 1").bind(employee.id, permission).first<{ effect: "allow" | "deny" }>(),
  ]);
  if (override) return override.effect === "allow";
  if (rankRows.results.length) return Boolean(rankRows.results.find((row) => row.permissionKey === permission)?.allowed);
  return defaultPermissionsForRank(employee.rank).includes(permission);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionCatalog.some((permission) => permission.key === value);
}
