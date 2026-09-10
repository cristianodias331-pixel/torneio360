import assert from 'node:assert/strict';
import { qualifyingSchedule, seededRandom, phaseRanking, makeExample, createFinals, withNames, GROUPS, groupChampion, shuffleParticipants, generateQualifying, importParticipantNames, CRITERIA, RANKING_COLUMNS, finalsFollowQualification, applyManualTieOrder, isValidTieOrder } from './rei-do-sol-model.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let designs = 0;
for (let count = 16; count <= 256; count++) {
  for (const seed of [1, 360, 1909]) {
    const schedule = qualifyingSchedule(count, seededRandom(seed));
    const appearances = Array.from({ length: count }, () => 0);
    const partners = Array.from({ length: count }, () => new Set());
    const opponents = Array.from({ length: count }, () => new Set());
    assert.equal(schedule.flat().length, count);
    assert.equal(new Set(schedule.flat().map(game => game.matchKey)).size, count);
    schedule.forEach(round => {
      assert.ok(round.length <= 4);
      const playing = new Set();
      round.forEach(game => {
        assert.equal(new Set([...game.ids1, ...game.ids2]).size, 4);
        for (const [side, other] of [[game.ids1, game.ids2], [game.ids2, game.ids1]]) {
          side.forEach(id => {
            assert.ok(id >= 0 && id < count);
            assert.ok(!playing.has(id), 'An athlete cannot play twice in the same round');
            playing.add(id); appearances[id]++;
            const partner = side.find(otherId => otherId !== id);
            assert.ok(!partners[id].has(partner), 'No repeated partner');
            partners[id].add(partner);
            other.forEach(opponent => { assert.ok(!opponents[id].has(opponent), 'No repeated opponent'); opponents[id].add(opponent); });
          });
        }
      });
    });
    appearances.forEach((amount, id) => { assert.equal(amount, 4); assert.equal(partners[id].size, 4); assert.equal(opponents[id].size, 8); });
    designs++;
  }
}
assert.throws(() => qualifyingSchedule(15));
assert.throws(() => qualifyingSchedule(17.5));
assert.throws(() => qualifyingSchedule(16, Math.random, 0));

for (const count of [16, 17, 19, 20, 32, 64]) {
  for (const target of [4, 6]) {
    const state = makeExample(count, target);
    const q = phaseRanking(state.players, state.qualifying, target, state.draws.qualifying);
    assert.ok(q.settled);
    q.rows.forEach(row => assert.equal(row.played, 4));
    assert.equal(q.rows.reduce((sum, row) => sum + row.w, 0), count * 2);
    assert.equal(q.rows.reduce((sum, row) => sum + row.bal, 0), 0);
    assert.deepEqual(state.finals.map(group => group.id), GROUPS.map(group => group.id));
    assert.equal(new Set(state.finals.flatMap(group => group.ids)).size, 16);
    state.finals.forEach((group, index) => {
      assert.deepEqual(group.ids, q.rows.slice(index * 4, index * 4 + 4).map(row => row.id));
      const r = phaseRanking(state.players, group.schedule, target, {}, group.ids);
      assert.equal(r.rows.length, 4);
      assert.ok(!r.complete && !r.settled);
      r.rows.forEach(row => assert.deepEqual([row.w, row.bal, row.pts, row.played], [0, 0, 0, 0]));
      const pairs = group.schedule.flat().flatMap(game => [game.ids1, game.ids2]).map(ids => [...ids].sort((a, b) => a - b).join('-'));
      assert.equal(new Set(pairs).size, 6);
      group.ids.forEach(id => assert.equal(group.schedule.flat().filter(game => [...game.ids1, ...game.ids2].includes(id)).length, 3));
    });
    const finished = makeExample(count, target, 'finished');
    finished.finals.forEach(group => {
      const r = phaseRanking(finished.players, group.schedule, target, finished.draws[group.id], group.ids);
      assert.ok(r.settled);
      r.rows.forEach(row => assert.equal(row.played, 3));
    });
    const reloaded = JSON.parse(JSON.stringify(finished));
    assert.deepEqual(reloaded, finished, 'Local save round-trip preserves draws and scores');
    const renamed = [...state.players]; renamed[0] = 'Nome editado';
    const names = withNames(state.qualifying, renamed);
    names.flat().filter(game => game.ids1.includes(0)).forEach(game => assert.ok(game.team1.includes('Nome editado')));
  }
}
const sample = makeExample(20, 4, 'empty');
assert.throws(() => createFinals(phaseRanking(sample.players, sample.qualifying, 4)));
const names = ['A', 'B', 'C', 'D'];
const oneGame = [[{ ids1: [0, 1], ids2: [2, 3], s1: '4', s2: '2', matchKey: 'test' }]];
const tie = phaseRanking(names, oneGame, 4);
assert.equal(tie.pending.length, 2, 'Partners cannot resolve their tie via direct confrontation');
const orders = Object.fromEntries(tie.pending.map(t => [t.signature, [...t.ids].reverse()]));
assert.ok(phaseRanking(names, oneGame, 4, orders).settled);
const changed = structuredClone(oneGame); changed[0][0].s2 = '1';
assert.equal(phaseRanking(names, changed, 4, orders).pending.length, 2, 'Old draw cannot survive score changes');
const duplicates = Object.fromEntries(tie.pending.map(t => [t.signature, t.ids.map(() => t.ids[0])]));
assert.equal(phaseRanking(names, oneGame, 4, duplicates).pending.length, 2);

const criterionNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gabi', 'Hugo'];
function campaigns(firstScores, secondScores) {
  return [...firstScores.map(([s1, s2], i) => ({ ids1: [0, 2], ids2: [4, 5], s1: String(s1), s2: String(s2), matchKey: `a-${i}` })),
    ...secondScores.map(([s1, s2], i) => ({ ids1: [1, 3], ids2: [6, 7], s1: String(s1), s2: String(s2), matchKey: `b-${i}` }))].map(game => [game]);
}
const rankingOf = schedule => phaseRanking(criterionNames, schedule, 4, {}, [0, 1]);
const victoryFirst = rankingOf(campaigns([[4, 3]], [[3, 4], [3, 4], [3, 4]]));
assert.equal(victoryFirst.rows[0].id, 0);
assert.ok(victoryFirst.rows[0].pts < victoryFirst.rows[1].pts);
const balanceFirst = rankingOf(campaigns([[4, 0], [0, 4]], [[4, 3], [2, 4]]));
assert.equal(balanceFirst.rows[0].id, 0);
assert.ok(balanceFirst.rows[0].pts < balanceFirst.rows[1].pts);
const gamesFirst = rankingOf(campaigns([[4, 2], [4, 3], [3, 4]], [[4, 0], [4, 3], [1, 4]]));
assert.equal(gamesFirst.rows[0].id, 0);
assert.equal(gamesFirst.rows[0].w, gamesFirst.rows[1].w);
assert.equal(gamesFirst.rows[0].bal, gamesFirst.rows[1].bal);
assert.ok(gamesFirst.rows[0].pts > gamesFirst.rows[1].pts);
assert.ok(gamesFirst.rows[0].coefficient < gamesFirst.rows[1].coefficient, 'Total games outranks coefficient');
const directGames = [[{ ids1: [0, 2], ids2: [1, 3], s1: '2', s2: '4', matchKey: 'direct' }], ...campaigns([[4, 0], [4, 1], [4, 3]], [[4, 1], [4, 1], [2, 4]])];
const directFirst = rankingOf(directGames);
assert.equal(directFirst.rows[0].id, 1);
assert.equal(directFirst.rows[0].resolution, 'Confronto direto');
assert.ok(directFirst.rows[0].coefficient < directFirst.rows[1].coefficient, 'Direct confrontation outranks coefficient');
const coefficientGames = campaigns([[4, 1], [4, 1], [4, 2], [4, 2]], [[4, 0], [4, 0], [4, 3], [4, 3]]);
const coefficientFirst = rankingOf(coefficientGames);
assert.equal(coefficientFirst.rows[0].id, 1);
assert.equal(coefficientFirst.rows[0].resolution, 'Coeficiente');
assert.deepEqual(coefficientFirst.rows.map(row => [row.w, row.bal, row.pts]), [[4, 10, 16], [4, 10, 16]]);
assert.ok(Math.abs(coefficientFirst.rows[0].coefficient - (1 + 1 + 4 / 7 + 4 / 7) / 4) < 1e-12);
assert.ok(Math.abs(coefficientFirst.rows[1].coefficient - (4 / 5 + 4 / 5 + 4 / 6 + 4 / 6) / 4) < 1e-12);
assert.equal(coefficientFirst.pending.length, 0, 'Coefficient must settle a tie before drawing');
const tiedCoefficientGames = campaigns([[4, 1], [4, 1], [4, 2], [4, 2]], [[4, 1], [4, 1], [4, 2], [4, 2]]);
const tiedCoefficient = rankingOf(tiedCoefficientGames);
assert.equal(tiedCoefficient.pending.length, 1);
const tiedSignature = tiedCoefficient.pending[0].signature;
assert.ok(tiedSignature.startsWith('rds-criteria-v2:'));
const finalDraw = phaseRanking(criterionNames, tiedCoefficientGames, 4, { [tiedSignature]: [1, 0] }, [0, 1]);
assert.equal(finalDraw.rows[0].id, 1);
assert.equal(finalDraw.rows[0].resolution, 'Sorteio');
assert.ok(finalDraw.settled);
const oldSignature = `4:10:16|0,1|${tiedCoefficientGames.flat().map(g => `${g.matchKey}:${g.s1}-${g.s2}`).join(';')}`;
assert.equal(phaseRanking(criterionNames, tiedCoefficientGames, 4, { [oldSignature]: [1, 0] }, [0, 1]).pending.length, 1, 'Old rule draws cannot override coefficient');
const partialCoefficient = structuredClone(coefficientGames);
partialCoefficient[0][0].s1 = '2'; partialCoefficient[0][0].s2 = '1';
const partial = rankingOf(partialCoefficient);
assert.equal(partial.rows.find(row => row.id === 0).played, 3);
assert.ok(Math.abs(partial.rows.find(row => row.id === 0).coefficient - (4 / 5 + 4 / 6 + 4 / 6) / 3) < 1e-12, 'Ignore incomplete matches in coefficient');
assert.equal(CRITERIA, 'Vitórias → Saldo de games → Total de games → Confronto direto → Coeficiente → Sorteio ou escolha manual do organizador');
const manualState = { players: criterionNames, qualifying: tiedCoefficientGames, finals: [], target: 4, draws: {}, drawVideos: {} };
const manualPending = phaseRanking(criterionNames, tiedCoefficientGames, 4).pending.find(tie => tie.ids.includes(0));
const manualOrder = [...manualPending.ids].reverse();
const beforeManual = structuredClone(manualState);
const manualResult = applyManualTieOrder(manualState, 'qualifying', manualPending.signature, manualOrder);
assert.deepEqual(manualState, beforeManual, 'Choosing an order must not mutate existing data');
assert.deepEqual(manualResult.qualifying, manualState.qualifying, 'Manual choice does not change scores or matches');
assert.deepEqual(manualResult.players, manualState.players);
assert.equal(manualResult.draws.qualifying[manualPending.signature].method, 'manual');
assert.ok(manualResult.draws.qualifying[manualPending.signature].decidedAt);
const manuallyRanked = phaseRanking(criterionNames, tiedCoefficientGames, 4, manualResult.draws.qualifying);
assert.deepEqual(manuallyRanked.rows.filter(row => manualOrder.includes(row.id)).map(row => row.id), manualOrder);
assert.ok(manuallyRanked.rows.filter(row => manualOrder.includes(row.id)).every(row => row.resolution === 'Escolha manual do organizador'));
assert.ok(!manualResult.drawVideos.qualifying[manualPending.signature], 'Manual decisions do not create draw videos');
const manualReloaded = JSON.parse(JSON.stringify(manualResult));
assert.deepEqual(phaseRanking(criterionNames, tiedCoefficientGames, 4, manualReloaded.draws.qualifying), manuallyRanked);
for (const invalid of [[], manualOrder.slice(1), [...manualOrder, 99], manualOrder.map(() => manualOrder[0]), manualOrder.map(String)]) {
  assert.equal(isValidTieOrder(manualPending.ids, invalid), false);
  assert.throws(() => applyManualTieOrder(manualState, 'qualifying', manualPending.signature, invalid));
}
assert.throws(() => applyManualTieOrder(manualState, 'unknown', manualPending.signature, manualOrder));
assert.throws(() => applyManualTieOrder(manualResult, 'qualifying', manualPending.signature, manualOrder), 'Do not silently replace a settled tie');
const correctedManual = structuredClone(manualResult);
correctedManual.qualifying[0][0].s2 = '0';
assert.throws(() => applyManualTieOrder(correctedManual, 'qualifying', manualPending.signature, manualOrder), 'A changed score invalidates the pending form');
assert.ok(phaseRanking(criterionNames, correctedManual.qualifying, 4, correctedManual.draws.qualifying).rows.every(row => row.resolution !== 'Escolha manual do organizador'), 'Stale manual choices do not override updated results');
const incompleteManual = { ...manualState, target: 6 };
assert.throws(() => applyManualTieOrder(incompleteManual, 'qualifying', manualPending.signature, manualOrder));

