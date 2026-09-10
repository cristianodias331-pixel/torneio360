import { generateCearenseGroupSchedule } from "./cupGroupSchedule.mjs";
import { createCearenseGroups } from "./cupGroups.mjs";
import { calculateCupGroupRankings } from "./cupGroupRanking.mjs";
import { getReducedRatio } from "./campaignRanking.mjs";
import { getCopinhaManualTieOrder } from "./groupRankingRules.mjs";
import { playRankingMainBracketPlans } from "./cupBracketPlans.mjs";
import { buildCopinhaBracketFromPlan, expandBracketPlanWithVisualByes } from "./cupBracketConstruction.mjs";
import { buildCearenseEliminationRounds } from "./bracketConstruction.mjs";
import { resolveBracketGame } from "./bracketProgression.mjs";
import { getScoreWinnerSide, normalizeScoreInput } from "./scoreRules.mjs";
import { startMatchTimer, stopMatchTimer } from "./matchTimer.mjs";
import { getGameCourtNumber } from "./courtNumbers.mjs";

export const TEAM_CUP_TYPE = "Times/Equipes";
export const TEAM_CUP_GROUP_RANKING_LABEL = "Vitórias → saldo de sets → confronto direto → coeficiente → saldo de games";
export const TEAM_LEVELS = ["Principiante", "Iniciante", "D", "C", "B", "A"];
// Cinco times não permitem exclusivamente grupos de três ou quatro.
export const TEAM_COUNTS = Array.from({ length: 29 }, (_, i) => i + 4).filter(n => n !== 5);
export const isTeamCup = data => data?.cupConfig?.format === "team-cup";
export const teamSize = data => data?.teamCup?.kind === "squad" ? 4 : 3;
export function defaultTeamName(i) {
  return `Time ${i + 1}`;
}
function legacyTeamName(i) {
  let label = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return "Time " + label;
}
export const teamName = (team, i = 0) => typeof team?.name === "string" ? team.name : typeof team?.a === "string" ? team.a : defaultTeamName(i);
export const shuffleTeamCup = (items, rng = Math.random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const blankTeam = (i, size) => ({
  id: `team-${i}`, name: defaultTeamName(i), a: defaultTeamName(i), b: "",
  athletes: Array.from({ length: size }, (_, j) => ({ id: `athlete-${i}-${j}`, name: "", gender: size === 4 ? (j < 2 ? "H" : "M") : "H", level: "" })),
  captainId: `athlete-${i}-0`,
});

export function createTeamCupData(base = {}, count = 6, kind = "trio") {
  return {
    ...base, rankingCriteria: "wins_balance_points",
    cupConfig: { format: "team-cup", teamCount: count, mainBracketName: "Eliminatória Principal", repechageName: "Consolation", repechageEnabled: false, tieBreakOverrides: {}, campaignTieBreakOverrides: {} },
    teamCup: { version: 1, defaultTeamNamesVersion: 2, kind, formation: "fixed", balanced: false, designatedCaptains: false, drawStage: "pending", pool: [] },
    players: { teams: Array.from({ length: count }, (_, i) => blankTeam(i, kind === "squad" ? 4 : 3)) },
    schedule: [], brackets: [], groupsShuffled: false,
  };
}

export function teamCupFormatChangeNeedsConfirmation(data, count, kind) {
  if (count === data.players.teams.length && kind === data.teamCup.kind) return false;
  const removesSlots = count < data.players.teams.length || (kind === "trio" && teamSize(data) === 4);
  return Boolean(data.schedule.length || data.brackets.length
    || (removesSlots && [...data.teamCup.pool, ...data.players.teams.flatMap(t => t.athletes)].some(a => a.name.trim())));
}

// Use the existing regeneration confirmation, then keep registrations that fit
// the new format instead of recreating the entire competition from scratch.
export function reconfigureTeamCup(data, count, kind, { confirmed = false } = {}) {
  if (!TEAM_COUNTS.includes(count) || !["trio", "squad"].includes(kind)) throw new Error("Escolha uma configuração válida de equipes.");
  if (count === data.players.teams.length && kind === data.teamCup.kind) return data;
  if (teamCupFormatChangeNeedsConfirmation(data, count, kind) && !confirmed) throw new Error("Confirme a alteração do formato antes de substituir os jogos ou reduzir as vagas.");
  const size = kind === "squad" ? 4 : 3;
  const existing = [...data.players.teams].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  const usedTeamIds = new Set(existing.map(t => t.id));
  const usedAthleteIds = new Set([...data.teamCup.pool, ...existing.flatMap(t => t.athletes)].map(a => a.id));
  const teams = Array.from({ length: count }, (_, i) => {
    let number = i;
    while (!existing[i] && usedTeamIds.has(`team-${number}`)) number++;
    const template = blankTeam(number, size), previous = existing[i];
    usedTeamIds.add(template.id);
    const athletes = Array.from({ length: size }, (_, j) => {
      if (previous?.athletes[j]) return structuredClone(previous.athletes[j]);
      const athlete = { ...template.athletes[j] };
      if (usedAthleteIds.has(athlete.id)) athlete.id = `athlete-${globalThis.crypto.randomUUID()}`;
      usedAthleteIds.add(athlete.id);
      return athlete;
    });
    return { ...(previous || template), athletes,
      captainId: athletes.some(a => a.id === previous?.captainId) ? previous.captainId : athletes[0].id };
  });
  const { groupOrder, groupMode, drawVideo, groupVideo, ...settings } = data.teamCup;
  return { ...data, players: { ...data.players, teams }, schedule: [], brackets: [], groupsShuffled: false,
    teamCup: { ...settings, kind, drawStage: "pending", pool: structuredClone(teams.flatMap(t => t.athletes)) },
    cupConfig: { ...data.cupConfig, teamCount: count, tieBreakOverrides: {}, campaignTieBreakOverrides: {} } };
}

export function normalizeTeamCupData(data, defaults) {
  const cup = { ...defaults.cupConfig, ...data.cupConfig, format: "team-cup" };
  const settings = { ...defaults.teamCup, ...data.teamCup, defaultTeamNamesVersion: 2 };
  const teams = Array.isArray(data.players?.teams) ? data.players.teams : defaults.players.teams;
  const upgradeNames = data.teamCup?.defaultTeamNamesVersion !== 2;
  const displayName = (team, fallbackIndex) => {
    const index = /^team-\d+$/.test(team.id) ? Number(team.id.slice(5)) : fallbackIndex;
    const name = teamName(team, index);
    return upgradeNames && name === legacyTeamName(index) ? defaultTeamName(index) : name;
  };
  // Upgrade only the old default labels, once. Custom names remain editable,
  // and draw receipts keep matching the same unchanged team identities.
  const receiptTeam = (team, i) => ({ ...team, name: displayName(team, i) });
  if (upgradeNames && settings.drawVideo) settings.drawVideo = { ...settings.drawVideo,
    ...(settings.drawVideo.captains ? { captains: settings.drawVideo.captains.map(receiptTeam) } : {}),
    ...(settings.drawVideo.teams ? { teams: settings.drawVideo.teams.map(receiptTeam) } : {}) };
  if (upgradeNames && settings.groupVideo) settings.groupVideo = { ...settings.groupVideo,
    groups: settings.groupVideo.groups.map(group => ({ ...group, teams: group.teams.map(receiptTeam) })) };
  // Never truncate saved rosters, scores or captains during hydration.
  return { ...data, cupConfig: cup, teamCup: settings,
    players: { ...data.players, teams: teams.map((team, i) => ({ ...team, name: displayName(team, i), a: displayName(team, i), b: "", athletes: Array.isArray(team.athletes) ? team.athletes : [] })) },
    schedule: (data.schedule || []).map(round => round.map(game => summarizeTeamMatch(game, data.winningScore))),
    brackets: (data.brackets || []).map(game => summarizeTeamMatch(game, data.winningScore)),
  };
}

export function setTeamCupFormation(data, formation) {
  if (!["fixed", "random"].includes(formation)) throw new Error("Escolha uma formação válida.");
  if (formation === data.teamCup.formation) return data;
  const pool = structuredClone(data.teamCup.formation === "random" && data.teamCup.drawStage !== "complete"
    ? data.teamCup.pool : data.players.teams.flatMap(t => t.athletes));
  const teams = data.players.teams.map((team, i) => {
    const athletes = team.athletes.length === teamSize(data) ? structuredClone(team.athletes) : pool.slice(i * teamSize(data), (i + 1) * teamSize(data));
    return { ...team, athletes, captainId: athletes.some(a => a.id === team.captainId) ? team.captainId : athletes[0]?.id };
  });
  // Selecting a method does not redraw teams or erase results. New draws are
  // staged in Participants > Organize groups, as with existing team edits.
  const drawStage = formation === "random" && (data.schedule.length || data.brackets.length) ? "complete" : "pending";
  return { ...data, players: { ...data.players, teams }, teamCup: { ...data.teamCup, formation, pool, drawStage } };
}

export function teamLegWinner(leg, target = 4) {
  if (!leg || [leg.s1, leg.s2].some(v => v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < 0)) return null;
  return getScoreWinnerSide(leg, target);
}

export function teamMatchState(game, target = 4) {
  const legs = game.teamCupLegs || [];
  const first = legs.slice(0, 2).map(leg => teamLegWinner(leg, target));
  const decider = Boolean(first[0] && first[1] && first[0] !== first[1]);
  const winners = [...first, decider ? teamLegWinner(legs[2], target) : null];
  const wins = [winners.filter(w => w === "team1").length, winners.filter(w => w === "team2").length];
  return { decider, winners, wins, winner: wins[0] === 2 ? "team1" : wins[1] === 2 ? "team2" : null };
}

export function summarizeTeamMatch(game, target = 4) {
  if (!Array.isArray(game.teamCupLegs)) return game;
  const state = teamMatchState(game, target);
  const sums = [0, 0];
  game.teamCupLegs.forEach((leg, i) => { if (state.winners[i]) { sums[0] += Number(leg.s1); sums[1] += Number(leg.s2); } });
  return { ...game, s1: state.winner ? String(sums[0]) : "", s2: state.winner ? String(sums[1]) : "" };
}

export function makeTeamMatch(game) {
  return { ...game, teamCupLegs: Array.from({ length: 3 }, (_, i) => ({ matchKey: `${game.matchKey}_leg${i + 1}`, s1: "", s2: "", court: game.court || 1, courtNumberOverride: "", inProgress: false })) };
}

export function teamCupCourtNumber(data, game, index, courtNumbers = data.courtNumbers || []) {
  const leg = game?.teamCupLegs?.[index];
  // Old matches stored court=1 on every leg. The parent game retains the
  // original court assignment, while an explicit leg override always wins.
  return getGameCourtNumber({ ...leg, court: game?.court || leg?.court || 1 }, courtNumbers || []);
}
export const teamCupGames = data => [...(data.schedule || []).flat(), ...(data.brackets || [])];
export const hasTeamCupActivity = data => teamCupGames(data).some(game => game.teamCupLegs?.some(leg => leg.s1 !== "" || leg.s2 !== "" || leg.matchTimerFirstStartedAt));

function validateAthletes(athletes, balanced) {
  const names = athletes.map(a => String(a.name || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  if (names.some(n => !n)) throw new Error("Preencha o nome de todos os atletas.");
  if (new Set(names).size !== names.length) throw new Error("Há nomes repetidos. Diferencie os atletas homônimos.");
  if (new Set(athletes.map(a => a.id)).size !== athletes.length) throw new Error("Um atleta aparece em mais de uma equipe.");
  if (athletes.some(a => !["H", "M"].includes(a.gender))) throw new Error("Informe Masculino ou Feminino para cada atleta.");
  if (balanced && athletes.some(a => !TEAM_LEVELS.includes(a.level))) throw new Error("Informe o nível de todos os atletas para equilibrar o sorteio.");
}
export function validateTeamCupTeams(data) {
  const teams = data.players.teams;
  if (!TEAM_COUNTS.includes(teams.length)) throw new Error("Escolha 4 ou de 6 a 32 equipes.");
  if (teams.some(t => !String(t.name || "").trim())) throw new Error("Informe o nome das equipes.");
  if (new Set(teams.map(t => t.name.trim().toLowerCase())).size !== teams.length) throw new Error("Use nomes diferentes para as equipes.");
  if (teams.some(t => t.athletes.length !== teamSize(data))) throw new Error("Complete todos os integrantes de cada equipe.");
  validateAthletes(teams.flatMap(t => t.athletes), false);
  if (teams.some(t => !t.athletes.some(a => a.id === t.captainId))) throw new Error("Defina um capitão ou uma capitã por equipe.");
  if (teamSize(data) === 4 && teams.some(t => t.athletes.filter(a => a.gender === "H").length !== 2)) throw new Error("Cada Squad precisa de 2 atletas do masculino e 2 do feminino.");
  return true;
}

export function drawTeamCaptains(data, rng = Math.random) {
  if (data.schedule.length) throw new Error("As equipes estão vinculadas aos jogos; o sorteio não pode ser refeito.");
  if (data.teamCup.drawStage !== "pending") throw new Error("Os capitães já foram sorteados.");
  const { pool, designatedCaptains, balanced } = data.teamCup;
  const count = data.players.teams.length;
  if (pool.length !== count * teamSize(data)) throw new Error("A quantidade de atletas precisa completar todas as equipes.");
  validateAthletes(pool, balanced);
  if (teamSize(data) === 4 && pool.filter(a => a.gender === "H").length !== count * 2) throw new Error("O sorteio de Squad exige 2 atletas do masculino e 2 do feminino por equipe.");
  const candidates = designatedCaptains ? pool.filter(a => a.captainCandidate) : pool;
  if (designatedCaptains && candidates.length !== count) throw new Error(`Marque exatamente ${count} capitães antes de sortear.`);
  const captains = shuffleTeamCup(candidates, rng).slice(0, count);
  return { ...data, teamCup: { ...data.teamCup, drawStage: "captains" }, players: { ...data.players,
    teams: data.players.teams.map((team, i) => ({ ...team, captainId: captains[i].id, athletes: [{ ...captains[i] }] })) } };
}

export function drawTeamMembers(data, rng = Math.random) {
  if (data.schedule.length || data.teamCup.drawStage !== "captains") throw new Error("Sorteie primeiro os capitães.");
  const teams = structuredClone(data.players.teams);
  const captainIds = new Set(teams.map(t => t.captainId));
  const members = shuffleTeamCup(data.teamCup.pool.filter(a => !captainIds.has(a.id)), rng);
  const strength = a => TEAM_LEVELS.indexOf(a.level) + 1;
  const total = t => t.athletes.reduce((sum, a) => sum + strength(a), 0);
  if (data.teamCup.balanced) members.sort((a, b) => strength(b) - strength(a));
  for (const athlete of members) {
    const options = shuffleTeamCup(teams.filter(t => t.athletes.length < teamSize(data)
      && (teamSize(data) !== 4 || t.athletes.filter(a => a.gender === athlete.gender).length < 2)), rng);
    if (data.teamCup.balanced) options.sort((a, b) => total(a) - total(b));
    if (!options.length) throw new Error("Não foi possível completar o sorteio com essa composição.");
    options[0].athletes.push({ ...athlete });
  }
  // Improve total-level balance without moving captains or changing gender slots.
  if (data.teamCup.balanced) {
    for (let pass = 0; pass < 100; pass++) {
      let improved = false;
      for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
        for (let a = 1; a < teams[i].athletes.length; a++) for (let b = 1; b < teams[j].athletes.length; b++) {
          const x = teams[i].athletes[a], y = teams[j].athletes[b];
          if (teamSize(data) === 4 && x.gender !== y.gender) continue;
          const diff = total(teams[i]) - total(teams[j]), change = strength(y) - strength(x);
          if (Math.abs(diff + 2 * change) < Math.abs(diff)) {
            [teams[i].athletes[a], teams[j].athletes[b]] = [y, x]; improved = true;
          }
        }
      }
      if (!improved) break;
    }
  }
  const next = { ...data, teamCup: { ...data.teamCup, drawStage: "complete" }, players: { ...data.players, teams } };
  validateTeamCupTeams(next);
  return next;
}

export function generateTeamCupGroups(data, rng = Math.random) {
  if (data.schedule.length || data.brackets.length) throw new Error("Os grupos já foram gerados. Jogos existentes serão preservados.");
  validateTeamCupTeams(data);
  const order = data.teamCup.groupOrder;
  const byId = new Map(data.players.teams.map(team => [team.id, team]));
  if (order && (!Array.isArray(order) || order.length !== byId.size || new Set(order).size !== byId.size || order.some(id => !byId.has(id)))) throw new Error("Revise a formação dos grupos antes de gerar os confrontos.");
  const teams = order ? order.map(id => byId.get(id)) : shuffleTeamCup(data.players.teams, rng);
  const next = { ...data, groupsShuffled: true, players: { ...data.players, teams }, cupConfig: { ...data.cupConfig, teamCount: teams.length } };
  next.schedule = generateCearenseGroupSchedule(next.players, next.cupConfig).map(round => round.map(game => makeTeamMatch({ ...game, matchKey: `teams_group_${game.groupId}_${game.ids1[0]}_${game.ids2[0]}` })));
  return next;
}

// Reuse Torneio 360 ranking/seeding only through this explicit adapter.
// Other cup formats never enter the new rules.
export function teamCupRankingData(data) {
  return { ...data, cupConfig: { ...data.cupConfig, format: "playranking", playRankingBracketVersion: 4 },
    schedule: data.schedule.map(round => round.map(game => summarizeTeamMatch(game, data.winningScore))) };
}
export function rankTeamCupRows(rows, games, target, storedOrder) {
  const primary = (a, b) => b.w - a.w || (b.setBalance || 0) - (a.setBalance || 0);
  const secondary = (a, b) => compareTeamCupCoefficient(a, b) || b.bal - a.bal;
  const ordered = [...rows].sort((a, b) => primary(a, b) || secondary(a, b) || a.name.localeCompare(b.name));
  const complete = games.length > 0 && games.length === rows.length * (rows.length - 1) / 2
    && games.every(g => teamMatchState(g, target).winner);
  if (!complete) return { rows: ordered, unresolvedTieIds: [] };
  const result = [], unresolvedTieIds = [];
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && primary(ordered[start], ordered[end]) === 0) end++;
    const tied = ordered.slice(start, end);
    const directWins = new Map(tied.map(row => [row.id, 0]));
    for (const game of games) {
      if (!directWins.has(game.ids1[0]) || !directWins.has(game.ids2[0])) continue;
      const winner = teamMatchState(game, target).winner;
      const id = winner === "team1" ? game.ids1[0] : game.ids2[0];
      directWins.set(id, directWins.get(id) + 1);
    }
    // A circular head-to-head tie falls through to coefficient, then games balance.
    tied.sort((a, b) => directWins.get(b.id) - directWins.get(a.id) || secondary(a, b) || a.name.localeCompare(b.name));
    for (let i = 0; i < tied.length;) {
      let j = i + 1;
      while (j < tied.length && directWins.get(tied[j].id) === directWins.get(tied[i].id)
        && secondary(tied[i], tied[j]) === 0) j++;
      const remaining = tied.slice(i, j), order = getCopinhaManualTieOrder(remaining, storedOrder);
      if (remaining.length > 1 && !order) unresolvedTieIds.push(...remaining.map(r => r.id));
      result.push(...(order ? remaining.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : remaining));
      i = j;
    }
    start = end;
  }
  return { rows: result, unresolvedTieIds };
}
export function teamCupRankings(data) {
  return calculateCupGroupRankings(teamCupRankingData(data)).map(group => {
    const games = data.schedule.flat().filter(g => g.groupId === group.id);
    const rows = group.rows.map(row => ({ ...row, setsWon: 0, setsLost: 0, setBalance: 0 }));
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const game of games) {
      const state = teamMatchState(game, data.winningScore);
      if (!state.winner) continue;
      for (const side of [0, 1]) {
        const row = byId.get(game["ids" + (side + 1)][0]);
        row.setsWon += state.wins[side];
        row.setsLost += state.wins[1 - side];
        row.setBalance = row.setsWon - row.setsLost;
      }
    }
    return { ...group, ...rankTeamCupRows(rows, games, data.winningScore, data.cupConfig.tieBreakOverrides?.[String(group.id)]) };
  });
}
function compareTeamCupCoefficient(a, b) {
  const difference = Number(b.coefficient || 0) - Number(a.coefficient || 0);
  return Math.abs(difference) < 1e-12 ? 0 : difference;
}
export function rankTeamCupCampaignEntries(entries, storedOverrides = {}, scope = "campeoes") {
  const compare = (a, b) => {
    const playedA = Math.max(1, Number(a.played) || 0), playedB = Math.max(1, Number(b.played) || 0);
    const proportional = key => Number(b[key] || 0) * playedA - Number(a[key] || 0) * playedB;
    return proportional("w") || proportional("setBalance") || compareTeamCupCoefficient(a, b) || proportional("bal");
  };
  // Different groups have no head-to-head result. Normalize totals so a group
  // of four does not gain an extra match's worth of wins, sets or games balance.
  const ordered = [...entries].sort((a, b) => compare(a, b)
    || (a.groupId === b.groupId ? a.groupPosition - b.groupPosition : a.name.localeCompare(b.name)));
  const rows = [], unresolvedTies = [];
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && compare(ordered[start], ordered[end]) === 0) end++;
    const tied = ordered.slice(start, end), row = tied[0];
    if (tied.length > 1 && new Set(tied.map(entry => entry.groupId)).size > 1) {
      const tieKey = `team-cup-sets-v1:${scope}:${getReducedRatio(row.w, row.played)}:${getReducedRatio(row.setBalance, row.played)}:${Number(row.coefficient || 0).toFixed(12)}:${getReducedRatio(row.bal, row.played)}`;
      const order = getCopinhaManualTieOrder(tied, storedOverrides[tieKey]);
      if (order) tied.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      else unresolvedTies.push({ tieKey, scope, teamIds: tied.map(entry => entry.id), rows: tied });
    }
    rows.push(...tied);
    start = end;
  }
  return { rows, unresolvedTies };
}
export function teamCupQualified(data) {
  const groups = teamCupRankings(data);
  const overrides = data.cupConfig.campaignTieBreakOverrides || {};
  const champions = rankTeamCupCampaignEntries(groups.map(g => ({ ...g.rows[0], groupPosition: 1 })), overrides, "campeoes");
  const groupRank = new Map(champions.rows.map((r, i) => [r.groupId, i + 1]));
  const runners = groups.map(g => ({ ...g.rows[1], groupPosition: 2, groupRank: groupRank.get(g.id) }));
  const eliminated = rankTeamCupCampaignEntries(groups.flatMap(g => g.rows.slice(2).map((r, i) => ({ ...r, groupPosition: i + 3 }))), overrides, "paralela");
  return { main: [...champions.rows.map((r, i) => ({ ...r, groupRank: i + 1 })), ...runners],
    repechage: eliminated.rows.map((r, i) => ({ ...r, groupRank: i + 1 })),
    unresolvedCampaignTies: [...champions.unresolvedTies, ...eliminated.unresolvedTies] };
}

