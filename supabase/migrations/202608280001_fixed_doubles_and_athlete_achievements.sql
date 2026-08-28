begin;

create or replace function public.tournament_type_requires_fixed_doubles(p_type text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(p_type, '') in (
    'Super 12 Mista (Dupla Fixa)',
    'Super 16 Mista (Dupla Fixa)',
    'Super 10 (Dupla Fixa)',
    'Super 12 (Dupla Fixa)',
    'Copa - 18 duplas',
    'Campeonato Cearense',
    'Modelo Play Ranking',
    'Copa Sunset'
  );
$$;

create or replace function public.set_my_partner_search(
  p_tournament_id uuid,
  p_category text default '',
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  search_row public.athlete_partner_searches%rowtype;
  normalized_category text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select * into tournament_row
  from public.tournaments tournament
  where tournament.id = p_tournament_id;

  if tournament_row.id is null then
    raise exception 'Torneio não encontrado.' using errcode = 'P0002';
  end if;
  if not public.tournament_type_requires_fixed_doubles(tournament_row.type) then
    raise exception 'A procura por dupla está disponível somente em modalidades de dupla fixa.' using errcode = '22023';
  end if;

  select * into registration_row
  from public.tournament_registrations registration
  where registration.tournament_id = p_tournament_id
    and registration.athlete_user_id = auth.uid()
    and registration.status in ('pending', 'confirmed')
  limit 1;

  if registration_row.id is null then
    raise exception 'Inscreva-se neste torneio antes de procurar uma dupla.' using errcode = '42501';
  end if;
  if btrim(coalesce(registration_row.partner_name, '')) <> ''
    or registration_row.partner_user_id is not null then
    raise exception 'Sua inscrição já possui uma dupla.' using errcode = '22023';
  end if;

  normalized_category := left(coalesce(nullif(btrim(p_category), ''), nullif(btrim(registration_row.category), ''), 'Categoria do torneio'), 80);

  insert into public.athlete_partner_searches (tournament_id, athlete_user_id, category, active)
  values (p_tournament_id, auth.uid(), normalized_category, coalesce(p_active, true))
  on conflict (tournament_id, athlete_user_id) do update set
    category = excluded.category,
    active = excluded.active,
    updated_at = now()
  returning * into search_row;

  return to_jsonb(search_row);
end;
$$;

update public.athlete_partner_searches search_item
set active = false, updated_at = now()
where search_item.active = true
  and exists (
    select 1
    from public.tournaments tournament
    where tournament.id = search_item.tournament_id
      and not public.tournament_type_requires_fixed_doubles(tournament.type)
  );

create table if not exists public.athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  partner_user_id uuid references auth.users(id) on delete set null,
  placement smallint not null check (placement between 1 and 3),
  bracket_name text not null default 'Principal' check (char_length(bracket_name) between 1 and 80),
  category text not null default '' check (char_length(category) <= 80),
  event_date date,
  approved_by_organization_user_id uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tournament_id, athlete_user_id, bracket_name),
  check (partner_user_id is null or partner_user_id <> athlete_user_id)
);

create index if not exists athlete_achievements_profile_idx
on public.athlete_achievements (athlete_user_id, placement, event_date desc, approved_at desc);

alter table public.athlete_achievements enable row level security;
revoke all on public.athlete_achievements from public, anon, authenticated;

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
  approved_count integer := 0;
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
    raise exception 'Somente a organização responsável pode confirmar estas conquistas.' using errcode = '42501';
  end if;

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
      raise exception 'Confirme a identidade de todos os atletas do pódio antes de publicar as conquistas.' using errcode = '22023';
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
      raise exception 'A dupla do pódio ainda não possui identidade confirmada.' using errcode = '22023';
    end if;

    insert into public.athlete_achievements (
      tournament_id,
      athlete_user_id,
      partner_user_id,
      placement,
      bracket_name,
      category,
      event_date,
      approved_by_organization_user_id,
      approved_at
    ) values (
      p_tournament_id,
      athlete_id,
      partner_id,
      placement_value,
      bracket_value,
      category_value,
      event_date_value,
      auth.uid(),
      now()
    )
    on conflict (tournament_id, athlete_user_id, bracket_name) do update set
      partner_user_id = excluded.partner_user_id,
      placement = excluded.placement,
      category = excluded.category,
      event_date = excluded.event_date,
      approved_by_organization_user_id = auth.uid(),
      approved_at = now();
    approved_count := approved_count + 1;
  end loop;

  return jsonb_build_object('approved_count', approved_count, 'approved_at', now());
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
    'tournament', jsonb_build_object(
      'id', tournament.id,
      'public_id', tournament.public_id,
      'name', tournament.name,
      'type', tournament.type
    ),
    'organization', jsonb_build_object(
      'user_id', organization.id,
      'name', coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização'),
      'photo_url', coalesce(organization.photo_url, '')
    ),
    'partner', case when partner.user_id is null then null else jsonb_build_object(
      'user_id', partner.user_id,
      'handle', partner.handle,
      'display_name', partner.display_name,
      'photo_url', partner.photo_url
    ) end
  ) order by achievement.placement, achievement.event_date desc nulls last, achievement.approved_at desc), '[]'::jsonb)
  from public.athlete_achievements achievement
  join public.tournaments tournament on tournament.id = achievement.tournament_id
  join public.profiles organization on organization.id = achievement.approved_by_organization_user_id
  left join public.member_profiles partner on partner.user_id = achievement.partner_user_id
  where achievement.athlete_user_id = p_user_id
    and tournament.is_public = true
    and (
      auth.uid() = p_user_id
      or exists (
        select 1 from public.member_profiles member
        where member.user_id = p_user_id and member.is_public = true
      )
    );
$$;

create or replace function public.get_my_athlete_achievements()
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
  return public.get_athlete_achievements(auth.uid());
end;
$$;

revoke all on function public.tournament_type_requires_fixed_doubles(text) from public, anon, authenticated;
revoke all on function public.approve_tournament_podium(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_athlete_achievements(uuid) from public, anon, authenticated;
revoke all on function public.get_my_athlete_achievements() from public, anon, authenticated;
grant execute on function public.approve_tournament_podium(uuid, jsonb) to authenticated;
grant execute on function public.get_athlete_achievements(uuid) to anon, authenticated;
grant execute on function public.get_my_athlete_achievements() to authenticated;

commit;
