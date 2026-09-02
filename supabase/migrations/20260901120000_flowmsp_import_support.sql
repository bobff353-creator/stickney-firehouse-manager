alter table firehouse.field_preplan_imports
  add column if not exists source_external_id text not null default '',
  add column if not exists source_payload text not null default '{}';

drop index if exists firehouse.field_hydrant_number_idx;
create index if not exists field_hydrant_number_idx
  on firehouse.field_hydrants(hydrant_number)
  where hydrant_number <> '';

create unique index if not exists field_preplan_import_external_id_idx
  on firehouse.field_preplan_imports(source_external_id)
  where source_external_id <> '';
