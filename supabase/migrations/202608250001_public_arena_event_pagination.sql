begin;

-- Perfis grandes não devem reconstruir nem transportar todos os eventos para
-- exibir apenas os primeiros cartões. O snapshot passa a guardar somente a
-- identidade pública da arena; contadores e páginas são lidos sob demanda.
create or replace function public.build_public_arena_profile_uncached(p_organizer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select jsonb_build_object(
    'id', profile.id,
    'name', profile.name,
    'arena_name', profile.arena_name,
    'city', profile.city,
    'state', profile.state,
    'photo_url', case
      when coalesce(profile.photo_url, '') ~* '^https?://' then profile.photo_url
      else null
    end,
    'has_photo', nullif(profile.photo_url, '') is not null,
    'phone', profile.phone,
    'address', profile.address,
    'maps_link', profile.maps_link,
    'instagram_handle', profile.instagram_handle,
    'instagram_link', profile.instagram_link,
    'whatsapp_group_link', profile.whatsapp_group_link
  )
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where profile.id = p_organizer_id
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
      'athlete', 'visitor', 'spectator'
    )
  limit 1;
$$;

revoke all on function public.build_public_arena_profile_uncached(uuid)
  from public, anon, authenticated;

create or replace function public.refresh_public_arena_snapshot(p_organizer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  next_payload jsonb;
begin
  if p_organizer_id is null then return null; end if;

  next_payload := jsonb_build_object(
    'profile', public.build_public_arena_profile_uncached(p_organizer_id)
  );
  insert into public.public_arena_snapshots (organizer_id, payload, refreshed_at)
  values (p_organizer_id, next_payload, now())
  on conflict (organizer_id) do update set
    payload = excluded.payload,
    refreshed_at = excluded.refreshed_at;
  return next_payload;
end;
$$;

revoke all on function public.refresh_public_arena_snapshot(uuid)
  from public, anon, authenticated;

create index if not exists tournaments_owner_public_dates_idx
  on public.tournaments (
    user_id,
    ((data ->> 'lifecycleStatus')),
    ((coalesce(nullif(data ->> 'eventEndDate', ''), nullif(data ->> 'eventDate', '')))),
    ((coalesce(nullif(data ->> 'eventStartDate', ''), nullif(data ->> 'eventDate', '')))),
    created_at,
    id
  )
  where coalesce(data ->> 'deletedAt', '') = '';

create index if not exists circuits_owner_public_dates_idx
  on public.circuits (user_id, end_date, start_date, updated_at desc, id)
  where nullif(ranking_settings ->> 'deletedAt', '') is null;

create or replace function public.get_public_arena_overview(
  p_organizer_id uuid default null,
  p_public_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
  cached_payload jsonb;
  profile_json jsonb;
  tournament_active_count integer := 0;
  tournament_finished_count integer := 0;
  circuit_active_count integer := 0;
  circuit_finished_count integer := 0;
  today_date date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is null then
    return jsonb_build_object('profile', null, 'counts', '{}'::jsonb, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  select snapshot.payload
  into cached_payload
  from public.public_arena_snapshots snapshot
  where snapshot.organizer_id = owner_id;

  profile_json := cached_payload -> 'profile';
  if profile_json is null or profile_json = 'null'::jsonb then
    profile_json := public.build_public_arena_profile_uncached(owner_id);
  end if;
  if profile_json is null then
    return jsonb_build_object('profile', null, 'counts', '{}'::jsonb, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  select
    count(*) filter (where not event_row.is_finished)::integer,
    count(*) filter (where event_row.is_finished)::integer
  into tournament_active_count, tournament_finished_count
  from (
    select
      lower(coalesce(tournament.data ->> 'lifecycleStatus', '')) = 'finished'
      or case
        when coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', '')) ~ '^\d{4}-\d{2}-\d{2}$'
          then coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''))::date < today_date
        else false
      end as is_finished
    from public.tournaments tournament
    where tournament.user_id = owner_id
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ) event_row;

  select
    count(*) filter (where not (circuit.end_date is not null and circuit.end_date < today_date))::integer,
    count(*) filter (where circuit.end_date is not null and circuit.end_date < today_date)::integer
  into circuit_active_count, circuit_finished_count
  from public.circuits circuit
  where circuit.user_id = owner_id
    and nullif(circuit.ranking_settings ->> 'deletedAt', '') is null;

  return jsonb_build_object(
    'profile', profile_json,
    'counts', jsonb_build_object(
      'tournaments', jsonb_build_object('active', tournament_active_count, 'finished', tournament_finished_count),
      'circuits', jsonb_build_object('active', circuit_active_count, 'finished', circuit_finished_count)
    ),
    'pagination', jsonb_build_object('enabled', true, 'page_size', 8),
    'tournaments', '[]'::jsonb,
    'circuits', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_public_arena_overview(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_overview(uuid, text)
  to anon, authenticated;

create or replace function public.list_public_arena_events_page(
  p_organizer_id uuid default null,
  p_public_id text default null,
  p_kind text default 'tournaments',
  p_status text default 'active',
  p_limit integer default 8,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
  normalized_kind text := case when lower(coalesce(p_kind, '')) = 'circuits' then 'circuits' else 'tournaments' end;
  normalized_status text := case when lower(coalesce(p_status, '')) = 'finished' then 'finished' else 'active' end;
  page_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
  page_offset integer := greatest(0, coalesce(p_offset, 0));
  today_date date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  now_key text := to_char(statement_timestamp() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI');
  items_json jsonb := '[]'::jsonb;
  total_count integer := 0;
begin
  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is null or public.build_public_arena_profile_uncached(owner_id) is null then
    return jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'has_more', false, 'next_offset', 0);
  end if;

  if normalized_kind = 'tournaments' then
    with candidates as (
      select
        tournament.*,
        coalesce(nullif(tournament.data ->> 'eventStartDate', ''), nullif(tournament.data ->> 'eventDate', '')) as start_date_value,
        coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', '')) as end_date_value,
        case
          when tournament.data ->> 'displayOrder' ~ '^-?[0-9]+$' then (tournament.data ->> 'displayOrder')::integer
          else null
        end as display_order,
        lower(coalesce(tournament.data ->> 'displayOrderMode', '')) = 'manual' as manual_order,
        lower(coalesce(tournament.data ->> 'lifecycleStatus', '')) = 'finished'
          or case
            when coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', '')) ~ '^\d{4}-\d{2}-\d{2}$'
              then coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''))::date < today_date
            else false
          end as is_finished
      from public.tournaments tournament
      where tournament.user_id = owner_id
        and coalesce(tournament.data ->> 'deletedAt', '') = ''
    ), filtered as (
      select
        candidates.*,
        bool_and(candidates.manual_order and candidates.display_order is not null) over () as use_manual_order,
        coalesce(candidates.start_date_value, '9999-12-31') || 'T' ||
          case
            when coalesce(candidates.data ->> 'eventStartTime', '') ~ '^\d{2}:\d{2}'
              then left(candidates.data ->> 'eventStartTime', 5)
            else '23:59'
          end as event_sort_key,
        case
          when candidates.is_finished then 2
          when coalesce(candidates.start_date_value, '') ~ '^\d{4}-\d{2}-\d{2}$'
            and (
              candidates.start_date_value > today_date::text
              or (
                candidates.start_date_value = today_date::text
                and coalesce(candidates.data ->> 'eventStartTime', '') ~ '^\d{2}:\d{2}'
                and candidates.start_date_value || 'T' || left(candidates.data ->> 'eventStartTime', 5) > now_key
              )
            ) then 1
          else 0
        end as lifecycle_rank
      from candidates
      where candidates.is_finished = (normalized_status = 'finished')
    ), page_rows as (
      select filtered.*
      from filtered
      order by
        case when filtered.use_manual_order then filtered.display_order end asc nulls last,
        case when not filtered.use_manual_order then filtered.lifecycle_rank end asc nulls last,
        case when not filtered.use_manual_order and normalized_status = 'active' then filtered.event_sort_key end asc nulls last,
        case when not filtered.use_manual_order and normalized_status = 'finished' then filtered.event_sort_key end desc nulls last,
        filtered.created_at asc,
        filtered.id
      offset page_offset
      limit page_limit
    )
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', page_rows.id,
          'user_id', page_rows.user_id,
          'name', page_rows.name,
          'type', page_rows.type,
          'data', public.t360_public_tournament_summary_data(page_rows.data),
          'public_id', page_rows.public_id,
          'is_public', true,
          'directoryEntry', true,
          'status', page_rows.status,
          'created_at', page_rows.created_at,
          'updated_at', page_rows.updated_at
        ) order by
          case when page_rows.use_manual_order then page_rows.display_order end asc nulls last,
          case when not page_rows.use_manual_order then page_rows.lifecycle_rank end asc nulls last,
          case when not page_rows.use_manual_order and normalized_status = 'active' then page_rows.event_sort_key end asc nulls last,
          case when not page_rows.use_manual_order and normalized_status = 'finished' then page_rows.event_sort_key end desc nulls last,
          page_rows.created_at asc,
          page_rows.id
      ), '[]'::jsonb),
      (select count(*)::integer from filtered)
    into items_json, total_count
    from page_rows;
  else
    with candidates as (
      select
        circuit.*,
        circuit.end_date is not null and circuit.end_date < today_date as is_finished,
        coalesce(circuit.end_date, circuit.start_date, '9999-12-31'::date) as event_sort_date
      from public.circuits circuit
      where circuit.user_id = owner_id
        and nullif(circuit.ranking_settings ->> 'deletedAt', '') is null
    ), filtered as (
      select candidates.*
      from candidates
      where candidates.is_finished = (normalized_status = 'finished')
    ), page_rows as (
      select filtered.*
      from filtered
      order by
        case when normalized_status = 'active' then filtered.event_sort_date end asc nulls last,
        case when normalized_status = 'finished' then filtered.event_sort_date end desc nulls last,
        filtered.id
      offset page_offset
      limit page_limit
    )
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', page_rows.id,
          'user_id', page_rows.user_id,
          'name', page_rows.name,
          'start_date', page_rows.start_date,
          'end_date', page_rows.end_date,
          'status', case when page_rows.is_finished then 'finished' else 'active' end,
          'tournament_ids', coalesce((
            select jsonb_agg(linked_id.value order by linked_id.ordinality)
            from jsonb_array_elements_text(coalesce(to_jsonb(page_rows.tournament_ids), '[]'::jsonb))
              with ordinality as linked_id(value, ordinality)
            where exists (
              select 1
              from public.tournaments linked_tournament
              where linked_tournament.id::text = linked_id.value
                and linked_tournament.user_id = owner_id
                and coalesce(linked_tournament.data ->> 'deletedAt', '') = ''
            )
          ), '[]'::jsonb),
          'ranking_criteria', page_rows.ranking_criteria,
          'ranking_criteria_mode', page_rows.ranking_criteria_mode,
          'ranking_settings', coalesce(page_rows.ranking_settings, '{}'::jsonb) - 'coverImageUrl',
          'updated_at', page_rows.updated_at,
          'directoryEntry', true
        ) order by
          case when normalized_status = 'active' then page_rows.event_sort_date end asc nulls last,
          case when normalized_status = 'finished' then page_rows.event_sort_date end desc nulls last,
          page_rows.id
      ), '[]'::jsonb),
      (select count(*)::integer from filtered)
    into items_json, total_count
    from page_rows;
  end if;

  return jsonb_build_object(
    'items', coalesce(items_json, '[]'::jsonb),
    'total', coalesce(total_count, 0),
    'has_more', page_offset + jsonb_array_length(coalesce(items_json, '[]'::jsonb)) < coalesce(total_count, 0),
    'next_offset', page_offset + jsonb_array_length(coalesce(items_json, '[]'::jsonb)),
    'kind', normalized_kind,
    'status', normalized_status
  );
