begin;

alter table public.member_profiles
  add column if not exists gender text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.member_profiles'::regclass
      and conname = 'member_profiles_gender_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_gender_check
      check (gender in ('', 'Masculino', 'Feminino'));
  end if;
end;
$$;

create or replace function public.can_view_registration_receipt(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    (string_to_array(p_object_name, '/'))[1] = auth.uid()::text
    or exists (
      select 1
      from public.tournament_registrations registration
      join public.tournaments tournament on tournament.id = registration.tournament_id
      where registration.id::text = (string_to_array(p_object_name, '/'))[2]
        and tournament.user_id = auth.uid()
    )
  );
$$;

drop policy if exists "registration_receipts_participant_read" on storage.objects;
create policy "registration_receipts_participant_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'registration-receipts'
  and public.can_view_registration_receipt(name)
);

create or replace function public.pair_approved_tournament_registrations(p_registration_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  pair_index integer := 1;
  selected_count integer := coalesce(array_length(p_registration_ids, 1), 0);
  unique_count integer := 0;
  paired_count integer := 0;
  first_row public.tournament_registrations%rowtype;
  second_row public.tournament_registrations%rowtype;
  first_member public.member_profiles%rowtype;
  second_member public.member_profiles%rowtype;
  tournament_row public.tournaments%rowtype;
  gender_mode text;
  normalized_type text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  if selected_count < 2 or selected_count > 32 or mod(selected_count, 2) <> 0 then
    raise exception 'Selecione uma quantidade par de atletas, entre 2 e 32.' using errcode = '22023';
  end if;
  select count(distinct registration_id)::integer into unique_count from unnest(p_registration_ids) registration_id;
  if unique_count <> selected_count then raise exception 'Um atleta foi selecionado mais de uma vez.' using errcode = '22023'; end if;

  while pair_index <= selected_count loop
    select * into first_row from public.tournament_registrations registration
    where registration.id = p_registration_ids[pair_index] for update;
    select * into second_row from public.tournament_registrations registration
    where registration.id = p_registration_ids[pair_index + 1] for update;

    if first_row.id is null or second_row.id is null
      or first_row.tournament_id <> second_row.tournament_id
      or coalesce(lower(first_row.category), '') <> coalesce(lower(second_row.category), '') then
      raise exception 'Os atletas de cada dupla devem estar no mesmo torneio e categoria.' using errcode = '22023';
    end if;
    select * into tournament_row from public.tournaments tournament where tournament.id = first_row.tournament_id;
    if tournament_row.user_id <> auth.uid() then
      raise exception 'Somente a organização responsável pode formar a dupla.' using errcode = '42501';
    end if;
    if first_row.workflow_status <> 'approved' or second_row.workflow_status <> 'approved'
      or first_row.partner_user_id is not null or second_row.partner_user_id is not null
      or first_row.paired_into_registration_id is not null or second_row.paired_into_registration_id is not null then
      raise exception 'Selecione apenas inscrições aprovadas que ainda estejam sem dupla.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.athlete_partner_searches partner_search
      where partner_search.tournament_id = first_row.tournament_id
        and partner_search.athlete_user_id = first_row.athlete_user_id
        and partner_search.active = true
    ) or not exists (
      select 1 from public.athlete_partner_searches partner_search
      where partner_search.tournament_id = second_row.tournament_id
        and partner_search.athlete_user_id = second_row.athlete_user_id
        and partner_search.active = true
    ) then
      raise exception 'Selecione dois atletas que estejam procurando dupla neste torneio.' using errcode = '22023';
    end if;

    select * into first_member from public.member_profiles member where member.user_id = first_row.athlete_user_id;
    select * into second_member from public.member_profiles member where member.user_id = second_row.athlete_user_id;
    if first_member.gender not in ('Masculino', 'Feminino') or second_member.gender not in ('Masculino', 'Feminino') then
      raise exception 'Os dois atletas precisam preencher o gênero no perfil antes de formar a dupla.' using errcode = '22023';
    end if;

    normalized_type := public.t360_search_normalize(tournament_row.type);
    gender_mode := public.t360_search_normalize(coalesce(
      tournament_row.data ->> 'participantGenderMode',
      tournament_row.data ->> 'genderMode',
      tournament_row.data ->> 'gender',
      case when normalized_type like '%mista%' then 'mista' else '' end
    ));
    if gender_mode in ('mista', 'misto', 'mixed') and first_member.gender = second_member.gender then
      raise exception 'Em torneio misto, a dupla precisa ter atletas de gêneros diferentes.' using errcode = '22023';
    end if;
    if gender_mode in ('masculino', 'homem', 'homens', 'male', 'masculine')
      and (first_member.gender <> 'Masculino' or second_member.gender <> 'Masculino') then
      raise exception 'Este torneio aceita somente uma dupla masculina.' using errcode = '22023';
    end if;
    if gender_mode in ('feminino', 'mulher', 'mulheres', 'female', 'feminine')
      and (first_member.gender <> 'Feminino' or second_member.gender <> 'Feminino') then
      raise exception 'Este torneio aceita somente uma dupla feminina.' using errcode = '22023';
    end if;

    update public.tournament_registrations
    set partner_user_id = second_row.athlete_user_id,
        partner_name = coalesce(nullif(second_member.display_name, ''), second_row.athlete_name),
        partner_handle = coalesce(second_member.handle, ''),
        partner_status = 'accepted', updated_at = now()
    where id = first_row.id;

    update public.tournament_registrations
    set partner_user_id = first_row.athlete_user_id,
        partner_name = coalesce(nullif(first_member.display_name, ''), first_row.athlete_name),
        partner_handle = coalesce(first_member.handle, ''),
        partner_status = 'accepted', paired_into_registration_id = first_row.id, updated_at = now()
    where id = second_row.id;

    update public.athlete_partner_searches set active = false, updated_at = now()
    where tournament_id = first_row.tournament_id
      and athlete_user_id in (first_row.athlete_user_id, second_row.athlete_user_id);

    insert into public.platform_notifications (
      target_user_id, actor_user_id, notification_type, title, message, tournament_id, registration_id
    ) values
    (first_row.athlete_user_id, auth.uid(), 'partner_accepted', 'Dupla formada pela organização',
      'A organização uniu você a @' || coalesce(nullif(second_member.handle, ''), second_row.athlete_name) || ' em ' || tournament_row.name || '.',
      tournament_row.id, first_row.id),
    (second_row.athlete_user_id, auth.uid(), 'partner_accepted', 'Dupla formada pela organização',
      'A organização uniu você a @' || coalesce(nullif(first_member.handle, ''), first_row.athlete_name) || ' em ' || tournament_row.name || '.',
      tournament_row.id, second_row.id);

    paired_count := paired_count + 1;
    pair_index := pair_index + 2;
  end loop;
  return jsonb_build_object('paired_count', paired_count);
