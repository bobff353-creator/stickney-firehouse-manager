alter table public.inventory_apparatus_profiles
  add column if not exists weekly_due_day smallint;

alter table public.inventory_apparatus_profiles
  drop constraint if exists inventory_apparatus_profiles_weekly_due_day_check;

alter table public.inventory_apparatus_profiles
  add constraint inventory_apparatus_profiles_weekly_due_day_check
  check (weekly_due_day is null or weekly_due_day between 0 and 6);

comment on column public.inventory_apparatus_profiles.weekly_due_day is
  'Chicago weekday when the apparatus weekly check is due: 0 Sunday through 6 Saturday; null disables scheduling.';
