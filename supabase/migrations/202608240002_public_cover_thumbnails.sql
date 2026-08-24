begin;

-- A miniatura leve acompanha o cartão público. A capa completa continua fora
-- do pacote inicial e só é carregada quando o visitante solicita a ampliação.
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
    'coverImageUrl', case
      when coalesce(p_data ->> 'coverImageUrl', '') ~* '^https?://' then p_data -> 'coverImageUrl'
      else null
    end,
    'coverImageThumbnailUrl', p_data -> 'coverImageThumbnailUrl',
    'eventCoverImageThumbnailUrl', p_data -> 'eventCoverImageThumbnailUrl',
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

commit;
