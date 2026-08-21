import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const exactTests = new Set([
  "bootstrap-fast-path.test.mjs",
  "field-preplans.test.mjs",
  "hydrants.test.mjs",
  "permissions.test.mjs",
  "reduced-motion.test.mjs",
  "runtime-bootstrap-marker-repair.test.mjs",
]);

const testFiles = readdirSync("tests", { withFileTypes: true })
  .filter((entry) =>
    entry.isFile() &&
    (entry.name.startsWith("preplan-v2-") ||
      entry.name.startsWith("respond-") ||
      exactTests.has(entry.name)),
  )
  .map((entry) => `tests/${entry.name}`)
  .sort();

if (!testFiles.length) {
  throw new Error("No Operational Preplan 2.0 verification tests were found.");
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
