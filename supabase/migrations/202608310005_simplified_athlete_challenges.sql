alter table public.athlete_challenges
  add column if not exists doubles_category_mode text,
  add column if not exists goal_period text,
  add column if not exists accepted_at timestamptz,
  add column if not exists goal_ends_at timestamptz;

update public.athlete_challenges
set doubles_category_mode = 'same_category'
where challenge_type = 'doubles' and doubles_category_mode is null;

alter table public.athlete_challenges
  drop constraint if exists athlete_challenges_challenge_type_v2_check;

alter table public.athlete_challenges
  add constraint athlete_challenges_challenge_type_v3_check
    check (challenge_type in ('practice', 'match', 'doubles', 'open', 'podium_goal')),
  add constraint athlete_challenges_doubles_category_v3_check
    check (challenge_type <> 'doubles' or doubles_category_mode in ('mixed', 'same_category')),
  add constraint athlete_challenges_podium_period_v3_check
    check (challenge_type <> 'podium_goal' or goal_period in ('30_days', '3_months', '6_months', '1_year'));

drop function if exists public.create_athlete_challenge(uuid, text, uuid, uuid, text, integer);

create or replace function public.create_athlete_challenge(
  p_challenged_user_id uuid,
  p_challenge_type text,
  p_challenger_partner_user_id uuid default null,
  p_challenged_partner_user_id uuid default null,
  p_doubles_category_mode text default null,
  p_goal_period text default null
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
  if normalized_type not in ('match', 'doubles', 'podium_goal') then
    raise exception 'Escolha partida simples, partida em dupla ou meta de pódios.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.member_profiles member where member.user_id = auth.uid() and member.is_public = true) then
    raise exception 'Complete seu perfil de atleta antes de criar um desafio.' using errcode = '42501';
  end if;
  if p_challenged_user_id is null or p_challenged_user_id = auth.uid() then
    raise exception 'Escolha outro atleta para o desafio.' using errcode = '22023';
  end if;

  if normalized_type = 'doubles' then
    p_doubles_category_mode := lower(btrim(coalesce(p_doubles_category_mode, '')));
    if p_challenger_partner_user_id is null or p_challenged_partner_user_id is null then
      raise exception 'Escolha seu parceiro e os dois atletas da dupla adversária.' using errcode = '22023';
    end if;
    if p_doubles_category_mode not in ('mixed', 'same_category') then
      raise exception 'Informe se a partida será mista ou da mesma categoria esportiva.' using errcode = '22023';
    end if;
    if (
      select count(distinct selected_id)
      from unnest(array[auth.uid(), p_challenger_partner_user_id, p_challenged_user_id, p_challenged_partner_user_id]) selected(selected_id)
      where selected_id is not null
    ) <> 4 then
      raise exception 'Cada posição da partida deve ter um atleta diferente.' using errcode = '22023';
    end if;
  else
    p_challenger_partner_user_id := null;
    p_challenged_partner_user_id := null;
    p_doubles_category_mode := null;
  end if;

  if normalized_type = 'podium_goal' then
    p_goal_period := lower(btrim(coalesce(p_goal_period, '')));
    if p_goal_period not in ('30_days', '3_months', '6_months', '1_year') then
      raise exception 'Escolha a duração da meta de pódios.' using errcode = '22023';
    end if;
  else
    p_goal_period := null;
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

  select * into challenge_row
  from public.athlete_challenges challenge
  where challenge.challenger_user_id = auth.uid()
    and challenge.challenged_user_id = p_challenged_user_id
    and challenge.challenge_type = normalized_type
    and challenge.status = 'pending'
  limit 1;

  if challenge_row.id is null then
    insert into public.athlete_challenges (
      challenger_user_id, challenged_user_id, challenge_type,
      challenger_partner_user_id, challenged_partner_user_id,
      doubles_category_mode, goal_period, goal_type, goal_target, status
    ) values (
      auth.uid(), p_challenged_user_id, normalized_type,
      p_challenger_partner_user_id, p_challenged_partner_user_id,
      p_doubles_category_mode, p_goal_period, null, null, 'pending'
    ) returning * into challenge_row;
  end if;

  return to_jsonb(challenge_row);
end;
$$;

create or replace function public.athlete_podium_goal_score(p_user_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case when p_starts_at is null or p_ends_at is null then 0 else count(*)::integer end
  from public.athlete_achievements achievement
  where achievement.athlete_user_id = p_user_id
    and coalesce(achievement.event_date, achievement.approved_at::date) >= p_starts_at::date
    and coalesce(achievement.event_date, achievement.approved_at::date) <= p_ends_at::date;
$$;

create or replace function public.respond_athlete_challenge(p_challenge_id uuid, p_status text)
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
    set challenged_user_id = case when challenge.challenge_type = 'open' and challenge.challenged_user_id is null then auth.uid() else challenge.challenged_user_id end,
        status = 'accepted',
        accepted_at = case when challenge.challenge_type = 'podium_goal' then now() else challenge.accepted_at end,
        goal_ends_at = case challenge.goal_period
          when '30_days' then now() + interval '30 days'
          when '3_months' then now() + interval '3 months'
          when '6_months' then now() + interval '6 months'
          when '1_year' then now() + interval '1 year'
          else challenge.goal_ends_at
        end,
        updated_at = now()
    where challenge.id = p_challenge_id
      and challenge.status = 'pending'
      and challenge.challenger_user_id <> auth.uid()
      and (challenge.challenged_user_id = auth.uid() or challenge.challenged_partner_user_id = auth.uid() or (challenge.challenge_type = 'open' and challenge.challenged_user_id is null))
    returning * into challenge_row;
  elsif p_status = 'declined' then
    update public.athlete_challenges challenge
    set status = 'declined', updated_at = now()
    where challenge.id = p_challenge_id and challenge.status = 'pending' and challenge.challenge_type <> 'open'
      and (challenge.challenged_user_id = auth.uid() or challenge.challenged_partner_user_id = auth.uid())
    returning * into challenge_row;
  else
    update public.athlete_challenges challenge
    set status = 'cancelled', updated_at = now()
    where challenge.id = p_challenge_id and challenge.status = 'pending' and challenge.challenger_user_id = auth.uid()
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
      'direction', case when challenge.challenger_user_id = auth.uid() or challenge.challenger_partner_user_id = auth.uid() then 'outgoing' when challenge.challenge_type = 'open' and challenge.challenged_user_id is null then 'open' else 'incoming' end,
      'challenge_type', challenge.challenge_type,
      'status', challenge.status,
      'created_at', challenge.created_at,
      'accepted_at', challenge.accepted_at,
      'doubles_category_mode', challenge.doubles_category_mode,
      'goal_period', challenge.goal_period,
      'goal_ends_at', challenge.goal_ends_at,
      'challenger_score', case when challenge.challenge_type = 'podium_goal' then public.athlete_podium_goal_score(challenge.challenger_user_id, challenge.accepted_at, challenge.goal_ends_at) else 0 end,
      'challenged_score', case when challenge.challenge_type = 'podium_goal' then public.athlete_podium_goal_score(challenge.challenged_user_id, challenge.accepted_at, challenge.goal_ends_at) else 0 end,
      'goal_status', case when challenge.challenge_type <> 'podium_goal' then null when challenge.status = 'pending' then 'waiting' when challenge.status = 'accepted' and now() <= challenge.goal_ends_at then 'active' when challenge.status = 'accepted' then 'finished' else challenge.status end,
      'goal_type', challenge.goal_type,
      'goal_target', challenge.goal_target,
      'athlete', case
        when challenge.challenger_user_id = auth.uid() or challenge.challenger_partner_user_id = auth.uid()
          then case when challenged_member.user_id is null then null else jsonb_build_object('user_id', challenged_member.user_id, 'handle', challenged_member.handle, 'display_name', challenged_member.display_name, 'photo_url', challenged_member.photo_url, 'city', challenged_member.city, 'state', challenged_member.state) end
        else jsonb_build_object('user_id', challenger_member.user_id, 'handle', challenger_member.handle, 'display_name', challenger_member.display_name, 'photo_url', challenger_member.photo_url, 'city', challenger_member.city, 'state', challenger_member.state)
      end,
      'challenger_partner', case when challenger_partner.user_id is null then null else jsonb_build_object('user_id', challenger_partner.user_id, 'handle', challenger_partner.handle, 'display_name', challenger_partner.display_name, 'photo_url', challenger_partner.photo_url) end,
      'challenged_partner', case when challenged_partner.user_id is null then null else jsonb_build_object('user_id', challenged_partner.user_id, 'handle', challenged_partner.handle, 'display_name', challenged_partner.display_name, 'photo_url', challenged_partner.photo_url) end
    ) order by challenge.created_at desc)
    from public.athlete_challenges challenge
    join public.member_profiles challenger_member on challenger_member.user_id = challenge.challenger_user_id
    left join public.member_profiles challenged_member on challenged_member.user_id = challenge.challenged_user_id
    left join public.member_profiles challenger_partner on challenger_partner.user_id = challenge.challenger_partner_user_id
    left join public.member_profiles challenged_partner on challenged_partner.user_id = challenge.challenged_partner_user_id
    where challenge.challenger_user_id = auth.uid() or challenge.challenger_partner_user_id = auth.uid()
      or challenge.challenged_user_id = auth.uid() or challenge.challenged_partner_user_id = auth.uid()
      or (challenge.challenge_type = 'open' and challenge.status = 'pending' and challenge.challenger_user_id <> auth.uid())
  ), '[]'::jsonb) end;
$$;

revoke all on function public.create_athlete_challenge(uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.athlete_podium_goal_score(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.list_my_expanded_athlete_challenges() from public, anon, authenticated;
grant execute on function public.create_athlete_challenge(uuid, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.list_my_expanded_athlete_challenges() to authenticated;
grant execute on function public.respond_athlete_challenge(uuid, text) to authenticated;
