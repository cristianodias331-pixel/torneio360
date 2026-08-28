begin;

-- A conta do Torneio 360 é única. Ativar a identidade de organização não
-- remove o perfil esportivo e só pode iniciar o teste gratuito uma vez.
alter table public.profiles
  add column if not exists organization_activated_at timestamptz;

create or replace function public.activate_my_organization()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  account_row auth.users%rowtype;
  profile_row public.profiles%rowtype;
  account_role text;
  profile_name text;
  activation_time timestamptz := statement_timestamp();
  trial_end date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date + 6;
  trial_started boolean := false;
  previous_access_update_setting text;
begin
  if auth.uid() is null then
    raise exception 'Entre em sua conta para ativar a organização.' using errcode = '42501';
  end if;

  select *
  into account_row
  from auth.users account
  where account.id = auth.uid()
  for update;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  if account_row.email_confirmed_at is null then
    raise exception 'Confirme seu e-mail antes de ativar a organização.' using errcode = '42501';
  end if;

  account_role := lower(coalesce(account_row.raw_app_meta_data ->> 'role', 'athlete'));
  if account_role not in ('athlete', 'organizer', 'organizer_pending') then
    raise exception 'Esta conta não pode ativar uma organização.' using errcode = '42501';
  end if;

  profile_name := left(btrim(coalesce(
    nullif(account_row.raw_user_meta_data ->> 'name', ''),
    nullif(account_row.raw_user_meta_data ->> 'full_name', ''),
    nullif(account_row.raw_user_meta_data ->> 'first_name', ''),
    split_part(coalesce(account_row.email, ''), '@', 1),
    'Organizador'
  )), 120);

  previous_access_update_setting := current_setting('torneio360.allow_access_update', true);
  perform set_config('torneio360.allow_access_update', 'on', true);

  select *
  into profile_row
  from public.profiles profile
  where profile.id = auth.uid()
  for update;

  if not found then
    insert into public.profiles (
      id,
      email,
      name,
      plan,
      status,
      expires_at,
      is_public,
      organization_activated_at
    ) values (
      auth.uid(),
      account_row.email,
      profile_name,
      'premium',
      'active',
      trial_end,
      false,
      activation_time
    )
    returning * into profile_row;
    trial_started := true;
  elsif account_role in ('athlete', 'organizer_pending')
    and profile_row.organization_activated_at is null then
    update public.profiles profile
    set
      email = coalesce(nullif(profile.email, ''), account_row.email),
      name = coalesce(nullif(btrim(profile.name), ''), profile_name),
      plan = 'premium',
      status = 'active',
      expires_at = trial_end,
      is_public = false,
      organization_activated_at = activation_time
    where profile.id = auth.uid()
    returning * into profile_row;
    trial_started := true;
  end if;

  -- O papel administrativo fica no app_metadata, que não pode ser alterado
  -- diretamente pelo navegador. O JWT é renovado pelo frontend após a RPC.
  update auth.users account
  set raw_app_meta_data = coalesce(account.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'organizer')
  where account.id = auth.uid()
    and lower(coalesce(account.raw_app_meta_data ->> 'role', '')) in (
      'athlete', 'organizer_pending'
    );

  perform set_config(
    'torneio360.allow_access_update',
    coalesce(previous_access_update_setting, ''),
    true
  );

  return jsonb_build_object(
    'profile', to_jsonb(profile_row),
    'role', 'organizer',
    'trialStarted', trial_started,
    'organizationActivatedAt', profile_row.organization_activated_at
  );
end;
$$;

revoke all on function public.activate_my_organization() from public, anon;
grant execute on function public.activate_my_organization() to authenticated;

comment on function public.activate_my_organization() is
  'Ativa uma única vez a identidade de organização na mesma conta do atleta e preserva o perfil esportivo.';

commit;
