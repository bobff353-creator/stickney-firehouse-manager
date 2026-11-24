# Whole-build coverage appendix — November 23, 2026

This is a source/control inventory and test cross-reference, not a manual proof of every line or a coverage-percentage report. See the main review for exercised workflows, findings and limits.

Release inventory: 941 source/style/SQL files, 97,206 lines, 3283 control definitions, 155 API routes, 318 test files.

## Registered portal screens

All 37 were visited live. Each entry screen also received 390/820/1388-width checks in both color preferences using isolated fictional/unavailable-source fixtures (222 combinations, no root overflow or caught render error). This does not substitute for populated live reads or isolated mutation tests. Inventory additionally has its own workspace review.

- Dashboard
- Command Center
- Operations Board
- Activity Timeline
- Task Queue
- Respond
- Command Board
- Field Preplans
- Road Closures
- Safety Inspections
- Fire Inspections
- NERIS Reporting
- Training
- Scheduling
- Payroll
- Work Details
- Daily Log
- Timesheets
- Callback Reviews
- My Timesheet
- Employees
- Disciplinary Reports
- Employee Contacts
- Policies
- Box Cards
- Holiday Policy
- EMS
- Daily Duties
- Inventory
- Phone Numbers
- Rates & Rules
- Departments
- System Health
- Permissions
- CAD Integration
- Respond Device Modes
- Test View

## API entry points

All `/api` requests pass the root proxy matcher. Its exact public feed, signed webhook/cron and authentication exceptions have their own boundaries; ordinary requests require verified user, department membership, PIN and applicable origin/confirmation checks. Each route must also enforce its business permissions. The references below are direct path/string references found in tests, not an exhaustive description of shared-helper or database test coverage. A dash means inspect shared-service coverage; it is not an approval or a demonstrated missing test.

