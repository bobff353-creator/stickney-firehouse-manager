import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // These established screens intentionally synchronize local editor/navigation
    // state when their server-backed inputs change. Keep this exception scoped to
    // the reviewed files instead of disabling the React Compiler rule project-wide.
    files: [
      "app/chief-board-panel.tsx",
      "app/department-settings.tsx",
      "app/field-preplans.tsx",
      "app/inventory-vin-profile.tsx",
      "app/payroll-app.tsx",
      "app/permission-settings.tsx",
      "app/station-scheduler.tsx",
      "app/work-details.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Expiration age is intentionally evaluated against the render snapshot.
    files: ["app/inventory-operations.tsx"],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  {
    // The dependency list is intentionally narrower than the containing viewer
    // object so unrelated viewer updates do not rebuild the navigation model.
    files: ["app/payroll-app.tsx"],
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
