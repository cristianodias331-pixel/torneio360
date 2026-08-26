begin;

create index if not exists member_profiles_public_directory_idx
on public.member_profiles (lower(display_name), user_id)
where is_public = true;

create index if not exists member_profiles_public_handle_directory_idx
on public.member_profiles (lower(handle), user_id)
where is_public = true and handle is not null;

create table if not exists public.organization_profile_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.profiles(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  photo_url text not null check (char_length(photo_url) between 1 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, position)
);

create index if not exists organization_profile_photos_position_idx
on public.organization_profile_photos (organization_id, position);

alter table public.organization_profile_photos enable row level security;
revoke insert, update, delete on public.organization_profile_photos from public, anon, authenticated;
grant select on public.organization_profile_photos to anon, authenticated;

drop policy if exists organization_profile_photos_public_read on public.organization_profile_photos;
create policy organization_profile_photos_public_read
on public.organization_profile_photos for select
to anon, authenticated
using (exists (
  select 1
  from public.profiles organization
  where organization.id = organization_profile_photos.organization_id
    and organization.is_public = true
));

create or replace function public.list_public_member_profiles(
  p_search text default null,
  p_limit integer default 24,
  p_after_sort_name text default null,
  p_after_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  normalized_search text := lower(btrim(coalesce(p_search, '')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 24), 48));
  result_items jsonb := '[]'::jsonb;
  result_count integer := 0;
  result_has_more boolean := false;
  next_sort_name text;
  next_user_id uuid;
begin
  with candidates as (
    select
      member.user_id,
      member.handle,
      member.display_name,
      member.photo_url,
      member.bio,
      member.city,
      member.state,
      lower(member.display_name) as sort_name,
      (
        select count(*)::integer
        from public.member_profile_photos photo
        where photo.user_id = member.user_id
      ) as gallery_count,
      exists (
        select 1
        from public.profiles organization
        join auth.users organization_account on organization_account.id = organization.id
        where organization.id = member.user_id
          and organization_account.email_confirmed_at is not null
          and lower(coalesce(organization_account.raw_app_meta_data ->> 'role', 'organizer'))
            not in ('athlete', 'visitor', 'spectator')
      ) as has_organization
    from public.member_profiles member
    join auth.users account on account.id = member.user_id
    where member.is_public = true
      and account.email_confirmed_at is not null
      and (
        normalized_search = ''
        or lower(member.display_name) like normalized_search || '%'
        or lower(coalesce(member.handle, '')) like normalized_search || '%'
        or lower(coalesce(member.city, '')) like normalized_search || '%'
        or lower(coalesce(member.state, '')) like normalized_search || '%'
      )
      and (
        p_after_sort_name is null
        or p_after_user_id is null
        or (lower(member.display_name), member.user_id) > (lower(p_after_sort_name), p_after_user_id)
      )
    order by lower(member.display_name), member.user_id
    limit safe_limit + 1
  ), visible as (
    select * from candidates limit safe_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', visible.user_id,
      'handle', visible.handle,
      'display_name', visible.display_name,
      'photo_url', visible.photo_url,
      'bio', visible.bio,
      'city', visible.city,
      'state', visible.state,
      'gallery_count', visible.gallery_count,
      'has_organization', visible.has_organization,
      'sort_name', visible.sort_name
    ) order by visible.sort_name, visible.user_id), '[]'::jsonb),
    count(*)::integer,
    (select count(*) > safe_limit from candidates)
  into result_items, result_count, result_has_more
  from visible;

  if result_count > 0 then
    select
      item ->> 'sort_name',
      (item ->> 'user_id')::uuid
    into next_sort_name, next_user_id
    from jsonb_array_elements(result_items) with ordinality as entry(item, position)
    order by position desc
    limit 1;
  end if;

  return jsonb_build_object(
    'items', result_items,
    'has_more', result_has_more,
    'next_cursor', case
      when next_user_id is null then null
      else jsonb_build_object('sort_name', next_sort_name, 'user_id', next_user_id)
    end
  );
end;
$$;

revoke all on function public.list_public_member_profiles(text, integer, text, uuid)
from public, anon, authenticated;
grant execute on function public.list_public_member_profiles(text, integer, text, uuid)
to anon, authenticated;

