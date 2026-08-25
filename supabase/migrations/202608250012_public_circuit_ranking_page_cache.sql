begin;

-- Mantém as posições públicas prontas em linhas pequenas. Assim, abrir ou
-- pesquisar um ranking não precisa desserializar e reordenar todo o JSON do
-- circuito a cada visitante.
create table if not exists public.public_circuit_ranking_rows (
  circuit_id uuid not null references public.circuits(id) on delete cascade,
  group_key text not null,
  rank_position integer not null check (rank_position > 0),
  player_id text not null,
  player_name text not null,
  payload jsonb not null,
  primary key (circuit_id, group_key, rank_position),
  unique (circuit_id, group_key, player_id)
);

create index if not exists public_circuit_ranking_rows_search_idx
  on public.public_circuit_ranking_rows (circuit_id, group_key, lower(player_name));

alter table public.public_circuit_ranking_rows enable row level security;
revoke all on table public.public_circuit_ranking_rows from public, anon, authenticated;

create or replace function public.refresh_public_circuit_ranking_rows(
  p_circuit_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ranking_settings_json jsonb := coalesce(p_payload -> 'ranking_settings', '{}'::jsonb);
  placement_mode boolean := false;
  criterion_one text := 'wins';
  criterion_two text := 'totalGames';
  criterion_three text := 'balance';
  group_item jsonb;
  normalized_group_key text;
begin
  delete from public.public_circuit_ranking_rows
  where circuit_id = p_circuit_id;

  if p_circuit_id is null or p_payload is null then return; end if;

  placement_mode := coalesce(ranking_settings_json ->> 'mode', 'performance') = 'placement';
  select
    coalesce(criteria ->> 0, 'wins'),
    coalesce(criteria ->> 1, 'totalGames'),
    coalesce(criteria ->> 2, 'balance')
  into criterion_one, criterion_two, criterion_three
  from (
    select case
      when jsonb_typeof(ranking_settings_json -> 'tieBreakOrder') = 'array'
        and jsonb_array_length(ranking_settings_json -> 'tieBreakOrder') = 3
        then ranking_settings_json -> 'tieBreakOrder'
      else '["wins", "totalGames", "balance"]'::jsonb
    end as criteria
  ) configured;

  for group_item in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'ranking_groups', '[]'::jsonb))
  loop
    normalized_group_key := case
      when lower(coalesce(group_item ->> 'key', '')) in ('masculino', 'feminino')
        then lower(group_item ->> 'key')
      else 'geral'
    end;

    insert into public.public_circuit_ranking_rows (
      circuit_id,
      group_key,
      rank_position,
      player_id,
      player_name,
      payload
    )
    with source_rows as materialized (
      select
        row_item as payload,
        coalesce(
          nullif(row_item ->> 'id', ''),
          normalized_group_key || ':' || md5(coalesce(row_item ->> 'name', ''))
        ) as row_id,
        coalesce(row_item ->> 'name', '') as player_name,
        coalesce(
          nullif(row_item ->> 'circuitPoints', '')::integer,
          nullif(row_item ->> 'circuit_points', '')::integer,
          0
        ) as circuit_points,
        coalesce(nullif(row_item ->> 'w', '')::integer, 0) as wins,
        coalesce(nullif(row_item ->> 'pts', '')::integer, 0) as total_games,
        coalesce(nullif(row_item ->> 'bal', '')::integer, 0) as balance
      from jsonb_array_elements(coalesce(group_item -> 'rows', '[]'::jsonb)) row_item
    ), metrics as materialized (
      select
        source_rows.*,
        case when placement_mode then source_rows.circuit_points else 0 end as placement_metric,
        case criterion_one
          when 'totalGames' then source_rows.total_games
          when 'balance' then source_rows.balance
          else source_rows.wins
        end as metric_one,
        case criterion_two
          when 'wins' then source_rows.wins
          when 'balance' then source_rows.balance
          else source_rows.total_games
        end as metric_two,
        case criterion_three
          when 'wins' then source_rows.wins
          when 'totalGames' then source_rows.total_games
          else source_rows.balance
        end as metric_three
      from source_rows
    ), draw_metadata as materialized (
      select
        metrics.*,
        case when placement_mode then
          replace(jsonb_build_array(
            metrics.placement_metric,
            metrics.metric_one,
            metrics.metric_two,
            metrics.metric_three
          )::text, ' ', '')
        else
          replace(jsonb_build_array(
            metrics.metric_one,
            metrics.metric_two,
            metrics.metric_three
          )::text, ' ', '')
        end as current_signature,
        (
          select draw_item.ordinality::integer
          from jsonb_array_elements_text(coalesce(ranking_settings_json -> 'tieBreakDrawOrder', '[]'::jsonb))
            with ordinality as draw_item(value, ordinality)
          where draw_item.value = metrics.row_id
          limit 1
        ) as draw_index
      from metrics
    ), sortable as materialized (
      select
        draw_metadata.*,
        coalesce(ranking_settings_json -> 'tieBreakDrawSignatures' ->> draw_metadata.row_id, '')
          = draw_metadata.current_signature as draw_signature_valid
      from draw_metadata
    ), resolved as materialized (
      select
        sortable.*,
        bool_and(sortable.draw_signature_valid and sortable.draw_index is not null) over (
          partition by
            sortable.placement_metric,
            sortable.metric_one,
            sortable.metric_two,
            sortable.metric_three
        ) as draw_order_complete
      from sortable
    ), ranked as (
      select
        resolved.*,
        row_number() over (
          order by
            resolved.placement_metric desc,
            resolved.metric_one desc,
            resolved.metric_two desc,
            resolved.metric_three desc,
            case when resolved.draw_order_complete then resolved.draw_index end asc nulls last,
            lower(resolved.player_name),
            resolved.player_name,
            resolved.row_id
        )::integer as global_position
      from resolved
    )
    select
      p_circuit_id,
      normalized_group_key,
      ranked.global_position,
      ranked.row_id,
      ranked.player_name,
      ranked.payload
    from ranked;
  end loop;