end;
$$;

create or replace function public.get_my_organization_registrations_v2()
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
      'partner_user_id', registration.partner_user_id,
      'partner_name', registration.partner_name,
      'partner_handle', registration.partner_handle,
      'partner_status', registration.partner_status,
      'paired_into_registration_id', registration.paired_into_registration_id,
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
        'user_id', member.user_id, 'display_name', member.display_name, 'handle', member.handle,
        'photo_url', member.photo_url, 'sports_category', member.sports_category,
        'gender', member.gender, 'dominant_hand', member.dominant_hand,
        'city', member.city, 'state', member.state
      ) end,
      'partner', case when partner.user_id is null then null else jsonb_build_object(
        'user_id', partner.user_id, 'display_name', partner.display_name, 'handle', partner.handle,
        'photo_url', partner.photo_url, 'gender', partner.gender
      ) end,
      'partner_registration', case when paired_registration.id is null then null else jsonb_build_object(
        'id', paired_registration.id,
        'payment_method', paired_registration.payment_method,
        'payment_proof_path', paired_registration.payment_proof_path,
        'payment_proof_name', paired_registration.payment_proof_name,
        'payment_proof_mime', paired_registration.payment_proof_mime,
        'payment_proof_size', paired_registration.payment_proof_size
      ) end,
      'tournament', jsonb_build_object(
        'id', tournament.id, 'public_id', tournament.public_id, 'name', tournament.name,
        'type', tournament.type, 'data', tournament.data
      )
    ) order by tournament.created_at desc, registration.created_at desc)
    from public.tournament_registrations registration
    join public.tournaments tournament on tournament.id = registration.tournament_id
    left join public.member_profiles member on member.user_id = registration.athlete_user_id
    left join public.member_profiles partner on partner.user_id = registration.partner_user_id
    left join lateral (
      select paired.* from public.tournament_registrations paired
      where paired.paired_into_registration_id = registration.id and paired.status <> 'cancelled'
      order by paired.created_at asc limit 1
    ) paired_registration on true
    where tournament.user_id = auth.uid()
      and registration.status <> 'cancelled'
      and registration.paired_into_registration_id is null
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
  ), '[]'::jsonb);
end;
$$;

