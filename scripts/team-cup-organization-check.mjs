import assert from "node:assert/strict";
import { TEAM_LEVELS, createTeamCupData, drawTeamCaptains, drawTeamMembers, generateTeamCupGroups } from "../src/domain/teamCup.mjs";
import { applyTeamCupOrganization, buildTeamCupImportPreview, importTeamCupList, organizeTeamCupGroups, organizationSignature, parseTeamCupList, participantEntries,
  prepareTeamCupFormation, swapTeamCupAthletes, swapTeamCupGroupItems, teamCupOrganizationGroups, updateTeamCupParticipant } from "../src/domain/teamCupOrganization.mjs";
import { normalizeTournamentData } from "../src/domain/tournamentDataNormalization.mjs";
import { mergeConcurrentTournamentData } from "../src/offlineDataStore.mjs";

for (const kind of ["trio", "squad"]) {
  for (const count of [4, 6, 7, 8, 9, 32]) {
    const empty = createTeamCupData({ winningScore: 6 }, count, kind);
    const list = participantEntries(empty).map(({ athlete }, i) => `Atleta ${String.fromCharCode(65 + Math.floor(i / 26), 65 + i % 26)}; ${athlete.gender}; ${TEAM_LEVELS[i % 6]}`).join("\n");
    const filled = importTeamCupList(empty, list);
    assert.equal(participantEntries(empty).filter(e => e.athlete.name).length, 0, "Import must be immutable");
    assert.equal(participantEntries(filled).filter(e => e.athlete.name).length, count * (kind === "trio" ? 3 : 4));
    assert.throws(() => importTeamCupList(filled, "Outro atleta"), /vagas/);
    assert.throws(() => importTeamCupList(empty, "João\nJoao"), /repetidos/);
    assert.throws(() => importTeamCupList(empty, "Maria; X"), /Masculino ou Feminino/);
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
const columnList = [{ name: "1. 🏆 CRISTIANO da SILVA ✅", gender: "Masculino", level: "C" }, { name: "2. Maria ⭐ Santos", gender: "Feminino", level: "Iniciante" }];
assert.deepEqual(parseTeamCupList(columnList), [{ name: "Cristiano da Silva", gender: "H", level: "C" }, { name: "Maria Santos", gender: "M", level: "Iniciante" }]);
for (const kind of ["trio", "squad"]) {
  let data = createTeamCupData({}, 4, kind);
  data = updateTeamCupParticipant(data, "athlete-0-0", { name: "Nome Preservado", level: "A", gender: "M" });
  const before = structuredClone(data);
  const preview = buildTeamCupImportPreview(data, columnList);
  assert.equal(preview.imported, 2);
  assert.equal(preview.preserved, 1);
  assert.equal(preview.vacancies, 4 * (kind === "trio" ? 3 : 4) - 3);
  assert.deepEqual(data, before, "Preview cannot mutate saved participants");
  assert.equal(preview.entries[0].athlete.name, "Nome Preservado");
  assert.equal(preview.entries[0].athlete.level, "A");
  const replacePreview = buildTeamCupImportPreview(data, columnList, "replace");
  assert.equal(replacePreview.preserved, 0);
  assert.equal(replacePreview.entries[0].athlete.name, "Cristiano da Silva");
  assert.equal(replacePreview.entries[0].athlete.gender, "H");
  assert.equal(replacePreview.entries[0].athlete.level, "C");
  assert.throws(() => importTeamCupList(data, columnList, "replace"), /Confirme/);
  const replaced = importTeamCupList(data, columnList, "replace", { replaceConfirmed: true, signature: organizationSignature(data) });
  assert.deepEqual(replaced, replacePreview.nextData, "Applied list must match the entire preview");
  assert.equal(participantEntries(replaced).filter(e => e.athlete.name).length, 2);
  assert.deepEqual(replaced.players.teams.map(t => [t.id, t.name, t.captainId]), data.players.teams.map(t => [t.id, t.name, t.captainId]));
  assert.deepEqual(normalizeTournamentData("Times/Equipes", replaced).players, replaced.players);
  assert.deepEqual(mergeConcurrentTournamentData(data, replaced, data).data.players, replaced.players);
  assert.throws(() => importTeamCupList(data, columnList, "replace", { replaceConfirmed: true, signature: "stale" }), /atualizada/);
  const noLevel = importTeamCupList(data, [{ name: "Outra Pessoa" }], "replace", { replaceConfirmed: true });
  assert.equal(participantEntries(noLevel)[0].athlete.level, "", "Replacement must not inherit previous athlete's level");
  assert.equal(participantEntries(noLevel)[0].athlete.gender, "M", "Unselected composition follows the previewed slot");
  const cleared = importTeamCupList(replaced, [{ name: "Pessoa Nova" }], "replace", { replaceConfirmed: true });
  assert.equal(participantEntries(cleared)[1].athlete.name, "", "All non-imported names must clear in replacement mode");
  assert.equal(participantEntries(cleared)[1].athlete.level, "");
  const duplicate = buildTeamCupImportPreview(data, [{ name: "Nome Preservado" }]);
  assert.equal(duplicate.duplicates, 1);
  assert.throws(() => importTeamCupList(data, [{ name: "Nome Preservado" }]), /repetidos/);
  const placeholders = updateTeamCupParticipant(data, "athlete-0-1", { name: "Jogador 2" });
  assert.equal(buildTeamCupImportPreview(placeholders, columnList).preserved, 1);
  const ignored = buildTeamCupImportPreview(data, [{ name: "✅ 123" }, { name: "Pessoa Válida" }]);
  assert.equal(ignored.ignored, 1);
  assert.equal(ignored.imported, 1);
  const random = prepareTeamCupFormation(replaced, "random");
  const poolReplaced = importTeamCupList(random, columnList, "replace", { replaceConfirmed: true });
  assert.equal(poolReplaced.teamCup.pool[1].name, "Maria Santos");
  assert.equal(poolReplaced.players.teams[0].athletes[1].name, "Maria Santos");
  const locked = { ...data, schedule: [[{ matchKey: "existing", s1: "6", s2: "4" }]] };
  assert.throws(() => importTeamCupList(locked, columnList, "replace", { replaceConfirmed: true }), /protegida/);
  assert.equal(locked.schedule[0][0].s1, "6");
}
console.log("Times/Equipes organização: importação, grupos manuais/por nível, capitães, Squad, persistência e proteção de jogos aprovados.");
