begin;

-- A revisao e gerada pelo banco para ordenar atualizacoes entre aparelhos sem
-- depender do relogio do celular ou do computador. Adicionar a coluna nao
-- altera o JSON, os nomes, os sorteios, as rodadas nem os placares existentes.
alter table public.tournaments
  add column if not exists revision bigint not null default 0;

alter table public.tournaments
  add column if not exists last_change_id uuid;

alter table public.circuits
  add column if not exists revision bigint not null default 0;

create or replace function public.bump_collaboration_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.revision := coalesce(old.revision, 0) + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists tournaments_bump_collaboration_revision on public.tournaments;
create trigger tournaments_bump_collaboration_revision
before update on public.tournaments
for each row
execute function public.bump_collaboration_revision();

drop trigger if exists circuits_bump_collaboration_revision on public.circuits;
create trigger circuits_bump_collaboration_revision
before update on public.circuits
for each row
execute function public.bump_collaboration_revision();

comment on column public.tournaments.revision is
  'Versao monotona gerada pelo servidor para sincronizacao segura entre aparelhos.';

comment on column public.tournaments.last_change_id is
  'Identifica a gravacao para o aparelho reconhecer a propria confirmacao em tempo real.';

comment on column public.circuits.revision is
  'Versao monotona gerada pelo servidor para sincronizacao segura entre aparelhos.';

commit;
