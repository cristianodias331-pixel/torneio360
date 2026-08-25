begin;

set local statement_timeout = '45s';

create temporary table organizer_scale_context on commit drop as
select tournament.user_id
from public.tournaments tournament
group by tournament.user_id
order by count(*) desc, tournament.user_id
limit 1;

create temporary table organizer_scale_results (
  area text not null,
  row_count integer not null,
  payload_bytes integer not null,
  elapsed_ms numeric not null
) on commit drop;
grant insert, select on organizer_scale_results to authenticated;

do $$
begin
  if not exists (select 1 from organizer_scale_context) then
    raise exception 'A homologação não possui organizador com torneio para o teste.';
  end if;
end;
$$;

insert into public.tournaments (
  id,
  user_id,
  name,
  type,
  data,
  status,
  public_id,
  is_public,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  context.user_id,
  'Escala temporária ' || series.value,
  'super8',
  jsonb_build_object(
    'eventName', 'Evento temporário ' || series.value,
    'eventDate', to_char(current_date + (series.value % 365), 'YYYY-MM-DD'),
    'eventStartDate', to_char(current_date + (series.value % 365), 'YYYY-MM-DD'),
    'eventEndDate', to_char(current_date + (series.value % 365), 'YYYY-MM-DD'),
    'eventStartTime', '08:00',
    'location', 'Arena de homologação',
    'winningScore', 6,
    'rankingCriteria', 'wins_points_balance',
    'category', 'Teste de escala',
    'participantGenderMode', 'male',
    'lifecycleStatus', 'active',
    'players', (
      select jsonb_agg('Participante ' || participant.value)
      from generate_series(1, 40) participant(value)
    ),
    'schedule', (
      select jsonb_agg(jsonb_build_object(
        'id', game.value,
        'a', 'Dupla ' || game.value,
        'b', 'Dupla ' || (game.value + 1),
        'scoreA', 0,
        'scoreB', 0
      ))
      from generate_series(1, 45) game(value)
    )
  ),
  'active',
  'scale-' || gen_random_uuid()::text,
  false,
  now() - make_interval(mins => series.value),
  now()
from organizer_scale_context context
cross join generate_series(1, 1000) series(value);

insert into public.circuits (
  id,
  user_id,
  name,
  start_date,
  end_date,
  status,
  tournament_ids,
  ranking_criteria,
  ranking_criteria_mode,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  context.user_id,
  'Circuito temporário ' || series.value,
  current_date,
  current_date + 90,
  'active',
  '{}'::text[],
  'wins_points_balance',
  'automatic',
  now() - make_interval(mins => series.value),
  now()
from organizer_scale_context context
cross join generate_series(1, 250) series(value);

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from organizer_scale_context),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

with started as materialized (
  select clock_timestamp() as value
), tournament_rows as materialized (
  select
    tournament.id,
    tournament.user_id,
    tournament.public_id,
    tournament.is_public,
    tournament.name,
    tournament.type,
    tournament.status,
    tournament.created_at,
    tournament.updated_at,
    tournament.revision,
    tournament.last_change_id,
    tournament.data ->> 'deletedAt' as summary_deleted_at,
    tournament.data ->> 'displayOrder' as summary_display_order,
    tournament.data ->> 'displayOrderMode' as summary_display_order_mode,
    tournament.data ->> 'eventName' as summary_event_name,
    tournament.data ->> 'eventDate' as summary_event_date,
    tournament.data ->> 'eventStartDate' as summary_event_start_date,
    tournament.data ->> 'eventEndDate' as summary_event_end_date,
    tournament.data ->> 'eventStartTime' as summary_event_start_time,
    tournament.data ->> 'location' as summary_location,
    tournament.data ->> 'winningScore' as summary_winning_score,
    tournament.data ->> 'rankingCriteria' as summary_ranking_criteria,
    tournament.data ->> 'category' as summary_category,
    tournament.data ->> 'participantGenderMode' as summary_participant_gender_mode,
    tournament.data ->> 'lifecycleStatus' as summary_lifecycle_status
  from public.tournaments tournament
  where tournament.user_id = auth.uid()
  order by tournament.created_at desc
), tournament_payload as materialized (
  select
    count(*)::integer as row_count,
    pg_column_size(coalesce(jsonb_agg(to_jsonb(tournament_rows)), '[]'::jsonb))::integer as payload_bytes
  from tournament_rows
)
insert into organizer_scale_results (area, row_count, payload_bytes, elapsed_ms)
select
  'torneios' as area,
  tournament_payload.row_count,
  tournament_payload.payload_bytes,
  round(extract(epoch from (clock_timestamp() - started.value)) * 1000, 2) as elapsed_ms
from started cross join tournament_payload;

with started as materialized (
  select clock_timestamp() as value
), circuit_rows as materialized (
  select
    circuit.id,
    circuit.name,
    circuit.start_date,
    circuit.end_date,
    circuit.status,
    circuit.tournament_ids,
    circuit.ranking_criteria,
    circuit.ranking_criteria_mode,
    circuit.ranking_settings,
    circuit.updated_at,
    circuit.revision
  from public.circuits circuit
  where circuit.user_id = auth.uid()
  order by circuit.updated_at desc
), circuit_payload as materialized (
  select
    count(*)::integer as row_count,
    pg_column_size(coalesce(jsonb_agg(to_jsonb(circuit_rows)), '[]'::jsonb))::integer as payload_bytes
  from circuit_rows
)
insert into organizer_scale_results (area, row_count, payload_bytes, elapsed_ms)
select
  'circuitos' as area,
  circuit_payload.row_count,
  circuit_payload.payload_bytes,
  round(extract(epoch from (clock_timestamp() - started.value)) * 1000, 2) as elapsed_ms
from started cross join circuit_payload;

reset role;
select area, row_count, payload_bytes, elapsed_ms
from organizer_scale_results
order by area;
rollback;