create or replace function public.upsert_my_member_profile_v3(
  p_display_name text,
  p_handle text default null,
  p_photo_url text default '',
  p_cover_url text default '',
  p_bio text default '',
  p_city text default '',
  p_state text default '',
  p_sports_category text default '',
  p_gender text default '',
  p_dominant_hand text default 'Não informado',
  p_shirt_size text default 'Não informado',
  p_whatsapp text default '',
  p_telegram text default '',
  p_instagram text default '',
  p_show_contacts boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_gender text := initcap(lower(btrim(coalesce(p_gender, ''))));
  profile_json jsonb;
begin
  if normalized_gender not in ('Masculino', 'Feminino') then
    raise exception 'Selecione o gênero do atleta.' using errcode = '22023';
  end if;

  profile_json := public.upsert_my_member_profile_v2(
    p_display_name => p_display_name,
    p_handle => p_handle,
    p_photo_url => p_photo_url,
    p_cover_url => p_cover_url,
    p_bio => p_bio,
    p_city => p_city,
    p_state => p_state,
    p_sports_category => p_sports_category,
    p_dominant_hand => p_dominant_hand,
    p_shirt_size => p_shirt_size,
    p_whatsapp => p_whatsapp,
    p_telegram => p_telegram,
    p_instagram => p_instagram,
    p_show_contacts => p_show_contacts
  );

  update public.member_profiles
  set gender = normalized_gender
  where user_id = auth.uid();

  return profile_json || jsonb_build_object('gender', normalized_gender);
end;
$$;

create or replace function public.search_tournament_partner_candidates_v2(
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
  tournament_row public.tournaments%rowtype;
  viewer_gender text;
  gender_mode text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode = '42501'; end if;
  select * into tournament_row from public.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.is_public = true
    and coalesce(tournament.data ->> 'deletedAt', '') = '';
  if tournament_row.id is null then raise exception 'Torneio não encontrado.' using errcode = 'P0002'; end if;
  if char_length(normalized_query) < 2 then return '[]'::jsonb; end if;

  select member.gender into viewer_gender from public.member_profiles member where member.user_id = auth.uid();
  gender_mode := public.t360_search_normalize(coalesce(
    tournament_row.data ->> 'participantGenderMode',
    tournament_row.data ->> 'genderMode',
    tournament_row.data ->> 'gender',
    case when tournament_row.type ilike '%mista%' then 'mista' else '' end
  ));

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', candidate.user_id,
      'handle', candidate.handle,
      'display_name', candidate.display_name,
      'photo_url', candidate.photo_url,
      'sports_category', candidate.sports_category,
      'dominant_hand', candidate.dominant_hand,
      'gender', candidate.gender,
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
        and member.gender in ('Masculino', 'Feminino')
        and case
          when gender_mode in ('mista', 'misto', 'mixed') then member.gender <> coalesce(viewer_gender, '')
          when gender_mode in ('masculino', 'homem', 'homens', 'male', 'masculine') then member.gender = 'Masculino' and viewer_gender = 'Masculino'
          when gender_mode in ('feminino', 'mulher', 'mulheres', 'female', 'feminine') then member.gender = 'Feminino' and viewer_gender = 'Feminino'
          else true
        end
        and public.t360_search_normalize(concat_ws(' ', member.display_name, member.handle, member.city, member.state))
          like '%' || normalized_query || '%'
      order by sort_rank, public.t360_search_normalize(member.display_name), member.user_id
      limit safe_limit
    ) candidate
  ), '[]'::jsonb);
end;
$$;

