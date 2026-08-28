create or replace function public.check_member_handle_availability(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_handle text := lower(trim(leading '@' from btrim(coalesce(p_handle, ''))));
  handle_is_valid boolean;
  handle_is_available boolean;
begin
  handle_is_valid := normalized_handle ~ '^[a-z0-9._]{3,30}$';
  if not handle_is_valid then
    return jsonb_build_object('handle', normalized_handle, 'valid', false, 'available', false);
  end if;

  select not exists (
    select 1
    from public.member_profiles member
    where lower(coalesce(member.handle, '')) = normalized_handle
      and member.user_id is distinct from auth.uid()
  ) into handle_is_available;

  return jsonb_build_object(
    'handle', normalized_handle,
    'valid', true,
    'available', handle_is_available
  );
end;
$$;

revoke all on function public.check_member_handle_availability(text) from public, anon, authenticated;
grant execute on function public.check_member_handle_availability(text) to authenticated;
