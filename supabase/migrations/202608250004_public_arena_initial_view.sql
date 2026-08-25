begin;

-- A primeira tela pública precisa do resumo da arena e da primeira página de
-- torneios ativos. Entregar os dois blocos em um único RPC evita duas viagens
-- HTTP e não duplica o pico de conexões quando muitas pessoas abrem o perfil.
create or replace function public.get_public_arena_initial_view(
  p_organizer_id uuid default null,
  p_public_id text default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid := p_organizer_id;
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
    return jsonb_build_object(
      'bundle', jsonb_build_object(
        'profile', null,
        'counts', '{}'::jsonb,
        'pagination', jsonb_build_object('enabled', true, 'page_size', 8),
        'tournaments', '[]'::jsonb,
        'circuits', '[]'::jsonb
      ),
      'active_tournaments', jsonb_build_object(
        'items', '[]'::jsonb,
        'total', 0,
        'has_more', false,
        'next_offset', 0,
        'kind', 'tournaments',
        'status', 'active'
      )
    );
  end if;

  return jsonb_build_object(
    'bundle', public.get_public_arena_overview(owner_id, null),
    'active_tournaments', public.list_public_arena_events_page(
      owner_id,
      null,
      'tournaments',
      'active',
      greatest(1, least(coalesce(p_limit, 8), 24)),
      0
    )
  );
end;
$$;

revoke all on function public.get_public_arena_initial_view(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_initial_view(uuid, text, integer)
  to anon, authenticated;

comment on function public.get_public_arena_initial_view(uuid, text, integer) is
  'Entrega o resumo público da arena e a primeira página de torneios ativos em uma única chamada.';

commit;
