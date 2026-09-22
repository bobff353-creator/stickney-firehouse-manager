# First Due, Fire Station Software, Vector Check It, and Station Boss: workflow research

Research date: September 21, 2026. Focus: simplifying Stickney apparatus daily/weekly checks, inventory counts, air packs/cylinders, medical stock, and reporting problems.

## Conclusion

Use First Due's connected check-to-repair approach, Fire Station Software's guided compartment navigation, Check It's visible ownership and equipment history, and Station Boss's configurable failure actions and supply-request flow. Do not reproduce an entire vendor interface. The goal is a smaller everyday path using Stickney's existing records, permissions, and inspection requirements.

The proposed crew journey is:

**Choose the job → choose the unit or location → check one section → review outstanding items → submit → see a receipt and the next action.**

Saving results, submitting the check, notifying somebody, and returning equipment to service are different events. The interface must make each one explicit.

## Evidence and boundaries

- **Directly observed:** the user-opened, authenticated Vector Check It browser session. Reviewed Home, fleet cards, check history, a completed weekly report, a ticket board, an existing ticket, medical/drug empty states, equipment search, an air-pack record, equipment pools, and an SCBA inspection-history view. Also inspected the narrow browser layout and desktop navigation.
- **Published evidence:** official product descriptions, vendor-authored customer stories, First Due video transcripts, and Fire Station Software's illustrated user/admin guides. These describe features; they do not prove reliability, delivery, compliance, or implementation details.
- **Video inspection:** opened First Due's official Assets & Inventory video (3:25), read its full exported captions against the vendor transcript, and inspected playback including the nested checklist around 1:22. Opened Fire Station Software's 27-second apparatus overview and its 17:26 Managing Apparatus Inventory tutorial. The longer tutorial crashed when playback was attempted; it was not fully watched. The associated illustrated instructions were reviewed instead. Do not describe these as full end-to-end tests of either product.
- **Local source inspection:** Stickney's current inventory components and save/notice handlers. This is not a production acceptance test.
- No checks were started or submitted in Check It. No stock, tickets, templates, personnel, settings, or notifications were saved or sent. The temporary viewport was reset and the user-opened tab returned to its original Home URL.
- The Check It account displayed a different department. Only general workflow observations are recorded here; its personnel, asset identifiers, report contents, and maintenance details are not imported into Stickney.
- First Due and Station Boss were not tested in authenticated accounts. Full Check It administration, native mobile behavior, offline saving, concurrent edits, and notification delivery were not exercised. The public Check It support center required login. Detailed First Due checklist support pages were not obtainable through this research path.

## 1. First Due: keep the check and the follow-up connected

First Due's assets demonstration describes a due-check dashboard, equipment/kit checklists embedded within apparatus checks, multi-person work on a checklist, and work-order creation from failed items. Existing work orders are shown to later checkers to help avoid duplicate reporting. Its product material also describes barcode identification and moving equipment between apparatus. These are documented capabilities, not functions tested here. [Assets demonstration and transcript](https://www.firstdue.com/video-gallery/assets-inventory)

