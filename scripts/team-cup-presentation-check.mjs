import assert from "node:assert/strict";
import { fixture, finishGroups } from "./team-cup-check.mjs";
import * as cup from "../src/domain/teamCup.mjs";
import * as video from "../src/domain/teamCupVideo.mjs";
import { teamCupPodium } from "../src/domain/teamCupPodium.mjs";

for (const kind of ["trio", "squad"]) {
  let data = fixture(6, kind);
  data.teamCup.formation = "random";
  data.teamCup.pool = structuredClone(data.players.teams.flatMap(t => t.athletes));
  assert.throws(() => video.getTeamCupVideoSnapshot(data, {}, "teams"));
  data = video.recordTeamCupCaptainDraw(cup.drawTeamCaptains(data));
  const captains = data.players.teams.map(t => t.captainId);
  data = video.recordTeamCupMemberDraw(cup.drawTeamMembers(data));
  const snapshot = video.getTeamCupVideoSnapshot(data, { name: "Teste" }, "teams");
  assert.deepEqual(snapshot.teams.map(t => t.captainId), captains);
  const before = JSON.stringify(data);
  const scenes = video.teamCupVideoScenes(snapshot);
  assert.deepEqual(scenes.filter(s => s.type === "motion").map(s => s.duration), [5000, 5000]);
  assert.equal(scenes.filter(s => s.type === "teams").flatMap(s => s.items).flatMap(t => t.athletes).length, 6 * cup.teamSize(data));
  snapshot.teams[0].name = "Mutação externa";
  assert.equal(JSON.stringify(data), before, "Snapshot is isolated; video does not redraw/write tournament");
  const edited = structuredClone(data); edited.players.teams[0].athletes[0].name += " alterado";
  assert.throws(() => video.getTeamCupVideoSnapshot(edited, {}, "teams"), /editada/);
  data = video.recordTeamCupGroupVideo(cup.generateTeamCupGroups(data), "random");
  assert.doesNotThrow(() => video.getTeamCupVideoSnapshot(data, {}, "teams"), "Group reorder does not invalidate team video");
  const groups = video.getTeamCupVideoSnapshot(data, {}, "groups");
  assert.equal(groups.groups.flatMap(g => g.teams).length, 6);
  assert.equal(video.teamCupVideoScenes(groups).filter(s => s.type === "motion").length, 1);
  const manual = video.recordTeamCupGroupVideo(data, "manual");
  assert.equal(video.teamCupVideoScenes(video.getTeamCupVideoSnapshot(manual, {}, "groups")).filter(s => s.type === "motion").length, 0);

  data = finishGroups(data);
  assert.equal(data.cupConfig.repechageEnabled, false);
  data = cup.generateTeamCupBrackets(data);
  assert(data.brackets.some(g => g.phase === "repechage"), "Consolation is always prepared, even when hidden");
  const initialBrackets = structuredClone(data.brackets);
  data = cup.setTeamCupConsolationEnabled(data, true);
  assert.deepEqual(data.brackets, initialBrackets);
  assert.deepEqual(teamCupPodium(data), []);
  for (const stored of data.brackets) {
    if (stored.isBye) continue;
    // Winner of two legs has fewer aggregate games: the podium must follow wins.
    for (const [i, [s1, s2]] of [[6, 4], [0, 6], [6, 4]].entries()) data = cup.updateTeamCupLeg(data, stored.matchKey, i, { s1: String(s1), s2: String(s2) });
  }
  const final = cup.resolveTeamCupGame(data, data.brackets.find(g => g.phase === "main" && g.roundName === "Final"));
  assert(Number(final.s1) < Number(final.s2));
  assert.equal(teamCupPodium(data)[0].id, final.ids1[0]);
  assert.equal(teamCupPodium(data)[1].id, final.ids2[0]);
  assert.equal(teamCupPodium(data).length, 3);
  assert.equal(teamCupPodium(data, "repechage").length, 2);
  const scores = structuredClone(data.brackets);
  data = cup.setTeamCupConsolationEnabled(data, false);
  assert.deepEqual(teamCupPodium(data, "repechage"), []);
  assert.deepEqual(data.brackets, scores, "Hiding does not erase results");
  data = cup.setTeamCupConsolationEnabled(data, true);
  assert.deepEqual(data.brackets, scores);
  assert.equal(teamCupPodium(data, "repechage").length, 2);

  const legacy = { ...data, brackets: data.brackets.filter(g => g.phase === "main") };
  const repaired = cup.setTeamCupConsolationEnabled(legacy, true);
  assert.deepEqual(repaired.brackets.filter(g => g.phase === "main"), legacy.brackets);
  assert(repaired.brackets.some(g => g.phase === "repechage"));
  assert.deepEqual(cup.setTeamCupConsolationEnabled(repaired, true), repaired, "Idempotent legacy repair");
}
console.log("Team cup presentation checks passed: videos, podium, independent Consolation visibility.");
