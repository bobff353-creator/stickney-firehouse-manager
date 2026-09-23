# Chief review and department handoff — September 23, 2026

## Recommendation

Use a controlled pilot of demonstrated workflows. Full department acceptance still needs documented account control, a successful database-and-file restore, a named support arrangement, and recipient delivery tests. Full training management and business inspections from the separate Fire Operations app have **not** been ported into this Vercel portal. Do not present training announcements or facility safety checks as those modules.

This review is of `https://stickney-firehouse-manager.vercel.app`, repository `bobff353-creator/stickney-firehouse-manager`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. The isolated review branch starts at production revision `169e2be4e74831de0da3cc43fa795b75ea8bb3de`; it preserves the latest Daily Log save and vehicle-check safeguards. It does not modify the Fire Operations Sites project.

## What could make the chief say no

| Concern | Finding and action |
| --- | --- |
| An employee number could be used to create an account without proving email ownership. | Closed the unsigned `/api/auth/activate` path. It fails with 403 and directs users to administrator invitations. The new-user screen explains invitation, verified email, and private PIN setup. Existing verified sign-in and invitation acceptance remain in place. |
| A green status could be misunderstood as proof of recoverability. | Overall success now requires service checks and all four recovery checks. Missing, failed, or unavailable database, file, offsite, or restore evidence keeps the result at Needs attention. |
| File counts and release labels overstated what was checked. | File inventory explicitly reports metadata, not a successful file open or restore. Unknown usage stays unknown instead of becoming zero. An unidentified release no longer says Production/local or Git-connected. CLI releases can report their exact source SHA. |
| Staff need a clear way back. | Added a visible Back to portal home link on Inventory's Due Now home, retaining the unsaved-work guard. Existing guided check navigation is preserved. |
| Nobody knows who owns the accounts, pays, or supports an outage. | Added System Health → Department handoff & support: six expandable questions with concrete next steps. The page does not claim a transfer or agreement is complete. |
| The software appears officially accepted before approval. | Removed the footer's “Official department system” claim. Department branding remains. |
| Promised modules are not actually delivered. | Explicit acceptance gap for full training records and business inspections; demonstrate attendance, signatures, reports, recurrence, and delivery in this app before accepting them. |

## Verified service evidence

Observed September 23; these are a snapshot, not ongoing guarantees.

- Production Supabase project: `datqzdndkrfyovhwppuq`, `Stickney- firehouse-manager`, active in `us-east-2`; organization `bobff353-creator's Org`, Pro plan.
- Database size: 60,509,331 bytes. File metadata: 4,712,661 bytes over 24 stored objects. These counts exclude files in other providers and do not establish completeness of legacy imports.
- Both observed file buckets are private. `firehouse-portal` allows up to 25 MiB per object; `stickney-inventory-media` up to 20 MiB. These are object limits, not total storage quotas.
- RLS is enabled on all 112 firehouse tables and 29 public tables. Server-side authorization protects operational APIs. Deny-by-default server-only tables are not automatically a missing-policy defect.
- Production dependency audit: zero known advisories in the installed production dependency lockfile. This is not a penetration test or a compliance certification.
- Supabase security advisors still flag authenticated SECURITY DEFINER functions and disabled leaked-password protection. Review function authorization and PIN-derived login compatibility before changing these settings. No permissive RLS policies or account-access changes were introduced by this review.
- The backup monitor received a provider denial. The latest provider backup date could not be verified. Independent file backup, offsite backup, and restore testing are not configured in the app. A Pro subscription does not substitute for actual backup and restore evidence.
- The developer-owner email exception remains in the authorization configuration. Review it during handoff after replacement department administrators can sign in and recover the system.

## Ownership and transfer

Provider control is currently associated with Bob's GitHub, the `fire-pre-plan-pro` Vercel team, and Bob's Supabase organization. These facts do not establish legal copyright ownership or a transfer to the Village.

1. Name two department administrators and a billing contact. Agree in writing on assignment or a durable software license, source access, modifications, data export, continued use, and another maintainer taking over. Preserve third-party licenses.
2. Back up source history, database, file contents, and configuration inventory to department-controlled destinations. Keep secret values in a password manager, not this document.
3. Use the official repository/project transfer processes for GitHub, Vercel, and Supabase. Confirm target plans, permissions, and transfer restrictions first.
4. Reconnect integrations, domains, sender verification, map keys, monitoring, backups, and deployment access as needed. A project transfer is not proof every integration still works.
5. Demonstrate department administrator/member access, file retrieval, exports, restore, and agreed notification delivery. Then reduce obsolete developer access.

