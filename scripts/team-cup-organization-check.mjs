import assert from "node:assert/strict";
import { TEAM_LEVELS, createTeamCupData, drawTeamCaptains, drawTeamMembers, generateTeamCupGroups } from "../src/domain/teamCup.mjs";
import { applyTeamCupOrganization, importTeamCupList, organizeTeamCupGroups, organizationSignature, participantEntries,
  prepareTeamCupFormation, swapTeamCupAthletes, swapTeamCupGroupItems, teamCupOrganizationGroups, updateTeamCupParticipant } from "../src/domain/teamCupOrganization.mjs";
import { normalizeTournamentData } from "../src/domain/tournamentDataNormalization.mjs";

for (const kind of ["trio", "squad"]) {
  for (const count of [4, 6, 7, 8, 9, 32]) {
    const empty = createTeamCupData({ winningScore: 6 }, count, kind);
    const list = participantEntries(empty).map(({ athlete }, i) => `Atleta ${i + 1}; ${athlete.gender}; ${TEAM_LEVELS[i % 6]}`).join("\n");
    const filled = importTeamCupList(empty, list);
    assert.equal(participantEntries(empty).filter(e => e.athlete.name).length, 0, "Import must be immutable");
    assert.equal(participantEntries(filled).filter(e => e.athlete.name).length, count * (kind === "trio" ? 3 : 4));
    assert.throws(() => importTeamCupList(filled, "Outro atleta"), /vagas/);
    assert.throws(() => importTeamCupList(empty, "João\nJoao"), /repetidos/);
    assert.throws(() => importTeamCupList(empty, "Maria; X"), /H ou M/);
    assert.throws(() => importTeamCupList(empty, "Maria; M; Z"), /Nível inválido/);
    for (const mode of ["manual", "balanced", "similar"]) {
      const draft = organizeTeamCupGroups(filled, mode);
      const saved = applyTeamCupOrganization(filled, draft, organizationSignature(filled));
      const generated = generateTeamCupGroups(saved, () => 0);
      assert.deepEqual(generated.players.teams.map(t => t.id), saved.teamCup.groupOrder, "Generating must preserve approved group order");
      const groups = teamCupOrganizationGroups(saved);
      for (const group of groups) {
        const games = generated.schedule.flat().filter(g => g.groupId === group.id);
        const actual = new Set(games.flatMap(g => [generated.players.teams[g.ids1[0]].id, generated.players.teams[g.ids2[0]].id]));
        assert.deepEqual([...actual].sort(), [...group.teamIds].sort());
        assert([3, 4].includes(group.teamIds.length));
      }
      assert.deepEqual(normalizeTournamentData("Times/Equipes", saved).teamCup.groupOrder, saved.teamCup.groupOrder);
      assert.throws(() => applyTeamCupOrganization(generated, saved, organizationSignature(generated)), /protegida/);
      assert.throws(() => importTeamCupList(generated, "Outro"), /protegida/);
      assert.throws(() => organizeTeamCupGroups(generated, "manual"), /protegida/);
      assert.throws(() => updateTeamCupParticipant(generated, "athlete-0-0", { name: "Outro" }), /protegida/);
      assert.deepEqual(filled.players, saved.players, "Grouping never changes athletes or captains");
    }
    assert.throws(() => applyTeamCupOrganization(filled, filled, "stale"), /atualizada/);
    const swapped = swapTeamCupGroupItems(filled, { kind: "team", id: "team-0" }, { kind: "team", id: "team-1" });
    assert.equal(swapped.teamCup.groupOrder[0], "team-1");
    assert.deepEqual(swapped.players, filled.players);
    const a = filled.players.teams[0].athletes[0], b = filled.players.teams[1].athletes[0];
    const roster = swapTeamCupAthletes(filled, a.id, b.id);
    assert.equal(roster.players.teams[0].captainId, b.id);
    assert.equal(roster.players.teams[1].captainId, a.id);
    if (kind === "squad") assert.throws(() => swapTeamCupAthletes(filled, a.id, filled.players.teams[1].athletes[2].id), /mesma composição/);
    const random = prepareTeamCupFormation(filled, "balanced");
    const captains = drawTeamCaptains(random, () => .3);
    const members = drawTeamMembers(captains, () => .3);
    assert.equal(members.teamCup.drawStage, "complete");
    assert.equal(new Set(members.players.teams.flatMap(t => t.athletes.map(a => a.id))).size, participantEntries(filled).length);
    const edited = updateTeamCupParticipant(members, a.id, { name: "Novo nome" });
    assert.equal(edited.teamCup.pool.find(p => p.id === a.id).name, "Novo nome");
    assert.equal(edited.players.teams.flatMap(t => t.athletes).find(p => p.id === a.id).name, "Novo nome");
  }
}
const differentSizes = createTeamCupData({}, 7);
assert.throws(() => swapTeamCupGroupItems(differentSizes, { kind: "group", id: 0 }, { kind: "group", id: 1 }), /diferentes/);
const sameSizes = createTeamCupData({}, 9);
const groupSwap = swapTeamCupGroupItems(sameSizes, { kind: "group", id: 0 }, { kind: "group", id: 1 });
assert.deepEqual(groupSwap.teamCup.groupOrder.slice(0, 3), ["team-3", "team-4", "team-5"]);
assert.throws(() => organizeTeamCupGroups(sameSizes, "balanced"), /nome/);
console.log("Times/Equipes organização: importação, grupos manuais/por nível, capitães, Squad, persistência e proteção de jogos aprovados.");
