-- The Stickney branch of inventory_can_access depends on request identity,
-- not on the individual item. Evaluate it once per SELECT, not per item.
-- Reuse the same helper and retain per-department checks for other tenants.
-- ALTER POLICY preserves roles; write rules and restrictive server boundaries
-- are deliberately untouched. No records, indexes, or grants are changed.
DO $migration$
DECLARE policy record;
BEGIN
  FOR policy IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND left(tablename, 10) = 'inventory_'
      AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
      AND roles = ARRAY['authenticated']::name[]
      AND qual = 'private.inventory_can_access(department_id)'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (
        CASE WHEN department_id = ''14a76771-4c24-481b-8def-e6cce005c17b''::uuid
          THEN (SELECT private.inventory_can_access(''14a76771-4c24-481b-8def-e6cce005c17b''::uuid))
          ELSE private.inventory_can_access(department_id)
        END
      )', policy.policyname, policy.tablename);
  END LOOP;
END $migration$;
