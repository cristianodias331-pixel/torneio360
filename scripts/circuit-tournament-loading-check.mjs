import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { isTournamentSummary } from "../src/domain/tournamentSummary.mjs";
import { resolveCircuitTournamentSelection } from "../src/domain/circuitTournamentSelection.mjs";
import { normalizeCircuitRow, normalizeCircuitTournamentIds } from "../src/domain/circuitDirectory.mjs";
import { normalizeCircuitRankingSettings } from "../src/domain/circuitRankingSettings.mjs";
import { defaultRankingCriteria } from "../src/domain/rankingCriteria.mjs";
import { buildCircuitTournamentRankingRecords } from "../src/domain/circuitRankingAggregation.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { super8Template } from "../src/domain/scheduleTemplates.mjs";

// Exercise the actual workspace loader, without mounting the organizer or
// connecting to Supabase. Only the I/O boundary and React refs are simulated.
const workspace = readFileSync(new URL("../src/OrganizerWorkspace.jsx", import.meta.url), "utf8");
const start = workspace.indexOf("  async function loadFullTournamentRows(");
const end = workspace.indexOf("  async function hydrateTournamentDetails(", start);
assert.ok(start >= 0 && end > start, "Não foi possível localizar o carregador real.");
const loaderSource = workspace.slice(start, end).trim();
const full = (id) => ({ id, __summary: false, data: { schedule: [{ score1: 4, score2: 2 }] } });
const summary = (id) => ({ id, __summary: true, data: {} });
const rowIds = (rows) => Array.from(rows, (row) => row.id).sort();

function fixture(rows, { offline = false } = {}) {
  const refs = { current: rows };
  const requests = [];
  const inFlight = { current: new Map() };
  const notices = [];
  const supabase = {
    from(table) {
      assert.equal(table, "tournaments");
      return {
        select(columns) { assert.equal(columns, "*"); return this; },
        eq(column, value) { assert.equal(column, "user_id"); assert.equal(value, "fixture-owner"); return this; },
        in(column, ids) {
          assert.equal(column, "id");
          let resolve;
          const promise = new Promise((done) => { resolve = done; });
          requests.push({ ids: Array.from(ids), resolve });
          return promise;
        },
      };
    },
  };
  const load = vm.runInNewContext(`(${loaderSource})`, {
    tournamentsRef: refs,
    trashTournamentsRef: { current: [] },
    tournamentDetailsLoadPromisesRef: inFlight,
    isTournamentSummary,
    isBrowserOffline: () => offline,
    supabase,
    user: { id: "fixture-owner" },
    showNotice: (...args) => notices.push(args),
    console: { error() {} },
    mergeFullTournamentRowsIntoState: (loaded) => {
      const byId = new Map(loaded.map((row) => [row.id, row]));
      refs.current = refs.current.map((row) => byId.get(row.id) || row);
    },
  });
  return { load, requests, inFlight, notices, refs };
}

test("salvar circuito durante o pré-carregamento mantém os seis torneios já carregados", async () => {
  const existing = Array.from({ length: 6 }, (_, i) => full(`etapa-${i + 1}`));
  const f = fixture([...existing, summary("nova-etapa")]);
  const preload = f.load(["nova-etapa"], { silentError: true });
  const selectedIds = [...existing.map((row) => row.id), "nova-etapa"];
  const saveLoad = f.load(selectedIds, { silentError: true });
  assert.equal(f.requests.length, 1, "A consulta em andamento deve ser reaproveitada.");
  f.requests[0].resolve({ data: [full("nova-etapa")], error: null });
  assert.deepEqual(rowIds(await preload), ["nova-etapa"]);
  const completeRows = await saveLoad;
  assert.deepEqual(rowIds(completeRows), selectedIds.sort(), "O salvamento perdeu torneios que já estavam completos.");
  assert.equal(selectedIds.some((id) => !completeRows.some((row) => row.id === id)), false,
    "A proteção de completude do circuito não deve rejeitar uma resposta completa.");
  assert.equal(f.inFlight.current.size, 0);
});

test("quem pede apenas um torneio não recebe os outros da chamada compartilhada", async () => {
  const f = fixture([full("existente"), summary("novo")]);
  const circuitLoad = f.load(["existente", "novo"]);
  const singleLoad = f.load(["novo"]);
  f.requests[0].resolve({ data: [full("novo")], error: null });
  assert.deepEqual(rowIds(await circuitLoad), ["existente", "novo"]);
  assert.deepEqual(rowIds(await singleLoad), ["novo"]);
});

