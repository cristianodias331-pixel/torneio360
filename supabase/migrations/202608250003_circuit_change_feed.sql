begin;

-- O Realtime não precisa transmitir ranking_settings, listas de etapas e
-- demais dados completos de cada circuito. Ele publica apenas um sinal leve;
-- o cliente interessado busca a versão atual protegida por RLS.
create table if not exists public.circuit_change_feed (
  circuit_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  circuit_updated_at timestamptz,
  deleted boolean not null default false,
  signaled_at timestamptz not null default now()
);

create index if not exists circuit_change_feed_user_signal_idx
  on public.circuit_change_feed (user_id, signaled_at desc);

alter table public.circuit_change_feed enable row level security;

drop policy if exists circuit_change_feed_read_own on public.circuit_change_feed;
create policy circuit_change_feed_read_own
on public.circuit_change_feed for select to authenticated
using (user_id = auth.uid());

revoke all on public.circuit_change_feed from public, anon;
grant select on public.circuit_change_feed to authenticated;

create or replace function public.signal_circuit_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.circuit_change_feed (
      circuit_id,
      user_id,
      revision,
      circuit_updated_at,
      deleted,
      signaled_at
    ) values (
      old.id,
      old.user_id,
      coalesce(old.revision, 0),
      old.updated_at,
      true,
      now()
    )
    on conflict (circuit_id) do update set
      user_id = excluded.user_id,
      revision = excluded.revision,
      circuit_updated_at = excluded.circuit_updated_at,
      deleted = true,
      signaled_at = excluded.signaled_at;
    return old;
  end if;

  insert into public.circuit_change_feed (
    circuit_id,
    user_id,
    revision,
    circuit_updated_at,
    deleted,
    signaled_at
  ) values (
    new.id,
    new.user_id,
    coalesce(new.revision, 0),
    new.updated_at,
    false,
    now()
  )
  on conflict (circuit_id) do update set
    user_id = excluded.user_id,
    revision = excluded.revision,
    circuit_updated_at = excluded.circuit_updated_at,
    deleted = false,
    signaled_at = excluded.signaled_at;

  return new;
end;
$$;

revoke all on function public.signal_circuit_change() from public, anon, authenticated;

drop trigger if exists circuits_signal_change on public.circuits;
create trigger circuits_signal_change
after insert or update or delete on public.circuits
for each row execute function public.signal_circuit_change();

insert into public.circuit_change_feed (
  circuit_id,
  user_id,
  revision,
  circuit_updated_at,
  deleted,
  signaled_at
)
select
  circuit.id,
  circuit.user_id,
  coalesce(circuit.revision, 0),
  circuit.updated_at,
  false,
  now()
from public.circuits circuit
on conflict (circuit_id) do update set
  user_id = excluded.user_id,
  revision = excluded.revision,
  circuit_updated_at = excluded.circuit_updated_at,
  deleted = false,
  signaled_at = excluded.signaled_at;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables publication_table
    where publication_table.pubname = 'supabase_realtime'
      and publication_table.schemaname = 'public'
      and publication_table.tablename = 'circuit_change_feed'
  ) then
    alter publication supabase_realtime add table public.circuit_change_feed;
  end if;
end;
$$;

commit;
