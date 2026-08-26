begin;

-- O perfil esportivo é público por definição. Dados de autenticação, assinatura,
-- documentos e contatos privados não pertencem a esta tabela nem aos RPCs públicos.
update public.member_profiles
set is_public = true
where is_public is distinct from true;

alter table public.member_profiles
  alter column is_public set default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_always_public_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_always_public_check check (is_public = true);
  end if;
end;
$$;

update public.athlete_profiles
set is_public = true
where is_public is distinct from true;

alter table public.athlete_profiles
  alter column is_public set default true;

create table if not exists public.member_profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  photo_url text not null check (char_length(photo_url) between 1 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, position)
);

create index if not exists member_profile_photos_user_position_idx
on public.member_profile_photos (user_id, position);

alter table public.member_profile_photos enable row level security;
revoke insert, update, delete on public.member_profile_photos from public, anon, authenticated;
grant select on public.member_profile_photos to anon, authenticated;

drop policy if exists member_profile_photos_public_read on public.member_profile_photos;
create policy member_profile_photos_public_read
on public.member_profile_photos for select
to anon, authenticated
using (true);

create or replace function private.touch_member_profile_photo_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_profile_photos_touch_updated_at on public.member_profile_photos;
create trigger member_profile_photos_touch_updated_at
before update on public.member_profile_photos
for each row execute function private.touch_member_profile_photo_updated_at();

create or replace function public.get_my_member_profile()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  member_row public.member_profiles%rowtype;
  gallery_json jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  member_row := private.provision_member_profile(auth.uid());

  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  into gallery_json
  from public.member_profile_photos photo
  where photo.user_id = auth.uid();

  return to_jsonb(member_row)
    || jsonb_build_object('gallery_photos', gallery_json, 'is_public', true);
end;
$$;

revoke all on function public.get_my_member_profile() from public, anon, authenticated;
grant execute on function public.get_my_member_profile() to authenticated;

create or replace function public.upsert_my_member_profile(
  p_display_name text,
  p_handle text default null,
  p_photo_url text default '',
  p_cover_url text default '',
  p_bio text default '',
  p_city text default '',
  p_state text default '',
  p_is_public boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_name text := btrim(coalesce(p_display_name, ''));
  normalized_handle text := nullif(lower(btrim(coalesce(p_handle, ''))), '');
  member_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 80 then
    raise exception 'O nome deve ter entre 2 e 80 caracteres.' using errcode = '22023';
  end if;
  if normalized_handle is not null and normalized_handle !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Nome de usuário inválido.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_bio, '')) > 240 then
    raise exception 'A apresentação deve ter até 240 caracteres.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_city, '')) > 80 or char_length(coalesce(p_state, '')) > 80 then
    raise exception 'Cidade e estado devem ter até 80 caracteres.' using errcode = '22023';
  end if;

  perform private.provision_member_profile(auth.uid());

  update public.member_profiles
  set
    display_name = normalized_name,
    handle = normalized_handle,
    photo_url = btrim(coalesce(p_photo_url, '')),
    cover_url = btrim(coalesce(p_cover_url, '')),
    bio = btrim(coalesce(p_bio, '')),
    city = btrim(coalesce(p_city, '')),
    state = btrim(coalesce(p_state, '')),
    is_public = true
  where user_id = auth.uid()
  returning * into member_row;

  if to_regclass('public.athlete_profiles') is not null
    and public.current_account_role() = 'athlete' then
    insert into public.athlete_profiles (
      user_id,
      display_name,
      photo_url,
      bio,
      is_public,
      show_achievements
    ) values (
      auth.uid(),
      member_row.display_name,
      member_row.photo_url,
      member_row.bio,
      true,
      true
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      photo_url = excluded.photo_url,
      bio = excluded.bio,
      is_public = true,
      updated_at = now();
  end if;

  return to_jsonb(member_row) || jsonb_build_object('is_public', true);
exception
  when unique_violation then
    raise exception 'Este nome de usuário já está em uso.' using errcode = '23505';
end;
$$;

revoke all on function public.upsert_my_member_profile(text, text, text, text, text, text, text, boolean)
from public, anon, authenticated;
grant execute on function public.upsert_my_member_profile(text, text, text, text, text, text, text, boolean)
to authenticated;

create or replace function public.replace_my_member_profile_photos(p_photo_urls text[] default array[]::text[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  photo_count integer := coalesce(cardinality(p_photo_urls), 0);
  gallery_json jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if photo_count > 6 then
    raise exception 'O perfil aceita no máximo 6 fotos.' using errcode = '22023';
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

  perform private.provision_member_profile(auth.uid());
  delete from public.member_profile_photos where user_id = auth.uid();

  insert into public.member_profile_photos (user_id, position, photo_url)
  select auth.uid(), entry.ordinality::smallint, btrim(entry.photo_url)
  from unnest(coalesce(p_photo_urls, array[]::text[])) with ordinality
    as entry(photo_url, ordinality)
  order by entry.ordinality;

  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  into gallery_json
  from public.member_profile_photos photo
  where photo.user_id = auth.uid();

  return gallery_json;
end;
$$;

revoke all on function public.replace_my_member_profile_photos(text[]) from public, anon, authenticated;
grant execute on function public.replace_my_member_profile_photos(text[]) to authenticated;

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
  organization_json jsonb;
begin
  select member.*
  into member_row
  from public.member_profiles member
  where lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, '')))
     or member.user_id::text = btrim(coalesce(p_identifier, ''))
  order by case when lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, ''))) then 0 else 1 end
  limit 1;

  if member_row.user_id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  into gallery_json
  from public.member_profile_photos photo
  where photo.user_id = member_row.user_id;

  select jsonb_build_object(
    'id', organization.id,
    'name', coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização'),
    'city', organization.city,
    'state', organization.state,
    'photo_url', case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end
  )
  into organization_json
  from public.profiles organization
  join auth.users account on account.id = organization.id
  where organization.id = member_row.user_id
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in ('athlete', 'visitor', 'spectator')
  limit 1;

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
      'is_public', true,
      'gallery_photos', gallery_json
    ),
    'organization', organization_json
  );
end;
$$;

revoke all on function public.get_public_member_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_member_profile(text) to anon, authenticated;

commit;
