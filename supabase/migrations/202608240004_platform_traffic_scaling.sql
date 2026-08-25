begin;

-- A busca pública precisa continuar rápida quando o diretório crescer. O índice
-- acompanha exatamente a expressão usada pelo RPC abaixo e não altera perfis.
create extension if not exists pg_trgm;

create index if not exists profiles_public_directory_search_trgm_idx
  on public.profiles using gin (
    (lower(
      coalesce(arena_name, '') || ' ' ||
      coalesce(name, '') || ' ' ||
      coalesce(city, '') || ' ' ||
      coalesce(state, '')
    )) gin_trgm_ops
  );

create index if not exists profiles_public_directory_order_idx
  on public.profiles (
    (lower(coalesce(nullif(arena_name, ''), nullif(name, ''), 'arena'))),
    id
  );

create index if not exists tournaments_owner_created_idx
  on public.tournaments (user_id, created_at desc);

create index if not exists tournaments_owner_updated_idx
  on public.tournaments (user_id, updated_at desc);

create index if not exists circuits_owner_updated_idx
  on public.circuits (user_id, updated_at desc);

-- Paginação por cursor evita reler e transportar centenas de arenas em todo
-- acesso. O identificador desempata organizações com o mesmo nome.
drop function if exists public.list_public_arenas_page(text, integer, text, uuid);
create function public.list_public_arenas_page(
  p_search text default null,
  p_limit integer default 18,
  p_after_sort_name text default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  name text,
  arena_name text,
  city text,
  state text,
  photo_url text,
  has_photo boolean,
  phone text,
  address text,
  maps_link text,
  instagram_handle text,
  instagram_link text,
  whatsapp_group_link text,
  sort_name text
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  with visible_profiles as (
    select
      profile.*,
      lower(coalesce(nullif(profile.arena_name, ''), nullif(profile.name, ''), 'arena')) as directory_sort_name,
      lower(
        coalesce(profile.arena_name, '') || ' ' ||
        coalesce(profile.name, '') || ' ' ||
        coalesce(profile.city, '') || ' ' ||
        coalesce(profile.state, '')
      ) as directory_search_text
    from public.profiles profile
    where public.t360_arena_directory_visible(profile.id)
  )
  select
    profile.id,
    profile.name,
    profile.arena_name,
    profile.city,
    profile.state,
    case
      when coalesce(profile.photo_url, '') ~* '^https?://' then profile.photo_url
      else null
    end,
    nullif(profile.photo_url, '') is not null,
    profile.phone,
    profile.address,
    profile.maps_link,
    profile.instagram_handle,
    profile.instagram_link,
    profile.whatsapp_group_link,
    profile.directory_sort_name
  from visible_profiles profile
  where (
      nullif(trim(coalesce(p_search, '')), '') is null
      or profile.directory_search_text ilike '%' || lower(trim(p_search)) || '%'
    )
    and (
      nullif(coalesce(p_after_sort_name, ''), '') is null
      or p_after_id is null
      or (profile.directory_sort_name, profile.id) > (lower(p_after_sort_name), p_after_id)
    )
  order by profile.directory_sort_name, profile.id
  limit greatest(1, least(coalesce(p_limit, 18), 60));
$$;

revoke all on function public.list_public_arenas_page(text, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.list_public_arenas_page(text, integer, text, uuid)
  to anon, authenticated;

-- A tela pública pode conferir se um torneio mudou sem receber novamente todo
-- o JSON de rodadas, participantes e placares quando nada foi atualizado.
drop function if exists public.get_public_tournament_if_changed(text, timestamptz);
create function public.get_public_tournament_if_changed(
  p_public_id text,
  p_known_updated_at timestamptz default null
)
returns table (
  id uuid,
  name text,
  type text,
  data jsonb,
  public_id text,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    tournament.id,
    tournament.name,
    tournament.type,
    public.sanitize_public_tournament_data(tournament.id, tournament.data),
    tournament.public_id,
    tournament.is_public,
    tournament.created_at,
    tournament.updated_at
  from public.tournaments tournament
  where tournament.public_id = nullif(trim(p_public_id), '')
    and tournament.is_public = true
    and coalesce(tournament.data ->> 'deletedAt', '') = ''
    and (
      p_known_updated_at is null
      or tournament.updated_at is distinct from p_known_updated_at
    )
  limit 1;
$$;

revoke all on function public.get_public_tournament_if_changed(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_public_tournament_if_changed(text, timestamptz)
  to anon, authenticated;

commit;
