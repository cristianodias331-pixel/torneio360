begin;
create extension if not exists pgcrypto;
create or replace function public.profile_has_active_access(
  p_status text,
  p_expires_at text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  expiry_date date;
  today_in_sao_paulo date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if lower(coalesce(p_status, '')) <> 'active' then
    return false;
  end if;

  if nullif(p_expires_at, '') is null then
    return true;
  end if;

  begin
    expiry_date := case
      when p_expires_at ~ '^\d{4}-\d{2}-\d{2}$'
        then p_expires_at::date
      else (p_expires_at::timestamptz at time zone 'America/Sao_Paulo')::date
    end;
  exception when others then
    return false;
  end;

  return expiry_date >= today_in_sao_paulo;
end;
$$;
revoke all on function public.profile_has_active_access(text, text) from public, anon, authenticated;
-- A função da conta fica no app_metadata do JWT. Diferentemente de
-- user_metadata, o usuário não consegue promover a própria conta.
create or replace function public.current_account_role()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  authoritative_role text;
  profile_status text;
  profile_expires_at text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select
    account.raw_app_meta_data ->> 'role',
    profile.status,
    to_jsonb(profile) ->> 'expires_at'
  into authoritative_role, profile_status, profile_expires_at
  from auth.users account
  left join public.profiles profile on profile.id = account.id
  where account.id = auth.uid();

  if not found then
    return null;
  end if;

  if authoritative_role = 'athlete' then
    return 'athlete';
  end if;

  if authoritative_role is null
    or authoritative_role not in ('organizer', 'organizer_pending') then
    return null;
  end if;

  if not public.profile_has_active_access(profile_status, profile_expires_at) then
    return 'organizer_pending';
  end if;

  return 'organizer';
end;
$$;
revoke all on function public.current_account_role() from public, anon, authenticated;
grant execute on function public.current_account_role() to authenticated;
-- Contas antigas são organizadores. Contas de atleta criadas durante a
-- transição já carregam account_type=athlete no metadata solicitado.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  case
    when raw_user_meta_data ->> 'account_type' = 'athlete' then 'athlete'
    else 'organizer'
  end
)
where coalesce(raw_app_meta_data ->> 'role', '') not in ('athlete', 'organizer', 'organizer_pending');
create or replace function public.assign_account_role_on_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'athlete' then 'athlete'
    else 'organizer_pending'
  end;
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', requested_role);
  return new;
end;
$$;
drop trigger if exists torneio360_assign_account_role on auth.users;
create trigger torneio360_assign_account_role
before insert on auth.users
for each row execute function public.assign_account_role_on_signup();
revoke all on function public.assign_account_role_on_signup() from public, anon, authenticated;
-- A tabela profiles continua reservada ao diretório de arenas. Caso o trigger
-- legado crie uma linha também para atletas, ela nunca será publicada ali.
create or replace function public.keep_athletes_out_of_organizer_directory()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  account_role text;
  profile_status text;
  profile_expires_at text;
begin
  select coalesce(raw_app_meta_data ->> 'role', '')
  into account_role
  from auth.users
  where id = new.id;

  profile_status := to_jsonb(new) ->> 'status';
  profile_expires_at := to_jsonb(new) ->> 'expires_at';

  if account_role is null
    or account_role not in ('organizer', 'organizer_pending')
    or not public.profile_has_active_access(profile_status, profile_expires_at) then
    new.is_public := false;
  end if;
  return new;
end;
$$;
drop trigger if exists torneio360_keep_athletes_out_of_arenas on public.profiles;
create trigger torneio360_keep_athletes_out_of_arenas
before insert or update on public.profiles
for each row execute function public.keep_athletes_out_of_organizer_directory();
revoke all on function public.keep_athletes_out_of_organizer_directory() from public, anon, authenticated;
update public.profiles profile
set is_public = false
from auth.users account
where account.id = profile.id
  and (
    coalesce(account.raw_app_meta_data ->> 'role', '') not in ('organizer', 'organizer_pending')
    or not public.profile_has_active_access(
      profile.status,
      to_jsonb(profile) ->> 'expires_at'
    )
  );
