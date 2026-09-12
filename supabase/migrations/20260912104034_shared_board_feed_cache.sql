-- Only public-source information, never member/incident/department records.
-- Read/write through the existing secret-verified firehouse_server_sql boundary.
-- No new API/table privileges and no new SECURITY DEFINER functions.
CREATE TABLE firehouse.board_feed_cache (
  source text PRIMARY KEY CHECK (source IN ('close_calls','usfa','weather','training_romeoville','training_ifsi','training_nipsta')),
  payload jsonb,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  attempted_slot timestamptz,
  attempt_id uuid,
  next_scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'unavailable' CHECK (status IN ('unavailable','updating','ok','error')),
  error_code text,
  CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object')
);
ALTER TABLE firehouse.board_feed_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_direct_feed_access ON firehouse.board_feed_cache TO anon,authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON firehouse.board_feed_cache FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION firehouse.next_board_feed_slot(p_source text, p_now timestamptz)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE local_now timestamp := p_now AT TIME ZONE 'America/Chicago'; candidate timestamp;
BEGIN
  IF p_source = 'weather' THEN
    RETURN to_timestamp((floor(extract(epoch FROM p_now) / 900) + 1) * 900);
  END IF;
  candidate := date_trunc('day',local_now) + interval '6 hours';
  IF local_now >= candidate THEN
    IF p_source IN ('close_calls','usfa') AND local_now < date_trunc('day',local_now) + interval '18 hours' THEN
      candidate := date_trunc('day',local_now) + interval '18 hours';
    ELSE candidate := candidate + interval '1 day'; END IF;
  END IF;
  RETURN candidate AT TIME ZONE 'America/Chicago';
END $$;

CREATE FUNCTION firehouse.claim_board_feed(p_source text, p_now timestamptz DEFAULT clock_timestamp())
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE local_now timestamp := p_now AT TIME ZONE 'America/Chicago'; slot timestamptz; claimed uuid;
BEGIN
  IF p_source NOT IN ('close_calls','usfa','weather','training_romeoville','training_ifsi','training_nipsta') THEN
    RAISE EXCEPTION 'Unknown board feed';
  END IF;
  -- A late/duplicate cron can use this quarter-hour's slot, never catch up missed slots.
  IF p_source = 'weather' THEN
    slot := to_timestamp(floor(extract(epoch FROM p_now) / 900) * 900);
  ELSE
    IF extract(minute FROM local_now) >= 15 OR NOT (
      extract(hour FROM local_now) = 6 OR
      (p_source IN ('close_calls','usfa') AND extract(hour FROM local_now) = 18)
    ) THEN RETURN NULL; END IF;
    slot := date_trunc('hour', local_now) AT TIME ZONE 'America/Chicago';
  END IF;
  -- Consume the slot BEFORE external I/O. Failed/crashed workers cannot retry it.
  INSERT INTO firehouse.board_feed_cache AS cache
    (source,last_attempt_at,attempted_slot,attempt_id,next_scheduled_at,status)
  VALUES (p_source,p_now,slot,gen_random_uuid(),firehouse.next_board_feed_slot(p_source,p_now),'updating')
  ON CONFLICT (source) DO UPDATE SET
    last_attempt_at=EXCLUDED.last_attempt_at, attempted_slot=EXCLUDED.attempted_slot,
    attempt_id=EXCLUDED.attempt_id, next_scheduled_at=EXCLUDED.next_scheduled_at,
    status='updating', error_code=NULL
  WHERE cache.attempted_slot < EXCLUDED.attempted_slot
  RETURNING attempt_id INTO claimed;
  RETURN claimed;
END $$;

CREATE FUNCTION firehouse.finish_board_feed(p_source text, p_attempt uuid, p_payload_base64 text, p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved integer; parsed jsonb;
BEGIN
  IF p_payload_base64 IS NOT NULL THEN
    IF length(p_payload_base64)>180000 THEN RAISE EXCEPTION 'Feed response too large'; END IF;
    parsed := convert_from(decode(p_payload_base64,'base64'),'UTF8')::jsonb;
    IF jsonb_typeof(parsed)<>'object' THEN RAISE EXCEPTION 'Invalid feed response'; END IF;
  END IF;
  UPDATE firehouse.board_feed_cache SET
    payload=CASE WHEN parsed IS NOT NULL THEN parsed ELSE payload END,
    last_success_at=CASE WHEN parsed IS NOT NULL THEN clock_timestamp() ELSE last_success_at END,
    status=CASE WHEN parsed IS NOT NULL THEN 'ok' ELSE 'error' END,
    error_code=CASE WHEN parsed IS NOT NULL THEN NULL ELSE 'source_unavailable' END
  WHERE source=p_source AND attempt_id=p_attempt AND status='updating';
  GET DIAGNOSTICS saved = ROW_COUNT;
  RETURN saved=1;
END $$;

REVOKE ALL ON FUNCTION firehouse.next_board_feed_slot(text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.claim_board_feed(text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION firehouse.finish_board_feed(text,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
