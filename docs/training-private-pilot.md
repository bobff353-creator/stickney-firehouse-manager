# Training private pilot

Owner: bobff353@gmail.com. Production route: `/?page=training&display=portal`.

## Scope and navigation

Three starting actions: Record training, Assign training, Check credentials. Details, People, Review steps use Back, Save draft, and an explicit final save. No autosave or background polling. Existing employees are referenced by stable IDs; payroll and scheduling are not changed.

Activity forms support text, numbers, dates, choices, yes/no, and optional required fields. Member groups, actual attendance, linked assignment completions, archive/restore, audit history, private files, calendar, filtered CSV/print reports, initial/renewal task books, and department/external credentials are supported. Drafts, archives, and test records never contribute training hours. Test names must be `test/training`.

OSFM task books has a searchable, scrollable picker for all 37 catalog certifications and the 36 verified official books/forms. Search names, rule sections, NFPA standards, JPR numbers, or topic tags. Initial and recertification editions remain separate. The 818 JPR entries have 793 verified individual task-page links; the remaining entries use the published index. Topic tags are search aids inferred from TASK headings, not substitute instructions. The full official book opens in another tab while selections remain in the app. OSFM rejects cross-site PDF embedding; no broken inline viewer is shown. Missing books remain labeled unverified.

Users can select individual tasks, all shown tasks, or whole-book references and carry them into training, assignments, or reusable activities. IDs and original book fingerprints persist with the record and appear in review/history/CSV. They do not award proficiency or create official credit. Existing records without these optional fields still load safely. Choosing Use this task book creates a credential editor with its official index prefilled.

Vector was reviewed signed in: home, activity builder and components, completion entry, participant filters, assignment timing/email choices, history and credentials. A single template named `test/training` was saved there (activity 3517645), with no assignments or training credit.

This is a private administrative pilot. Employee self-service, outgoing email/push, licensed Vector courses/SCORM, examinations, community forums, and vendor integrations are not implemented. These must not be represented as functioning features. Direct OSFM submission is explicitly NOT CONNECTED.

## Official sources reviewed 2026-09-24

- Certification catalog: https://sfm.illinois.gov/about/divisions/personnel-standards/current-list-of-certifications.html
- Current Section 141.390, effective November 24, 2025: https://www.ilga.gov/commission/jcar/admincode/041/041001410D03900R.html
- Official forms: https://sfm.illinois.gov/about/divisions/personnel-standards/basic-forms.html
- Separate proposed changes: https://sfm.illinois.gov/resources/proposed-rule-changes.html
- Course approvals: https://sfm.illinois.gov/about/divisions/personnel-standards/certification-exam-information.html
- State tracking program: https://sfm.illinois.gov/iam/firedepartment/ilfftrainingtrackingtool.html

The catalog includes 37 levels, 28 on the current recurring-renewal list, and 36 linked official books/forms. JPR indices come from published proficiency logs or clearly numbered task-sheet headings; the full official instructions remain linked. Inspector I practicum and investigator tally do not use a generated JPR index. Missing books remain explicitly unverified. Optional custom task lists require official source/edition verification.

Some older filenames now serve May 2026 PDFs. Store edition, PDF page, reviewed date, and SHA-256 fingerprint; do not infer edition from filename. Initial and recertification books can use different NFPA editions. Old officer initial books remain linked as currently published; verify applicability with OSFM. No proposed 2026 requirements are treated as active. Renewal dates must be entered from the verified official record; the app does not assume or award a renewal. Section 141.390(e) and (f) overlap on January 1, 2022, so no automatic issue-date conversion is offered.

Run `python scripts/audit-training-osfm-sources.py` with pypdf installed to download/cache public sources under ignored work/training-sources and rebuild the factual index. Inspect changes before publication. Proficiency PDF page references include the cover.

## Security and persistence

Training is excluded from assignable permissions. API endpoints require the verified owner email and department supplied by the existing authentication proxy; forged public headers cannot bypass proxy authentication. Existing portal login, PIN, same-origin protection and department membership remain in place.

Three firehouse tables have RLS enabled and no direct anon/authenticated table grants. The existing server-authenticated SQL gateway is used only after the owner boundary. Attachment storage is private; policies require server proof, department membership, and the actual auth.users owner email. Downloads recheck the owner/department. Allowed PDF/JPEG/PNG/WebP files are size and signature checked (4 MiB maximum).

Each save and audit entry share one transaction. Optimistic versions reject stale edits. An identical retry after a lost response returns the already-saved version without double credit. Failed saves keep the editor populated. Archive preserves records/files/history. No hard-delete interface is exposed.

## OSFM handoff boundary

Versioned JSON includes IDs, external identifiers, credential dates, source references/fingerprint, evidence, and protected attachment references. It is a review package, NOT a documented OSFM upload contract. No submission is sent and no receipt is fabricated. A future connector requires OSFM authorization, a confirmed API/import contract, mappings, delivery idempotency, receipt reconciliation, and chief review of official evidence. Current investigator points are manually documented against the official tally; unsupported categories/rates are not invented.

## Verification

Focused tests exercise owner denial, non-grantable navigation, dates, exact attendance math, test/draft exclusion, form validation, task cycle/edition matching, handoff boundaries, CSV injection protection, atomic database rollback, retry deduplication, stale versions, archive history, and private attachment denial. Local browser fixtures use fictional members only. Test failed save/retry, report filters, reload, task-book selection/progress, phone layout, and then authenticated production save/read/attachment persistence before claiming live verification.

The live owner account saved and reopened activity `test/training` (8080b864-61eb-4608-9348-f92c8200722c); database and audit persistence were independently confirmed. Version 2 saved JPR 7.3.1 from the Confined Space Technician recertification book with its source fingerprint, and two audit versions were confirmed. No employee was assigned or credited. Automated file selection is currently blocked by Chrome despite the reported extension permission; production upload/download remains unverified. Server tests verify byte-preserving upload/download, department isolation, invalid-file denial, and object cleanup after a metadata failure.

Routine same-account SIGNED_IN refreshes now keep the verified tool mounted. New accounts, revoked membership, invalid PIN sessions and sign-out still remove access. Four regression tests exercise these transitions; the fictional browser form retained its draft during refresh and locked after a real denial. This is UI continuity only; server authentication is unchanged.
