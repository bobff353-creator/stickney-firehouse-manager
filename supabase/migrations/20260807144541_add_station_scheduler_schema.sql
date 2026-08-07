create table if not exists firehouse.station_shift_types (
  id text primary key,
  name text not null,
  start_time text not null,
  end_time text not null,
  color text not null default 'red',
  active integer not null default 1,
  sort_order integer not null default 0,
  created_by text not null default 'System',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);
create index if not exists station_shift_types_active_idx on firehouse.station_shift_types(active, sort_order);

create table if not exists firehouse.station_shift_type_roles (
  id text primary key,
  shift_type_id text not null references firehouse.station_shift_types(id),
  role text not null,
  count integer not null default 1,
  constraint station_shift_type_role_unique unique (shift_type_id, role)
);

create table if not exists firehouse.station_schedule_entries (
  id text primary key,
  entry_date text not null,
  shift_type_id text not null references firehouse.station_shift_types(id),
  created_by text not null default 'System',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  constraint station_schedule_entry_unique unique (entry_date, shift_type_id)
);
create index if not exists station_schedule_entry_date_idx on firehouse.station_schedule_entries(entry_date);

create table if not exists firehouse.station_shift_slots (
  id text primary key,
  entry_id text not null references firehouse.station_schedule_entries(id),
  role text not null,
  employee_id text references firehouse.employees(id),
  status text not null default 'open',
  sort_order integer not null default 0
);
create index if not exists station_shift_slot_entry_idx on firehouse.station_shift_slots(entry_id, sort_order);
create index if not exists station_shift_slot_employee_idx on firehouse.station_shift_slots(employee_id);

create table if not exists firehouse.station_standing_assignments (
  id text primary key,
  employee_id text not null references firehouse.employees(id),
  shift_type_id text not null references firehouse.station_shift_types(id),
  role text not null,
  active integer not null default 1,
  created_by text not null default 'System',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  constraint station_standing_assignment_unique unique (employee_id, shift_type_id, role)
);

create table if not exists firehouse.station_trade_requests (
  id text primary key,
  slot_id text not null references firehouse.station_shift_slots(id),
  role text not null,
  from_employee_id text not null references firehouse.employees(id),
  target_employee_id text references firehouse.employees(id),
  accepted_by_employee_id text references firehouse.employees(id),
  note text not null default '',
  status text not null default 'pending',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  reviewed_by text,
  reviewed_at text
);
create index if not exists station_trade_status_idx on firehouse.station_trade_requests(status, created_at);

create table if not exists firehouse.station_shift_claims (
  id text primary key,
  slot_id text not null references firehouse.station_shift_slots(id),
  role text not null,
  employee_id text not null references firehouse.employees(id),
  note text not null default '',
  status text not null default 'pending',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  reviewed_by text,
  reviewed_at text
);
create index if not exists station_shift_claim_status_idx on firehouse.station_shift_claims(status, created_at);
create index if not exists station_shift_claim_slot_idx on firehouse.station_shift_claims(slot_id);

create table if not exists firehouse.station_time_off_requests (
  id text primary key,
  employee_id text not null references firehouse.employees(id),
  type text not null,
  approver_employee_id text not null references firehouse.employees(id),
  note text not null default '',
  status text not null default 'pending',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  reviewed_at text
);
create index if not exists station_time_off_status_idx on firehouse.station_time_off_requests(status, created_at);

create table if not exists firehouse.station_time_off_dates (
  request_id text not null references firehouse.station_time_off_requests(id),
  off_date text not null,
  constraint station_time_off_date_unique unique (request_id, off_date)
);

create table if not exists firehouse.station_unavailability (
  id text primary key,
  employee_id text not null references firehouse.employees(id),
  off_date text not null,
  source text not null default 'time_off',
  request_id text references firehouse.station_time_off_requests(id),
  constraint station_unavailability_unique unique (employee_id, off_date)
);

