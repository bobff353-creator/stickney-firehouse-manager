# Legacy Stickney record preservation

The former shared Supabase project is now named **Catnap Rescue Records**
(`ukpdacqjmhvlhmrwxtcx`). Current Stickney production remains in **Stickney
Firehouse Manager** (`datqzdndkrfyovhwppuq`).

The `stickney_legacy_archive` schema in Stickney holds historical snapshots,
original table names and record IDs, database definitions, and original-to-archive
file mappings. It preserves history separately from current operational tables.
Its tables have RLS enabled and grant no access to the app roles, including
`service_role`; archive access requires an authorized database administrator.
The private `stickney-legacy-archive` storage bucket also has a restrictive
policy that excludes app users regardless of other permissive bucket policies.

The primary historical snapshot is
`f6f41804-6991-48b3-815c-e598b06e60f4`. It contains 29,010 legacy records, including
two records from the retired PrePlan360 Site, plus 48 inactive authentication
records for 24 obsolete Stickney accounts. Original IDs and source relationships
are retained inside the JSON records and schema definitions. Those archived
accounts are historical data, not current sign-in accounts.

All 208 historical table selections were compared against fresh source hashes
and counts. All ten categories of database definitions were hash checked.
The 24 primary legacy Stickney files were copied and SHA-256 verified. Additional
retired preview-branch snapshots retain their own source project IDs and do not
replace current department IDs or operational records.

Encrypted preservation copies remain outside this repository under the Windows
user's local application-data directory. Windows DPAPI binds those copies to
the original Windows user profile; they are not portable backups. Unrelated
old department records and files were preserved there rather than mixed into
the live Stickney or Catnap datasets. No credentials, exports, or private files
belong in Git.

Recovery must verify the snapshot's department and source project, then review
the selected records and file mappings. Never bulk import historical snapshots
over current payroll, staffing, inventory, or other operational records.
