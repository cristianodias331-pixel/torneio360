-- Modalidades praticadas pelo atleta. Mantém o nível técnico separado da lista de esportes.
begin;

alter table public.member_profiles
  add column if not exists sports text[] not null default array['Beach Tennis']::text[];

alter table public.member_profiles
  alter column sports set default array['Beach Tennis']::text[];

update public.member_profiles
set sports = array['Beach Tennis']::text[]
where cardinality(sports) = 0;

alter table public.member_profiles
  drop constraint if exists member_profiles_sports_check;
alter table public.member_profiles
  add constraint member_profiles_sports_check check (
    cardinality(sports) between 1 and 5
    and sports <@ array['Beach Tennis', 'Vôlei', 'Futevôlei', 'Tênis', 'Pickleball']::text[]
  );

create or replace function public.upsert_my_member_profile_v4(
  p_display_name text,
  p_handle text default null,
  p_photo_url text default '',
  p_cover_url text default '',
  p_bio text default '',
  p_city text default '',
  p_state text default '',
  p_sports_category text default '',
  p_sports text[] default array[]::text[],
  p_gender text default '',
  p_dominant_hand text default 'Não informado',
  p_shirt_size text default 'Não informado',
  p_whatsapp text default '',
  p_telegram text default '',
  p_instagram text default '',
  p_show_contacts boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_sports text[] := array[]::text[];
  profile_json jsonb;
begin
  select coalesce(array_agg(entry.sport order by entry.first_position), array[]::text[])
  into normalized_sports
  from (
    select sport, min(position) as first_position
    from unnest(coalesce(p_sports, array[]::text[])) with ordinality as selected(sport, position)
    where sport = any(array['Beach Tennis', 'Vôlei', 'Futevôlei', 'Tênis', 'Pickleball']::text[])
    group by sport
  ) entry;

  if cardinality(normalized_sports) < 1 then
    raise exception 'Escolha pelo menos uma modalidade esportiva.' using errcode = '22023';
  end if;

  profile_json := public.upsert_my_member_profile_v3(
    p_display_name => p_display_name,
    p_handle => p_handle,
    p_photo_url => p_photo_url,
    p_cover_url => p_cover_url,
    p_bio => p_bio,
    p_city => p_city,
    p_state => p_state,
    p_sports_category => p_sports_category,
    p_gender => p_gender,
    p_dominant_hand => p_dominant_hand,
    p_shirt_size => p_shirt_size,
    p_whatsapp => p_whatsapp,
    p_telegram => p_telegram,
    p_instagram => p_instagram,
    p_show_contacts => p_show_contacts
  );

  update public.member_profiles
  set sports = normalized_sports
  where user_id = auth.uid();

  return profile_json || jsonb_build_object('sports', to_jsonb(normalized_sports));
end;
$$;

revoke all on function public.upsert_my_member_profile_v4(
  text, text, text, text, text, text, text, text, text[], text, text, text,
  text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.upsert_my_member_profile_v4(
  text, text, text, text, text, text, text, text, text[], text, text, text,
  text, text, text, boolean
) to authenticated;

create or replace function public.get_public_member_profile(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  member_row public.member_profiles%rowtype;
  gallery_json jsonb := '[]'::jsonb;
begin
  select member.* into member_row
  from public.member_profiles member
  where member.is_public = true
    and (
      lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, '')))
      or member.user_id::text = btrim(coalesce(p_identifier, ''))
    )
  order by case when lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, ''))) then 0 else 1 end
  limit 1;

  if member_row.user_id is null then return null; end if;

  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  into gallery_json
  from public.member_profile_photos photo
  where photo.user_id = member_row.user_id;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', member_row.user_id,
      'handle', member_row.handle,
      'display_name', member_row.display_name,
      'photo_url', member_row.photo_url,
      'cover_url', member_row.cover_url,
      'bio', member_row.bio,
      'city', member_row.city,
      'state', member_row.state,
      'sports_category', member_row.sports_category,
      'sports', member_row.sports,
      'gender', member_row.gender,
      'dominant_hand', member_row.dominant_hand,
      'shirt_size', member_row.shirt_size,
      'whatsapp', '',
      'telegram', '',
      'instagram', '',
      'show_contacts', false,
      'is_public', true,
      'gallery_photos', gallery_json
    ),
    'organization', null
  );
end;
$$;

revoke all on function public.get_public_member_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_member_profile(text) to anon, authenticated;

commit;
