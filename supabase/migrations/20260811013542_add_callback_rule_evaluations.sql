alter table firehouse.daily_log_callback_submissions
  add column if not exists call_type text not null default '',
  add column if not exists call_time_out text not null default '',
  add column if not exists call_time_in text not null default '',
  add column if not exists rule_version text not null default '',
  add column if not exists rule_matches text not null default '[]',
  add column if not exists rule_flags text not null default '[]',
  add column if not exists suggested_hours double precision not null default 2,
  add column if not exists actual_minutes integer,
  add column if not exists approved_hours double precision not null default 0,
  add column if not exists submitted_by_employee_id text references firehouse.employees(id),
  add column if not exists submitted_by_rank text not null default '';

create table if not exists firehouse.callback_payroll_aggregates (
  employee_id text not null references firehouse.employees(id),
  work_date text not null,
  manual_baseline_hours double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key(employee_id, work_date)
);

alter table firehouse.callback_payroll_aggregates enable row level security;
drop policy if exists callback_payroll_aggregates_department_access on firehouse.callback_payroll_aggregates;
create policy callback_payroll_aggregates_department_access
  on firehouse.callback_payroll_aggregates
  for all
  to authenticated
  using (firehouse.has_department_access())
  with check (firehouse.has_department_access());
revoke all on firehouse.callback_payroll_aggregates from public, anon;
grant select, insert, update, delete on firehouse.callback_payroll_aggregates to authenticated;

update firehouse.callback_review_settings
set rules_json = '{"weekend":{"fridayStart":"18:00","sundayEnd":"18:00"},"holiday":true,"callTypes":["Auto accident","Fire alarm","Mutual aid","Auto aid"],"backToBackMinutes":5,"minimumHours":2,"roundingMinutes":15,"onDutyFlag":true,"overlappingWindowFlag":true,"deputyChiefOverride":true}',
    updated_at = now()
where id = 'default';

insert into firehouse.system_meta(key,value,updated_at)
values('runtime_bootstrap_version','stickney-runtime-bootstrap-2026-08-10-callback-rules-v2',now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
