create unique index if not exists inventory_checks_one_active_type_idx
  on public.inventory_checks (department_id, apparatus_id, check_type)
  where status = 'in_progress';
