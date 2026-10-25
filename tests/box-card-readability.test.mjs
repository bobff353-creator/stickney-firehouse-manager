import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import ts from "typescript";

// Render the production sheet with controlled assignments, without portal authentication.
const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/resource-pages.tsx", import.meta.url), "utf8");
const sheetSource = source.slice(source.indexOf("type AuditFields"), source.indexOf("function PolicyRecord"));
const output = ts.transpileModule(`${sheetSource}\nexport { BoxCardSheet };`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href));
const { BoxCardSheet } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const categories = ["Engines", "Trucks", "Squads", "EMS", "Chiefs", "Special Equipment", "Change of Quarters", "Notifications"];
export const boxCardFixture = renderToStaticMarkup(createElement(BoxCardSheet, { card: {
  id: "test-card", department: "Division 11", boxNumber: "TRT", title: "Technical rescue", address: "Test location",
  layoutData: JSON.stringify({ division: "11", signature: "Test approval", rows: ["Still", "Box", "2nd", "3rd", "4th"].map((alarm) => ({ alarm, cells: categories.map((category) => `${alarm} ${category} assignment`) })), interdivisional: ["First choice", "Second choice", "Third choice"] }),
} }));

test("every alarm assignment retains a visible phone category label and its content", () => {
  for (const category of categories) {
    assert.ok(boxCardFixture.includes(`data-label="${category}"`));
    for (const alarm of ["Still", "Box", "2nd", "3rd", "4th"]) assert.ok(boxCardFixture.includes(`${alarm} ${category} assignment`));
  }
  assert.match(boxCardFixture, /role="region"/);
  assert.match(boxCardFixture, /tabindex="0"/);
  assert.match(boxCardFixture, /Third choice/);
});
