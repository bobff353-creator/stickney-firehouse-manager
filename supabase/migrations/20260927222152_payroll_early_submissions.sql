-- Submission is a frozen copy, NOT a lock on ongoing attendance recording.
-- Filename matches the version assigned by the production migration service.
-- Existing finalized time-entry protections are intentionally unchanged.
CREATE TABLE firehouse.payroll_source_version (
  id integer PRIMARY KEY CHECK (id = 1), version bigint NOT NULL DEFAULT 0
);
INSERT INTO firehouse.payroll_source_version(id) VALUES (1);
CREATE TABLE firehouse.payroll_submissions (
  id text PRIMARY KEY, period_start text NOT NULL UNIQUE REFERENCES firehouse.pay_periods(start_date),
  document text NOT NULL CHECK (jsonb_typeof(document::jsonb) = 'object'),
  fingerprint text NOT NULL, created_by text NOT NULL, created_at text NOT NULL
);
CREATE TABLE firehouse.payroll_adjustments (
  id text PRIMARY KEY,
  source_period text NOT NULL REFERENCES firehouse.payroll_submissions(period_start),
  target_period text NOT NULL REFERENCES firehouse.pay_periods(start_date),
  employee_id text NOT NULL REFERENCES firehouse.employees(id),
  sequence integer NOT NULL CHECK (sequence > 0),
  delta_cents bigint NOT NULL,
  document text NOT NULL CHECK (jsonb_typeof(document::jsonb) = 'object'),
  approved_by text NOT NULL, approved_at text NOT NULL,
  CHECK (target_period > source_period),
  UNIQUE(source_period, employee_id, sequence)
);
CREATE INDEX payroll_adjustments_target_idx ON firehouse.payroll_adjustments(target_period);

-- Access stays behind the existing server-authenticated, permission-checked
-- portal executor. Never expose private payroll documents via the Data API.
ALTER TABLE firehouse.payroll_source_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.payroll_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE firehouse.payroll_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON firehouse.payroll_source_version, firehouse.payroll_submissions, firehouse.payroll_adjustments FROM PUBLIC, anon, authenticated;
GRANT ALL ON firehouse.payroll_source_version, firehouse.payroll_submissions, firehouse.payroll_adjustments TO service_role;

CREATE FUNCTION firehouse.payroll_sources_will_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Same transaction lock as the portal batch executor: serialize source
  -- changes with preview-version checks and immutable ledger inserts.
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  UPDATE firehouse.payroll_source_version SET version = version + 1 WHERE id = 1;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION firehouse.payroll_sources_will_change() FROM PUBLIC;
DO $$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['time_entries','employees','employee_profiles','pay_scales','pay_rate_history','payroll_settings','station_shift_slots','station_schedule_entries','station_shift_types','daily_logs','daily_log_staffing','daily_log_approvals','pay_periods','payroll_submissions','payroll_adjustments'] LOOP
    EXECUTE format('CREATE TRIGGER payroll_source_version BEFORE INSERT OR UPDATE OR DELETE ON firehouse.%I FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change()', relation);
  END LOOP;
END $$;

CREATE FUNCTION firehouse.keep_payroll_submission_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Submitted copies and approved adjustments cannot be edited or deleted.'; END $$;
REVOKE ALL ON FUNCTION firehouse.keep_payroll_submission_immutable() FROM PUBLIC;
CREATE TRIGGER payroll_submission_immutable BEFORE UPDATE OR DELETE ON firehouse.payroll_submissions FOR EACH ROW EXECUTE FUNCTION firehouse.keep_payroll_submission_immutable();
CREATE TRIGGER payroll_adjustment_immutable BEFORE UPDATE OR DELETE ON firehouse.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION firehouse.keep_payroll_submission_immutable();

CREATE FUNCTION firehouse.check_payroll_submission_target() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target text;
BEGIN
  IF TG_TABLE_NAME = 'payroll_submissions' THEN target := NEW.period_start;
  ELSE target := NEW.target_period;
  END IF;
  IF EXISTS (SELECT 1 FROM firehouse.pay_periods WHERE start_date = target AND status = 'finalized') THEN
    RAISE EXCEPTION 'PAYROLL_FINALIZED: This target period is closed.';
  END IF;
  IF TG_TABLE_NAME = 'payroll_adjustments' AND EXISTS (SELECT 1 FROM firehouse.payroll_submissions WHERE period_start = target) THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Choose a later unsubmitted period.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION firehouse.check_payroll_submission_target() FROM PUBLIC;
CREATE TRIGGER payroll_submission_target BEFORE INSERT ON firehouse.payroll_submissions FOR EACH ROW EXECUTE FUNCTION firehouse.check_payroll_submission_target();
CREATE TRIGGER payroll_adjustment_target BEFORE INSERT ON firehouse.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION firehouse.check_payroll_submission_target();

CREATE FUNCTION firehouse.keep_submitted_attendance_open() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'finalized' AND (EXISTS (SELECT 1 FROM firehouse.payroll_submissions WHERE period_start = NEW.start_date) OR EXISTS (SELECT 1 FROM firehouse.payroll_adjustments WHERE target_period = NEW.start_date)) THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Use the submitted copy workflow; keep actual attendance open for reconciliation.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION firehouse.keep_submitted_attendance_open() FROM PUBLIC;
CREATE TRIGGER payroll_submission_keeps_actuals_open BEFORE INSERT OR UPDATE ON firehouse.pay_periods FOR EACH ROW EXECUTE FUNCTION firehouse.keep_submitted_attendance_open();
