begin;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.platform_notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%notification_type%';
  if constraint_name is not null then
    execute format('alter table public.platform_notifications drop constraint %I', constraint_name);
  end if;
  alter table public.platform_notifications
    add constraint platform_notifications_type_check
    check (notification_type in (
      'registration_submitted', 'registration_approved', 'registration_rejected',
      'registration_cancelled', 'registration_removed',
      'partner_invitation', 'partner_accepted', 'partner_rejected', 'partner_cancelled'
    ));
end;
$$;

create or replace function public.search_tournament_partner_candidates(
  p_tournament_id uuid,
  p_query text,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  normalized_query text := public.t360_search_normalize(p_query);
  safe_limit integer := greatest(1, least(coalesce(p_limit, 8), 16));
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.tournaments tournament
    where tournament.id = p_tournament_id
      and tournament.is_public = true
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ) then raise exception 'Torneio não encontrado.' using errcode = 'P0002'; end if;
  if char_length(normalized_query) < 2 then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', candidate.user_id,
      'handle', candidate.handle,
      'display_name', candidate.display_name,
      'photo_url', candidate.photo_url,
      'sports_category', candidate.sports_category,
      'dominant_hand', candidate.dominant_hand,
      'city', candidate.city,
      'state', candidate.state,
      'is_self', false
    ) order by candidate.sort_rank, public.t360_search_normalize(candidate.display_name), candidate.user_id)
    from (
      select member.*,
        case
          when public.t360_search_normalize(member.handle) = normalized_query then 0
          when public.t360_search_normalize(member.handle) like normalized_query || '%' then 1
          when public.t360_search_normalize(member.display_name) like normalized_query || '%' then 2
          else 3
        end as sort_rank
      from public.member_profiles member
      join auth.users account on account.id = member.user_id
      where member.is_public = true
        and member.user_id <> auth.uid()
        and account.email_confirmed_at is not null
        and public.t360_search_normalize(concat_ws(' ', member.display_name, member.handle, member.city, member.state))
          like '%' || normalized_query || '%'
      order by sort_rank, public.t360_search_normalize(member.display_name), member.user_id
      limit safe_limit
    ) candidate
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.cancel_my_tournament_registration(uuid);

