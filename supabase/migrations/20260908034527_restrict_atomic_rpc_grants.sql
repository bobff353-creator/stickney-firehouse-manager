-- Supabase default privileges may grant roles EXECUTE directly, separately
-- from PUBLIC. Remove those inherited defaults before granting intended access.
REVOKE ALL ON FUNCTION public.firehouse_server_sql_batch(jsonb,text) FROM PUBLIC,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.firehouse_server_sql_batch(jsonb,text) TO anon;
REVOKE ALL ON FUNCTION public.inventory_record_item_atomic(uuid,uuid,text,text,numeric,uuid,text[],text[],text[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.inventory_record_item_atomic(uuid,uuid,text,text,numeric,uuid,text[],text[],text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_complete_check_atomic(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.inventory_complete_check_atomic(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_guard_active_result() FROM PUBLIC,anon,authenticated,service_role;
