CREATE TABLE IF NOT EXISTS firehouse.push_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  department_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  active bigint NOT NULL DEFAULT 1,
  failure_count bigint NOT NULL DEFAULT 0,
  last_success_at text,
  last_error text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text),
  updated_at text NOT NULL DEFAULT (CURRENT_TIMESTAMP::text)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_active_department_idx
  ON firehouse.push_subscriptions(department_id, active);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON firehouse.push_subscriptions(user_id, active);

ALTER TABLE firehouse.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stickney_member_owns_push_subscription
  ON firehouse.push_subscriptions;

CREATE POLICY stickney_member_owns_push_subscription
  ON firehouse.push_subscriptions
  FOR ALL
  TO authenticated
  USING (
    (SELECT firehouse.has_department_access())
    AND user_id = (SELECT auth.uid())::text
  )
  WITH CHECK (
    (SELECT firehouse.has_department_access())
    AND user_id = (SELECT auth.uid())::text
  );

REVOKE ALL ON firehouse.push_subscriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON firehouse.push_subscriptions TO authenticated;