-- Somente o backend pode alterar os campos que liberam o painel pago. O dono
-- ainda pode editar nome, foto, contato e visibilidade normalmente.
create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() = old.id
    and coalesce(auth.role(), '') = 'authenticated'
    and coalesce(current_setting('torneio360.allow_access_update', true), '') <> 'on' then
    new.status := old.status;
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;
drop trigger if exists torneio360_protect_profile_access on public.profiles;
create trigger torneio360_protect_profile_access
before update on public.profiles
for each row execute function public.protect_profile_access_fields();
-- Reconcilia o perfil do organizador após a confirmação do e-mail. Contas de
-- atleta nunca passam por este caminho e não recebem acesso administrativo.
-- A versão legada retornava void. PostgreSQL exige remover a assinatura antiga
-- antes de recriá-la com o retorno estruturado usado pelo frontend atual.
drop function if exists public.reconcile_my_profile();
create or replace function public.reconcile_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  account_row auth.users%rowtype;
  profile_row public.profiles%rowtype;
  account_role text;
  profile_name text;
  trial_expiry date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date + 7;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select * into account_row from auth.users where id = auth.uid();
  if not found then
    raise exception 'Conta não encontrada.';
  end if;

  account_role := coalesce(account_row.raw_app_meta_data ->> 'role', '');
  if account_role not in ('organizer', 'organizer_pending') then
    raise exception 'Esta conta não é de organizador.';
  end if;

  profile_name := left(trim(coalesce(
    account_row.raw_user_meta_data ->> 'name',
    account_row.raw_user_meta_data ->> 'full_name',
    split_part(account_row.email, '@', 1),
    'Organizador'
  )), 120);

  perform set_config('torneio360.allow_access_update', 'on', true);
  select * into profile_row from public.profiles where id = auth.uid() for update;

  if not found then
    insert into public.profiles (id, name, status, expires_at, is_public)
    values (
      auth.uid(),
      profile_name,
      case when account_row.email_confirmed_at is null then 'pending' else 'active' end,
      case when account_row.email_confirmed_at is null then null else trial_expiry end,
      false
    )
    returning * into profile_row;
  elsif account_row.email_confirmed_at is not null
    and lower(coalesce(profile_row.status::text, '')) = 'pending'
    and profile_row.expires_at is null then
    update public.profiles
    set status = 'active', expires_at = trial_expiry
    where id = auth.uid()
    returning * into profile_row;
  end if;

  return to_jsonb(profile_row);
end;
$$;
revoke all on function public.reconcile_my_profile() from public;
grant execute on function public.reconcile_my_profile() to authenticated;
create table if not exists public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  photo_url text not null default '',
  bio text not null default '' check (char_length(bio) <= 240),
  is_public boolean not null default true,
  show_achievements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.athlete_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists display_name text not null default '',
  add column if not exists photo_url text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists is_public boolean not null default true,
  add column if not exists show_achievements boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.athlete_profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.athlete_profiles
      add constraint athlete_profiles_pkey primary key (user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.athlete_profiles'::regclass
      and conname in ('athlete_profiles_bio_check', 'athlete_profiles_bio_length_check')
  ) then
    alter table public.athlete_profiles
      add constraint athlete_profiles_bio_length_check
      check (char_length(bio) <= 240);
  end if;
end;
$$;
alter table public.athlete_profiles enable row level security;
revoke insert, update, delete on public.athlete_profiles from public, anon, authenticated;
grant select on public.athlete_profiles to anon, authenticated;
grant insert, update on public.athlete_profiles to authenticated;
drop policy if exists athlete_profiles_public_read on public.athlete_profiles;
create policy athlete_profiles_public_read
on public.athlete_profiles for select
to anon, authenticated
using (is_public or user_id = auth.uid());
drop policy if exists athlete_profiles_owner_insert on public.athlete_profiles;
create policy athlete_profiles_owner_insert
on public.athlete_profiles for insert
to authenticated
with check (user_id = auth.uid() and public.current_account_role() = 'athlete');
drop policy if exists athlete_profiles_owner_update on public.athlete_profiles;
create policy athlete_profiles_owner_update
on public.athlete_profiles for update
to authenticated
using (user_id = auth.uid() and public.current_account_role() = 'athlete')
with check (user_id = auth.uid() and public.current_account_role() = 'athlete');
-- Convites de vínculo são persistidos no servidor. O UUID funciona como segredo
-- de posse do convite, mas nenhuma leitura/escrita direta é concedida à tabela.
create table if not exists public.athlete_link_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  participant_path jsonb not null default '{}'::jsonb,
  athlete_index smallint not null default 0,
  athlete_name text not null default '',
  athlete_user_id uuid references auth.users(id) on delete set null,
  public_consent boolean not null default false,
  claimed_at timestamptz,
  acknowledged_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.athlete_link_requests
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade,
  add column if not exists organizer_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists participant_path jsonb not null default '{}'::jsonb,
  add column if not exists athlete_index smallint not null default 0,
  add column if not exists athlete_name text not null default '',
  add column if not exists athlete_user_id uuid references auth.users(id) on delete set null,
  add column if not exists public_consent boolean not null default false,
  add column if not exists claimed_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists expires_at timestamptz not null default (now() + interval '1 day'),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.athlete_link_requests'::regclass
      and contype = 'p'
  ) then
    alter table public.athlete_link_requests
      add constraint athlete_link_requests_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.athlete_link_requests'::regclass
      and conname = 'athlete_link_requests_path_object_check'
  ) then
    alter table public.athlete_link_requests
      add constraint athlete_link_requests_path_object_check
      check (jsonb_typeof(participant_path) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.athlete_link_requests'::regclass
      and conname = 'athlete_link_requests_athlete_index_check'
  ) then
    alter table public.athlete_link_requests
      add constraint athlete_link_requests_athlete_index_check
      check (athlete_index in (0, 1));
  end if;
