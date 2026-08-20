-- Add the officer Fleet-duty acknowledgement without changing existing log records.
ALTER TABLE firehouse.daily_log_approvals
  ADD COLUMN IF NOT EXISTS fleet_duties_acknowledged integer NOT NULL DEFAULT 0;
