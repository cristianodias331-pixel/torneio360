begin;

alter table public.tournament_registrations
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid'));

create index if not exists tournament_registrations_owner_payment_idx
on public.tournament_registrations (tournament_id, payment_status, created_at desc);

create or replace function public.get_my_organization_registrations()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', registration.id,
      'athlete_user_id', registration.athlete_user_id,
      'athlete_name', registration.athlete_name,
      'partner_name', registration.partner_name,
      'category', registration.category,
      'registration_status', registration.status,
      'payment_status', registration.payment_status,
      'looking_for_partner', exists (
        select 1
        from public.athlete_partner_searches partner_search
        where partner_search.tournament_id = registration.tournament_id
          and partner_search.athlete_user_id = registration.athlete_user_id
          and partner_search.active = true
      ),
      'created_at', registration.created_at,
      'athlete', case when member.user_id is null then null else jsonb_build_object(
        'display_name', member.display_name,
        'handle', member.handle,
        'photo_url', member.photo_url
      ) end,
      'tournament', jsonb_build_object(
        'id', tournament.id,
        'name', tournament.name,
        'type', tournament.type,
        'data', tournament.data
      )
    ) order by tournament.created_at desc, registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    where tournament.user_id = auth.uid()
      and registration.status in ('pending', 'confirmed')
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_organization_registration_payment_status(
  p_registration_id uuid,
  p_payment_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
begin
  if auth.uid() is null or p_payment_status not in ('pending', 'paid') then
    raise exception 'Situação de pagamento inválida.' using errcode = '42501';
  end if;

  update public.tournament_registrations registration
  set payment_status = p_payment_status,
      updated_at = now()
  where registration.id = p_registration_id
    and exists (
      select 1
      from public.tournaments tournament
      where tournament.id = registration.tournament_id
        and tournament.user_id = auth.uid()
    )
  returning * into registration_row;

  if registration_row.id is null then
    raise exception 'Inscrição não encontrada para esta organização.' using errcode = 'P0002';
  end if;

  return to_jsonb(registration_row);
end;
$$;

revoke all on function public.get_my_organization_registrations() from public, anon, authenticated;
revoke all on function public.set_organization_registration_payment_status(uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_organization_registrations() to authenticated;
grant execute on function public.set_organization_registration_payment_status(uuid, text) to authenticated;

commit;
