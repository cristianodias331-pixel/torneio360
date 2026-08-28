begin;

alter table public.athlete_achievements
  add column if not exists tournament_public_id text,
  add column if not exists tournament_name text,
  add column if not exists tournament_type text,
  add column if not exists organization_name text,
  add column if not exists organization_photo_url text,
  add column if not exists history_locked_at timestamptz;

update public.athlete_achievements achievement
set tournament_public_id = coalesce(achievement.tournament_public_id, tournament.public_id::text),
    tournament_name = coalesce(nullif(achievement.tournament_name, ''), tournament.name, 'Torneio'),
    tournament_type = coalesce(nullif(achievement.tournament_type, ''), tournament.type, ''),
    organization_name = coalesce(
      nullif(achievement.organization_name, ''),
      nullif(btrim(organization.arena_name), ''),
      nullif(btrim(organization.name), ''),
      'Organização'
    ),
    organization_photo_url = coalesce(achievement.organization_photo_url, organization.photo_url, ''),
    history_locked_at = coalesce(achievement.history_locked_at, achievement.approved_at + interval '24 hours')
from public.tournaments tournament
left join public.profiles organization on organization.id = tournament.user_id
where tournament.id = achievement.tournament_id;

update public.athlete_achievements
set tournament_name = coalesce(nullif(tournament_name, ''), 'Torneio'),
    tournament_type = coalesce(tournament_type, ''),
    organization_name = coalesce(nullif(organization_name, ''), 'Organização'),
    organization_photo_url = coalesce(organization_photo_url, ''),
    history_locked_at = coalesce(history_locked_at, approved_at + interval '24 hours');

alter table public.athlete_achievements
  alter column tournament_name set default 'Torneio',
  alter column tournament_name set not null,
  alter column tournament_type set default '',
  alter column tournament_type set not null,
  alter column organization_name set default 'Organização',
  alter column organization_name set not null,
  alter column organization_photo_url set default '',
  alter column organization_photo_url set not null,
  alter column history_locked_at set default (now() + interval '24 hours'),
  alter column history_locked_at set not null;

alter table public.athlete_achievements
  drop constraint if exists athlete_achievements_tournament_id_fkey,
  alter column tournament_id drop not null,
  add constraint athlete_achievements_tournament_id_fkey
    foreign key (tournament_id) references public.tournaments(id) on delete set null;

alter table public.athlete_achievements
  drop constraint if exists athlete_achievements_approved_by_organization_user_id_fkey,
  alter column approved_by_organization_user_id drop not null,
  add constraint athlete_achievements_approved_by_organization_user_id_fkey
    foreign key (approved_by_organization_user_id) references auth.users(id) on delete set null;

