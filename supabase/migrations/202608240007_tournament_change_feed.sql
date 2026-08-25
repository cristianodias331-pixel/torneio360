begin;

create table if not exists public.tournament_change_feed (
  tournament_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  tournament_updated_at timestamptz,
  deleted boolean not null default false,
  signaled_at timestamptz not null default now()
);

create index if not exists tournament_change_feed_user_signaled_idx
  on public.tournament_change_feed (user_id, signaled_at desc);

alter table public.tournament_change_feed enable row level security;

drop policy if exists "Owners can read tournament change signals" on public.tournament_change_feed;
create policy "Owners can read tournament change signals"
on public.tournament_change_feed for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.tournament_change_feed from public, anon, authenticated;
grant select on table public.tournament_change_feed to authenticated;

create or replace function public.signal_tournament_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.tournament_change_feed (
      tournament_id, user_id, revision, tournament_updated_at, deleted, signaled_at
    ) values (
      old.id, old.user_id, coalesce(old.revision, 0), old.updated_at, true, now()
    )
    on conflict (tournament_id) do update set
      user_id = excluded.user_id,
      revision = excluded.revision,
      tournament_updated_at = excluded.tournament_updated_at,
      deleted = true,
      signaled_at = excluded.signaled_at;
    return old;
  end if;

  insert into public.tournament_change_feed (
    tournament_id, user_id, revision, tournament_updated_at, deleted, signaled_at
  ) values (
    new.id, new.user_id, coalesce(new.revision, 0), new.updated_at, false, now()
  )
  on conflict (tournament_id) do update set
    user_id = excluded.user_id,
    revision = excluded.revision,
    tournament_updated_at = excluded.tournament_updated_at,
    deleted = false,
    signaled_at = excluded.signaled_at;
  return new;
end;
$$;

revoke all on function public.signal_tournament_change() from public, anon, authenticated;

drop trigger if exists tournaments_signal_change on public.tournaments;
create trigger tournaments_signal_change
after insert or update or delete on public.tournaments
for each row execute function public.signal_tournament_change();

insert into public.tournament_change_feed (
  tournament_id, user_id, revision, tournament_updated_at, deleted, signaled_at
)
select tournament.id, tournament.user_id, coalesce(tournament.revision, 0), tournament.updated_at, false, now()
from public.tournaments tournament
on conflict (tournament_id) do update set
  user_id = excluded.user_id,
  revision = excluded.revision,
  tournament_updated_at = excluded.tournament_updated_at,
  deleted = false,
  signaled_at = excluded.signaled_at;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables publication_table
    where publication_table.pubname = 'supabase_realtime'
      and publication_table.schemaname = 'public'
      and publication_table.tablename = 'tournament_change_feed'
  ) then
    alter publication supabase_realtime add table public.tournament_change_feed;
  end if;
end;
$$;

commit;
