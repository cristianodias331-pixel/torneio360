begin;

-- Novas imagens deixam de aumentar o JSON dos torneios. Arquivos antigos em
-- Base64 continuam válidos e serão migrados somente em uma etapa controlada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event_media_public_read" on storage.objects;
create policy "event_media_public_read"
on storage.objects for select
to public
using (bucket_id = 'event-media');

drop policy if exists "event_media_owner_insert" on storage.objects;
create policy "event_media_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

drop policy if exists "event_media_owner_update" on storage.objects;
create policy "event_media_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-media'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-media'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

drop policy if exists "event_media_owner_delete" on storage.objects;
create policy "event_media_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-media'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

commit;
