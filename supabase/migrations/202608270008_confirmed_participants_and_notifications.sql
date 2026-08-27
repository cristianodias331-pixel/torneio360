begin;

alter table public.tournament_registrations
  add column if not exists paired_into_registration_id uuid
  references public.tournament_registrations(id) on delete set null;

create index if not exists tournament_registrations_paired_into_idx
  on public.tournament_registrations(paired_into_registration_id)
  where paired_into_registration_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournament_registrations_not_paired_to_self'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_not_paired_to_self
      check (paired_into_registration_id is null or paired_into_registration_id <> id);
  end if;
end;
$$;

create or replace function public.get_public_tournament_athlete_identities(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with identities as (
    select
      registration.athlete_user_id as user_id,
      member.handle,
      coalesce(nullif(member.display_name, ''), registration.athlete_name) as display_name,
      member.photo_url,
      registration.category,
      registration.id as registration_id,
      registration.created_at as registered_at,
      'athlete'::text as registration_role
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    where registration.tournament_id = p_tournament_id
      and registration.workflow_status = 'approved'
      and registration.paired_into_registration_id is null
      and (tournament.is_public = true or tournament.user_id = auth.uid())
    union all
    select
      registration.partner_user_id,
      partner.handle,
      coalesce(nullif(partner.display_name, ''), registration.partner_name),
      partner.photo_url,
      registration.category,
      registration.id,
      registration.created_at,
      'partner'::text
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    join public.member_profiles partner on partner.user_id = registration.partner_user_id
    where registration.tournament_id = p_tournament_id
      and registration.workflow_status = 'approved'
      and registration.paired_into_registration_id is null
      and registration.partner_status = 'accepted'
      and (tournament.is_public = true or tournament.user_id = auth.uid())
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', identity.user_id,
    'handle', identity.handle,
    'display_name', identity.display_name,
    'photo_url', identity.photo_url,
    'category', identity.category,
    'registration_id', identity.registration_id,
    'registered_at', identity.registered_at,
    'registration_role', identity.registration_role
  ) order by identity.registered_at, identity.registration_id, identity.registration_role), '[]'::jsonb)
  from identities identity;
$$;

revoke all on function public.get_public_tournament_athlete_identities(uuid) from public;
grant execute on function public.get_public_tournament_athlete_identities(uuid) to anon, authenticated;

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
      or first_row.tournament_id <> second_row.tournament_id
      or coalesce(lower(first_row.category), '') <> coalesce(lower(second_row.category), '') then
      raise exception 'Os atletas de cada dupla devem estar no mesmo torneio e categoria.' using errcode = '22023';
    end if;
    select * into tournament_row from public.tournaments tournament where tournament.id = first_row.tournament_id;
    if tournament_row.user_id <> auth.uid() then
      raise exception 'Somente a organização responsável pode formar a dupla.' using errcode = '42501';
    end if;
    if first_row.workflow_status <> 'approved' or second_row.workflow_status <> 'approved'
      or first_row.partner_user_id is not null or second_row.partner_user_id is not null
      or first_row.paired_into_registration_id is not null or second_row.paired_into_registration_id is not null then
      raise exception 'Selecione apenas inscrições aprovadas que ainda estejam sem dupla.' using errcode = '22023';
    end if;

    select * into first_member from public.member_profiles member where member.user_id = first_row.athlete_user_id;
    select * into second_member from public.member_profiles member where member.user_id = second_row.athlete_user_id;

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

    insert into public.platform_notifications (
      target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id
    ) values
    (
      first_row.athlete_user_id, auth.uid(), 'partner_accepted', 'Dupla formada pela organização',
      'A organização uniu você a @' || coalesce(nullif(second_member.handle, ''), second_row.athlete_name) || ' em ' || tournament_row.name || '.',
      tournament_row.id, first_row.id
    ),
    (
      second_row.athlete_user_id, auth.uid(), 'partner_accepted', 'Dupla formada pela organização',
      'A organização uniu você a @' || coalesce(nullif(first_member.handle, ''), first_row.athlete_name) || ' em ' || tournament_row.name || '.',
      tournament_row.id, second_row.id
    );

    paired_count := paired_count + 1;
    pair_index := pair_index + 2;
  end loop;

  return jsonb_build_object('paired_count', paired_count);
end;
$$;

revoke all on function public.pair_approved_tournament_registrations(uuid[]) from public, anon, authenticated;
grant execute on function public.pair_approved_tournament_registrations(uuid[]) to authenticated;

commit;
