import { ensureDatabase } from "../../../db/bootstrap";
import { permissionsForEmail } from "../../server-permissions";
import { buildSubmission, reconcileSubmission, payPeriodEnd, type PayAdjustment } from "../../payroll-submission";
import { loadPayrollSources, loadSubmission, loadAdjustments, payrollFingerprint, payrollVersionGuard, sourceVersion, encodePayrollDocument, decodePayrollDocument } from "../../payroll-submission-server";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function context(request: Request) {
  const db = await ensureDatabase();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!email || !(await permissionsForEmail(email, db)).has("payroll.manage")) throw new Error("FORBIDDEN");
  return { db, email };
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Payroll review could not be completed.";
  if (message === "FORBIDDEN") return json({ error: "Payroll management permission is required." }, 403);
  if (/SAVE_CONFLICT|PAYROLL_FINALIZED|PAYROLL_SNAPSHOT_LOCKED|duplicate key/.test(message)) return json({ error: "Records changed or this period is already submitted. Reload the saved copy and review before retrying. Nothing was partially applied." }, 409);
  if (/does not exist|not installed/.test(message)) return json({ error: "Early payroll setup is not installed yet. Existing payroll is unchanged." }, 503);
  if (/Portal transaction failed|Portal database query failed/.test(message)) return json({ error: "Save not confirmed. Reload saved records before retrying. Repeating the same submission or approval will not create a duplicate." }, 503);
  return json({ error: message }, 400);
}
export async function GET(request: Request) {
  try {
    const { db } = await context(request), period = new URL(request.url).searchParams.get("period") ?? "";
    payPeriodEnd(period);
    const [submission, incoming, prior] = await Promise.all([
      loadSubmission(db, period), loadAdjustments(db, period, "incoming"),
      db.prepare("SELECT period_start AS period FROM payroll_submissions WHERE period_start<? ORDER BY period_start DESC").bind(period).all<{ period: string }>(),
    ]);
    return json({ submission, incoming, priorPeriods: prior.results.map(r => r.period) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Request origin could not be verified." }, 403);
    const { db, email } = await context(request), body = await request.json();
    const period = String(body.period ?? ""), action = String(body.action ?? "");
    const end = payPeriodEnd(period);
    if (!["preview", "submit", "reconcile", "approve"].includes(action)) return json({ error: "Unsupported payroll action." }, 400);
    if (action === "preview" || action === "submit") {
      const saved = await loadSubmission(db, period);
      if (saved) {
        if (action === "submit" && body.fingerprint === await db.prepare("SELECT fingerprint FROM payroll_submissions WHERE period_start=?").bind(period).first<{ fingerprint: string }>().then(r => r?.fingerprint)) return json({ ok: true, submission: saved, alreadySaved: true });
        return json({ error: "A submitted copy already exists. It cannot be replaced.", submission: saved }, 409);
      }
      const source = await loadPayrollSources(db, period), incoming = await loadAdjustments(db, period, "incoming");
      const preview = buildSubmission(source, String(body.staffingThrough ?? ""), String(body.extrasThrough ?? ""), incoming);
      const fingerprint = payrollFingerprint(preview.document);
      if (source.version !== await sourceVersion(db)) throw new Error("SAVE_CONFLICT");
      if (action === "preview") return json({ ...preview, fingerprint });
      if (body.confirm !== true || body.fingerprint !== fingerprint || preview.blockers.length) return json({ error: "Review a fresh, complete preview and confirm the submitted copy. No records were changed.", ...preview }, 409);
      const id = crypto.randomUUID(), createdAt = new Date().toISOString();
      await db.batch([
        payrollVersionGuard(db, source.version),
        db.prepare("INSERT OR IGNORE INTO pay_periods(start_date,end_date,status) VALUES(?,?,'draft')").bind(period, end),
        db.prepare("INSERT INTO payroll_submissions(id,period_start,document,fingerprint,created_by,created_at) VALUES(?,?,?,?,?,?)").bind(id, period, encodePayrollDocument(preview.document), fingerprint, email, createdAt),
        db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'payroll',?,COALESCE(MAX(revision_number),0)+1,'Submitted copy saved',?,? FROM record_revisions WHERE record_type='payroll' AND record_id=?").bind(crypto.randomUUID(), period, `Immutable copy ${id}; staffing through ${preview.document.staffingThrough}; callbacks/work details through ${preview.document.extrasThrough}. Not transmitted to Village.`, email, period),
      ]);
      return json({ ok: true, submission: { id, period, document: preview.document, createdBy: email, createdAt } });
    }
    const sourcePeriod = String(body.sourcePeriod ?? ""); payPeriodEnd(sourcePeriod);
    if (action === "approve" && /^[a-f0-9]{64}$/.test(String(body.candidateId ?? ""))) {
      const existing = await db.prepare("SELECT document FROM payroll_adjustments WHERE id=? AND target_period=? AND source_period=?").bind(String(body.candidateId), period, sourcePeriod).first<{ document: string }>();
      if (existing) return json({ ok: true, adjustment: decodePayrollDocument(existing.document), alreadySaved: true });
    }
    const saved = await loadSubmission(db, sourcePeriod);
    if (!saved) return json({ error: "No submitted copy exists for that original period. Past submitted totals will not be guessed." }, 404);
    const actual = await loadPayrollSources(db, sourcePeriod), ledger = await loadAdjustments(db, sourcePeriod, "outgoing");
    const result = reconcileSubmission(saved, actual, ledger, period);
    const target = await db.prepare("SELECT status FROM pay_periods WHERE start_date=?").bind(period).first<{ status: string }>();
    if (target?.status === "finalized" || await loadSubmission(db, period)) result.blockers.push("The receiving period is already closed/submitted. Select a later open pay period.");
    if (actual.version !== await sourceVersion(db)) throw new Error("SAVE_CONFLICT");
    const candidates = result.candidates.map(c => ({ ...c, id: payrollFingerprint({ snapshot: saved.id, ...c }) }));
    if (action === "reconcile") return json({ candidates, blockers: result.blockers });
    const candidate = candidates.find(c => c.id === body.candidateId), note = String(body.note ?? "").trim();
    if (!candidate || result.blockers.length || body.confirm !== true || !note || note.length > 1500) return json({ error: "Review current evidence, complete required handoffs, and enter an approval reason. No adjustment was applied.", blockers: result.blockers }, 409);
    const adjustment: PayAdjustment = { ...candidate, note, approvedBy: email, approvedAt: new Date().toISOString() };
    await db.batch([
      payrollVersionGuard(db, actual.version),
      db.prepare("INSERT OR IGNORE INTO pay_periods(start_date,end_date,status) VALUES(?,?,'draft')").bind(period, end),
      db.prepare("INSERT INTO payroll_adjustments(id,source_period,target_period,employee_id,sequence,delta_cents,document,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(adjustment.id, sourcePeriod, period, adjustment.employeeId, adjustment.sequence, adjustment.deltaCents, encodePayrollDocument(adjustment), email, adjustment.approvedAt!),
      db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'payroll',?,COALESCE(MAX(revision_number),0)+1,'Carry-forward approved',?,? FROM record_revisions WHERE record_type='payroll' AND record_id=?").bind(crypto.randomUUID(), period, `${adjustment.employeeName}: ${adjustment.deltaCents} cents from ${sourcePeriod}; ${note}`, email, period),
    ]);
    return json({ ok: true, adjustment });
  } catch (error) { return failure(error); }
}
