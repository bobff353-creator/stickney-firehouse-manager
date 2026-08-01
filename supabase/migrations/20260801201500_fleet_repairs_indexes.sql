create index if not exists inventory_deficiency_photos_apparatus_fk_idx
  on public.inventory_deficiency_photos(apparatus_id);
create index if not exists inventory_deficiency_photos_check_item_fk_idx
  on public.inventory_deficiency_photos(check_item_id);
create index if not exists inventory_exceptions_evidence_photo_fk_idx
  on public.inventory_readiness_exceptions(evidence_photo_id);
create index if not exists inventory_work_orders_linked_exception_fk_idx
  on public.inventory_work_orders(linked_exception_id);
