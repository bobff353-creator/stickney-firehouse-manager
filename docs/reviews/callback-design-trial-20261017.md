# Callback approval design trial

Isolated branch: `codex/callback-design-trial-20261017`, based on completed correctness HEAD `335de0f41b27970b80d0b33a423ae227e9f1fe27`. All correctness commits are preserved. No push or deployment; existing release blockers are unchanged.

## Scope and references

Callback approval was selected over the employee screen because its 10–12 px supporting text and expanded eight-rule reference made review details difficult to scan on phones. Synthetic before/after rendering confirmed horizontal overflow at 320 px and the first submission below 1,800 px on a 390 px phone.

The official [Impeccable website](https://impeccable.style/), [repository](https://github.com/pbakaus/impeccable), [focused improvement guidance](https://impeccable.style/docs/improve-design/), [typeset](https://impeccable.style/docs/typeset/), and [adapt](https://impeccable.style/docs/adapt/) were read as reference material. Applied manually: preserve identity and behavior, distinguish text roles, improve narrow-screen wrapping and controls, and check the primary task in the browser. No installer, third-party script, global skill or dependency was added.

## Changes and tradeoffs

- `app/callback-reviews.tsx`: the general rules reference becomes a native keyboard-operable disclosure, closed initially. All rule text remains available. Member-specific qualifying rules and warning flags remain expanded. Approved-hours inputs receive member-specific accessible names.
- `app/globals.css`: styles scoped to callback review. Supporting text becomes 13–14 px, values 17 px, names 19 px, and inputs 16 px. Controls have at least 44 px height. Long names wrap, phone headings/status stack, phone summary rows use label/value alignment, and actions stack in DOM/keyboard order. Navy/white approval styling and visible focus outlines use the existing palette; department typography and other screens remain intact.
- `tests/fixtures/callback-design.*`, `scripts/preview-callback-design.mjs`, `scripts/verify-callback-design.mjs`: synthetic responses and a localhost-only interactive preview/verification harness. No application API or permissions were changed.

Tradeoff: the general rules reference takes one activation to expand. Larger text and controls make individual cards taller; collapsing the reference reduces total page height and brings actual submissions forward. No animation or new feature was added. The existing light card treatment is retained under both system color preferences rather than introducing a new dark theme.

## Acceptance

- 39 isolated affected tests passed: callback reviews/response types/card layout, payroll access boundaries and atomic save regressions. No failures/skips.
- TypeScript, changed-file ESLint, production build and `git diff --check` passed. Full 1,426-test correctness acceptance belongs to the parent baseline; the full suite was not rerun for this presentation-only trial.
- Before and after tested at 320/390/768/1280 px in light/dark preferences: 16 cases, zero page errors. Before overflow at 320 px; after zero overflow at every width. Expanded rules also passed at 320/640/1280 px. A 640 px effective viewport covers desktop 200% reflow; this was not a native browser zoom automation test.
- At 390 px the first submission moved from y=1813.6 to y=882.5; total page height fell from 3351 to 2549 px for these identical synthetic records.
- Keyboard Enter/Space toggles the disclosure; Tab order follows note → Deny → Approve; keyboard approval preserves entered hours/note in the expected mock payload. Denial, reviewer save, failed save retaining the note, blocked approval during error and retry reload all passed. Visible focus outline is 3 px; all visible inputs/selects/buttons/disclosure are at least 44 px high.
- Eight full-page screenshots (before/after, 390/1280 px, light/dark) saved to Library as explicitly requested. They contain fictional records only. Browser results and Library identities are retained locally in `/workspace/firehouse-design-evidence/`.

Preview: `node scripts/preview-callback-design.mjs`, then open `http://127.0.0.1:4187/callback-design.html`. Verification uses an existing Playwright installation: `node scripts/verify-callback-design.mjs /opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs` in this environment, with Chromium at `/usr/bin/chromium` (or set `CHROMIUM_PATH`). No browser dependencies were installed.

This is component-level synthetic browser evidence, not live authorization, payroll, hosted integration or full-portal verification. No database migration, production data, access setting, credential or hosted resource was changed.
