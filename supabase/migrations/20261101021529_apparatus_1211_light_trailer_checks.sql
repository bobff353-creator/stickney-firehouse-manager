-- Existing item/result IDs and in-progress or completed checks remain unchanged.
ALTER TABLE public.inventory_equipment
  ADD COLUMN IF NOT EXISTS weekly_recurrence text NOT NULL DEFAULT 'every_week';
ALTER TABLE public.inventory_equipment
  DROP CONSTRAINT IF EXISTS inventory_equipment_weekly_recurrence_check;
ALTER TABLE public.inventory_equipment
  ADD CONSTRAINT inventory_equipment_weekly_recurrence_check
  CHECK (weekly_recurrence IN ('every_week','first_third_saturday'));
COMMENT ON COLUMN public.inventory_equipment.weekly_recurrence IS
  'Frequency when opening a new weekly check in America/Chicago; saved checks retain their original items.';
ALTER TABLE public.department_apparatus DROP CONSTRAINT department_apparatus_status_check;
ALTER TABLE public.department_apparatus ADD CONSTRAINT department_apparatus_status_check
  CHECK (status IN ('in_service','reserve','out_of_service','deployed'));