test("cada chamada preserva seus dados locais ao compartilhar vários IDs faltantes", async () => {
  const f = fixture([full("etapa-a"), full("etapa-b"), summary("nova-a"), summary("nova-b")]);
  const first = f.load(["etapa-a", "nova-a", "nova-b"]);
  const second = f.load(["etapa-b", "nova-b", "nova-a"]);
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ data: [full("nova-a"), full("nova-b")], error: null });
  assert.deepEqual(rowIds(await first), ["etapa-a", "nova-a", "nova-b"]);
  assert.deepEqual(rowIds(await second), ["etapa-b", "nova-a", "nova-b"]);
});

test("erro de rede preserva os resultados locais, sem inventar os faltantes, e permite nova tentativa", async () => {
  const f = fixture([full("existente"), summary("novo")]);
  const preload = f.load(["novo"], { silentError: true });
  const circuitLoad = f.load(["existente", "novo"], { silentError: true });
  f.requests[0].resolve({ data: null, error: { message: "rede indisponível" } });
  assert.deepEqual(rowIds(await preload), []);
  assert.deepEqual(rowIds(await circuitLoad), ["existente"]);
  assert.equal(f.inFlight.current.size, 0);
  const retry = f.load(["existente", "novo"]);
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ data: [full("novo")], error: null });
  assert.deepEqual(rowIds(await retry), ["existente", "novo"]);
});

test("registro realmente ausente continua bloqueando cálculo incompleto", async () => {
  const f = fixture([full("existente"), summary("ausente")]);
  const preload = f.load(["ausente"]);
  const circuitLoad = f.load(["existente", "ausente"]);
  f.requests[0].resolve({ data: [], error: null });
  await preload;
  assert.deepEqual(rowIds(await circuitLoad), ["existente"]);
});

test("dados completos e modo offline não fazem consultas desnecessárias", async () => {
  const f = fixture([full("existente"), summary("novo")], { offline: true });
  assert.deepEqual(rowIds(await f.load(["existente", "existente"])), ["existente"]);
  assert.deepEqual(rowIds(await f.load(["existente", "novo"])), ["existente"]);
  assert.deepEqual(rowIds(await f.load([])), []);
  assert.equal(f.requests.length, 0);
});

function deletionFixture({ rows = [], signals = [], error = null, throws = false } = {}) {
  const queries = [];
  const supabase = {
    from(table) {
      assert.equal(table, "tournament_change_feed");
      return {
        select(columns) { assert.equal(columns, "tournament_id, deleted"); return this; },
        eq(column, value) { assert.equal(column, "user_id"); assert.equal(value, "fixture-owner"); return this; },
        async in(column, ids) {
          assert.equal(column, "tournament_id");
          queries.push(Array.from(ids));
          if (throws) throw new Error("offline");
          return { data: signals, error };
        },
      };
    },
  };
  return {
    supabase, queries,
    resolve: (tournamentIds, previousTournamentIds) => resolveCircuitTournamentSelection({
      tournamentIds, previousTournamentIds, supabase, userId: "fixture-owner",
      loadFullTournamentRows: async () => rows,
    }),
  };
}

test("vínculo antigo purgado não bloqueia uma etapa nova completa", async () => {
  const f = deletionFixture({ rows: [full("existente"), full("04-09")],
    signals: [{ tournament_id: "purgado", deleted: true }] });
  const selected = ["existente", "purgado", "04-09"];
  const previous = ["existente", "purgado"];
  const result = await f.resolve(selected, previous);
  assert.deepEqual(result.tournamentIds, ["existente", "04-09"]);
  assert.deepEqual(result.removedTournamentIds, ["purgado"]);
  assert.deepEqual(result.missingTournamentIds, []);
  assert.deepEqual(selected, ["existente", "purgado", "04-09"], "Não deve editar o formulário antes de salvar.");
  assert.deepEqual(previous, ["existente", "purgado"]);
});

for (const scenario of [
  { name: "sem sinal de exclusão", signals: [] },
  { name: "torneio restaurado", signals: [{ tournament_id: "ausente", deleted: false }] },
  { name: "erro de consulta", signals: [{ tournament_id: "ausente", deleted: true }], error: { message: "falha" } },
  { name: "exceção de rede", throws: true },
]) {
  test(`${scenario.name}: mantém vínculo e bloqueia ranking incompleto`, async () => {
    const f = deletionFixture({ rows: [full("novo")], ...scenario });
    const result = await f.resolve(["ausente", "novo"], ["ausente"]);
    assert.deepEqual(result.tournamentIds, ["ausente", "novo"]);
    assert.deepEqual(result.removedTournamentIds, []);
    assert.deepEqual(result.missingTournamentIds, ["ausente"]);
  });
}

