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

The deployed branch is configured to select a branch-specific Supabase project and does not use the shared `DATABASE_URL`. This is configuration evidence, not end-to-end isolation proof. The preview project reference, organization ownership, schema version, RLS policies, Storage buckets, approved test records, and absence of production records have not been verified directly.

Do not run migrations, fixtures, uploads, lifecycle actions, or destructive browser tests until the preview Supabase project is identified and the isolation checklist below passes.

## Isolation checklist

1. Record the preview Supabase project reference and owner without exposing keys.
2. Confirm it is not the production project reference.
3. Inspect `preplan_schema_version`, `runtime_bootstrap_version`, migration history, and operational table/index presence read-only.
4. Inspect RLS enablement and policies for every operational table plus private Storage object policies.
5. Confirm the approved test department and records are synthetic/sanitized or explicitly approved, and that production department records are absent.
6. Verify the private bucket exists with the required MIME and size restrictions.
7. Confirm Preview deployment logs and requests identify only the preview project.
8. Record cleanup ownership and a rollback path before any write test.

The Supabase changelog review found no new breaking change that alters this environment-selection conclusion. New Data API exposure defaults and extension-version behavior must still be considered when provisioning or migrating a new preview project.
