begin;

create or replace function public.t360_search_normalize(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select btrim(regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.search_public_platform(
  p_query text,
  p_limit_per_kind integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized_query text := public.t360_search_normalize(p_query);
  safe_limit integer := greatest(1, least(coalesce(p_limit_per_kind, 12), 24));
  result_payload jsonb;
begin
  if char_length(normalized_query) < 2 then
    return jsonb_build_object(
      'tournaments', '[]'::jsonb,
      'accounts', '[]'::jsonb,
      'circuits', '[]'::jsonb,
      'locations', '[]'::jsonb,
      'cities', '[]'::jsonb
    );
  end if;

  with tournament_matches as (
    select
      tournament.id,
      tournament.public_id,
      tournament.name,
      tournament.type,
      tournament.status,
      coalesce(
        nullif(tournament.data ->> 'venue', ''),
        nullif(tournament.data ->> 'location', ''),
        nullif(tournament.data ->> 'arenaName', ''),
        nullif(tournament.data ->> 'eventLocation', ''),
        nullif(organization.address, ''),
        nullif(concat_ws('/', organization.city, organization.state), '')
      ) as location,
      organization.city,
      organization.state,
      organization.id as organization_id,
      coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização') as organization_name,
      case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end as organization_photo_url,
      coalesce(tournament.updated_at, tournament.created_at) as updated_at,
      case when public.t360_search_normalize(tournament.name) like normalized_query || '%' then 0 else 1 end as sort_rank
    from public.tournaments tournament
    join public.profiles organization on organization.id = tournament.user_id
    join auth.users organization_account on organization_account.id = tournament.user_id
    where tournament.is_public = true
      and tournament.public_id is not null
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
      and organization.is_public = true
      and organization_account.email_confirmed_at is not null
      and public.t360_search_normalize(concat_ws(' ',
        tournament.name,
        tournament.type,
        tournament.data ->> 'modalityName',
        tournament.data ->> 'modality',
        tournament.data ->> 'category',
        tournament.data ->> 'venue',
        tournament.data ->> 'location',
        tournament.data ->> 'arenaName',
        tournament.data ->> 'eventLocation',
        organization.arena_name,
        organization.name,
        organization.address,
        organization.city,
        organization.state
      )) like '%' || normalized_query || '%'
    order by sort_rank, coalesce(tournament.updated_at, tournament.created_at) desc, tournament.id
    limit safe_limit
  ), athlete_accounts as (
    select
      member.user_id as id,
      'athlete'::text as account_kind,
      member.display_name as name,
      member.handle,
      member.photo_url,
      member.bio as description,
      member.city,
      member.state,
      case when public.t360_search_normalize(member.display_name) like normalized_query || '%'
        or public.t360_search_normalize(member.handle) like normalized_query || '%'
        then 0 else 1 end as sort_rank
    from public.member_profiles member
    join auth.users account on account.id = member.user_id
    where member.is_public = true
      and account.email_confirmed_at is not null
      and public.t360_search_normalize(concat_ws(' ',
        member.display_name,
        member.handle,
        member.bio,
        member.city,
        member.state
      )) like '%' || normalized_query || '%'
  ), organization_accounts as (
    select
      organization.id,
      'organization'::text as account_kind,
      coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização') as name,
      null::text as handle,
      case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end as photo_url,
      organization.name as description,
      organization.city,
      organization.state,
      case when public.t360_search_normalize(coalesce(organization.arena_name, organization.name)) like normalized_query || '%'
        then 0 else 1 end as sort_rank
    from public.profiles organization
    where public.t360_arena_directory_visible(organization.id)
      and public.t360_search_normalize(concat_ws(' ',
        organization.arena_name,
        organization.name,
        organization.address,
        organization.city,
        organization.state
      )) like '%' || normalized_query || '%'
  ), account_matches as (
    select *
    from (
      select * from athlete_accounts
      union all
      select * from organization_accounts
    ) accounts
    order by sort_rank, public.t360_search_normalize(name), id
    limit safe_limit
  ), circuit_matches as (
    select
      circuit.id,
      circuit.name,
      circuit.start_date,
      circuit.end_date,
      case when circuit.end_date is not null
        and circuit.end_date < (statement_timestamp() at time zone 'America/Sao_Paulo')::date
        then 'finished' else 'active' end as status,
      cardinality(coalesce(circuit.tournament_ids, '{}'::text[])) as tournament_count,
      organization.id as organization_id,
      coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Organização') as organization_name,
      case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end as organization_photo_url,
      organization.city,
      organization.state,
      case when public.t360_search_normalize(circuit.name) like normalized_query || '%' then 0 else 1 end as sort_rank
    from public.circuits circuit
    join public.profiles organization on organization.id = circuit.user_id
    where public.t360_arena_directory_visible(circuit.user_id)
      and public.t360_search_normalize(concat_ws(' ',
        circuit.name,
        organization.arena_name,
        organization.name,
        organization.city,
        organization.state
      )) like '%' || normalized_query || '%'
    order by sort_rank, circuit.updated_at desc, circuit.id
    limit safe_limit
  ), location_matches as (
    select
      organization.id,
      coalesce(nullif(btrim(organization.arena_name), ''), nullif(btrim(organization.name), ''), 'Local') as name,
      organization.address,
      organization.city,
      organization.state,
      organization.maps_link,
      case when coalesce(organization.photo_url, '') ~* '^https?://' then organization.photo_url else '' end as photo_url,
      case when public.t360_search_normalize(coalesce(organization.arena_name, organization.name)) like normalized_query || '%'
        then 0 else 1 end as sort_rank
    from public.profiles organization
    where public.t360_arena_directory_visible(organization.id)
      and public.t360_search_normalize(concat_ws(' ',
        organization.arena_name,
        organization.name,
        organization.address,
        organization.city,
        organization.state
      )) like '%' || normalized_query || '%'
    order by sort_rank, public.t360_search_normalize(coalesce(organization.arena_name, organization.name)), organization.id
    limit safe_limit
  ), city_sources as (
    select organization.city, organization.state, 'organization'::text as source_kind
    from public.profiles organization
    where public.t360_arena_directory_visible(organization.id)
      and nullif(btrim(organization.city), '') is not null
    union all
    select member.city, member.state, 'athlete'::text as source_kind
    from public.member_profiles member
    join auth.users account on account.id = member.user_id
    where member.is_public = true
      and account.email_confirmed_at is not null
      and nullif(btrim(member.city), '') is not null
  ), city_matches as (
    select
      min(city) as city,
      min(state) as state,
      count(*)::integer as account_count,
      count(*) filter (where source_kind = 'organization')::integer as organization_count,
      count(*) filter (where source_kind = 'athlete')::integer as athlete_count,
      case when public.t360_search_normalize(min(city)) like normalized_query || '%' then 0 else 1 end as sort_rank
    from city_sources
    where public.t360_search_normalize(concat_ws(' ', city, state)) like '%' || normalized_query || '%'
    group by public.t360_search_normalize(city), public.t360_search_normalize(state)
    order by sort_rank, public.t360_search_normalize(min(city))
    limit safe_limit
  )
  select jsonb_build_object(
    'tournaments', coalesce((select jsonb_agg(to_jsonb(item) - 'sort_rank' order by item.sort_rank, item.updated_at desc, item.id) from tournament_matches item), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(to_jsonb(item) - 'sort_rank' order by item.sort_rank, public.t360_search_normalize(item.name), item.id) from account_matches item), '[]'::jsonb),
    'circuits', coalesce((select jsonb_agg(to_jsonb(item) - 'sort_rank' order by item.sort_rank, item.name, item.id) from circuit_matches item), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(to_jsonb(item) - 'sort_rank' order by item.sort_rank, item.name, item.id) from location_matches item), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(to_jsonb(item) - 'sort_rank' order by item.sort_rank, item.city, item.state) from city_matches item), '[]'::jsonb)
  ) into result_payload;

  return coalesce(result_payload, jsonb_build_object(
    'tournaments', '[]'::jsonb,
    'accounts', '[]'::jsonb,
    'circuits', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'cities', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.t360_search_normalize(text) from public, anon, authenticated;
revoke all on function public.search_public_platform(text, integer) from public, anon, authenticated;
grant execute on function public.search_public_platform(text, integer) to anon, authenticated;

commit;