create or replace function public.approve_tournament_podium(
  p_tournament_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  tournament_row public.tournaments%rowtype;
  entry jsonb;
  athlete_id uuid;
  partner_id uuid;
  placement_value integer;
  bracket_value text;
  category_value text;
  event_date_value date;
  organization_name_value text;
  organization_photo_value text;
  approved_count integer := 0;
  affected_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'Informe o pódio oficial.' using errcode = '22023';
  end if;

  select * into tournament_row
  from public.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.user_id = auth.uid()
  for update;

  if tournament_row.id is null then
    raise exception 'Somente a organização responsável pode registrar estas conquistas.' using errcode = '42501';
  end if;

  select
    coalesce(nullif(btrim(profile.arena_name), ''), nullif(btrim(profile.name), ''), 'Organização'),
    coalesce(profile.photo_url, '')
  into organization_name_value, organization_photo_value
  from public.profiles profile
  where profile.id = auth.uid();

  organization_name_value := coalesce(organization_name_value, 'Organização');
  organization_photo_value := coalesce(organization_photo_value, '');

  delete from public.athlete_achievements existing
  where existing.tournament_id = p_tournament_id
    and existing.history_locked_at > now()
    and exists (
      select 1
      from jsonb_array_elements(p_entries) candidate(value)
      where left(coalesce(nullif(btrim(candidate.value ->> 'bracket_name'), ''), 'Principal'), 80) = existing.bracket_name
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_entries) candidate(value)
      where nullif(candidate.value ->> 'athlete_user_id', '')::uuid = existing.athlete_user_id
        and left(coalesce(nullif(btrim(candidate.value ->> 'bracket_name'), ''), 'Principal'), 80) = existing.bracket_name
    );

  for entry in select value from jsonb_array_elements(p_entries)
  loop
    athlete_id := nullif(entry ->> 'athlete_user_id', '')::uuid;
    partner_id := nullif(entry ->> 'partner_user_id', '')::uuid;
    placement_value := (entry ->> 'placement')::integer;
    bracket_value := left(coalesce(nullif(btrim(entry ->> 'bracket_name'), ''), 'Principal'), 80);
    category_value := left(coalesce(btrim(entry ->> 'category'), ''), 80);
    begin
      event_date_value := nullif(entry ->> 'event_date', '')::date;
    exception when invalid_datetime_format then
      event_date_value := null;
    end;

    if athlete_id is null or placement_value not between 1 and 3 then
      raise exception 'Uma colocação do pódio é inválida.' using errcode = '22023';
    end if;
    if not exists (
      select 1
      from public.tournament_registrations registration
      where registration.tournament_id = p_tournament_id
        and registration.workflow_status = 'approved'
        and registration.paired_into_registration_id is null
        and (
          registration.athlete_user_id = athlete_id
          or (registration.partner_user_id = athlete_id and registration.partner_status = 'accepted')
        )
    ) then
      raise exception 'A identidade deste atleta ainda não foi confirmada.' using errcode = '22023';
    end if;
    if partner_id is not null and not exists (
      select 1
      from public.tournament_registrations registration
      where registration.tournament_id = p_tournament_id
        and registration.workflow_status = 'approved'
        and registration.paired_into_registration_id is null
        and (
          registration.athlete_user_id = partner_id
          or (registration.partner_user_id = partner_id and registration.partner_status = 'accepted')
        )
    ) then
      partner_id := null;
    end if;

    insert into public.athlete_achievements (
      tournament_id,
      tournament_public_id,
      tournament_name,
      tournament_type,
      athlete_user_id,
      partner_user_id,
      placement,
      bracket_name,
      category,
      event_date,
      approved_by_organization_user_id,
      organization_name,
      organization_photo_url,
      approved_at,
      history_locked_at
    ) values (
      p_tournament_id,
      tournament_row.public_id::text,
      tournament_row.name,
      tournament_row.type,
      athlete_id,
      partner_id,
      placement_value,
      bracket_value,
      category_value,
      event_date_value,
      auth.uid(),
      organization_name_value,
      organization_photo_value,
      now(),
      now() + interval '24 hours'
    )
    on conflict (tournament_id, athlete_user_id, bracket_name) do update set
      tournament_public_id = excluded.tournament_public_id,
      tournament_name = excluded.tournament_name,
      tournament_type = excluded.tournament_type,
      partner_user_id = excluded.partner_user_id,
      placement = excluded.placement,
      category = excluded.category,
      event_date = excluded.event_date,
      approved_by_organization_user_id = excluded.approved_by_organization_user_id,
      organization_name = excluded.organization_name,
      organization_photo_url = excluded.organization_photo_url
    where public.athlete_achievements.history_locked_at > now();
    get diagnostics affected_count = row_count;
    approved_count := approved_count + affected_count;
  end loop;

  return jsonb_build_object(
    'approved_count', approved_count,
    'approved_at', now(),
    'correction_window_hours', 24
  );
end;
$$;

create or replace function public.get_athlete_achievements(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', achievement.id,
    'placement', achievement.placement,
    'bracket_name', achievement.bracket_name,
    'category', achievement.category,
    'event_date', achievement.event_date,
    'approved_at', achievement.approved_at,
    'history_locked_at', achievement.history_locked_at,
    'tournament', jsonb_build_object(
      'id', achievement.tournament_id,
      'public_id', coalesce(achievement.tournament_public_id, tournament.public_id::text),
      'name', coalesce(nullif(achievement.tournament_name, ''), tournament.name, 'Torneio'),
      'type', coalesce(nullif(achievement.tournament_type, ''), tournament.type, '')
    ),
    'organization', jsonb_build_object(
      'user_id', achievement.approved_by_organization_user_id,
      'name', coalesce(
        nullif(achievement.organization_name, ''),
        nullif(btrim(organization.arena_name), ''),
        nullif(btrim(organization.name), ''),
        'Organização'
      ),
      'photo_url', coalesce(nullif(achievement.organization_photo_url, ''), organization.photo_url, '')
    ),
    'partner', case when partner.user_id is null then null else jsonb_build_object(
      'user_id', partner.user_id,
      'handle', partner.handle,
      'display_name', partner.display_name,
      'photo_url', partner.photo_url
    ) end
  ) order by achievement.placement, achievement.event_date desc nulls last, achievement.approved_at desc), '[]'::jsonb)
  from public.athlete_achievements achievement
  left join public.tournaments tournament on tournament.id = achievement.tournament_id
  left join public.profiles organization on organization.id = achievement.approved_by_organization_user_id
  left join public.member_profiles partner on partner.user_id = achievement.partner_user_id
  where achievement.athlete_user_id = p_user_id
    and (tournament.id is null or tournament.is_public = true)
    and (
      auth.uid() = p_user_id
      or exists (
        select 1 from public.member_profiles member
        where member.user_id = p_user_id and member.is_public = true
      )
    );
$$;

revoke all on function public.approve_tournament_podium(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_athlete_achievements(uuid) from public, anon, authenticated;
grant execute on function public.approve_tournament_podium(uuid, jsonb) to authenticated;
grant execute on function public.get_athlete_achievements(uuid) to anon, authenticated;

commit;
