create table if not exists public.profile_follows (
  id uuid primary key default gen_random_uuid(),
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  follower_kind text not null check (follower_kind in ('athlete', 'organization')),
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  followed_kind text not null check (followed_kind in ('athlete', 'organization')),
  created_at timestamptz not null default now(),
  unique (follower_user_id, follower_kind, followed_user_id, followed_kind),
  check (follower_user_id <> followed_user_id)
);

create index if not exists profile_follows_followed_idx
on public.profile_follows (followed_user_id, followed_kind, created_at desc);
create index if not exists profile_follows_follower_idx
on public.profile_follows (follower_user_id, follower_kind, created_at desc);

alter table public.profile_follows enable row level security;
revoke all on public.profile_follows from public, anon, authenticated;

create or replace function public.profile_identity_json(p_user_id uuid, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  identity_json jsonb;
begin
  if p_kind = 'athlete' then
    select jsonb_build_object(
      'user_id', member.user_id,
      'kind', 'athlete',
      'name', member.display_name,
      'handle', coalesce(member.handle, ''),
      'photo_url', coalesce(member.photo_url, ''),
      'city', coalesce(member.city, ''),
      'state', coalesce(member.state, '')
    ) into identity_json
    from public.member_profiles member
    where member.user_id = p_user_id and member.is_public = true;
  elsif p_kind = 'organization' then
    select jsonb_build_object(
      'user_id', profile.id,
      'kind', 'organization',
      'name', coalesce(nullif(btrim(profile.arena_name), ''), nullif(btrim(profile.name), ''), 'Organização'),
      'handle', '',
      'photo_url', coalesce(profile.photo_url, ''),
      'city', coalesce(profile.city, ''),
      'state', coalesce(profile.state, '')
    ) into identity_json
    from public.profiles profile
    where profile.id = p_user_id
      and (profile.organization_activated_at is not null or btrim(coalesce(profile.arena_name, '')) <> '');
  end if;
  return identity_json;
end;
$$;

create or replace function public.get_my_social_graph(p_identity_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_kind text := lower(btrim(coalesce(p_identity_kind, '')));
  follower_items jsonb;
  following_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para consultar seguidores.' using errcode = '42501';
  end if;
  if normalized_kind not in ('athlete', 'organization') or public.profile_identity_json(auth.uid(), normalized_kind) is null then
    raise exception 'Perfil ativo não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(
    coalesce(public.profile_identity_json(connection.follower_user_id, connection.follower_kind), '{}'::jsonb)
      || jsonb_build_object(
        'is_following', exists (
          select 1 from public.profile_follows reciprocal
          where reciprocal.follower_user_id = auth.uid()
            and reciprocal.follower_kind = normalized_kind
            and reciprocal.followed_user_id = connection.follower_user_id
            and reciprocal.followed_kind = connection.follower_kind
        ),
        'followed_at', connection.created_at
      )
    order by connection.created_at desc
  ), '[]'::jsonb) into follower_items
  from public.profile_follows connection
  where connection.followed_user_id = auth.uid() and connection.followed_kind = normalized_kind;

  select coalesce(jsonb_agg(
    coalesce(public.profile_identity_json(connection.followed_user_id, connection.followed_kind), '{}'::jsonb)
      || jsonb_build_object('is_following', true, 'followed_at', connection.created_at)
    order by connection.created_at desc
  ), '[]'::jsonb) into following_items
  from public.profile_follows connection
  where connection.follower_user_id = auth.uid() and connection.follower_kind = normalized_kind;

  return jsonb_build_object(
    'identity_kind', normalized_kind,
    'followers_count', jsonb_array_length(follower_items),
    'following_count', jsonb_array_length(following_items),
    'followers', follower_items,
    'following', following_items
  );
end;
$$;

create or replace function public.set_profile_follow(
  p_follower_kind text,
  p_followed_user_id uuid,
  p_followed_kind text,
  p_follow boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source_kind text := lower(btrim(coalesce(p_follower_kind, '')));
  target_kind text := lower(btrim(coalesce(p_followed_kind, '')));
  inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para seguir perfis.' using errcode = '42501';
  end if;
  if source_kind not in ('athlete', 'organization') or target_kind not in ('athlete', 'organization') then
    raise exception 'Tipo de perfil inválido.' using errcode = '22023';
  end if;
  if p_followed_user_id is null or p_followed_user_id = auth.uid() then
    raise exception 'Não é possível seguir seu próprio acesso.' using errcode = '22023';
  end if;
  if public.profile_identity_json(auth.uid(), source_kind) is null then
    raise exception 'Perfil ativo não encontrado.' using errcode = 'P0002';
  end if;
  if public.profile_identity_json(p_followed_user_id, target_kind) is null then
    raise exception 'O perfil escolhido não está disponível.' using errcode = 'P0002';
  end if;

  if coalesce(p_follow, false) then
    insert into public.profile_follows (follower_user_id, follower_kind, followed_user_id, followed_kind)
    values (auth.uid(), source_kind, p_followed_user_id, target_kind)
    on conflict do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then
      insert into public.platform_notifications (
        target_user_id, actor_user_id, notification_type, title, message, data
      ) values (
        p_followed_user_id,
        auth.uid(),
        'profile_follow',
        'Novo seguidor',
        case when source_kind = 'organization' then 'Uma organização começou a seguir seu perfil.' else 'Um atleta começou a seguir seu perfil.' end,
        jsonb_build_object('follower_kind', source_kind, 'followed_kind', target_kind)
      );
    end if;
  else
    delete from public.profile_follows connection
    where connection.follower_user_id = auth.uid()
      and connection.follower_kind = source_kind
      and connection.followed_user_id = p_followed_user_id
      and connection.followed_kind = target_kind;
  end if;

  return public.get_my_social_graph(source_kind);
end;
$$;

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
      'partner_invitation', 'partner_accepted', 'partner_rejected', 'partner_cancelled',
      'profile_follow'
    ));
end;
$$;

revoke all on function public.profile_identity_json(uuid, text) from public, anon, authenticated;
revoke all on function public.get_my_social_graph(text) from public, anon, authenticated;
revoke all on function public.set_profile_follow(text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.get_my_social_graph(text) to authenticated;
grant execute on function public.set_profile_follow(text, uuid, text, boolean) to authenticated;
