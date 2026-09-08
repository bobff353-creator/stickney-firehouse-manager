-- Existing trades remain giveaways. No assignments or historical requests are changed.
ALTER TABLE firehouse.station_trade_requests
  ADD COLUMN IF NOT EXISTS return_slot_id text REFERENCES firehouse.station_shift_slots(id);

CREATE OR REPLACE FUNCTION firehouse.guard_new_station_trade()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = firehouse, pg_temp AS $$
BEGIN
  -- Serialize submissions for this shift without deleting legacy duplicates.
  PERFORM 1 FROM station_shift_slots WHERE id IN (NEW.slot_id, NEW.return_slot_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM station_shift_slots WHERE id = NEW.slot_id
      AND employee_id = NEW.from_employee_id AND status = 'filled') THEN
    RAISE EXCEPTION 'The offered shift assignment changed. Refresh and try again.';
  END IF;
  IF EXISTS (SELECT 1 FROM station_trade_requests WHERE slot_id = NEW.slot_id
      AND status IN ('pending', 'awaiting_acceptance')) THEN
    RAISE EXCEPTION 'This shift already has an open trade request.';
  END IF;
  IF NEW.return_slot_id IS NOT NULL AND
      (NEW.return_slot_id = NEW.slot_id OR NEW.target_employee_id IS NULL OR
       NOT EXISTS (SELECT 1 FROM station_shift_slots WHERE id = NEW.return_slot_id
         AND employee_id = NEW.target_employee_id AND status = 'filled')) THEN
    RAISE EXCEPTION 'Choose a different return shift belonging to the selected member.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION firehouse.guard_new_station_trade() FROM PUBLIC;
CREATE TRIGGER guard_new_station_trade BEFORE INSERT ON firehouse.station_trade_requests
FOR EACH ROW EXECUTE FUNCTION firehouse.guard_new_station_trade();