test("nova etapa ausente nunca é descartada como se a inclusão tivesse dado certo", async () => {
  const f = deletionFixture({ rows: [full("existente")], signals: [{ tournament_id: "novo", deleted: true }] });
  const result = await f.resolve(["existente", "novo"], ["existente"]);
  assert.deepEqual(result.missingTournamentIds, ["novo"]);
  assert.deepEqual(result.removedTournamentIds, []);
  assert.equal(f.queries.length, 0);
});

test("torneio na lixeira, resumo ou dados de outro pedido não autorizam limpar vínculos", async () => {
  const trashed = { ...full("lixeira"), data: { deletedAt: "2026-09-01" } };
  const f = deletionFixture({ rows: [trashed, summary("resumo"), full("fora-da-selecao")],
    signals: [{ tournament_id: "fora-da-selecao", deleted: true }] });
  const result = await f.resolve(["lixeira", "resumo"], ["lixeira", "resumo"]);
  assert.deepEqual(result.tournamentIds, ["lixeira", "resumo"]);
  assert.deepEqual(result.missingTournamentIds, ["resumo"]);
  assert.deepEqual(rowIds(result.fullRows), ["lixeira"]);
  assert.deepEqual(result.removedTournamentIds, []);
});

// Execute também o salvamento real: nenhuma escrita pode ocorrer se a
// seleção estiver incompleta, e os dados antigos devem sobreviver ao recálculo.
const saveStart = workspace.indexOf("  async function persistCircuit(");
const saveEnd = workspace.indexOf("  function getTournamentCircuitMembership(", saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart);
const saveSource = workspace.slice(saveStart, saveEnd).trim();
const super8 = (id) => ({ id, type: "Super 08", __summary: false,
  data: { players: Array.from({ length: 8 }, (_, i) => `Atleta ${i + 1}`), winningScore: 4,
    schedule: super8Template.map((round) => round.map(([first, second]) => ({
      ids1: first.map((n) => n - 1), ids2: second.map((n) => n - 1), s1: "4", s2: "2",
    }))) } });

function saveFixture({ missingNew = false, deletionError = null } = {}) {
  const existing = Array.from({ length: 6 }, (_, i) => super8(`etapa-${i + 1}`));
  const newStage = super8("04-09");
  const rows = missingNew ? existing : [...existing, newStage];
  const previous = { id: "circuito", name: "Circuito teste", startDate: "2026-07-31", endDate: "2026-09-04",
    tournamentIds: [...existing.map((row) => row.id), "purgado"], rankingCriteria: defaultRankingCriteria,
    rankingCriteriaMode: "automatic", rankingSettings: normalizeCircuitRankingSettings({ mode: "performance" }) };
  const form = { ...previous, tournamentIds: [...previous.tournamentIds, "04-09"], _baseCircuit: previous };
  const writes = [];
  const histories = [];
  const notices = [];
  const deletion = deletionFixture({ rows, signals: [{ tournament_id: "purgado", deleted: true }], error: deletionError });
  const selectedRows = (circuit, source) => source.filter((row) => circuit.tournamentIds.includes(row.id) && !row.data?.deletedAt);
  const buildHistory = (circuit, source) => buildCircuitTournamentRankingRecords({
    tournaments: selectedRows(circuit, source), settings: circuit.rankingSettings, modalityConfigs: modalityConfig,
  });
  const supabase = { from(table) {
    if (table === "tournament_change_feed") return deletion.supabase.from(table);
    assert.equal(table, "circuits");
    return { update(payload) {
      writes.push(payload);
      return { eq() { return this; }, select() { return this; },
        async maybeSingle() { return { data: { ...payload, id: previous.id }, error: null }; } };
    } };
  } };
  const persist = vm.runInNewContext(`(${saveSource})`, {
    ensureCloudConnection: () => true, user: { id: "fixture-owner" },
    circuitsRef: { current: [previous] }, tournamentsRef: { current: rows },
    normalizeCircuitTournamentIds, normalizeCircuitRankingSettings, normalizeCircuitRow, defaultRankingCriteria,
    mergeParticipantGenderRegistries: () => ({}), getArenaParticipantGenderRegistry: () => ({}),
    getAutomaticEventStatus: () => "finished", getCollaborationRevision: () => null,
    resolveCircuitTournamentSelection, loadFullTournamentRows: async () => rows, supabase,
    buildCircuitRankingHistory: buildHistory, getCircuitSelectedTournaments: selectedRows,
    saveCircuits() {}, setCircuitEditForm() {},
    saveCircuitHistoryToSupabase: async (id, history, sources) => { histories.push({ id, history, sources }); return true; },
    syncPublicArenaDirectory: async () => {}, showNotice: (...args) => notices.push(args), console,
  });
  return { persist: () => persist(form), writes, histories, notices, rows, existing,
    beforeHistory: buildHistory(previous, existing), snapshot: JSON.stringify(rows) };
}

