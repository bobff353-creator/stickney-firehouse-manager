import type { ensureDatabase } from "../db/bootstrap";
import { resolveEmployeePermissions, permissionCatalog, type PermissionKey } from "./permissions";

export const ownerAdminEmails = ["bobff353@gmail.com"];

async function employeePermissions(
  db: Awaited<ReturnType<typeof ensureDatabase>>,
  employee: { id: string; rank: string; isAdmin: number },
) {
  const [rankRows, overrides] = await Promise.all([
    db.prepare("SELECT permission_key permissionKey,allowed FROM rank_permissions WHERE rank=?").bind(employee.rank).all<{ permissionKey: string; allowed: number }>(),
    db.prepare("SELECT permission_key permissionKey,effect FROM employee_permission_overrides WHERE employee_id=?").bind(employee.id).all<{ permissionKey: string; effect: "allow" | "deny" }>(),
  ]);
  return new Set(resolveEmployeePermissions(employee, rankRows.results, overrides.results));
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
  const matches = await db.prepare("SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) isAdmin,ep.end_date endDate FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(trim(ep.email))=? LIMIT 2").bind(normalizedEmail).all<{ id: string; rank: string; isAdmin: number; endDate: string | null }>();
  const employee = matches.results.length === 1 ? matches.results[0] : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (employee?.endDate && employee.endDate < today) return new Set<PermissionKey>();
  return employee ? employeePermissions(db, employee) : new Set<PermissionKey>();
}

export async function hasPermission(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>, permission: PermissionKey) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  return (await permissionsForEmail(email, db)).has(permission);
}

export async function hasAnyPermission(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>, permissions: PermissionKey[]) {
  const effective = await permissionsForEmail(request.headers.get("oai-authenticated-user-email") ?? "", db);
  return permissions.some(permission => effective.has(permission));
}

export type PreplanReadAccess = {
  canViewPublished: boolean;
  canViewWorking: boolean;
  identities: Set<string>;
};

export async function preplanReadAccess(
  request: Request,
  db: Awaited<ReturnType<typeof ensureDatabase>>,
): Promise<PreplanReadAccess> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const permissions = await permissionsForEmail(email, db);
  const employee = email
    ? await db.prepare("SELECT e.name FROM employees e JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{ name: string }>()
    : null;
  return {
    canViewPublished: permissions.has("field_preplans.view"),
    canViewWorking: ["field_preplans.edit", "field_preplans.review", "field_preplans.publish"]
      .some((permission) => permissions.has(permission as PermissionKey)),
    identities: new Set([email, employee?.name ?? ""].map((value) => value.trim().toLowerCase()).filter(Boolean)),
  };
}

export function canReadPreplanLifecycle(
  plan: { publicationStatus?: unknown; createdBy?: unknown; updatedBy?: unknown },
  access: PreplanReadAccess,
) {
  if (!access.canViewPublished) return false;
  const status = String(plan.publicationStatus ?? "published").trim().toLowerCase() || "published";
  if (status === "published") return true;
  if (access.canViewWorking) return true;
  return [plan.createdBy, plan.updatedBy]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .some((identity) => identity && access.identities.has(identity));
}

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionCatalog.some((permission) => permission.key === value);
}
