begin;

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
  source_payload jsonb;
  source_group jsonb;
  ranking_settings_json jsonb;
  normalized_group_key text := case
    when lower(coalesce(p_group_key, '')) in ('masculino', 'feminino')
      then lower(p_group_key)
    else 'geral'
  end;
  requested_limit integer := greatest(1, least(coalesce(p_limit, 30), 250));
  requested_offset integer := greatest(0, coalesce(p_offset, 0));
  requested_search text := nullif(trim(coalesce(p_search, '')), '');
  placement_mode boolean := false;
  criterion_one text := 'wins';
  criterion_two text := 'totalGames';
  criterion_three text := 'balance';
  page_items jsonb := '[]'::jsonb;
  filtered_total integer := 0;
  all_total integer := 0;
begin
  source_payload := public.get_public_circuit(p_circuit_id);
  if source_payload is null then return null; end if;

  select group_item
  into source_group
  from jsonb_array_elements(coalesce(source_payload -> 'ranking_groups', '[]'::jsonb)) group_item
  where coalesce(group_item ->> 'key', 'geral') = normalized_group_key
  limit 1;

  if source_group is null then
    return jsonb_build_object(
      'group_key', normalized_group_key,
      'title', case normalized_group_key
        when 'masculino' then 'Ranking Masculino'
        when 'feminino' then 'Ranking Feminino'
        else 'Ranking geral acumulado'
      end,
      'items', '[]'::jsonb,
      'total', 0,
      'all_total', 0,
      'has_more', false,
      'next_offset', 0,
      'limit', requested_limit,
      'offset', requested_offset,
      'search', coalesce(requested_search, '')
    );
  end if;

  ranking_settings_json := coalesce(source_payload -> 'ranking_settings', '{}'::jsonb);
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

  all_total := jsonb_array_length(coalesce(source_group -> 'rows', '[]'::jsonb));

  with source_rows as materialized (
    select
      row_item as payload,
      coalesce(row_item ->> 'id', '') as row_id,
      coalesce(row_item ->> 'name', '') as player_name,
      coalesce((row_item ->> 'circuitPoints')::integer, (row_item ->> 'circuit_points')::integer, 0) as circuit_points,
      coalesce((row_item ->> 'w')::integer, 0) as wins,
      coalesce((row_item ->> 'pts')::integer, 0) as total_games,
      coalesce((row_item ->> 'bal')::integer, 0) as balance
    from jsonb_array_elements(coalesce(source_group -> 'rows', '[]'::jsonb)) row_item
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
  ), ranked as materialized (
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
      ) as global_position
    from resolved
  ), filtered as materialized (
    select ranked.*
    from ranked
    where requested_search is null
      or ranked.player_name ilike '%' || requested_search || '%'
  ), page_rows as (
    select filtered.*
    from filtered
    order by filtered.global_position
    offset requested_offset
    limit requested_limit
  )
  select
    coalesce(jsonb_agg(
      page_rows.payload || jsonb_build_object('rankPosition', page_rows.global_position)
      order by page_rows.global_position
    ), '[]'::jsonb),
    (select count(*)::integer from filtered)
  into page_items, filtered_total
  from page_rows;

  return jsonb_build_object(
    'group_key', normalized_group_key,
    'title', coalesce(source_group ->> 'title', case normalized_group_key
      when 'masculino' then 'Ranking Masculino'
      when 'feminino' then 'Ranking Feminino'
      else 'Ranking geral acumulado'
    end),
    'items', coalesce(page_items, '[]'::jsonb),
    'total', coalesce(filtered_total, 0),
    'all_total', all_total,
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
  circuit_json jsonb;
  linked_tournaments jsonb := '[]'::jsonb;
  paged_groups jsonb := '[]'::jsonb;
  group_item jsonb;
  group_page jsonb;
  initial_limit integer := 30;
begin
  circuit_json := public.get_public_circuit(p_circuit_id);
  if circuit_json is null then return null; end if;

  for group_item in
    select value
    from jsonb_array_elements(coalesce(circuit_json -> 'ranking_groups', '[]'::jsonb))
  loop
    group_page := public.list_public_circuit_ranking_page(
      p_circuit_id,
      coalesce(group_item ->> 'key', 'geral'),
      initial_limit,
      0,
      null
    );
    paged_groups := paged_groups || jsonb_build_array(
      (group_item - 'rows') || jsonb_build_object(
        'rows', coalesce(group_page -> 'items', '[]'::jsonb),
        'total', coalesce((group_page ->> 'total')::integer, 0),
        'all_total', coalesce((group_page ->> 'all_total')::integer, 0),
        'has_more', coalesce((group_page ->> 'has_more')::boolean, false),
        'next_offset', coalesce((group_page ->> 'next_offset')::integer, 0),
        'server_pagination', true
      )
    );
  end loop;

  circuit_json := jsonb_set(circuit_json, '{ranking_groups}', paged_groups, true)
    || jsonb_build_object(
      'ranking_pagination', jsonb_build_object(
        'enabled', true,
        'page_size', initial_limit
      )
    );

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
