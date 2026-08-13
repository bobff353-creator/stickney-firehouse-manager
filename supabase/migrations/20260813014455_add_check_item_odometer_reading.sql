alter table public.inventory_check_items
  add column if not exists numeric_reading numeric;

alter table public.inventory_check_items
  drop constraint if exists inventory_check_items_numeric_reading_nonnegative;

alter table public.inventory_check_items
  add constraint inventory_check_items_numeric_reading_nonnegative
  check (numeric_reading is null or numeric_reading >= 0);

comment on column public.inventory_check_items.numeric_reading is
  'Numeric inspection reading such as mileage or odometer value; null for ordinary pass/fail items.';
