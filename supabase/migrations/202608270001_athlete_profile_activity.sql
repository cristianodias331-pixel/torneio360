begin;

alter table public.member_profiles
  add column if not exists sports_category text not null default '',
  add column if not exists dominant_hand text not null default 'Não informado',
  add column if not exists shirt_size text not null default 'Não informado',
  add column if not exists whatsapp text not null default '',
  add column if not exists telegram text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists show_contacts boolean not null default false;

create or replace function public.upsert_my_member_profile_v2(
  p_display_name text,
  p_handle text default null,
  p_photo_url text default '',
  p_cover_url text default '',
  p_bio text default '',
  p_city text default '',
  p_state text default '',
  p_sports_category text default '',
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
  normalized_name text := btrim(coalesce(p_display_name, ''));
  normalized_handle text := nullif(lower(btrim(coalesce(p_handle, ''))), '');
  normalized_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g');
  normalized_telegram text := regexp_replace(btrim(coalesce(p_telegram, '')), '^@+', '');
  normalized_instagram text := regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', '');
  member_row public.member_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 80 then
    raise exception 'O nome deve ter entre 2 e 80 caracteres.' using errcode = '22023';
  end if;
  if normalized_handle is not null and normalized_handle !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Nome de usuário inválido.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_bio, '')) > 240
    or char_length(coalesce(p_city, '')) > 80
    or char_length(coalesce(p_state, '')) > 80
    or char_length(coalesce(p_sports_category, '')) > 40 then
    raise exception 'Um dos textos do perfil ultrapassou o limite permitido.' using errcode = '22023';
  end if;
  if coalesce(p_dominant_hand, 'Não informado') not in ('Destro', 'Canhoto', 'Ambidestro', 'Não informado')
    or coalesce(p_shirt_size, 'Não informado') not in ('PP', 'P', 'M', 'G', 'GG', 'XGG', 'Não informado') then
    raise exception 'Dados esportivos inválidos.' using errcode = '22023';
  end if;
  if char_length(normalized_whatsapp) > 20
    or char_length(normalized_telegram) > 64
    or char_length(normalized_instagram) > 64 then
    raise exception 'Um dos contatos ultrapassou o limite permitido.' using errcode = '22023';
  end if;

  perform private.provision_member_profile(auth.uid());

  update public.member_profiles
  set
    display_name = normalized_name,
    handle = normalized_handle,
    photo_url = btrim(coalesce(p_photo_url, '')),
    cover_url = btrim(coalesce(p_cover_url, '')),
    bio = btrim(coalesce(p_bio, '')),
    city = btrim(coalesce(p_city, '')),
    state = btrim(coalesce(p_state, '')),
    sports_category = btrim(coalesce(p_sports_category, '')),
    dominant_hand = coalesce(p_dominant_hand, 'Não informado'),
    shirt_size = coalesce(p_shirt_size, 'Não informado'),
    whatsapp = normalized_whatsapp,
    telegram = normalized_telegram,
    instagram = normalized_instagram,
    show_contacts = coalesce(p_show_contacts, false),
    is_public = true
  where user_id = auth.uid()
  returning * into member_row;

  return to_jsonb(member_row) || jsonb_build_object('is_public', true);
exception
  when unique_violation then
    raise exception 'Este nome de usuário já está em uso.' using errcode = '23505';
end;
$$;

revoke all on function public.upsert_my_member_profile_v2(
  text, text, text, text, text, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.upsert_my_member_profile_v2(
  text, text, text, text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

create table if not exists public.athlete_partner_searches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, athlete_user_id)
);

create index if not exists athlete_partner_searches_active_tournament_idx
on public.athlete_partner_searches (tournament_id, lower(category), updated_at desc)
where active = true;

alter table public.athlete_partner_searches enable row level security;
revoke all on public.athlete_partner_searches from public, anon, authenticated;

create table if not exists public.athlete_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_user_id uuid not null references auth.users(id) on delete cascade,
  challenged_user_id uuid not null references auth.users(id) on delete cascade,
  challenge_type text not null check (challenge_type in ('practice', 'match')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_user_id <> challenged_user_id)
);

