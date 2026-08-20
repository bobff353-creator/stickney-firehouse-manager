-- The recovered Sites database contains historical daily logs created before
-- created_at became mandatory. Preserve those records exactly during cutover.
ALTER TABLE firehouse.daily_logs
  ALTER COLUMN created_at DROP NOT NULL;
