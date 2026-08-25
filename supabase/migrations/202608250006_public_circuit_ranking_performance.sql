begin;

-- A abertura pública de um circuito filtra primeiro pelo circuito e depois
-- confirma se cada resultado pertence a uma etapa ainda válida. Este índice
-- acompanha exatamente esse caminho sem alterar a fonte dos placares.
create index if not exists circuit_ranking_history_public_read_idx
  on public.circuit_ranking_history (circuit_id, user_id, tournament_id)
  where played > 0;

-- Valida as etapas do circuito uma única vez e reutiliza o conjunto pronto na
-- agregação. A versão anterior repetia unnest + consulta de torneio para cada
-- linha do ranking, o que causava timeout em circuitos grandes sob concorrência.
create or replace function public.get_public_circuit(p_circuit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  circuit_json jsonb;
begin
  with selected_circuit as materialized (
    select circuit.*
    from public.circuits circuit
    join public.profiles profile on profile.id = circuit.user_id
    join auth.users account on account.id = profile.id
    where circuit.id = p_circuit_id
      and account.email_confirmed_at is not null
      and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
        'athlete', 'visitor', 'spectator'
      )
  ), valid_tournaments as materialized (
    select
      linked_tournament.id,
      linked_id.ordinality
    from selected_circuit circuit
    cross join lateral unnest(coalesce(circuit.tournament_ids, '{}'::text[]))
      with ordinality as linked_id(value, ordinality)
    join public.tournaments linked_tournament
      on linked_tournament.id::text = linked_id.value
     and linked_tournament.user_id = circuit.user_id
     and coalesce(linked_tournament.data ->> 'deletedAt', '') = ''
  ), ranking_rows as materialized (
    select
      coalesce(history.group_key, 'geral') as group_key,
      history.player_key,
      max(history.player_name) as player_name,
      sum(history.pts)::integer as pts,
      sum(history.w)::integer as w,
      sum(history.bal)::integer as bal,
      sum(history.played)::integer as played,
      count(distinct history.tournament_id)::integer as tournaments,
      sum(history.circuit_points)::integer as circuit_points,
      sum(history.titles)::integer as titles,
      sum(history.runner_ups)::integer as runner_ups,
      sum(history.third_places)::integer as third_places
    from selected_circuit circuit
    join public.circuit_ranking_history history
      on history.circuit_id = circuit.id
     and history.user_id = circuit.user_id
     and history.played > 0
    join valid_tournaments selected
      on selected.id = history.tournament_id
    group by coalesce(history.group_key, 'geral'), history.player_key
  ), ranking_groups as materialized (
    select
      ranking.group_key,
      jsonb_agg(
        jsonb_build_object(
          'id', ranking.group_key || ':' || ranking.player_key,
          'name', ranking.player_name,
          'pts', ranking.pts,
          'w', ranking.w,
          'bal', ranking.bal,
          'played', ranking.played,
          'tournaments', ranking.tournaments,
          'circuitPoints', ranking.circuit_points,
          'circuit_points', ranking.circuit_points,
          'titles', ranking.titles,
          'runnerUps', ranking.runner_ups,
          'thirdPlaces', ranking.third_places
        ) order by ranking.player_name
      ) as rows
    from ranking_rows ranking
    group by ranking.group_key
  )
  select jsonb_build_object(
    'id', circuit.id,
    'user_id', circuit.user_id,
    'name', circuit.name,
    'start_date', circuit.start_date,
    'end_date', circuit.end_date,
    'status', case
      when circuit.end_date is not null
        and circuit.end_date < (statement_timestamp() at time zone 'America/Sao_Paulo')::date
        then 'finished'
      else 'active'
    end,
    'tournament_ids', coalesce((
      select jsonb_agg(selected.id::text order by selected.ordinality)
      from valid_tournaments selected
    ), '[]'::jsonb),
    'ranking_criteria', circuit.ranking_criteria,
    'ranking_criteria_mode', circuit.ranking_criteria_mode,
    'ranking_settings', circuit.ranking_settings,
    'ranking_groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', grouped.group_key,
          'title', case grouped.group_key
            when 'masculino' then 'Ranking Masculino'
            when 'feminino' then 'Ranking Feminino'
            else 'Ranking geral acumulado'
          end,
          'rows', grouped.rows
        ) order by grouped.group_key
      )
      from ranking_groups grouped
    ), '[]'::jsonb),
    'updated_at', circuit.updated_at
  )
  into circuit_json
  from selected_circuit circuit;

  return circuit_json;
end;
$$;

revoke all on function public.get_public_circuit(uuid) from public, anon, authenticated;
grant execute on function public.get_public_circuit(uuid) to anon, authenticated;

commit;
