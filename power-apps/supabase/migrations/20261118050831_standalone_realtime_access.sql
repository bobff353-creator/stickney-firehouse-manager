CREATE POLICY "receive_apparatus_locations" ON realtime.messages AS PERMISSIVE FOR SELECT TO authenticated USING (((extension = 'broadcast'::text) AND (EXISTS ( SELECT 1
   FROM firehouse.apparatus_location_view_leases lease
  WHERE ((lease.user_id = ( SELECT auth.uid() AS uid)) AND (lease.topic = realtime.topic()) AND (lease.expires_at > now()))))));

CREATE POLICY "receive_operational_changes" ON realtime.messages AS PERMISSIVE FOR SELECT TO authenticated USING (((extension = 'broadcast'::text) AND (EXISTS ( SELECT 1
   FROM firehouse.operational_view_leases lease
  WHERE ((lease.user_id = ( SELECT auth.uid() AS uid)) AND (lease.topic = realtime.topic()) AND (lease.expires_at > now()))))));
