import { resolveBracketGame } from "./bracketProgression.mjs";
import {
  getCircuitCupPlacementKey,
  getCircuitPlacementLabel,
  normalizeCircuitRankingSettings,
} from "./circuitRankingSettings.mjs";
import { getTeamName } from "./cupGroups.mjs";
import { isCupType, isMixedType } from "./modalityClassification.mjs";
import { defaultRankingCriteria } from "./rankingCriteria.mjs";
import { getScoreWinnerSide, getWinningScore } from "./scoreRules.mjs";
import { calculateCircuitTournamentRankingRows } from "./tournamentRanking.mjs";
import {
  participantGenderValues,
  resolveTournamentParticipantGender,
} from "./participantGenderRegistry.mjs";

function resolveCircuitGenderGroup({ tournament, settings, name, fallbackGender }) {
  if (normalizeCircuitRankingSettings(settings).rankingDivision !== "gender") return "geral";
  const gender = resolveTournamentParticipantGender({ tournament, settings, name, fallbackGender });
  return gender === participantGenderValues.masculine || gender === participantGenderValues.feminine
    ? gender
    : "geral";
}

export function isCompletedCircuitGame(game, data) {
  const resolved = resolveBracketGame(game, data?.brackets || [], data || {});
  return Boolean(getScoreWinnerSide(resolved, getWinningScore(data || {})));
}

export function calculateCupPlacementRows({
  tournament,
  settings,
  config,
  timingComplete = false,
}) {
  const data = tournament?.data || {};
  const teams = Array.isArray(data.players?.teams) ? data.players.teams : [];
  const mainGames = (data.brackets || []).filter((game) => game.phase === "main");
  const finalGame = mainGames.find((game) => game.roundName === "Final");
  if (!finalGame || !isCompletedCircuitGame(finalGame, data)) return [];

  const outcomes = new Map(teams.map((_, id) => [id, "groupStage"]));
  const resolvedFinal = resolveBracketGame(finalGame, mainGames, data);
  const finalWinnerSide = getScoreWinnerSide(resolvedFinal, getWinningScore(data));
  const championId = finalWinnerSide === "team1" ? resolvedFinal.ids1?.[0] : resolvedFinal.ids2?.[0];
  const runnerUpId = finalWinnerSide === "team1" ? resolvedFinal.ids2?.[0] : resolvedFinal.ids1?.[0];
  if (Number.isInteger(championId)) outcomes.set(championId, "champion");
  if (Number.isInteger(runnerUpId)) outcomes.set(runnerUpId, "runnerUp");

  mainGames.forEach((game) => {
    if (game.roundName === "Final" || String(game.roundName || "").includes("3º")) return;
    const resolved = resolveBracketGame(game, mainGames, data);
    const winnerSide = getScoreWinnerSide(resolved, getWinningScore(data));
    if (!winnerSide) return;
    const loserId = winnerSide === "team1" ? resolved.ids2?.[0] : resolved.ids1?.[0];
    if (Number.isInteger(loserId) && !["champion", "runnerUp"].includes(outcomes.get(loserId))) {
      outcomes.set(loserId, getCircuitCupPlacementKey(game.roundName));
    }
  });

  const performanceById = new Map(
    calculateCircuitTournamentRankingRows({
      data,
      config,
      rankingCriteriaValue: data.rankingCriteria || defaultRankingCriteria,
      timingComplete,
    }).map((row) => [row.id, row])
  );
  const normalizedSettings = normalizeCircuitRankingSettings(settings);

  return teams.flatMap((team, id) => {
    const placementKey = outcomes.get(id) || "groupStage";
    const performance = performanceById.get(id) || { w: 0, pts: 0, bal: 0, played: 0 };
    const points = normalizedSettings.points.cup[placementKey] || 0;
    const base = {
      id,
      name: getTeamName(team),
      circuitPoints: points,
      placementKey,
      placementLabel: getCircuitPlacementLabel(placementKey),
      titles: placementKey === "champion" ? 1 : 0,
      runnerUps: placementKey === "runnerUp" ? 1 : 0,
      thirdPlaces: placementKey === "third" ? 1 : 0,
      w: Number(performance.w || 0),
      pts: Number(performance.pts || 0),
      bal: Number(performance.bal || 0),
      played: Number(performance.played || 0),
    };

    if (normalizedSettings.identity === "team") return [base];
    return [team?.a, team?.b].filter(Boolean).map((name, athleteIndex) => ({
      ...base,
      id: `${id}:${athleteIndex}`,
      name,
      groupKey: resolveCircuitGenderGroup({
        tournament,
        settings: normalizedSettings,
        name,
        fallbackGender: participantGenderValues.unknown,
      }),
    }));
  });
}

export function calculateRankPlacementRows({
  tournament,
  settings,
  config,
  timingComplete = false,
}) {
  const data = tournament?.data || {};
  const normalizedSettings = normalizeCircuitRankingSettings(settings);
  const rows = calculateCircuitTournamentRankingRows({
    data,
    config,
    rankingCriteriaValue: data.rankingCriteria || defaultRankingCriteria,
    timingComplete,
  });
  const separated = isMixedType(config);
  const groupedRows = new Map();

  rows.forEach((row) => {
    const groupKey = separated ? (Number(row.id) < Number(config.men || 0) ? "masculino" : "feminino") : "geral";
    if (!groupedRows.has(groupKey)) groupedRows.set(groupKey, []);
    groupedRows.get(groupKey).push(row);
  });

  return Array.from(groupedRows.entries()).flatMap(([groupKey, groupRows]) => groupRows.flatMap((row, index) => {
    const position = index + 1;
    const points = index < normalizedSettings.points.positions.length
      ? normalizedSettings.points.positions[index]
      : normalizedSettings.points.otherPositions;
    const base = {
      ...row,
      groupKey: normalizedSettings.rankingDivision === "gender"
        ? resolveCircuitGenderGroup({
          tournament,
          settings: normalizedSettings,
          name: row.name,
          fallbackGender: groupKey,
        })
        : groupKey,
      circuitPoints: points,
      placementKey: `position${position}`,
      placementLabel: getCircuitPlacementLabel("", position),
      titles: position === 1 ? 1 : 0,
      runnerUps: position === 2 ? 1 : 0,
      thirdPlaces: position === 3 ? 1 : 0,
    };

    const isFixedTeam = config?.type === "fixed12" || config?.type === "fixed16" || config?.type === "fixed20" || config?.type === "fixed24";
    if (!isFixedTeam || normalizedSettings.identity === "team") return [base];
    const team = data.players?.teams?.[row.id];
    return [team?.a, team?.b].filter(Boolean).map((name, athleteIndex) => ({
      ...base,
      id: `${row.id}:${athleteIndex}`,
      name,
      groupKey: normalizedSettings.rankingDivision === "gender"
        ? resolveCircuitGenderGroup({
          tournament,
          settings: normalizedSettings,
          name,
          fallbackGender: participantGenderValues.unknown,
        })
        : base.groupKey,
    }));
  }));
}

export function calculateCircuitPlacementRowsByConfig({
  tournament,
  settings,
  config,
  timingComplete = false,
}) {
  return isCupType(config)
    ? calculateCupPlacementRows({ tournament, settings, config, timingComplete })
    : calculateRankPlacementRows({ tournament, settings, config, timingComplete });
}
