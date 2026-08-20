# Operational Preplan 2.0 migration runbook

## Preconditions

1. Confirm repository, remote, branch, Vercel project ID, and production SHA.
2. Export the production `firehouse` schema and storage object inventory.
3. Create an isolated Supabase preview database. Do not point preview application code at production.
4. Copy only the minimum sanitized or approved test records needed to verify legacy behavior.

## Preview migration

Apply `supabase/migrations/20260820212759_add_operational_preplan_v2.sql` to the isolated database. Confirm:

- all normalized tables exist;
- every legacy preplan has exactly one default Arrival/Ground level;
- legacy records remain published and visibly marked legacy/incomplete;
- all new tables have RLS enabled and department-access policies;
- anonymous access is revoked;
- the bucket is private and restricted to approved MIME types;
- `preplan_schema_version` is current and `runtime_bootstrap_version` is unchanged;
- rank permission rows were seeded without overwriting saved choices.

Run the full test suite and exercise denied and allowed writes with non-production accounts. Upload, stream, and delete a preview-only image and PDF. Confirm storage metadata rolls back if a database write fails.

## Production change window

Production requires explicit authorization. Take a fresh backup, apply the migration once, verify row counts and RLS, then deploy compatible application code. Check both established owner and department accounts, legacy preplans, publication, Respond, attachments, and offline refresh before closing the change window.

Rollback application code first if needed; the migration is additive and legacy columns remain intact. Do not drop the new tables during incident response. If a data rollback is required, restore from the pre-change backup under an approved database recovery plan.