create or replace function public.get_my_organization_profile_photos()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(photo.photo_url order by photo.position)
    from public.organization_profile_photos photo
    where photo.organization_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.replace_my_organization_profile_photos(
  p_photo_urls text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  photo_count integer := coalesce(cardinality(p_photo_urls), 0);
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if public.current_account_role() not in ('organizer', 'organizer_pending') then
    raise exception 'Apenas uma organização pode alterar esta galeria.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles profile where profile.id = auth.uid()) then
    raise exception 'Organização não encontrada.' using errcode = 'P0002';
  end if;
  if photo_count > 6 then
    raise exception 'A organização aceita no máximo 6 fotos.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_photo_urls, array[]::text[])) photo_url
    where btrim(coalesce(photo_url, '')) = ''
      or char_length(btrim(photo_url)) > 2048
      or btrim(photo_url) !~* '^https?://'
  ) then
    raise exception 'A galeria contém uma imagem inválida.' using errcode = '22023';
  end if;

  delete from public.organization_profile_photos where organization_id = auth.uid();
  insert into public.organization_profile_photos (organization_id, position, photo_url)
  select auth.uid(), entry.ordinality::smallint, btrim(entry.photo_url)
  from unnest(coalesce(p_photo_urls, array[]::text[])) with ordinality
    as entry(photo_url, ordinality)
  order by entry.ordinality;

  return coalesce((
    select jsonb_agg(photo.photo_url order by photo.position)
    from public.organization_profile_photos photo
    where photo.organization_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_public_organization_profile_photos(p_organization_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  from public.organization_profile_photos photo
  join public.profiles organization on organization.id = photo.organization_id
  where photo.organization_id = p_organization_id
    and organization.is_public = true;
$$;

revoke all on function public.get_my_organization_profile_photos() from public, anon, authenticated;
revoke all on function public.replace_my_organization_profile_photos(text[]) from public, anon, authenticated;
revoke all on function public.get_public_organization_profile_photos(uuid) from public, anon, authenticated;
grant execute on function public.get_my_organization_profile_photos() to authenticated;
grant execute on function public.replace_my_organization_profile_photos(text[]) to authenticated;
grant execute on function public.get_public_organization_profile_photos(uuid) to anon, authenticated;

create index if not exists tournaments_public_feed_idx
on public.tournaments (updated_at desc, id desc)
where is_public = true and public_id is not null;

create or replace function public.list_public_tournament_feed(
  p_limit integer default 12,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 30));
  result_items jsonb := '[]'::jsonb;
  result_has_more boolean := false;
  next_updated_at timestamptz;
  next_id uuid;
begin
  with candidates as (
    select
      tournament.id,
      tournament.name,
      tournament.type,
      tournament.public_id,
      tournament.status,
      tournament.created_at,
      coalesce(tournament.updated_at, tournament.created_at) as feed_updated_at,
      public.t360_public_tournament_summary_data(tournament.data) as data,
      organization.id as organization_id,
      coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização') as organization_name,
      case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end as organization_photo_url,
      organization.phone as organization_phone,
      organization.city as organization_city,
      organization.state as organization_state
    from public.tournaments tournament
    join public.profiles organization on organization.id = tournament.user_id
    join auth.users account on account.id = tournament.user_id
    where tournament.is_public = true
      and tournament.public_id is not null
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
      and organization.is_public = true
      and account.email_confirmed_at is not null
      and (
        p_before_updated_at is null
        or p_before_id is null
        or (coalesce(tournament.updated_at, tournament.created_at), tournament.id)
          < (p_before_updated_at, p_before_id)
      )
    order by coalesce(tournament.updated_at, tournament.created_at) desc, tournament.id desc
    limit safe_limit + 1
  ), visible as (
    select * from candidates limit safe_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', visible.id,
      'name', visible.name,
      'type', visible.type,
      'public_id', visible.public_id,
      'status', visible.status,
      'created_at', visible.created_at,
      'updated_at', visible.feed_updated_at,
      'data', visible.data,
      'organization', jsonb_build_object(
        'id', visible.organization_id,
        'name', visible.organization_name,
        'photo_url', visible.organization_photo_url,
        'phone', visible.organization_phone,
        'city', visible.organization_city,
        'state', visible.organization_state
      )
    ) order by visible.feed_updated_at desc, visible.id desc), '[]'::jsonb),
    (select count(*) > safe_limit from candidates)
  into result_items, result_has_more
  from visible;

  if jsonb_array_length(result_items) > 0 then
    select
      (item ->> 'updated_at')::timestamptz,
      (item ->> 'id')::uuid
    into next_updated_at, next_id
    from jsonb_array_elements(result_items) with ordinality as entry(item, position)
    order by position desc
    limit 1;
  end if;

  return jsonb_build_object(
    'items', result_items,
    'has_more', result_has_more,
    'next_cursor', case
      when next_id is null then null
      else jsonb_build_object('updated_at', next_updated_at, 'id', next_id)
    end
  );
end;
$$;

revoke all on function public.list_public_tournament_feed(integer, timestamptz, uuid)
from public, anon, authenticated;
grant execute on function public.list_public_tournament_feed(integer, timestamptz, uuid)
to anon, authenticated;

commit;