end;
$$;

revoke all on function public.list_public_arena_events_page(uuid, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.list_public_arena_events_page(uuid, text, text, text, integer, integer)
  to anon, authenticated;

-- Compatibilidade para clientes antigos da homologação: o pacote continua
-- abrindo o perfil, mas eventos novos são obtidos pelo RPC paginado.
create or replace function public.get_public_arena_bundle(
  p_organizer_id uuid default null,
  p_public_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.get_public_arena_overview(p_organizer_id, p_public_id);
$$;

revoke all on function public.get_public_arena_bundle(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_bundle(uuid, text)
  to anon, authenticated;

-- A alteração de torneios e circuitos não precisa mais reconstruir um JSON
-- gigante. Apenas alterações do perfil renovam o pequeno snapshot de identidade.
drop trigger if exists tournaments_refresh_public_arena_snapshot on public.tournaments;
drop trigger if exists circuits_refresh_public_arena_snapshot on public.circuits;

insert into public.public_arena_snapshots (organizer_id, payload, refreshed_at)
select
  profile.id,
  jsonb_build_object('profile', public.build_public_arena_profile_uncached(profile.id)),
  now()
from public.profiles profile
join auth.users account on account.id = profile.id
where account.email_confirmed_at is not null
  and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
    'athlete', 'visitor', 'spectator'
  )
on conflict (organizer_id) do update set
  payload = excluded.payload,
  refreshed_at = excluded.refreshed_at;

-- Ao abrir um circuito, somente os seus torneios vinculados acompanham o
-- ranking. Assim a página geral pode continuar paginada sem perder as etapas.
create or replace function public.get_public_circuit_with_tournaments(p_circuit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  circuit_json jsonb;
  linked_tournaments jsonb := '[]'::jsonb;
begin
  circuit_json := public.get_public_circuit(p_circuit_id);
  if circuit_json is null then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tournament.id,
      'user_id', tournament.user_id,
      'name', tournament.name,
      'type', tournament.type,
      'data', public.t360_public_tournament_summary_data(tournament.data),
      'public_id', tournament.public_id,
      'is_public', true,
      'directoryEntry', true,
      'status', tournament.status,
      'created_at', tournament.created_at,
      'updated_at', tournament.updated_at
    ) order by linked_id.ordinality
  ), '[]'::jsonb)
  into linked_tournaments
  from jsonb_array_elements_text(coalesce(circuit_json -> 'tournament_ids', '[]'::jsonb))
    with ordinality as linked_id(value, ordinality)
  join public.tournaments tournament on tournament.id::text = linked_id.value
  where tournament.user_id::text = circuit_json ->> 'user_id'
    and coalesce(tournament.data ->> 'deletedAt', '') = '';

  return circuit_json || jsonb_build_object('tournaments', linked_tournaments);
end;
$$;

revoke all on function public.get_public_circuit_with_tournaments(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_circuit_with_tournaments(uuid)
  to anon, authenticated;

commit;
