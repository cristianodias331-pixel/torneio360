-- Keep the athlete and organization galleries aligned with the V2 product limit.
alter table public.member_profile_photos
  drop constraint if exists member_profile_photos_position_check;
alter table public.member_profile_photos
  add constraint member_profile_photos_position_check check (position between 1 and 10);

alter table public.organization_profile_photos
  drop constraint if exists organization_profile_photos_position_check;
alter table public.organization_profile_photos
  add constraint organization_profile_photos_position_check check (position between 1 and 10);

create or replace function public.replace_my_member_profile_photos(
  p_photo_urls text[] default array[]::text[]
)
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
  if photo_count > 10 then
    raise exception 'O perfil aceita no máximo 10 fotos.' using errcode = '22023';
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
  if photo_count > 10 then
    raise exception 'A organização aceita no máximo 10 fotos.' using errcode = '22023';
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

revoke all on function public.replace_my_organization_profile_photos(text[]) from public, anon, authenticated;
grant execute on function public.replace_my_organization_profile_photos(text[]) to authenticated;
