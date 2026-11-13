-- Never expose historical personnel files through permissive app policies.
-- Every other bucket retains its existing access rules.
create policy stickney_legacy_storage_private
on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'stickney-legacy-archive')
with check (bucket_id <> 'stickney-legacy-archive');
