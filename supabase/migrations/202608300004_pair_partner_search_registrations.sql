-- Ativa, de forma isolada, a formação de duplas entre inscrições aprovadas
-- que já estão procurando parceria no banco de homologação.
begin;

alter table public.tournament_registrations
  add column if not exists partner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists partner_handle text not null default '',
  add column if not exists partner_status text not null default 'none',
  add column if not exists paired_into_registration_id uuid references public.tournament_registrations(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_partner_status_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_partner_status_check
      check (partner_status in ('none', 'pending', 'accepted', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_pair_not_self_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_pair_not_self_check
      check (paired_into_registration_id is null or paired_into_registration_id <> id);
  end if;
end;
$$;

create index if not exists tournament_registrations_partner_user_idx
on public.tournament_registrations (partner_user_id, partner_status, updated_at desc)
where partner_user_id is not null;

create index if not exists tournament_registrations_paired_into_idx
on public.tournament_registrations (paired_into_registration_id)
where paired_into_registration_id is not null;

-- Perfis antigos podem já ter esta informação nos metadados da conta.
update public.member_profiles member
set gender = case
  when lower(btrim(coalesce(account.raw_user_meta_data ->> 'gender', account.raw_user_meta_data ->> 'sex', ''))) = 'masculino' then 'Masculino'
  when lower(btrim(coalesce(account.raw_user_meta_data ->> 'gender', account.raw_user_meta_data ->> 'sex', ''))) = 'feminino' then 'Feminino'
  else member.gender
end
from auth.users account
where account.id = member.user_id
  and member.gender = ''
  and lower(btrim(coalesce(account.raw_user_meta_data ->> 'gender', account.raw_user_meta_data ->> 'sex', ''))) in ('masculino', 'feminino');

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
      or lower(btrim(coalesce(first_row.category, ''))) <> lower(btrim(coalesce(second_row.category, ''))) then
      raise exception 'Os atletas da dupla devem ser pessoas diferentes, do mesmo torneio e da mesma categoria.' using errcode = '22023';
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

create or replace function public.get_my_organization_registrations_v2()
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
    select jsonb_agg(jsonb_build_object(
      'id', registration.id,
      'athlete_user_id', registration.athlete_user_id,
      'athlete_name', registration.athlete_name,
      'partner_user_id', registration.partner_user_id,
      'partner_name', registration.partner_name,
      'partner_handle', registration.partner_handle,
      'partner_status', registration.partner_status,
      'paired_into_registration_id', registration.paired_into_registration_id,
      'category', registration.category,
      'registration_status', registration.status,
      'workflow_status', registration.workflow_status,
      'payment_status', registration.payment_status,
      'payment_method', registration.payment_method,
      'payment_proof_path', registration.payment_proof_path,
      'payment_proof_name', registration.payment_proof_name,
      'payment_proof_mime', registration.payment_proof_mime,
      'payment_proof_size', registration.payment_proof_size,
      'payment_submitted_at', registration.payment_submitted_at,
      'payment_reviewed_at', registration.payment_reviewed_at,
      'payment_rejection_reason', registration.payment_rejection_reason,
      'looking_for_partner', exists (
        select 1 from public.athlete_partner_searches partner_search
        where partner_search.tournament_id = registration.tournament_id
          and partner_search.athlete_user_id = registration.athlete_user_id
          and partner_search.active = true
      ),
      'created_at', registration.created_at,
      'athlete', case when member.user_id is null then null else jsonb_build_object(
        'user_id', member.user_id,
        'display_name', member.display_name,
        'handle', member.handle,
        'photo_url', member.photo_url,
        'sports_category', member.sports_category,
        'gender', member.gender,
        'dominant_hand', member.dominant_hand,
        'city', member.city,
        'state', member.state
      ) end,
      'partner', case when partner.user_id is null then null else jsonb_build_object(
        'user_id', partner.user_id,
        'display_name', partner.display_name,
        'handle', partner.handle,
        'photo_url', partner.photo_url,
        'gender', partner.gender
      ) end,
      'partner_registration', case when paired_registration.id is null then null else jsonb_build_object(
        'id', paired_registration.id,
        'payment_method', paired_registration.payment_method,
        'payment_proof_path', paired_registration.payment_proof_path,
        'payment_proof_name', paired_registration.payment_proof_name,
        'payment_proof_mime', paired_registration.payment_proof_mime,
        'payment_proof_size', paired_registration.payment_proof_size
      ) end,
      'tournament', jsonb_build_object(
        'id', tournament.id,
        'public_id', tournament.public_id,
        'name', tournament.name,
        'type', tournament.type,
        'data', tournament.data
      )
    ) order by tournament.created_at desc, registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    left join public.member_profiles partner on partner.user_id = registration.partner_user_id
    left join lateral (
      select paired.*
      from public.tournament_registrations paired
      where paired.paired_into_registration_id = registration.id
        and paired.status <> 'cancelled'
      order by paired.created_at asc
      limit 1
    ) paired_registration on true
    where tournament.user_id = auth.uid()
      and registration.status <> 'cancelled'
      and registration.paired_into_registration_id is null
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.pair_approved_tournament_registrations(uuid[]) from public, anon, authenticated;
revoke all on function public.get_my_organization_registrations_v2() from public, anon, authenticated;
grant execute on function public.pair_approved_tournament_registrations(uuid[]) to authenticated;
grant execute on function public.get_my_organization_registrations_v2() to authenticated;

commit;