test("salvamento inclui 04/09, elimina só o vínculo purgado e preserva os 48 registros anteriores", async () => {
  const f = saveFixture();
  assert.equal(await f.persist(), true);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(Array.from(f.writes[0].tournament_ids), [...f.existing.map((row) => row.id), "04-09"]);
  assert.equal(f.histories.length, 1);
  assert.equal(Object.keys(f.beforeHistory).length, 48);
  assert.equal(Object.keys(f.histories[0].history).length, 56);
  for (const [key, record] of Object.entries(f.beforeHistory)) {
    assert.deepEqual(f.histories[0].history[key], record, "Os pontos antigos foram alterados.");
  }
  assert.equal(JSON.stringify(f.rows), f.snapshot, "Jogos e placares não devem ser regravados ou alterados.");
  assert.match(f.notices.at(-1)[2], /Vínculos antigos/);
});

for (const options of [{ missingNew: true }, { deletionError: { message: "indisponível" } }]) {
  test(`salvamento incompleto não altera circuito nem histórico: ${JSON.stringify(options)}`, async () => {
    const f = saveFixture(options);
    assert.equal(await f.persist(), false);
    assert.equal(f.writes.length, 0);
    assert.equal(f.histories.length, 0);
    assert.equal(JSON.stringify(f.rows), f.snapshot);
    assert.equal(f.notices.at(-1)[1], "Resultados indisponíveis");
  });
}

test("exclusão do organizador relê os circuitos atualizados sem regravar ranking antigo", { timeout: 2000 }, async () => {
  const deleteStart = workspace.indexOf("  async function confirmDeleteTournament()");
  const deleteEnd = workspace.indexOf("  async function restoreTournament(", deleteStart);
  assert.ok(deleteStart >= 0 && deleteEnd > deleteStart);
  const target = super8("removido");
  const remaining = super8("mantido");
  const currentCircuits = { current: [{ id: "circuito", tournamentIds: [target.id, remaining.id] }] };
  const appliedRows = [], historyReloads = [], writes = [];
  let finish;
  const synced = new Promise((resolveDone) => { finish = resolveDone; });
  const remove = vm.runInNewContext(`(${workspace.slice(deleteStart, deleteEnd).trim()})`, {
    deleteTarget: target, ensureCloudConnection: () => true,
    hydrateTournamentDetails: async () => target, normalizeCircuitTournamentIds,
    tournaments: [target, remaining], trashTournaments: [], openTournamentIds: [],
    tournamentsRef: { current: [target, remaining] }, trashTournamentsRef: { current: [] },
    circuitsRef: currentCircuits, trashCircuitsRef: { current: [] },
    user: { id: "fixture-owner" }, getCollaborationRevision: () => null,
    setDeleteTarget() {}, setTournaments() {}, setTrashTournaments() {}, setOpenTournamentIds() {}, showNotice() {},
    mergeRealtimeTournamentRow: (_old, fresh) => fresh, hasSavedManualTournamentOrder: () => false,
    circuitDirectorySelect: "fixture-circuit-directory",
    supabase: { from(table) {
      if (table === "tournaments") return { update(payload) {
        writes.push({ table, payload });
        return { eq() { return this; }, select() { return this; }, async maybeSingle() {
          return { data: { ...target, ...payload }, error: null };
        } };
      } };
      assert.equal(table, "circuits");
      return { select() { return this; }, eq() { return this; }, async in(column, ids) {
        assert.equal(column, "id");
        assert.deepEqual(Array.from(ids), ["circuito"]);
        return { data: [{ id: "circuito", tournament_ids: [remaining.id] }], error: null };
      } };
    } },
    applyRemoteCircuitChange: ({ new: row }) => { appliedRows.push(row); currentCircuits.current = [row]; },
    loadCircuitRankingHistory: async (circuitId, options) => { historyReloads.push(circuitId); assert.equal(options.force, true); },
    syncPublicArenaDirectory: async (source, circuits) => {
      assert.deepEqual(rowIds(source), [remaining.id]);
      assert.deepEqual(circuits, currentCircuits.current);
      finish();
    },
    console: { error: (error) => { throw error; }, warn() {} },
  });
  await remove();
  await synced;
  assert.equal(writes.length, 1, "Só a exclusão do torneio deve ser gravada pelo cliente.");
  assert.deepEqual(appliedRows[0].tournament_ids, [remaining.id]);
  assert.deepEqual(historyReloads, ["circuito"]);
});