export function generateTeamCupBrackets(data) {
  if (data.brackets.length) throw new Error("As eliminatórias já foram geradas.");
  if (!data.schedule.length || !data.schedule.flat().every(g => teamMatchState(g, data.winningScore).winner)) throw new Error("Conclua todos os confrontos dos grupos.");
  if (teamCupRankings(data).some(g => g.unresolvedTieIds.length)) throw new Error("Resolva os empates dos grupos antes de gerar as eliminatórias.");
  const qualified = teamCupQualified(data);
  const ties = qualified.unresolvedCampaignTies;
  if (ties.length) throw new Error("Resolva os empates de campanha antes de gerar as eliminatórias.");
  const count = createCearenseGroups(data.players.teams.length).length;
  const plan = playRankingMainBracketPlans[count];
  const main = plan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", data.cupConfig.mainBracketName, expandBracketPlanWithVisualByes(plan))
    : buildCearenseEliminationRounds(qualified.main, "main", data.cupConfig.mainBracketName, true);
  const consolation = buildCearenseEliminationRounds(qualified.repechage, "repechage", data.cupConfig.repechageName, false);
  const brackets = [...main, ...consolation].flatMap(round => round.games.map(game => makeTeamMatch({ ...game, roundName: round.title })));
  const next = { ...data, brackets };
  next.brackets = brackets.map(game => resolveBracketGame(game, brackets, next));
  return next;
}

