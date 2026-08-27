begin;

alter table public.tournament_registrations
  add column if not exists partner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists partner_handle text not null default '',
  add column if not exists partner_status text not null default 'none',
  add column if not exists partner_invited_at timestamptz,
  add column if not exists partner_responded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_partner_status_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_partner_status_check
      check (partner_status in ('none', 'pending', 'accepted', 'rejected'));
  end if;
end;
$$;

create index if not exists tournament_registrations_partner_user_idx
on public.tournament_registrations (partner_user_id, partner_status, updated_at desc)
where partner_user_id is not null;

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (notification_type in (
    'registration_submitted',
    'registration_approved',
    'registration_rejected',
    'partner_invitation',
    'partner_accepted',
    'partner_rejected'
  )),
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 300),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  registration_id uuid references public.tournament_registrations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists platform_notifications_target_idx
on public.platform_notifications (target_user_id, read_at, created_at desc);

alter table public.platform_notifications enable row level security;
revoke insert, update, delete on public.platform_notifications from public, anon, authenticated;
grant select on public.platform_notifications to authenticated;

drop policy if exists platform_notifications_owner_read on public.platform_notifications;
create policy platform_notifications_owner_read
on public.platform_notifications for select
to authenticated
using (target_user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-regulations',
  'tournament-regulations',
  true,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament_regulations_public_read" on storage.objects;
create policy "tournament_regulations_public_read"
on storage.objects for select
to public
using (bucket_id = 'tournament-regulations');

drop policy if exists "tournament_regulations_owner_insert" on storage.objects;
create policy "tournament_regulations_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tournament-regulations'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

drop policy if exists "tournament_regulations_owner_update" on storage.objects;
create policy "tournament_regulations_owner_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'tournament-regulations'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
)
with check (
  bucket_id = 'tournament-regulations'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

drop policy if exists "tournament_regulations_owner_delete" on storage.objects;
create policy "tournament_regulations_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tournament-regulations'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

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
    and member.user_id <> auth.uid()
  limit 1;

  if partner_row.user_id is null then return null; end if;
  return jsonb_build_object(
    'user_id', partner_row.user_id,
    'handle', partner_row.handle,
    'display_name', partner_row.display_name,
    'photo_url', partner_row.photo_url,
    'sports_category', partner_row.sports_category,
    'city', partner_row.city,
    'state', partner_row.state
  );
end;
$$;

create or replace function public.submit_my_tournament_registration_proof_v2(
  p_registration_id uuid,
  p_payment_method text,
  p_payment_proof_path text,
  p_payment_proof_name text,
  p_payment_proof_mime text,
  p_payment_proof_size bigint,
  p_looking_for_partner boolean default false,
  p_partner_handle text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage, auth
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  athlete_row public.member_profiles%rowtype;
  partner_row public.member_profiles%rowtype;
  normalized_handle text := lower(trim(leading '@' from btrim(coalesce(p_partner_handle, ''))));
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if p_payment_method not in ('pix', 'card') then raise exception 'Escolha Pix ou cartão.' using errcode = '22023'; end if;
  if p_payment_proof_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    or coalesce(p_payment_proof_size, 0) <= 0 or p_payment_proof_size > 10485760 then
    raise exception 'Comprovante inválido. Envie PDF, JPG, PNG ou WebP com até 10 MB.' using errcode = '22023';
  end if;
  if (string_to_array(p_payment_proof_path, '/'))[1] <> auth.uid()::text
    or (string_to_array(p_payment_proof_path, '/'))[2] <> p_registration_id::text then
    raise exception 'Caminho do comprovante inválido.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'registration-receipts'
      and object.name = p_payment_proof_path
      and object.owner_id = auth.uid()::text
  ) then raise exception 'O comprovante privado não foi encontrado.' using errcode = 'P0002'; end if;

  select * into registration_row
  from public.tournament_registrations registration
  where registration.id = p_registration_id
    and registration.athlete_user_id = auth.uid()
    and registration.status <> 'cancelled'
  for update;
  if registration_row.id is null then raise exception 'Inscrição não encontrada.' using errcode = 'P0002'; end if;

  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;
  select * into athlete_row from public.member_profiles member where member.user_id = auth.uid();

  if normalized_handle <> '' then
    select * into partner_row
    from public.member_profiles member
    where lower(coalesce(member.handle, '')) = normalized_handle
      and member.is_public = true
      and member.user_id <> auth.uid()
    limit 1;
    if partner_row.user_id is null then
      raise exception 'Nenhum atleta foi encontrado com esse endereço único.' using errcode = 'P0002';
    end if;
  end if;

  update public.tournament_registrations registration
  set payment_method = p_payment_method,
      payment_proof_path = p_payment_proof_path,
      payment_proof_name = left(btrim(coalesce(p_payment_proof_name, 'comprovante')), 180),
      payment_proof_mime = p_payment_proof_mime,
      payment_proof_size = p_payment_proof_size,
      payment_submitted_at = now(),
      payment_reviewed_at = null,
      payment_reviewed_by = null,
      payment_rejection_reason = '',
      workflow_status = 'submitted',
      payment_status = 'pending',
      status = 'pending',
      partner_user_id = partner_row.user_id,
      partner_handle = coalesce(partner_row.handle, ''),
      partner_name = coalesce(partner_row.display_name, ''),
      partner_status = case when partner_row.user_id is null then 'none' else 'pending' end,
      partner_invited_at = case when partner_row.user_id is null then null else now() end,
      partner_responded_at = null,
      updated_at = now()
  where registration.id = p_registration_id
  returning * into registration_row;

  if coalesce(p_looking_for_partner, false) and partner_row.user_id is null then
    perform public.set_my_partner_search(registration_row.tournament_id, registration_row.category, true);
  else
    update public.athlete_partner_searches set active = false, updated_at = now()
    where tournament_id = registration_row.tournament_id and athlete_user_id = auth.uid();
  end if;

  insert into public.platform_notifications (
    target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id
  ) values (
    tournament_row.user_id,
    auth.uid(),
    'registration_submitted',
    'Nova inscrição para conferir',
    coalesce(nullif(athlete_row.display_name, ''), registration_row.athlete_name, 'Um atleta')
      || ' finalizou a inscrição em ' || tournament_row.name || '.',
    tournament_row.id,
    registration_row.id
  );

  if partner_row.user_id is not null then
    insert into public.platform_notifications (
      target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id,
      data
    ) values (
      partner_row.user_id,
      auth.uid(),
      'partner_invitation',
      'Convite para formar dupla',
      coalesce(nullif(athlete_row.display_name, ''), registration_row.athlete_name, 'Um atleta')
        || ' convidou você para jogar ' || tournament_row.name || '.',
      tournament_row.id,
      registration_row.id,
      jsonb_build_object('partner_handle', partner_row.handle)
    );
  end if;

  return to_jsonb(registration_row);
end;
$$;

create or replace function public.respond_to_tournament_partner_invitation(
  p_registration_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
  partner_row public.member_profiles%rowtype;
begin
  if auth.uid() is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;

  update public.tournament_registrations registration
  set partner_status = p_decision,
      partner_responded_at = now(),
      updated_at = now()
  where registration.id = p_registration_id
    and registration.partner_user_id = auth.uid()
    and registration.partner_status = 'pending'
  returning * into registration_row;
  if registration_row.id is null then raise exception 'Convite não encontrado ou já respondido.' using errcode = 'P0002'; end if;

  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;
  select * into partner_row from public.member_profiles member where member.user_id = auth.uid();

  insert into public.platform_notifications (
    target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id
  ) values (
    registration_row.athlete_user_id,
    auth.uid(),
    case when p_decision = 'accepted' then 'partner_accepted' else 'partner_rejected' end,
    case when p_decision = 'accepted' then 'Convite de dupla aceito' else 'Convite de dupla recusado' end,
    coalesce(nullif(partner_row.display_name, ''), '@' || registration_row.partner_handle, 'O atleta convidado')
      || case when p_decision = 'accepted' then ' confirmou a dupla em ' else ' não confirmou a dupla em ' end
      || tournament_row.name || '.',
    tournament_row.id,
    registration_row.id
  );

  update public.platform_notifications notification
  set read_at = coalesce(notification.read_at, now())
  where notification.target_user_id = auth.uid()
    and notification.registration_id = p_registration_id
    and notification.notification_type = 'partner_invitation';

  return to_jsonb(registration_row);
end;
$$;

create or replace function public.list_my_platform_notifications(p_limit integer default 60)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'type', item.notification_type,
    'title', item.title,
    'message', item.message,
    'read_at', item.read_at,
    'created_at', item.created_at,
    'registration_id', item.registration_id,
    'tournament', case when tournament.id is null then null else jsonb_build_object(
      'id', tournament.id,
      'public_id', tournament.public_id,
      'name', tournament.name
    ) end,
    'actor', case when actor.user_id is null then null else jsonb_build_object(
      'user_id', actor.user_id,
      'display_name', actor.display_name,
      'handle', actor.handle,
      'photo_url', actor.photo_url
    ) end,
    'data', coalesce(item.data, '{}'::jsonb) || jsonb_build_object(
      'partner_status', coalesce(registration.partner_status, 'none')
    )
  ) order by item.created_at desc), '[]'::jsonb)
  from (
    select * from public.platform_notifications notification
    where notification.target_user_id = auth.uid()
    order by notification.created_at desc
    limit greatest(1, least(coalesce(p_limit, 60), 100))
  ) item
  left join public.tournaments tournament on tournament.id = item.tournament_id
  left join public.tournament_registrations registration on registration.id = item.registration_id
  left join public.member_profiles actor on actor.user_id = item.actor_user_id;
