-- Additive only: preserve legacy role selections and every existing assignment.
ALTER TABLE firehouse.employee_profiles ADD COLUMN IF NOT EXISTS single_role INTEGER NOT NULL DEFAULT 0 CHECK (single_role IN (0,1));
ALTER TABLE firehouse.station_shift_slots ADD COLUMN IF NOT EXISTS staffing_reason TEXT NOT NULL DEFAULT '';
