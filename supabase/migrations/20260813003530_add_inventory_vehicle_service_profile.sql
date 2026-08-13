alter table public.inventory_apparatus_profiles
  add column if not exists vin_decoded_json jsonb not null default '{}'::jsonb,
  add column if not exists vin_decoded_at timestamptz,
  add column if not exists vin_source text not null default '',
  add column if not exists oil_specification text not null default '',
  add column if not exists oil_capacity text not null default '',
  add column if not exists transmission_fluid_specification text not null default '',
  add column if not exists coolant_specification text not null default '',
  add column if not exists front_tire_size text not null default '',
  add column if not exists rear_tire_size text not null default '',
  add column if not exists tire_pressure_notes text not null default '',
  add column if not exists fuel_capacity text not null default '',
  add column if not exists battery_specification text not null default '',
  add column if not exists filter_part_numbers text not null default '',
  add column if not exists maintenance_schedule text not null default '',
  add column if not exists owner_manual_url text not null default '',
  add column if not exists service_manual_url text not null default '',
  add column if not exists parts_catalog_url text not null default '',
  add column if not exists preferred_vendor text not null default '',
  add column if not exists ordering_notes text not null default '',
  add column if not exists service_profile_verified_at timestamptz,
  add column if not exists service_profile_verified_by uuid references auth.users(id) on delete set null;

comment on column public.inventory_apparatus_profiles.vin_decoded_json is
  'Official NHTSA vPIC decode snapshot. Blank NHTSA values must not be interpreted as absent equipment.';
comment on column public.inventory_apparatus_profiles.maintenance_schedule is
  'Department-verified service schedule; never inferred solely from a VIN.';
comment on column public.inventory_apparatus_profiles.service_profile_verified_at is
  'Last time a department user verified the fluids, tires, service, manual, catalog, and vendor fields.';
