import { ensureDatabase } from "../../../db/bootstrap";
import { permissionsForEmail } from "../../server-permissions";
const json = (body: unknown, status = 200) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function context(request: Request) {
  const db = await ensureDatabase();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "";
  const permissions = await permissionsForEmail(email, db);
  const employee = await db.prepare("SELECT e.id,e.name,COALESCE(ep.is_admin,0) AS isAdmin FROM employees e JOIN employee_profiles ep ON ep.employee_id=e.id WHERE lower(ep.email)=? AND e.active=1 LIMIT 1").bind(email).first<{id:string;name:string;isAdmin:number}>();
  return {db,email,employee,canManage: permissions.has("payroll.manage") && (email === "bobff353@gmail.com" || Boolean(employee?.isAdmin)),canRequest: permissions.has("payroll.view_own") && Boolean(employee)};
}
export async function GET(request: Request) {
  try {
    const {db,email,canManage,canRequest} = await context(request);
    if (!canManage && !canRequest) return json({error:"Timesheet access is required."},403);
    const period = new URL(request.url).searchParams.get("period") || "";
    if (!/^\d{4}-\d{2}-(11|26)$/.test(period)) return json({error:"Choose a payroll period."},400);
    const query = "SELECT r.record_id AS id,r.summary,s.summary AS resolution FROM record_revisions r LEFT JOIN record_revisions s ON s.record_type=r.record_type AND s.record_id=r.record_id AND s.revision_number=2 WHERE r.record_type='payrollCorrection' AND r.revision_number=1 AND r.record_id LIKE ?";
    const rows = canManage ? await db.prepare(`${query} ORDER BY r.changed_at DESC`).bind(`${period}:%`).all() : await db.prepare(`${query} AND r.actor=? ORDER BY r.changed_at DESC`).bind(`${period}:%`,email).all();
    return json({requests:rows.results,canManage,canRequest});
  } catch { return json({error:"Correction requests could not be loaded. Retry shortly."},500); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({error:"Request origin could not be verified."},403);
    const {db,email,employee,canManage,canRequest} = await context(request);
    const body = await request.json();
    const note = String(body.note || "").trim();
    if (!note || note.length > 1500) return json({error:"Enter a note (up to 1,500 characters)."},400);
    if (body.action === "resolve") {
      if (!canManage) return json({error:"Payroll management permission is required."},403);
      const id = String(body.id || "");
      const existing = await db.prepare("SELECT id FROM record_revisions WHERE record_type='payrollCorrection' AND record_id=? AND revision_number=1").bind(id).first();
      if (!existing) return json({error:"Request not found."},404);
      await db.prepare("INSERT OR IGNORE INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) VALUES(?,'payrollCorrection',?,2,'Resolved',?,?)").bind(`${id}:resolved`,id,note,email).run();
      return json({ok:true});
    }
    if (body.action !== "submit" || !canRequest || !employee) return json({error:"Only a linked member can request their own correction."},403);
    const period = String(body.period || ""), date = String(body.date || ""), token = String(body.token || "");
    const validDate = (value: string) => { const parsed = new Date(`${value}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value; };
    if (!/^\d{4}-\d{2}-(11|26)$/.test(period) || !validDate(period) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validDate(date) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)) return json({error:"Choose a valid date and period."},400);
    const end = new Date(`${period}T12:00:00Z`);
    if (period.endsWith("-11")) end.setUTCDate(25); else end.setUTCMonth(end.getUTCMonth()+1,10);
    if (!Number.isFinite(end.getTime()) || date < period || date > end.toISOString().slice(0,10)) return json({error:"The work date must fall in this period."},400);
    const id = `${period}:${employee.id}:${token}`;
    await db.prepare("INSERT OR IGNORE INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) VALUES(?,'payrollCorrection',?,1,'Requested',?,?)").bind(id,id,`${employee.name} · ${date}\n${note}`,email).run();
    return json({ok:true});
  } catch { return json({error:"Save could not be confirmed. Retry with the same form; retries do not create another request."},500); }
}
