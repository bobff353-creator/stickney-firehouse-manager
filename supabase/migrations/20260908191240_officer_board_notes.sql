-- Attribution is separate from created_by; legacy notes keep their existing author.
ALTER TABLE firehouse.chief_board_items
  ADD COLUMN IF NOT EXISTS officer_employee_id text REFERENCES firehouse.employees(id),
  ADD COLUMN IF NOT EXISTS officer_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS chief_board_officer_idx ON firehouse.chief_board_items(officer_employee_id);
