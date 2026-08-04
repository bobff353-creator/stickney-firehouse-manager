import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadMatcher() {
  const source = await readFile(new URL("../app/respond-match.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("Respond normalizes common address forms and ignores unit numbers", async () => {
  const { normalizeResponseAddress } = await loadMatcher();
  assert.equal(normalizeResponseAddress("123 North Main Street, Suite 4"), "123 n main st");
  assert.equal(normalizeResponseAddress("123 N. Main St."), "123 n main st");
});

test("Respond prefers exact address matches and allows controlled nearby GPS matches", async () => {
  const { rankPreplanMatch } = await loadMatcher();
  const plans = [
    { id:"a", address:"100 Main Street", latitude:41.82, longitude:-87.78 },
    { id:"b", address:"200 Oak Avenue", latitude:41.8201, longitude:-87.7801 },
  ];
  assert.equal(rankPreplanMatch({ address:"100 Main St" }, plans)?.plan.id, "a");
  assert.equal(rankPreplanMatch({ address:"Unknown", latitude:41.82011, longitude:-87.78011 }, plans)?.plan.id, "b");
  assert.equal(rankPreplanMatch({ address:"Unknown", latitude:42, longitude:-88 }, plans), null);
});

test("Respond suggests Stickney box cards by incident and Ridgeland side", async () => {
  const { suggestedStickneyBoxCard } = await loadMatcher();
  assert.equal(suggestedStickneyBoxCard({ callType:"EMS - difficulty breathing", address:"6700 W 43rd St" }), "sfd-box-399");
  assert.equal(suggestedStickneyBoxCard({ category:"MCI", address:"4300 Oak Park Ave" }), "sfd-box-399");
  assert.equal(suggestedStickneyBoxCard({ callType:"Vehicle Accident", longitude:-87.78 }), "sfd-box-303-e");
  assert.equal(suggestedStickneyBoxCard({ callType:"MVA with injuries", longitude:-87.79 }), "sfd-box-303-w");
  assert.equal(suggestedStickneyBoxCard({ callType:"Structure Fire", address:"6200 W 41st St" }), "sfd-box-300-e");
  assert.equal(suggestedStickneyBoxCard({ callType:"Fire Alarm", address:"6800 W Pershing Rd" }), "sfd-box-300-w");
  assert.equal(suggestedStickneyBoxCard({ callType:"Structure Fire", address:"4200 Ridgeland Ave" }), null);
});

test("Respond reads existing call and preplan records and exposes requested field views", async () => {
  const [route, streetViewRoute, component, shell, styles, settings, board] = await Promise.all([
    readFile(new URL("../app/api/respond/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/respond/street-view/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/respond.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/respond-device-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /FROM dispatch_incidents/);
  assert.match(route, /FROM daily_log_calls/);
  assert.match(route, /FROM field_preplans/);
  assert.match(route, /FROM field_preplan_features/);
  assert.match(route, /FROM field_preplan_photos/);
  assert.match(route, /respondingUnitsIncludeUnit/);
  assert.match(route, /searchParams\.get\("apparatus"\)/);
  assert.match(component, /Alpha \/ A Side/);
  assert.match(component, /\?apparatus=/);
  assert.match(component, /APPARATUS RESPOND/);
  assert.match(component, /alpha\?<img[^:]+:<StreetViewFallback call=\{call\}/);
  assert.match(component, /\/api\/respond\/street-view\?location=/);
  assert.match(component, /Google Street View fallback/);
  assert.match(component, /Building photo unavailable/);
  assert.doesNotMatch(component, /respond-360-command/);
  assert.match(streetViewRoute, /GOOGLE_MAPS_STREET_VIEW_KEY/);
  assert.match(streetViewRoute, /Maps Platform API Key/);
  assert.match(streetViewRoute, /oai-authenticated-user-email/);
  assert.match(streetViewRoute, /x-department-id/);
  assert.match(streetViewRoute, /return_error_code/);
  assert.match(streetViewRoute, /cache: "no-store"/);
  assert.match(streetViewRoute, /Referer: googleReferer/);
  assert.match(streetViewRoute, /parsedReferer\.origin === requestOrigin/);
  assert.match(streetViewRoute, /Google Street View request failed/);
  assert.doesNotMatch(streetViewRoute, /NEXT_PUBLIC_/);
  assert.match(component, /Monitor View/);
  assert.match(component, /requestFullscreen/);
  assert.match(component, /exitFullscreen/);
  assert.match(component, /CAD Notes/);
  assert.match(component, /Footprint/);
  assert.match(component, /type RightView = "cad"\|"footprint"\|"B"\|"C"\|"D"/);
  assert.match(component, /\$\{item\} Side/);
  assert.match(component, /Open Google Navigation/);
  assert.match(shell, /\{ label: "Respond", page: "Respond" \}/);
  assert.match(shell, /activeNav === "Respond"/);
  assert.match(shell, /Respond Device Modes/);
  assert.match(shell, /respondDeviceSettings\.mode === "operations-alert" && activeNav === "Operations Board"/);
  assert.match(shell, /Returning to Live Operations in \{respondAlertSeconds\} seconds/);
  assert.match(settings, /No separate device account is required/);
  assert.match(settings, /Option 1 · Apparatus Respond/);
  assert.match(settings, /Option 2 · Operations Alert/);
  assert.match(settings, /fetch\("\/api\/digital-twin"/);
  assert.match(settings, /Choose from every apparatus currently saved in Fleet/);
  assert.match(board, /onNewActiveCallRef\.current\?\.\(newCall\)/);
  assert.match(styles, /grid-template-columns:minmax\(165px,\.432fr\) minmax\(460px,1\.53fr\) minmax\(315px,\.988fr\)/);
  assert.match(styles, /\.respond-auto-alert\{position:fixed;inset:0/);
});
