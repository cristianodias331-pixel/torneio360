begin;

-- Evita que a chamada inicial percorra os torneios duas vezes: a mesma lista
-- de candidatos alimenta contadores e a primeira página ativa.
create or replace function public.get_public_arena_initial_view(
  p_organizer_id uuid default null,
  p_public_id text default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
  profile_json jsonb;
  page_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
  today_date date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  now_key text := to_char(statement_timestamp() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI');
  tournament_active_count integer := 0;
  tournament_finished_count integer := 0;
  circuit_active_count integer := 0;
  circuit_finished_count integer := 0;
  items_json jsonb := '[]'::jsonb;
begin
  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is not null then
    select snapshot.payload -> 'profile'
    into profile_json
    from public.public_arena_snapshots snapshot
    where snapshot.organizer_id = owner_id;

    if profile_json is null or profile_json = 'null'::jsonb then
      profile_json := public.build_public_arena_profile_uncached(owner_id);
    end if;
  end if;

  if owner_id is null or profile_json is null then
    return jsonb_build_object(
      'bundle', jsonb_build_object(
        'profile', null,
        'counts', '{}'::jsonb,
        'pagination', jsonb_build_object('enabled', true, 'page_size', page_limit),
        'tournaments', '[]'::jsonb,
        'circuits', '[]'::jsonb
      ),
      'active_tournaments', jsonb_build_object(
        'items', '[]'::jsonb,
        'total', 0,
        'has_more', false,
        'next_offset', 0,
        'kind', 'tournaments',
        'status', 'active'
      )
    );
  end if;

  with candidates as materialized (
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
  ), counts as (
    select
      count(*) filter (where not candidates.is_finished)::integer as active_count,
      count(*) filter (where candidates.is_finished)::integer as finished_count
    from candidates
  ), active_rows as (
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
    where not candidates.is_finished
  ), page_rows as (
    select active_rows.*
    from active_rows
    order by
      case when active_rows.use_manual_order then active_rows.display_order end asc nulls last,
      case when not active_rows.use_manual_order then active_rows.lifecycle_rank end asc nulls last,
      case when not active_rows.use_manual_order then active_rows.event_sort_key end asc nulls last,
      active_rows.created_at asc,
      active_rows.id
    limit page_limit
  ), page_payload as (
    select coalesce(jsonb_agg(
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
        case when not page_rows.use_manual_order then page_rows.event_sort_key end asc nulls last,
        page_rows.created_at asc,
        page_rows.id
    ), '[]'::jsonb) as items
    from page_rows
  )
  select counts.active_count, counts.finished_count, page_payload.items
  into tournament_active_count, tournament_finished_count, items_json
  from counts cross join page_payload;

  select
    count(*) filter (where not (circuit.end_date is not null and circuit.end_date < today_date))::integer,
    count(*) filter (where circuit.end_date is not null and circuit.end_date < today_date)::integer
  into circuit_active_count, circuit_finished_count
  from public.circuits circuit
  where circuit.user_id = owner_id
    and nullif(circuit.ranking_settings ->> 'deletedAt', '') is null;

  return jsonb_build_object(
    'bundle', jsonb_build_object(
      'profile', profile_json,
      'counts', jsonb_build_object(
        'tournaments', jsonb_build_object('active', tournament_active_count, 'finished', tournament_finished_count),
        'circuits', jsonb_build_object('active', circuit_active_count, 'finished', circuit_finished_count)
      ),
      'pagination', jsonb_build_object('enabled', true, 'page_size', page_limit),
      'tournaments', '[]'::jsonb,
      'circuits', '[]'::jsonb
    ),
    'active_tournaments', jsonb_build_object(
      'items', coalesce(items_json, '[]'::jsonb),
      'total', tournament_active_count,
      'has_more', jsonb_array_length(coalesce(items_json, '[]'::jsonb)) < tournament_active_count,
      'next_offset', jsonb_array_length(coalesce(items_json, '[]'::jsonb)),
      'kind', 'tournaments',
      'status', 'active'
    )
  );
end;
$$;

revoke all on function public.get_public_arena_initial_view(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_initial_view(uuid, text, integer)
  to anon, authenticated;

comment on function public.get_public_arena_initial_view(uuid, text, integer) is
  'Entrega perfil, contadores e primeira página ativa com uma única leitura compartilhada dos torneios.';

commit;
