begin;

alter function public.get_public_arena_initial_view(uuid, text, integer)
  rename to build_public_arena_initial_view_uncached;

revoke all on function public.build_public_arena_initial_view_uncached(uuid, text, integer)
  from public, anon, authenticated;

create table if not exists public.public_arena_initial_snapshots (
  organizer_id uuid primary key references auth.users(id) on delete cascade,
  page_limit integer not null,
  time_bucket timestamptz not null,
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table public.public_arena_initial_snapshots enable row level security;
revoke all on table public.public_arena_initial_snapshots from public, anon, authenticated;

create or replace function public.refresh_public_arena_initial_snapshot(
  p_organizer_id uuid,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
  current_bucket timestamptz := date_trunc('minute', statement_timestamp());
  next_payload jsonb;
begin
  if p_organizer_id is null then return null; end if;

  next_payload := public.build_public_arena_initial_view_uncached(
    p_organizer_id,
    null,
    requested_limit
  );

  insert into public.public_arena_initial_snapshots (
    organizer_id,
    page_limit,
    time_bucket,
    payload,
    refreshed_at
  ) values (
    p_organizer_id,
    requested_limit,
    current_bucket,
    next_payload,
    now()
  )
  on conflict (organizer_id) do update set
    page_limit = excluded.page_limit,
    time_bucket = excluded.time_bucket,
    payload = excluded.payload,
    refreshed_at = excluded.refreshed_at;

  return next_payload;
end;
$$;

revoke all on function public.refresh_public_arena_initial_snapshot(uuid, integer)
  from public, anon, authenticated;

create or replace function public.get_public_arena_initial_view(
  p_organizer_id uuid default null,
  p_public_id text default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
  requested_limit integer := greatest(1, least(coalesce(p_limit, 8), 24));
  current_bucket timestamptz := date_trunc('minute', statement_timestamp());
  cached_payload jsonb;
begin
  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is null then
    return public.build_public_arena_initial_view_uncached(null, null, requested_limit);
  end if;

  select snapshot.payload
  into cached_payload
  from public.public_arena_initial_snapshots snapshot
  join public.profiles profile on profile.id = snapshot.organizer_id
  join auth.users account on account.id = profile.id
  where snapshot.organizer_id = owner_id
    and snapshot.page_limit = requested_limit
    and snapshot.time_bucket = current_bucket
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
      'athlete', 'visitor', 'spectator'
    );

  if cached_payload is not null then return cached_payload; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public-arena-initial:' || owner_id::text, 0)
  );

  select snapshot.payload
  into cached_payload
  from public.public_arena_initial_snapshots snapshot
  where snapshot.organizer_id = owner_id
    and snapshot.page_limit = requested_limit
    and snapshot.time_bucket = current_bucket;

  if cached_payload is null then
    cached_payload := public.refresh_public_arena_initial_snapshot(owner_id, requested_limit);
  end if;
  return cached_payload;
end;
$$;

revoke all on function public.get_public_arena_initial_view(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_initial_view(uuid, text, integer)
  to anon, authenticated;

create or replace function public.invalidate_public_arena_initial_snapshot_after_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  delete from public.public_arena_initial_snapshots
  where organizer_id = owner_id;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    delete from public.public_arena_initial_snapshots
    where organizer_id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists tournaments_invalidate_public_arena_initial_snapshot
  on public.tournaments;
create trigger tournaments_invalidate_public_arena_initial_snapshot
after insert or update or delete on public.tournaments
for each row execute function public.invalidate_public_arena_initial_snapshot_after_tournament_change();

create or replace function public.invalidate_public_arena_initial_snapshot_after_circuit_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid;
begin
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  delete from public.public_arena_initial_snapshots
  where organizer_id = owner_id;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    delete from public.public_arena_initial_snapshots
    where organizer_id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists circuits_invalidate_public_arena_initial_snapshot
  on public.circuits;
create trigger circuits_invalidate_public_arena_initial_snapshot
after insert or update or delete on public.circuits
for each row execute function public.invalidate_public_arena_initial_snapshot_after_circuit_change();

create or replace function public.invalidate_public_arena_initial_snapshot_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.public_arena_initial_snapshots
  where organizer_id = case when tg_op = 'DELETE' then old.id else new.id end;
  return null;
end;
$$;

drop trigger if exists profiles_invalidate_public_arena_initial_snapshot
  on public.profiles;
create trigger profiles_invalidate_public_arena_initial_snapshot
after insert or update or delete on public.profiles
for each row execute function public.invalidate_public_arena_initial_snapshot_after_profile_change();

commit;
