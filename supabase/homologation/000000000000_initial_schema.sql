begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  plan text default 'premium' check (plan in ('basic', 'pro', 'premium')),
  status text default 'active' check (status in ('pending', 'active', 'blocked')),
  expires_at date default (current_date + 14),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  arena_name text,
  city text,
  state text,
  photo_url text,
  is_public boolean default true,
  phone text,
  address text,
  maps_link text,
  instagram_handle text,
  instagram_link text,
  whatsapp_group_link text
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  status text default 'active' check (status in ('active', 'finished', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public_id text unique,
  is_public boolean default false,
  revision bigint not null default 0,
  last_change_id uuid
);

create table if not exists public.circuits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  status text default 'draft',
  tournament_ids text[] default '{}'::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ranking_criteria text not null default 'wins_points_balance',
  ranking_criteria_mode text not null default 'automatic'
    check (ranking_criteria_mode in ('automatic', 'manual')),
  revision bigint not null default 0
);

create index if not exists tournaments_user_id_idx on public.tournaments(user_id);
create index if not exists circuits_user_id_idx on public.circuits(user_id);

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.circuits enable row level security;

drop policy if exists "Usuário pode ver o próprio perfil" on public.profiles;
create policy "Usuário pode ver o próprio perfil"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Public can view shared tournaments" on public.tournaments;
create policy "Public can view shared tournaments"
on public.tournaments for select to anon, authenticated
using (coalesce(is_public, false));

drop policy if exists "Usuário pode ver os próprios torneios" on public.tournaments;
create policy "Usuário pode ver os próprios torneios"
on public.tournaments for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Usuário pode criar os próprios torneios" on public.tournaments;
create policy "Usuário pode criar os próprios torneios"
on public.tournaments for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Usuário pode atualizar os próprios torneios" on public.tournaments;
create policy "Usuário pode atualizar os próprios torneios"
on public.tournaments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Usuário pode excluir os próprios torneios" on public.tournaments;
create policy "Usuário pode excluir os próprios torneios"
on public.tournaments for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own circuits" on public.circuits;
create policy "Users can read own circuits"
on public.circuits for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own circuits" on public.circuits;
create policy "Users can insert own circuits"
on public.circuits for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own circuits" on public.circuits;
create policy "Users can update own circuits"
on public.circuits for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can delete own circuits" on public.circuits;
create policy "Users can delete own circuits"
on public.circuits for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.tournaments to anon;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.circuits to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Organizador'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
