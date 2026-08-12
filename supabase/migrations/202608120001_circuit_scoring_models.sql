begin;

alter table public.circuits
  add column if not exists ranking_settings jsonb not null default '{"mode":"performance","identity":"individual","tieBreakMode":"cearense","tieBreakOrder":["wins","bestStage","titles"],"points":{"positions":[1000,800,670,500,400,330,250,200,170,140,120,100,80,60],"cup":{"champion":1000,"runnerUp":800,"third":670,"fourth":500,"semifinal":670,"quarterfinal":500,"round16":330,"round32":170,"groupStage":0}}}'::jsonb;

alter table public.circuit_ranking_history
  add column if not exists circuit_points integer not null default 0,
  add column if not exists placement_key text not null default '',
  add column if not exists placement_label text not null default '',
  add column if not exists titles integer not null default 0,
  add column if not exists runner_ups integer not null default 0,
  add column if not exists third_places integer not null default 0;

drop function if exists public.replace_circuit_ranking_history(uuid, jsonb, jsonb);
create function public.replace_circuit_ranking_history(
  p_circuit_id uuid,
  p_rows jsonb default '[]'::jsonb,
  p_source_versions jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  requested_count integer;
  inserted_count integer := 0;
  requested_source_count integer;
  validated_source_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not exists (select 1 from public.circuits where id = p_circuit_id and user_id = auth.uid()) then
    raise exception 'Circuito não encontrado para este organizador.';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then raise exception 'O histórico precisa ser uma lista.'; end if;
  if jsonb_typeof(coalesce(p_source_versions, '[]'::jsonb)) <> 'array' then raise exception 'As versões de origem precisam ser uma lista.'; end if;

  requested_count := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  requested_source_count := jsonb_array_length(coalesce(p_source_versions, '[]'::jsonb));
  select count(*) into validated_source_count
  from jsonb_to_recordset(coalesce(p_source_versions, '[]'::jsonb)) as source_version(tournament_id uuid, updated_at timestamptz)
  join public.tournaments tournament on tournament.id = source_version.tournament_id
    and tournament.user_id = auth.uid()
    and tournament.updated_at is not distinct from source_version.updated_at;
  if validated_source_count <> requested_source_count then raise exception 'Um torneio recebeu dados mais recentes; o ranking será recalculado.'; end if;

  delete from public.circuit_ranking_history where user_id = auth.uid() and circuit_id = p_circuit_id;
  insert into public.circuit_ranking_history (
    user_id, circuit_id, tournament_id, group_key, player_key, player_name,
    pts, w, bal, played, circuit_points, placement_key, placement_label,
    titles, runner_ups, third_places, updated_at
  )
  select
    auth.uid(), p_circuit_id, item.tournament_id, coalesce(nullif(item.group_key, ''), 'geral'),
    item.player_key, coalesce(nullif(item.player_name, ''), 'Sem nome'),
    coalesce(item.pts, 0), coalesce(item.w, 0), coalesce(item.bal, 0), coalesce(item.played, 0),
    coalesce(item.circuit_points, 0), coalesce(item.placement_key, ''), coalesce(item.placement_label, ''),
    coalesce(item.titles, 0), coalesce(item.runner_ups, 0), coalesce(item.third_places, 0),
    coalesce(item.updated_at, now())
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as item(
    tournament_id uuid, group_key text, player_key text, player_name text,
    pts integer, w integer, bal integer, played integer, circuit_points integer,
    placement_key text, placement_label text, titles integer, runner_ups integer,
    third_places integer, updated_at timestamptz
  )
  where item.tournament_id is not null and nullif(item.player_key, '') is not null
    and exists (select 1 from public.tournaments where id = item.tournament_id and user_id = auth.uid());
  get diagnostics inserted_count = row_count;
  if inserted_count <> requested_count then raise exception 'O histórico contém linhas que não pertencem a este organizador.'; end if;
  return inserted_count;
end;
$$;

revoke all on function public.replace_circuit_ranking_history(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_circuit_ranking_history(uuid, jsonb, jsonb) to authenticated;

-- Mantém toda a validação da função pública existente e acrescenta somente as
-- configurações do novo ranking a cada circuito retornado.
do $$
begin
  if to_regprocedure('public.get_public_arena_bundle_base(uuid,text)') is null then
    alter function public.get_public_arena_bundle(uuid, text) rename to get_public_arena_bundle_base;
  end if;
end;
$$;

create or replace function public.get_public_arena_bundle(p_organizer_id uuid default null, p_public_id text default null)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  with base as (
    select public.get_public_arena_bundle_base(p_organizer_id, p_public_id) as payload
  ), enriched as (
    select jsonb_set(
      base.payload,
      '{circuits}',
      coalesce((
        select jsonb_agg(
          circuit_item || jsonb_build_object('ranking_settings', circuit.ranking_settings)
          order by circuit_item ->> 'updated_at' desc
        )
        from jsonb_array_elements(coalesce(base.payload -> 'circuits', '[]'::jsonb)) circuit_item
        join public.circuits circuit on circuit.id::text = circuit_item ->> 'id'
      ), '[]'::jsonb),
      true
    ) as payload
    from base
  )
  select payload from enriched;
$$;

revoke all on function public.get_public_arena_bundle_base(uuid, text) from public, anon, authenticated;
revoke all on function public.get_public_arena_bundle(uuid, text) from public, anon, authenticated;
grant execute on function public.get_public_arena_bundle(uuid, text) to anon, authenticated;

commit;
