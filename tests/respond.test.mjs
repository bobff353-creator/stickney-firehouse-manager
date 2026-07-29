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

test("Respond reads existing call and preplan records and exposes requested field views", async () => {
  const [route, component, shell] = await Promise.all([
    readFile(new URL("../app/api/respond/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/respond.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /FROM dispatch_incidents/);
  assert.match(route, /FROM daily_log_calls/);
  assert.match(route, /FROM field_preplans/);
  assert.match(route, /FROM field_preplan_features/);
  assert.match(route, /FROM field_preplan_photos/);
  assert.match(component, /Alpha \/ A Side/);
  assert.match(component, /Street View Fallback/);
  assert.match(component, /CAD Notes/);
  assert.match(component, /Footprint/);
  assert.match(component, /type RightView = "cad"\|"footprint"\|"B"\|"C"\|"D"/);
  assert.match(component, /\$\{item\} Side/);
  assert.match(component, /Open Google Navigation/);
  assert.match(shell, /\{ label: "Respond", page: "Respond" \}/);
  assert.match(shell, /activeNav === "Respond"/);
});
