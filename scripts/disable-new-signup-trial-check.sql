-- Execute SOMENTE em um banco descartável de homologação, com todas as
-- migrações aplicadas e um usuário administrativo. Não usa contas existentes.
-- Exemplo, sem gravar credenciais neste arquivo:
--   psql "$HOMOLOGATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/disable-new-signup-trial-check.sql
-- Os UUIDs e e-mails .invalid são exclusivos deste teste. Tudo é revertido.
-- Não há stub: estes testes exercitam as funções e triggers reais do banco.

begin;

do $$
declare
  fixture_id uuid;
  scenario record;
  profile_row public.profiles%rowtype;
  access_before jsonb;
  access_after jsonb;
  role_after text;
begin
  -- Sem confirmação: o trigger nunca concede teste.
  fixture_id := gen_random_uuid();
  insert into auth.users (
    id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) values (
    fixture_id,
    'trial-policy-' || fixture_id::text || '@example.invalid',
    '{"name":"Fixture sem confirmação","is_trial":true}'::jsonb,
    '{}'::jsonb,
    now(), now()
  );
  select * into strict profile_row from public.profiles where id = fixture_id;
  if profile_row.status is distinct from 'pending' or profile_row.expires_at is not null then
    raise exception 'Novo cadastro não confirmado recebeu acesso';
  end if;

  -- Confirmar e reconciliar repetidamente não libera ou renova acesso.
  update auth.users set email_confirmed_at = now() where id = fixture_id;
  perform private.provision_profile_from_auth_user(fixture_id);
  perform private.provision_profile_from_auth_user(fixture_id);
  select * into strict profile_row from public.profiles where id = fixture_id;
  if profile_row.status is distinct from 'pending' or profile_row.expires_at is not null then
    raise exception 'Confirmação/reconciliação concedeu acesso ao novo cadastro';
  end if;
  select raw_app_meta_data ->> 'role' into role_after from auth.users where id = fixture_id;
  if role_after is distinct from 'organizer' then
    raise exception 'A identidade de organizador confirmado não foi preservada';
  end if;
  if public.profile_has_active_access(profile_row.status, profile_row.expires_at::text) then
    raise exception 'Pending sem prazo não pode autorizar o painel';
  end if;

  -- Já confirmado no INSERT (por exemplo, confirmação automática): sem teste.
  fixture_id := gen_random_uuid();
  insert into auth.users (
    id, email, raw_user_meta_data, raw_app_meta_data,
    email_confirmed_at, created_at, updated_at
  ) values (
    fixture_id,
    'trial-policy-' || fixture_id::text || '@example.invalid',
    '{"name":"Fixture já confirmada"}'::jsonb,
    '{}'::jsonb,
    now(), now(), now()
  );
  select * into strict profile_row from public.profiles where id = fixture_id;
  if profile_row.status is distinct from 'pending' or profile_row.expires_at is not null then
    raise exception 'Cadastro já confirmado recebeu teste no trigger';
  end if;

  -- Fallback de perfil ausente também não concede teste.
  delete from public.profiles where id = fixture_id;
  perform private.provision_profile_from_auth_user(fixture_id);
  select * into strict profile_row from public.profiles where id = fixture_id;
  if profile_row.status is distinct from 'pending' or profile_row.expires_at is not null then
    raise exception 'Provisionamento de perfil ausente concedeu teste';
  end if;

  -- Escrita administrativa que omite os campos usa defaults sem acesso.
  delete from public.profiles where id = fixture_id;
  insert into public.profiles (id, email, name)
  values (fixture_id, 'trial-policy-' || fixture_id::text || '@example.invalid', 'Fixture defaults');
  select * into strict profile_row from public.profiles where id = fixture_id;
  if profile_row.status is distinct from 'pending' or profile_row.expires_at is not null then
    raise exception 'Defaults ainda concedem acesso';
  end if;

  -- Simula perfis já existentes. Nenhum status, plano ou vencimento pode ser
  -- trocado, mesmo quando pending tem um prazo definido manualmente.
  for scenario in
    select * from (values
      ('teste ativo', 'active', 'premium', current_date + 3),
      ('assinatura ativa', 'active', 'pro', current_date + 30),
      ('acesso sem prazo', 'active', 'basic', null::date),
      ('acesso vencido', 'active', 'premium', current_date - 1),
      ('bloqueado', 'blocked', 'premium', current_date + 30),
      ('pendente sem prazo', 'pending', 'basic', null::date),
      ('pendente com prazo manual', 'pending', 'pro', current_date + 15)
    ) as scenarios(label, status, plan, expires_at)
  loop
    update public.profiles
    set status = scenario.status, plan = scenario.plan, expires_at = scenario.expires_at
    where id = fixture_id;
    select jsonb_build_object('status', status, 'plan', plan, 'expires_at', expires_at)
    into access_before from public.profiles where id = fixture_id;

    perform private.provision_profile_from_auth_user(fixture_id);
    perform private.provision_profile_from_auth_user(fixture_id);

    select jsonb_build_object('status', status, 'plan', plan, 'expires_at', expires_at)
    into access_after from public.profiles where id = fixture_id;
    if access_after is distinct from access_before then
      raise exception 'Reconciliação alterou o acesso existente: %', scenario.label;
    end if;
  end loop;

  raise notice 'OK: cadastros novos sem teste; acessos existentes preservados; reconciliação idempotente.';
end;
$$;

rollback;
