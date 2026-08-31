alter table public.athlete_challenges
  drop constraint if exists athlete_challenges_challenge_type_check;

alter table public.athlete_challenges
  alter column challenged_user_id drop not null,
  add column if not exists challenger_partner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists challenged_partner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists goal_type text,
  add column if not exists goal_target integer;

alter table public.athlete_challenges
  add constraint athlete_challenges_challenge_type_v2_check
    check (challenge_type in ('practice', 'match', 'doubles', 'open')),
  add constraint athlete_challenges_target_v2_check
    check (
      challenge_type = 'open'
      or challenged_user_id is not null
    ),
  add constraint athlete_challenges_doubles_members_v2_check
    check (
      challenge_type <> 'doubles'
      or (
        challenger_partner_user_id is not null
        and challenged_partner_user_id is not null
        and challenger_user_id <> challenger_partner_user_id
        and challenger_user_id <> challenged_user_id
        and challenger_user_id <> challenged_partner_user_id
        and challenger_partner_user_id <> challenged_user_id
        and challenger_partner_user_id <> challenged_partner_user_id
        and challenged_user_id <> challenged_partner_user_id
      )
    );

update public.athlete_challenges
set goal_type = coalesce(goal_type, 'training_hours'),
    goal_target = coalesce(goal_target, 5)
where challenge_type = 'practice';

alter table public.athlete_challenges
  add constraint athlete_challenges_goal_v2_check
    check (
      challenge_type <> 'practice'
      or (
        goal_type in ('training_hours', 'matches_played', 'weekly_sessions', 'win_streak')
        and goal_target between 1 and 999
      )
    );

drop index if exists public.athlete_challenges_open_pair_type_idx;
create unique index if not exists athlete_challenges_pending_directed_idx
on public.athlete_challenges (challenger_user_id, challenged_user_id, challenge_type)
where status = 'pending' and challenged_user_id is not null;
create unique index if not exists athlete_challenges_pending_open_idx
on public.athlete_challenges (challenger_user_id)
where status = 'pending' and challenge_type = 'open';

