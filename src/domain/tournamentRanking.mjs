import { resolveBracketGame } from "./bracketProgression.mjs";
import { getCupQualified } from "./cupQualification.mjs";
import { getTeamName } from "./cupGroups.mjs";
import { isCupType, isMixedType } from "./modalityClassification.mjs";
import {
  calculateScheduleRanking,
  calculateTeamGamesRanking,
} from "./rankingCalculation.mjs";
import { defaultRankingCriteria } from "./rankingCriteria.mjs";
import { getWinningScore } from "./scoreRules.mjs";

export function calculateTournamentRanking({
  data,
  config,
  rankingCriteriaValue = defaultRankingCriteria,
  timingComplete = false,
}) {
  const winningScore = getWinningScore(data);

  if (!data?.players) return [];

  if (isCupType(config)) {
    const qualified = getCupQualified(data);
    return [...qualified.main, ...qualified.repechage];
  }

  let names = [];

  if (isMixedType(config)) {
    names = [...data.players.men, ...data.players.women];
  } else if (config?.type === "fixed12" || config?.type === "fixed16" || config?.type === "fixed20" || config?.type === "fixed24") {
    names = data.players.teams.map((team) => `${team.a} + ${team.b}`);
  } else {
    names = data.players;
  }

  return calculateScheduleRanking({
    names,
    schedule: data.schedule || [],
    winningScore,
    timingComplete,
    rankingCriteriaValue,
  });
}

export function calculateCircuitTournamentRankingRows({
  data,
  config,
  rankingCriteriaValue = defaultRankingCriteria,
  timingComplete = false,
}) {
  if (!isCupType(config)) {
    return calculateTournamentRanking({
      data,
      config,
      rankingCriteriaValue,
      timingComplete,
    }).filter((row) => Number(row.played || 0) > 0);
  }

  const teams = Array.isArray(data?.players?.teams) ? data.players.teams : [];
  const mainBracketGames = (data.brackets || []).filter((game) => game.phase === "main");
  const bracketGames = mainBracketGames.map((game) => (
    resolveBracketGame(game, mainBracketGames, data)
  ));
  const games = [...(data.schedule || []).flat(), ...bracketGames];
  const winningScore = getWinningScore(data);

  return calculateTeamGamesRanking({
    names: teams.map((team) => getTeamName(team)),
    games,
    winningScore,
    rankingCriteriaValue,
  });
}
