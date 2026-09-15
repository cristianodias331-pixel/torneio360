begin;

-- Impede que um formulário antigo volte a vincular torneios removidos.
-- Mantém a ordem e não altera configurações ou resultados de outras etapas.
create or replace function public.prune_removed_circuit_tournament_links()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.tournament_ids := array(
    select linked.id
    from unnest(coalesce(new.tournament_ids, '{}'::text[])) with ordinality as linked(id, position)
    where exists (
      select 1 from public.tournaments tournament
      where tournament.id::text = linked.id
        and tournament.user_id = new.user_id
        and coalesce(tournament.data->>'deletedAt', '') = ''
    )
    order by linked.position
  );
  return new;
end;
$$;

revoke all on function public.prune_removed_circuit_tournament_links() from public, anon, authenticated;

drop trigger if exists circuits_prune_removed_tournament_links on public.circuits;
create trigger circuits_prune_removed_tournament_links
before insert or update of tournament_ids on public.circuits
for each row execute function public.prune_removed_circuit_tournament_links();

-- Lixeira e exclusão definitiva atualizam todos os circuitos na mesma
-- transação. Não depende de uma segunda gravação feita pelo navegador.
create or replace function public.remove_tournament_from_circuits()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if coalesce(new.data->>'deletedAt', '') = ''
      or coalesce(old.data->>'deletedAt', '') <> '' then
      return new;
    end if;
  end if;

  delete from public.circuit_ranking_history
  where tournament_id = old.id and user_id = old.user_id;

  update public.circuits
  set tournament_ids = array_remove(tournament_ids, old.id::text),
      updated_at = now()
  where user_id = old.user_id
    and tournament_ids @> array[old.id::text];

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.remove_tournament_from_circuits() from public, anon, authenticated;

drop trigger if exists tournaments_remove_from_circuits on public.tournaments;
create trigger tournaments_remove_from_circuits
after delete or update of data on public.tournaments
for each row execute function public.remove_tournament_from_circuits();

-- Repara os vínculos antigos que já ficaram para trás. Só grava circuitos
-- que contêm uma referência inválida; os demais permanecem intocados.
update public.circuits circuit
set tournament_ids = circuit.tournament_ids,
    updated_at = now()
where exists (
  select 1 from unnest(coalesce(circuit.tournament_ids, '{}'::text[])) linked(id)
  where not exists (
    select 1 from public.tournaments tournament
    where tournament.id::text = linked.id
      and tournament.user_id = circuit.user_id
      and coalesce(tournament.data->>'deletedAt', '') = ''
  )
);

-- A FK já retira o histórico de exclusões definitivas. Aqui aplica a mesma
-- regra às etapas que ainda estão na lixeira, sem tocar em etapas válidas.
delete from public.circuit_ranking_history history
using public.tournaments tournament
where history.tournament_id = tournament.id
  and history.user_id = tournament.user_id
  and coalesce(tournament.data->>'deletedAt', '') <> '';

commit;
