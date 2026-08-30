-- Libera a categoria esportiva no perfil pessoal sem aplicar o restante das
-- migrações acumuladas de inscrições. Mantém os valores internos já usados
-- pelas regras esportivas para não exigir regravação dos perfis existentes.
begin;

alter table public.member_profiles
  add column if not exists gender text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_gender_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_gender_check
      check (gender in ('', 'Masculino', 'Feminino'));
  end if;
end;
$$;

create or replace function public.upsert_my_member_profile_v3(
  p_display_name text,
  p_handle text default null,
  p_photo_url text default '',
  p_cover_url text default '',
  p_bio text default '',
  p_city text default '',
  p_state text default '',
  p_sports_category text default '',
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
  normalized_gender text := initcap(lower(btrim(coalesce(p_gender, ''))));
  profile_json jsonb;
begin
  if normalized_gender not in ('Masculino', 'Feminino') then
    raise exception 'Selecione a categoria esportiva do atleta.' using errcode = '22023';
  end if;

  profile_json := public.upsert_my_member_profile_v2(
    p_display_name => p_display_name,
    p_handle => p_handle,
    p_photo_url => p_photo_url,
    p_cover_url => p_cover_url,
    p_bio => p_bio,
    p_city => p_city,
    p_state => p_state,
    p_sports_category => p_sports_category,
    p_dominant_hand => p_dominant_hand,
    p_shirt_size => p_shirt_size,
    p_whatsapp => p_whatsapp,
    p_telegram => p_telegram,
    p_instagram => p_instagram,
    p_show_contacts => p_show_contacts
  );

  update public.member_profiles
  set gender = normalized_gender
  where user_id = auth.uid();

  return profile_json || jsonb_build_object('gender', normalized_gender);
end;
$$;

revoke all on function public.upsert_my_member_profile_v3(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.upsert_my_member_profile_v3(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, boolean
) to authenticated;

commit;
