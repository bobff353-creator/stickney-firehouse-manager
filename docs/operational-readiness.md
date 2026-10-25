# Operational readiness and handoff

Status: working plan, not field acceptance or production certification. No crew pilot, recovery rehearsal, or live-device check is claimed by this document.

## Scope and finish lines

Prioritize apparatus checks and discrepancy follow-up before expanding scope. A workflow is complete when another crew member can execute it without the builder, the record survives reload, and the responsible officer can follow it to resolution.

| Workflow | Finish line | Evidence still needed |
| --- | --- | --- |
| Apparatus check | Complete configured items; report discrepancies; reopen saved report | Observed crew completion and comparison with current method |
| Repair follow-up | Report visible, owner recorded, stage updated, repair evidence saved | Two-person report-to-resolution exercise |
| Respond and preplans | Published information and age understood; real offline and reconnect behavior demonstrated | Reconcile current system with preplan-v2-acceptance.md; finish its open gates |
| Administration | Second administrator manages access and corrects a record | Independent handoff exercise |
| Recovery | Restore database and required media in isolation; verify records and access | Successful restore rehearsal and named recovery owner |

## Accountability

Department leadership must name primary and backup people for equipment records, repair triage, preplan review, user access, and recovery. These are unassigned responsibilities until actual people accept them; this document does not assign staff.

At shift handoff, review open repairs, missing owners, unknown statuses, and recorded overdue dates. A completed inspection is not evidence that all defects were repaired. An expired closure is not proof that the road reopened. No hazards recorded is not proof that a hazard inspection occurred. A refresh timestamp records retrieval, not field verification.

## Two-week pilot

Use one apparatus and one shift. Record the current process time before the pilot. Agree on targets with the officer; suggested starting targets are 90% unassisted scheduled completion and median completion time no worse than baseline. Require every test discrepancy to persist after reload and be visible to its responsible officer. Any unexplained lost record or unauthorized access pauses expansion until investigated.

Record each observation using: date, task, device, elapsed time, assistance needed, saved record reference, discrepancy owner, outcome, and defect reference. Keep sensitive incident and personnel information out of informal pilot notes. Record no observation as passed until someone performs it.

Continue if targets pass and the backup administrator completes the handoff. Simplify if time or assistance targets fail. Fix reliability or access defects before expanding. Review actual outcomes after two weeks rather than treating logins as adoption evidence.

## Device and failure checks

On department phones and tablets, test initial login, session expiry, interrupted save, failed refresh, reload, airplane mode, reconnect, cached information age, and sign-out clearing. Confirm a failed save is not shown as saved. Check a cold offline launch separately from a previously opened Respond view. Use drills or controlled test records and the department's established fallback process when access fails.

## Administrator absence and recovery

A second administrator should demonstrate access management and correction of a controlled record using existing permission controls. Record service-account ownership, support contacts, deployment identification, and recovery responsibilities in the department's approved secure location. Never place credentials in this repository.

Before a migration or production release: identify the current deployment and schema, create the database backup and media inventory using the approved provider workflow, restore to an isolated environment, compare representative records and relationships, verify authorized access and denial, and record the result and rollback owner. A backup file alone does not pass recovery acceptance. Do not restore over production as a test.

## Feature decision rule

For every proposed addition record the user, task replaced, expected benefit, record owner, maintenance cost, existing-system alternative, and smallest practical test. Defer additions with no identifiable user or owner. Revisit this decision using observed task results.
