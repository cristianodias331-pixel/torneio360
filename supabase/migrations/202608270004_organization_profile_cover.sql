alter table public.profiles
  add column if not exists cover_url text not null default '';

alter table public.profiles
  drop constraint if exists profiles_cover_url_check;

alter table public.profiles
  add constraint profiles_cover_url_check
    check (
      cover_url = ''
      or (
        char_length(cover_url) <= 2048
        and cover_url ~* '^https?://'
      )
    );

create or replace function public.get_my_organization_profile_cover()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(profile.cover_url, '')
  from public.profiles as profile
  where profile.id = auth.uid();
$$;

create or replace function public.set_my_organization_profile_cover(p_cover_url text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_cover text := btrim(coalesce(p_cover_url, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if normalized_cover <> '' and normalized_cover !~* '^https?://' then
    raise exception 'organization cover must use an http(s) URL';
  end if;

  update public.profiles
  set cover_url = normalized_cover
  where id = auth.uid();

  return normalized_cover;
end;
$$;

revoke all on function public.get_my_organization_profile_cover() from public;
revoke all on function public.set_my_organization_profile_cover(text) from public;
grant execute on function public.get_my_organization_profile_cover() to authenticated;
grant execute on function public.set_my_organization_profile_cover(text) to authenticated;
