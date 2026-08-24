begin;

-- Em eventos com várias categorias, somente a foto geral representa o grupo
-- no perfil público. A foto própria de cada categoria permanece exclusiva da
-- página daquele torneio e nunca é promovida automaticamente a foto geral.
create or replace function public.get_public_tournament_cover(p_public_id text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select case
    when coalesce(tournament.data ->> 'multiCategoryEvent', 'false') = 'true'
      then coalesce(nullif(tournament.data ->> 'eventCoverImageUrl', ''), '')
    else coalesce(nullif(tournament.data ->> 'coverImageUrl', ''), '')
  end
  from public.tournaments tournament
  where tournament.public_id = p_public_id
    and tournament.is_public = true
    and nullif(tournament.data ->> 'deletedAt', '') is null
    and public.t360_arena_directory_visible(tournament.user_id)
  limit 1;
$$;

revoke all on function public.get_public_tournament_cover(text) from public, anon, authenticated;
grant execute on function public.get_public_tournament_cover(text) to anon, authenticated;

commit;