| Route source | Methods | Direct test references |
| --- | --- | --- |
| `app/api/activity/route.ts` | GET | `first-due-workflow-fixes.test.mjs` |
| `app/api/aladtec-schedule/route.ts` | GET | `legacy-integration-boundaries.test.mjs` |
| `app/api/alerts/route.ts` | GET | `preplan-expiration-evaluator.test.mjs` |
| `app/api/apparatus-locations/ingest/route.ts` | POST | `apparatus-location-api.test.mjs`, `apparatus-locations.test.mjs` |
| `app/api/apparatus-locations/route.ts` | GET, POST | `apparatus-location-api.test.mjs`, `apparatus-locations.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/arrival/[...path]/route.ts` | GET, POST, PUT, PATCH | `arrival-upgrade.test.mjs` |
| `app/api/arrival/map/aerial/route.ts` | GET | — |
| `app/api/arrival/map/footprints/route.ts` | GET | — |
| `app/api/arrival/map/geocode/route.ts` | GET | — |
| `app/api/auth/activate/route.ts` | POST | `chief-readiness.test.mjs`, `security-hardening.test.mjs`, `verified-login.test.mjs` |
| `app/api/auth/context/route.ts` | GET | `verified-login.test.mjs` |
| `app/api/auth/invites/route.ts` | GET, POST | `required-confirmation.test.mjs`, `verified-login.test.mjs` |
| `app/api/auth/login/route.ts` | POST | `legacy-pin-repair.test.mjs`, `login-service-failure.test.mjs`, `remember-device-login.test.mjs`, `security-hardening.test.mjs`, `system-health.test.mjs`, `verified-login.test.mjs` |
| `app/api/auth/pin/route.ts` | POST, DELETE, PATCH | `legacy-pin-repair.test.mjs`, `operations-board-layout.test.mjs`, `pin-renewal.test.mjs`, `verified-login.test.mjs`, `workflow-contract-behavior.test.mjs` |
| `app/api/auth/send-email-hook/route.ts` | POST | `verified-login.test.mjs` |
| `app/api/auth/session/route.ts` | GET | `suite-session-security.test.mjs` |
| `app/api/board-configuration/route.ts` | GET, PUT | `board-configuration.test.mjs` |
| `app/api/board-feeds/route.ts` | GET | `training-import.test.mjs` |
| `app/api/board-links/route.ts` | GET, PUT | `board-links.test.mjs` |
| `app/api/cad/cis/route.ts` | GET, PUT, PATCH, POST | `cad-push-outbox.test.mjs`, `cis-cad-delivery.test.mjs`, `cis-cad.test.mjs` |
| `app/api/callbacks/route.ts` | GET, POST | `callback-reviews.test.mjs`, `portal-atomic-saves.test.mjs` |
| `app/api/chief-board/attachments/[attachmentId]/route.ts` | GET | `chief-board.test.mjs` |
| `app/api/chief-board/route.ts` | GET, POST, PATCH | `board-configuration.test.mjs`, `board-links.test.mjs`, `chief-board.test.mjs`, `officer-board-notes.test.mjs`, `outlook-email-test.test.mjs` |
| `app/api/close-call-news/route.ts` | GET | — |
| `app/api/command-center/route.ts` | GET | `command-center-report.test.mjs`, `permission-enforcement.test.mjs` |
| `app/api/command-snapshots/route.ts` | GET, POST | `report-response-review.test.mjs` |
| `app/api/cron/board-feeds/route.ts` | GET | `daily-feeds.test.mjs` |
| `app/api/cron/cad-push/route.ts` | GET | `cad-push-outbox.test.mjs` |
| `app/api/cron/daily-refresh/route.ts` | GET | `daily-feeds.test.mjs`, `maintenance-reliability.test.mjs`, `preplan-expiration-evaluator.test.mjs` |
| `app/api/cron/dispatch-recovery/route.ts` | GET | `resend-recovery.test.mjs` |
| `app/api/cron/inspection-reminders/route.ts` | GET | `inspection-reminder-drafts.test.mjs` |
| `app/api/cron/scheduler-reminders/route.ts` | GET | `scheduler-reminder-push.test.mjs` |
| `app/api/daily-duties/route.ts` | GET, POST | `fleet-duty-integration.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/dashboard/route.ts` | GET | `department-schedule.test.mjs`, `dispatch-closure.test.mjs`, `fleet-duty-integration.test.mjs`, `live-operations-access.test.mjs`, `permission-session.test.mjs`, `required-confirmation.test.mjs`, `today-api.test.mjs`, `workflow-trust.test.mjs` |
| `app/api/department-schedule/route.ts` | GET | `station-scheduler.test.mjs` |
| `app/api/digital-twin/media/[id]/route.ts` | GET | `suite-session-security.test.mjs` |
| `app/api/digital-twin/route.ts` | GET, POST | `fleet-duty-integration.test.mjs`, `inventory-fleet-status-api.test.mjs`, `live-economy.test.mjs`, `suite-session-security.test.mjs`, `vin-decoder.test.mjs` |
| `app/api/disciplinary/files/[id]/route.ts` | GET | — |
| `app/api/disciplinary/files/route.ts` | POST | — |
| `app/api/disciplinary/import/file/route.ts` | POST | `disciplinary-import-api.test.mjs` |
| `app/api/disciplinary/import/route.ts` | POST | `disciplinary-import-api.test.mjs` |
| `app/api/disciplinary/report/route.ts` | GET | — |
| `app/api/disciplinary/route.ts` | GET, POST | `disciplinary-api.test.mjs`, `disciplinary-import-api.test.mjs` |
| `app/api/dispatch-bridge/route.ts` | POST | `cad-push-outbox.test.mjs`, `dispatch-bridge-reliability.test.mjs` |
| `app/api/document-workflow/route.ts` | GET, POST | — |
| `app/api/employee-accounts/route.ts` | GET, POST | `legacy-integration-boundaries.test.mjs` |
| `app/api/employee-directory/route.ts` | GET | `employee-secondary-email.test.mjs` |
| `app/api/employee-photo/[employeeId]/route.ts` | GET, POST, DELETE | — |
| `app/api/ems-documents/route.ts` | GET, DELETE, PATCH, POST | `ems-document-upload.test.mjs` |
| `app/api/field-hydrants/route.ts` | GET, POST | `arrival-upgrade.test.mjs`, `field-hydrant-delete.test.mjs`, `field-preplans.test.mjs`, `field-record-trust.test.mjs`, `field-workspace-integration.test.mjs`, `flowmsp-import.test.mjs`, `hydrants.test.mjs`, `permission-enforcement.test.mjs` |
| `app/api/field-hydrants/service/route.ts` | GET, POST | `field-workspace-integration.test.mjs` |
| `app/api/field-preplans/assets/[assetId]/route.ts` | GET, DELETE | `preplan-v2-assets.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs` |
| `app/api/field-preplans/assets/route.ts` | POST | `preplan-v2-assets.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs`, `preplan-v2-migration-contract.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/field-preplans/import-photos/route.ts` | POST | — |
| `app/api/field-preplans/observations/photo/route.ts` | GET | — |
| `app/api/field-preplans/observations/route.ts` | GET, POST | `field-workspace-integration.test.mjs` |
| `app/api/field-preplans/operational/route.ts` | GET, POST | `preplan-v2-expiring-review.test.mjs`, `preplan-v2-field-editor.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs`, `preplan-v2-migration-contract.test.mjs`, `preplan-v2-profiles.test.mjs`, `preplan-v2-publication-e2e.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/field-preplans/photos/[photoId]/illustrations/route.ts` | GET, PATCH | `preplan-photo-illustrations.test.mjs` |
| `app/api/field-preplans/photos/[photoId]/route.ts` | GET | `preplan-photo-illustrations.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs` |
| `app/api/field-preplans/photos/route.ts` | POST | `field-preplans.test.mjs`, `preplan-photo-illustrations.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs`, `security-hardening.test.mjs` |
| `app/api/field-preplans/quick/route.ts` | POST | `field-workspace-integration.test.mjs` |
| `app/api/field-preplans/route.ts` | GET, POST | `arrival-upgrade.test.mjs`, `field-preplans.test.mjs`, `field-record-trust.test.mjs`, `field-workspace-integration.test.mjs`, `preplan-photo-illustrations.test.mjs`, `preplan-v2-assets.test.mjs`, `preplan-v2-expiring-review.test.mjs`, `preplan-v2-field-editor.test.mjs`, `preplan-v2-lifecycle-permissions.test.mjs`, `preplan-v2-migration-contract.test.mjs`, `preplan-v2-profiles.test.mjs`, `preplan-v2-publication-e2e.test.mjs`, `required-confirmation.test.mjs`, `security-hardening.test.mjs` |
| `app/api/fire-inspections/backups/[id]/download/route.ts` | GET | — |
| `app/api/fire-inspections/backups/[id]/parts/route.ts` | POST | — |
| `app/api/fire-inspections/backups/[id]/route.ts` | GET, POST | — |
| `app/api/fire-inspections/backups/route.ts` | GET, POST | `inspection-full-backup.test.mjs` |
| `app/api/fire-inspections/cases/action/route.ts` | POST | `inspection-correction-cases.test.mjs` |
| `app/api/fire-inspections/cases/files/[id]/route.ts` | GET | `inspection-correction-cases.test.mjs` |
| `app/api/fire-inspections/cases/files/route.ts` | POST | `inspection-correction-cases.test.mjs` |
| `app/api/fire-inspections/cases/notices/[id]/route.ts` | GET | `inspection-correction-cases.test.mjs` |
| `app/api/fire-inspections/cases/route.ts` | GET | `inspection-correction-cases.test.mjs` |
| `app/api/fire-inspections/codes/route.ts` | POST | `fire-inspections-pilot.test.mjs`, `inspection-native-staff.test.mjs` |
| `app/api/fire-inspections/contact-cards/[id]/route.ts` | GET | `inspection-contact-cards.test.mjs` |
| `app/api/fire-inspections/contact-cards/route.ts` | GET, POST | `inspection-contact-cards.test.mjs` |
| `app/api/fire-inspections/email/route.ts` | GET, POST | `fire-inspections-pilot.test.mjs`, `inspection-email-events.test.mjs` |
| `app/api/fire-inspections/email/webhook/route.ts` | POST | `inspection-email-events.test.mjs` |
| `app/api/fire-inspections/eso/route.ts` | GET, POST | `eso-inspection-import.test.mjs` |
| `app/api/fire-inspections/files/[id]/route.ts` | GET | `fire-inspections-pilot.test.mjs` |
| `app/api/fire-inspections/files/route.ts` | POST | `fire-inspections-pilot.test.mjs`, `inspection-offline-evidence.test.mjs` |
| `app/api/fire-inspections/preplan/route.ts` | POST | `inspection-field-workflow.test.mjs` |
| `app/api/fire-inspections/property-history/route.ts` | GET | `connected-property-history.test.mjs` |
| `app/api/fire-inspections/property-profile/route.ts` | POST | `inspection-desk-profiles.test.mjs` |
| `app/api/fire-inspections/reminders/route.ts` | GET, POST | `inspection-reminder-drafts.test.mjs` |
| `app/api/fire-inspections/reminders/run/route.ts` | POST | `inspection-reminder-drafts.test.mjs` |
| `app/api/fire-inspections/report/route.ts` | GET | `inspection-historical-report.test.mjs` |
| `app/api/fire-inspections/route.ts` | GET, POST | `connected-property-history.test.mjs`, `eso-inspection-import.test.mjs`, `eso-native-inspections.test.mjs`, `fire-inspections-pilot.test.mjs`, `inspection-contact-cards.test.mjs`, `inspection-correction-cases.test.mjs`, `inspection-desk-profiles.test.mjs`, `inspection-email-events.test.mjs`, `inspection-field-workflow.test.mjs`, `inspection-full-backup.test.mjs`, `inspection-historical-report.test.mjs`, `inspection-native-staff.test.mjs`, `inspection-offline-evidence.test.mjs`, `inspection-reminder-drafts.test.mjs`, `inspection-team-api.test.mjs` |
| `app/api/fire-inspections/staff/route.ts` | GET, POST | `inspection-native-staff.test.mjs` |
| `app/api/fire-inspections/team/route.ts` | GET | `inspection-team-api.test.mjs` |
| `app/api/fleet-notices/route.ts` | GET | — |
| `app/api/flowmsp-import/route.ts` | POST | `flowmsp-import.test.mjs` |
| `app/api/health/route.ts` | GET | `preplan-v2-health.test.mjs` |
| `app/api/incident-command/route.ts` | GET, POST | `incident-command-recovery.test.mjs`, `incident-command.test.mjs` |
| `app/api/live-operations/route.ts` | GET | `live-economy.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/logbook/route.ts` | GET, POST | `daily-log-unlock-autosave.test.mjs`, `dispatch-closure.test.mjs`, `fleet-duty-integration.test.mjs`, `inventory-maintenance-scheduling.test.mjs`, `permissions.test.mjs`, `portal-atomic-saves.test.mjs`, `station-scheduler.test.mjs`, `time-entry-validation.test.mjs` |
| `app/api/maps-config/route.ts` | GET | `field-preplans.test.mjs`, `field-record-trust.test.mjs` |
| `app/api/neris/cad/route.ts` | GET | — |
| `app/api/neris/desk/route.ts` | GET | `neris-pilot.test.mjs` |
| `app/api/neris/files/[id]/route.ts` | GET | `neris-pilot.test.mjs` |
| `app/api/neris/files/route.ts` | POST | `neris-pilot.test.mjs` |
| `app/api/neris/route.ts` | GET, POST | `neris-pilot.test.mjs` |
| `app/api/operational-programs/route.ts` | GET, POST | `operational-programs.test.mjs`, `report-response-review.test.mjs` |
| `app/api/operations/documents/[id]/route.ts` | GET | — |
| `app/api/operations/documents/route.ts` | POST | `inventory-maintenance-scheduling.test.mjs` |
| `app/api/operations/drugs/route.ts` | POST | `inventory-drug-api.test.mjs` |
| `app/api/operations/equipment-history/route.ts` | GET | `equipment-continuity.test.mjs` |
| `app/api/operations/evidence/[id]/route.ts` | GET | — |
| `app/api/operations/evidence/route.ts` | POST | — |
| `app/api/operations/history/route.ts` | GET | `inventory-history.test.mjs` |
| `app/api/operations/meters/route.ts` | POST | `inventory-meter-checks.test.mjs` |
| `app/api/operations/restart-weekly/route.ts` | POST | `inventory-weekly-restart-api.test.mjs` |
| `app/api/operations/route.ts` | GET, POST | `equipment-continuity.test.mjs`, `fleet-duty-integration.test.mjs`, `inventory-air-assets.test.mjs`, `inventory-check-usability.test.mjs`, `inventory-container-management.test.mjs`, `inventory-crew-first.test.mjs`, `inventory-drug-api.test.mjs`, `inventory-history.test.mjs`, `inventory-location-approvals.test.mjs`, `inventory-maintenance-scheduling.test.mjs`, `inventory-meter-checks.test.mjs`, `inventory-mileage-reading.test.mjs`, `inventory-phase-two.test.mjs`, `inventory-recurrence-api.test.mjs`, `inventory-reports-lifecycle.test.mjs`, `inventory-safe-operations-api.test.mjs`, `inventory-service-api.test.mjs`, `inventory-service-schedule.test.mjs`, `inventory-weekly-restart-api.test.mjs`, `inventory-weekly-scba.test.mjs`, `live-economy.test.mjs`, `report-response-review.test.mjs`, `required-confirmation.test.mjs`, `startup-stability.test.mjs`, `suite-session-security.test.mjs` |
| `app/api/operations/summary/route.ts` | GET | `inventory-phase-two.test.mjs` |
| `app/api/outlook-email-test/route.ts` | GET, POST | `outlook-email-test.test.mjs` |
| `app/api/payroll-corrections/route.ts` | GET, POST | `payroll-corrections.test.mjs` |
| `app/api/payroll-holidays/route.ts` | GET, POST | `payroll-holidays-api.test.mjs` |
| `app/api/payroll-submissions/route.ts` | GET, POST | `phase-three-export.test.mjs` |
| `app/api/payroll/route.ts` | GET, POST | `employee-secondary-email.test.mjs`, `pay-rate-history.test.mjs`, `payroll-access-boundary.test.mjs`, `payroll-corrections.test.mjs`, `payroll-holidays-api.test.mjs`, `permission-enforcement.test.mjs`, `permission-session.test.mjs`, `permissions.test.mjs`, `phase-three-export.test.mjs`, `portal-atomic-saves.test.mjs`, `required-confirmation.test.mjs`, `time-entry-validation.test.mjs` |
| `app/api/permissions/route.ts` | GET, PUT | `operational-live.test.mjs`, `permission-enforcement.test.mjs`, `permission-session.test.mjs`, `permissions.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/phone-numbers/route.ts` | GET, POST | — |
| `app/api/portal-search/route.ts` | GET | `portal-record-search.test.mjs` |
| `app/api/push/subscriptions/route.ts` | GET, POST, DELETE | `cad-push.test.mjs`, `push-session.test.mjs`, `security-hardening.test.mjs` |
| `app/api/push/test/route.ts` | POST | `maintenance-reliability.test.mjs` |
| `app/api/readiness-review/route.ts` | GET | `readiness-review.test.mjs` |
| `app/api/report-library/route.ts` | GET | `report-response-review.test.mjs` |
| `app/api/required-confirmation/route.ts` | GET, PUT, POST | `permission-session.test.mjs`, `required-confirmation.test.mjs` |
| `app/api/resend-dispatch/route.ts` | POST | `cad-push-outbox.test.mjs`, `resend-webhook-atomic.test.mjs` |
| `app/api/resources/route.ts` | GET, POST | `live-economy.test.mjs`, `permissions.test.mjs` |
| `app/api/respond/route.ts` | GET | `cis-cad-delivery.test.mjs`, `permission-session.test.mjs`, `preplan-v2-migration-contract.test.mjs`, `preplan-v2-profiles.test.mjs`, `preplan-v2-publication-e2e.test.mjs`, `required-confirmation.test.mjs`, `respond-call-selection.test.mjs`, `respond-critical-banners.test.mjs`, `respond-feature-detail.test.mjs`, `respond-floor-plan.test.mjs`, `respond-hazmat-detail.test.mjs`, `respond-hazmat-zones.test.mjs`, `respond-hose-lay.test.mjs`, `respond-offline-cache.test.mjs`, `respond-overview.test.mjs`, `respond-pinned-attachments.test.mjs`, `respond-read-budget.test.mjs`, `respond.test.mjs` |
| `app/api/respond/street-view/route.ts` | GET | `required-confirmation.test.mjs`, `respond.test.mjs` |
| `app/api/river-gauge/route.ts` | GET | `chief-board.test.mjs`, `live-economy.test.mjs` |
| `app/api/road-closures/route.ts` | GET, POST | `road-closures.test.mjs` |
| `app/api/safety-inspections/attachments/[attachmentId]/route.ts` | GET, DELETE | — |
| `app/api/safety-inspections/attachments/route.ts` | POST | `safety-inspections.test.mjs` |
| `app/api/safety-inspections/route.ts` | GET, POST | `safety-inspections.test.mjs` |
| `app/api/scheduling/route.ts` | GET, POST | `schedule-eligibility.test.mjs`, `schedule-generator.test.mjs`, `scheduling.test.mjs`, `station-scheduler.test.mjs` |
| `app/api/shared-preplans/[departmentId]/files/[fileId]/route.ts` | GET | — |
| `app/api/shared-preplans/route.ts` | GET | — |
| `app/api/station-scheduler/route.ts` | GET, POST | `distribution-date-range.test.mjs`, `permission-enforcement.test.mjs`, `required-confirmation.test.mjs`, `schedule-safety-store.test.mjs`, `scheduler-reminder-push.test.mjs`, `staffing-eligibility.test.mjs`, `station-distribution-consent.test.mjs`, `station-scheduler.test.mjs`, `station-trade-workflow.test.mjs` |
| `app/api/suite-context/route.ts` | GET | `required-confirmation.test.mjs`, `suite-session-security.test.mjs` |
| `app/api/system-health/route.ts` | GET | `supabase-backup-health.test.mjs`, `system-health.test.mjs` |
| `app/api/task-queue/route.ts` | GET | `first-due-workflow-fixes.test.mjs`, `operational-programs.test.mjs`, `report-response-review.test.mjs`, `task-queue.test.mjs` |
| `app/api/training-import/route.ts` | POST | `training-import.test.mjs` |
| `app/api/training-sites/route.ts` | GET | — |
| `app/api/training/files/[id]/route.ts` | GET | `training-pilot.test.mjs` |
| `app/api/training/files/route.ts` | POST | `training-pilot.test.mjs` |
| `app/api/training/report-views/route.ts` | GET, POST | `training-reporting.test.mjs` |
| `app/api/training/resources/route.ts` | GET | `training-requirements.test.mjs` |
| `app/api/training/route.ts` | GET, POST | `training-import.test.mjs`, `training-phase-four.test.mjs`, `training-pilot.test.mjs`, `training-reporting.test.mjs`, `training-requirements.test.mjs`, `training-source-review.test.mjs` |
| `app/api/twilio-sms-test/inbound/route.ts` | POST | `twilio-sms-test.test.mjs` |
| `app/api/twilio-sms-test/route.ts` | GET, POST | `twilio-sms-test.test.mjs` |
| `app/api/usfa-fatalities/route.ts` | GET | — |
| `app/api/vin/route.ts` | POST | `vin-decoder.test.mjs` |
| `app/api/weather/route.ts` | GET | — |
| `app/api/work-details/route.ts` | GET, POST | `ao-dst-payroll.test.mjs`, `repeated-hour.test.mjs`, `work-details.test.mjs` |
| `app/api/workspace-reviews/route.ts` | GET, POST | `workspace-continuity.test.mjs` |