// Visibility is independent from bracket creation. Never discard an existing
// branch (including scores) when the organizer temporarily hides it.
export function setTeamCupConsolationEnabled(data, enabled) {
  let next = { ...data, cupConfig: { ...data.cupConfig, repechageEnabled: Boolean(enabled) } };
  if (next.brackets.length && !next.brackets.some(g => g.phase === "repechage")) {
    // Older local tournaments may have generated only the main bracket.
    const qualified = teamCupQualified(next);
    if (!qualified.unresolvedCampaignTies.some(t => t.scope === "paralela")) {
      const rounds = buildCearenseEliminationRounds(qualified.repechage, "repechage", next.cupConfig.repechageName, false);
      const added = rounds.flatMap(r => r.games.map(g => makeTeamMatch({ ...g, roundName: r.title })));
      const brackets = [...next.brackets, ...added];
      next = { ...next, brackets: [...next.brackets, ...added.map(g => resolveBracketGame(g, brackets, next))] };
    }
  }
  return next;
}

export function resolveTeamCupGame(data, game) {
  return game.phase === "groups" ? game : resolveBracketGame(game, data.brackets, data);
}
export function teamLegAvailable(data, game, index) {
  if (game.isBye || !game.ids1?.length || !game.ids2?.length) return false;
  const state = teamMatchState(game, data.winningScore);
  if (index === 2) return state.decider;
  return index === 0 || teamSize(data) === 4 || Boolean(state.winners[0]);
}

