# Operational Preplan 2.0 environment audit

Audit date: 2026-08-21  
Vercel project: `fire-pre-plan-pro/stickney-firehouse-manager`  
Project ID: `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`  
Branch: `codex/preplan-operational-v2-approved`

## Read-only findings

- The verified checkout is linked to the expected Vercel project through `.vercel/project.json`.
- Vercel lists branch-specific Preview values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `FIREHOUSE_DATABASE_SECRET`, `PAYROLL_DEPARTMENT_ID`, and `PORTAL_PIN_PASSWORD_PEPPER`.
- The pulled preview configuration contains a Supabase URL that differs from the application’s production fallback URL. No URL, key, secret, token, or database credential is recorded in this document.
- Vercel also lists one `DATABASE_URL` scoped to both Production and Preview. Repository inspection found no application, database-adapter, proxy, or test code that reads `DATABASE_URL`.
- Portal reads and writes use `getSupabaseServerClient()`. `getPublicSupabaseConfig()` selects the deployment’s `NEXT_PUBLIC_SUPABASE_URL` and publishable key before its compatibility fallback. Trusted activation/admin work uses `SUPABASE_SECRET_KEY` against that selected URL.
- The portable SQL adapter calls the authenticated `firehouse_sql` RPC through the selected Supabase client; it does not open a direct connection from `DATABASE_URL`.

## Current conclusion

Supabase branch discovery identified development branch `preplan-operational-v2-approved`, project reference `pzgvlslcaoqtrnaqyjmd`, under production parent `ukpdacqjmhvlhmrwxtcx`. Supabase reports `with_data: false`, so production rows were not copied into the branch. The branch contains only the deliberately installed preview fixture footprint described below.

Vercel redacts the branch-specific Supabase URL as `[SENSITIVE]`, so the deployment-to-project-reference match cannot be independently read back through the CLI. The matching branch name, timing, branch-specific variables, and isolated fixture behavior are strong configuration evidence, but the signed-in preview must still confirm that its requests reach `pzgvlslcaoqtrnaqyjmd` before write testing.

Supabase reports the branch status as `MIGRATIONS_FAILED`. The current migration history nevertheless includes the portal prerequisites, Operational Preplan migration, foreign-key indexes, lockdown, credential rotation, and preview fixtures. Direct read-only inspection confirms the resulting tables and markers exist. Treat the failed status as unresolved branch-health metadata until its original migration failure is identified or Supabase reports a clean branch state.

## Direct branch evidence

- `preplan_schema_version`: `stickney-preplan-schema-2026-08-20-v2`
- `runtime_bootstrap_version`: `stickney-runtime-bootstrap-2026-08-10-callback-rules-v2`
- Operational tables: 18 present, 18 with RLS enabled, 18 policies total.
- Preplan fixture state: one total, one in review, zero draft, zero published, zero archived.
- Storage bucket `firehouse-portal`: private, 25 MiB limit, JPG/PNG/WebP/PDF allowlist, zero stored objects.
- Production-data copy: disabled (`with_data: false`).
- Branch action logs available through the connector: empty for the preceding 24 hours, so they do not explain the historical failed status.

The current Supabase security advisor reports no missing-policy advisory for Operational Preplan tables. It does report information-level missing-policy findings for several Station Scheduler tables, authenticated access to four portal PIN `SECURITY DEFINER` functions, and disabled leaked-password protection. Those findings are outside the new Preplan tables but remain release-review items; they were not changed during this read-only audit.

Do not run migrations, fixtures, uploads, lifecycle actions, or destructive browser tests until the preview Supabase project is identified and the isolation checklist below passes.

## Isolation checklist

1. Resolve or explain the Supabase `MIGRATIONS_FAILED` branch status.
2. Confirm through a signed-in preview request that Vercel reaches `pzgvlslcaoqtrnaqyjmd`.
3. Inspect the exact policy definitions for the 18 operational tables and Storage objects, not only policy counts.
4. Confirm the preview fixtures are approved for testing and contain no production-protected content.
5. Review the non-Preplan security advisor findings and document disposition.
6. Record cleanup ownership and a rollback path before any write test.

The Supabase changelog review found no new breaking change that alters this environment-selection conclusion. New Data API exposure defaults and extension-version behavior must still be considered when provisioning or migrating a new preview project.