create or replace function public.validate_tournament_registration_eligibility(
  p_tournament_id uuid,
  p_partner_handle text default '',
  p_looking_for_partner boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  tournament_row public.tournaments%rowtype;
  athlete_row public.member_profiles%rowtype;
  partner_row public.member_profiles%rowtype;
  normalized_type text;
  gender_mode text;
  requires_partner boolean := false;
  normalized_partner_handle text := lower(regexp_replace(btrim(coalesce(p_partner_handle, '')), '^@+', ''));
begin
  if auth.uid() is null then raise exception 'Entre com uma conta de atleta para se inscrever.' using errcode = '42501'; end if;
  select * into tournament_row from public.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.is_public = true
    and coalesce(tournament.data ->> 'deletedAt', '') = '';
  if tournament_row.id is null then raise exception 'Torneio não encontrado.' using errcode = 'P0002'; end if;
  select * into athlete_row from public.member_profiles member where member.user_id = auth.uid();
  if athlete_row.user_id is null or athlete_row.gender not in ('Masculino', 'Feminino') then
    raise exception 'Preencha o gênero no seu perfil de atleta antes de se inscrever.' using errcode = '22023';
  end if;

  normalized_type := public.t360_search_normalize(tournament_row.type);
  requires_partner := normalized_type <> 'campeonato cearense individual' and (
    normalized_type like '%dupla fixa%'
    or normalized_type like 'copa -%'
    or normalized_type in ('copinha - grupos de 3', 'campeonato cearense', 'modelo play ranking', 'copa sunset')
  );
  gender_mode := public.t360_search_normalize(coalesce(
    tournament_row.data ->> 'participantGenderMode',
    tournament_row.data ->> 'genderMode',
    tournament_row.data ->> 'gender',
    case when normalized_type like '%mista%' then 'mista' else '' end
  ));

  if gender_mode in ('masculino', 'homem', 'homens', 'male', 'masculine') and athlete_row.gender <> 'Masculino' then
    raise exception 'Este torneio aceita somente atletas com gênero masculino informado no perfil.' using errcode = '22023';
  end if;
  if gender_mode in ('feminino', 'mulher', 'mulheres', 'female', 'feminine') and athlete_row.gender <> 'Feminino' then
    raise exception 'Este torneio aceita somente atletas com gênero feminino informado no perfil.' using errcode = '22023';
  end if;

  if requires_partner and normalized_partner_handle = '' and not coalesce(p_looking_for_partner, false) then
    raise exception 'Em dupla fixa, escolha o outro atleta ou marque Quero encontrar uma dupla.' using errcode = '22023';
  end if;

  if normalized_partner_handle <> '' then
    select * into partner_row from public.member_profiles member
    where lower(member.handle) = normalized_partner_handle and member.user_id <> auth.uid();
    if partner_row.user_id is null then raise exception 'Atleta convidado não encontrado.' using errcode = 'P0002'; end if;
    if partner_row.gender not in ('Masculino', 'Feminino') then
      raise exception 'O atleta convidado precisa preencher o gênero no perfil.' using errcode = '22023';
    end if;
    if gender_mode in ('mista', 'misto', 'mixed') and partner_row.gender = athlete_row.gender then
      raise exception 'Em dupla mista, os dois atletas devem ter gêneros diferentes no perfil.' using errcode = '22023';
    end if;
    if gender_mode in ('masculino', 'homem', 'homens', 'male', 'masculine') and partner_row.gender <> 'Masculino' then
      raise exception 'Este torneio aceita somente duplas masculinas.' using errcode = '22023';
    end if;
    if gender_mode in ('feminino', 'mulher', 'mulheres', 'female', 'feminine') and partner_row.gender <> 'Feminino' then
      raise exception 'Este torneio aceita somente duplas femininas.' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object(
    'eligible', true,
    'requires_partner', requires_partner,
    'gender_mode', gender_mode
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

  perform public.validate_tournament_registration_eligibility(
    registration_row.tournament_id,
    normalized_handle,
    coalesce(p_looking_for_partner, false)
  );

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

create or replace function public.get_my_tournament_registration_checkout_v2(p_tournament_id uuid)
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
      'gender', athlete_row.gender, 'dominant_hand', athlete_row.dominant_hand,
      'city', athlete_row.city, 'state', athlete_row.state
    ) end,
    'partner', case when partner_row.user_id is null then null else jsonb_build_object(
      'user_id', partner_row.user_id, 'handle', partner_row.handle, 'display_name', partner_row.display_name,
      'photo_url', partner_row.photo_url, 'sports_category', partner_row.sports_category,
      'gender', partner_row.gender, 'dominant_hand', partner_row.dominant_hand,
      'city', partner_row.city, 'state', partner_row.state
    ) end,
    'viewer', case when viewer_row.user_id is null then null else jsonb_build_object(
      'user_id', viewer_row.user_id, 'handle', viewer_row.handle, 'display_name', viewer_row.display_name,
      'photo_url', viewer_row.photo_url, 'gender', viewer_row.gender
    ) end
  );
end;
$$;

revoke all on function public.upsert_my_member_profile_v3(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.search_tournament_partner_candidates_v2(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.validate_tournament_registration_eligibility(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.get_my_tournament_registration_checkout_v2(uuid) from public, anon, authenticated;
revoke all on function public.submit_my_tournament_registration_proof_v2(uuid,text,text,text,text,bigint,boolean,text) from public, anon, authenticated;
revoke all on function public.can_view_registration_receipt(text) from public, anon, authenticated;
revoke all on function public.pair_approved_tournament_registrations(uuid[]) from public, anon, authenticated;
revoke all on function public.get_my_organization_registrations_v2() from public, anon, authenticated;
grant execute on function public.upsert_my_member_profile_v3(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.search_tournament_partner_candidates_v2(uuid,text,integer) to authenticated;
grant execute on function public.validate_tournament_registration_eligibility(uuid,text,boolean) to authenticated;
grant execute on function public.get_my_tournament_registration_checkout_v2(uuid) to authenticated;
grant execute on function public.submit_my_tournament_registration_proof_v2(uuid,text,text,text,text,bigint,boolean,text) to authenticated;
grant execute on function public.can_view_registration_receipt(text) to authenticated;
grant execute on function public.pair_approved_tournament_registrations(uuid[]) to authenticated;
grant execute on function public.get_my_organization_registrations_v2() to authenticated;

commit;
