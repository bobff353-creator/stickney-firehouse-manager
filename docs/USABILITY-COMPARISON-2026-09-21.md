# Stickney usability comparison

Reviewed September 21, 2026. Target: [Stickney Firehouse Manager](https://stickney-firehouse-manager.vercel.app/). Comparison: [Fire Operations](https://fire-operations-network.bobff353.chatgpt.site/). Visual reference: [Flow MSP](https://app.flowmsp.com/).

## Recommendation

Keep Stickney's connected Daily Log, payroll, response, and fleet workflows. Use Fire Operations' clear section labels and Flow's compact map-and-record presentation to make those workflows easier to find. A screen with more fields does not automatically win: the person must know what to select, what happens next, and whether their work saved.

The changes in this release improve navigation across the existing portal, expose scheduling choices, and simplify preplan reading. They do not combine the two databases or move training and business-inspection records between applications.

## What was actually examined

- Live Stickney: Daily Log, Maps & Preplans, and Station Schedule. Read-only; no operational records were submitted.
- Live Fire Operations: scheduling/calendar and its member labels.
- Live Flow: Blue Kangaroo Laundromat, 6645 W Pershing Road, including its map, Location and Building presentation. No Flow records were changed.
- Source review: all 32 Stickney portal destinations, shared navigation, administration task routes, fleet/checks, and corresponding Fire Operations module definitions and specialized workspaces. This provides evidence about available controls; it does not prove real delivery or persistence.
- Browser verification of changes: actual Stickney components with fictional, local-only records. Tested tool search, routing, preplan tabs, back navigation, department-wide filtering, empty results, and a 390-pixel phone layout. A member could not find the restricted Permissions tool.
- Automated validation: 30 relevant Stickney checks passed, production build passed, and lint had no errors. One existing unused-component warning remains. Fire Operations' five member-label tests and production build passed.
- Published verification: both updates are live. A fresh signed-in Stickney browser confirmed All tools search, visible scheduling choices, all 221 existing directory records, and the Systems tab on Stickney Public Works. The live Fire Operations calendar now shows Member not linked for blank-email records instead of an unrelated person's name.

No grades below represent a timed user study, certification, or emergency-readiness approval. **A** means clear and direct; **B** means usable with a small learning step; **C** means substantial explanation or several separated controls; **D** means a missing or misleading path. A dash means there is no comparable workflow. Grades are qualitative design judgments. “Source” means the behavior was inspected in code, not completed against live department records.

## The eight questions you asked

| Question | Stickney before | Stickney after this release | Reason |
|---|---|---|---|
| Do I understand what this screen is for? | B | B+ | Screen-specific purpose remains visible through help; no generic instructions copied across unrelated jobs. |
| Where do I go? | C+ | A- | All tools is available from the portal's workspace guide, with six common-task buttons and searches for crew terms such as calendar, airpack, meds, and repairs. |
| What is next? | B- | B+ | Start & next instructions and related-work buttons; scheduling sections stay visible when switching tasks. |
| How do I go back? | B+ | B+ | Existing record-aware Back behavior retained and checked for preplans. Modal tools have a Close button and Escape support. |
| How do I set it up? | C+ | B+ | Set up opens the actual permitted administration tasks for the current screen. It does not grant additional permissions. |
| How do I change it? | B | B+ | Save & change guidance identifies the correct editor and separates source records from read-only summaries. |
| How do I save? | B | B+ | Guidance distinguishes autosaved hours, explicit Save, private drafts, submission, approval, and publication. The underlying save workflows were preserved. |
| How do I notify someone? | C | B- | Notify explains the existing route and its limits. Phone-alert status now reports a failed status check accurately; a failed unsubscribe request cannot show a false success. Actual email/push delivery was not tested. |

The eight questions apply to each area below. The shared help now covers every portal destination; the standalone Inventory workspace retains its own navigation and save controls.

## Individual areas

| Area | Stickney clarity, before → after | Fire Operations clarity | Preferred part and decision | Evidence |
|---|---|---|---|---|
| Home / overview | B → A- | B+ | Fire Operations has clear module grouping. Stickney now offers common task buttons and All tools without replacing its department briefing. | Source; local chooser |
| Respond / incidents | B → B+ | B | Keep Stickney's response-oriented incident and apparatus context. A generic incident record is not a substitute for its response workflow. Add direct related links to preplans, Command Board, and device setup. | Source |
| Live Operations / calendar / announcements | B → B+ | B | Keep Stickney's shared live board and existing staffing/duty links. Explain where notes and events save, and distinguish the board calendar from the staffing calendar. | Source |
| Command Board | B- → B | Keep separate | Keep incident assignments and accountability in their dedicated workspace. Help leads with choosing the incident. Fire Operations' incident form is a different workflow. | Source |
| Maps & Preplans: find a record | C+ → A- | B+ | Flow's map-plus-short-record approach wins visually. Added All department records, Show Stickney map, and Clear search so a map centered away from town does not look like missing data. | Live; local |
| Maps & Preplans: read a building | B- → A- | B+ | Added Building, Systems, A–D photos, and Contacts buttons. Building summary and quick systems appear first; record actions stay identifiable. Printed records retain all sections. | Source; local |
| Preplan editing / footprint / symbols | B → B+ | B+ | Preserve Stickney's existing footprint, mapped systems, photo annotations, and save protections. Explain that building, systems, photos, and operational publication have separate saves. No invented building information or Flow measurements were copied. | Source; Flow layout live |
| Hydrants | B → B+ | B | Stickney's focused hydrant record and flow-testing workflow are stronger than a generic asset-style form. The new directory controls and related help also apply here. | Source; tests |
| Road Closures | B → B+ | — | Keep the dedicated map/activation/resolution workflow. Make the next step and relationship to Respond explicit. | Source |
| Daily Log | A- → A- | C+ | Stickney wins: dated staffing, actual worked times, calls, callbacks, save status, and officer sign-out belong together. Fire Operations' log is a more general time/activity record. Preserve Stickney's connections. | Live; source |
| Station Schedule: calendar and own shifts | C+ → B+ | B+ | Fire Operations' visible section navigation is clearer. Stickney now keeps its task choices open, including on phones, while preserving its calendar and member permissions. | Live; local phone |
| Availability / open shifts | B → B+ | B+ | Keep distinct availability and open-shift tasks. Added common search terms and a visible route back to calendar. Request submission must remain distinct from assignment. | Source; navigation tests |
| Trades / requests | B → B+ | B+ | Offer a trade, Accept a trade, and My Requests remain direct choices. Setup help links to existing administrative review tools. No trade or assignment was submitted during this audit. | Source; local navigation |
| Schedule setup / overtime / reminders | C+ → B | B | Both contain substantial administration. Keep daily staffing separate from templates and rules; route setup help to the actual task. Delivery and automatic-award behavior need their own operational acceptance checks. | Source |
| Daily Duties | B+ → A- | B | Keep Stickney's today/week instructions and links to apparatus checks. Add clear guidance for editing and Approve & Save. | Source |
| Vehicles / apparatus | B+ → B+ | B+ | Stickney's integrated Fleet workspace remains the main vehicle route. Fire Operations has an approachable per-vehicle workspace. Shared task search now finds vehicles, checks, service, and manuals by familiar terms. | Source |
| Daily and weekly checks | B+ → B+ | B+ | Keep per-vehicle checklists, resume paths, and completion controls. Expose the existing check setup through task navigation; no completed checks were rewritten. | Source |
| Equipment / medication / airpacks / cylinders | B → B+ | B | Keep separate equipment categories and vehicle/location context. Search synonyms improve entry into Inventory. No quantities, expiration dates, or service statuses were invented. | Source |
| Repair history / receipts / warranties / manuals | B → B+ | B+ | Preserve linked repair and document records. Navigation now recognizes repair, maintenance, manual, and warranty vocabulary. This release does not change attachment storage. | Source |
| Station/facility safety inspections | B+ → B+ | Different scope | Keep draft, submit, history, reopen, evidence, and report controls. Clarify that Email report opens the mail application; it is not a delivery receipt. | Source |
| Business fire inspections | — | B+ | Fire Operations has the broader specialized inspection workspace. Stickney's station-safety checklist is not equivalent. No claim of parity or cross-app record transfer is made. | Source; earlier requested workflow context |
| Training / attendance / credentials | C for discovery of provider information; no equivalent full workspace | B+ | Fire Operations has the stronger dedicated training workspace. Stickney's provider feeds do not equal verified training credit, credential tracking, or OSFM submission. This remains a capability difference. | Source |
| Employees | B+ → B+ | B | Keep Stickney's member, rank, qualification, and access relationships. Help distinguishes profile Save from sending a login invitation. | Source |
| Employee Contacts | B+ → A- | B | Keep the simple searchable directory and call links. Related links show where an authorized person changes the source profile. | Source |
| Important Phone Numbers | B+ → A- | Documents/contacts | Keep the dedicated reader and Save Contact / Preview directory controls. Task search includes dispatch, hospital, vendor, and telephone. | Source |
| Policies | B+ → A- | B | Stickney's policy reader and Save & view remain strong. Shared task search now recognizes SOP, SOG, procedures, and manuals. Policy acknowledgment is not implied by opening the record. | Source |
| Box Cards | B+ → A- | B | Preserve Stickney's department/card selection and original source links. Help explicitly distinguishes viewing a card from dispatching units. | Source |
| Holiday Policy | B → B+ | Documents | Keep as reference and link to Station Schedule for requests. Reading guidance must not look like a submitted request. | Source |
| EMS forms | B → B+ | Documents | Keep clear open/download actions and explain that work inside the PDF is separate from the portal record. | Source |
| Payroll | B+ → B+ | — | Stickney wins on department-specific integration. Preserve reviewed/finalized states and access controls. All tools helps members reach the correct hours screen. | Source; existing navigation guards tested |
| Timesheets | B+ → B+ | — | Preserve field-save behavior, failures, and finalized-period protection. Explain when a save occurs and how to return to Payroll. | Source; tests |
| My Timesheet | B+ → A- | — | Keep a simple personal read-only screen and correction request. Clearly distinguish it from administrative timesheets. | Source |
| Callback Reviews | B → B+ | — | Keep callback attendance, flags, approval, and payroll context. Related-work links improve orientation. | Source |
| Work Details | B → B+ | General scheduling | Keep assignment and pay approval as distinct steps. Setup help links to the existing request review route. | Source |
| Command Center / analytics | B → B+ | Overview | Keep source-backed historical reporting. Explain that charts are summaries and live response belongs in Respond. | Source |
| Activity Timeline | B → B+ | Record history | Keep department-wide history; clarify read-only history versus editing the source record. | Source |
| Rates & Rules | B → B+ | — | Preserve effective-dated rates. Setup and save help lead with the date and affected pay period. | Source |
| Departments | C+ → B | Settings | Explain that Add Department creates another workspace; it does not rename the current one or publish a site. | Source |
| Permissions | B → B+ | Settings / roles | Preserve rank defaults and individual exceptions. All tools and setup links use the same permission filters. | Source; local member check |
| Test View | B → B+ | — | Keep the read-only preview and Exit test view path. Explain its limits without presenting it as actual member authentication. | Source |
| System Health | B → B+ | Settings / health | Preserve unavailable states; a connection indicator does not prove every subsystem is working. | Source; tests |
| CAD Integration | B → B+ | Integration settings | Keep configuration, validation, and delivery evidence distinct. Do not create a real incident as a usability test. | Source |
| Respond Device Modes | B → B+ | Device / notice settings | Explain browser/device scope and link to the existing phone-alert control. | Source |
| Phone and email notification state | C → B- | C+ | Corrected false phone-alert status on a failed read or failed disable request. In Fire Operations, reminder rules and email/push delivery remain separate; this review did not send notices. | Source; build |

## Flow design findings

Flow's clearest pattern is the relationship between the overhead map and a short set of labeled record tabs. It makes the building the focus. The original Stickney app already supports richer photo/system information, but a long record makes it harder to find the useful part quickly.

This release applies that grouping to Stickney's reader. It also gives the building heading and map labels explicit contrasting colors. A–D pictures and their existing annotation controls remain available. Map GPS locations and photo annotations remain separate concepts.

Flow's displayed building values were used only to understand presentation. No roof area, fire-flow figure, contact, system description, or building condition was imported or inferred from that screen.

## Fixes delivered in this change

1. All tools chooser, common-task buttons, and crew vocabulary search across permitted portal destinations.
2. Start & next, Save & change, Set up, and Notify help for all 32 portal pages, with permission-filtered setup and related-work links.
3. Scheduling choices stay visible instead of closing after each selection. Phones use labeled horizontally scrollable choices.
4. Preplan reader separates Building, Systems, A–D photos, and Contacts.
5. Preplan directory adds All department records, Show Stickney map, and Clear search; heading/map contrast corrected.
6. Phone-alert status does not claim alerts are off when the status service failed, and disabling checks the server response.
7. Fire Operations no longer assigns a blank-email shift the name of the first person with a blank email. It shows Member not linked; genuinely open shifts show Open shift. Original shift titles and stored records remain intact.

## Limits and remaining capability gaps

- Business fire inspections and full training management are stronger, separate Fire Operations workspaces. They were not recreated in the original portal by this navigation release.
- No actual push, email, schedule award, inspection recurrence, payroll update, or emergency response was triggered to test a screen. None should be described as end-to-end verified by this review.
- Fire Operations' background reminder runner and sending-provider configuration were not connected in this release. Existing settings are not proof of delivered reminders.
- Browser interaction with the original Chrome session became unavailable partway through the audit. A fresh browser later restored access for the published checks described above. The evidence column still separates broader source review from the specific paths actually verified live.
- Usability grades should be revisited after firefighters try the changed paths on their own phones. A useful acceptance exercise is: find tomorrow's shift, offer a trade, start the correct vehicle check, find an FDC photo, return to the list, and confirm what saved.
