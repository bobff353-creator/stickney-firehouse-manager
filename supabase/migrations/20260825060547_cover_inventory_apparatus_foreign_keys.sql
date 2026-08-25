create index if not exists inventory_work_order_documents_apparatus_fk_idx
  on public.inventory_work_order_documents (apparatus_id);

create index if not exists inventory_inspection_schedules_apparatus_fk_idx
  on public.inventory_inspection_schedules (apparatus_id);
