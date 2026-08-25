create index if not exists inventory_work_order_documents_apparatus_idx
  on public.inventory_work_order_documents (department_id, apparatus_id);

create index if not exists inventory_inspection_schedules_apparatus_idx
  on public.inventory_inspection_schedules (department_id, apparatus_id);
