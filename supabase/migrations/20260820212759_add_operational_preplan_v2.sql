alter table firehouse.field_preplans
  add column if not exists publication_status text not null default 'published',
  add column if not exists completeness_status text not null default 'legacy',
  add column if not exists draft_owner text,
  add column if not exists published_by text,
  add column if not exists published_at text,
  add column if not exists archived_by text,
  add column if not exists archived_at text,
  add column if not exists revision_number integer not null default 1,
  add column if not exists last_verified_at text,
  add column if not exists next_review_date text,
  add column if not exists construction_profile text not null default '{}',
  add column if not exists occupancy_profile text not null default '{}',
  add column if not exists fire_flow_profile text not null default '{}',
  add column if not exists target_hazard_level text not null default 'low',
  add column if not exists target_hazard_override integer not null default 0,
  add column if not exists target_hazard_reasons text not null default '[]';

update firehouse.field_preplans set
  publication_status = case when lower(coalesce(publication_status, '')) = 'archived' then 'archived' else 'published' end,
  completeness_status = case when trim(coalesce(status, '')) <> '' then status else 'Legacy preplan' end,
  published_by = coalesce(nullif(published_by, ''), nullif(updated_by, ''), nullif(created_by, ''), 'Legacy import'),
  published_at = coalesce(nullif(published_at, ''), nullif(updated_at, ''), nullif(created_at, '')),
  revision_number = greatest(coalesce(revision_number, 1), 1);

create table if not exists firehouse.field_preplan_levels (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  name text not null,
  short_label text not null,
  layer_type text not null,
  floor_index integer,
  grade_designation text not null default 'at_grade',
  sort_order integer not null default 0,
  is_default integer not null default 0,
  respond_visible integer not null default 1,
  hidden integer not null default 0,
  archived integer not null default 0,
  background_type text not null default 'none',
  background_asset_id text,
  background_transform text not null default '{}',
  opacity double precision not null default 1,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text,
  unique(preplan_id, short_label)
);
create unique index if not exists field_preplan_default_level_idx on firehouse.field_preplan_levels(preplan_id) where is_default = 1 and archived = 0;
create index if not exists field_preplan_level_order_idx on firehouse.field_preplan_levels(preplan_id, archived, sort_order);

insert into firehouse.field_preplan_levels(id, preplan_id, name, short_label, layer_type, floor_index, grade_designation, sort_order, is_default, respond_visible, created_by, updated_by)
select 'arrival-' || preplan.id, preplan.id, 'Arrival / Ground', 'ARRIVAL', 'arrival', 0, 'at_grade', 0, 1, 1,
  coalesce(nullif(preplan.created_by, ''), 'Legacy migration'), coalesce(nullif(preplan.updated_by, ''), nullif(preplan.created_by, ''), 'Legacy migration')
from firehouse.field_preplans as preplan
where not exists (select 1 from firehouse.field_preplan_levels as existing where existing.preplan_id = preplan.id and existing.layer_type = 'arrival');

alter table firehouse.field_preplan_features
  add column if not exists primary_level_id text references firehouse.field_preplan_levels(id),
  add column if not exists mapped integer not null default 1,
  add column if not exists operational_category text not null default 'building_system',
  add column if not exists severity text not null default 'informational',
  add column if not exists display_priority integer not null default 0,
  add column if not exists min_zoom double precision,
  add column if not exists max_zoom double precision,
  add column if not exists effective_at text,
  add column if not exists expires_at text,
  add column if not exists expiration_action text not null default 'require_verification',
  add column if not exists verified_by text,
  add column if not exists verified_at text,
  add column if not exists structured_metadata text not null default '{}',
  add column if not exists plan_x double precision,
  add column if not exists plan_y double precision,
  add column if not exists updated_by text not null default '';

update firehouse.field_preplan_features as feature set primary_level_id = level.id
from firehouse.field_preplan_levels as level
where level.preplan_id = feature.preplan_id and level.layer_type = 'arrival' and feature.primary_level_id is null;

create table if not exists firehouse.field_preplan_feature_levels (
  feature_id text not null references firehouse.field_preplan_features(id) on delete cascade,
  level_id text not null references firehouse.field_preplan_levels(id) on delete cascade,
  is_primary integer not null default 0,
  created_at text not null default current_timestamp::text,
  primary key(feature_id, level_id)
);
insert into firehouse.field_preplan_feature_levels(feature_id, level_id, is_primary)
select id, primary_level_id, 1 from firehouse.field_preplan_features where primary_level_id is not null
on conflict(feature_id, level_id) do update set is_primary = excluded.is_primary;

