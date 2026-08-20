create table if not exists firehouse.callback_review_settings (
  id text primary key,
  reviewer_employee_id text not null references firehouse.employees(id),
  rules_json text not null default '{}',
  updated_by text not null default 'System',
  updated_at timestamptz not null default now()
);

create table if not exists firehouse.daily_log_callback_submissions (
  id text primary key,
  log_date text not null references firehouse.daily_logs(log_date),
  call_id text not null,
  report_number text not null default '',
  employee_id text not null references firehouse.employees(id),
  reviewer_employee_id text not null references firehouse.employees(id),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text not null default '',
  unique(call_id, employee_id)
);

create index if not exists daily_log_callbacks_status_idx on firehouse.daily_log_callback_submissions(status, submitted_at desc);
create index if not exists daily_log_callbacks_reviewer_idx on firehouse.daily_log_callback_submissions(reviewer_employee_id, status);

insert into firehouse.callback_review_settings(id, reviewer_employee_id, updated_by)
select 'default', e.id, 'Administrator setup'
from firehouse.employees e
where e.id='wyant-robert'
on conflict(id) do nothing;

alter table firehouse.callback_review_settings enable row level security;
alter table firehouse.daily_log_callback_submissions enable row level security;
drop policy if exists callback_review_settings_department_access on firehouse.callback_review_settings;
create policy callback_review_settings_department_access on firehouse.callback_review_settings for all to authenticated using (firehouse.has_department_access()) with check (firehouse.has_department_access());
drop policy if exists daily_log_callbacks_department_access on firehouse.daily_log_callback_submissions;
create policy daily_log_callbacks_department_access on firehouse.daily_log_callback_submissions for all to authenticated using (firehouse.has_department_access()) with check (firehouse.has_department_access());
revoke all on firehouse.callback_review_settings from public, anon;
revoke all on firehouse.daily_log_callback_submissions from public, anon;
grant select, insert, update, delete on firehouse.callback_review_settings to authenticated;
grant select, insert, update, delete on firehouse.daily_log_callback_submissions to authenticated;
