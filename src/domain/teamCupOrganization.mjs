import { createCearenseGroups } from "./cupGroups.mjs";
import { TEAM_LEVELS, generateTeamCupGroups, teamSize, validateTeamCupTeams } from "./teamCup.mjs";
import { formatParticipantName } from "./participantNames.mjs";

export const organizationLocked = data => Boolean(data.schedule?.length || data.brackets?.length);
export function assertOrganizationEditable(data) {
  if (organizationLocked(data)) throw new Error("A formação está protegida porque os jogos já foram gerados. Nenhum jogo ou placar será alterado.");
}
export const organizationSignature = data => JSON.stringify([data.players, data.teamCup, data.cupConfig?.teamCount]);
export function teamCupOrganizationDraft(data) {
  const draft = structuredClone(data);
  // Work on formation without touching the competition's existing games.
  if (organizationLocked(data)) draft.teamCup.groupOrder = data.players.teams.map(team => team.id);
  return { ...draft, schedule: [], brackets: [] };
}
export function participantEntries(data) {
  if (data.teamCup.formation === "random" && data.teamCup.drawStage !== "complete") {
    return data.teamCup.pool.map((athlete, index) => ({ athlete, index, team: null }));
  }
  return data.players.teams.flatMap(team => team.athletes.map(athlete => ({ athlete, team })));
}
export function updateTeamCupParticipant(data, id, patch) {
  if (data.teamCup.formation === "random" && data.teamCup.drawStage === "captains") throw new Error("Conclua o sorteio dos integrantes antes de editar a lista.");
  const next = structuredClone(data);
  // The pool and the assigned roster refer to the same athlete identity.
  for (const athlete of [...next.teamCup.pool, ...next.players.teams.flatMap(t => t.athletes)]) {
    if (athlete.id === id) Object.assign(athlete, patch);
  }
  return next;
}
const nameKey = name => String(name).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
// Match the individual-name cleanup of the existing import, without changing other modalities.
function cleanImportedName(value) {
  const prepared = String(value || "").normalize("NFKC")
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, " ")
    .replace(/\p{Regional_Indicator}{2}/gu, " ")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\u200D\uFE0E\uFE0F]/gu, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s'’.\-:()[\]{}]/gu, " ").trim();
  let name = prepared;
  for (let i = 0; i < 5; i++) name = name.replace(/^\s*(?:(?:participante|atleta|jogador|masculino|feminino)\s*(?:n[º°o.]?\s*)?\p{N}{1,3}\s*[ºª°oa]?\s*[.)\-:]?\s*|\p{N}{1,3}\s*[ºª°oa]?\s*(?:[.)\-:]\s*|\s+)|[-–—•*▪◦]+\s*)/iu, "").trim();
  return formatParticipantName(name.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/[^\p{L}\p{M}\s'’.]/gu, " ").replace(/\s+/g, " ").replace(/^[\s.'’]+|[\s.'’]+$/g, ""));
}
function readTeamCupList(source) {
  const rows = Array.isArray(source) ? source : String(source).split(/\r?\n/).map(line => {
    const [name, gender = "", level = "", ...extra] = line.split(";").map(s => s.trim());
    if (extra.length) throw new Error("Cole um atleta por linha, com os campos Nome, Masculino/Feminino e Nível.");
    return { name, gender, level };
  });
  let ignored = 0;
  const athletes = rows.flatMap(row => {
    if (!String(row.name || "").trim()) return [];
    const name = cleanImportedName(row.name);
    if (!name) { ignored++; return []; }
    if (name.length > 100) throw new Error("Cada linha precisa de um nome com até 100 caracteres.");
    const gender = String(row.gender || "").trim(), level = String(row.level || "").trim();
    const normalizedGender = ({ h: "H", m: "M", masculino: "H", feminino: "M" })[nameKey(gender)];
    if (gender && !normalizedGender) throw new Error(`Selecione Masculino ou Feminino para ${name}.`);
    const normalizedLevel = TEAM_LEVELS.find(item => nameKey(item) === nameKey(level));
    if (level && !normalizedLevel) throw new Error(`Nível inválido para ${name}. Use Principiante, Iniciante, D, C, B ou A.`);
    return [{ name, ...(gender ? { gender: normalizedGender } : {}), ...(level ? { level: normalizedLevel } : {}) }];
  });
  return { athletes, ignored };
}
export const parseTeamCupList = source => readTeamCupList(source).athletes;
export const isTeamCupVacancy = athlete => !String(athlete.name || "").trim()
  || /^(?:participante|jogador|atleta|masculino|feminino) \d+$/u.test(nameKey(athlete.name));
export function buildTeamCupImportPreview(data, source, mode = "available") {
  if (!["available", "replace"].includes(mode)) throw new Error("Modo de importação inválido.");
  const { athletes, ignored } = readTeamCupList(source), replace = mode === "replace";
  const entries = participantEntries(data), targets = entries.filter(e => replace || isTeamCupVacancy(e.athlete));
  const patches = new Map(targets.map(({ athlete }, i) => [athlete.id, {
    ...(replace ? { name: "", level: "", captainCandidate: false } : {}), ...(athletes[i] || {}),
  }]));
  const nextData = structuredClone(data);
  for (const athlete of [...nextData.teamCup.pool, ...nextData.players.teams.flatMap(t => t.athletes)]) {
    Object.assign(athlete, patches.get(athlete.id));
  }
  const result = participantEntries(nextData);
  const keys = result.filter(e => !isTeamCupVacancy(e.athlete)).map(e => nameKey(e.athlete.name));
  const imported = Math.min(athletes.length, targets.length);
  return { nextData, entries: result, imported, preserved: entries.length - targets.length,
    vacancies: targets.length - imported, overflow: Math.max(0, athletes.length - targets.length),
    duplicates: keys.length - new Set(keys).size, ignored, total: athletes.length,
    importedIds: targets.slice(0, imported).map(e => e.athlete.id) };
}
export function importTeamCupList(data, source, mode = "available", { replaceConfirmed = false, signature } = {}) {
  if (data.teamCup.formation === "random" && data.teamCup.drawStage === "captains") throw new Error("Conclua o sorteio dos integrantes antes de editar a lista.");
  if (signature !== undefined && organizationSignature(data) !== signature) throw new Error("A lista foi atualizada enquanto a janela estava aberta. Abra Colar lista novamente para revisar os participantes atuais.");
  const preview = buildTeamCupImportPreview(data, source, mode);
  if (!preview.total) throw new Error("Cole pelo menos um nome.");
  if (preview.overflow) throw new Error(`A lista tem ${preview.total} atletas, mas há somente ${preview.imported} vagas disponíveis. Ajuste a lista antes de aplicar.`);
  if (preview.duplicates) throw new Error("Há nomes repetidos. Diferencie os atletas homônimos antes de aplicar.");
  if (mode === "replace" && !replaceConfirmed) throw new Error("Confirme a substituição de todos os participantes antes de aplicar.");
  return preview.nextData;
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
  if (teamSize(data) === 4 && first !== second && first.athletes[a].gender !== second.athletes[b].gender) throw new Error("Para manter 2 atletas do masculino e 2 do feminino, troque atletas da mesma composição.");
  const firstCaptain = first.captainId === firstId, secondCaptain = second.captainId === secondId;
  [first.athletes[a], second.athletes[b]] = [second.athletes[b], first.athletes[a]];
  if (first !== second) {
    if (firstCaptain) first.captainId = secondId;
    if (secondCaptain) second.captainId = firstId;
  }
  return next;
}
export const teamCupResultsSignature = data => JSON.stringify([data.schedule, data.brackets, data.cupConfig, data.winningScore]);
export function teamCupOrganizationNeedsRegeneration(current, draft) {
  const order = teamCupOrganizationGroups(draft).flatMap(group => group.teamIds);
  return organizationLocked(current) && JSON.stringify(order) !== JSON.stringify(current.players.teams.map(team => team.id));
}
export function applyTeamCupOrganization(current, draft, signature, { regenerateConfirmed = false, resultsSignature } = {}) {
  if (organizationSignature(current) !== signature) throw new Error("A lista foi atualizada enquanto a janela estava aberta. Abra Organizar grupos novamente para não sobrescrever alterações.");
  validateTeamCupTeams(draft);
  if (draft.teamCup.formation === "random" && draft.teamCup.drawStage !== "complete") throw new Error("Sorteie os capitães e depois os integrantes antes de salvar.");
  if (draft.teamCup.kind !== current.teamCup.kind || draft.players.teams.length !== current.players.teams.length
    || current.players.teams.some(t => !draft.players.teams.some(d => d.id === t.id))) throw new Error("A configuração das equipes mudou. Abra Organizar grupos novamente.");
  // Games reference team array indices. Roster edits must keep those slots,
  // including when a draw or draft presents teams in a different order.
  const next = { ...current, players: { ...current.players, teams: current.players.teams.map(t => structuredClone(draft.players.teams.find(d => d.id === t.id))) }, teamCup: structuredClone(draft.teamCup) };
  if (!teamCupOrganizationNeedsRegeneration(current, draft)) return next;
  if (!regenerateConfirmed) throw new Error("Confirme a nova distribuição dos grupos: os confrontos serão refeitos e os placares e eliminatórias atuais serão apagados.");
  if (resultsSignature !== teamCupResultsSignature(current)) throw new Error("Os jogos foram atualizados durante a revisão. Revise e confirme novamente antes de refazer os grupos.");
  const rebuilt = generateTeamCupGroups({ ...next, schedule: [], brackets: [],
    cupConfig: { ...next.cupConfig, tieBreakOverrides: {}, campaignTieBreakOverrides: {} } });
  // New identities prevent old-device scores from attaching to a new matchup.
  const generation = globalThis.crypto.randomUUID();
  rebuilt.schedule = rebuilt.schedule.map(round => round.map(game => ({ ...game, matchKey: `${game.matchKey}_${generation}`,
    teamCupLegs: game.teamCupLegs.map((leg, i) => ({ ...leg, matchKey: `${game.matchKey}_${generation}_leg${i + 1}` })) })));
  return rebuilt;
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
