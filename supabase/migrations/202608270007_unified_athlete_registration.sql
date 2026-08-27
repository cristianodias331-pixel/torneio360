begin;

alter table public.tournament_registrations
  add column if not exists athlete_handle text not null default '';

update public.tournament_registrations registration
set athlete_handle = coalesce(member.handle, '')
from public.member_profiles member
where member.user_id = registration.athlete_user_id
  and registration.athlete_handle = '';

create index if not exists tournament_registrations_athlete_handle_idx
on public.tournament_registrations (lower(athlete_handle), tournament_id)
where athlete_handle <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_distinct_partner_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_distinct_partner_check
      check (partner_user_id is null or partner_user_id <> athlete_user_id);
  end if;
end;
$$;

create or replace function public.submit_tournament_registration(
  p_tournament_id uuid,
  p_athlete_name text,
  p_partner_name text default '',
  p_category text default ''
)
returns public.tournament_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  tournament_row public.tournaments%rowtype;
  registration_row public.tournament_registrations%rowtype;
  member_row public.member_profiles%rowtype;
  athlete_display_name text;
  athlete_unique_handle text;
  today_in_sao_paulo date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para se inscrever.' using errcode = '42501';
  end if;

  member_row := private.provision_member_profile(auth.uid());
  athlete_unique_handle := btrim(coalesce(member_row.handle, ''));
  athlete_display_name := coalesce(
    nullif(btrim(coalesce(member_row.display_name, '')), ''),
    nullif(btrim(coalesce(p_athlete_name, '')), ''),
    case when athlete_unique_handle <> '' then '@' || athlete_unique_handle else null end
  );

  if athlete_unique_handle = '' then
    raise exception 'Cadastre o endereço único (@) no seu perfil de atleta antes de se inscrever.' using errcode = '22023';
  end if;

  select * into tournament_row
  from public.tournaments
  where id = p_tournament_id and is_public = true;

  if not found or coalesce(tournament_row.data ->> 'deletedAt', '') <> '' then
    raise exception 'Torneio indisponível para inscrição.';
  end if;

  if coalesce(tournament_row.data ->> 'registrationDeadline', '') <> ''
    and (tournament_row.data ->> 'registrationDeadline')::date < today_in_sao_paulo then
    raise exception 'As inscrições deste torneio já foram encerradas.';
  end if;

  if coalesce(
      tournament_row.data ->> 'eventEndDate',
      tournament_row.data ->> 'eventDate',
      tournament_row.data ->> 'eventStartDate',
      ''
    ) <> ''
    and coalesce(
      tournament_row.data ->> 'eventEndDate',
      tournament_row.data ->> 'eventDate',
      tournament_row.data ->> 'eventStartDate'
    )::date < today_in_sao_paulo then
    raise exception 'Este torneio já foi encerrado.';
  end if;

  insert into public.tournament_registrations (
    tournament_id, athlete_user_id, athlete_name, athlete_handle, partner_name, category, status
  ) values (
    p_tournament_id,
    auth.uid(),
    athlete_display_name,
    athlete_unique_handle,
    btrim(coalesce(p_partner_name, '')),
    btrim(coalesce(p_category, '')),
    'pending'
  )
  on conflict (tournament_id, athlete_user_id) do update
    set athlete_name = case
          when public.tournament_registrations.status = 'confirmed'
            then public.tournament_registrations.athlete_name
          else excluded.athlete_name
        end,
        athlete_handle = excluded.athlete_handle,
        partner_name = case
          when public.tournament_registrations.status = 'confirmed'
            then public.tournament_registrations.partner_name
          else excluded.partner_name
        end,
        category = case
          when public.tournament_registrations.status = 'confirmed'
            then public.tournament_registrations.category
          else excluded.category
        end,
        status = case
          when public.tournament_registrations.status = 'confirmed' then 'confirmed'
          when public.tournament_registrations.status in ('rejected', 'cancelled') then 'pending'
          else public.tournament_registrations.status
        end,
        updated_at = case
          when public.tournament_registrations.status = 'confirmed'
            then public.tournament_registrations.updated_at
          else now()
        end
  returning * into registration_row;

  return registration_row;
end;
$$;

create or replace function public.prepare_my_tournament_registration(
  p_tournament_id uuid,
  p_athlete_name text,
  p_partner_name text default '',
  p_category text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  member_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para se inscrever.' using errcode = '42501';
  end if;

  member_row := private.provision_member_profile(auth.uid());
  select * into registration_row
  from public.submit_tournament_registration(
    p_tournament_id,
    coalesce(nullif(member_row.display_name, ''), p_athlete_name),
    p_partner_name,
    p_category
  );

  return jsonb_build_object(
    'registration', to_jsonb(registration_row),
    'athlete', jsonb_build_object(
      'user_id', member_row.user_id,
      'handle', member_row.handle,
      'display_name', member_row.display_name,
      'photo_url', member_row.photo_url,
      'sports_category', member_row.sports_category,
      'dominant_hand', member_row.dominant_hand,
      'city', member_row.city,
      'state', member_row.state
    )
  );
end;
$$;

create or replace function public.find_tournament_partner_by_handle(
  p_tournament_id uuid,
  p_handle text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized_handle text := lower(trim(leading '@' from btrim(coalesce(p_handle, ''))));
  partner_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = p_tournament_id and tournament.is_public = true
  ) then raise exception 'Torneio não encontrado.' using errcode = 'P0002'; end if;
  if normalized_handle = '' then return null; end if;

  select * into partner_row
  from public.member_profiles member
  where lower(coalesce(member.handle, '')) = normalized_handle
    and member.is_public = true
  limit 1;

  if partner_row.user_id is null then return null; end if;
  return jsonb_build_object(
    'user_id', partner_row.user_id,
    'handle', partner_row.handle,
    'display_name', partner_row.display_name,
    'photo_url', partner_row.photo_url,
    'sports_category', partner_row.sports_category,
    'city', partner_row.city,
    'state', partner_row.state,
    'is_self', partner_row.user_id = auth.uid()
  );
end;
$$;

create or replace function public.cancel_my_tournament_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para cancelar sua inscrição.' using errcode = '42501';
  end if;

  update public.tournament_registrations
  set status = 'cancelled', updated_at = now()
  where id = p_registration_id
    and athlete_user_id = auth.uid()
    and status <> 'confirmed';

  if not found then
    raise exception 'Inscrição não encontrada ou já confirmada.';
  end if;
end;
$$;

revoke all on function public.prepare_my_tournament_registration(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.find_tournament_partner_by_handle(uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_my_tournament_registration(uuid, text, text, text) to authenticated;
grant execute on function public.find_tournament_partner_by_handle(uuid, text) to authenticated;

commit;