create table if not exists firehouse.station_reminder_rules (
  id text primary key,
  type text not null,
  label text not null default '',
  offsets text not null default '[]',
  email_enabled integer not null default 1,
  text_enabled integer not null default 0,
  target text not null default '',
  enabled integer not null default 1,
  updated_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

create table if not exists firehouse.station_ot_settings (
  mode text primary key,
  exempt_off_duty integer not null default 1,
  exempt_already_scheduled integer not null default 1,
  exempt_declined integer not null default 1,
  exempt_recently_mandated integer not null default 1,
  recent_days integer not null default 14,
  exempt_max_consecutive integer not null default 1,
  max_consecutive integer not null default 2,
  priority_order text not null default '[]',
  custom_rules text not null default '[]',
  updated_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

create table if not exists firehouse.station_ot_timing (
  id integer primary key,
  award_days_out integer not null default 7,
  complete_by_days_out integer not null default 2,
  updated_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

create table if not exists firehouse.station_ot_interest (
  id text primary key,
  slot_id text not null references firehouse.station_shift_slots(id),
  employee_id text not null references firehouse.employees(id),
  response text not null,
  responded_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  constraint station_ot_interest_unique unique (slot_id, employee_id)
);

create table if not exists firehouse.station_ot_offers (
  id text primary key,
  slot_id text not null references firehouse.station_shift_slots(id),
  employee_id text not null references firehouse.employees(id),
  mode text not null,
  status text not null default 'offered',
  rank integer not null default 0,
  offered_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  responded_at text
);
create index if not exists station_ot_offer_slot_idx on firehouse.station_ot_offers(slot_id, rank);
create index if not exists station_ot_offer_employee_idx on firehouse.station_ot_offers(employee_id, status);

create table if not exists firehouse.station_distribution_weights (
  id integer primary key,
  seniority_weight double precision not null default 1,
  hours_weight double precision not null default 1,
  custom_weight double precision not null default 0,
  custom_label text not null default 'Cross-trained',
  updated_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

alter table firehouse.employee_profiles add column if not exists station_roles text not null default '[]';
alter table firehouse.employee_profiles add column if not exists station_hours_this_period double precision not null default 0;
alter table firehouse.employee_profiles add column if not exists station_ot_hours double precision not null default 0;
alter table firehouse.employee_profiles add column if not exists station_mandatory_hours double precision not null default 0;
alter table firehouse.employee_profiles add column if not exists station_off_duty integer not null default 0;
alter table firehouse.employee_profiles add column if not exists station_last_mandated text not null default '';
alter table firehouse.employee_profiles add column if not exists station_consecutive_mandatory integer not null default 0;
alter table firehouse.employee_profiles add column if not exists station_notify_email integer not null default 1;
alter table firehouse.employee_profiles add column if not exists station_notify_text integer not null default 0;

insert into firehouse.station_ot_settings(mode, exempt_declined, priority_order, custom_rules)
values
  ('voluntary', 1, '["leastOT","mostSeniority"]', '[]'),
  ('mandatory', 0, '["leastMandatory","leastSeniority"]', '[]')
on conflict (mode) do nothing;

insert into firehouse.station_ot_timing(id, award_days_out, complete_by_days_out)
values (1, 7, 2)
on conflict (id) do nothing;

insert into firehouse.station_distribution_weights(id, seniority_weight, hours_weight, custom_weight, custom_label)
values (1, 1, 1, 0.5, 'Cross-trained')
on conflict (id) do nothing;

insert into firehouse.station_reminder_rules(id, type, label, offsets, email_enabled, text_enabled, target, enabled)
values
  ('station-shift-request', 'shift_request', 'Shift request updates', '["7 days before","2 days before"]', 1, 0, 'Requesting member and approvers', 1),
  ('station-request-deadline', 'request_deadline', 'Response deadline reminders', '["2 days before","1 day before"]', 1, 1, 'Eligible members only', 1),
  ('station-open-shift-blast', 'open_shift_blast', 'Open shift blasts', '["immediate","2 days before"]', 1, 1, 'Eligible members only', 1)
on conflict (id) do nothing;

-- Preserve every existing assigned schedule row in the replacement scheduler.
insert into firehouse.station_shift_types(id, name, start_time, end_time, color, active, sort_order, created_by)
select
  'legacy-' || substring(md5(start_time || '|' || end_time), 1, 24),
  'Imported ' || start_time || '–' || end_time,
  start_time,
  end_time,
  'blue',
  1,
  (row_number() over (order by start_time, end_time))::integer,
  'Legacy schedule migration'
from (
  select distinct start_time, end_time
  from firehouse.schedule_assignments
  where status = 'assigned'
) legacy_times
on conflict (id) do nothing;

insert into firehouse.station_shift_type_roles(id, shift_type_id, role, count)
select
  'legacy-role-' || substring(md5(grouped.shift_type_id || '|' || grouped.role), 1, 20),
  grouped.shift_type_id,
  grouped.role,
  max(grouped.daily_count)::integer
from (
  select
    'legacy-' || substring(md5(start_time || '|' || end_time), 1, 24) as shift_type_id,
    work_date,
    role,
    count(*) as daily_count
  from firehouse.schedule_assignments
  where status = 'assigned'
  group by start_time, end_time, work_date, role
) grouped
group by grouped.shift_type_id, grouped.role
on conflict (shift_type_id, role) do nothing;

insert into firehouse.station_schedule_entries(id, entry_date, shift_type_id, created_by)
select
  'legacy-entry-' || substring(md5(work_date || '|' || start_time || '|' || end_time), 1, 20),
  work_date,
  'legacy-' || substring(md5(start_time || '|' || end_time), 1, 24),
  'Legacy schedule migration'
from firehouse.schedule_assignments
where status = 'assigned'
group by work_date, start_time, end_time
on conflict (entry_date, shift_type_id) do nothing;

insert into firehouse.station_shift_slots(id, entry_id, role, employee_id, status, sort_order)
select
  'legacy-slot-' || substring(md5(assignment.id), 1, 20),
  'legacy-entry-' || substring(md5(assignment.work_date || '|' || assignment.start_time || '|' || assignment.end_time), 1, 20),
  assignment.role,
  assignment.employee_id,
  case when assignment.employee_id is null then 'open' else 'filled' end,
  (row_number() over (
    partition by assignment.work_date, assignment.start_time, assignment.end_time
    order by assignment.role, assignment.employee_id nulls last, assignment.id
  ))::integer
from firehouse.schedule_assignments assignment
where assignment.status = 'assigned'
on conflict (id) do nothing;

alter table firehouse.station_shift_types enable row level security;
alter table firehouse.station_shift_type_roles enable row level security;
alter table firehouse.station_schedule_entries enable row level security;
alter table firehouse.station_shift_slots enable row level security;
alter table firehouse.station_standing_assignments enable row level security;
alter table firehouse.station_trade_requests enable row level security;
alter table firehouse.station_shift_claims enable row level security;
alter table firehouse.station_time_off_requests enable row level security;
alter table firehouse.station_time_off_dates enable row level security;
alter table firehouse.station_unavailability enable row level security;
alter table firehouse.station_reminder_rules enable row level security;
alter table firehouse.station_ot_settings enable row level security;
alter table firehouse.station_ot_timing enable row level security;
alter table firehouse.station_ot_interest enable row level security;
alter table firehouse.station_ot_offers enable row level security;
alter table firehouse.station_distribution_weights enable row level security;
