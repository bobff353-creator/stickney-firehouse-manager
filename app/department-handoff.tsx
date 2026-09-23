/* eslint-disable @next/next/no-html-link-for-pages -- Portal query routes initialize workspace state on full navigation; do not prefetch operational tools. */
import type { HealthPayload } from "./system-health-model";

const recoveryChecks = new Set(["database-backup", "file-backup", "offsite-backup", "backup-verification"]);

export default function DepartmentHandoff({ payload, permissions }: { payload: HealthPayload | null; permissions: readonly string[] }) {
  const recovery = payload?.checks.filter(check => recoveryChecks.has(check.id)) ?? [];
  return <article className="content-card department-handoff" id="department-handoff">
    <header><div><p className="eyebrow">Chief and department administrator</p><h2>Department handoff &amp; support</h2></div>
      <button className="quiet-button" type="button" onClick={() => window.print()}>Print this review</button></header>
    <p>Use this guide before department acceptance. A service being online does not establish department ownership, a support agreement, or successful recovery.</p>
    <details open><summary>1. Can we recover our records and files?</summary>
      <p>Database backups and uploaded files need separate protection. Keep an independent copy in a department-controlled destination and test restoring both into an isolated environment.</p>
      {payload ? <ul>{recovery.map(check => <li key={check.id}><strong>{check.label}:</strong> {check.value} · {check.state === "healthy" ? "Check passed" : "Needs attention"}</li>)}</ul>
        : <p role="status">Current backup evidence is unavailable. Return to Status and refresh before relying on this review.</p>}
      <p><strong>Next:</strong> IT selects the backup destination and retention period, assigns a backup owner, and records a successful restore test. A downloaded report or this printout is not a full backup.</p>
    </details>
    <details><summary>2. Who controls the app and how does Stickney take it over?</summary>
      <p>Confirm control of the source repository, hosting, database, domain, email, maps, billing, and backups. Naming the workspace “Stickney” does not transfer these accounts or legal ownership.</p>
      <p><strong>Next:</strong> Designate two department administrators, agree on the software license or assignment, and transfer each provider account or project using its supported process. Record recovery contacts, enable provider MFA, and test access before removing the current maintainer.</p>
      <p>Review the developer owner exception in the access configuration during handoff. Do not remove the only working administrator before replacement access is verified.</p>
      {permissions.includes("permissions.manage") ? <a href="/?page=permissions&display=portal">Review app permissions</a> : null}
    </details>
    <details><summary>3. What will it cost?</summary>
      <p>Hosting, database and storage, email, maps, backup storage, and maintenance are separate costs. App members are different from paid hosting developer seats.</p>
      <p><strong>Next:</strong> Confirm the actual provider plans and invoices, assign billing contacts, and set usage alerts. Obtain a written maintenance quote with support hours and response expectations.</p>
      <p><a href="https://vercel.com/pricing" target="_blank" rel="noopener noreferrer">Vercel pricing</a> · <a href="https://supabase.com/pricing" target="_blank" rel="noopener noreferrer">Supabase pricing</a> · <a href="https://resend.com/pricing" target="_blank" rel="noopener noreferrer">Email pricing</a></p>
    </details>
    <details><summary>4. How do members get access and alerts?</summary>
      <p>Administrators invite members from Employees. Members open their verified email link and choose a private PIN. Use individual accounts and only the permissions each person needs.</p>
      <p>Verify a real email and a phone notification on the recipient’s device before operational acceptance. “Enabled” and “queued” are not proof of delivery or acknowledgment.</p>
      <p><strong>Next:</strong> Test a firefighter and an administrator account, confirm separation from payroll and management tools, and document the lost-device and departing-employee process.</p>
      <p>{permissions.includes("employees.manage") ? <><a href="/?page=employees&display=portal">Open Employees</a> · </> : null}<a href="/?page=cad-integration&display=portal">Review CAD delivery evidence</a></p>
    </details>
    <details><summary>5. Who handles outages, maintenance, and updates?</summary>
      <p>Assign a primary maintainer and a backup contact. The hosting subscription does not include someone maintaining this custom app.</p>
      <p><strong>Next:</strong> Agree on support hours, incident contacts, recovery targets, patch reviews, and release approval. Test changes with fictional records in a separate environment; keep the previous app release and a compatible database recovery plan.</p>
      <p>If the app is unavailable, use the department’s established dispatch, radio, staffing, and recordkeeping procedures. Cached information must show its age and should be verified before use.</p>
    </details>
    <details><summary>6. Is every requested module already included?</summary>
      <p>Review each promised workflow in this app. Training announcements and facility safety checks do not establish a complete training-record system or business-inspection program.</p>
      <p><strong>Next:</strong> Demonstrate the required training record, business inspection, signatures, report delivery, recurring due date, and reminder workflow before accepting those modules. Features in the separate Fire Operations app are not proof they are present here.</p>
    </details>
    <p className="handoff-footnote">This guide is read only. It does not transfer accounts, purchase services, certify compliance, send notifications, or mark acceptance complete.</p>
  </article>;
}
