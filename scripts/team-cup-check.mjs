import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createInitialData, normalizeTournamentData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createCearenseGroups } from "../src/domain/cupGroups.mjs";
import { getScoreWinnerSide } from "../src/domain/scoreRules.mjs";
import { getGameWinnerId } from "../src/domain/bracketProgression.mjs";
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
export function runTeamCupChecks() {
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
  assert.throws(() => cup.updateTeamCupLeg(d, key, 1, { s1: "6", s2: "0" }), /liberada/);
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
  assert.throws(() => cup.updateTeamCupLeg(finish(d, key), key, 2, { s1: "6" }), /liberada/);
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
  const metricRows = [{ id: 0, name: "A", w: 2, bal: 4, pts: 20 }, { id: 1, name: "B", w: 2, bal: 4, pts: 24 }];
  assert.equal(cup.rankTeamCupRows(metricRows, [], 6).rows[0].id, 1);
  const directGame = cup.makeTeamMatch({ matchKey: "direct", ids1: [0], ids2: [1] });
  directGame.teamCupLegs[0] = { s1: "6", s2: "0" };
  directGame.teamCupLegs[1] = { s1: "6", s2: "0" };
  const tiedRows = metricRows.map(row => ({ ...row, pts: 24 }));
  assert.equal(cup.rankTeamCupRows(tiedRows, [directGame], 6, [1, 0]).rows[0].id, 0, "Direct confrontation precedes an old draw order");
  const threeRows = [0, 1, 2].map(id => ({ id, name: String(id), w: 1, bal: 0, pts: 12 }));
  const cycleGames = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({ ...directGame, ids1: [a], ids2: [b] }));
  assert.equal(cup.rankTeamCupRows(threeRows, cycleGames, 6).unresolvedTieIds.length, 3);
  assert.deepEqual(cup.rankTeamCupRows(threeRows, cycleGames, 6, [2, 0, 1]).rows.map(r => r.id), [2, 0, 1]);
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
