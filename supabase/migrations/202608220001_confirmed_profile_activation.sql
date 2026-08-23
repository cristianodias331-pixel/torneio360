begin;

-- A reconciliação é executada pelo próprio usuário autenticado. O gatilho
-- que protege status/expires_at também enxerga essa sessão e, sem esta marca
-- transacional, revertia silenciosamente a ativação feita pelo backend.
create or replace function public.reconcile_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  account_role text;
  profile_row public.profiles%rowtype;
  previous_access_update_setting text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select lower(coalesce(account.raw_app_meta_data ->> 'role', ''))
  into account_role
  from auth.users account
  where account.id = auth.uid();

  if not found then
    raise exception 'Conta não encontrada.';
  end if;

  if account_role not in ('organizer', 'organizer_pending') then
    raise exception 'Esta conta não é de organizador.';
  end if;

  previous_access_update_setting := current_setting(
    'torneio360.allow_access_update',
    true
  );
  perform set_config('torneio360.allow_access_update', 'on', true);

  perform private.provision_profile_from_auth_user(auth.uid());

  perform set_config(
    'torneio360.allow_access_update',
    coalesce(previous_access_update_setting, ''),
    true
  );

  select *
  into profile_row
  from public.profiles
  where id = auth.uid();

  return to_jsonb(profile_row);
end;
$$;

revoke all on function public.reconcile_my_profile() from public, anon;
grant execute on function public.reconcile_my_profile() to authenticated;

-- Corrige também contas que confirmaram o e-mail antes desta migração. A
-- rotina é idempotente: preserva acessos já definidos e não renova testes.
do $$
declare
  account_row record;
begin
  for account_row in
    select account.id
    from auth.users account
    where account.email_confirmed_at is not null
      and lower(coalesce(account.raw_app_meta_data ->> 'role', '')) in (
        'organizer', 'organizer_pending'
      )
  loop
    perform private.provision_profile_from_auth_user(account_row.id);
  end loop;
end;
$$;

commit;
