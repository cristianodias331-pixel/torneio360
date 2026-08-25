begin;

create table if not exists public.public_arena_snapshots (
  organizer_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table public.public_arena_snapshots enable row level security;
revoke all on table public.public_arena_snapshots from public, anon, authenticated;

-- Mantém uma versão sem cache para reconstruções controladas. A capa completa
-- do circuito continua fora do pacote inicial.
create or replace function public.build_public_arena_bundle_uncached(
  p_organizer_id uuid default null,
  p_public_id text default null
)
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
          circuit_item || jsonb_build_object(
            'ranking_settings', coalesce(circuit.ranking_settings, '{}'::jsonb) - 'coverImageUrl'
          )
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

revoke all on function public.build_public_arena_bundle_uncached(uuid, text)
  from public, anon, authenticated;

create or replace function public.refresh_public_arena_snapshot(p_organizer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  next_payload jsonb;
begin
  if p_organizer_id is null then return null; end if;

  next_payload := public.build_public_arena_bundle_uncached(p_organizer_id, null);
  insert into public.public_arena_snapshots (organizer_id, payload, refreshed_at)
  values (p_organizer_id, coalesce(next_payload, '{}'::jsonb), now())
  on conflict (organizer_id) do update set
    payload = excluded.payload,
    refreshed_at = excluded.refreshed_at;
  return next_payload;
end;
$$;

revoke all on function public.refresh_public_arena_snapshot(uuid)
  from public, anon, authenticated;

create or replace function public.get_public_arena_bundle(
  p_organizer_id uuid default null,
  p_public_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
  cached_payload jsonb;
begin
  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and tournament.is_public = true
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is null then
    return jsonb_build_object('profile', null, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  select snapshot.payload
  into cached_payload
  from public.public_arena_snapshots snapshot
  where snapshot.organizer_id = owner_id;

  if cached_payload is null then
    cached_payload := public.refresh_public_arena_snapshot(owner_id);
  end if;
  return coalesce(
    cached_payload,
    jsonb_build_object('profile', null, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_arena_bundle(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_bundle(uuid, text)
  to anon, authenticated;

create or replace function public.t360_public_tournament_directory_fingerprint(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select public.t360_public_tournament_summary_data(coalesce(p_data, '{}'::jsonb))
    || jsonb_build_object(
      'deletedAt', coalesce(p_data, '{}'::jsonb) -> 'deletedAt',
      'publishedOnProfile', coalesce(p_data, '{}'::jsonb) -> 'publishedOnProfile'
    );
$$;

revoke all on function public.t360_public_tournament_directory_fingerprint(jsonb)
  from public, anon, authenticated;

create or replace function public.refresh_arena_snapshot_after_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_op = 'UPDATE'
    and old.name is not distinct from new.name
    and old.type is not distinct from new.type
    and old.status is not distinct from new.status
    and old.public_id is not distinct from new.public_id
    and old.is_public is not distinct from new.is_public
    and public.t360_public_tournament_directory_fingerprint(old.data)
      is not distinct from public.t360_public_tournament_directory_fingerprint(new.data)
  then
    return new;
  end if;

  perform public.refresh_public_arena_snapshot(owner_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.refresh_arena_snapshot_after_circuit_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_op = 'UPDATE'
    and old.name is not distinct from new.name
    and old.start_date is not distinct from new.start_date
    and old.end_date is not distinct from new.end_date
    and old.status is not distinct from new.status
    and old.tournament_ids is not distinct from new.tournament_ids
    and old.ranking_criteria is not distinct from new.ranking_criteria
    and old.ranking_criteria_mode is not distinct from new.ranking_criteria_mode
    and old.ranking_settings is not distinct from new.ranking_settings
  then
    return new;
  end if;

  perform public.refresh_public_arena_snapshot(owner_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.refresh_arena_snapshot_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.refresh_public_arena_snapshot(coalesce(new.id, old.id));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tournaments_refresh_public_arena_snapshot on public.tournaments;
create trigger tournaments_refresh_public_arena_snapshot
after insert or delete or update of name, type, status, public_id, is_public, data
on public.tournaments
for each row execute function public.refresh_arena_snapshot_after_tournament_change();

drop trigger if exists circuits_refresh_public_arena_snapshot on public.circuits;
create trigger circuits_refresh_public_arena_snapshot
after insert or delete or update of name, start_date, end_date, status, tournament_ids,
  ranking_criteria, ranking_criteria_mode, ranking_settings
on public.circuits
for each row execute function public.refresh_arena_snapshot_after_circuit_change();

drop trigger if exists profiles_refresh_public_arena_snapshot on public.profiles;
create trigger profiles_refresh_public_arena_snapshot
after insert or delete or update of name, arena_name, city, state, photo_url, phone,
  address, maps_link, instagram_handle, instagram_link, whatsapp_group_link
on public.profiles
for each row execute function public.refresh_arena_snapshot_after_profile_change();

insert into public.public_arena_snapshots (organizer_id, payload, refreshed_at)
select
  profile.id,
  public.build_public_arena_bundle_uncached(profile.id, null),
  now()
from public.profiles profile
where public.t360_arena_directory_visible(profile.id)
on conflict (organizer_id) do update set
  payload = excluded.payload,
  refreshed_at = excluded.refreshed_at;

commit;
