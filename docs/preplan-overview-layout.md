# Stickney overview map layout repair

Implemented and verified locally September 12, 2026. The user subsequently approved pushing and deploying the fix. The deployment outcome and live Google-map verification are recorded separately in the release receipt.

## Verified cause and target

Source: `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, remote `bobff353-creator/stickney-firehouse-manager`. Baseline HEAD: `f357120b00b325aa7584355ea9b397a89c7c789c`; linked Vercel project: `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`.

Story: opening Maps & Preplans should show the Stickney overview in one bounded map, with the full department directory accessible in its own scrolling list.

A separate, authenticated, read-only production browser tab reproduced the lakeshore view at zoom 14. The page returned 6 preplans and 212 hydrants. Its actual `.field-map` measured **998.25 × 27,925.14 CSS pixels**, with the Google basemap also approximately 27,923 pixels tall. The SVG overlay reported the same oversized viewBox. Center-area Google tiles were positioned more than 14,000 pixels below the top of the page. The long record list was sizing the shared grid row; the visible top of the oversized map was not its geographic center. Earlier mobile rules also removed the record list's scroll limit.

This is a layout failure, not evidence of incorrect saved building coordinates. The configured Stickney center remains `41.8189, -87.7734`, zoom 14. No production records, permissions, imagery provider, map synchronization code, credentials or API behavior were changed. The temporary production inspection tab was closed.

## Repair

- Bound the normal overview map to a responsive viewport height, independent of record count.
- Keep the records in a separately scrolling pane; all records remain available, including the last entry and department-wide search results.
- Stack the map and a 280-pixel record pane on tablet/phone widths.
- Keep expanded map and records side by side on short landscape screens, preventing either pane from extending below the viewport.
- Scope these rules to the directory workspace. Focused preplan capture, saved footprint coordinates, device location behavior, Respond, and road-closure maps are untouched.

## Verification

- **66 browser assertions passed**, with 218 explicitly fictional records at 1518×666, 1213×666, 1100×800, 1024×768, 768×1024, 390×666 and 666×390. Covered bounded dimensions, center/zoom, last-record scrolling, zoom in/out, expanded mode and Escape exit, search/empty search/clearing search, and resizing an already-mounted map across breakpoints.
- At the user's 1213×666 size, the normal map measured approximately **433 pixels tall**, independent of all 218 records. Phone portrait measured 346 pixels; phone landscape expanded mode measured 262 pixels. No horizontal overflow or application runtime errors in these scenarios.
- **17 existing location/capture browser scenarios passed**, including missing/denied/timed-out GPS, located and unlocated starters, new preplans, valid device location, late callbacks, and pointer-drawn corners retained after a failed lookup.
- All browser scenarios recorded **zero writes**. Browser-verification guidance drove the full-size directory fixture and phone-landscape check, which caught and corrected a secondary expanded-pane overflow.
- **All 71 preplan tests passed**, focused ESLint passed, `git diff --check` passed, and the final production `npm run build` passed, including TypeScript and all 62 static-page generation steps. Release/deployment evidence is separate.

Local fixture imagery is intentionally blocked by CSP, so screenshot tiles are blank. Browser measurements test actual application layout and rendered fallback-map projection. Production Google imagery was inspected to establish the cause, but the repaired Google rendering has not been verified on a deployment. No production save or deployment is claimed.

## Repeat

Start `node scripts/preview-portal-usability.mjs`. Set `PORTAL_AUDIT_BROWSER` to the installed agent-browser executable. Open the fixture once directly with agent-browser to start the owned browser session, then run:

```text
node scripts/audit-preplan-overview.mjs
node scripts/audit-preplan-location.mjs
node --test tests/preplan*.test.mjs tests/field-preplans.test.mjs
npx eslint scripts/audit-preplan-overview.mjs tests/fixtures/portal-audit.tsx tests/preplan-map-location.test.mjs
npm run build
git diff --check
```

Evidence is written to ignored `outputs/preplan-overview/` and `outputs/preplan-location/`. Both browser scripts close their own sessions. Stop the owned preview server after testing.