create unique index if not exists athlete_challenges_open_pair_type_idx
on public.athlete_challenges (challenger_user_id, challenged_user_id, challenge_type)
where status = 'pending';
create index if not exists athlete_challenges_inbox_idx
on public.athlete_challenges (challenged_user_id, status, created_at desc);
create index if not exists athlete_challenges_outbox_idx
on public.athlete_challenges (challenger_user_id, status, created_at desc);

alter table public.athlete_challenges enable row level security;
revoke all on public.athlete_challenges from public, anon, authenticated;

create or replace function public.set_my_partner_search(
  p_tournament_id uuid,
  p_category text default '',
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  registration_row public.tournament_registrations%rowtype;
  search_row public.athlete_partner_searches%rowtype;
  normalized_category text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select * into registration_row
  from public.tournament_registrations registration
  where registration.tournament_id = p_tournament_id
    and registration.athlete_user_id = auth.uid()
    and registration.status in ('pending', 'confirmed')
  limit 1;

  if registration_row.id is null then
    raise exception 'Inscreva-se neste torneio antes de procurar uma dupla.' using errcode = '42501';
  end if;
  if btrim(coalesce(registration_row.partner_name, '')) <> '' then
    raise exception 'Sua inscrição já possui uma dupla.' using errcode = '22023';
  end if;

  normalized_category := left(coalesce(nullif(btrim(p_category), ''), nullif(btrim(registration_row.category), ''), 'Categoria do torneio'), 80);

  insert into public.athlete_partner_searches (tournament_id, athlete_user_id, category, active)
  values (p_tournament_id, auth.uid(), normalized_category, coalesce(p_active, true))
  on conflict (tournament_id, athlete_user_id) do update set
    category = excluded.category,
    active = excluded.active,
    updated_at = now()
  returning * into search_row;

  return to_jsonb(search_row);
end;
$$;

create or replace function public.send_athlete_challenge(
  p_challenged_user_id uuid,
  p_challenge_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  challenge_row public.athlete_challenges%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para desafiar um atleta.' using errcode = '42501';
  end if;
  if p_challenged_user_id is null or p_challenged_user_id = auth.uid()
    or p_challenge_type not in ('practice', 'match') then
    raise exception 'Desafio inválido.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = p_challenged_user_id and member.is_public = true
  ) then
    raise exception 'Atleta não encontrado.' using errcode = 'P0002';
  end if;

  select * into challenge_row
  from public.athlete_challenges challenge
  where challenge.challenger_user_id = auth.uid()
    and challenge.challenged_user_id = p_challenged_user_id
    and challenge.challenge_type = p_challenge_type
    and challenge.status = 'pending'
  limit 1;

  if challenge_row.id is null then
    insert into public.athlete_challenges (
      challenger_user_id, challenged_user_id, challenge_type, status
    ) values (
      auth.uid(), p_challenged_user_id, p_challenge_type, 'pending'
    ) returning * into challenge_row;
  end if;

  return to_jsonb(challenge_row);
end;
$$;

create or replace function public.respond_athlete_challenge(
  p_challenge_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  challenge_row public.athlete_challenges%rowtype;
begin
  if auth.uid() is null or p_status not in ('accepted', 'declined', 'cancelled') then
    raise exception 'Resposta inválida.' using errcode = '42501';
  end if;

  update public.athlete_challenges challenge
  set status = p_status, updated_at = now()
  where challenge.id = p_challenge_id
    and challenge.status = 'pending'
    and (
      (challenge.challenged_user_id = auth.uid() and p_status in ('accepted', 'declined'))
      or (challenge.challenger_user_id = auth.uid() and p_status = 'cancelled')
    )
  returning * into challenge_row;

  if challenge_row.id is null then
    raise exception 'Desafio não encontrado ou já respondido.' using errcode = 'P0002';
  end if;
  return to_jsonb(challenge_row);
end;
$$;

create or replace function public.get_my_athlete_activity()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  result_json jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', registration.id,
        'status', registration.status,
        'category', registration.category,
        'partner_name', registration.partner_name,
        'created_at', registration.created_at,
        'bucket', case
          when registration.status = 'pending' then 'registered'
          when coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')) < current_date::text then 'past'
          else 'participating'
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
        and registration.status in ('pending', 'confirmed')
        and coalesce(tournament.data ->> 'deletedAt', '') = ''
    ), '[]'::jsonb),
    'circuits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', circuit.id,
        'name', circuit.name,
        'start_date', circuit.start_date,
        'end_date', circuit.end_date,
        'tournament_count', cardinality(circuit.tournament_ids),
        'bucket', case when circuit.end_date is not null and circuit.end_date < current_date then 'past' else 'participating' end
      ) order by circuit.start_date desc nulls last)
      from public.circuits circuit
      where exists (
        select 1
        from public.tournament_registrations registration
        where registration.athlete_user_id = auth.uid()
          and registration.status = 'confirmed'
          and registration.tournament_id::text = any(circuit.tournament_ids)
      )
    ), '[]'::jsonb),
    'my_partner_searches', coalesce((
      select jsonb_agg(to_jsonb(search_item) order by search_item.updated_at desc)
      from public.athlete_partner_searches search_item
      where search_item.athlete_user_id = auth.uid() and search_item.active = true
    ), '[]'::jsonb),
    'partner_matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', candidate.id,
        'category', candidate.category,
        'tournament', jsonb_build_object('id', tournament.id, 'public_id', tournament.public_id, 'name', tournament.name),
        'athlete', jsonb_build_object(
          'user_id', member.user_id,
          'handle', member.handle,
          'display_name', member.display_name,
          'photo_url', member.photo_url,
          'sports_category', member.sports_category,
          'dominant_hand', member.dominant_hand,
          'city', member.city,
          'state', member.state,
          'whatsapp', case when member.show_contacts then member.whatsapp else '' end,
          'telegram', case when member.show_contacts then member.telegram else '' end,
          'instagram', case when member.show_contacts then member.instagram else '' end
        )
      ) order by candidate.updated_at desc)
      from public.athlete_partner_searches candidate
      join public.tournaments tournament on tournament.id = candidate.tournament_id
      join public.member_profiles member on member.user_id = candidate.athlete_user_id
      where candidate.active = true
        and candidate.athlete_user_id <> auth.uid()
        and exists (
          select 1
          from public.tournament_registrations candidate_registration
          where candidate_registration.athlete_user_id = candidate.athlete_user_id
            and candidate_registration.tournament_id = candidate.tournament_id
            and candidate_registration.status in ('pending', 'confirmed')
            and btrim(coalesce(candidate_registration.partner_name, '')) = ''
            and lower(coalesce(nullif(candidate_registration.category, ''), candidate.category)) = lower(candidate.category)
        )
        and exists (
          select 1
          from public.tournament_registrations own_registration
          where own_registration.athlete_user_id = auth.uid()
            and own_registration.tournament_id = candidate.tournament_id
            and own_registration.status in ('pending', 'confirmed')
            and btrim(coalesce(own_registration.partner_name, '')) = ''
            and lower(coalesce(nullif(own_registration.category, ''), candidate.category)) = lower(candidate.category)
        )
    ), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', challenge.id,
        'direction', case when challenge.challenged_user_id = auth.uid() then 'incoming' else 'outgoing' end,
        'challenge_type', challenge.challenge_type,
        'status', challenge.status,
        'created_at', challenge.created_at,
        'athlete', jsonb_build_object(
          'user_id', other_member.user_id,
          'handle', other_member.handle,
          'display_name', other_member.display_name,
          'photo_url', other_member.photo_url,
          'city', other_member.city,
          'state', other_member.state,
          'whatsapp', case when challenge.status = 'accepted' and other_member.show_contacts then other_member.whatsapp else '' end,
          'telegram', case when challenge.status = 'accepted' and other_member.show_contacts then other_member.telegram else '' end,
          'instagram', case when challenge.status = 'accepted' and other_member.show_contacts then other_member.instagram else '' end
        )
      ) order by challenge.created_at desc)
      from public.athlete_challenges challenge
      join public.member_profiles other_member on other_member.user_id = case
        when challenge.challenged_user_id = auth.uid() then challenge.challenger_user_id
        else challenge.challenged_user_id
      end
      where challenge.challenged_user_id = auth.uid() or challenge.challenger_user_id = auth.uid()
    ), '[]'::jsonb)
  ) into result_json;

  return result_json;
