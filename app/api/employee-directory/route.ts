import { ensureDatabase } from "../../../db/bootstrap";
import { permissionsForEmail } from "../../server-permissions";

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const permissions = await permissionsForEmail(request.headers.get("oai-authenticated-user-email") ?? "", db);
    const contacts = new URL(request.url).searchParams.get("contacts") === "1";
    if (!(contacts ? permissions.has("contacts.view") : permissions.has("employees.view") || permissions.has("employees.manage"))) return Response.json({ error: "Directory access is not enabled for this account." }, { status: 403 });
    // Directory access never exposes payroll, DOB, home address, emergency contacts or account flags.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const rows = await db.prepare(`SELECT e.id,e.name,p.label rank${contacts ? ",ep.phone,ep.email" : ""} FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (COALESCE(ep.end_date,'')='' OR ep.end_date>=?) ORDER BY e.name`).bind(today).all();
    return Response.json({ employees: rows.results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "The directory could not be verified. Retry." }, { status: 503 }); }
}
