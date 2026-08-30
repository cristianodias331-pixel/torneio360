-- Trata rótulos equivalentes de nível técnico sem relaxar as regras de
-- categoria esportiva masculina, feminina ou mista do torneio.
begin;

create or replace function public.t360_pairing_category_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when normalized.value in ('iniciante', 'principiante', 'beginner', 'novato', 'novata') then 'iniciante'
    else normalized.value
  end
  from (
    select regexp_replace(lower(btrim(coalesce(p_value, ''))), '\s+', ' ', 'g') as value
  ) normalized;
$$;

create or replace function public.pair_approved_tournament_registrations(p_registration_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pair_index integer := 1;
  selected_count integer := coalesce(array_length(p_registration_ids, 1), 0);
  unique_count integer := 0;
  paired_count integer := 0;
  first_row public.tournament_registrations%rowtype;
  second_row public.tournament_registrations%rowtype;
  first_member public.member_profiles%rowtype;
  second_member public.member_profiles%rowtype;
  tournament_row public.tournaments%rowtype;
  gender_mode text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if selected_count < 2 or selected_count > 32 or mod(selected_count, 2) <> 0 then
    raise exception 'Selecione uma quantidade par de atletas, entre 2 e 32.' using errcode = '22023';
  end if;

  select count(distinct registration_id)::integer into unique_count
  from unnest(p_registration_ids) registration_id;
  if unique_count <> selected_count then
    raise exception 'Um atleta foi selecionado mais de uma vez.' using errcode = '22023';
  end if;

  while pair_index <= selected_count loop
    select * into first_row
    from public.tournament_registrations registration
    where registration.id = p_registration_ids[pair_index]
    for update;

    select * into second_row
    from public.tournament_registrations registration
    where registration.id = p_registration_ids[pair_index + 1]
    for update;

    if first_row.id is null or second_row.id is null
      or first_row.athlete_user_id = second_row.athlete_user_id
      or first_row.tournament_id <> second_row.tournament_id
      or public.t360_pairing_category_key(first_row.category) <> public.t360_pairing_category_key(second_row.category) then
      raise exception 'Os atletas da dupla devem ser pessoas diferentes, do mesmo torneio e com nível técnico compatível.' using errcode = '22023';
    end if;

    select * into tournament_row
    from public.tournaments tournament
    where tournament.id = first_row.tournament_id;
    if tournament_row.user_id <> auth.uid() then
      raise exception 'Somente a organização responsável pode formar a dupla.' using errcode = '42501';
    end if;

    if first_row.workflow_status <> 'approved' or second_row.workflow_status <> 'approved'
      or first_row.partner_user_id is not null or second_row.partner_user_id is not null
      or first_row.paired_into_registration_id is not null or second_row.paired_into_registration_id is not null then
      raise exception 'Selecione apenas inscrições aprovadas que ainda estejam sem dupla.' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.athlete_partner_searches partner_search
      where partner_search.tournament_id = first_row.tournament_id
        and partner_search.athlete_user_id = first_row.athlete_user_id
        and partner_search.active = true
    ) or not exists (
      select 1 from public.athlete_partner_searches partner_search
      where partner_search.tournament_id = second_row.tournament_id
        and partner_search.athlete_user_id = second_row.athlete_user_id
        and partner_search.active = true
    ) then
      raise exception 'Selecione dois atletas que estejam procurando dupla neste torneio.' using errcode = '22023';
    end if;

    select * into first_member from public.member_profiles member where member.user_id = first_row.athlete_user_id;
    select * into second_member from public.member_profiles member where member.user_id = second_row.athlete_user_id;
    if first_member.gender not in ('Masculino', 'Feminino') or second_member.gender not in ('Masculino', 'Feminino') then
      raise exception 'Os dois atletas precisam selecionar a categoria esportiva no perfil antes de formar a dupla.' using errcode = '22023';
    end if;

    gender_mode := lower(btrim(coalesce(
      tournament_row.data ->> 'participantGenderMode',
      tournament_row.data ->> 'genderMode',
      tournament_row.data ->> 'gender',
      ''
    )));
    if gender_mode in ('mista', 'misto', 'mixed') and first_member.gender = second_member.gender then
      raise exception 'Em torneio misto, selecione atletas de categorias esportivas diferentes.' using errcode = '22023';
    end if;
    if gender_mode in ('masculino', 'homem', 'homens', 'male', 'masculine')
      and (first_member.gender <> 'Masculino' or second_member.gender <> 'Masculino') then
      raise exception 'Este torneio aceita somente uma dupla masculina.' using errcode = '22023';
    end if;
    if gender_mode in ('feminino', 'mulher', 'mulheres', 'female', 'feminine')
      and (first_member.gender <> 'Feminino' or second_member.gender <> 'Feminino') then
      raise exception 'Este torneio aceita somente uma dupla feminina.' using errcode = '22023';
    end if;

    update public.tournament_registrations
    set partner_user_id = second_row.athlete_user_id,
        partner_name = coalesce(nullif(second_member.display_name, ''), second_row.athlete_name),
        partner_handle = coalesce(second_member.handle, ''),
        partner_status = 'accepted',
        updated_at = now()
    where id = first_row.id;

    update public.tournament_registrations
    set partner_user_id = first_row.athlete_user_id,
        partner_name = coalesce(nullif(first_member.display_name, ''), first_row.athlete_name),
        partner_handle = coalesce(first_member.handle, ''),
        partner_status = 'accepted',
        paired_into_registration_id = first_row.id,
        updated_at = now()
    where id = second_row.id;

    update public.athlete_partner_searches
    set active = false, updated_at = now()
    where tournament_id = first_row.tournament_id
      and athlete_user_id in (first_row.athlete_user_id, second_row.athlete_user_id);

    paired_count := paired_count + 1;
    pair_index := pair_index + 2;
  end loop;

  return jsonb_build_object('paired_count', paired_count);
end;
$$;

revoke all on function public.t360_pairing_category_key(text) from public, anon, authenticated;
revoke all on function public.pair_approved_tournament_registrations(uuid[]) from public, anon, authenticated;
grant execute on function public.pair_approved_tournament_registrations(uuid[]) to authenticated;

commit;
