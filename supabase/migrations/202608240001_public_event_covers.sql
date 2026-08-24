begin;

-- O perfil público continua leve: as imagens completas são carregadas somente
-- para os cartões que estão visíveis, sem trazer rodadas, chaves ou ranking.
create or replace function public.get_public_tournament_cover(p_public_id text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(
    nullif(tournament.data ->> 'eventCoverImageUrl', ''),
    nullif(tournament.data ->> 'coverImageUrl', ''),
    ''
  )
  from public.tournaments tournament
  where tournament.public_id = p_public_id
    and tournament.is_public = true
    and nullif(tournament.data ->> 'deletedAt', '') is null
    and public.t360_arena_directory_visible(tournament.user_id)
  limit 1;
$$;

create or replace function public.get_public_circuit_cover(p_circuit_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(nullif(circuit.ranking_settings ->> 'coverImageUrl', ''), '')
  from public.circuits circuit
  where circuit.id = p_circuit_id
    and nullif(circuit.ranking_settings ->> 'deletedAt', '') is null
    and public.t360_arena_directory_visible(circuit.user_id)
  limit 1;
$$;

revoke all on function public.get_public_tournament_cover(text) from public, anon, authenticated;
revoke all on function public.get_public_circuit_cover(uuid) from public, anon, authenticated;
grant execute on function public.get_public_tournament_cover(text) to anon, authenticated;
grant execute on function public.get_public_circuit_cover(uuid) to anon, authenticated;

-- A foto do circuito pode ser grande (Base64). Ela não participa do pacote
-- inicial; o frontend a solicita pelo RPC acima quando o cartão fica visível.
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

revoke all on function public.get_public_arena_bundle(uuid, text) from public, anon, authenticated;
grant execute on function public.get_public_arena_bundle(uuid, text) to anon, authenticated;

commit;
