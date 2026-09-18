# Inventory workflow verification — September 17, 2026

## Scope and evidence limits

Used the real Inventory React components with isolated fictional browser fixtures on
127.0.0.1. All submitted checks, approvals, equipment edits, repairs, and restock
requests were fictional. No production inspection was marked complete, no real
equipment was declared serviceable, and no notification or email was sent.

The browser fixtures replace HTTP transport and are **not** production database
integration tests. The separate automated suite executes the real atomic inspection
SQL in an isolated PGlite database and checks authorization, rollback, pending-item
rejection, empty-check rejection, and repeat completion safety.

## Browser walkthrough

| Workflow | Observed result |
| --- | --- |
| Daily | Started a three-item check; submission disabled while incomplete; simulated save failure retained the odometer; retry succeeded; Pass and N/A saved; submitted report retained the 12,345 reading. |
| Weekly | Saved one reading, left the workspace, resumed with two items remaining, finished, submitted, and approved. |
| Inventory | Item search worked; bulk-pass confirmation included only two nonnumeric items; mileage remained separate; completed and submitted. |
| Air Pack | Recorded assigned pack/harness, cylinder and 4500 PSI; recorded RIT N/A and spare-cylinder reading; submitted and approved; linked entry appeared in pack history. |
| Reports | All four check types appeared; pending count changed from four to zero after approval; saved report values were read-only. |
| Equipment | Barcode search located the correct item; edits survived changing editor sections; save returned the updated record. |
| Repairs | Created a fictional equipment repair; moved it to In Repair; completed it and observed Completed history. |
| Stock | Used one, received one, requested restock, approved, and marked the request fulfilled. |
| Air equipment management | Edited pack name and service schedule; Sep 1, 2026 plus 24 months produced Sep 1, 2028 with a Jun 1, 2028 reminder; completed maintenance remained linked to that pack ID. |
| Setup | Opened apparatus, compartments, photos, hotspots, checklist editor, schedule editor, SCBA template, and read-only member preview. Hotspots correctly required an approved photo. |
| Roles | Member navigation omitted Build & templates; no change to production permission enforcement. |

All nine Inventory workspaces were opened and scrolled to the bottom at 390×844,
320×740, and 1368×768. After fixes, all had no document-level horizontal overflow.
Browser console inspection returned no warnings or errors in the final workflow
fixture pass. Test records persisted when reopening the workflow fixture URL.

## Issues corrected during this pass

Validation: all 107 inventory/VIN automated tests passed. Targeted ESLint passed;
the local production build passed. Deployment is verified separately against the
canonical production alias after publishing.

- Dark-mode text inherited light colors on white progress, empty-state, stock,
  and stock-form surfaces. Paired foreground/background colors explicitly.
- The phone submission footer covered check fields. It now stays in document
  flow; the sticky progress panel retains the jump-to-submission action.
- A previous check's Submitted notice remained when opening the next check.
  Starting/resuming clears it; save confirmations use human-readable wording.
- Opening a report rendered it below the current screen without bringing it into
  view. It now scrolls into view and receives keyboard focus.
- Due-date navigation targeted the checklist toolbar instead of the schedule
  editor. It now scrolls to the editor after rendering.
- Repair lanes imposed a very wide minimum size on the phone page. Phone lanes
  now stack, nested grids can shrink, and document controls remain within view.

## Not proven by this pass

- Physical iPhone/Android camera operation, device permission prompts, and real
  photo/document uploads to production storage.
- A real VIN decoded and saved through the production NHTSA integration.
- Physical printing or email delivery (no test messages were sent).
- Every apparatus-specific checklist, unusual legacy record, or concurrent
  multi-device production update. No claim of universal 100% reliability.
- Every administrative destructive action, photo approval, hotspot placement,
  or live department configuration save. Those were not executed on real data.

The previous capture-specific regression work and automated VIN tests remain
available, but are not substitutes for a real phone acceptance check.
