import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// PostgreSQL local em memória, sem URL de conexão ou dados de produção.
// Aceita o caminho de uma instalação de PGlite já autorizada, sem adicioná-lo
// às dependências do site: node scripts/circuit-deletion-sql-check.mjs <index.js>
const { PGlite } = await import(process.argv[2]
  ? pathToFileURL(resolve(process.argv[2])).href
  : "@electric-sql/pglite");
const db = new PGlite();
const migration = await readFile(new URL("../supabase/migrations/202609150001_circuit_tournament_removal.sql", import.meta.url), "utf8");
const revisions = await readFile(new URL("../supabase/migrations/202608080002_server_revisions.sql", import.meta.url), "utf8");
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const owner = id(90), otherOwner = id(91);
const [first, second, trashed, other, missing] = [1, 2, 3, 4, 5].map(id);
const [circuit, secondary, untouched] = [11, 12, 13].map(id);
const read = async (sql, params = []) => (await db.query(sql, params)).rows;
const state = async () => ({
  tournaments: await read("select * from tournaments order by id"),
  circuits: await read("select * from circuits order by id"),
  history: await read("select * from circuit_ranking_history order by circuit_id, tournament_id, player_key"),
});

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('app.owner', true), '')::uuid $$;
    create table tournaments (
      id uuid primary key, user_id uuid not null, name text not null,
      data jsonb not null default '{}', updated_at timestamptz not null default now()
    );
    create table circuits (
      id uuid primary key, user_id uuid not null, name text not null,
      tournament_ids text[] default '{}'::text[], ranking_settings jsonb not null default '{}',
      updated_at timestamptz not null default now()
    );
    create table circuit_ranking_history (
      circuit_id uuid references circuits(id) on delete cascade,
      tournament_id uuid references tournaments(id) on delete cascade,
      user_id uuid not null, player_key text not null, pts integer not null, w integer not null,
      primary key(circuit_id, tournament_id, player_key)
    );
    alter table tournaments enable row level security;
    alter table circuits enable row level security;
    alter table circuit_ranking_history enable row level security;
    create policy owner_tournaments on tournaments to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
    create policy owner_circuits on circuits to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
    create policy owner_history on circuit_ranking_history to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on tournaments, circuits, circuit_ranking_history to authenticated;
  `);
  await db.exec(revisions);
  for (const [key, userId, data] of [
    [first, owner, { schedule: [[{ s1: "4", s2: "2" }]] }],
    [second, owner, { schedule: [[{ s1: "4", s2: "1" }]] }],
    [trashed, owner, { deletedAt: "2026-08-04T12:27:27Z", schedule: [[{ s1: "4", s2: "3" }]] }],
    [other, otherOwner, { schedule: [[{ s1: "4", s2: "0" }]] }],
  ]) await db.query("insert into tournaments(id,user_id,name,data) values($1,$2,$3,$4)", [key, userId, `Etapa ${key}`, JSON.stringify(data)]);
  for (const [key, userId, ids] of [
    [circuit, owner, [first, missing, second, trashed]],
    [secondary, owner, [first]],
    [untouched, otherOwner, [other]],
  ]) await db.query("insert into circuits(id,user_id,name,tournament_ids,ranking_settings) values($1,$2,$3,$4,$5)",
    [key, userId, `Circuito ${key}`, ids, JSON.stringify({ mode: "performance", extraPoints: [{ name: "Manual", points: 7 }] })]);
  for (const [c, t, userId, points] of [
    [circuit, first, owner, 20], [circuit, second, owner, 30], [circuit, trashed, owner, 40],
    [secondary, first, owner, 20], [untouched, other, otherOwner, 50],
  ]) await db.query("insert into circuit_ranking_history values($1,$2,$3,'atleta', $4, 1)", [c, t, userId, points]);

  const before = await state();
  await db.exec(migration);
  const repaired = await state();
  assert.deepEqual(repaired.tournaments, before.tournaments, "Migração não pode editar jogos ou torneios.");
  assert.deepEqual(repaired.circuits[0].tournament_ids, [first, second], "Repara somente vínculos ausentes/na lixeira, mantendo a ordem.");
  assert.deepEqual(repaired.circuits[0].ranking_settings, before.circuits[0].ranking_settings);
  assert.deepEqual(repaired.circuits.slice(1), before.circuits.slice(1), "Circuitos sem problema não devem ser regravados.");
  assert.deepEqual(repaired.history, before.history.filter((row) => row.tournament_id !== trashed));
  console.log("SQL: reparo legado mantém os torneios, configurações e resultados válidos.");

  await db.exec(migration);
  assert.deepEqual(await state(), repaired, "Reaplicar a migração não deve mudar dados nem revisões.");

  await db.query("select set_config('app.owner', $1, false)", [owner]);
  await db.exec("set role authenticated");
  const forbidden = await read("delete from tournaments where id = $1 returning id", [other]);
  assert.equal(forbidden.length, 0, "O organizador não pode excluir torneio de outra conta.");
  await assert.rejects(db.exec("select public.remove_tournament_from_circuits()"), /permission denied/);

  await db.exec("begin");
  await db.query("update tournaments set data = data || '{\"deletedAt\":\"2026-09-15\"}' where id = $1", [first]);
  assert.deepEqual((await read("select tournament_ids from circuits where id=$1", [circuit]))[0].tournament_ids, [second]);
  await db.exec("rollback");
  await db.exec("reset role");
  assert.deepEqual(await state(), repaired, "Rollback da exclusão deve restaurar também circuitos e ranking.");
  console.log("SQL: exclusão, vínculos e ranking têm rollback atômico; isolamento entre contas preservado.");

  await db.exec("set role authenticated");
  await db.query("update tournaments set data = data || '{\"deletedAt\":\"2026-09-15\"}' where id = $1", [first]);
  await db.exec("reset role");
  const deleted = await state();
  assert.deepEqual(deleted.circuits[0].tournament_ids, [second]);
  assert.deepEqual(deleted.circuits[1].tournament_ids, [], "Também limpa o segundo circuito vinculado.");
  assert.deepEqual(deleted.history, repaired.history.filter((row) => row.tournament_id !== first));
  assert.deepEqual(deleted.circuits[2], repaired.circuits[2]);
  assert.deepEqual(deleted.tournaments[0].data.schedule, repaired.tournaments[0].data.schedule, "Lixeira preserva os placares recuperáveis.");

  await db.query("update circuits set tournament_ids=$1 where id=$2", [[first, second, missing, other], circuit]);
  assert.deepEqual((await read("select tournament_ids from circuits where id=$1", [circuit]))[0].tournament_ids, [second],
    "Formulário desatualizado não pode reintroduzir torneio excluído, ausente ou de outra conta.");
  console.log("SQL: mover para a lixeira retira contribuições de todos os circuitos e impede reintrodução por cliente antigo.");

  const circuitsBeforeRestore = await read("select * from circuits order by id");
  await db.query("update tournaments set data=data - 'deletedAt' where id=$1", [first]);
  assert.deepEqual(await read("select * from circuits order by id"), circuitsBeforeRestore,
    "Restaurar torneio não deve reinseri-lo silenciosamente nos circuitos.");
  await db.query("update tournaments set name='Nome ajustado' where id=$1", [second]);
  assert.deepEqual(await read("select * from circuits order by id"), circuitsBeforeRestore,
    "Edição de nome não é exclusão.");

  await db.query("delete from tournaments where id=$1", [second]);
  const purged = await state();
  assert.deepEqual(purged.circuits[0].tournament_ids, [], "Exclusão definitiva também limpa os vínculos.");
  assert.deepEqual(purged.history, repaired.history.filter((row) => row.tournament_id === other));
  assert.deepEqual(purged.circuits[2], repaired.circuits[2]);
  console.log("SQL: restauração exige nova vinculação; exclusão definitiva não deixa vínculos órfãos. Todos os testes aprovados.");
} finally {
  await db.close();
}