const allTied = makeExample(20, 4, 'empty');
allTied.qualifying.flat().forEach(game => { game.s1 = '4'; game.s2 = '2'; });
const allTiedRanking = phaseRanking(allTied.players, allTied.qualifying, 4);
assert.equal(allTiedRanking.pending[0].ids.length, 20);
const fullManualOrder = [...allTiedRanking.pending[0].ids].reverse();
const fullManual = applyManualTieOrder(allTied, 'qualifying', allTiedRanking.pending[0].signature, fullManualOrder);
const fullManualRanking = phaseRanking(fullManual.players, fullManual.qualifying, 4, fullManual.draws.qualifying);
assert.ok(fullManualRanking.settled);
assert.deepEqual(createFinals(fullManualRanking).flatMap(group => group.ids), fullManualOrder.slice(0, 16), 'Manual order determines the correct qualifiers and groups');
const finalManualState = { ...fullManual, finals: createFinals(fullManualRanking) };
const manualGroup = finalManualState.finals[0];
manualGroup.schedule.flat().forEach(game => { game.s1 = '4'; game.s2 = '2'; });
manualGroup.schedule[2][0].s1 = '2'; manualGroup.schedule[2][0].s2 = '4';
const finalManualRanking = phaseRanking(finalManualState.players, manualGroup.schedule, 4, {}, manualGroup.ids);
const finalTopTie = finalManualRanking.pending.find(tie => tie.ids.includes(finalManualRanking.rows[0].id));
assert.ok(finalTopTie);
const finalManualOrder = [...finalTopTie.ids].reverse();
const finalManualResult = applyManualTieOrder(finalManualState, manualGroup.id, finalTopTie.signature, finalManualOrder);
assert.equal(groupChampion(phaseRanking(finalManualResult.players, manualGroup.schedule, 4, finalManualResult.draws[manualGroup.id], manualGroup.ids)).id, finalManualOrder[0]);
console.log('Manual tiebreak: validation, score preservation, persistence, qualifiers, group champion and stale-decision protection passed.');
console.log('All six criteria checked: priority, platform coefficient formula, direct confrontation, final draw and stale-draw protection.');
console.log(`Rei do Sol: ${designs} qualifying designs checked (16–256 athletes), zero carry-over, final rotations, ranking, draws, corrections and local save passed.`);