create or replace function public.create_athlete_challenge(
  p_challenged_user_id uuid,
  p_challenge_type text,
  p_challenger_partner_user_id uuid default null,
  p_challenged_partner_user_id uuid default null,
  p_goal_type text default null,
  p_goal_target integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  challenge_row public.athlete_challenges%rowtype;
  normalized_type text := lower(btrim(coalesce(p_challenge_type, '')));
  selected_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Entre na plataforma para criar um desafio.' using errcode = '42501';
  end if;
  if normalized_type not in ('practice', 'match', 'doubles', 'open') then
    raise exception 'Tipo de desafio inválido.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = auth.uid() and member.is_public = true
  ) then
    raise exception 'Complete seu perfil de atleta antes de criar um desafio.' using errcode = '42501';
  end if;

  if normalized_type = 'open' then
    p_challenged_user_id := null;
    p_challenger_partner_user_id := null;
    p_challenged_partner_user_id := null;
  elsif p_challenged_user_id is null or p_challenged_user_id = auth.uid() then
    raise exception 'Escolha outro atleta para o desafio.' using errcode = '22023';
  end if;

  if normalized_type = 'doubles' then
    if p_challenger_partner_user_id is null or p_challenged_partner_user_id is null then
      raise exception 'Escolha seu parceiro e os dois atletas da dupla adversária.' using errcode = '22023';
    end if;
    if (
      select count(distinct selected_id)
      from unnest(array[auth.uid(), p_challenger_partner_user_id, p_challenged_user_id, p_challenged_partner_user_id]) selected(selected_id)
      where selected_id is not null
    ) <> 4 then
      raise exception 'Cada posição do desafio deve ter um atleta diferente.' using errcode = '22023';
    end if;
  else
    p_challenger_partner_user_id := null;
    p_challenged_partner_user_id := null;
  end if;

  if normalized_type = 'practice' then
    p_goal_type := lower(btrim(coalesce(p_goal_type, '')));
    if p_goal_type not in ('training_hours', 'matches_played', 'weekly_sessions', 'win_streak')
      or coalesce(p_goal_target, 0) not between 1 and 999 then
      raise exception 'Escolha uma meta e informe uma quantidade válida.' using errcode = '22023';
    end if;
  else
    p_goal_type := null;
    p_goal_target := null;
  end if;

  foreach selected_user_id in array array[p_challenged_user_id, p_challenger_partner_user_id, p_challenged_partner_user_id]
  loop
    if selected_user_id is not null and not exists (
      select 1 from public.member_profiles member
      where member.user_id = selected_user_id and member.is_public = true
    ) then
      raise exception 'Um dos atletas selecionados não está disponível.' using errcode = 'P0002';
    end if;
  end loop;

  if normalized_type = 'open' then
    select * into challenge_row
    from public.athlete_challenges challenge
    where challenge.challenger_user_id = auth.uid()
      and challenge.challenge_type = 'open'
      and challenge.status = 'pending'
    limit 1;
  else
    select * into challenge_row
    from public.athlete_challenges challenge
    where challenge.challenger_user_id = auth.uid()
      and challenge.challenged_user_id = p_challenged_user_id
      and challenge.challenge_type = normalized_type
      and challenge.status = 'pending'
    limit 1;
  end if;

  if challenge_row.id is null then
    insert into public.athlete_challenges (
      challenger_user_id,
      challenged_user_id,
      challenge_type,
      challenger_partner_user_id,
      challenged_partner_user_id,
      goal_type,
      goal_target,
      status
    ) values (
      auth.uid(),
      p_challenged_user_id,
      normalized_type,
      p_challenger_partner_user_id,
      p_challenged_partner_user_id,
      p_goal_type,
      p_goal_target,
      'pending'
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

  if p_status = 'accepted' then
    update public.athlete_challenges challenge
    set
      challenged_user_id = case
        when challenge.challenge_type = 'open' and challenge.challenged_user_id is null then auth.uid()
        else challenge.challenged_user_id
      end,
      status = 'accepted',
      updated_at = now()
    where challenge.id = p_challenge_id
      and challenge.status = 'pending'
      and challenge.challenger_user_id <> auth.uid()
      and (
        challenge.challenged_user_id = auth.uid()
        or challenge.challenged_partner_user_id = auth.uid()
        or (challenge.challenge_type = 'open' and challenge.challenged_user_id is null)
      )
    returning * into challenge_row;
  elsif p_status = 'declined' then
    update public.athlete_challenges challenge
    set status = 'declined', updated_at = now()
    where challenge.id = p_challenge_id
      and challenge.status = 'pending'
      and challenge.challenge_type <> 'open'
      and (challenge.challenged_user_id = auth.uid() or challenge.challenged_partner_user_id = auth.uid())
    returning * into challenge_row;
  else
    update public.athlete_challenges challenge
    set status = 'cancelled', updated_at = now()
    where challenge.id = p_challenge_id
      and challenge.status = 'pending'
      and challenge.challenger_user_id = auth.uid()
    returning * into challenge_row;
  end if;

  if challenge_row.id is null then
    raise exception 'Desafio não encontrado ou já respondido.' using errcode = 'P0002';
  end if;
  return to_jsonb(challenge_row);
end;
$$;

create or replace function public.list_my_expanded_athlete_challenges()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select case when auth.uid() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', challenge.id,
      'direction', case
        when challenge.challenger_user_id = auth.uid() or challenge.challenger_partner_user_id = auth.uid() then 'outgoing'
        when challenge.challenge_type = 'open' and challenge.challenged_user_id is null then 'open'
        else 'incoming'
      end,
      'challenge_type', challenge.challenge_type,
      'status', challenge.status,
      'created_at', challenge.created_at,
      'is_open', challenge.challenge_type = 'open',
      'goal_type', challenge.goal_type,
      'goal_target', challenge.goal_target,
      'athlete', case
        when challenge.challenger_user_id = auth.uid() or challenge.challenger_partner_user_id = auth.uid()
          then case when challenged_member.user_id is null then null else jsonb_build_object('user_id', challenged_member.user_id, 'handle', challenged_member.handle, 'display_name', challenged_member.display_name, 'photo_url', challenged_member.photo_url, 'city', challenged_member.city, 'state', challenged_member.state) end
        else jsonb_build_object('user_id', challenger_member.user_id, 'handle', challenger_member.handle, 'display_name', challenger_member.display_name, 'photo_url', challenger_member.photo_url, 'city', challenger_member.city, 'state', challenger_member.state)
      end,
      'challenger', jsonb_build_object('user_id', challenger_member.user_id, 'handle', challenger_member.handle, 'display_name', challenger_member.display_name, 'photo_url', challenger_member.photo_url),
      'challenged', case when challenged_member.user_id is null then null else jsonb_build_object('user_id', challenged_member.user_id, 'handle', challenged_member.handle, 'display_name', challenged_member.display_name, 'photo_url', challenged_member.photo_url) end,
      'challenger_partner', case when challenger_partner.user_id is null then null else jsonb_build_object('user_id', challenger_partner.user_id, 'handle', challenger_partner.handle, 'display_name', challenger_partner.display_name, 'photo_url', challenger_partner.photo_url) end,
      'challenged_partner', case when challenged_partner.user_id is null then null else jsonb_build_object('user_id', challenged_partner.user_id, 'handle', challenged_partner.handle, 'display_name', challenged_partner.display_name, 'photo_url', challenged_partner.photo_url) end
    ) order by challenge.created_at desc)
    from public.athlete_challenges challenge
    join public.member_profiles challenger_member on challenger_member.user_id = challenge.challenger_user_id
    left join public.member_profiles challenged_member on challenged_member.user_id = challenge.challenged_user_id
    left join public.member_profiles challenger_partner on challenger_partner.user_id = challenge.challenger_partner_user_id
    left join public.member_profiles challenged_partner on challenged_partner.user_id = challenge.challenged_partner_user_id
    where challenge.challenger_user_id = auth.uid()
      or challenge.challenger_partner_user_id = auth.uid()
      or challenge.challenged_user_id = auth.uid()
      or challenge.challenged_partner_user_id = auth.uid()
      or (challenge.challenge_type = 'open' and challenge.status = 'pending' and challenge.challenger_user_id <> auth.uid())
  ), '[]'::jsonb) end;
$$;

revoke all on function public.create_athlete_challenge(uuid, text, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.list_my_expanded_athlete_challenges() from public, anon, authenticated;
grant execute on function public.create_athlete_challenge(uuid, text, uuid, uuid, text, integer) to authenticated;
grant execute on function public.list_my_expanded_athlete_challenges() to authenticated;
