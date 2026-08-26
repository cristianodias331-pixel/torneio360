begin;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text not null default '',
  photo_url text not null default '',
  cover_url text not null default '',
  bio text not null default '',
  city text not null default '',
  state text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles
  add column if not exists handle text,
  add column if not exists display_name text not null default '',
  add column if not exists photo_url text not null default '',
  add column if not exists cover_url text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists is_public boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists member_profiles_handle_unique_idx
on public.member_profiles (lower(handle))
where handle is not null and btrim(handle) <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_display_name_length_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_display_name_length_check
      check (char_length(display_name) between 1 and 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_handle_format_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_handle_format_check
      check (handle is null or handle ~ '^[a-z0-9._]{3,30}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_bio_length_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_bio_length_check
      check (char_length(bio) <= 240);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_location_length_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_location_length_check
      check (char_length(city) <= 80 and char_length(state) <= 80);
  end if;
end;
$$;

create or replace function private.provision_member_profile(p_user_id uuid)
returns public.member_profiles
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  member_row public.member_profiles%rowtype;
begin
  insert into public.member_profiles (
    user_id,
    display_name,
    photo_url,
    bio,
    is_public
  )
  select
    account.id,
    left(coalesce(
      nullif(btrim(athlete.display_name), ''),
      nullif(btrim(organizer.name), ''),
      nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(account.email, ''), '@', 1), ''),
      'Participante'
    ), 80),
    coalesce(athlete.photo_url, ''),
    left(coalesce(athlete.bio, ''), 240),
    coalesce(athlete.is_public, true)
  from auth.users account
  left join public.profiles organizer on organizer.id = account.id
  left join public.athlete_profiles athlete on athlete.user_id = account.id
  where account.id = p_user_id
  on conflict (user_id) do nothing;

  select * into member_row
  from public.member_profiles
  where user_id = p_user_id;

  return member_row;
end;
$$;

revoke all on function private.provision_member_profile(uuid) from public, anon, authenticated;

insert into public.member_profiles (user_id, display_name, photo_url, bio, is_public)
select
  account.id,
  left(coalesce(
    nullif(btrim(athlete.display_name), ''),
    nullif(btrim(organizer.name), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(account.email, ''), '@', 1), ''),
    'Participante'
  ), 80),
  coalesce(athlete.photo_url, ''),
  left(coalesce(athlete.bio, ''), 240),
  coalesce(athlete.is_public, true)
from auth.users account
left join public.profiles organizer on organizer.id = account.id
left join public.athlete_profiles athlete on athlete.user_id = account.id
on conflict (user_id) do nothing;

create or replace function private.touch_member_profile_updated_at()
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

drop trigger if exists member_profiles_touch_updated_at on public.member_profiles;
create trigger member_profiles_touch_updated_at
before update on public.member_profiles
for each row execute function private.touch_member_profile_updated_at();

create or replace function private.handle_new_auth_user_member_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.provision_member_profile(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_create_member_profile on auth.users;
create trigger on_auth_user_create_member_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user_member_profile();

alter table public.member_profiles enable row level security;
revoke insert, update, delete on public.member_profiles from public, anon, authenticated;
grant select on public.member_profiles to anon, authenticated;

drop policy if exists member_profiles_public_or_owner_read on public.member_profiles;
create policy member_profiles_public_or_owner_read
on public.member_profiles for select
to anon, authenticated
using (is_public or user_id = auth.uid());

create or replace function public.get_my_member_profile()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  member_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  member_row := private.provision_member_profile(auth.uid());
  return to_jsonb(member_row);
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
    is_public = coalesce(p_is_public, true)
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
      member_row.is_public,
      true
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      photo_url = excluded.photo_url,
      bio = excluded.bio,
      is_public = excluded.is_public,
      updated_at = now();
  end if;

  return to_jsonb(member_row);
exception
  when unique_violation then
    raise exception 'Este nome de usuário já está em uso.' using errcode = '23505';
end;
$$;

revoke all on function public.upsert_my_member_profile(text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.upsert_my_member_profile(text, text, text, text, text, text, text, boolean) to authenticated;

commit;