create table if not exists firehouse.field_preplan_spaces (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  level_id text not null references firehouse.field_preplan_levels(id) on delete cascade,
  display_name text not null,
  room_number text not null default '',
  space_type text not null default 'room',
  aliases text not null default '[]',
  cad_keywords text not null default '[]',
  geometry text not null,
  coordinate_space text not null default 'floor_plan',
  label_x double precision,
  label_y double precision,
  typical_occupancy integer,
  peak_occupancy integer,
  special_population_notes text not null default '',
  access_notes text not null default '',
  fire_protection_notes text not null default '',
  hazards text not null default '',
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);
create index if not exists field_preplan_space_level_idx on firehouse.field_preplan_spaces(preplan_id, level_id, archived);

create table if not exists firehouse.field_preplan_alerts (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  level_id text references firehouse.field_preplan_levels(id) on delete set null,
  space_id text references firehouse.field_preplan_spaces(id) on delete set null,
  alert_type text not null,
  title text not null,
  instructions text not null default '',
  severity text not null default 'informational',
  display_order integer not null default 0,
  pin_to_respond integer not null default 0,
  effective_at text,
  expires_at text,
  expiration_action text not null default 'require_verification',
  verification_required integer not null default 0,
  verified_by text,
  verified_at text,
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);
create index if not exists field_preplan_alert_respond_idx on firehouse.field_preplan_alerts(preplan_id, archived, pin_to_respond, severity, display_order);
create index if not exists field_preplan_alert_expiration_idx on firehouse.field_preplan_alerts(expires_at) where archived = 0;

create table if not exists firehouse.field_preplan_hazmat (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  level_id text references firehouse.field_preplan_levels(id) on delete set null,
  space_id text references firehouse.field_preplan_spaces(id) on delete set null,
  mapped integer not null default 0,
  chemical_name text not null,
  un_na_number text not null default '',
  erg_guide_number text not null default '',
  quantity double precision,
  quantity_unit text not null default '',
  container_type text not null default '',
  physical_state text not null default '',
  exact_location text not null,
  nfpa_health integer,
  nfpa_flammability integer,
  nfpa_instability integer,
  nfpa_special text not null default '',
  date_verified text,
  verified_by text,
  effective_at text,
  expires_at text,
  expiration_action text not null default 'require_verification',
  notes text not null default '',
  latitude double precision,
  longitude double precision,
  plan_x double precision,
  plan_y double precision,
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);
create index if not exists field_preplan_hazmat_lookup_idx on firehouse.field_preplan_hazmat(preplan_id, un_na_number, archived);

create table if not exists firehouse.field_preplan_hazmat_zones (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  hazmat_id text not null references firehouse.field_preplan_hazmat(id) on delete cascade,
  level_id text references firehouse.field_preplan_levels(id) on delete set null,
  zone_type text not null,
  geometry_type text not null,
  geometry text not null,
  label text not null,
  radius_feet double precision,
  fill_color text not null default '#dc2626',
  line_color text not null default '#991b1b',
  opacity double precision not null default 0.2,
  line_width double precision not null default 3,
  line_style text not null default 'solid',
  effective_at text,
  expires_at text,
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);

create table if not exists firehouse.field_preplan_annotations (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  level_id text not null references firehouse.field_preplan_levels(id) on delete cascade,
  annotation_type text not null,
  operational_subtype text not null default 'custom',
  name text not null,
  label text not null default '',
  geometry text not null,
  coordinate_space text not null,
  line_color text not null default '#dc2626',
  fill_color text not null default '#dc2626',
  line_width double precision not null default 3,
  opacity double precision not null default 0.25,
  font_size double precision not null default 16,
  rotation double precision not null default 0,
  arrow_config text not null default '{}',
  measurement double precision,
  units text not null default 'feet',
  sort_order integer not null default 0,
  min_zoom double precision,
  max_zoom double precision,
  effective_at text,
  expires_at text,
  expiration_action text not null default 'require_verification',
  verified_by text,
  verified_at text,
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);
create index if not exists field_preplan_annotation_level_idx on firehouse.field_preplan_annotations(preplan_id, level_id, archived, sort_order);

create table if not exists firehouse.field_preplan_assets (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  feature_id text references firehouse.field_preplan_features(id) on delete set null,
  hazmat_id text references firehouse.field_preplan_hazmat(id) on delete set null,
  level_id text references firehouse.field_preplan_levels(id) on delete set null,
  category text not null,
  original_filename text not null,
  object_key text not null unique,
  mime_type text not null,
  file_size integer not null,
  caption text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  pin_to_respond integer not null default 0,
  version integer not null default 1,
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);
create index if not exists field_preplan_asset_entity_idx on firehouse.field_preplan_assets(preplan_id, level_id, category, archived, sort_order);

