begin;

alter table public.tournament_registrations
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_proof_path text not null default '',
  add column if not exists payment_proof_name text not null default '',
  add column if not exists payment_proof_mime text not null default '',
  add column if not exists payment_proof_size bigint not null default 0,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_reviewed_at timestamptz,
  add column if not exists payment_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_rejection_reason text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_workflow_status_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_workflow_status_check
      check (workflow_status in ('draft', 'submitted', 'approved', 'rejected'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_payment_method_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_payment_method_check
      check (payment_method in ('', 'pix', 'card'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tournament_registrations'::regclass
      and conname = 'tournament_registrations_payment_proof_size_check'
  ) then
    alter table public.tournament_registrations
      add constraint tournament_registrations_payment_proof_size_check
      check (payment_proof_size between 0 and 10485760);
  end if;
end;
$$;

create index if not exists tournament_registrations_workflow_idx
on public.tournament_registrations (tournament_id, workflow_status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'registration-receipts',
  'registration-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "registration_receipts_participant_read" on storage.objects;
create policy "registration_receipts_participant_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'registration-receipts'
  and (
    (string_to_array(name, '/'))[1] = auth.uid()::text
    or exists (
      select 1
      from public.tournament_registrations registration
      join public.tournaments tournament on tournament.id = registration.tournament_id
      where registration.id::text = (string_to_array(name, '/'))[2]
        and tournament.user_id = auth.uid()
    )
  )
);

drop policy if exists "registration_receipts_athlete_insert" on storage.objects;
create policy "registration_receipts_athlete_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'registration-receipts'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
  and exists (
    select 1
    from public.tournament_registrations registration
    where registration.id::text = (string_to_array(name, '/'))[2]
      and registration.athlete_user_id = auth.uid()
  )
);

drop policy if exists "registration_receipts_athlete_update" on storage.objects;
create policy "registration_receipts_athlete_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'registration-receipts'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
)
with check (
  bucket_id = 'registration-receipts'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

drop policy if exists "registration_receipts_athlete_delete" on storage.objects;
create policy "registration_receipts_athlete_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'registration-receipts'
  and (string_to_array(name, '/'))[1] = auth.uid()::text
);

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
  if auth.uid() is null or public.current_account_role() <> 'athlete' then
    raise exception 'Entre com uma conta de atleta para se inscrever.' using errcode = '42501';
  end if;

  select * into registration_row
  from public.submit_tournament_registration(p_tournament_id, p_athlete_name, p_partner_name, p_category);
  member_row := private.provision_member_profile(auth.uid());

  return jsonb_build_object(
    'registration', to_jsonb(registration_row),
    'athlete', jsonb_build_object(
      'user_id', member_row.user_id,
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
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select * into registration_row
  from public.tournament_registrations registration
  where registration.tournament_id = p_tournament_id
    and registration.athlete_user_id = auth.uid()
  limit 1;
  select * into member_row from public.member_profiles member where member.user_id = auth.uid();

  return jsonb_build_object(
    'registration', case when registration_row.id is null then null else to_jsonb(registration_row) end,
    'athlete', case when member_row.user_id is null then null else jsonb_build_object(
      'user_id', member_row.user_id,
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

create or replace function public.submit_my_tournament_registration_proof(
  p_registration_id uuid,
  p_payment_method text,
  p_payment_proof_path text,
  p_payment_proof_name text,
  p_payment_proof_mime text,
  p_payment_proof_size bigint,
  p_looking_for_partner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, storage
as $$
declare
  registration_row public.tournament_registrations%rowtype;
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
  ) then
    raise exception 'O comprovante privado não foi encontrado.' using errcode = 'P0002';
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
      updated_at = now()
  where registration.id = p_registration_id
    and registration.athlete_user_id = auth.uid()
    and registration.status <> 'cancelled'
  returning * into registration_row;

  if registration_row.id is null then raise exception 'Inscrição não encontrada.' using errcode = 'P0002'; end if;

  if coalesce(p_looking_for_partner, false) and btrim(coalesce(registration_row.partner_name, '')) = '' then
    perform public.set_my_partner_search(registration_row.tournament_id, registration_row.category, true);
  else
    update public.athlete_partner_searches set active = false, updated_at = now()
    where tournament_id = registration_row.tournament_id and athlete_user_id = auth.uid();
  end if;

  return to_jsonb(registration_row);
end;
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
  return to_jsonb(registration_row);
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
    where tournament.user_id = auth.uid()
      and registration.status <> 'cancelled'
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.prepare_my_tournament_registration(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.get_my_tournament_registration_checkout(uuid) from public, anon, authenticated;
revoke all on function public.submit_my_tournament_registration_proof(uuid, text, text, text, text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.review_tournament_registration_workflow(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_my_registration_workflows() from public, anon, authenticated;
revoke all on function public.get_my_organization_registrations() from public, anon, authenticated;

grant execute on function public.prepare_my_tournament_registration(uuid, text, text, text) to authenticated;
grant execute on function public.get_my_tournament_registration_checkout(uuid) to authenticated;
grant execute on function public.submit_my_tournament_registration_proof(uuid, text, text, text, text, bigint, boolean) to authenticated;
grant execute on function public.review_tournament_registration_workflow(uuid, text, text) to authenticated;
grant execute on function public.get_my_registration_workflows() to authenticated;
grant execute on function public.get_my_organization_registrations() to authenticated;

commit;