end;
$$;

revoke all on function public.refresh_public_circuit_ranking_rows(uuid, jsonb)
  from public, anon, authenticated;

-- Toda reconstrução do snapshot atualiza também as páginas relacionais.
create or replace function public.refresh_public_circuit_snapshot(p_circuit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  next_payload jsonb;
begin
  if p_circuit_id is null then return null; end if;

  next_payload := public.build_public_circuit_uncached(p_circuit_id);
  if next_payload is null then
    delete from public.public_circuit_snapshots where circuit_id = p_circuit_id;
    delete from public.public_circuit_ranking_rows where circuit_id = p_circuit_id;
    return null;
  end if;

  insert into public.public_circuit_snapshots (circuit_id, payload, refreshed_at)
  values (p_circuit_id, next_payload, now())
  on conflict (circuit_id) do update set
    payload = excluded.payload,
    refreshed_at = excluded.refreshed_at;

  perform public.refresh_public_circuit_ranking_rows(p_circuit_id, next_payload);
  return next_payload;
end;
$$;

revoke all on function public.refresh_public_circuit_snapshot(uuid)
  from public, anon, authenticated;

create or replace function public.ensure_public_circuit_snapshot(p_circuit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  circuit_is_visible boolean := false;
  snapshot_exists boolean := false;
begin
  if p_circuit_id is null then return false; end if;

  select exists (
    select 1
    from public.circuits circuit
    join public.profiles profile on profile.id = circuit.user_id
    join auth.users account on account.id = profile.id
    where circuit.id = p_circuit_id
      and account.email_confirmed_at is not null
      and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
        'athlete', 'visitor', 'spectator'
      )
  ) into circuit_is_visible;
  if not circuit_is_visible then return false; end if;

  select exists (
    select 1 from public.public_circuit_snapshots snapshot
    where snapshot.circuit_id = p_circuit_id
  ) into snapshot_exists;
  if snapshot_exists then return true; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public-circuit:' || p_circuit_id::text, 0)
  );
  select exists (
    select 1 from public.public_circuit_snapshots snapshot
    where snapshot.circuit_id = p_circuit_id
  ) into snapshot_exists;
  if not snapshot_exists then
    snapshot_exists := public.refresh_public_circuit_snapshot(p_circuit_id) is not null;
  end if;
  return snapshot_exists;
