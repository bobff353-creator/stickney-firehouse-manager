-- Historical records only. This schema is deliberately outside the Data API
-- and grants no access to app roles. Current operational tables stay untouched.
create schema stickney_legacy_archive;
revoke all on schema stickney_legacy_archive from public, anon, authenticated, service_role;

create table stickney_legacy_archive.snapshots (
  id uuid primary key,
  department_id uuid not null references public.departments(id),
  source_project text not null,
  captured_at timestamptz not null,
  verified_at timestamptz,
  status text not null check (status in ('copying', 'verified')),
  source_definitions jsonb not null default '{}'::jsonb,
  notes text not null
);

create table stickney_legacy_archive.tables (
  snapshot_id uuid not null references stickney_legacy_archive.snapshots(id),
  source_schema text not null,
  source_table text not null,
  records jsonb not null check (jsonb_typeof(records) = 'array'),
  record_count bigint generated always as (jsonb_array_length(records)) stored,
  source_metadata jsonb not null,
  verified_at timestamptz,
  primary key (snapshot_id, source_schema, source_table)
);

create table stickney_legacy_archive.files (
  snapshot_id uuid not null references stickney_legacy_archive.snapshots(id),
  source_bucket text not null,
  source_path text not null,
  archive_bucket text not null,
  archive_path text not null,
  byte_count bigint not null check (byte_count >= 0),
  sha256 text not null,
  source_metadata jsonb not null,
  verified_at timestamptz not null,
  primary key (snapshot_id, source_bucket, source_path)
);

alter table stickney_legacy_archive.snapshots enable row level security;
alter table stickney_legacy_archive.tables enable row level security;
alter table stickney_legacy_archive.files enable row level security;
revoke all on all tables in schema stickney_legacy_archive from public, anon, authenticated, service_role;
alter default privileges in schema stickney_legacy_archive revoke all on tables from public, anon, authenticated, service_role;
comment on schema stickney_legacy_archive is
  'Private Stickney legacy preservation; administrator SQL access only. Never merge historical rows into live operational tables without review.';
