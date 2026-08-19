begin;

create or replace function public.count_completed_tournament_games(payload jsonb)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  with schedule_items as (
    select item
    from jsonb_array_elements(
      case when jsonb_typeof(payload->'schedule') = 'array' then payload->'schedule' else '[]'::jsonb end
    ) as schedule(item)
  ), schedule_games as (
    select game_data
    from schedule_items
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(item) = 'array' then item else '[]'::jsonb end
    ) as nested(game_data)
    union all
    select item
    from schedule_items
    where jsonb_typeof(item) = 'object'
  ), bracket_games as (
    select game_data
    from jsonb_array_elements(
      case when jsonb_typeof(payload->'brackets') = 'array' then payload->'brackets' else '[]'::jsonb end
    ) as brackets(game_data)
    where jsonb_typeof(game_data) = 'object'
  )
  select count(*)::integer
  from (
    select game_data from schedule_games
    union all
    select game_data from bracket_games
  ) games
  where nullif(game_data->>'s1', '') is not null
    and nullif(game_data->>'s2', '') is not null;
$$;

revoke all on function public.count_completed_tournament_games(jsonb) from public;

create or replace function public.count_tournament_games(payload jsonb)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  with schedule_items as (
    select item
    from jsonb_array_elements(
      case when jsonb_typeof(payload->'schedule') = 'array' then payload->'schedule' else '[]'::jsonb end
    ) as schedule(item)
  ), schedule_games as (
    select game_data
    from schedule_items
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(item) = 'array' then item else '[]'::jsonb end
    ) as nested(game_data)
    union all
    select item
    from schedule_items
    where jsonb_typeof(item) = 'object'
  )
  select
    (select count(*)::integer from schedule_games)
    + (
      select count(*)::integer
      from jsonb_array_elements(
        case when jsonb_typeof(payload->'brackets') = 'array' then payload->'brackets' else '[]'::jsonb end
      ) as brackets(game_data)
      where jsonb_typeof(game_data) = 'object'
    );
$$;

revoke all on function public.count_tournament_games(jsonb) from public;

create or replace function public.count_tournament_rounds(payload jsonb)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  with schedule_items as (
    select item
    from jsonb_array_elements(
      case when jsonb_typeof(payload->'schedule') = 'array' then payload->'schedule' else '[]'::jsonb end
    ) as schedule(item)
  )
  select case
    when exists (select 1 from schedule_items where jsonb_typeof(item) = 'array')
      then (select count(*)::integer from schedule_items where jsonb_typeof(item) = 'array')
    when exists (select 1 from schedule_items where jsonb_typeof(item) = 'object')
      then 1
    else 0
  end;
$$;

revoke all on function public.count_tournament_rounds(jsonb) from public;

create or replace function public.protect_tournament_critical_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_allowed boolean := coalesce(
    current_setting('torneio360.allow_tournament_critical_reset', true),
    'off'
  ) = 'on';
begin
  if old.data is distinct from new.data
    and not reset_allowed
    and (
      public.count_completed_tournament_games(old.data)
        > public.count_completed_tournament_games(new.data)
      or public.count_tournament_games(old.data)
        > public.count_tournament_games(new.data)
      or public.count_tournament_rounds(old.data)
        > public.count_tournament_rounds(new.data)
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'TOURNAMENT_CRITICAL_DATA_REGRESSION',
      detail = 'A atualização removeria placares, rodadas ou jogos já salvos.';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_tournament_critical_data() from public;

drop trigger if exists tournaments_protect_critical_data on public.tournaments;
create trigger tournaments_protect_critical_data
before update of data on public.tournaments
for each row
execute function public.protect_tournament_critical_data();

create or replace function public.save_tournament_snapshot_safe(
  p_tournament_id uuid,
  p_name text,
  p_type text,
  p_data jsonb,
  p_status text,
  p_last_change_id uuid default null,
  p_expected_revision bigint default null,
  p_expected_updated_at timestamptz default null,
  p_allow_critical_reset boolean default false
)
returns setof public.tournaments
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config(
    'torneio360.allow_tournament_critical_reset',
    case when p_allow_critical_reset then 'on' else 'off' end,
    true
  );

  return query
  update public.tournaments as tournament
  set
    name = p_name,
    type = p_type,
    data = coalesce(p_data, '{}'::jsonb),
    status = p_status,
    updated_at = clock_timestamp(),
    last_change_id = p_last_change_id
  where tournament.id = p_tournament_id
    and tournament.user_id = auth.uid()
    and (p_expected_revision is null or tournament.revision = p_expected_revision)
    and (p_expected_revision is not null or p_expected_updated_at is null or tournament.updated_at = p_expected_updated_at)
  returning tournament.*;
end;
$$;

revoke all on function public.save_tournament_snapshot_safe(uuid, text, text, jsonb, text, uuid, bigint, timestamptz, boolean)
  from public, anon;
grant execute on function public.save_tournament_snapshot_safe(uuid, text, text, jsonb, text, uuid, bigint, timestamptz, boolean)
  to authenticated;

comment on function public.save_tournament_snapshot_safe(uuid, text, text, jsonb, text, uuid, bigint, timestamptz, boolean) is
  'Grava um torneio com concorrência otimista e bloqueio atômico contra perda involuntária de placares, rodadas e jogos.';

commit;
