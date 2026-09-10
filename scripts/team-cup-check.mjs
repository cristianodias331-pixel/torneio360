import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createInitialData, normalizeTournamentData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createCearenseGroups } from "../src/domain/cupGroups.mjs";
import { getScoreWinnerSide } from "../src/domain/scoreRules.mjs";
import { getGameWinnerId } from "../src/domain/bracketProgression.mjs";
import { buildCearenseEliminationRounds, avoidSameGroupOpeningMatches } from "../src/domain/bracketConstruction.mjs";
import { getBracketSeedOrder, getNextPowerOfTwo } from "../src/domain/bracketBasics.mjs";
import { getMatchElapsedSeconds } from "../src/domain/matchTimer.mjs";
import { getTournamentCompletionState } from "../src/domain/tournamentLifecycle.mjs";
import { createTournamentOperations } from "../src/domain/tournamentOperations.mjs";
import { inspectTournamentScoreRegression } from "../src/domain/tournamentScoreSafety.mjs";
import { mergeConcurrentTournamentData, preservesTournamentCriticalData } from "../src/offlineDataStore.mjs";
import * as cup from "../src/domain/teamCup.mjs";

export function fixture(count = 6, kind = "trio") {
  const data = cup.createTeamCupData({ winningScore: 6, courtNumbers: ["1", "2", "3", "4", "5", "6"] }, count, kind);
  data.players.teams.forEach((team, t) => team.athletes.forEach((a, i) => { a.name = "Atleta " + (t + 1) + "-" + (i + 1); a.level = cup.TEAM_LEVELS[(t + i) % 6]; }));
  return data;
}
function seed(value = 1) { return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
function finish(data, key, scores = [[6, 2], [6, 3]]) {
  for (const [i, pair] of scores.entries()) data = cup.updateTeamCupLeg(data, key, i, { s1: String(pair[0]), s2: String(pair[1]) });
  return data;
}
export function finishGroups(data) {
  for (const game of data.schedule.flat()) {
    const lowerWins = game.ids1[0] < game.ids2[0];
    data = finish(data, game.matchKey, lowerWins ? [[6, 2], [6, 3]] : [[2, 6], [3, 6]]);
  }
  for (const group of cup.teamCupRankings(data)) if (group.unresolvedTieIds.length) data.cupConfig.tieBreakOverrides[group.id] = group.unresolvedTieIds;
  for (const tie of cup.teamCupQualified(data).unresolvedCampaignTies) data.cupConfig.campaignTieBreakOverrides[tie.tieKey] = tie.teamIds;
  return data;
}
function checkConsolationByes() {
  const opening = entries => buildCearenseEliminationRounds(entries, "repechage", "Consolation", false, { preserveByes: true })[0].games;
  const byeIds = games => games.filter(g => g.isBye).flatMap(g => [...g.ids1, ...g.ids2]);
  const five = [1, 2, 3, 0, 0].map((groupId, id) => ({ id, groupId, groupPosition: id === 4 ? 4 : 3 }));
  const fixedFive = opening(five);
  assert.deepEqual(byeIds(fixedFive).sort((a, b) => a - b), [0, 1, 2], "The best three campaigns keep their BYEs, even when seeds four and five share a group");
  assert.deepEqual(fixedFive.filter(g => !g.isBye).map(g => [...g.ids1, ...g.ids2]), [[3, 4]], "An unavoidable same-group game is allowed without stealing a BYE");

  const six = [9, 8, 0, 1, 1, 2].map((groupId, id) => ({ id, groupId, groupPosition: id === 4 ? 4 : 3 }));
  const fixedSix = opening(six);
  assert.deepEqual(byeIds(fixedSix).sort((a, b) => a - b), [0, 1]);
  assert(fixedSix.filter(g => !g.isBye).every(g => six[g.ids1[0]].groupId !== six[g.ids2[0]].groupId), "Playing teams are still rearranged to avoid same-group opponents when possible");

  for (const count of cup.TEAM_COUNTS) for (let iteration = 1; iteration <= 24; iteration++) {
    const eligible = createCearenseGroups(count).flatMap(group => group.teamIds.slice(2).map((id, index) => ({ id, groupId: group.id, groupPosition: index + 3 })));
    const ranked = cup.shuffleTeamCup(eligible, seed(count * 100 + iteration));
    const expectedByes = ranked.slice(0, getNextPowerOfTwo(ranked.length) - ranked.length).map(e => e.id).sort((a, b) => a - b);
    const original = JSON.stringify(ranked);
    const slots = getBracketSeedOrder(getNextPowerOfTwo(ranked.length)).map(n => ranked[n - 1] || null);
    const adjusted = avoidSameGroupOpeningMatches(slots, { preserveByes: true });
    for (let index = 0; index < slots.length; index += 2) {
      if (!slots[index] || !slots[index + 1]) assert.deepEqual(adjusted.slice(index, index + 2), slots.slice(index, index + 2), "BYE slots and recipients remain fixed");
    }
    const games = opening(ranked);
    assert.deepEqual(byeIds(games).sort((a, b) => a - b), expectedByes, `Campaign BYEs preserved for ${count} teams, permutation ${iteration}`);
    assert.deepEqual(games.flatMap(g => [...g.ids1, ...g.ids2]).sort((a, b) => a - b), ranked.map(e => e.id).sort((a, b) => a - b), "Every eligible team appears exactly once");
    const playing = games.filter(g => !g.isBye);
    const byId = new Map(ranked.map(e => [e.id, e]));
    if (playing.length > 1) assert(playing.every(g => byId.get(g.ids1[0]).groupId !== byId.get(g.ids2[0]).groupId), "With another playable pair, same-group opening games are avoided");
    assert.equal(JSON.stringify(ranked), original, "Bracket construction does not mutate campaign entries");
  }

  for (const kind of ["trio", "squad"]) {
    let data = cup.generateTeamCupGroups(fixture(13, kind), seed());
    for (const game of data.schedule.flat()) {
      const [a, b] = [game.ids1[0], game.ids2[0]].sort((x, y) => x - y);
      const winner = game.groupId === 0 ? a : b - a === 2 ? b : a;
      const pair = game.ids1[0] === winner ? [6, 2] : [2, 6];
      data = finish(data, game.matchKey, [pair, pair]);
    }
    for (const group of cup.teamCupRankings(data)) if (group.unresolvedTieIds.length) data.cupConfig.tieBreakOverrides[group.id] = group.unresolvedTieIds;
    for (const tie of cup.teamCupQualified(data).unresolvedCampaignTies) data.cupConfig.campaignTieBreakOverrides[tie.tieKey] = tie.teamIds;
    const qualified = cup.teamCupQualified(data);
    assert.deepEqual(qualified.repechage.slice(3).map(e => e.groupId), [0, 0], "Reproduce the five-team Consolation case from real group results");
    const expectedByes = qualified.repechage.slice(0, 3).map(e => e.id).sort((a, b) => a - b);
    const original = JSON.stringify(data);
    const generated = cup.generateTeamCupBrackets(data);
    assert.deepEqual(byeIds(generated.brackets.filter(g => g.phase === "repechage")).sort((a, b) => a - b), expectedByes);
    assert.equal(JSON.stringify(data), original, "Generating the fixed bracket preserves all group results");
    const mainOnly = { ...generated, brackets: generated.brackets.filter(g => g.phase === "main") };
    const repaired = cup.setTeamCupConsolationEnabled(mainOnly, true);
    assert.deepEqual(repaired.brackets.filter(g => g.phase === "main"), mainOnly.brackets, "Adding a missing Consolation never rewrites the main bracket");
    assert.deepEqual(byeIds(repaired.brackets.filter(g => g.phase === "repechage")).sort((a, b) => a - b), expectedByes, "Missing Consolation repair uses the same BYE protection");
    const stored = structuredClone(repaired.brackets);
    assert.deepEqual(cup.setTeamCupConsolationEnabled(repaired, false).brackets, stored, "Toggling visibility does not redistribute existing BYEs or games");
  }
  console.log("Consolation: BYEs preservados em 672 distribuições, sem duplicações e com ajustes de confronto somente entre equipes sem BYE.");
}
export function runTeamCupChecks() {
  checkConsolationByes();
  const initial = createInitialData(cup.TEAM_CUP_TYPE, modalityConfig[cup.TEAM_CUP_TYPE]);
  assert.equal(initial.players.teams.length, 6);
  assert.equal(initial.players.teams[0].athletes.length, 3);
  assert.equal(cup.defaultTeamName(26), "Time 27");
  assert.deepEqual(normalizeTournamentData(cup.TEAM_CUP_TYPE, initial).players, initial.players);
  assert.equal(cup.teamSize(fixture(6, "squad")), 4);
  for (const kind of ["trio", "squad"]) for (const count of cup.TEAM_COUNTS) {
    let d = fixture(count, kind);
    d.teamCup.pool = structuredClone(d.players.teams.flatMap(t => t.athletes));
    d.teamCup.balanced = true;
    const captains = cup.drawTeamCaptains(d, seed(count));
    assert(captains.players.teams.every(t => t.athletes.length === 1));
    assert(preservesTournamentCriticalData(captains, normalizeTournamentData(cup.TEAM_CUP_TYPE, captains)));
    d = cup.drawTeamMembers(captains, seed(99));
    assert(cup.validateTeamCupTeams(d));
    assert.deepEqual(d.players.teams.map(t => t.captainId), captains.players.teams.map(t => t.captainId));
    assert.equal(new Set(d.players.teams.flatMap(t => t.athletes.map(a => a.id))).size, count * cup.teamSize(d));
    assert(createCearenseGroups(count).every(g => [3, 4].includes(g.teamIds.length)));
    d = cup.generateTeamCupGroups(d, seed(count));
    d.cupConfig.repechageEnabled = true;
    const groupCount = createCearenseGroups(count).length;
    assert.equal(d.schedule.flat().length, createCearenseGroups(count).reduce((sum, g) => sum + g.teamIds.length * (g.teamIds.length - 1) / 2, 0));
    assert.throws(() => cup.generateTeamCupGroups(d));
    d = finishGroups(d);
    const qualified = cup.teamCupQualified(d);
    assert.equal(qualified.main.length, groupCount * 2);
    assert.equal(qualified.repechage.length, count - groupCount * 2);
    d = cup.generateTeamCupBrackets(d);
    const mainIds = new Set(qualified.main.map(r => r.id));
    const consolationIds = new Set(qualified.repechage.map(r => r.id));
    assert(d.brackets.filter(g => g.phase === "repechage").every(g => !String(g.source1 || "").startsWith("main_") && !String(g.source2 || "").startsWith("main_")));
    for (const stored of d.brackets) {
      const resolved = cup.resolveTeamCupGame(d, stored);
      const allowed = stored.phase === "main" ? mainIds : consolationIds;
      assert([...resolved.ids1, ...resolved.ids2].every(id => allowed.has(id)));
      if (!stored.isBye) {
        assert(resolved.ids1.length && resolved.ids2.length, "Both sides must resolve before playing the round: " + stored.matchKey);
        d = finish(d, stored.matchKey);
      }
    }
    assert(d.brackets.filter(g => g.roundName === "Final").every(g => getGameWinnerId(cup.resolveTeamCupGame(d, g), d) !== null));
    assert(getTournamentCompletionState({ type: cup.TEAM_CUP_TYPE, data: d }).completed);
    assert(preservesTournamentCriticalData(d, normalizeTournamentData(cup.TEAM_CUP_TYPE, d)));
    assert(cup.validateTeamCupMatchState(d));
  }
  let d = fixture();
  d.teamCup.pool = d.players.teams.flatMap(t => t.athletes);
  d.teamCup.designatedCaptains = true;
  assert.throws(() => cup.drawTeamCaptains(d), /exatamente/);
  d.teamCup.pool.forEach((a, i) => a.captainCandidate = i % 3 === 0);
  const expected = new Set(d.teamCup.pool.filter(a => a.captainCandidate).map(a => a.id));
  d = cup.drawTeamCaptains(d, seed());
  assert(d.players.teams.every(t => expected.has(t.captainId)));
  assert.throws(() => cup.drawTeamMembers(fixture()), /primeiro/);
  const bad = fixture(6, "squad"); bad.players.teams[0].athletes[3].gender = "H";
  assert.throws(() => cup.validateTeamCupTeams(bad), /2 atletas do masculino/);
  const duplicate = fixture(); duplicate.players.teams[0].athletes[1].name = duplicate.players.teams[0].athletes[0].name;
  assert.throws(() => cup.validateTeamCupTeams(duplicate), /repetidos/);
  d = cup.generateTeamCupGroups(fixture(), seed());
  const key = d.schedule[0][0].matchKey;
  assert.throws(() => cup.updateTeamCupLeg(d, key, 1, { s1: "6", s2: "0" }), /set ainda não está liberado/);
  const defaultStarted = cup.updateTeamCupLeg(d, key, 0, { inProgress: true }, 1000000);
  assert.equal(defaultStarted.schedule[0][0].teamCupLegs[0].courtNumberOverride, "1");
  assert.equal(getMatchElapsedSeconds(defaultStarted.schedule[0][0].teamCupLegs[0], 1006000), 6);
  const paused = cup.updateTeamCupLeg(defaultStarted, key, 0, { inProgress: false }, 1006000);
  assert.equal(getMatchElapsedSeconds(paused.schedule[0][0].teamCupLegs[0], 1040000), 6);
  const resumed = cup.updateTeamCupLeg(paused, key, 0, { inProgress: true }, 1040000);
  assert.equal(getMatchElapsedSeconds(resumed.schedule[0][0].teamCupLegs[0], 1044000), 10);
  const hydrated = normalizeTournamentData(cup.TEAM_CUP_TYPE, JSON.parse(JSON.stringify(resumed)));
  assert.equal(getMatchElapsedSeconds(hydrated.schedule[0][0].teamCupLegs[0], 1044000), 10);
  const otherGroup = d.schedule[0][1];
  assert.equal(cup.teamCupCourtNumber(d, otherGroup, 0), "2");
  assert.equal(cup.teamCupCourtNumber(d, { ...otherGroup, teamCupLegs: [{ court: 1, courtNumberOverride: "" }] }, 0), "2", "Old blank legs use their parent game's court");
  assert.equal(cup.teamCupCourtNumber(d, otherGroup, 0, ["8", "9"]), "9");
  assert.equal(cup.teamCupCourtNumber(d, { ...otherGroup, teamCupLegs: [{ courtNumberOverride: "12" }] }, 0), "12", "Manual court is preserved");
  assert.throws(() => cup.updateTeamCupLeg(defaultStarted, d.schedule[1][0].matchKey, 0, { inProgress: true }), /em uso/);
  const started = cup.updateTeamCupLeg(d, key, 0, { courtNumberOverride: "1", inProgress: true }, 1000000);
  const ops = createTournamentOperations();
  assert.equal(ops.getTournamentActiveCourtUsages({ id: "test" }, started).length, 1);
  assert(ops.getNextMatchTimerExpiryDelay(started, 1005000) > 0);
  const timerDone = finish(started, key);
  assert.equal(ops.getTournamentActiveCourtUsages({ id: "test" }, timerDone).length, 0);
  assert(timerDone.schedule[0][0].teamCupLegs[0].matchTimerFinishedAt);
  let split = finish(d, key, [[6, 2], [1, 6]]);
  assert(cup.teamMatchState(split.schedule[0][0], 6).decider);
  assert.equal(getScoreWinnerSide(split.schedule[0][0], 6), null);
  const won = finish(split, key, [[6, 2], [1, 6], [6, 4]]);
  assert.equal(getScoreWinnerSide(won.schedule[0][0], 6), "team1");
  assert.equal(won.schedule[0][0].s1, "13");
  assert.equal(won.schedule[0][0].s2, "12");
  assert.throws(() => cup.updateTeamCupLeg(won, key, 1, { s1: "6", s2: "0" }), /invalidaria/);
  const rows = cup.teamCupRankings(won).flatMap(g => g.rows);
  assert.equal(rows.reduce((n, r) => n + r.w, 0), 1);
  assert.equal(rows.reduce((n, r) => n + r.bal, 0), 0);
  assert.equal(rows.reduce((n, r) => n + r.setBalance, 0), 0);
  const winnerRow = rows.find(r => r.id === won.schedule[0][0].ids1[0]);
  assert.equal(winnerRow.setsWon, 2);
  assert.equal(winnerRow.setsLost, 1);
  assert.equal(winnerRow.setBalance, 1);
  assert.equal(winnerRow.coefficient, 13 / 25);
  assert(cup.teamCupRankings(split).flatMap(g => g.rows).every(r => r.played === 0 && r.setBalance === 0 && r.coefficient === 0), "Unfinished deciding sets do not enter ranking metrics");
  const straightRows = cup.teamCupRankings(finish(d, key)).flatMap(g => g.rows);
  assert.equal(straightRows.find(r => r.id === winnerRow.id).setBalance, 2);
  assert.equal(straightRows.find(r => r.id === won.schedule[0][0].ids2[0]).setBalance, -2);
  const negativeBalanceWin = finish(d, key, [[6, 4], [0, 6], [6, 4]]);
  const negativeWinner = cup.teamCupRankings(negativeBalanceWin).flatMap(g => g.rows).find(r => r.id === winnerRow.id);
  assert.equal(negativeWinner.w, 1, "Winning two sets counts as a victory even with fewer games");
  assert.equal(negativeWinner.bal, -2);
  assert.equal(negativeWinner.setBalance, 1);
  assert.throws(() => cup.updateTeamCupLeg(finish(d, key), key, 2, { s1: "6" }), /set ainda não está liberado/);
  const lostLegs = structuredClone(won); lostLegs.schedule[0][0].teamCupLegs[2].s1 = "";
  assert(inspectTournamentScoreRegression(won, lostLegs).unsafe);
  assert(!preservesTournamentCriticalData(won, lostLegs));
  const lostMember = structuredClone(won); lostMember.players.teams[0].athletes.pop();
  assert(!preservesTournamentCriticalData(won, lostMember));
  let squad = cup.generateTeamCupGroups(fixture(6, "squad"), seed());
  const sk = squad.schedule[0][0].matchKey;
  const local = cup.updateTeamCupLeg(squad, sk, 0, { s1: "6", s2: "2" });
  const remote = cup.updateTeamCupLeg(squad, sk, 1, { s1: "6", s2: "3" });
  const merged = mergeConcurrentTournamentData(squad, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.data.schedule[0][0].s1, "12");
  assert.equal(getScoreWinnerSide(merged.data.schedule[0][0], 6), "team1");
  squad = cup.updateTeamCupLeg(squad, sk, 0, { courtNumberOverride: "1", inProgress: true });
  assert.throws(() => cup.updateTeamCupLeg(squad, sk, 1, { courtNumberOverride: "1", inProgress: true }), /em uso/);
  squad = cup.updateTeamCupLeg(squad, sk, 1, { courtNumberOverride: "2", inProgress: true });
  assert.equal(ops.getTournamentActiveCourtUsages({ id: "test" }, squad).length, 2);
  const metricRows = [{ id: 0, name: "A", w: 2, setBalance: 2, coefficient: 0.6, bal: 4, pts: 20 }, { id: 1, name: "B", w: 2, setBalance: 2, coefficient: 0.6, bal: 4, pts: 24 }];
  assert.equal(cup.rankTeamCupRows(metricRows, [], 6).rows[0].id, 0, "Total games is only a statistic, never a tie-break");
  const directGame = cup.makeTeamMatch({ matchKey: "direct", ids1: [0], ids2: [1] });
  directGame.teamCupLegs[0] = { s1: "6", s2: "0" };
  directGame.teamCupLegs[1] = { s1: "6", s2: "0" };
  const strongerLoser = metricRows.map(row => ({ ...row, coefficient: row.id ? 0.9 : 0.5, bal: row.id ? 20 : 0 }));
  assert.equal(cup.rankTeamCupRows(strongerLoser, [directGame], 6, [1, 0]).rows[0].id, 0, "Head-to-head precedes coefficient, games balance and an old draw order");
  const setPriority = metricRows.map(row => ({ ...row, setBalance: row.id ? 3 : 2 }));
  assert.equal(cup.rankTeamCupRows(setPriority, [directGame], 6).rows[0].id, 1, "Sets balance precedes head-to-head");
  const winPriority = setPriority.map(row => ({ ...row, w: row.id ? 1 : 2 }));
  assert.equal(cup.rankTeamCupRows(winPriority, [directGame], 6).rows[0].id, 0, "Match wins precede sets balance");
  const threeRows = [0, 1, 2].map(id => ({ id, name: String(id), w: 1, setBalance: 0, coefficient: 0.5, bal: 0, pts: 12 + id }));
  const cycleGames = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({ ...directGame, ids1: [a], ids2: [b] }));
  const coefficientPriority = threeRows.map((row, i) => ({ ...row, coefficient: [0.75, 16 / 22, 0.4][i], bal: [8, 10, 0][i] }));
  assert.deepEqual(cup.rankTeamCupRows(coefficientPriority, cycleGames, 6, [2, 1, 0]).rows.map(r => r.id), [0, 1, 2], "Circular head-to-head uses coefficient before games balance");
  const gamesPriority = threeRows.map((row, i) => ({ ...row, coefficient: i === 2 ? 0.4 : 0.5, bal: [5, 10, 0][i] }));
  assert.deepEqual(cup.rankTeamCupRows(gamesPriority, cycleGames, 6).rows.map(r => r.id), [1, 0, 2], "Games balance resolves a coefficient tie");
  assert.equal(cup.rankTeamCupRows(threeRows, cycleGames, 6).unresolvedTieIds.length, 3, "An exact tie requires a draw, not total games or alphabetical qualification");
  assert.deepEqual(cup.rankTeamCupRows(threeRows, cycleGames, 6, [2, 0, 1]).rows.map(r => r.id), [2, 0, 1]);
  assert.deepEqual(cup.rankTeamCupRows(threeRows, cycleGames.slice(0, 2), 6).unresolvedTieIds, [], "Incomplete groups do not request a final draw");
  const roundingTie = threeRows.map((row, i) => ({ ...row, coefficient: 0.5 + i * 1e-16, bal: i }));
  assert.equal(cup.rankTeamCupRows(roundingTie, cycleGames, 6).rows[0].id, 2, "Floating point noise does not decide coefficient ties");

  let averages = cup.generateTeamCupGroups(fixture(), seed());
  const teamGames = averages.schedule.flat().filter(g => [...g.ids1, ...g.ids2].includes(0));
  for (const [index, game] of teamGames.entries()) {
    const pairs = index === 0 ? [[6, 4], [6, 4]] : [[6, 0], [4, 6], [6, 0]];
    averages = finish(averages, game.matchKey, game.ids1[0] === 0 ? pairs : pairs.map(([a, b]) => [b, a]));
  }
  const originalAverages = JSON.stringify(averages);
  const averageRow = cup.teamCupRankings(averages).flatMap(g => g.rows).find(r => r.id === 0);
  assert(Math.abs(averageRow.coefficient - (12 / 20 + 16 / 22) / 2) < 1e-12, "Coefficient is an equal-weight mean per completed match, not an aggregate of all games");
  assert.equal(averageRow.setBalance, 3);
  assert.equal(averageRow.pts, 28);
  assert.equal(averageRow.played, 2);
  assert.equal(JSON.stringify(averages), originalAverages, "Reading rankings does not mutate scores");

  let circularGroup = cup.generateTeamCupGroups(fixture(), seed());
  for (const game of circularGroup.schedule.flat().filter(g => g.groupId === 0)) {
    const ids = [...game.ids1, ...game.ids2];
    const [winner, loserGames] = !ids.includes(2) ? [0, 0] : !ids.includes(0) ? [1, 4] : [2, 2];
    const pair = game.ids1[0] === winner ? [6, loserGames] : [loserGames, 6];
    circularGroup = finish(circularGroup, game.matchKey, [pair, pair]);
  }
  const circularRows = cup.teamCupRankings(circularGroup).find(g => g.id === 0).rows;
  assert.deepEqual(circularRows.map(r => r.id), [0, 2, 1], "A real three-team circular tie is resolved by coefficient, not total games");
  assert(circularRows.every(r => r.w === 1 && r.setBalance === 0));
  assert.equal(circularRows[0].coefficient, 0.625);
  assert.equal(circularRows[1].pts, 20);
  assert.equal(circularRows[0].pts, 16);

  const campaigns = [
    { id: 0, name: "A", groupId: 0, groupPosition: 1, played: 2, w: 2, setBalance: 4, coefficient: 0.6, bal: 8, pts: 24 },
    { id: 1, name: "B", groupId: 1, groupPosition: 1, played: 3, w: 3, setBalance: 6, coefficient: 0.6, bal: 12, pts: 44 },
  ];
  const campaignTie = cup.rankTeamCupCampaignEntries(campaigns);
  assert.equal(campaignTie.unresolvedTies.length, 1, "Proportional campaigns tie across groups of three and four, regardless of total games");
  assert.deepEqual(cup.rankTeamCupCampaignEntries(campaigns, { [campaignTie.unresolvedTies[0].tieKey]: [1, 0] }).rows.map(r => r.id), [1, 0]);
  assert.equal(cup.rankTeamCupCampaignEntries(campaigns.map((row, i) => ({ ...row, w: 2, setBalance: i ? 9 : 4 }))).rows[0].id, 0, "Campaign win percentage comes first");
  assert.equal(cup.rankTeamCupCampaignEntries(campaigns.map((row, i) => ({ ...row, setBalance: i ? 3 : 4, coefficient: i ? 0.9 : 0.5 }))).rows[0].id, 0, "Campaign sets balance is normalized and precedes coefficient");
  assert.equal(cup.rankTeamCupCampaignEntries(campaigns.map((row, i) => ({ ...row, coefficient: i ? 0.5 : 0.6, bal: i ? 90 : 8 }))).rows[0].id, 0, "Campaign coefficient precedes games balance");
  assert.equal(cup.rankTeamCupCampaignEntries(campaigns.map((row, i) => ({ ...row, bal: i ? 11 : 8 }))).rows[0].id, 0, "Campaign games balance is also normalized");
  assert.deepEqual(cup.rankTeamCupCampaignEntries(campaigns.map((row, i) => ({ ...row, groupId: 0, groupPosition: i ? 3 : 4 }))).rows.map(r => r.id), [1, 0], "Equal campaigns from the same group preserve group placement");
  const baseGroups = finishGroups(cup.generateTeamCupGroups(fixture(), seed()));
  const generated = cup.generateTeamCupBrackets(baseGroups);
  const changedGroups = cup.updateTeamCupLeg(baseGroups, baseGroups.schedule[0][0].matchKey, 0, { s2: "1" });
  assert(mergeConcurrentTournamentData(baseGroups, changedGroups, generated).conflicts.length > 0);
  let knockout = cup.generateTeamCupBrackets(finishGroups(cup.generateTeamCupGroups(fixture(), seed())));
  assert.throws(() => cup.updateTeamCupLeg(knockout, knockout.schedule[0][0].matchKey, 0, { s1: "0" }), /protegidos/);
  assert.equal(knockout.cupConfig.repechageEnabled, false);
  assert(knockout.brackets.some(g => g.phase === "repechage"), "Hidden Consolation remains prepared");
  const semi = knockout.brackets.find(g => !g.isBye);
  knockout = finish(knockout, semi.matchKey);
  for (const g of knockout.brackets.filter(g => g.roundName !== "Final" && !g.isBye && g.matchKey !== semi.matchKey)) knockout = finish(knockout, g.matchKey);
  const final = knockout.brackets.find(g => g.roundName === "Final");
  knockout = cup.updateTeamCupLeg(knockout, final.matchKey, 0, { s1: "6", s2: "0" });
  assert.throws(() => finish(knockout, semi.matchKey, [[0, 6], [0, 6]]), /mudaria|registrada/);
  console.log("Times/Equipes: formação, 56 torneios completos, ranking, Consolation, timers, concorrência e preservação de dados aprovados.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runTeamCupChecks();