$$;

create or replace function public.mark_my_platform_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  update public.platform_notifications notification
  set read_at = now()
  where notification.target_user_id = auth.uid()
    and notification.read_at is null
    and (p_notification_id is null or notification.id = p_notification_id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.get_public_tournament_athlete_identities(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with identities as (
    select
      registration.athlete_user_id as user_id,
      member.handle,
      coalesce(nullif(member.display_name, ''), registration.athlete_name) as display_name,
      member.photo_url,
      registration.category,
      registration.id as registration_id,
      'athlete'::text as registration_role
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    where registration.tournament_id = p_tournament_id
      and registration.workflow_status = 'approved'
      and tournament.is_public = true
    union all
    select
      registration.partner_user_id,
      partner.handle,
      coalesce(nullif(partner.display_name, ''), registration.partner_name),
      partner.photo_url,
      registration.category,
      registration.id,
      'partner'::text
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    join public.member_profiles partner on partner.user_id = registration.partner_user_id
    where registration.tournament_id = p_tournament_id
      and registration.workflow_status = 'approved'
      and registration.partner_status = 'accepted'
      and tournament.is_public = true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', identity.user_id,
    'handle', identity.handle,
    'display_name', identity.display_name,
    'photo_url', identity.photo_url,
    'category', identity.category,
    'registration_id', identity.registration_id,
    'registration_role', identity.registration_role
  ) order by identity.display_name), '[]'::jsonb)
  from identities identity;
