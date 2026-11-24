# Scheduling employee and administrator review — November 24, 2026

## Delivered changes

- New requests are available-hours submissions only. New PTO and unavailable choices are removed; historical records and restrictions remain intact.
- Availability supports an inclusive date range, every 1–365 days from the first date, or selected weekdays. A required end date, exact-date preview, and existing limit of 93 dates within one year prevent accidental unlimited submissions. This saves dated availability, not assigned shifts or standing crews.
- Available entries can be edited. Saved, pending acceptance, pending administrator approval, and assigned states have separate receipts and useful next buttons.
- Drafts survive failed saves; closing edited dialogs requires an explicit discard. Saving disables the form. Unconfirmed responses require refreshing authoritative data before retrying. Confirmed-save/failed-refresh recovery does not repeat the write.
- Retired patterns are labeled saved history and opened read-only. Required-confirmation settings distinguish drafts, previews, saving, and confirmed saved versions.
- Detailed tools retain the existing scheduling rules, qualifications, approvals, availability consent, standing crews, history, and permission checks.

## Coverage and evidence

Source inventory: 313 native JSX control sites across the scheduling owners, including inactive legacy standalone screen implementations. This is not a claim of 313 distinct live save tests. Owning UI, model, and API paths were reviewed; no API handler, database schema, dependency, or delivery setting was changed.

Isolated browser review used fictional local records and blocked unexpected network endpoints. Evidence is in ignored `outputs/scheduling-role-review-20261124/browser-evidence.json`; export evidence is the fictional `fixture-readiness.csv`.

| Role/area | Exercised workflows |
| --- | --- |
| Employee | My shifts list/calendar, whole crew, dates/months, pagination, coverage and role filters, personal requests, legacy history, request status destinations |
| Availability | Every-day/interval/weekday previews, exact dates, bounds and invalid inputs, save, edit, remove, failed-save retry, draft keep/discard, confirmed save with failed refresh, unknown response with authoritative refresh |
| Trades/claims | Duplicate offer prevention, new targeted trade/swap terms, incoming accept/decline, pending approval, open-shift request, employee/admin permission separation |
| Staffing/approvals | Qualified assignment, first-save failure and retry, clear position, claims approval, accepted trade approval, pending trade denial, special detail, time override/reset, dated extra position add/edit/remove, date navigation |
| Setup | Recurring pattern add/edit/retire using new fictional patterns only, retired read-only history, standing crew add/remove without changing the original fictional crew, people search/preferences, month setup, distribution failure/retry and unfilled seats |
| Detailed tools | Available-only department editor, member switch isolation, deadlines add/remove, reminder timing/rules, required-confirmation preview/no-write and failed-save retry, conflicts/rules validation/discard/save, source refresh, severity/search/date filters, pagination, CSV export and affected-day links |
| Calendar | Morning/noon/night/all views, automatic cycle advances, pause remains paused, empty future month stays empty |

Responsive measurements: 108 combinations with no document horizontal overflow: 15 admin screens and three availability forms at 390/820/1388 pixels, each in light and dark mode. Dialog overflow was also measured for the three availability forms. Visual screenshot inspection supplemented measurements; these are browser viewport simulations, not physical-device certification.

## Validation

- Full `npm test`: **1,788 passed, zero failures**, including production build. An initial obsolete static source assertion was corrected to exercise the shared feedback helper and preserve the existing disabled guard requirements; the full suite was then rerun successfully.
- Final focused scheduling tests: **66 passed, zero failures**.
- Final production build and TypeScript check passed.
- Changed-file ESLint: zero errors; one existing unused `OvertimeScreen` warning.
- `git diff --check` passed.

## Limits

The fixture action helper is a browser contract simulator, not proof of live database delivery. Real permission, availability, conflict, and persistence handlers are covered by source review and the repository tests. The native confirmation for deleting an entire newly created fictional shift was canceled; that full destructive UI branch is not claimed as exercised. Source links in exported readiness evidence were reviewed without opening production write workflows. Physical phones/tablets, real notification delivery, and every possible concurrency/network interruption are unverified. Automatic texts/emails remain off; no test message was sent and no purchase was made.

## Release outcomes

- Source: committed and pushed `95fd56c370e1a28404a5cca87b81e266189695d2` on `codex/watchline-complete-20261123`.
- Deployment: `dpl_74mifBCWz74jUu4qneUe7kH5uoQm` reached READY in verified project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. Canonical and legacy production aliases point to the release. The repository script was attempted but its CLI account scope was inaccessible; the authenticated Vercel connector deployed the same clean committed Git revision.
- Health: canonical `/api/health` reports `95fd56c370e1`.
- Live read-only UI: verified authenticated My schedule, Update availability without PTO/unavailable creation, selected-weekday preview (December Mondays: 7/14/21/28), every-three-day preview (11 dates), and available-only department editor. Discarded the live form draft without saving. No production write was used for demonstration.
- Records: assignment, standing-crew, availability, and time-off fingerprints exactly matched the pre-release baseline. Both automatic email/text enabled-rule counts remained zero.
- Database migrations: none. Dependency changes: none.
- Evidence: 59 recorded isolated workflow scenarios; 108 responsive combinations. Screenshots `live-repeat-controls.jpg` and `live-weekday-date-preview.jpg` are saved under the ignored review output directory.
