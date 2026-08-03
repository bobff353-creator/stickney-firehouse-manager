create policy "PIN credentials deny direct access"
on public.portal_pin_credentials
as restrictive
for all
to public
using (false)
with check (false);

