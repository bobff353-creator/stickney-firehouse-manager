# Focused preplan footprint layout repair

Date: September 11, 2026. Scope: UI repair; no production records or schema changes.

## Source and diagnosis

Verified checkout: `D:/stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, base commit `a5740b68a63a9343a2458b7a53d37fd8339fe797`. Remote: `bobff353-creator/stickney-firehouse-manager`. Vercel project: `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`, `stickney-firehouse-manager`.

The shared `.field-preplans-page` rule in `portal-usability.css` overrode the focused builder's explicit two-column grid. Its editor still requested column 2, creating an implicit column. With the full-width address message present, the map and editor occupied the same horizontal area. Independent sticky positioning then let the editor heading float over the map.

The local browser regression recreates that old cascade: both the map and editor start at x=585.65625 and end at x=1453.46875 in a 1518px viewport. It checks that the repaired desktop layout uses disjoint columns and the tablet/phone layout stacks them without overlap.

## Changes

- Exclude focused records from the shared one-column reset and explicitly anchor the map in column 1.
- Keep editor headings in normal document flow, with wrapping, touch-sized section buttons.
- Keep zoom buttons together and allow the toolbar instructions to wrap.
- While drawing a footprint, hide saved map markers and hydrants from that editor's display only. Explain this temporary state and restore those layers on acceptance. No records are removed or re-fetched for this transition.
- Preserve the existing coordinate handling, area calculation, acceptance state, save request, authentication, and permissions.

## Verification workflow

Use the actual portal React components and all four production stylesheets, with explicitly fictional API responses. The focused scenario includes an imported address needing manual placement, an unsaved footprint, and a nearby fictional hydrant. The fixture's permission response follows the current verification contract; it does not bypass production authorization.

Run:

```text
node scripts/preview-portal-usability.mjs
node scripts/audit-preplan-footprint.mjs
node --test tests/*.test.mjs
npm run build
```

Set `PORTAL_AUDIT_BROWSER` to the installed agent-browser JavaScript CLI before running the audit. The browser script uses the separate `footprint-fix` session and only `127.0.0.1:4181`. It does not open the user's live draft.

The browser audit covers 1518, 1151, 1150, 1024, 768, 390, and 360 CSS-pixel widths. At each size it checks drawing with physical pointer input, undo, acceptance, restored hydrants, building-step navigation and return with geometry retained, clearing, and return to the list. It checks header/map separation, control overflow, zoom grouping, runtime errors, and zero save requests. Screenshots and measured geometry are in `outputs/preplan-footprint/`.

Final results: all 28 responsive/workflow states passed, with zero runtime errors, header/map overlaps, out-of-viewport editor controls, or save requests. Seven additional toolbar screenshots were captured. Screenshots at desktop, tablet, and phone sizes were visually reviewed. All 555 automated tests passed; the 19 focused tests also passed after the final toolbar refinement. The final production build completed successfully, including TypeScript and 61 generated pages. `git diff --check` passed.

## Boundaries

The preview blocks external imagery and API access by design. Blank map tiles in its screenshots are not a production map outage. The browser tests exercise the real fallback-map pointer handling and shared layout, not the external Google Maps service, production persistence, or physical iPhone/iPad hardware. No credentials, production API calls, draft saves, reloads, or navigation in the user's tab are part of this test.

The browser-verification guidance prompted checks of the actual focused workflow and screenshot review, which caught cramped toolbar text after the initial grid repair. The React review kept the marker filtering derived from existing drawing state without additional effects or requests.

No push or deployment is included in this repair turn. Apply the release only after approval, and do not refresh the user's unsaved draft to demonstrate it.
