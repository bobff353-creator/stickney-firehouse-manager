# Preplan usability review — November 23, 2026

Goal: make it easy to find a building, understand the current version, edit the right information, save safely and know what happens next. Keep the complete workflow, evidence, permissions and saved records.

## Walkthrough before changes

Reviewed production revision `8013b7520192` with the verified department account. The overview loaded 76 buildings and 212 hydrants. Walked Overview → Preplans → search for a published building → arrival brief → photos/documents → back to the filtered list. Also tried an unmatched search, Review queue and the empty Offline library. No operational record was edited, submitted, approved, deleted or downloaded as a test. A separate fictional local fixture covered the quick editor, full-detail entry and save/recovery wording.

This was an end-user task walkthrough by the assistant, not a claim that a crew member completed field acceptance. Live viewing used the current administrator account. Crew/read-only differences and save/failure cases require local role fixtures and API tests; physical phone/offline operation remains separate.

## Findings and fixes to make

| Priority | Finding and evidence | User impact | Planned fix |
| --- | --- | --- | --- |
| High | The arrival brief's unknown-detail chips are plain text, including the photo-side chips. The earlier quick-review links do not cover this screen. | The user can see what is missing but cannot go directly to its editor. | Make each chip an edit action for authorized editors, opening the correct existing section with the current device draft retained. |
| High | The main record action says **Edit quick preplan**; Building details and Capture building outline are separate adjacent actions. | It is unclear where to edit the complete basic preplan and the A/B/C/D photos. | Use one clear **Edit preplan** entry to the complete guided editor; name advanced building measurements separately and provide a direct photo-edit action. |
| High | An unmatched building search offers **Start a preplan** as its main recovery action. | A user looking for an existing building can create an accidental duplicate instead of clearing the search. | Offer **Clear search & filters** and show the result count. Keep deliberate creation separate. |
| Medium | Preplans displays both **Search preplans** and **Filter buildings**, bound to the same query. | Two boxes appear to have different jobs. | Keep one labeled building search on the list; retain cross-screen search where it has a distinct purpose. |
| Medium | The map overview's main action is **Quick preplan**, with no explicit find/edit task entry. | A returning user has to infer the path to an existing record. | Add **Find or edit a preplan**, use **Add preplan** for creation, and give one short next-step explanation. Keep map/list tools. |
| Medium | **Keep draft & exit**, **Save & exit**, and device/cloud indicators require reading secondary help to understand their different destinations. | A device-only copy can be mistaken for a department save. | Label device-only and department saves explicitly; keep a short save/review explanation visible near the editor controls. Never claim saving publishes a record. |
| Medium | Full-detail device drafts fall through to the quick three-step resume label. Source inspection confirms the mismatch after opening all details. | A six-step draft can be described as a quick draft at the wrong step. | Display the correct editor type and six-step progress without changing the saved data. |
| Medium | A record opened from Review queue uses the default Back to preplans label and callback. | Returning from review loses the task context. | Return to the same queue with the corresponding back label and retained filters. |
| Medium | Record edit/observation controls render without checking their grant; their callbacks then reject read-only accounts. | Read-only crew see actions they cannot finish. | Hide unavailable edit actions, retain reading/printing/export, and explain read-only access. Keep all server checks. |

## What already works and must stay

- Search finds a published building by name and retains the query after returning.
- Unknown is visibly different from absent; source conflicts and provenance remain visible.
- Approval is separate from saving and submission. Existing approved snapshots and revision history remain available.
- Photos and source PDFs remain linked to their original files. Do not relabel old observations as newly verified.
- Offline library accurately explains that only deliberately saved published text/exterior photos are available; maps, PDFs and live status are excluded. Its empty state already gives a useful next step.
- Existing draft export, conflict recovery, validation, address confirmation, review acknowledgement and permission boundaries must remain.

## Verification required after fixes

Walk through find/open/edit/missing-details/photo navigation, clear-search recovery, return to queue, device-only versus department saving, failed save/retry, stale-record recovery, full-detail draft resume and read-only controls. Check 390/820/1440 widths and both themes. Run domain/API preservation tests, TypeScript, changed-file lint, production build and diff checks. Verify the exact production revision and unchanged department record fingerprints. Record local fixture results separately from live read-only verification. Do not create fictional production records or approve an operational preplan to demonstrate the UI.

## Implementation status

An additional return-path issue was found while exercising save-and-exit: the editor clears the selected record and can return a changed review copy to an empty queue. The follow-up fix will open the just-saved working copy, label it as not approved, and offer Review & send. Device-only exit will keep its separate resume path.

Report completed before implementation. Findings above are the scope for the next change; results will be recorded below after verification.

## Implemented and checked

All nine listed findings were addressed. Save-and-exit now opens the saved working copy with an explicit not-approved label and a Review & send action. Device-only exit returns to the draft list with a Resume instruction. No validation, publication step, source-file link, record ID or server permission was removed.

Local browser workflow used an isolated fictional transport, never production writes: one list search; unmatched-query recovery; missing gas/detail and D-side photo navigation; failed save retaining edited text; successful retry; saved working-copy return; review submission without publication; correct queue Back action; conflict/export recovery controls; device-only exit and full six-step resume; read-only controls. Upload delivery and physical-device offline recovery were not re-proven by these fixtures.

Phone (390), tablet (820) and desktop (1440) layouts were inspected with light and dark appearance. Save controls wrap, remain readable and stay within the viewport. Desktop document widths were 1425/1440 and tablet 805/820, with no horizontal page overflow. Temporary browser overrides were reset.

34 arrival tests passed, including the actual migration/API preservation, conflict and reviewer-permission tests. TypeScript passed. Changed-file ESLint reported zero errors and 24 existing warnings. Production build and final revision verification are recorded in the release evidence after publication. No database migration is required.

Live review baseline before deployment: 76 source preplans, 22 working records, 142 photo links, 13 document links and 212 hydrants. Read-only fingerprints were captured for all five tables in the dedicated firehouse schema. No production preplan was edited, submitted or approved during verification.