create table if not exists firehouse.field_preplan_photo_annotations (
  id text primary key,
  asset_id text not null references firehouse.field_preplan_assets(id) on delete cascade,
  annotation_type text not null,
  geometry text not null,
  label text not null default '',
  style text not null default '{}',
  sort_order integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);

create table if not exists firehouse.field_preplan_hose_lays (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  level_id text references firehouse.field_preplan_levels(id) on delete set null,
  name text not null,
  source_hydrant_id text references firehouse.field_hydrants(id) on delete set null,
  destination_side text not null default '',
  destination_feature_id text references firehouse.field_preplan_features(id) on delete set null,
  path text not null,
  segment_distances text not null default '[]',
  total_distance_feet double precision not null,
  hose_size_inches double precision not null,
  section_length_feet integer not null default 100,
  reserve_feet integer not null default 100,
  recommended_hose_feet integer not null,
  supply_line_label text not null default '',
  apparatus_id text references firehouse.fleet_apparatus(id) on delete set null,
  apparatus_capacity_feet integer,
  inventory_verified_at text,
  notes text not null default '',
  archived integer not null default 0,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text
);

create table if not exists firehouse.field_preplan_risk_factors (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  factor text not null,
  score integer not null,
  explanation text not null,
  source text not null,
  manual_override integer not null default 0,
  reviewer text,
  reviewed_at text,
  created_by text not null,
  created_at text not null default current_timestamp::text,
  updated_by text not null,
  updated_at text not null default current_timestamp::text,
  unique(preplan_id, factor)
);

create table if not exists firehouse.field_preplan_reviews (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  revision_number integer not null,
  action text not null,
  comment text not null default '',
  actor text not null,
  created_at text not null default current_timestamp::text
);

create table if not exists firehouse.field_preplan_revisions (
  id text primary key,
  preplan_id text not null references firehouse.field_preplans(id) on delete cascade,
  revision_number integer not null,
  publication_status text not null,
  snapshot text not null,
  summary text not null default '',
  actor text not null,
  created_at text not null default current_timestamp::text,
  restored_from_revision integer,
  unique(preplan_id, revision_number)
);

create table if not exists firehouse.field_preplan_settings (
  id integer primary key,
  hose_section_length_feet integer not null default 100,
  hose_reserve_feet integer not null default 100,
  review_warning_days integer not null default 30,
  erg_data_version text not null default 'ERG2024',
  updated_by text not null default 'System',
  updated_at text not null default current_timestamp::text
);
insert into firehouse.field_preplan_settings(id) values(1) on conflict(id) do nothing;

insert into firehouse.rank_permissions(rank, permission_key, allowed, updated_at)
select rank.label, permission.permission_key,
  case
    when lower(rank.label) like '%chief%' then 1
    when permission.permission_key in ('field_preplans.view','field_preplans.edit') and lower(rank.label) ~ '(captain|lieutenant|firefighter|^ff$)' then 1
    when permission.permission_key = 'field_preplans.view' then 1
    else 0
  end,
  current_timestamp::text
from (select distinct label from firehouse.pay_scales) as rank
cross join (values
  ('field_preplans.view'),('field_preplans.edit'),('field_preplans.publish'),('field_preplans.delete'),('field_preplans.review'),
  ('field_preplans.manage_layers'),('field_preplans.manage_hazmat'),('field_preplans.manage_attachments'),
  ('field_preplans.verify_expiring'),('field_preplans.manage_settings')
) as permission(permission_key)
on conflict(rank, permission_key) do nothing;

update storage.buckets set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']::text[]
where id = 'firehouse-portal';

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'field_preplan_levels','field_preplan_feature_levels','field_preplan_spaces','field_preplan_alerts',
    'field_preplan_hazmat','field_preplan_hazmat_zones','field_preplan_annotations','field_preplan_assets',
    'field_preplan_photo_annotations','field_preplan_hose_lays','field_preplan_risk_factors','field_preplan_reviews',
    'field_preplan_revisions','field_preplan_settings'
  ] loop
    execute format('alter table firehouse.%I enable row level security', table_name);
    execute format('revoke all on firehouse.%I from public, anon', table_name);
    execute format('grant select, insert, update, delete on firehouse.%I to authenticated', table_name);
    execute format('drop policy if exists %I on firehouse.%I', table_name || '_department_access', table_name);
    execute format('create policy %I on firehouse.%I for all to authenticated using (firehouse.has_department_access()) with check (firehouse.has_department_access())', table_name || '_department_access', table_name);
  end loop;
end $$;

insert into firehouse.system_meta(key, value, updated_at)
values('preplan_schema_version','stickney-preplan-schema-2026-08-20-v2',current_timestamp::text)
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
