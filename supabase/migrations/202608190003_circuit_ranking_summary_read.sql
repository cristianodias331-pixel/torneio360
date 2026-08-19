-- Reduz o volume transferido ao abrir rankings de circuitos grandes.
-- Esta função é estritamente de leitura: o histórico detalhado continua sendo
-- a fonte oficial e nenhuma rodada, chave, partida ou placar é alterado.

create or replace function public.get_circuit_ranking_summary(p_circuit_id uuid)
returns table (
  group_key text,
  player_key text,
  player_name text,
  pts bigint,
  w bigint,
  bal bigint,
  played bigint,
  tournaments bigint,
  circuit_points bigint,
  titles bigint,
  runner_ups bigint,
  third_places bigint,
  stage_scores jsonb,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(history.group_key, 'geral') as group_key,
    history.player_key,
    history.player_name,
    sum(coalesce(history.pts, 0))::bigint as pts,
    sum(coalesce(history.w, 0))::bigint as w,
    sum(coalesce(history.bal, 0))::bigint as bal,
    sum(coalesce(history.played, 0))::bigint as played,
    count(distinct history.tournament_id)::bigint as tournaments,
    sum(coalesce(history.circuit_points, 0))::bigint as circuit_points,
    sum(coalesce(history.titles, 0))::bigint as titles,
    sum(coalesce(history.runner_ups, 0))::bigint as runner_ups,
    sum(coalesce(history.third_places, 0))::bigint as third_places,
    jsonb_agg(
      coalesce(history.circuit_points, 0)
      order by coalesce(history.circuit_points, 0) desc, history.tournament_id
    ) as stage_scores,
    max(history.updated_at) as updated_at
  from public.circuit_ranking_history as history
  where history.user_id = auth.uid()
    and history.circuit_id = p_circuit_id
  group by
    coalesce(history.group_key, 'geral'),
    history.player_key,
    history.player_name;
$$;

revoke all on function public.get_circuit_ranking_summary(uuid) from public;
grant execute on function public.get_circuit_ranking_summary(uuid) to authenticated;

comment on function public.get_circuit_ranking_summary(uuid) is
  'Agrega o histórico derivado de um circuito para leitura rápida sem modificar torneios ou placares.';
