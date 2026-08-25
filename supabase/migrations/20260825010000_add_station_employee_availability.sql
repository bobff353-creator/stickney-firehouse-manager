create table if not exists firehouse.station_availability (
  id text primary key,
  employee_id text not null references firehouse.employees(id),
  availability_date text not null,
  status text not null default 'available' check (status in ('available', 'unavailable')),
  all_day integer not null default 1,
  start_time text not null default '06:00',
  end_time text not null default '18:00',
  note text not null default '',
  created_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at text not null default to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  constraint station_availability_employee_date_unique unique (employee_id, availability_date)
);

create index if not exists station_availability_date_idx
  on firehouse.station_availability(availability_date, status);

alter table firehouse.station_availability enable row level security;