// Only the champion of each final group belongs on the awards screen.
const awardsState = makeExample(20, 4, 'finals');
const awardsQualification = phaseRanking(awardsState.players, awardsState.qualifying, 4, awardsState.draws.qualifying);
assert.ok(finalsFollowQualification(awardsState.finals, awardsQualification));
const switched = structuredClone(awardsState.finals);
[switched[0].ids[0], switched[1].ids[0]] = [switched[1].ids[0], switched[0].ids[0]];
assert.equal(finalsFollowQualification(switched, awardsQualification), false);
const sameMembers = structuredClone(awardsState.finals);
sameMembers[0].ids.reverse();
assert.ok(finalsFollowQualification(sameMembers, awardsQualification), 'Same-group rank changes preserve valid finals');
const rankingsFor = state => state.finals.map(group => ({ group, ranking: phaseRanking(state.players, group.schedule, state.target, state.draws[group.id], group.ids) }));
const waiting = rankingsFor(awardsState);
waiting.forEach(({ ranking }) => { assert.equal(groupChampion(ranking), null); assert.ok(ranking.rows.every(row => row.coefficient === 0), 'Final coefficient starts from zero'); });
awardsState.finals.forEach(group => group.schedule.flat().forEach(game => { game.s1 = '4'; game.s2 = '2'; }));
const awards = rankingsFor(awardsState);
awards.forEach(({ group, ranking }) => {
  assert.equal(ranking.settled, false, 'Lower positions remain tied');
  assert.equal(groupChampion(ranking).id, group.ids[0], 'A unique leader is champion despite lower ties');
});
const tiedState = structuredClone(awardsState);
tiedState.finals[0].schedule[2][0].s1 = '2';
tiedState.finals[0].schedule[2][0].s2 = '4';
const tiedAwards = rankingsFor(tiedState);
assert.equal(groupChampion(tiedAwards[0].ranking), null, 'Do not award an unresolved first-place tie');
const reopenedState = structuredClone(awardsState);
reopenedState.finals[0].schedule[0][0].s1 = '';
assert.equal(groupChampion(rankingsFor(reopenedState)[0].ranking), null, 'Reopened game removes the champion');