end;
$$;
create index if not exists athlete_link_requests_organizer_pending_idx
  on public.athlete_link_requests(organizer_user_id, acknowledged_at, claimed_at);
create index if not exists athlete_link_requests_tournament_path_idx
  on public.athlete_link_requests(tournament_id, athlete_index, created_at desc);
create unique index if not exists athlete_link_requests_open_slot_uq
  on public.athlete_link_requests(tournament_id, participant_path, athlete_index)
  where revoked_at is null;
create index if not exists athlete_link_requests_expiry_idx
  on public.athlete_link_requests(expires_at)
  where acknowledged_at is null and revoked_at is null;
alter table public.athlete_link_requests enable row level security;
revoke all on table public.athlete_link_requests from public, anon, authenticated;
create or replace function public.create_athlete_link_request(
  p_tournament_id uuid,
  p_path jsonb,
  p_athlete_index integer default 0,
  p_athlete_name text default '',
  p_expires_in_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  request_row public.athlete_link_requests%rowtype;
  normalized_path jsonb;
  tournament_name text;
  participant_kind text;
  participant_index integer;
  participant_member_id text;
  ttl_minutes integer;
begin
  if auth.uid() is null or public.current_account_role() <> 'organizer' then
    raise exception 'Apenas organizadores ativos podem criar vínculos.';
  end if;

  if jsonb_typeof(p_path) <> 'object' then
    raise exception 'Posição do participante inválida.';
  end if;

  participant_kind := p_path ->> 'kind';
  if participant_kind is null
    or participant_kind not in ('normal', 'men', 'women', 'team')
    or coalesce(p_path ->> 'index', '') !~ '^[0-9]+$' then
    raise exception 'Posição do participante inválida.';
  end if;

  participant_index := (p_path ->> 'index')::integer;
  if participant_index < 0
    or coalesce(p_athlete_index, -1) not in (0, 1)
    or (participant_kind <> 'team' and p_athlete_index <> 0) then
    raise exception 'Posição do participante inválida.';
  end if;

  if (p_path ? 'memberId' and jsonb_typeof(p_path -> 'memberId') is distinct from 'string')
    or (p_path ? 'member_id' and jsonb_typeof(p_path -> 'member_id') is distinct from 'string') then
    raise exception 'Identificador estável do participante inválido.';
  end if;

  if p_path ? 'memberId' and p_path ? 'member_id'
    and trim(p_path ->> 'memberId') <> trim(p_path ->> 'member_id') then
    raise exception 'Identificadores do participante divergentes.';
  end if;

  participant_member_id := trim(coalesce(
    p_path ->> 'memberId',
    p_path ->> 'member_id',
    ''
  ));

  if participant_member_id = ''
    or char_length(participant_member_id) > 160
    or participant_member_id ~ '[[:cntrl:]]' then
    raise exception 'Identificador estável do participante inválido.';
  end if;

  select tournament.name
  into tournament_name
  from public.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.user_id = auth.uid()
    and coalesce(tournament.data ->> 'deletedAt', '') = '';

  if not found then
    raise exception 'Torneio não encontrado para este organizador.';
  end if;

  normalized_path := jsonb_build_object('kind', participant_kind, 'index', participant_index);
  if participant_member_id <> '' then
    normalized_path := normalized_path || jsonb_build_object('memberId', participant_member_id);
  end if;
  ttl_minutes := greatest(15, least(coalesce(p_expires_in_minutes, 1440), 10080));

  perform pg_advisory_xact_lock(hashtextextended(
    p_tournament_id::text || ':' || normalized_path::text || ':' || p_athlete_index::text,
    0
  ));

  select request.*
  into request_row
  from public.athlete_link_requests request
  where request.tournament_id = p_tournament_id
    and request.organizer_user_id = auth.uid()
    and request.participant_path = normalized_path
    and request.athlete_index = p_athlete_index
    and request.revoked_at is null
  order by request.created_at desc
  limit 1
  for update;

  if found
    and request_row.claimed_at is not null
    and request_row.acknowledged_at is null then
    raise exception 'Este vínculo já foi confirmado pelo atleta e aguarda conclusão.';
  end if;

  if found
    and request_row.athlete_user_id is null
    and request_row.expires_at > statement_timestamp() then
    return jsonb_build_object(
      'requestId', request_row.id,
      'tournamentId', request_row.tournament_id,
      'tournamentName', tournament_name,
      'path', request_row.participant_path,
      'athleteIndex', request_row.athlete_index,
      'athleteName', request_row.athlete_name,
      'expiresAt', request_row.expires_at,
      'createdAt', request_row.created_at
    );
  end if;

  update public.athlete_link_requests
  set revoked_at = statement_timestamp(), updated_at = statement_timestamp()
  where tournament_id = p_tournament_id
    and organizer_user_id = auth.uid()
    and participant_path = normalized_path
    and athlete_index = p_athlete_index
    and revoked_at is null;

  insert into public.athlete_link_requests (
    tournament_id,
    organizer_user_id,
    participant_path,
    athlete_index,
    athlete_name,
    expires_at
  ) values (
    p_tournament_id,
    auth.uid(),
    normalized_path,
    p_athlete_index,
    left(trim(coalesce(p_athlete_name, '')), 100),
    statement_timestamp() + make_interval(mins => ttl_minutes)
  )
  returning * into request_row;

  return jsonb_build_object(
    'requestId', request_row.id,
    'tournamentId', request_row.tournament_id,
    'tournamentName', tournament_name,
    'path', request_row.participant_path,
    'athleteIndex', request_row.athlete_index,
    'athleteName', request_row.athlete_name,
    'expiresAt', request_row.expires_at,
    'createdAt', request_row.created_at
  );
end;
$$;
create or replace function public.get_athlete_link_request(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  request_row public.athlete_link_requests%rowtype;
  tournament_name text;
  tournament_type text;
begin
  select request.*
  into request_row
  from public.athlete_link_requests request
  join public.tournaments tournament on tournament.id = request.tournament_id
  where request.id = p_request_id
    and request.revoked_at is null
    and request.acknowledged_at is null
    and request.expires_at > statement_timestamp()
    and coalesce(tournament.data ->> 'deletedAt', '') = ''
  limit 1;

  if not found then
    return null;
  end if;

  select tournament.name, tournament.type
  into tournament_name, tournament_type
  from public.tournaments tournament
  where tournament.id = request_row.tournament_id;

  return jsonb_build_object(
    'requestId', request_row.id,
    'tournamentId', request_row.tournament_id,
    'tournamentName', tournament_name,
    'tournamentType', tournament_type,
    'path', request_row.participant_path,
    'athleteIndex', request_row.athlete_index,
    'athleteName', request_row.athlete_name,
    'claimed', request_row.athlete_user_id is not null,
    'expiresAt', request_row.expires_at
  );
end;
$$;
create or replace function public.claim_athlete_link_request(
  p_request_id uuid,
  p_public_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  request_row public.athlete_link_requests%rowtype;
  athlete_profile public.athlete_profiles%rowtype;
  effective_public_consent boolean;
begin
  if auth.uid() is null or public.current_account_role() <> 'athlete' then
    raise exception 'Apenas contas de atleta podem confirmar este vínculo.';
  end if;

  select * into athlete_profile
  from public.athlete_profiles
  where user_id = auth.uid();

  if not found or char_length(trim(coalesce(athlete_profile.display_name, ''))) < 2 then
    raise exception 'Complete e salve seu perfil de atleta antes de confirmar.';
  end if;

  if coalesce(p_public_consent, false) and athlete_profile.is_public is not true then
    raise exception 'Ative o perfil público antes de autorizar sua exibição no torneio.';
  end if;

  update public.athlete_link_requests request
  set athlete_user_id = auth.uid(),
      public_consent = coalesce(p_public_consent, false),
      claimed_at = coalesce(request.claimed_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where request.id = p_request_id
    and request.revoked_at is null
    and request.acknowledged_at is null
    and request.expires_at > statement_timestamp()
    and (request.athlete_user_id is null or request.athlete_user_id = auth.uid())
    and exists (
      select 1 from public.tournaments tournament
      where tournament.id = request.tournament_id
        and coalesce(tournament.data ->> 'deletedAt', '') = ''
    )
  returning * into request_row;

  if not found then
    raise exception 'Convite inválido, expirado ou já utilizado.';
  end if;

  effective_public_consent := request_row.public_consent and athlete_profile.is_public;

  return jsonb_build_object(
    'requestId', request_row.id,
    'tournamentId', request_row.tournament_id,
    'path', request_row.participant_path,
    'athleteIndex', request_row.athlete_index,
    'athleteProfileId', athlete_profile.user_id,
    'profileSlug', athlete_profile.user_id,
    'displayName', athlete_profile.display_name,
    'photoUrl', case when effective_public_consent then athlete_profile.photo_url else '' end,
    'bio', case when effective_public_consent then athlete_profile.bio else '' end,
    'publicConsent', effective_public_consent,
    'linkedAt', request_row.claimed_at
  );
end;
$$;
create or replace function public.get_my_athlete_link_results()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_account_role() <> 'organizer' then
    raise exception 'Apenas organizadores ativos podem consultar vínculos.';
  end if;

  return query
  select jsonb_build_object(
    'requestId', request.id,
    'tournamentId', request.tournament_id,
    'path', request.participant_path,
    'athleteIndex', request.athlete_index,
    'athleteProfileId', athlete.user_id,
    'profileSlug', athlete.user_id,
    'displayName', athlete.display_name,
    'photoUrl', case when request.public_consent and athlete.is_public then athlete.photo_url else '' end,
    'bio', case when request.public_consent and athlete.is_public then athlete.bio else '' end,
    'publicConsent', request.public_consent and athlete.is_public,
    'linkedAt', request.claimed_at
  )
  from public.athlete_link_requests request
  join public.tournaments tournament on tournament.id = request.tournament_id
  join public.athlete_profiles athlete on athlete.user_id = request.athlete_user_id
  where request.organizer_user_id = auth.uid()
    and tournament.user_id = auth.uid()
    and request.claimed_at is not null
    and request.acknowledged_at is null
    and request.revoked_at is null
  order by request.claimed_at;
end;
$$;
create or replace function public.acknowledge_athlete_link_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_account_role() <> 'organizer' then
    raise exception 'Apenas organizadores ativos podem concluir vínculos.';
  end if;

  update public.athlete_link_requests request
  set acknowledged_at = coalesce(request.acknowledged_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where request.id = p_request_id
    and request.organizer_user_id = auth.uid()
    and request.athlete_user_id is not null
    and request.revoked_at is null
    and exists (
      select 1 from public.tournaments tournament
      where tournament.id = request.tournament_id
        and tournament.user_id = auth.uid()
    );

  if not found then
    raise exception 'Vínculo não encontrado para este organizador.';
  end if;
end;
$$;
revoke all on function public.create_athlete_link_request(uuid, jsonb, integer, text, integer) from public, anon, authenticated;
revoke all on function public.get_athlete_link_request(uuid) from public, anon, authenticated;
revoke all on function public.claim_athlete_link_request(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_my_athlete_link_results() from public, anon, authenticated;
revoke all on function public.acknowledge_athlete_link_request(uuid) from public, anon, authenticated;
grant execute on function public.create_athlete_link_request(uuid, jsonb, integer, text, integer) to authenticated;
grant execute on function public.get_athlete_link_request(uuid) to anon, authenticated;
grant execute on function public.claim_athlete_link_request(uuid, boolean) to authenticated;
grant execute on function public.get_my_athlete_link_results() to authenticated;
grant execute on function public.acknowledge_athlete_link_request(uuid) to authenticated;
create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_name text not null,
  partner_name text not null default '',
  category text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, athlete_user_id)
);
alter table public.tournament_registrations
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade,
  add column if not exists athlete_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists athlete_name text not null default '',
  add column if not exists partner_name text not null default '',
  add column if not exists category text not null default '',
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and contype = 'p'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname in (
        'tournament_registrations_status_check',
        'tournament_registrations_status_allowed_check'
      )
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_status_allowed_check
      check (status in ('pending', 'confirmed', 'rejected', 'cancelled'));
  end if;
end;
$$;
create unique index if not exists tournament_registrations_tournament_athlete_uq
  on public.tournament_registrations(tournament_id, athlete_user_id);
create index if not exists tournament_registrations_tournament_idx
  on public.tournament_registrations(tournament_id);
create index if not exists tournament_registrations_athlete_idx
  on public.tournament_registrations(athlete_user_id);
alter table public.tournament_registrations enable row level security;
revoke insert, update, delete on public.tournament_registrations from public, anon, authenticated;
grant select on public.tournament_registrations to authenticated;
drop policy if exists registrations_owner_or_organizer_read on public.tournament_registrations;
create policy registrations_owner_or_organizer_read
on public.tournament_registrations for select
to authenticated
using (
  athlete_user_id = auth.uid()
  or exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and t.user_id = auth.uid()
  )
);
-- Escritas passam por RPCs transacionais. Assim o atleta não consegue
-- confirmar a própria inscrição e o organizador não altera outro torneio.
create or replace function public.submit_tournament_registration(
  p_tournament_id uuid,
  p_athlete_name text,
  p_partner_name text default '',
  p_category text default ''
)
returns public.tournament_registrations
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  tournament_row public.tournaments%rowtype;
  registration_row public.tournament_registrations%rowtype;
  today_in_sao_paulo date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null or public.current_account_role() <> 'athlete' then
    raise exception 'Apenas contas de atleta podem se inscrever.';
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

  if char_length(trim(coalesce(p_athlete_name, ''))) < 2 then
    raise exception 'Informe o nome do atleta.';
  end if;

  insert into public.tournament_registrations (
    tournament_id, athlete_user_id, athlete_name, partner_name, category, status
  ) values (
    p_tournament_id,
    auth.uid(),
    trim(p_athlete_name),
    trim(coalesce(p_partner_name, '')),
    trim(coalesce(p_category, '')),
    'pending'
  )
  on conflict (tournament_id, athlete_user_id) do update
    set athlete_name = case
          when public.tournament_registrations.status = 'confirmed'
            then public.tournament_registrations.athlete_name
          else excluded.athlete_name
        end,
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
create or replace function public.cancel_my_tournament_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or public.current_account_role() <> 'athlete' then
    raise exception 'Apenas contas de atleta podem cancelar a própria inscrição.';
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
create or replace function public.review_tournament_registration(
  p_registration_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
    or public.current_account_role() <> 'organizer'
    or p_status is null
    or p_status not in ('pending', 'confirmed', 'rejected') then
    raise exception 'Ação não permitida.';
  end if;

  update public.tournament_registrations registration
  set status = p_status, updated_at = now()
  where registration.id = p_registration_id
    and exists (
      select 1 from public.tournaments tournament
      where tournament.id = registration.tournament_id
        and tournament.user_id = auth.uid()
    );

  if not found then
    raise exception 'Inscrição não encontrada para este organizador.';
  end if;
end;
$$;
revoke all on function public.submit_tournament_registration(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_my_tournament_registration(uuid) from public, anon, authenticated;
revoke all on function public.review_tournament_registration(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_tournament_registration(uuid, text, text, text) to authenticated;
grant execute on function public.cancel_my_tournament_registration(uuid) to authenticated;
grant execute on function public.review_tournament_registration(uuid, text) to authenticated;
-- Um snapshot público nunca é aceito a partir do JSON editável do torneio.
-- Ele é reconstruído com o perfil atual e com um vínculo confirmado no servidor.
create or replace function public.get_consented_public_athlete_snapshot(
  p_tournament_id uuid,
  p_path jsonb,
  p_athlete_index integer,
  p_private_meta jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  snapshot jsonb;
  external_registration_id text;
  link_request_id text;
begin
  link_request_id := coalesce(
    p_private_meta ->> 'linkRequestId',
    p_private_meta ->> 'link_request_id',
    ''
  );

  -- O ID confirmado acompanha o atleta quando a lista é sorteada ou reordenada.
  -- Além do UUID, o torneio e a posição do atleta na dupla são validados no servidor.
  if link_request_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select jsonb_build_object(
      'athleteProfileId', athlete.user_id,
      'profileSlug', athlete.user_id,
      'displayName', athlete.display_name,
      'photoUrl', athlete.photo_url,
      'bio', athlete.bio,
      'publicConsent', true,
      'profileLinked', true,
      'linkedAt', link.claimed_at
    )
    into snapshot
    from public.athlete_link_requests link
    join public.athlete_profiles athlete on athlete.user_id = link.athlete_user_id
    where link.id = link_request_id::uuid
      and link.tournament_id = p_tournament_id
      and link.athlete_index = p_athlete_index
      and link.public_consent = true
      and link.claimed_at is not null
      and link.acknowledged_at is not null
      and link.revoked_at is null
      and athlete.is_public = true
      and (
        coalesce(link.participant_path ->> 'memberId', '') = ''
        or link.participant_path ->> 'memberId' = coalesce(
          p_private_meta ->> 'memberId',
          p_private_meta ->> 'member_id',
          ''
        )
      )
    limit 1;
  end if;

  if snapshot is not null then
    return snapshot;
  end if;

  external_registration_id := coalesce(
    p_private_meta ->> 'externalRegistrationId',
    p_private_meta ->> 'external_registration_id',
    ''
  );

  if p_athlete_index = 0
    and external_registration_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select jsonb_build_object(
      'athleteProfileId', athlete.user_id,
      'profileSlug', athlete.user_id,
      'displayName', athlete.display_name,
      'photoUrl', athlete.photo_url,
      'bio', athlete.bio,
      'publicConsent', true,
      'profileLinked', true,
      'linkedAt', registration.updated_at
    )
    into snapshot
    from public.tournament_registrations registration
    join public.athlete_profiles athlete on athlete.user_id = registration.athlete_user_id
    where registration.id = external_registration_id::uuid
      and registration.tournament_id = p_tournament_id
      and registration.status = 'confirmed'
      and athlete.is_public = true
    limit 1;
  end if;

  return snapshot;
end;
$$;
create or replace function public.sanitize_public_tournament_data(
  p_tournament_id uuid,
  p_data jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  private_meta jsonb := coalesce(p_data -> 'participantMeta', '{}'::jsonb);
  public_meta jsonb := '{}'::jsonb;
  source_array jsonb;
  public_array jsonb;
  athlete_snapshot jsonb;
  first_snapshot jsonb;
  second_snapshot jsonb;
  participant_kind text;
  entry record;
begin
  foreach participant_kind in array array['normal', 'men', 'women']
  loop
    source_array := private_meta -> participant_kind;
    public_array := '[]'::jsonb;

    if jsonb_typeof(source_array) = 'array' then
      for entry in
        select item.value, item.ordinality
        from jsonb_array_elements(source_array) with ordinality as item(value, ordinality)
      loop
        athlete_snapshot := public.get_consented_public_athlete_snapshot(
          p_tournament_id,
          jsonb_build_object('kind', participant_kind, 'index', entry.ordinality - 1),
          0,
          entry.value
        );
        public_array := public_array || jsonb_build_array(coalesce(athlete_snapshot, '{}'::jsonb));
      end loop;
    end if;

    public_meta := jsonb_set(public_meta, array[participant_kind], public_array, true);
  end loop;

  source_array := private_meta -> 'teams';
  public_array := '[]'::jsonb;
  if jsonb_typeof(source_array) = 'array' then
    for entry in
      select item.value, item.ordinality
      from jsonb_array_elements(source_array) with ordinality as item(value, ordinality)
    loop
      first_snapshot := public.get_consented_public_athlete_snapshot(
        p_tournament_id,
        jsonb_build_object('kind', 'team', 'index', entry.ordinality - 1),
        0,
        (case
          when jsonb_typeof(entry.value -> 'athletes' -> 0) = 'object'
            then entry.value -> 'athletes' -> 0
          else '{}'::jsonb
        end)
          || jsonb_build_object(
            'externalRegistrationId',
            coalesce(
              entry.value ->> 'externalRegistrationId',
              entry.value ->> 'external_registration_id'
            )
          )
      );
      second_snapshot := public.get_consented_public_athlete_snapshot(
        p_tournament_id,
        jsonb_build_object('kind', 'team', 'index', entry.ordinality - 1),
        1,
        case
          when jsonb_typeof(entry.value -> 'athletes' -> 1) = 'object'
            then entry.value -> 'athletes' -> 1
          else '{}'::jsonb
        end
      );
      public_array := public_array || jsonb_build_array(jsonb_build_object(
        'athletes', jsonb_build_array(
          coalesce(first_snapshot, '{}'::jsonb),
          coalesce(second_snapshot, '{}'::jsonb)
        ),
        'profileLinked', first_snapshot is not null or second_snapshot is not null
      ));
    end loop;
  end if;
  public_meta := jsonb_set(public_meta, '{teams}', public_array, true);

  return (coalesce(p_data, '{}'::jsonb) - 'participantMeta' - 'participant_meta')
    || jsonb_build_object('participantMeta', public_meta);
end;
$$;
drop function if exists public.list_public_tournaments(integer);
create function public.list_public_tournaments(p_limit integer default 24)
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
  where tournament.is_public = true
    and tournament.public_id is not null
    and coalesce(tournament.data ->> 'deletedAt', '') = ''
  order by tournament.updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 24), 500));
$$;
drop function if exists public.get_public_tournament(text);
create function public.get_public_tournament(p_public_id text)
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
  limit 1;
$$;
create or replace function public.list_public_tournaments_by_organizer(
  p_organizer_id uuid,
  p_limit integer default 100
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
  where tournament.user_id = p_organizer_id
    and tournament.is_public = true
    and tournament.public_id is not null
    and coalesce(tournament.data ->> 'deletedAt', '') = ''
  order by tournament.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
revoke all on function public.get_consented_public_athlete_snapshot(uuid, jsonb, integer, jsonb) from public, anon, authenticated;
revoke all on function public.sanitize_public_tournament_data(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_public_tournaments(integer) from public, anon, authenticated;
revoke all on function public.get_public_tournament(text) from public, anon, authenticated;
revoke all on function public.list_public_tournaments_by_organizer(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_public_tournaments(integer) to anon, authenticated;
grant execute on function public.get_public_tournament(text) to anon, authenticated;
grant execute on function public.list_public_tournaments_by_organizer(uuid, integer) to anon, authenticated;
-- Guardas restritivas: continuam valendo junto com as políticas existentes e
-- impedem escrita administrativa por contas de atleta.
alter table public.tournaments enable row level security;
revoke select on table public.tournaments from public, anon;
grant select on table public.tournaments to authenticated;
drop policy if exists tournaments_owner_direct_read on public.tournaments;
create policy tournaments_owner_direct_read
on public.tournaments as permissive for select
to authenticated
using (user_id = auth.uid());
drop policy if exists tournaments_organizer_select_guard on public.tournaments;
create policy tournaments_organizer_select_guard
on public.tournaments as restrictive for select
to authenticated
using (user_id = auth.uid() and public.current_account_role() = 'organizer');
drop policy if exists tournaments_organizer_insert_guard on public.tournaments;
create policy tournaments_organizer_insert_guard
on public.tournaments as restrictive for insert
to authenticated
with check (user_id = auth.uid() and public.current_account_role() = 'organizer');
drop policy if exists tournaments_organizer_update_guard on public.tournaments;
create policy tournaments_organizer_update_guard
on public.tournaments as restrictive for update
to authenticated
using (user_id = auth.uid() and public.current_account_role() = 'organizer')
with check (user_id = auth.uid() and public.current_account_role() = 'organizer');
drop policy if exists tournaments_organizer_delete_guard on public.tournaments;
create policy tournaments_organizer_delete_guard
on public.tournaments as restrictive for delete
to authenticated
using (user_id = auth.uid() and public.current_account_role() = 'organizer');
do $$
begin
  if to_regclass('public.circuits') is not null then
    execute 'alter table public.circuits enable row level security';
    execute 'drop policy if exists circuits_organizer_insert_guard on public.circuits';
    execute 'create policy circuits_organizer_insert_guard on public.circuits as restrictive for insert to authenticated with check (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
    execute 'drop policy if exists circuits_organizer_update_guard on public.circuits';
    execute 'create policy circuits_organizer_update_guard on public.circuits as restrictive for update to authenticated using (user_id = auth.uid() and public.current_account_role() = ''organizer'') with check (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
    execute 'drop policy if exists circuits_organizer_delete_guard on public.circuits';
    execute 'create policy circuits_organizer_delete_guard on public.circuits as restrictive for delete to authenticated using (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
  end if;

  if to_regclass('public.circuit_ranking_history') is not null then
    execute 'alter table public.circuit_ranking_history enable row level security';
    execute 'drop policy if exists circuit_ranking_history_organizer_insert_guard on public.circuit_ranking_history';
    execute 'create policy circuit_ranking_history_organizer_insert_guard on public.circuit_ranking_history as restrictive for insert to authenticated with check (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
    execute 'drop policy if exists circuit_ranking_history_organizer_update_guard on public.circuit_ranking_history';
    execute 'create policy circuit_ranking_history_organizer_update_guard on public.circuit_ranking_history as restrictive for update to authenticated using (user_id = auth.uid() and public.current_account_role() = ''organizer'') with check (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
    execute 'drop policy if exists circuit_ranking_history_organizer_delete_guard on public.circuit_ranking_history';
    execute 'create policy circuit_ranking_history_organizer_delete_guard on public.circuit_ranking_history as restrictive for delete to authenticated using (user_id = auth.uid() and public.current_account_role() = ''organizer'')';
  end if;
end;
$$;
commit;