export function updateTeamCupLeg(data, key, index, patch, now = Date.now()) {
  const next = structuredClone(data);
  const game = teamCupGames(next).find(g => g.matchKey === key);
  if (!game) throw new Error("Confronto não encontrado.");
  const resolved = resolveTeamCupGame(next, game);
  if (!teamLegAvailable(next, resolved, index)) throw new Error("Este set ainda não está liberado.");
  if (game.phase === "groups" && next.brackets.length && ("s1" in patch || "s2" in patch)) throw new Error("Os grupos já definiram as eliminatórias. Seus placares estão protegidos.");
  const leg = game.teamCupLegs[index];
  const scoreEdit = "s1" in patch || "s2" in patch;
  const wasFinished = teamLegWinner(leg, data.winningScore);
  if (scoreEdit) {
    for (const side of ["s1", "s2"]) if (side in patch) patch = { ...patch, [side]: normalizeScoreInput(patch[side], data.winningScore) };
  }
  if (patch.inProgress === true || ("courtNumberOverride" in patch && leg.inProgress)) {
    if (wasFinished) throw new Error("O set já foi finalizado.");
    const court = String(patch.courtNumberOverride || teamCupCourtNumber(next, game, index));
    patch = { ...patch, courtNumberOverride: court };
    for (const other of teamCupGames(next)) {
      const otherResolved = resolveTeamCupGame(next, other);
      for (const [i, active] of (other.teamCupLegs || []).entries()) {
        if ((other.matchKey === key && i === index) || !active.inProgress || teamLegWinner(active, next.winningScore)) continue;
        if (teamCupCourtNumber(next, other, i) === court) throw new Error("Esta quadra já está em uso.");
        const sameTeam = [...resolved.ids1, ...resolved.ids2].some(id => [...(otherResolved.ids1 || []), ...(otherResolved.ids2 || [])].includes(id));
        if (sameTeam && (other.matchKey !== key || teamSize(data) === 3 || index === 2 || i === 2)) throw new Error("Uma das equipes já está jogando.");
      }
    }
  }
  // Capture elapsed time while inProgress is still true, before pausing.
  if (patch.inProgress === false) stopMatchTimer(leg, { now });
  Object.assign(leg, patch);
  if (scoreEdit || patch.inProgress === true) leg.teamCupSides = [resolved.ids1[0], resolved.ids2[0]];
  if (patch.inProgress === true) startMatchTimer(leg, now);
  const finished = teamLegWinner(leg, data.winningScore);
  if (finished && (scoreEdit || leg.inProgress)) { stopMatchTimer(leg, { finished: true, now }); leg.inProgress = false; }
  else if (scoreEdit && wasFinished && !finished) { delete leg.matchTimerFinishedAt; }
  const state = teamMatchState(game, data.winningScore);
  const third = game.teamCupLegs[2];
  if (!state.decider && (third.s1 !== "" || third.s2 !== "" || third.matchTimerFirstStartedAt)) throw new Error("Essa correção invalidaria o terceiro set já registrado. Nenhum dado foi apagado.");
  Object.assign(game, summarizeTeamMatch(game, next.winningScore));
  // A changed upstream winner must never transfer a played score to new opponents.
  for (const stored of next.brackets) {
    const old = data.brackets.find(g => g.matchKey === stored.matchKey);
    const current = resolveTeamCupGame(next, stored);
    const before = old && resolveTeamCupGame(data, old);
    if (before && JSON.stringify([before.ids1, before.ids2]) !== JSON.stringify([current.ids1, current.ids2])
      && stored.teamCupLegs.some(l => l.s1 !== "" || l.s2 !== "" || l.matchTimerFirstStartedAt)) throw new Error("Essa correção mudaria os times de uma partida já registrada. Nenhum dado foi apagado.");
    Object.assign(stored, current);
  }
  validateTeamCupMatchState(next);
  return next;
}