create function public.cancel_my_tournament_registration(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  athlete_row public.member_profiles%rowtype;
  invited_partner_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na plataforma para cancelar sua inscrição.' using errcode = '42501'; end if;
  select * into registration_row from public.tournament_registrations registration
  where registration.id = p_registration_id and registration.athlete_user_id = auth.uid() for update;
  if registration_row.id is null then raise exception 'Inscrição não encontrada.' using errcode = 'P0002'; end if;
  if registration_row.workflow_status = 'approved' or registration_row.status = 'confirmed' then
    raise exception 'Após a aprovação, fale com a organização para sair do torneio.' using errcode = '22023';
  end if;

  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;
  select * into athlete_row from public.member_profiles member where member.user_id = auth.uid();
  invited_partner_id := registration_row.partner_user_id;

  update public.tournament_registrations registration
  set status = 'cancelled', workflow_status = 'draft', payment_status = 'pending',
      payment_method = null, payment_proof_path = null, payment_proof_name = null,
      payment_proof_mime = null, payment_proof_size = null, payment_submitted_at = null,
      payment_reviewed_at = null, payment_reviewed_by = null, payment_rejection_reason = '',
      partner_user_id = null, partner_handle = '', partner_name = '', partner_status = 'none',
      partner_invited_at = null, partner_responded_at = null, updated_at = now()
  where registration.id = registration_row.id
  returning * into registration_row;

  update public.athlete_partner_searches set active = false, updated_at = now()
  where tournament_id = registration_row.tournament_id and athlete_user_id = auth.uid();

  insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
  values (
    tournament_row.user_id, auth.uid(), 'registration_cancelled', 'Inscrição cancelada pelo atleta',
    coalesce(nullif(athlete_row.display_name, ''), registration_row.athlete_name, 'Um atleta')
      || ' desistiu da inscrição em ' || tournament_row.name || '.',
    tournament_row.id, registration_row.id
  );
  if invited_partner_id is not null then
    insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
    values (invited_partner_id, auth.uid(), 'partner_cancelled', 'Inscrição da dupla cancelada',
      'A inscrição da dupla em ' || tournament_row.name || ' foi cancelada.', tournament_row.id, registration_row.id);
  end if;
  return jsonb_build_object('registration_id', registration_row.id, 'status', 'cancelled');
end;
$$;

create or replace function public.cancel_my_tournament_partnership(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  other_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select * into registration_row from public.tournament_registrations registration
  where registration.id = p_registration_id
    and (registration.athlete_user_id = auth.uid() or registration.partner_user_id = auth.uid())
  for update;
  if registration_row.id is null then raise exception 'Parceria não encontrada.' using errcode = 'P0002'; end if;
  if registration_row.partner_user_id is null or registration_row.partner_status not in ('pending', 'accepted') then
    raise exception 'Esta inscrição não possui uma parceria ativa.' using errcode = '22023';
  end if;
  if registration_row.workflow_status = 'approved' or registration_row.status = 'confirmed' then
    raise exception 'Após a aprovação, a organização precisa desfazer a dupla.' using errcode = '22023';
  end if;

  other_user_id := case when auth.uid() = registration_row.athlete_user_id
    then registration_row.partner_user_id else registration_row.athlete_user_id end;
  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;

  update public.tournament_registrations registration
  set partner_user_id = null, partner_handle = '', partner_name = '', partner_status = 'none',
      partner_invited_at = null, partner_responded_at = null, updated_at = now()
  where registration.id = registration_row.id
  returning * into registration_row;

  insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
  values (other_user_id, auth.uid(), 'partner_cancelled', 'Parceria encerrada',
    'A parceria para ' || tournament_row.name || ' foi desfeita antes da aprovação.', tournament_row.id, registration_row.id);
  insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
  values (tournament_row.user_id, auth.uid(), 'partner_cancelled', 'Dupla alterada antes da aprovação',
    'Uma parceria foi desfeita na inscrição de ' || registration_row.athlete_name || ' em ' || tournament_row.name || '.',
    tournament_row.id, registration_row.id);
  return jsonb_build_object('registration_id', registration_row.id, 'partner_status', 'none');
end;
$$;

create or replace function public.remove_organization_tournament_registration(
  p_registration_id uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  mirror_row public.tournament_registrations%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select registration.* into registration_row
  from public.tournament_registrations registration
  join public.tournaments tournament on tournament.id = registration.tournament_id
  where registration.id = p_registration_id and tournament.user_id = auth.uid()
  for update of registration;
  if registration_row.id is null then raise exception 'Inscrição não encontrada para esta organização.' using errcode = 'P0002'; end if;
  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;

  if registration_row.paired_into_registration_id is not null then
    update public.tournament_registrations
    set partner_user_id = null, partner_handle = '', partner_name = '', partner_status = 'none', updated_at = now()
    where id = registration_row.paired_into_registration_id;
  else
    select * into mirror_row from public.tournament_registrations mirror
    where mirror.paired_into_registration_id = registration_row.id and mirror.status <> 'cancelled' limit 1;
    if mirror_row.id is not null then
      update public.tournament_registrations
      set paired_into_registration_id = null, partner_user_id = null, partner_handle = '', partner_name = '', partner_status = 'none', updated_at = now()
      where id = mirror_row.id;
    end if;
  end if;

  update public.tournament_registrations registration
  set status = 'cancelled', workflow_status = 'rejected', payment_status = 'pending',
      payment_rejection_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Participante removido pela organização.'), 240),
      paired_into_registration_id = null, updated_at = now()
  where registration.id = registration_row.id
  returning * into registration_row;

  update public.athlete_partner_searches set active = false, updated_at = now()
  where tournament_id = registration_row.tournament_id
    and athlete_user_id in (registration_row.athlete_user_id, registration_row.partner_user_id);

  insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
  values (registration_row.athlete_user_id, auth.uid(), 'registration_removed', 'Participação removida pela organização',
    'A organização removeu sua participação em ' || tournament_row.name || '.', tournament_row.id, registration_row.id);
  if registration_row.partner_user_id is not null then
    insert into public.platform_notifications(target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id)
    values (registration_row.partner_user_id, auth.uid(), 'registration_removed', 'Participação removida pela organização',
      'A organização removeu a dupla de ' || tournament_row.name || '.', tournament_row.id, registration_row.id);
  end if;
  return jsonb_build_object('registration_id', registration_row.id, 'status', 'cancelled');
end;
$$;

create or replace function public.get_my_tournament_registration_checkout(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  athlete_row public.member_profiles%rowtype;
  partner_row public.member_profiles%rowtype;
  viewer_row public.member_profiles%rowtype;
  viewer_role text := 'owner';
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select * into registration_row from public.tournament_registrations registration
  where registration.tournament_id = p_tournament_id
    and registration.status <> 'cancelled'
    and (registration.athlete_user_id = auth.uid()
      or (registration.partner_user_id = auth.uid() and registration.partner_status in ('pending', 'accepted')))
  order by case when registration.athlete_user_id = auth.uid() then 0 else 1 end
  limit 1;
  if registration_row.id is not null and registration_row.athlete_user_id <> auth.uid() then viewer_role := 'partner'; end if;
  select * into viewer_row from public.member_profiles member where member.user_id = auth.uid();
  if registration_row.id is not null then
    select * into athlete_row from public.member_profiles member where member.user_id = registration_row.athlete_user_id;
    select * into partner_row from public.member_profiles member where member.user_id = registration_row.partner_user_id;
  else
    athlete_row := viewer_row;
  end if;
  return jsonb_build_object(
    'viewer_role', viewer_role,
    'registration', case when registration_row.id is null then null else to_jsonb(registration_row) end,
    'athlete', case when athlete_row.user_id is null then null else jsonb_build_object(
      'user_id', athlete_row.user_id, 'handle', athlete_row.handle, 'display_name', athlete_row.display_name,
      'photo_url', athlete_row.photo_url, 'sports_category', athlete_row.sports_category,
      'dominant_hand', athlete_row.dominant_hand, 'city', athlete_row.city, 'state', athlete_row.state
    ) end,
    'partner', case when partner_row.user_id is null then null else jsonb_build_object(
      'user_id', partner_row.user_id, 'handle', partner_row.handle, 'display_name', partner_row.display_name,
      'photo_url', partner_row.photo_url, 'sports_category', partner_row.sports_category,
      'dominant_hand', partner_row.dominant_hand, 'city', partner_row.city, 'state', partner_row.state
    ) end,
    'viewer', case when viewer_row.user_id is null then null else jsonb_build_object(
      'user_id', viewer_row.user_id, 'handle', viewer_row.handle, 'display_name', viewer_row.display_name,
      'photo_url', viewer_row.photo_url
    ) end
  );
end;
$$;

create or replace function public.get_my_registration_workflows()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', registration.id,
      'viewer_role', case when registration.athlete_user_id = auth.uid() then 'owner' else 'partner' end,
      'status', registration.status, 'workflow_status', registration.workflow_status,
      'payment_status', registration.payment_status, 'payment_method', registration.payment_method,
      'payment_proof_name', registration.payment_proof_name, 'payment_submitted_at', registration.payment_submitted_at,
      'payment_reviewed_at', registration.payment_reviewed_at, 'payment_rejection_reason', registration.payment_rejection_reason,
      'category', registration.category, 'partner_name', registration.partner_name,
      'partner_handle', registration.partner_handle, 'partner_status', registration.partner_status,
      'created_at', registration.created_at,
      'bucket', case
        when registration.status = 'confirmed'
          and coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')) < current_date::text then 'past'
        when registration.status = 'confirmed' then 'participating' else 'registered' end,
      'tournament', jsonb_build_object(
        'id', tournament.id, 'public_id', tournament.public_id, 'name', tournament.name, 'type', tournament.type,
        'event_date', coalesce(nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')),
        'event_end_date', coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', '')),
        'location', tournament.data ->> 'location',
        'cover_url', coalesce(tournament.data ->> 'coverImageThumbnailUrl', tournament.data ->> 'coverImageUrl', '')
      )
    ) order by registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    where registration.status <> 'cancelled'
      and (registration.athlete_user_id = auth.uid()
        or (registration.partner_user_id = auth.uid() and registration.partner_status in ('pending', 'accepted')))
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.search_tournament_partner_candidates(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.cancel_my_tournament_registration(uuid) from public, anon, authenticated;
revoke all on function public.cancel_my_tournament_partnership(uuid) from public, anon, authenticated;
revoke all on function public.remove_organization_tournament_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.get_my_tournament_registration_checkout(uuid) from public, anon, authenticated;
revoke all on function public.get_my_registration_workflows() from public, anon, authenticated;
grant execute on function public.search_tournament_partner_candidates(uuid, text, integer) to authenticated;
grant execute on function public.cancel_my_tournament_registration(uuid) to authenticated;
grant execute on function public.cancel_my_tournament_partnership(uuid) to authenticated;
grant execute on function public.remove_organization_tournament_registration(uuid, text) to authenticated;
grant execute on function public.get_my_tournament_registration_checkout(uuid) to authenticated;
grant execute on function public.get_my_registration_workflows() to authenticated;

commit;
