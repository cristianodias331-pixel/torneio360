begin;

-- Enquanto uma versão anterior do front-end ainda estiver aberta ou publicada,
-- ela continua recebendo o pacote legado completo. A versão paginada chama
-- get_public_arena_overview e list_public_arena_events_page diretamente.
create or replace function public.get_public_arena_bundle(
  p_organizer_id uuid default null,
  p_public_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(
    public.build_public_arena_bundle_uncached(p_organizer_id, p_public_id),
    jsonb_build_object('profile', null, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_arena_bundle(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_public_arena_bundle(uuid, text)
  to anon, authenticated;

commit;