Its equipment material distinguishes the individual equipment record from the kit containing it. That supports an important design principle: inspect the equipment in context, while retaining its own identity and history. [Equipment and kit management](https://www.firstdue.com/learnmore/fire/assetsinventory)

For medications, the vendor describes lot, expiry, quantity, and chain-of-custody tracking across controlled and non-controlled items. This must not be confused with a basic stock counter. [Medication demonstration transcript](https://www.firstdue.com/video-gallery/medications)

The South Stormont customer story highlights moving deficiency follow-up from email into a visible work-order list. It is a vendor-published testimonial, not an independent evaluation, but it reinforces the importance of a persistent queue rather than a transient notification alone. [South Stormont story](https://www.firstdue.com/customer-success-stories/south-stormont-replaces-100-spreadsheets)

### Application to Stickney — design proposals

- Keep the current apparatus and check visible while opening an air-pack or kit subsection.
- Prefill the apparatus, item, and location when reporting a problem.
- Show an already-open problem next to the item, with a way to add information to that problem rather than blindly generating another one.
- Let a crew member resume saved work without losing their section or filters.
- Treat shared-device collaboration as a correctness requirement: never silently overwrite a newer saved answer.

First Due's webinar describes RFID as an upcoming capability. That is not evidence that production RFID support is generally available today, and it is not needed for this usability improvement. [Connected-assets webinar description](https://www.firstdue.com/webinars/connected-assets-ready-operations-rethinking-inventory-for-fire-ems)

### Fire Station Software: guided work and deliberate completion

Fire Station Software is a separate vendor from Station Boss. Its current module index links both video tours and user guides. [Official module tours](https://firestationsoftware.com/modules)

Its check guide separates general questions, compartment inventory, and problems, followed by a submission review. Previous/Next moves between compartments; a compartment overview remains accessible. The mobile navigation is collapsed at the bottom. Validation explains incomplete required items, and submission is disabled until those are resolved. Submitted checks are no longer editable in that documented workflow. These are documented behaviors, not authenticated tests. [Conducting a check](https://docs.firestationsoftware.com/books/fire-station-user-guide-NOs/page/check-an-apparatus)

The admin inventory guide explains compartment/sub-compartment organization, equipment photos, ordering, and descriptive names with shorter nicknames. It also requires a separate page-level save after some modal confirmations. For Stickney, retain the useful hierarchy and reference photos, but make server confirmation unambiguous so a modal confirmation cannot be mistaken for a completed save. [Inventory setup guide and embedded training video](https://docs.firestationsoftware.com/books/fire-station-user-guide-NOs/page/manage-apparatus-inventory)

Checklist setup is a separate manager-permission task with configurable readings and custom items. That supports keeping template editing outside the crew's inspection path. [Checklist configuration](https://docs.firestationsoftware.com/books/fire-station-user-guide-NOs/page/manage-an-apparatus-checklist)

Its notification guide distinguishes completion emails from problem-assignment emails, with an option to send completion notices only when problems exist. It documents fallback assignment rules based on settings and groups. For Stickney, use explicit visible routing rather than silently adopting another department's fallback rules or selecting an arbitrary member. [Notification configuration](https://docs.firestationsoftware.com/books/fire-station-user-guide-NOs/page/configure-notifications)

**Combined design decision:** use guided sections with a named next destination, preserve all required checks, keep a route back to the section list, summarize unresolved problems before submission, and show save/submission/assignment as separate statuses. First Due informs connected repairs; Fire Station Software informs navigation; Check It informs ownership/history; Station Boss informs configurable setup and supply approvals. None alone is the blueprint.

## 2. Vector Check It: ownership, status, and history

Vector identifies this product as Check It, formerly Halligan. Its public product page describes mobile checks, scheduled inspections, reminders, inventory visibility, and repair ticketing. [Check It product overview](https://www.vectorsolutions.com/solutions/vector-check-it/fire-ems/)

### Direct observations from the open application

| Area inspected | What was visible | Design lesson |
|---|---|---|
| Home | My Responsibilities, with Equipment, Inventory, Apparatus, and Tickets views | Start with the user's work rather than the entire administration catalog |
| Fleet | Apparatus status, check types, overdue indicators, open work-order counts, and links to related records | Make the next task and existing problems visible before opening a check |
| Check history | Passing counts, started/completed timestamps, named attribution, and links to a report | Give submission a lasting receipt, not just a disappearing success message |
| Completed weekly report | Grouped sections, numeric readings, and per-item details | Keep daily and weekly requirements distinct and preserve item-specific instructions |
| Ticket board | Category-specific boards with stages such as Reported, In Repair, and Back In Service | A reported problem needs an owner and a visible path to resolution |
| Existing ticket | Assignee, status, attachments, comments, history, costs, and entries recording recipients of prior sends | Assignment and notification are separate; record both clearly |
| Air-pack record | Equipment identity, inspection schedule, item log, inspections, work orders, and files | A pack or cylinder needs its own history, not just a line in a truck inventory |
| SCBA pool | A shared inspection definition linked to frames and bottles, with inspection history showing in-progress entries | Reuse definitions while keeping individual completion records distinct |

The ticket history displayed prior send events. I did not verify whether recipients received or read those messages. Likewise, observing historical check timestamps does not test current autosave reliability.

### What not to copy blindly

- In the narrow browser view, Home's tab names were shortened and the equipment table needed horizontal scrolling. This observation applies to the web view inspected, not the untested native phone app.
- Closing a ticket after only viewing it produced a warning about losing changes. Stickney should warn when an actual unsaved edit exists, not routinely train users to ignore warnings.
- The medical-supply and drug views in this account showed no items. An empty state directed the user toward a creation button that was not visible in the inspected view. Stickney should explain whether setup is missing or the user lacks permission, and offer an action that actually exists.
- Long equipment lists should support search and location/category filters, but should not become the default route for starting a routine check.

### Administration lessons

Vector's RapidReady service explicitly starts with department procedures, assets, rosters, configuration, and data validation. The lesson is that setup itself is a major usability task—not merely adding more buttons to the crew screen. [RapidReady](https://www.vectorsolutions.com/solutions/check-it-managed-software-services/)

Its PPE material describes configurable inspections and granular administration permissions. Its EMS material describes separate controls for custody changes, authentication, and dual signatures for controlled substances. These are vendor-described capabilities, not permission or medication tests performed in this session. [PPE management](https://www.vectorsolutions.com/solutions/vector-check-it/fire-ems/ppe-tracking-software/), [EMS inventory and controlled-substance overview](https://www.vectorsolutions.com/solutions/ems-agencies/)

## 3. Station Boss: configure the expected action

Station Boss describes reusable templates, daily/weekly/monthly/per-shift scheduling, and configurable failed-item actions: a maintenance request, a notification, or supervisor review. This makes failure handling part of setup rather than leaving each firefighter to invent the process. [Checklists](https://stationboss.net/fire-department-checklists/)

Its inventory workflow separates personnel requesting supplies from an approver reviewing and fulfilling the request. It describes inventory by station, categories, par levels, and reorder points. [Inventory management](https://stationboss.net/fire-department-inventory-management/)

The medical-supply page describes GS1-128/DataMatrix scanning, lot and expiration capture, transactions for usage/transfers/restocking/disposal, and configurable expiry alerts. This is specifically documented for medical supplies; I did not verify equivalent barcode support for every equipment workflow. [Medical supplies](https://stationboss.net/fire-department-medical-supplies/)

Equipment maintenance documentation describes assigned responsibility, scheduled inspections, histories, and officer review. These are useful organizational patterns, but a vendor statement about compliance is not evidence that a particular department's setup meets all applicable requirements. [Equipment maintenance](https://stationboss.net/equipment-maintenance/)

For the station board, Station Boss describes remotely configured, station-paired screens with full-screen dispatch takeover and automatic reconnect. It explicitly says internet connectivity is required for live updates. The public description does not prove the transport is exclusively event-driven rather than polling. [Station display system](https://stationboss.net/fire-station-display-system/)

Its support page describes configuration assistance and train-the-trainer onboarding; data migration may be separately charged. This is another reason to include a simple setup checklist and an employee preview in Stickney. [Support and onboarding](https://stationboss.net/support-services/)

## 4. Recommended Stickney experience

These are design recommendations, not claims that the changes are already implemented or that all three vendors provide the exact behavior below.

### Crew starting screen

Use five clearly named jobs: Daily check, Weekly check, Inventory count, Air packs & bottles, and Meds & supplies. Preserve the existing equipment search, reports, repairs, and administration tools, but keep them secondary to doing today's work.

Each job should say what it covers, what is due, what is already in progress, and what action comes next. Label a fully answered but unsubmitted check **Review & submit**, not Resume. Clearly distinguish today's due work from older unfinished checks.

### One consistent work screen

Keep a compact header visible: apparatus/location, check type, section, progress, and save state. Use a named Back action, Previous section, and Next section. Preserve the user's place. Keep an optional All sections view for experienced crews.

| Workflow | Primary experience | Important safeguard |
|---|---|---|
| Daily | Walk through only the configured daily requirements | Do not mix the full weekly inventory into daily work |
| Weekly | Walk through weekly sections in physical order | Do not silently remove requirements to shorten the form |
| Inventory | Compare expected items/quantities with what is actually present | Never infer a physical check from navigating past an item |
| Air packs/bottles | Identify the correct pack/cylinder, enter required readings, save, then continue | Preserve separate asset identities; require actual readings where configured |
| Meds/supplies | Pick location and lot, review expiry and quantity, record use/receive or request restock | A request is not a received shipment; approval must not falsely increase stock |

### Trustworthy saving and completion

Show **Unsaved changes → Saving → Saved at [time]**, with a distinct **Save not confirmed** state when the response is lost. Do not claim failure means the server definitely did not save.

Review must identify unanswered items, unsaved readings, and unresolved save errors. Submission should return a report identifier, time, and next action. It must not imply that every item passed or that an officer approved the check.

Do not automatically retry quantity changes or notification sends unless duplicate-safe processing is established. Otherwise, a lost response could double a stock adjustment or send multiple messages. Confirm server state before retrying an uncertain operation.

### Reporting a problem

Use one short form from the item: what is wrong, notes, required evidence, urgency, and an explicit recipient preview. Preserve the current photo requirement unless the department approves a different policy.

Show four separate facts:

1. **Report saved:** the system has a persistent record and report number.
2. **Assigned to:** the person or team responsible for follow-up.
3. **Notification status:** not configured, queued, provider accepted, or failed, according to available evidence.
4. **Acknowledged:** only if the recipient explicitly acknowledged it or the system genuinely supports that evidence.

An email draft is not a sent email. A provider accepting a notification is not proof a person saw it. An urgent equipment concern must continue to follow the department's direct-notification and removal-from-service procedures; a software message is not a substitute.

Proposed routing categories for administrator configuration—not assigned personnel or new department policy:

- Apparatus/mechanical issue → designated apparatus-maintenance owner.
- Air-pack/cylinder issue → designated SCBA owner.
- Medications/supplies → designated EMS or stock owner.
- Officer awareness or escalation → the department-selected officer/backup recipient.

Names, backup coverage, urgency thresholds, and delivery channels still need department configuration. An unset route must be visible, not hidden behind a green success label.

### Administrator setup

Provide one setup path: choose unit/location, organize sections, choose check frequencies, assign requirements, configure problem routing, preview as an employee, then activate. Keep template editing out of the checker's main path. Version published templates so later edits do not rewrite historical reports.

Put “Needs my review,” “Unassigned problems,” “Overdue work,” and “Low/expiring stock” ahead of configuration tools. Make repair responsibility explicit without granting ordinary employees administrative access.

### Live Operations board

Show a compact readiness summary and actionable exceptions, not the whole form or administrative controls. A submitted check with a defect is different from an all-clear check. An open repair is not automatically proof the apparatus is out of service; use the authorized operational status.

Update relevant displays after confirmed changes. Preserve reconnect/reconciliation safeguards; do not promise that removing all background checks would be reliable merely because competitors advertise “real-time.” First Arriving's First Due integration documentation itself describes different mechanisms for alerts, scheduling, assets, and scheduled reports. [Integration documentation](https://support.firstarriving.com/support/solutions/articles/36000299928-first-due)

## 5. What the current Stickney source establishes

Reviewed files: `app/inventory-operations.tsx`, `app/inventory-live.tsx`, `app/api/operations/route.ts`, `app/api/fleet-notices/route.ts`, and `public/fleet-notices.js`.

- Individual check results and final submission are already separate operations. Keep that distinction and make it more obvious.
- The check interface already has filters, progress, save-status components, and a completion area. Simplification can build on these rather than replacing the system.
- Repair notices store selected assignees and create linked repair records. The assigned-notice endpoint and Home script display those notices inside the app.
- The reviewed notice response returns a saved notice identifier, not delivery confirmation for email, SMS, or push. External delivery was not verified.
- The report-email helper opens a `mailto:` draft. Its label and confirmation must not imply automatic sending.
- Restock requests and administrator approval are distinct actions. Preserve this separation.
- The current stock interface explicitly excludes a controlled-substance custody workflow. Do not relabel ordinary stock management as a compliant narcotics system; that would be a separate, policy-reviewed project.

These source observations do not establish deployed behavior, production configuration, or end-to-end delivery. No application source was modified as part of this research.

## 6. Acceptance tests for implementation

Use fictional local records first. Test normal employee and administrator access separately, on phone and desktop.

1. Start each of the five jobs without knowing its internal module name.
2. Complete one section, go back, and resume at the same position with confirmed answers intact.
3. Enter a numeric reading without saving; verify that Next, Back, and Submit handle it clearly without silent loss.
4. Simulate slow saves, a lost response, offline connectivity, reload, and edits made while saving.
5. Verify that repeated taps or retrying an uncertain stock transaction cannot count it twice.
6. Report a failed item; verify the linked issue, assignee, configured recipients, and truthful notification outcome.
7. Revisit an item with an existing problem; avoid duplicating the repair unnecessarily.
8. Complete an air check without mixing up the pack, installed cylinder, or spare bottle identities.
9. Request stock, approve it, and fulfill it; distinguish each stage and preserve an audit trail.
10. Submit a fully answered check containing a failure; retain the failure and do not mark the apparatus automatically ready.
11. Verify that an employee cannot change templates, approvals, or other privileged configuration through either the page or API.
12. Verify that the station board changes only after confirmed persistence and explains stale or disconnected data.

## Implementation — September 21, 2026

Implemented from the combined research, without new dependencies or database changes:

- Guided section navigation for daily, weekly, inventory, and air checks. Explicit Next/Back, all-section search, section progress, separate issue review and submission. Unknown/empty checks cannot be submitted.
- Mounted air-check drafts survive section navigation and other entries saving. A newly received crew revision does not silently replace a local draft. Unsaved readings block submission and leaving work is guarded.
- Successful writes refresh in the background without unmounting forms. Server acknowledgment receipts, serialized writes, bounded general save requests, and uncertain-response warnings separate saving from submission and notification.
- Air equipment opens on weekly checks; current progress determines Start, Resume, or Review & submit. Templates, physical asset records, IDs, and maintenance remain available.
- Due-job filtering and collapsed service/admin controls. Inventory stock offers search, attention filtering, explicit lot/location selection, expiration warnings, and confirmation before a quantity change.
- Repair assignment explains in-app recipients and explicitly disclaims external message delivery. Existing linked repairs are surfaced beside check items. Employee repair-access limits are explained instead of appearing as a dead end.
- Phone status text and tablet stock-warning contrast were corrected after rendered checks. The already published portal usability commits were incorporated to avoid rolling them back.

Verification: 108 inventory tests passed, including existing transactional rollback, tenant/permission, completion, location-change, and air-asset checks; focused component lint passed. Local production build passed before final release preparation. Browser testing used fictional, local-only records: daily check through submission; air packs, RIT and spare bottles through submission; failed reading save and successful retry; delayed air save with disabled controls; draft preservation across section navigation and another entry's save; desktop report queue; exact second-lot adjustment with first lot unchanged; employee view without setup/approval/repair-management controls; 390px phone and 768px tablet screenshots plus 1366px desktop interaction. These are not live record submissions.

Remaining verification/policy boundaries: no physical phone camera/GPS test, no actual member walkthrough, no live issue-photo upload or message delivery, no production stock movement, and no station-board event triggered. Existing backend atomicity tests cover failed inspection rollback; the browser fixture does not simulate private evidence storage. Controlled-medication custody remains a separate policy-reviewed workflow. Standalone repair notices still require the existing repair-management permission. An ambiguous stock response requires checking the saved quantity before retrying; this release does not claim full network-level idempotency for stock adjustments.

## Original research handoff (before implementation)

Research and read-only Check It inspection completed. The workflow redesign above is not implemented or pushed by this research step. The earlier unpushed Daily Log work remains untouched. Full save, notification, and medication acceptance testing remains part of implementation—not something claimed from this competitor review.