## UI/control-owning files

Definitions include buttons, fields, forms, links and disclosures. Dynamic record instances are represented by their component template. Live read-only control lists and isolated save/failure/retry evidence are recorded separately.

| Owning source | Control definitions |
| --- | ---: |
| `app/accept-invite/page.tsx` | 5 |
| `app/activity-timeline.tsx` | 7 |
| `app/admin-tools.tsx` | 8 |
| `app/apparatus-locations-panel.tsx` | 14 |
| `app/arrival/ui/building-details.tsx` | 40 |
| `app/arrival/ui/editor.tsx` | 52 |
| `app/arrival/ui/footprint.tsx` | 31 |
| `app/arrival/ui/hydrant-actions.tsx` | 10 |
| `app/arrival/ui/import-tools.tsx` | 18 |
| `app/arrival/ui/observation.tsx` | 16 |
| `app/arrival/ui/overview-map.tsx` | 4 |
| `app/arrival/ui/overview.tsx` | 15 |
| `app/arrival/ui/quick-preplan.tsx` | 32 |
| `app/arrival/ui/record.tsx` | 25 |
| `app/arrival/ui/research.tsx` | 2 |
| `app/arrival/ui/ui.tsx` | 3 |
| `app/arrival/ui/workspace.tsx` | 41 |
| `app/arrival/workspace.tsx` | 1 |
| `app/auth-gateway.tsx` | 31 |
| `app/board-active-calls.tsx` | 2 |
| `app/board-fatalities.tsx` | 2 |
| `app/board-links-panel.tsx` | 15 |
| `app/board-manager.tsx` | 21 |
| `app/cad-integration-settings.tsx` | 5 |
| `app/callback-reviews.tsx` | 8 |
| `app/chief-board-panel.tsx` | 21 |
| `app/chief-report.tsx` | 8 |
| `app/cis-routing-settings.tsx` | 9 |
| `app/command-center.tsx` | 9 |
| `app/command-review-tools.tsx` | 12 |
| `app/components/InventoryAccessGate.tsx` | 3 |
| `app/components/PortalModuleMenu.tsx` | 5 |
| `app/components/SuiteSwitcher.tsx` | 3 |
| `app/confirm-dialog.tsx` | 2 |
| `app/connected-property-history.tsx` | 5 |
| `app/daily-duties.tsx` | 8 |
| `app/daily-log-notes.tsx` | 6 |
| `app/daily-log-recovery-review.tsx` | 4 |
| `app/daily-log.tsx` | 53 |
| `app/department-handoff.tsx` | 13 |
| `app/department-settings.tsx` | 10 |
| `app/disciplinary/workspace.tsx` | 34 |
| `app/document-workflow-panel.tsx` | 13 |
| `app/employee-account-setup.tsx` | 4 |
| `app/employee-contacts.tsx` | 5 |
| `app/employee-pay-scale.tsx` | 2 |
| `app/ems-documents.tsx` | 16 |
| `app/equipment-continuity.tsx` | 10 |
| `app/error.tsx` | 2 |
| `app/field-preplans.tsx` | 166 |
| `app/fire-inspections/alternative-review-editor.tsx` | 28 |
| `app/fire-inspections/backup-panel.tsx` | 17 |
| `app/fire-inspections/code-library.tsx` | 41 |
| `app/fire-inspections/correction-panel.tsx` | 32 |
| `app/fire-inspections/correction-queue.tsx` | 5 |
| `app/fire-inspections/desk-shell.tsx` | 28 |
| `app/fire-inspections/editor.tsx` | 57 |
| `app/fire-inspections/evidence.tsx` | 4 |
| `app/fire-inspections/guided-checklist.tsx` | 25 |
| `app/fire-inspections/imported-details.tsx` | 6 |
| `app/fire-inspections/nfpa-finder.tsx` | 15 |
| `app/fire-inspections/nfpa-source-links.tsx` | 1 |
| `app/fire-inspections/property-contact-cards.tsx` | 8 |
| `app/fire-inspections/property-profile-editor.tsx` | 13 |
| `app/fire-inspections/property-workflow.tsx` | 10 |
| `app/fire-inspections/reminder-draft-panel.tsx` | 19 |
| `app/fire-inspections/report-delivery.tsx` | 9 |
| `app/fire-inspections/staff-panel.tsx` | 14 |
| `app/fire-inspections/team-editor.tsx` | 9 |
| `app/fire-inspections/workspace.tsx` | 81 |
| `app/global-error.tsx` | 2 |
| `app/hydrant-batch-selector.tsx` | 13 |
| `app/incident-command-board.tsx` | 80 |
| `app/inventory-air-systems.tsx` | 53 |
| `app/inventory-bulk-review.tsx` | 5 |
| `app/inventory-capture.tsx` | 6 |
| `app/inventory-check-journey.tsx` | 4 |
| `app/inventory-container-contents.tsx` | 15 |
| `app/inventory-drug-check.tsx` | 14 |
| `app/inventory-grouped-checklist.tsx` | 1 |
| `app/inventory-live.tsx` | 92 |
| `app/inventory-meter-check.tsx` | 17 |
| `app/inventory-operations.tsx` | 315 |
| `app/inventory-reports.tsx` | 24 |
| `app/inventory-service-fields.tsx` | 7 |
| `app/inventory-vin-profile.tsx` | 24 |
| `app/inventory-workspace-navigation.tsx` | 5 |
| `app/neris/cad-location-panel.tsx` | 6 |
| `app/neris/department-setup.tsx` | 17 |
| `app/neris/desk-panel.tsx` | 7 |
| `app/neris/fields.tsx` | 19 |
| `app/neris/incident-picker.tsx` | 10 |
| `app/neris/report-navigation.tsx` | 5 |
| `app/neris/workspace.tsx` | 54 |
| `app/operational-programs.tsx` | 40 |
| `app/operations-board.tsx` | 15 |
| `app/operations-overview.tsx` | 3 |
| `app/payroll-app.tsx` | 113 |
| `app/payroll-corrections.tsx` | 9 |
| `app/payroll-holiday-manager.tsx` | 12 |
| `app/payroll-submissions.tsx` | 16 |
| `app/payroll-timekeeping-panel.tsx` | 3 |
| `app/permission-settings.tsx` | 20 |
| `app/phone-numbers.tsx` | 20 |
| `app/portal-wayfinding.tsx` | 12 |
| `app/preplans/field-hydrant-service.tsx` | 9 |
| `app/preplans/field-observation.tsx` | 9 |
| `app/preplans/field-photo-import.tsx` | 3 |
| `app/preplans/field-quick-capture.tsx` | 12 |
| `app/preplans/operational-panel.tsx` | 99 |
| `app/preplans/photo-illustration-editor.tsx` | 17 |
| `app/property-review-controls.tsx` | 12 |
| `app/push-notifications.tsx` | 5 |
| `app/pwa-install.tsx` | 1 |
| `app/readiness-review.tsx` | 14 |
| `app/record-credibility.tsx` | 3 |
| `app/remember-device-option.tsx` | 1 |
| `app/report-library.tsx` | 9 |
| `app/required-confirmation.tsx` | 9 |
| `app/reset-password/page.tsx` | 4 |
| `app/resource-pages.tsx` | 39 |
| `app/respond-device-settings.tsx` | 6 |
| `app/respond-monitor-exit.tsx` | 1 |
| `app/respond-overview-map.tsx` | 28 |
| `app/respond.tsx` | 29 |
| `app/response-type-panel.tsx` | 2 |
| `app/road-closures.tsx` | 29 |
| `app/role-dashboard.tsx` | 11 |
| `app/safety-inspections.tsx` | 44 |
| `app/save-status.tsx` | 1 |
| `app/scenario-help.tsx` | 1 |
| `app/schedule-safety-panel.tsx` | 9 |
| `app/scheduler-coverage.tsx` | 5 |
| `app/scheduler-workspace-dialogs.tsx` | 47 |
| `app/scheduler-workspace.tsx` | 46 |
| `app/session-idle-lock.tsx` | 4 |
| `app/shared-preplans.tsx` | 6 |
| `app/smart-alerts.tsx` | 5 |
| `app/staffing-rotation.tsx` | 1 |
| `app/station-scheduler.tsx` | 178 |
| `app/system-health.tsx` | 11 |
| `app/task-queue-return.tsx` | 1 |
| `app/task-queue.tsx` | 16 |
| `app/time-occurrence-select.tsx` | 1 |
| `app/today-dashboard.tsx` | 11 |
| `app/training-class-cards.tsx` | 1 |
| `app/training-source-editor.tsx` | 10 |
| `app/training/activity-browser.tsx` | 9 |
| `app/training/credential-register.tsx` | 4 |
| `app/training/editor.tsx` | 55 |
| `app/training/evidence-summary.tsx` | 1 |
| `app/training/osfm-task-browser.tsx` | 22 |
| `app/training/report-center.tsx` | 28 |
| `app/training/requirement-center.tsx` | 12 |
| `app/training/resource-editor.tsx` | 9 |
| `app/training/source-roster.tsx` | 10 |
| `app/training/workspace.tsx` | 54 |
| `app/work-details.tsx` | 18 |
