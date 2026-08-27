begin;

alter table public.profiles
  add column if not exists pix_key text not null default '',
  add column if not exists card_payment_link text not null default '';

alter table public.profiles
  drop constraint if exists profiles_pix_key_length_check,
  drop constraint if exists profiles_card_payment_link_check;

alter table public.profiles
  add constraint profiles_pix_key_length_check
    check (char_length(pix_key) <= 320),
  add constraint profiles_card_payment_link_check
    check (
      card_payment_link = ''
      or (
        char_length(card_payment_link) <= 2048
        and card_payment_link ~* '^https?://'
      )
    );

create or replace function public.get_my_organization_payment_settings()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'pix_key', coalesce(profile.pix_key, ''),
    'card_payment_link', coalesce(profile.card_payment_link, '')
  )
  from public.profiles profile
  where profile.id = auth.uid()
  limit 1;
$$;

create or replace function public.save_my_organization_payment_settings(
  p_pix_key text default '',
  p_card_payment_link text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_pix text := btrim(coalesce(p_pix_key, ''));
  normalized_card_link text := btrim(coalesce(p_card_payment_link, ''));
  saved_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if char_length(normalized_pix) > 320 then
    raise exception 'A chave Pix informada é muito longa.';
  end if;
  if normalized_card_link <> '' and normalized_card_link !~* '^https?://' then
    raise exception 'Informe um link de pagamento iniciado por https:// ou http://.';
  end if;

  update public.profiles profile
  set pix_key = normalized_pix,
      card_payment_link = normalized_card_link
  where profile.id = auth.uid()
  returning * into saved_profile;

  if saved_profile.id is null then
    raise exception 'Perfil da organização não encontrado.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'pix_key', saved_profile.pix_key,
    'card_payment_link', saved_profile.card_payment_link
  );
end;
$$;

create or replace function public.get_public_organization_payment_settings(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'pix_key', coalesce(profile.pix_key, ''),
    'card_payment_link', coalesce(profile.card_payment_link, '')
  )
  from public.profiles profile
  where profile.id = p_organization_id
    and public.t360_arena_directory_visible(profile.id)
  limit 1;
$$;

revoke all on function public.get_my_organization_payment_settings() from public, anon, authenticated;
revoke all on function public.save_my_organization_payment_settings(text, text) from public, anon, authenticated;
revoke all on function public.get_public_organization_payment_settings(uuid) from public, anon, authenticated;
grant execute on function public.get_my_organization_payment_settings() to authenticated;
grant execute on function public.save_my_organization_payment_settings(text, text) to authenticated;
grant execute on function public.get_public_organization_payment_settings(uuid) to anon, authenticated;

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
after insert or delete or update of name, arena_name, city, state, photo_url, phone,
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