References: [GitHub repository transfer](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository), [Vercel project transfer](https://vercel.com/docs/projects/transferring-projects), [Supabase project transfer](https://supabase.com/docs/guides/platform/project-transfer).

## Price and storage answers

USD planning prices checked September 23, 2026. Actual invoices were not reviewed.

- Vercel Pro: $20/month including one deploying seat; additional Owner/Member seats $20 each. Ordinary app users are not paid Vercel developer seats.
- Supabase Pro: starts at $25/month. One Micro project can fit the included compute credit. Includes 8 GB database disk per project and 100 GB file storage; usage, compute, extra projects, and add-ons can increase the bill.
- Resend: free 3,000 emails/month with a 100/day limit; Pro $20/month for 50,000 with additional usage billed separately.
- Minimum example: $45/month ($540/year) for one Vercel seat and one Supabase Micro project, before extras.
- Handoff example: $105/month ($1,260/year) for three Vercel seats (two department owners and one maintainer), Supabase Pro/Micro, and paid email, before extras.
- Both examples exclude domain, maps, independent backup storage, taxes, security add-ons, usage overages, development, and maintenance labor. Obtain a separate support quote; there is no agreed maintenance price or response commitment in this review.
- Supabase Pro database backups have seven-day retention; **database backups exclude uploaded file contents**. Department record retention must follow its approved schedule, not the default provider backup window.

Sources: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Supabase pricing](https://supabase.com/pricing), [Resend pricing](https://resend.com/pricing), [Supabase backup limitations](https://supabase.com/docs/guides/platform/backups).

## Maintenance and acceptance

Assign primary/backup maintainers, support hours, incident contacts, patch cadence, update approval, recovery objectives, and transition assistance. Provider hosting does not include custom-app maintenance.

Recommended cadence: daily automated service/job/backup/delivery checks to a named recipient; monthly invoices, access, dependency/security and failed-delivery review; quarterly isolated database-and-file restore exercise. This is a proposed operating schedule, not a newly enabled monitor.

For each release: test with fictional records, record the exact source revision and schema changes, publish deliberately, verify the live alias, and retain a compatible rollback. Rolling back Vercel does not reverse a database migration. This review requires no database migration.

Acceptance walkthrough: member finds a shift and understands pending versus assigned; crew resumes the correct vehicle check and handles exceptions; officer sees Daily Log server-save confirmation separately from sign-off; responder finds a preplan and photos; administrator demonstrates permission boundaries, invitation/removal, real recipient email/push delivery, restore, and a second administrator taking over. Use existing department procedures during a pilot or outage.

## Validation and limits

- Live, read-only checks: Home briefing and action destinations; Inventory Due Now and guided check choices; Daily Log server-save versus officer-sign-off status; System Health service/usage/recovery evidence. No real record submissions were used for acceptance testing.
- Local real-component fixtures: handoff sections, invitation directions and Back control; 390-pixel phone layout with no horizontal overflow; corrected dark-mode link contrast; no console errors in the tested local sequence. Fixtures are labeled fictional and block operational writes.
- Focused security/readiness suite: 53 tests passed. Full regression run: 992 tests, 990 initially passed and two outdated source assertions failed. Updated those assertions to match the release-identity helper and the existing stricter check-submit guard; all 18 tests in the three affected files passed on rerun. No failed behavior test was bypassed.
- Scoped ESLint passed. Production build passed; final release verification is recorded separately below.
- Prior route-by-route navigation work is documented in `USABILITY-COMPARISON-2026-09-21.md`. This review does not claim a new end-to-end submission test of every module. The attempted live preplan revisit hit browser-control timeouts; existing compact preplan changes are preserved in the base release.
- No invitation, email, push, operational record, account permission, provider purchase, or ownership transfer was submitted. Delivery and restore remain acceptance tasks.

## Release receipt

Before this change, the verified production deployment was `dpl_FcUVPTxgngTAJcoDM8iGWR7AZUFW` at revision `169e2be4e74831de0da3cc43fa795b75ea8bb3de`. Deployment of the reviewed revision and live verification will be recorded after publishing. The prior deployment remains the application rollback candidate, subject to a fresh compatibility check.