$$;

create or replace function public.review_tournament_registration_workflow(
  p_registration_id uuid,
  p_decision text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  tournament_row public.tournaments%rowtype;
begin
  if auth.uid() is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida.' using errcode = '42501';
  end if;

  update public.tournament_registrations registration
  set workflow_status = p_decision,
      status = case when p_decision = 'approved' then 'confirmed' else 'rejected' end,
      payment_status = case when p_decision = 'approved' then 'paid' else 'pending' end,
      payment_reviewed_at = now(),
      payment_reviewed_by = auth.uid(),
      payment_rejection_reason = case when p_decision = 'rejected' then left(btrim(coalesce(p_reason, '')), 300) else '' end,
      updated_at = now()
  where registration.id = p_registration_id
    and registration.workflow_status = 'submitted'
    and exists (
      select 1 from public.tournaments tournament
      where tournament.id = registration.tournament_id and tournament.user_id = auth.uid()
    )
  returning * into registration_row;

  if registration_row.id is null then
    raise exception 'Inscrição não encontrada ou ainda sem comprovante.' using errcode = 'P0002';
  end if;
  select * into tournament_row from public.tournaments tournament where tournament.id = registration_row.tournament_id;

  insert into public.platform_notifications (
    target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id
  ) values (
    registration_row.athlete_user_id,
    auth.uid(),
    case when p_decision = 'approved' then 'registration_approved' else 'registration_rejected' end,
    case when p_decision = 'approved' then 'Inscrição aprovada' else 'Inscrição precisa de revisão' end,
    case when p_decision = 'approved'
      then 'Sua participação em ' || tournament_row.name || ' foi confirmada.'
      else 'A organização pediu o reenvio do comprovante de ' || tournament_row.name || '.'
    end,
    tournament_row.id,
    registration_row.id
  );
  return to_jsonb(registration_row);
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
  member_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select * into registration_row from public.tournament_registrations registration
  where registration.tournament_id = p_tournament_id and registration.athlete_user_id = auth.uid() limit 1;
  select * into member_row from public.member_profiles member where member.user_id = auth.uid();
  return jsonb_build_object(
    'registration', case when registration_row.id is null then null else to_jsonb(registration_row) end,
    'athlete', case when member_row.user_id is null then null else jsonb_build_object(
      'user_id', member_row.user_id,
      'handle', member_row.handle,
      'display_name', member_row.display_name,
      'photo_url', member_row.photo_url,
      'sports_category', member_row.sports_category,
      'dominant_hand', member_row.dominant_hand,
      'city', member_row.city,
      'state', member_row.state
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
      'status', registration.status,
      'workflow_status', registration.workflow_status,
      'payment_status', registration.payment_status,
      'payment_method', registration.payment_method,
      'payment_proof_name', registration.payment_proof_name,
      'payment_submitted_at', registration.payment_submitted_at,
      'payment_reviewed_at', registration.payment_reviewed_at,
      'payment_rejection_reason', registration.payment_rejection_reason,
      'category', registration.category,
      'partner_name', registration.partner_name,
      'partner_handle', registration.partner_handle,
      'partner_status', registration.partner_status,
      'created_at', registration.created_at,
      'bucket', case
        when registration.status = 'confirmed'
          and coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')) < current_date::text then 'past'
        when registration.status = 'confirmed' then 'participating'
        else 'registered'
      end,
      'tournament', jsonb_build_object(
        'id', tournament.id,
        'public_id', tournament.public_id,
        'name', tournament.name,
        'type', tournament.type,
        'event_date', coalesce(nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')),
        'event_end_date', coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', '')),
        'location', tournament.data ->> 'location',
        'cover_url', coalesce(tournament.data ->> 'coverImageThumbnailUrl', tournament.data ->> 'coverImageUrl', '')
      )
    ) order by registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    where registration.athlete_user_id = auth.uid()
      and registration.status <> 'cancelled'
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_my_organization_registrations()
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
      'athlete_user_id', registration.athlete_user_id,
      'athlete_name', registration.athlete_name,
      'partner_name', registration.partner_name,
      'partner_handle', registration.partner_handle,
      'partner_status', registration.partner_status,
      'category', registration.category,
      'registration_status', registration.status,
      'workflow_status', registration.workflow_status,
      'payment_status', registration.payment_status,
      'payment_method', registration.payment_method,
      'payment_proof_path', registration.payment_proof_path,
      'payment_proof_name', registration.payment_proof_name,
      'payment_proof_mime', registration.payment_proof_mime,
      'payment_proof_size', registration.payment_proof_size,
      'payment_submitted_at', registration.payment_submitted_at,
      'payment_reviewed_at', registration.payment_reviewed_at,
      'payment_rejection_reason', registration.payment_rejection_reason,
      'looking_for_partner', exists (
        select 1 from public.athlete_partner_searches partner_search
        where partner_search.tournament_id = registration.tournament_id
          and partner_search.athlete_user_id = registration.athlete_user_id
          and partner_search.active = true
      ),
      'created_at', registration.created_at,
      'athlete', case when member.user_id is null then null else jsonb_build_object(
        'display_name', member.display_name,
        'handle', member.handle,
        'photo_url', member.photo_url,
        'sports_category', member.sports_category,
        'dominant_hand', member.dominant_hand,
        'city', member.city,
        'state', member.state
      ) end,
      'partner', case when partner.user_id is null then null else jsonb_build_object(
        'user_id', partner.user_id,
        'display_name', partner.display_name,
        'handle', partner.handle,
        'photo_url', partner.photo_url
      ) end,
      'tournament', jsonb_build_object(
        'id', tournament.id,
        'public_id', tournament.public_id,
        'name', tournament.name,
        'type', tournament.type,
        'data', tournament.data
      )
    ) order by tournament.created_at desc, registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    left join public.member_profiles partner on partner.user_id = registration.partner_user_id
    where tournament.user_id = auth.uid()
      and registration.status <> 'cancelled'
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.find_tournament_partner_by_handle(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_my_tournament_registration_proof_v2(uuid, text, text, text, text, bigint, boolean, text) from public, anon, authenticated;
revoke all on function public.respond_to_tournament_partner_invitation(uuid, text) from public, anon, authenticated;
revoke all on function public.list_my_platform_notifications(integer) from public, anon, authenticated;
revoke all on function public.mark_my_platform_notifications_read(uuid) from public, anon, authenticated;
revoke all on function public.get_public_tournament_athlete_identities(uuid) from public, anon, authenticated;
revoke all on function public.get_my_tournament_registration_checkout(uuid) from public, anon, authenticated;
revoke all on function public.get_my_registration_workflows() from public, anon, authenticated;
revoke all on function public.get_my_organization_registrations() from public, anon, authenticated;

grant execute on function public.find_tournament_partner_by_handle(uuid, text) to authenticated;
grant execute on function public.submit_my_tournament_registration_proof_v2(uuid, text, text, text, text, bigint, boolean, text) to authenticated;
grant execute on function public.respond_to_tournament_partner_invitation(uuid, text) to authenticated;
grant execute on function public.list_my_platform_notifications(integer) to authenticated;
grant execute on function public.mark_my_platform_notifications_read(uuid) to authenticated;
grant execute on function public.get_public_tournament_athlete_identities(uuid) to anon, authenticated;
grant execute on function public.get_my_tournament_registration_checkout(uuid) to authenticated;
grant execute on function public.get_my_registration_workflows() to authenticated;
grant execute on function public.get_my_organization_registrations() to authenticated;

commit;