const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: ManualTie } = await server.ssrLoadModule('/scripts/ReiDoSolManualTie.jsx');
  const manualForm = renderToStaticMarkup(React.createElement(ManualTie, { tie: manualPending, players: criterionNames }));
  assert.ok(manualForm.includes('Escolha manual do organizador'));
  assert.equal((manualForm.match(/<select/g) || []).length, manualPending.ids.length);
  assert.ok(manualForm.includes('Salvar escolha manual'));
  assert.match(manualForm, /type="submit"[^>]*disabled/);
  const { default: ReiDoSolRankingTable } = await server.ssrLoadModule('/scripts/ReiDoSolRankingTable.jsx');
  const coefficientTable = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Classificatória', ranking: coefficientFirst }));
  assert.ok(coefficientTable.includes('Critérios de classificação:'));
  assert.ok(coefficientTable.includes(CRITERIA));
  assert.ok(!coefficientTable.includes('Desempate: Coeficiente'));
  assert.ok(coefficientTable.includes('0.786'));
  assert.ok(coefficientTable.includes('0.733'));
  for (const { label } of RANKING_COLUMNS) assert.ok(coefficientTable.includes(`>${label}</th>`));
  const directTable = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Teste', ranking: directFirst }));
  assert.ok(!directTable.includes('Desempate: Confronto direto'));
  const drawTable = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Teste', ranking: finalDraw }));
  assert.ok(!drawTable.includes('Desempate: Sorteio'));
  const cutoffTable = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Classificatória', ranking: awardsQualification, qualifying: true,
    destinationFor: row => GROUPS[Math.floor(awardsQualification.rows.findIndex(item => item.id === row.id) / 4)]?.name || null,
  }));
  const cutoffRows = [...cutoffTable.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(match => match[1]);
  assert.equal(cutoffRows.length, 20);
  assert.equal(cutoffRows.filter(row => row.includes('data-qualification-cutoff="true"')).length, 1);
  assert.ok(cutoffRows[15].includes('data-qualification-cutoff="true"'), 'Mark the 16th ranked athlete, not athlete ID 16');
  assert.ok(!cutoffRows[16].includes('data-qualification-cutoff'));
  assert.equal((cutoffTable.match(/class="rds-rank-group"/g) || []).length, 16);
  assert.ok(cutoffRows.slice(0, 16).every(row => row.includes('rds-rank-group')));
  assert.ok(cutoffRows.slice(16).every(row => !row.includes('rds-rank-group')));
  assert.doesNotMatch(cutoffTable, /Desempate:|Não classificado|Posição pendente de sorteio/);
  assert.ok(cutoffRows.slice(0, 16).every(row => row.includes('>Classificado</small>') && !row.includes('>Desclassificado</small>')));
  assert.ok(cutoffRows.slice(16).every(row => row.includes('>Desclassificado</small>') && !row.includes('>Classificado</small>')));
  const withoutEliminations = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: '16 atletas', ranking: { ...awardsQualification, rows: awardsQualification.rows.slice(0, 16) }, qualifying: true }));
  assert.ok(!withoutEliminations.includes('data-qualification-cutoff'));
  const notQualifying = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Outra fase', ranking: awardsQualification }));
  assert.ok(!notQualifying.includes('data-qualification-cutoff'));
  assert.ok(!notQualifying.includes('rds-rank-status'));
  const provisionalTable = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Provisória', ranking: { ...awardsQualification, complete: false, settled: false }, qualifying: true }));
  assert.ok(!provisionalTable.includes('rds-rank-status'), 'Do not declare qualification before the standings are decided');
  const cutoffPending = { ...awardsQualification, settled: false, pending: [{ ids: [awardsQualification.rows[15].id, awardsQualification.rows[16].id] }] };
  const cutoffPendingHtml = renderToStaticMarkup(React.createElement(ReiDoSolRankingTable, { title: 'Corte empatado', ranking: cutoffPending, qualifying: true }));
  const cutoffPendingRows = [...cutoffPendingHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(match => match[1]);
  assert.ok(!cutoffPendingRows[15].includes('rds-rank-status') && !cutoffPendingRows[16].includes('rds-rank-status'), 'A 16/17 tie cannot decide who advances');
  assert.ok(cutoffPendingRows[0].includes('>Classificado</small>') && cutoffPendingRows[19].includes('>Desclassificado</small>'), 'Unrelated pending draws do not hide guaranteed status');
  const { default: Participants } = await server.ssrLoadModule('/scripts/ReiDoSolParticipants.jsx');
  const { default: ImportModal } = await server.ssrLoadModule('/src/features/participantManagement/ParticipantManagement.jsx');
  const config = { 'Rei do Sol': { type: 'reiDoSol', total: awardsState.players.length, label: 'Atleta' } };
  const participantHtml = renderToStaticMarkup(React.createElement(Participants, { data: awardsState, config }));
  for (const label of ['Colar lista', 'Sortear nomes', 'Criar rodadas e jogos', 'Confirmar todos', 'Ausentar todos']) assert.ok(participantHtml.includes(label));
  assert.ok(participantHtml.includes('participantImportBar'));
  assert.ok(participantHtml.includes('actionShuffleBtn'));
  assert.ok(participantHtml.includes('actionGenerateBtn'));
  const { default: Schedule, UniversalMatchCard } = await server.ssrLoadModule('/src/features/matchOperations/MatchSchedule.jsx');
  const absentState = { ...awardsState, participantAttendance: awardsState.players.map(() => false) };
  const attendanceSchedule = renderToStaticMarkup(React.createElement(Schedule, { schedule: withNames(absentState.qualifying, absentState.players), statusData: absentState, courtNumbers: ['1', '2', '3', '4'] }));
  assert.equal((attendanceSchedule.match(/class="matchAttendancePending"/g) || []).length, awardsState.players.length * 4, 'Every absent athlete has an X in each of their four games');
  const confirmedSchedule = renderToStaticMarkup(React.createElement(Schedule, { schedule: withNames(awardsState.qualifying, awardsState.players), statusData: awardsState }));
  assert.ok(!confirmedSchedule.includes('class="matchAttendancePending"'));
  const finalAttendance = renderToStaticMarkup(React.createElement(UniversalMatchCard, { game: withNames(absentState.finals[0].schedule, absentState.players)[0][0], attendanceData: absentState }));
  assert.equal((finalAttendance.match(/class="matchAttendancePending"/g) || []).length, 4, 'Final games use the same attendance marker');
  const importHtml = renderToStaticMarkup(React.createElement(ImportModal, { type: 'Rei do Sol', data: awardsState, modalityConfig: config }));
  assert.ok(importHtml.includes('<textarea'));
  assert.ok(importHtml.includes('Um participante por linha'));
  assert.ok(importHtml.includes('Substituir todos os participantes'));

  for (const count of [16, 17, 19, 20, 32]) {
    const before = makeExample(count, 4, 'finished');
    before.participantAttendance = before.players.map((_, index) => index % 2 === 0);
    const snapshot = structuredClone(before);
    const renamed = before.players.map((_, index) => `Participante Nome ${index + 1}`);
    const imported = importParticipantNames(before, renamed);
    assert.deepEqual(imported.players, renamed);
    assert.deepEqual(imported.qualifying, before.qualifying, 'Import does not silently recreate games');
    const shuffled = shuffleParticipants(before, seededRandom(count));
    assert.deepEqual(before, snapshot, 'Do not mutate current data before confirmation');
    assert.deepEqual([...shuffled.players].sort(), [...before.players].sort());
    assert.notDeepEqual(shuffled.players, before.players);
    shuffled.players.forEach((name, index) => assert.equal(shuffled.participantAttendance[index], before.participantAttendance[before.players.indexOf(name)]));
    assert.equal(shuffled.namesShuffled, true);
    assert.deepEqual([shuffled.qualifying, shuffled.finals, shuffled.draws], [[], [], {}]);
    const generated = generateQualifying(shuffled);
    assert.deepEqual(generated.players, shuffled.players, 'Generate must preserve the drawn participant order');
    assert.deepEqual(generated.participantAttendance, shuffled.participantAttendance);
    assert.equal(generated.qualifying.flat().length, count);
    assert.ok(generated.qualifying.flat().every(game => game.s1 === '' && game.s2 === ''));
    const occurrences = Array.from({ length: count }, () => 0);
    generated.qualifying.flat().forEach(game => [...game.ids1, ...game.ids2].forEach(id => occurrences[id]++));
    assert.ok(occurrences.every(total => total === 4));
    assert.deepEqual(generateQualifying(shuffled).qualifying, generated.qualifying, 'No second random draw during generation');
    const withEmptyName = { ...before, players: before.players.map((name, index) => index === 0 ? '' : name) };
    assert.throws(() => generateQualifying(withEmptyName));
  }
  console.log('Participant workflow: existing paste importer, independent shuffle/generation, attendance preservation and clean match creation passed.');
  const { default: Champions } = await server.ssrLoadModule('/scripts/ReiDoSolChampions.jsx');
  const html = renderToStaticMarkup(React.createElement(Champions, { finalRankings: awards }));
  assert.equal((html.match(/class="cupPodiumItem /g) || []).length, 4, 'Exactly four awarded athletes');
  assert.doesNotMatch(html, /cupPodiumPlace[23]|<table|3º lugar|Vice/);
  GROUPS.forEach(group => assert.ok(html.includes(`Campeão ${group.name}`)));
  const winners = awards.map(({ ranking }) => groupChampion(ranking).name);
  winners.forEach(name => assert.ok(html.includes(name)));
  awardsState.players.filter(name => !winners.includes(name)).forEach(name => assert.ok(!html.includes(name), `Non-champion ${name} must not appear`));
  const pendingHtml = renderToStaticMarkup(React.createElement(Champions, { finalRankings: waiting }));
  assert.equal((pendingHtml.match(/rds-champion-pending/g) || []).length, 4);
  assert.doesNotMatch(pendingHtml, /cupPodiumItem/);
  const absentHtml = renderToStaticMarkup(React.createElement(Champions, { finalRankings: [] }));
  assert.equal((absentHtml.match(/rds-champion-pending/g) || []).length, 4);
  const topTies = [];
  renderToStaticMarkup(React.createElement(Champions, { finalRankings: tiedAwards, renderTiePanel: (scope, ranking) => { topTies.push({ scope, ranking }); return null; } }));
  assert.equal(topTies.length, 1);
  assert.equal(topTies[0].scope, 'ouro');
  assert.ok(topTies[0].ranking.pending.every(tie => tie.ids.includes(topTies[0].ranking.rows[0].id)));
  console.log('Champion-only ranking: four single-winner podiums, no runners-up, waiting states and first-place ties passed.');
} finally { await server.close(); }