end;
$$;

create or replace function public.get_public_athlete_activity(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = p_user_id and member.is_public = true
  ) then
    return jsonb_build_object('registrations', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', registration.id,
        'category', registration.category,
        'bucket', case
          when coalesce(nullif(tournament.data ->> 'eventEndDate', ''), nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')) < current_date::text then 'past'
          else 'participating'
        end,
        'tournament', jsonb_build_object(
          'id', tournament.id,
          'public_id', tournament.public_id,
          'name', tournament.name,
          'type', tournament.type,
          'event_date', coalesce(nullif(tournament.data ->> 'eventDate', ''), nullif(tournament.data ->> 'eventStartDate', '')),
          'location', tournament.data ->> 'location',
          'cover_url', coalesce(tournament.data ->> 'coverImageThumbnailUrl', tournament.data ->> 'coverImageUrl', '')
        )
      ) order by registration.created_at desc)
      from public.tournament_registrations registration
      join public.tournaments tournament on tournament.id = registration.tournament_id
      where registration.athlete_user_id = p_user_id
        and registration.status = 'confirmed'
        and tournament.is_public = true
        and coalesce(tournament.data ->> 'deletedAt', '') = ''
    ), '[]'::jsonb),
    'circuits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', circuit.id,
        'name', circuit.name,
        'start_date', circuit.start_date,
        'end_date', circuit.end_date,
        'tournament_count', cardinality(circuit.tournament_ids),
        'bucket', case when circuit.end_date is not null and circuit.end_date < current_date then 'past' else 'participating' end
      ) order by circuit.start_date desc nulls last)
      from public.circuits circuit
      where exists (
        select 1
        from public.tournament_registrations registration
        join public.tournaments tournament on tournament.id = registration.tournament_id
        where registration.athlete_user_id = p_user_id
          and registration.status = 'confirmed'
          and tournament.is_public = true
          and coalesce(tournament.data ->> 'deletedAt', '') = ''
          and registration.tournament_id::text = any(circuit.tournament_ids)
      )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.set_my_partner_search(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.send_athlete_challenge(uuid, text) from public, anon, authenticated;
revoke all on function public.respond_athlete_challenge(uuid, text) from public, anon, authenticated;
revoke all on function public.get_my_athlete_activity() from public, anon, authenticated;
revoke all on function public.get_public_athlete_activity(uuid) from public, anon, authenticated;
grant execute on function public.set_my_partner_search(uuid, text, boolean) to authenticated;
grant execute on function public.send_athlete_challenge(uuid, text) to authenticated;
grant execute on function public.respond_athlete_challenge(uuid, text) to authenticated;
grant execute on function public.get_my_athlete_activity() to authenticated;
grant execute on function public.get_public_athlete_activity(uuid) to anon, authenticated;

create or replace function public.get_public_member_profile(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  member_row public.member_profiles%rowtype;
  gallery_json jsonb := '[]'::jsonb;
begin
  select member.* into member_row
  from public.member_profiles member
  where member.is_public = true
    and (
      lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, '')))
      or member.user_id::text = btrim(coalesce(p_identifier, ''))
    )
  order by case when lower(coalesce(member.handle, '')) = lower(btrim(coalesce(p_identifier, ''))) then 0 else 1 end
  limit 1;

  if member_row.user_id is null then return null; end if;

  select coalesce(jsonb_agg(photo.photo_url order by photo.position), '[]'::jsonb)
  into gallery_json
  from public.member_profile_photos photo
  where photo.user_id = member_row.user_id;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', member_row.user_id,
      'handle', member_row.handle,
      'display_name', member_row.display_name,
      'photo_url', member_row.photo_url,
      'cover_url', member_row.cover_url,
      'bio', member_row.bio,
      'city', member_row.city,
      'state', member_row.state,
      'sports_category', member_row.sports_category,
      'dominant_hand', member_row.dominant_hand,
      'shirt_size', member_row.shirt_size,
      'whatsapp', '',
      'telegram', '',
      'instagram', '',
      'show_contacts', false,
      'is_public', true,
      'gallery_photos', gallery_json
    ),
    'organization', null
  );
end;
$$;

revoke all on function public.get_public_member_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_member_profile(text) to anon, authenticated;

commit;
