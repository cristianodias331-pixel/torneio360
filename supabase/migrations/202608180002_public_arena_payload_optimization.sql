begin;

-- O perfil público precisa apenas dos dados de cartão para listar torneios.
-- Rodadas, chaves, placares e participantes continuam disponíveis pelo RPC
-- get_public_tournament quando o visitante abre um torneio específico.
create or replace function public.t360_public_tournament_summary_data(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'eventDate', p_data -> 'eventDate',
    'eventStartDate', p_data -> 'eventStartDate',
    'eventEndDate', p_data -> 'eventEndDate',
    'eventStartTime', p_data -> 'eventStartTime',
    'location', p_data -> 'location',
    'category', p_data -> 'category',
    'gender', p_data -> 'gender',
    'participantGenderMode', p_data -> 'participantGenderMode',
    'genderOther', p_data -> 'genderOther',
    'coverImageUrl', p_data -> 'coverImageUrl',
    'registrationDeadline', p_data -> 'registrationDeadline',
    'eventName', p_data -> 'eventName',
    'eventGroupKey', p_data -> 'eventGroupKey',
    'multiCategoryEvent', p_data -> 'multiCategoryEvent',
    'displayOrder', p_data -> 'displayOrder',
    'displayOrderMode', p_data -> 'displayOrderMode',
    'lifecycleStatus', p_data -> 'lifecycleStatus'
  ));
$$;

revoke all on function public.t360_public_tournament_summary_data(jsonb) from public, anon, authenticated;

create or replace function public.get_public_arena_bundle_base(
  p_organizer_id uuid default null,
  p_public_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  owner_id uuid;
  profile_json jsonb;
  tournaments_json jsonb := '[]'::jsonb;
  circuits_json jsonb := '[]'::jsonb;
begin
  owner_id := p_organizer_id;

  if owner_id is null and nullif(trim(coalesce(p_public_id, '')), '') is not null then
    select tournament.user_id
    into owner_id
    from public.tournaments tournament
    where tournament.public_id = trim(p_public_id)
      and coalesce(tournament.data ->> 'deletedAt', '') = ''
    limit 1;
  end if;

  if owner_id is null then
    return jsonb_build_object('profile', null, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'id', profile.id,
    'name', profile.name,
    'arena_name', profile.arena_name,
    'city', profile.city,
    'state', profile.state,
    'photo_url', profile.photo_url,
    'phone', profile.phone,
    'address', profile.address,
    'maps_link', profile.maps_link,
    'instagram_handle', profile.instagram_handle,
    'instagram_link', profile.instagram_link,
    'whatsapp_group_link', profile.whatsapp_group_link
  )
  into profile_json
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where profile.id = owner_id
    and account.email_confirmed_at is not null
    and lower(coalesce(account.raw_app_meta_data ->> 'role', 'organizer')) not in (
      'athlete', 'visitor', 'spectator'
    );

  if profile_json is null then
    return jsonb_build_object('profile', null, 'tournaments', '[]'::jsonb, 'circuits', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tournament.id,
      'user_id', tournament.user_id,
      'name', tournament.name,
      'type', tournament.type,
      'data', public.t360_public_tournament_summary_data(tournament.data),
      'public_id', tournament.public_id,
      'is_public', true,
      'directoryEntry', true,
      'status', tournament.status,
      'created_at', tournament.created_at,
      'updated_at', tournament.updated_at
    ) order by
      case
        when tournament.data ->> 'displayOrder' ~ '^-?[0-9]+$'
          then (tournament.data ->> 'displayOrder')::integer
        else null
      end asc nulls last,
      tournament.created_at desc
  ), '[]'::jsonb)
  into tournaments_json
  from public.tournaments tournament
  where tournament.user_id = owner_id
    and coalesce(tournament.data ->> 'deletedAt', '') = '';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', circuit.id,
      'user_id', circuit.user_id,
      'name', circuit.name,
      'start_date', circuit.start_date,
      'end_date', circuit.end_date,
      'status', case
        when circuit.end_date is not null
          and circuit.end_date < (statement_timestamp() at time zone 'America/Sao_Paulo')::date
          then 'finished'
        else 'active'
      end,
      'tournament_ids', coalesce((
        select jsonb_agg(linked_id.value order by linked_id.ordinality)
        from jsonb_array_elements_text(coalesce(to_jsonb(circuit.tournament_ids), '[]'::jsonb))
          with ordinality as linked_id(value, ordinality)
        where exists (
          select 1
          from public.tournaments linked_tournament
          where linked_tournament.id::text = linked_id.value
            and linked_tournament.user_id = owner_id
            and coalesce(linked_tournament.data ->> 'deletedAt', '') = ''
        )
      ), '[]'::jsonb),
      'ranking_criteria', circuit.ranking_criteria,
      'ranking_criteria_mode', circuit.ranking_criteria_mode,
      'ranking_groups', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'key', grouped.group_key,
            'title', case grouped.group_key
              when 'masculino' then 'Ranking Masculino'
              when 'feminino' then 'Ranking Feminino'
              else 'Ranking geral acumulado'
            end,
            'rows', grouped.rows
          ) order by grouped.group_key
        )
        from (
          select
            ranking.group_key,
            jsonb_agg(
              jsonb_build_object(
                'id', ranking.group_key || ':' || ranking.player_key,
                'name', ranking.player_name,
                'pts', ranking.pts,
                'w', ranking.w,
                'bal', ranking.bal,
                'played', ranking.played,
                'tournaments', ranking.tournaments
              ) order by ranking.player_name
            ) as rows
          from (
            select
              coalesce(history.group_key, 'geral') as group_key,
              history.player_key,
              max(history.player_name) as player_name,
              sum(history.pts)::integer as pts,
              sum(history.w)::integer as w,
              sum(history.bal)::integer as bal,
              sum(history.played)::integer as played,
              count(distinct history.tournament_id)::integer as tournaments
            from public.circuit_ranking_history history
            where history.circuit_id = circuit.id
              and history.user_id = owner_id
              and history.played > 0
              and exists (
                select 1
                from jsonb_array_elements_text(coalesce(to_jsonb(circuit.tournament_ids), '[]'::jsonb))
                  as selected_tournament(value)
                join public.tournaments linked_tournament
                  on linked_tournament.id::text = selected_tournament.value
                where selected_tournament.value = history.tournament_id::text
                  and linked_tournament.user_id = owner_id
                  and coalesce(linked_tournament.data ->> 'deletedAt', '') = ''
              )
            group by coalesce(history.group_key, 'geral'), history.player_key
          ) ranking
          group by ranking.group_key
        ) grouped
      ), '[]'::jsonb),
      'updated_at', circuit.updated_at
    ) order by circuit.updated_at desc
  ), '[]'::jsonb)
  into circuits_json
  from public.circuits circuit
  where circuit.user_id = owner_id;

  return jsonb_build_object(
    'profile', profile_json,
    'tournaments', tournaments_json,
    'circuits', circuits_json
  );
end;
$$;

revoke all on function public.get_public_arena_bundle_base(uuid, text) from public, anon, authenticated;

commit;
