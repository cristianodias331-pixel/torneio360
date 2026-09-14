begin;

-- Novos cadastros aguardam uma assinatura. Alterar os defaults não modifica
-- nenhuma linha existente, inclusive testes e assinaturas ainda ativos.
alter table public.profiles
  alter column status set default 'pending',
  alter column expires_at drop default;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    plan,
    status,
    expires_at,
    is_public
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Organizador'
    ),
    'premium',
    'pending',
    null,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Confirmação, login e reenvios da reconciliação podem completar o cadastro,
-- mas nunca concedem nem renovam acesso. No conflito, os três campos de acesso
-- (status, plan e expires_at) ficam exatamente como já estavam.
create or replace function private.provision_profile_from_auth_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  account_row auth.users%rowtype;
  is_confirmed boolean;
  profile_name text;
begin
  select *
  into account_row
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Usuário de autenticação não encontrado';
  end if;

  is_confirmed := account_row.email_confirmed_at is not null;
  profile_name := left(trim(coalesce(
    nullif(account_row.raw_user_meta_data ->> 'name', ''),
    nullif(account_row.raw_user_meta_data ->> 'full_name', ''),
    nullif(account_row.raw_user_meta_data ->> 'first_name', ''),
    split_part(coalesce(account_row.email, ''), '@', 1),
    'Organizador'
  )), 120);

  insert into public.profiles as profile (
    id,
    email,
    name,
    status,
    plan,
    expires_at,
    is_public
  )
  values (
    account_row.id,
    account_row.email,
    profile_name,
    'pending',
    'premium',
    null,
    false
  )
  on conflict (id) do update
  set
    email = coalesce(nullif(profile.email, ''), excluded.email),
    name = coalesce(nullif(trim(profile.name), ''), excluded.name);

  -- A função identifica o organizador confirmado; a autorização continua
  -- dependendo de status/prazo nas guardas existentes, sem mudança de regras.
  if is_confirmed then
    perform private.promote_confirmed_organizer(account_row.id);
  end if;
end;
$$;

revoke all on function private.provision_profile_from_auth_user(uuid) from public, anon, authenticated;

commit;
