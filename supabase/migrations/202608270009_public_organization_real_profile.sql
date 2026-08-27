begin;

-- A visita pública e o proprietário consomem a mesma identidade real da
-- organização. A capa é um dado público do perfil, enquanto as permissões de
-- edição continuam sendo decididas exclusivamente na interface autenticada.
create or replace function public.build_public_arena_profile_uncached(p_organizer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select jsonb_build_object(
    'id', profile.id,
    'name', profile.name,
    'arena_name', profile.arena_name,
    'city', profile.city,
    'state', profile.state,
    'photo_url', case
      when coalesce(profile.photo_url, '') ~* '^https?://' then profile.photo_url
      else null
    end,
    'cover_url', case
      when coalesce(profile.cover_url, '') ~* '^https?://' then profile.cover_url
      else null
    end,
    'has_photo', nullif(profile.photo_url, '') is not null,
    'phone', profile.phone,
    'address', profile.address,
    'maps_link', profile.maps_link,
    'instagram_handle', profile.instagram_handle,
    'instagram_link', profile.instagram_link,
    'whatsapp_group_link', profile.whatsapp_group_link,
    'pix_key', profile.pix_key,
    'card_payment_link', profile.card_payment_link
  )
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where profile.id = p_organizer_id
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
      'athlete', 'visitor', 'spectator'
    )
  limit 1;
$$;

revoke all on function public.build_public_arena_profile_uncached(uuid) from public, anon, authenticated;

drop trigger if exists profiles_refresh_public_arena_snapshot on public.profiles;
create trigger profiles_refresh_public_arena_snapshot
after insert or delete or update of name, arena_name, city, state, photo_url, cover_url, phone,
  address, maps_link, instagram_handle, instagram_link, whatsapp_group_link,
  pix_key, card_payment_link
on public.profiles
for each row execute function public.refresh_arena_snapshot_after_profile_change();

do $$
declare
  organization record;
begin
  for organization in
    select profile.id
    from public.profiles profile
    where public.t360_arena_directory_visible(profile.id)
  loop
    perform public.refresh_public_arena_snapshot(organization.id);
  end loop;
end;
$$;

commit;
