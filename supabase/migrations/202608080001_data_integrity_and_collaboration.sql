begin;

-- Substitui todo o histórico derivado de um circuito dentro de uma única
-- transação. Se qualquer linha for inválida, o histórico anterior permanece.
drop function if exists public.replace_circuit_ranking_history(uuid, jsonb);

create or replace function public.replace_circuit_ranking_history(
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
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if not exists (
    select 1
    from public.circuits circuit
    where circuit.id = p_circuit_id
      and circuit.user_id = auth.uid()
  ) then
    raise exception 'Circuito não encontrado para este organizador.';
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'O histórico precisa ser uma lista.';
  end if;

  if jsonb_typeof(coalesce(p_source_versions, '[]'::jsonb)) <> 'array' then
    raise exception 'As versões de origem precisam ser uma lista.';
  end if;

  requested_count := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  requested_source_count := jsonb_array_length(coalesce(p_source_versions, '[]'::jsonb));

  select count(*)
  into validated_source_count
  from jsonb_to_recordset(coalesce(p_source_versions, '[]'::jsonb)) as source_version(
    tournament_id uuid,
    updated_at timestamp with time zone
  )
  join public.tournaments tournament
    on tournament.id = source_version.tournament_id
   and tournament.user_id = auth.uid()
   and tournament.updated_at is not distinct from source_version.updated_at;

  if validated_source_count <> requested_source_count then
    raise exception 'Um torneio recebeu dados mais recentes; o ranking será recalculado.';
  end if;

  delete from public.circuit_ranking_history history
  where history.user_id = auth.uid()
    and history.circuit_id = p_circuit_id;

  insert into public.circuit_ranking_history (
    user_id,
    circuit_id,
    tournament_id,
    group_key,
    player_key,
    player_name,
    pts,
    w,
    bal,
    played,
    updated_at
  )
  select
    auth.uid(),
    p_circuit_id,
    item.tournament_id,
    coalesce(nullif(item.group_key, ''), 'geral'),
    item.player_key,
    coalesce(nullif(item.player_name, ''), 'Sem nome'),
    coalesce(item.pts, 0),
    coalesce(item.w, 0),
    coalesce(item.bal, 0),
    coalesce(item.played, 0),
    coalesce(item.updated_at, now())
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as item(
    tournament_id uuid,
    group_key text,
    player_key text,
    player_name text,
    pts integer,
    w integer,
    bal integer,
    played integer,
    updated_at timestamp with time zone
  )
  where item.tournament_id is not null
    and nullif(item.player_key, '') is not null
    and exists (
      select 1
      from public.tournaments tournament
      where tournament.id = item.tournament_id
        and tournament.user_id = auth.uid()
    );

  get diagnostics inserted_count = row_count;

  if inserted_count <> requested_count then
    raise exception 'O histórico contém linhas que não pertencem a este organizador.';
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.replace_circuit_ranking_history(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_circuit_ranking_history(uuid, jsonb, jsonb) to authenticated;

-- Salva a ordem e o indicador de ordenação manual no mesmo UPDATE. Assim não
-- existe estado parcial caso a conexão caia no meio da reorganização.
create or replace function public.set_tournament_order_safe(p_tournament_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  updated_count integer := 0;
  requested_count integer := cardinality(coalesce(p_tournament_ids, '{}'::uuid[]));
begin
  update public.tournaments as tournament
  set data = jsonb_set(
    jsonb_set(
      coalesce(tournament.data, '{}'::jsonb),
      '{displayOrder}',
      to_jsonb((ordered_item.ordinality - 1)::integer),
      true
    ),
    '{displayOrderMode}',
    '"manual"'::jsonb,
    true
  )
  from unnest(coalesce(p_tournament_ids, '{}'::uuid[]))
    with ordinality as ordered_item(id, ordinality)
  where tournament.id = ordered_item.id
    and tournament.user_id = auth.uid()
    and coalesce(tournament.data ->> 'deletedAt', '') = '';

  get diagnostics updated_count = row_count;

  if updated_count <> requested_count then
    raise exception 'Não foi possível validar todos os torneios da nova ordem.';
  end if;

  return updated_count;
end;
$$;

revoke all on function public.set_tournament_order_safe(uuid[]) from public, anon;
grant execute on function public.set_tournament_order_safe(uuid[]) to authenticated;

-- Habilita avisos em tempo real para que celulares e computadores conectados
-- ao mesmo perfil recebam alterações sem depender apenas da atualização manual.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['tournaments', 'circuits', 'profiles', 'circuit_ranking_history']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

commit;
