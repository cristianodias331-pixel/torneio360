import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createInitialData, normalizeTournamentData, needsTournamentDataRepair } from '../src/domain/tournamentDataNormalization.mjs';
import { modalityConfig, allowedByPlan } from '../src/domain/modalityConfig.mjs';
import { modalityPickerGroups } from '../src/domain/modalityCatalog.mjs';
import { getNewTournamentRankingCriteria, getAutomaticCupRankingLabel } from '../src/domain/cupRankingDefaults.mjs';
import { getTournamentCompletionState } from '../src/domain/tournamentLifecycle.mjs';
import { calculateTournamentRanking } from '../src/domain/tournamentRanking.mjs';
import { createTournamentOperations } from '../src/domain/tournamentOperations.mjs';
import { inspectTournamentScoreRegression } from '../src/domain/tournamentScoreSafety.mjs';
import { reiDoSolState, applyReiDoSolState, resizeReiDoSol } from '../src/domain/reiDoSolData.mjs';
import { makeExample, phaseRanking, applyManualTieOrder, CRITERIA } from '../src/domain/reiDoSol.mjs';
import { createReiDoSolDrawVideo } from '../src/features/reiDoSol/reiDoSolDrawVideo.mjs';
const type = 'Rei do Sol', config = modalityConfig[type];
const initial = createInitialData(type, config);
assert.equal(initial.players.length, 16);
assert.ok(initial.players.every(name => name === ''));
assert.deepEqual(initial.schedule, []);
assert.deepEqual(initial.brackets, []);
assert.equal(initial.rankingCriteria, 'wins_balance_points');
assert.equal(needsTournamentDataRepair(type, initial), false);
assert.ok(allowedByPlan.premium.includes(type));
assert.ok(modalityPickerGroups.some(group => group.types.includes(type)));
assert.equal(getNewTournamentRankingCriteria(type, 'points_wins_balance'), 'wins_balance_points');
assert.equal(getAutomaticCupRankingLabel(type), CRITERIA);
const operations = createTournamentOperations();
for (const count of [16, 17, 19, 20, 32]) for (const target of [4, 6]) {
  for (const scenario of ['empty', 'progress', 'qualifying', 'finals', 'finished']) {
    const state = makeExample(count, target, scenario);
    const data = applyReiDoSolState(initial, state);
    const restored = normalizeTournamentData(type, JSON.parse(JSON.stringify(data)));
    assert.equal(needsTournamentDataRepair(type, restored), false);
    assert.equal(restored.players.length, count);
    assert.equal(restored.winningScore, target);
    assert.equal(restored.schedule.flat().length, count);
    assert.equal(restored.brackets.length, state.finals.length * 3);
    assert.deepEqual(restored.reiDoSol.decisions, state.draws);
    assert.deepEqual(restored.reiDoSol.finalGroups.map(group => group.ids), state.finals.map(group => group.ids));
    assert.equal(inspectTournamentScoreRegression(data, restored).unsafe, false);
    assert.deepEqual(normalizeTournamentData(type, restored), restored, 'Normalization must be idempotent');
    const completion = getTournamentCompletionState({ type, data: restored });
    assert.equal(completion.completed, scenario === 'finished');
    const q = phaseRanking(state.players, state.qualifying, target, state.draws.qualifying);
    assert.deepEqual(calculateTournamentRanking({ data: restored, config }).map(row => row.id), q.rows.map(row => row.id));
    const games = operations.getTournamentOperationalGames(restored);
    assert.equal(games.length, count + state.finals.length * 3);
    games.forEach(({ game }) => {
      assert.deepEqual(game.team1, game.ids1.map(id => state.players[id]));
      assert.deepEqual(game.team2, game.ids2.map(id => state.players[id]));
    });
    const renamed = applyReiDoSolState(restored, { ...reiDoSolState(restored), players: restored.players.map((name, i) => i === 0 ? 'Nome Corrigido' : name) });
    assert.equal(inspectTournamentScoreRegression(restored, renamed).unsafe, false);
    assert.equal(renamed.brackets.filter(game => game.ids1.includes(0)).every(game => game.team1.includes('Nome Corrigido')), true);
    const reduced = resizeReiDoSol(restored, 16);
    assert.deepEqual(reduced.players, restored.players.slice(0, 16));
    assert.deepEqual(reduced.brackets, []);
    assert.deepEqual(reduced.schedule, []);
    if (scenario === 'finished') assert.ok(inspectTournamentScoreRegression(restored, reduced).unsafe);
  }
}
const complete = applyReiDoSolState(initial, makeExample(20, 4, 'finished'));
const damaged = structuredClone(complete);
damaged.brackets.pop();
assert.equal(getTournamentCompletionState({ type, data: damaged }).completed, false, 'A missing final match must not declare completion');
const tied = makeExample(20, 4, 'qualifying');
tied.qualifying.flat().forEach(game => { game.s1 = '4'; game.s2 = '0'; });
const ranking = phaseRanking(tied.players, tied.qualifying, 4);
if (ranking.pending.length) {
  const tie = ranking.pending[0];
  const manual = applyManualTieOrder(tied, 'qualifying', tie.signature, [...tie.ids].reverse());
  const saved = normalizeTournamentData(type, applyReiDoSolState(initial, manual));
  assert.equal(saved.reiDoSol.decisions.qualifying[tie.signature].method, 'manual');
}
const receipt = createReiDoSolDrawVideo(['Ana Teste', 'Bia Teste'], 'names', { name: 'Evento oficial', type });
assert.doesNotMatch(JSON.stringify(receipt), /PRÉVIA|Prévia/);
assert.match(JSON.stringify(receipt), /Evento oficial/);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: Workspace } = await server.ssrLoadModule('/src/features/reiDoSol/ReiDoSolWorkspace.jsx');
  const html = renderToStaticMarkup(React.createElement(Workspace, { data: initial, tournament: { name: 'Evento oficial', type }, setData: () => {} }));
  for (const label of ['Formato do torneio', 'Participantes', 'Quantidade de atletas']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /Dados simulados|Carregar exemplo|Testar outros exemplos|PRÉVIA LOCAL/);
  const { default: Public } = await server.ssrLoadModule('/src/features/publicArena/PublicTournamentScreen.jsx');
  for (const data of [initial, complete, applyReiDoSolState(initial, tied)]) {
    const publicHtml = renderToStaticMarkup(React.createElement(Public, { tournament: { id: 'rds-check', name: 'Evento oficial', type, data }, runtime: {} }));
    assert.match(publicHtml, /Evento oficial/);
    assert.doesNotMatch(publicHtml, /scoreInput|<input|<textarea|<select|Sortear desempate|Escolher manualmente|Confirmar todos|Criar rodadas e jogos|Gerar fase final|Compartilhar<|PRÉVIA LOCAL/);
    assert.ok(!publicHtml.includes('Modalidade indisponível'));
  }
} finally { await server.close(); }
console.log('Rei do Sol integrated: creation, variable counts, cloud round-trip, score safety, courts, lifecycle, fixed criteria, manual decisions, media and read-only shared view passed.');