export function validateTeamCupMatchState(data) {
  const activeCourts = new Set();
  const activeTeams = new Map();
  for (const stored of teamCupGames(data)) {
    const game = resolveTeamCupGame(data, stored), state = teamMatchState(game, data.winningScore);
    for (const [i, leg] of (game.teamCupLegs || []).entries()) {
      const used = leg.s1 !== "" || leg.s2 !== "" || leg.matchTimerFirstStartedAt;
      if (used && leg.teamCupSides && JSON.stringify(leg.teamCupSides) !== JSON.stringify([game.ids1[0], game.ids2[0]]))
        throw new Error("Times/Equipes: os adversários foram alterados durante o registro dos placares.");
      if (used && i === 2 && !state.decider) throw new Error("Times/Equipes: o desempate registrado ficou incompatível com os dois primeiros sets.");
      if (used && i === 1 && teamSize(data) === 3 && !state.winners[0]) throw new Error("Times/Equipes: o primeiro set precisa estar concluído.");
      if (leg.inProgress && !teamLegWinner(leg, data.winningScore)) {
        if (activeCourts.has(leg.courtNumberOverride)) throw new Error("Times/Equipes: dois aparelhos iniciaram sets na mesma quadra.");
        activeCourts.add(leg.courtNumberOverride);
        for (const id of [...game.ids1, ...game.ids2]) {
          const previous = activeTeams.get(id);
          if (previous && (previous.key !== game.matchKey || teamSize(data) !== 4 || i === 2 || previous.index === 2))
            throw new Error("Times/Equipes: uma equipe foi iniciada em confrontos simultâneos.");
          activeTeams.set(id, { key: game.matchKey, index: i });
        }
      }
    }
  }
  return true;
}
