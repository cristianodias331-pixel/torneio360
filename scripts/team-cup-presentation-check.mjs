import assert from "node:assert/strict";
import { fixture, finishGroups } from "./team-cup-check.mjs";
import * as cup from "../src/domain/teamCup.mjs";
import * as video from "../src/domain/teamCupVideo.mjs";
import { teamCupPodium } from "../src/domain/teamCupPodium.mjs";
import { teamCupVideoCardLayout, TEAM_CUP_VIDEO_CONTENT_HEIGHT, TEAM_CUP_VIDEO_CARD_GAP } from "../src/domain/teamCupVideoLayout.mjs";
import { drawTeamCupVideoFrame } from "../src/features/teamCup/teamCupVideoExport.mjs";

const defaultMeasure = (text, font) => [...text].length * Number(font.match(/([\d.]+)px/)[1]) * .65;
function assertVideoPages(snapshot, measure = defaultMeasure) {
  const source = JSON.stringify(snapshot), scenes = video.teamCupVideoScenes(snapshot, { measure });
  for (const scene of scenes.filter(s => s.cardLayouts)) {
    const teams = scene.type === "groups" ? scene.items[0].teams : scene.items;
    assert(scene.cardLayouts.reduce((sum, card) => sum + card.height, (teams.length - 1) * TEAM_CUP_VIDEO_CARD_GAP) <= TEAM_CUP_VIDEO_CONTENT_HEIGHT, "Cards never overlap the footer");
    const painted = [], stack = [];
    const ctx = new Proxy({ font: "", textBaseline: "alphabetic", textAlign: "left",
      measureText(text) { return { width: measure(text, this.font) }; },
      fillText(text, x, y) { painted.push({ text, x, y, font: this.font, baseline: this.textBaseline }); },
      createLinearGradient() { return { addColorStop() {} }; },
      save() { stack.push({ font: this.font, textBaseline: this.textBaseline, textAlign: this.textAlign }); },
      restore() { Object.assign(this, stack.pop()); },
    }, { get(target, key) { return key in target ? target[key] : () => {}; } });
    drawTeamCupVideoFrame(ctx, snapshot, scene, 0, {}, 0, scenes.length);
    const rendered = painted.filter(row => row.y >= 352 && row.y < 1172);
    assert.deepEqual(rendered.map(row => row.text), scene.cardLayouts.flatMap(card => card.rows.map(row => row.text)), "The real video renderer paints every planned roster row");
    assert(rendered.every(row => row.baseline === "top" && row.x + measure(row.text, row.font) <= 650.001));
    for (const [i, team] of teams.entries()) {
      const card = scene.cardLayouts[i], captain = team.athletes.find(a => a.id === team.captainId);
      const textOf = role => card.rows.filter(row => row.role === role).map(row => row.text).join("").replace(/\s/g, "");
      assert.equal(textOf("team"), team.name.replace(/\s/g, ""));
      assert.equal(textOf("captain"), captain.name.replace(/\s/g, ""));
      assert(card.rows.findIndex(row => row.text.startsWith("CAPITÃO/Ã")) < card.rows.findIndex(row => row.role === "captain"), "Captain/category label precedes the captain's name");
      if (scene.type !== "captains") {
        assert.equal(textOf("member"), team.athletes.filter(a => a.id !== team.captainId).map(a => a.name).join("").replace(/\s/g, ""), "Both videos include every non-captain, in roster order");
        assert(card.rows.findIndex(row => row.text === "INTEGRANTES") < card.rows.findIndex(row => row.role === "member"));
        assert.deepEqual(card, teamCupVideoCardLayout(team, { measure }), "Team and group videos use the same layout");
      }
      assert(card.rows.every(row => row.y + row.height <= card.height - 21 && measure(row.text, row.font) <= 580.001));
    }
  }
  assert.equal(JSON.stringify(snapshot), source, "Rendering and pagination never change the saved formation");
  return scenes;
}

for (const kind of ["trio", "squad"]) for (const count of cup.TEAM_COUNTS) {
  const data = cup.generateTeamCupGroups(fixture(count, kind), () => .4);
  const snapshot = video.getTeamCupVideoSnapshot(data, { name: "Teste de grupos completos" }, "groups");
  const scenes = assertVideoPages(snapshot).filter(s => s.type === "groups");
  assert.deepEqual(scenes.flatMap(s => s.items[0].teams.map(t => t.id)), snapshot.groups.flatMap(g => g.teams.map(t => t.id)), "Every group team is shown once, preserving group order");
  for (const group of snapshot.groups) {
    const pages = scenes.filter(s => s.items[0].title === group.title);
    assert.deepEqual(pages.map(s => s.groupPage), pages.map((_, i) => i + 1));
    assert(pages.every(s => s.groupPages === pages.length));
  }
}

// Long names, including unbroken words, wrap instead of being cut with an ellipsis.
for (const kind of ["trio", "squad"]) {
  const data = fixture(4, kind);
  data.players.teams.forEach((team, i) => {
    team.name = "W".repeat(59) + String.fromCharCode(65 + i);
    team.captainId = team.athletes.at(-1).id;
    team.athletes.forEach((a, j) => { a.name = "W".repeat(99) + String.fromCharCode(65 + i * 4 + j); a.level = "Principiante"; });
  });
  const teams = data.players.teams;
  const snapshot = { id: "T360-layout-check", tournamentName: "Nomes completos", modalityName: kind, createdAt: "2026-09-10T12:00:00Z", mode: "random", kind: "team-cup-teams", teams,
    captains: teams.map(t => ({ ...t, athletes: t.athletes.filter(a => a.id === t.captainId) })) };
  assertVideoPages(snapshot);
  assertVideoPages({ ...snapshot, kind: "team-cup-groups", groups: [{ title: "Grupo A", teams }] });
  assertVideoPages(snapshot, (text, font) => [...text].length * Number(font.match(/([\d.]+)px/)[1]) * .95);
}

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
  assertVideoPages(snapshot);
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