end;
$$;

revoke all on function public.ensure_public_circuit_snapshot(uuid)
  from public, anon, authenticated;

create or replace function public.list_public_circuit_ranking_page(
  p_circuit_id uuid,
  p_group_key text default 'geral',
  p_limit integer default 30,
  p_offset integer default 0,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_group_key text := case
    when lower(coalesce(p_group_key, '')) in ('masculino', 'feminino')
      then lower(p_group_key)
    else 'geral'
  end;
  requested_limit integer := greatest(1, least(coalesce(p_limit, 30), 250));
  requested_offset integer := greatest(0, coalesce(p_offset, 0));
  requested_search text := nullif(trim(coalesce(p_search, '')), '');
  page_items jsonb := '[]'::jsonb;
  filtered_total integer := 0;
  all_total integer := 0;
begin
  if not public.ensure_public_circuit_snapshot(p_circuit_id) then return null; end if;

  select count(*)::integer
  into all_total
  from public.public_circuit_ranking_rows ranking
  where ranking.circuit_id = p_circuit_id
    and ranking.group_key = normalized_group_key;

  with filtered as materialized (
    select ranking.*
    from public.public_circuit_ranking_rows ranking
    where ranking.circuit_id = p_circuit_id
      and ranking.group_key = normalized_group_key
      and (
        requested_search is null
        or ranking.player_name ilike '%' || requested_search || '%'
      )
  ), page_rows as (
    select filtered.*
    from filtered
    order by filtered.rank_position
    offset requested_offset
    limit requested_limit
  )
  select
    coalesce(jsonb_agg(
      page_rows.payload || jsonb_build_object('rankPosition', page_rows.rank_position)
      order by page_rows.rank_position
    ), '[]'::jsonb),
    (select count(*)::integer from filtered)
  into page_items, filtered_total
  from page_rows;

  return jsonb_build_object(
    'group_key', normalized_group_key,
    'title', case normalized_group_key
      when 'masculino' then 'Ranking Masculino'
      when 'feminino' then 'Ranking Feminino'
      else 'Ranking geral acumulado'
    end,
    'items', coalesce(page_items, '[]'::jsonb),
    'total', coalesce(filtered_total, 0),
    'all_total', coalesce(all_total, 0),
    'has_more', requested_offset + jsonb_array_length(coalesce(page_items, '[]'::jsonb)) < coalesce(filtered_total, 0),
    'next_offset', requested_offset + jsonb_array_length(coalesce(page_items, '[]'::jsonb)),
    'limit', requested_limit,
    'offset', requested_offset,
    'search', coalesce(requested_search, '')
  );
end;
$$;

revoke all on function public.list_public_circuit_ranking_page(uuid, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_public_circuit_ranking_page(uuid, text, integer, integer, text)
  to anon, authenticated;

create or replace function public.get_public_circuit_with_tournaments(p_circuit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_circuit record;
  circuit_json jsonb;
  linked_tournaments jsonb := '[]'::jsonb;
  linked_tournament_ids jsonb := '[]'::jsonb;
  paged_groups jsonb := '[]'::jsonb;
  group_key_value text;
  group_rows jsonb;
  group_total integer;
  initial_limit integer := 30;
begin
  if not public.ensure_public_circuit_snapshot(p_circuit_id) then return null; end if;

  select circuit.*
  into selected_circuit
  from public.circuits circuit
  where circuit.id = p_circuit_id;
  if selected_circuit is null then return null; end if;

  for group_key_value in
    select distinct ranking.group_key
    from public.public_circuit_ranking_rows ranking
    where ranking.circuit_id = p_circuit_id
    order by ranking.group_key
  loop
    select
      coalesce(jsonb_agg(
        page.payload || jsonb_build_object('rankPosition', page.rank_position)
        order by page.rank_position
      ), '[]'::jsonb)
    into group_rows
    from (
      select ranking.payload, ranking.rank_position
      from public.public_circuit_ranking_rows ranking
      where ranking.circuit_id = p_circuit_id
        and ranking.group_key = group_key_value
      order by ranking.rank_position
      limit initial_limit
    ) page;

    select count(*)::integer
    into group_total
    from public.public_circuit_ranking_rows ranking
    where ranking.circuit_id = p_circuit_id
      and ranking.group_key = group_key_value;

    paged_groups := paged_groups || jsonb_build_array(jsonb_build_object(
      'key', group_key_value,
      'title', case group_key_value
        when 'masculino' then 'Ranking Masculino'
        when 'feminino' then 'Ranking Feminino'
        else 'Ranking geral acumulado'
      end,
      'rows', coalesce(group_rows, '[]'::jsonb),
      'total', coalesce(group_total, 0),
      'all_total', coalesce(group_total, 0),
      'has_more', coalesce(group_total, 0) > initial_limit,
      'next_offset', least(initial_limit, coalesce(group_total, 0)),
      'server_pagination', true
    ));
  end loop;

  with valid_tournaments as materialized (
    select tournament.*, linked_id.ordinality
    from unnest(coalesce(selected_circuit.tournament_ids, '{}'::text[]))
      with ordinality as linked_id(value, ordinality)
    join public.tournaments tournament
      on tournament.id::text = linked_id.value
     and tournament.user_id = selected_circuit.user_id
     and coalesce(tournament.data ->> 'deletedAt', '') = ''
  )
  select
    coalesce(jsonb_agg(
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
      ) order by tournament.ordinality
    ), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(tournament.id::text) order by tournament.ordinality), '[]'::jsonb)
  into linked_tournaments, linked_tournament_ids
  from valid_tournaments tournament;

  circuit_json := jsonb_build_object(
    'id', selected_circuit.id,
    'user_id', selected_circuit.user_id,
    'name', selected_circuit.name,
    'start_date', selected_circuit.start_date,
    'end_date', selected_circuit.end_date,
    'status', case
      when selected_circuit.end_date is not null
        and selected_circuit.end_date < (statement_timestamp() at time zone 'America/Sao_Paulo')::date
        then 'finished'
      else 'active'
    end,
    'tournament_ids', linked_tournament_ids,
    'ranking_criteria', selected_circuit.ranking_criteria,
    'ranking_criteria_mode', selected_circuit.ranking_criteria_mode,
    'ranking_settings', selected_circuit.ranking_settings,
    'ranking_groups', paged_groups,
    'ranking_pagination', jsonb_build_object('enabled', true, 'page_size', initial_limit),
    'updated_at', selected_circuit.updated_at,
    'tournaments', linked_tournaments
  );

  return circuit_json;
end;
$$;

revoke all on function public.get_public_circuit_with_tournaments(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_circuit_with_tournaments(uuid)
  to anon, authenticated;

-- Preenche o cache de páginas para os snapshots já existentes sem alterar os
-- dados de torneios, circuitos, placares ou rankings de origem.
do $$
declare
  cached record;
begin
  for cached in
    select snapshot.circuit_id, snapshot.payload
    from public.public_circuit_snapshots snapshot
  loop
    perform public.refresh_public_circuit_ranking_rows(cached.circuit_id, cached.payload);
  end loop;
end;
$$;

commit;
