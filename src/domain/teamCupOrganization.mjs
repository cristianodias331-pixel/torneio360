import { createCearenseGroups } from "./cupGroups.mjs";
import { TEAM_LEVELS, teamSize, validateTeamCupTeams } from "./teamCup.mjs";

export const organizationLocked = data => Boolean(data.schedule?.length || data.brackets?.length);
export function assertOrganizationEditable(data) {
  if (organizationLocked(data)) throw new Error("A formação está protegida porque os jogos já foram gerados. Nenhum jogo ou placar será alterado.");
}
export const organizationSignature = data => JSON.stringify([data.players, data.teamCup, data.cupConfig?.teamCount]);
export function participantEntries(data) {
  if (data.teamCup.formation === "random" && data.teamCup.drawStage !== "complete") {
    return data.teamCup.pool.map((athlete, index) => ({ athlete, index, team: null }));
  }
  return data.players.teams.flatMap(team => team.athletes.map(athlete => ({ athlete, team })));
}
export function updateTeamCupParticipant(data, id, patch) {
  assertOrganizationEditable(data);
  if (data.teamCup.formation === "random" && data.teamCup.drawStage === "captains") throw new Error("Conclua o sorteio dos integrantes antes de editar a lista.");
  const next = structuredClone(data);
  // The pool and the assigned roster refer to the same athlete identity.
  for (const athlete of [...next.teamCup.pool, ...next.players.teams.flatMap(t => t.athletes)]) {
    if (athlete.id === id) Object.assign(athlete, patch);
  }
  return next;
}
const nameKey = name => String(name).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function parseTeamCupList(text) {
  return String(text).split(/\r?\n/).map(line => line.trim().replace(/^\s*(?:\d+[.)\-:]\s*|[-•*]\s*)/, ""))
    .filter(Boolean).map(line => {
      const [name, gender = "", level = ""] = line.split(";").map(s => s.trim());
      if (!name || name.length > 100) throw new Error("Cada linha precisa de um nome com até 100 caracteres.");
      const normalizedGender = gender.toUpperCase();
      if (gender && !["H", "M"].includes(normalizedGender)) throw new Error(`Use H ou M após o nome de ${name}.`);
      const normalizedLevel = TEAM_LEVELS.find(item => nameKey(item) === nameKey(level));
      if (level && !normalizedLevel) throw new Error(`Nível inválido para ${name}. Use Principiante, Iniciante, D, C, B ou A.`);
      if (line.split(";").length > 3) throw new Error("Use: Nome; H ou M; Nível. Um atleta por linha.");
      return { name, ...(gender ? { gender: normalizedGender } : {}), ...(level ? { level: normalizedLevel } : {}) };
    });
}
export function importTeamCupList(data, text) {
  assertOrganizationEditable(data);
  const names = parseTeamCupList(text);
  if (!names.length) throw new Error("Cole pelo menos um nome.");
  const entries = participantEntries(data);
  const available = entries.filter(({ athlete }) => !athlete.name.trim());
  if (names.length > available.length) throw new Error(`A lista tem ${names.length} atletas, mas há somente ${available.length} vagas vazias. Nenhum nome será substituído.`);
  const keys = [...entries.map(e => e.athlete.name).filter(n => n.trim()), ...names.map(n => n.name)].map(nameKey);
  if (new Set(keys).size !== keys.length) throw new Error("Há nomes repetidos. Diferencie os atletas homônimos antes de aplicar.");
  let next = data;
  names.forEach((patch, i) => { next = updateTeamCupParticipant(next, available[i].athlete.id, patch); });
  return next;
}
export function teamCupOrganizationGroups(data) {
  const teams = data.players.teams;
  const stored = data.teamCup.groupOrder;
  const ids = teams.map(t => t.id);
  const order = Array.isArray(stored) && stored.length === ids.length && new Set(stored).size === ids.length && stored.every(id => ids.includes(id)) ? stored : ids;
  return createCearenseGroups(teams.length).map(group => ({ ...group, teamIds: group.teamIds.map(i => order[i]) }));
}
export const teamLevelValue = team => team.athletes.reduce((sum, a) => sum + TEAM_LEVELS.indexOf(a.level) + 1, 0) / Math.max(1, team.athletes.length);
export function organizeTeamCupGroups(data, mode) {
  assertOrganizationEditable(data);
  const groups = teamCupOrganizationGroups(data);
  let order = groups.flatMap(g => g.teamIds);
  if (mode !== "manual") {
    if (!["balanced", "similar"].includes(mode)) throw new Error("Forma de organização inválida.");
    validateTeamCupTeams(data);
    if (data.players.teams.some(t => t.athletes.some(a => !TEAM_LEVELS.includes(a.level)))) throw new Error("Informe o nível de todos os atletas para organizar os grupos por nível.");
    const sorted = [...data.players.teams].sort((a, b) => teamLevelValue(b) - teamLevelValue(a));
    if (mode === "similar") order = sorted.map(t => t.id);
    else {
      const buckets = groups.map(group => ({ capacity: group.teamIds.length, ids: [], strength: 0 }));
      for (const team of sorted) {
        const target = buckets.filter(g => g.ids.length < g.capacity).sort((a, b) => a.ids.length - b.ids.length || a.strength / a.capacity - b.strength / b.capacity)[0];
        target.ids.push(team.id); target.strength += teamLevelValue(team);
      }
      order = buckets.flatMap(g => g.ids);
    }
  }
  return { ...data, teamCup: { ...data.teamCup, groupMode: mode, groupOrder: order } };
}
export function swapTeamCupGroupItems(data, source, target) {
  assertOrganizationEditable(data);
  if (source.kind !== target.kind) throw new Error("Troque equipe com equipe, ou a barra de um grupo com a de outro grupo.");
  const groups = teamCupOrganizationGroups(data);
  let order = groups.flatMap(g => g.teamIds);
  if (source.kind === "team") {
    const a = order.indexOf(source.id), b = order.indexOf(target.id);
    if (a < 0 || b < 0) throw new Error("Equipe não encontrada.");
    [order[a], order[b]] = [order[b], order[a]];
  } else {
    const a = groups.find(g => g.id === source.id), b = groups.find(g => g.id === target.id);
    if (!a || !b) throw new Error("Grupo não encontrado.");
    if (a.teamIds.length !== b.teamIds.length) throw new Error("Esses grupos têm quantidades diferentes de vagas. Troque as equipes individualmente.");
    [a.teamIds, b.teamIds] = [b.teamIds, a.teamIds]; order = groups.flatMap(g => g.teamIds);
  }
  return { ...data, teamCup: { ...data.teamCup, groupMode: "manual", groupOrder: order } };
}
export function swapTeamCupAthletes(data, firstId, secondId) {
  assertOrganizationEditable(data);
  const next = structuredClone(data);
  const first = next.players.teams.find(t => t.athletes.some(a => a.id === firstId));
  const second = next.players.teams.find(t => t.athletes.some(a => a.id === secondId));
  if (!first || !second) throw new Error("Atleta não encontrado na equipe.");
  const a = first.athletes.findIndex(p => p.id === firstId), b = second.athletes.findIndex(p => p.id === secondId);
  if (teamSize(data) === 4 && first !== second && first.athletes[a].gender !== second.athletes[b].gender) throw new Error("Para manter 2 homens e 2 mulheres, troque atletas da mesma composição (H por H ou M por M).");
  const firstCaptain = first.captainId === firstId, secondCaptain = second.captainId === secondId;
  [first.athletes[a], second.athletes[b]] = [second.athletes[b], first.athletes[a]];
  if (first !== second) {
    if (firstCaptain) first.captainId = secondId;
    if (secondCaptain) second.captainId = firstId;
  }
  return next;
}
export function applyTeamCupOrganization(current, draft, signature) {
  assertOrganizationEditable(current);
  if (organizationSignature(current) !== signature) throw new Error("A lista foi atualizada enquanto a janela estava aberta. Abra Organizar grupos novamente para não sobrescrever alterações.");
  validateTeamCupTeams(draft);
  if (draft.teamCup.formation === "random" && draft.teamCup.drawStage !== "complete") throw new Error("Sorteie os capitães e depois os integrantes antes de salvar.");
  return { ...current, players: structuredClone(draft.players), teamCup: structuredClone(draft.teamCup) };
}
export function prepareTeamCupFormation(data, mode) {
  assertOrganizationEditable(data);
  const pool = structuredClone(data.teamCup.formation === "random" && data.teamCup.drawStage !== "complete" ? data.teamCup.pool : data.players.teams.flatMap(t => t.athletes));
  const teams = data.players.teams.map((team, i) => {
    const athletes = team.athletes.length === teamSize(data) ? team.athletes : pool.slice(i * teamSize(data), (i + 1) * teamSize(data));
    return { ...team, athletes: structuredClone(athletes), captainId: athletes.some(a => a.id === team.captainId) ? team.captainId : athletes[0]?.id };
  });
  return { ...data, players: { ...data.players, teams }, teamCup: { ...data.teamCup, pool, formation: mode === "manual" ? "fixed" : "random", balanced: mode === "balanced", drawStage: "pending" } };
}
