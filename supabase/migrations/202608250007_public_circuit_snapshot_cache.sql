begin;

-- Conserva a implementação agregadora como construtor interno. A função
-- pública passa a ler o resultado pronto e só reconstrói após uma mudança.
alter function public.get_public_circuit(uuid)
  rename to build_public_circuit_uncached;

revoke all on function public.build_public_circuit_uncached(uuid)
  from public, anon, authenticated;

create table if not exists public.public_circuit_snapshots (
  circuit_id uuid primary key references public.circuits(id) on delete cascade,
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table public.public_circuit_snapshots enable row level security;
revoke all on table public.public_circuit_snapshots from public, anon, authenticated;

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
    delete from public.public_circuit_snapshots
    where circuit_id = p_circuit_id;
    return null;
  end if;

  insert into public.public_circuit_snapshots (circuit_id, payload, refreshed_at)
  values (p_circuit_id, next_payload, now())
  on conflict (circuit_id) do update set
    payload = excluded.payload,
    refreshed_at = excluded.refreshed_at;

  return next_payload;
end;
$$;

revoke all on function public.refresh_public_circuit_snapshot(uuid)
  from public, anon, authenticated;

create or replace function public.get_public_circuit(p_circuit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  cached_payload jsonb;
begin
  if p_circuit_id is null then return null; end if;

  select snapshot.payload
  into cached_payload
  from public.public_circuit_snapshots snapshot
  join public.circuits circuit on circuit.id = snapshot.circuit_id
  join public.profiles profile on profile.id = circuit.user_id
  join auth.users account on account.id = profile.id
  where snapshot.circuit_id = p_circuit_id
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
      'athlete', 'visitor', 'spectator'
    );

  if cached_payload is not null then return cached_payload; end if;

  -- Evita que vários visitantes reconstruam o mesmo circuito ao mesmo tempo.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public-circuit:' || p_circuit_id::text, 0)
  );

  select snapshot.payload
  into cached_payload
  from public.public_circuit_snapshots snapshot
  where snapshot.circuit_id = p_circuit_id;

  if cached_payload is null then
    cached_payload := public.refresh_public_circuit_snapshot(p_circuit_id);
  end if;
  return cached_payload;
end;
$$;

revoke all on function public.get_public_circuit(uuid) from public, anon, authenticated;
grant execute on function public.get_public_circuit(uuid) to anon, authenticated;

-- Circuitos e etapas alterados deixam somente o cache correspondente pendente.
create or replace function public.invalidate_public_circuit_snapshot_after_circuit_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed_id uuid;
begin
  changed_id := case when tg_op = 'DELETE' then old.id else new.id end;
  delete from public.public_circuit_snapshots
  where circuit_id = changed_id;
  return null;
end;
$$;

drop trigger if exists circuits_invalidate_public_snapshot on public.circuits;
create trigger circuits_invalidate_public_snapshot
after insert or update or delete on public.circuits
for each row execute function public.invalidate_public_circuit_snapshot_after_circuit_change();

create index if not exists circuits_tournament_ids_gin_idx
  on public.circuits using gin (tournament_ids);

create or replace function public.invalidate_public_circuit_snapshot_after_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed_id text;
begin
  changed_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  delete from public.public_circuit_snapshots snapshot
  using public.circuits circuit
  where snapshot.circuit_id = circuit.id
    and circuit.tournament_ids @> array[changed_id]::text[];
  return null;
end;
$$;

drop trigger if exists tournaments_invalidate_public_circuit_snapshot on public.tournaments;
create trigger tournaments_invalidate_public_circuit_snapshot
after insert or update or delete on public.tournaments
for each row execute function public.invalidate_public_circuit_snapshot_after_tournament_change();

-- O histórico é gravado em lotes. Uma invalidação por comando mantém a escrita
-- leve mesmo quando centenas de posições são recalculadas de uma só vez.
create or replace function public.invalidate_public_circuit_snapshot_after_ranking_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.public_circuit_snapshots snapshot
  using (select distinct circuit_id from inserted_rows) changed
  where snapshot.circuit_id = changed.circuit_id;
  return null;
end;
$$;

create or replace function public.invalidate_public_circuit_snapshot_after_ranking_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.public_circuit_snapshots snapshot
  using (select distinct circuit_id from deleted_rows) changed
  where snapshot.circuit_id = changed.circuit_id;
  return null;
end;
$$;

create or replace function public.invalidate_public_circuit_snapshot_after_ranking_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.public_circuit_snapshots snapshot
  using (
    select circuit_id from inserted_rows
    union
    select circuit_id from deleted_rows
  ) changed
  where snapshot.circuit_id = changed.circuit_id;
  return null;
end;
$$;

drop trigger if exists circuit_ranking_history_invalidate_public_snapshot_insert
  on public.circuit_ranking_history;
create trigger circuit_ranking_history_invalidate_public_snapshot_insert
after insert on public.circuit_ranking_history
referencing new table as inserted_rows
for each statement execute function public.invalidate_public_circuit_snapshot_after_ranking_insert();

drop trigger if exists circuit_ranking_history_invalidate_public_snapshot_delete
  on public.circuit_ranking_history;
create trigger circuit_ranking_history_invalidate_public_snapshot_delete
after delete on public.circuit_ranking_history
referencing old table as deleted_rows
for each statement execute function public.invalidate_public_circuit_snapshot_after_ranking_delete();

drop trigger if exists circuit_ranking_history_invalidate_public_snapshot_update
  on public.circuit_ranking_history;
create trigger circuit_ranking_history_invalidate_public_snapshot_update
after update on public.circuit_ranking_history
referencing old table as deleted_rows new table as inserted_rows
for each statement execute function public.invalidate_public_circuit_snapshot_after_ranking_update();

commit;
