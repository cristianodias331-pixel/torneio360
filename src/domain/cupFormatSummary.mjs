import { getEliminationRoundName, getNextPowerOfTwo } from "./bracketBasics.mjs";
import { getCearenseThirdParallelSources } from "./cearenseThirdParallel.mjs";
import { expandBracketPlanWithVisualByes } from "./cupBracketConstruction.mjs";
import { cearenseMainBracketPlans } from "./cupBracketPlans.mjs";
import { isCearenseData, isCopinhaData } from "./cupFormat.mjs";
import { createCearenseGroups, describeCearenseGroupSizes } from "./cupGroups.mjs";

export function getCearenseFormatSummary(
  teamCount,
  playRanking = false,
  individual = false,
  groupFormation = "automatic",
) {
  const safeTeamCount = Math.max(4, Math.min(32, Number(teamCount) || 4));
  const groups = createCearenseGroups(safeTeamCount, groupFormation);
  const groupSizes = groups.map((group) => group.teamIds.length);
  const gamesPerTeam = [...new Set(groupSizes.map((size) => size - 1))].sort((a, b) => a - b);
  const groupMatches = groupSizes.reduce((total, size) => total + (size * (size - 1)) / 2, 0);
  const mainCount = groups.length * 2;
  const initialParallelCount = safeTeamCount - mainCount;
  const mainBracketSize = getNextPowerOfTwo(mainCount);
  const mainByes = mainBracketSize - mainCount;
  const openingMainGames = mainCount - mainBracketSize / 2;
  const transferredCount = playRanking ? openingMainGames : 0;
  const finalParallelCount = initialParallelCount + transferredCount;
  const parallelBracketSize = finalParallelCount >= 2 ? getNextPowerOfTwo(finalParallelCount) : finalParallelCount;
  const parallelByes = Math.max(0, parallelBracketSize - finalParallelCount);
  const thirdParallelPlan = cearenseMainBracketPlans[groups.length];
  const thirdParallelSources = thirdParallelPlan
    ? getCearenseThirdParallelSources(expandBracketPlanWithVisualByes(thirdParallelPlan))
    : { sections: [], games: [] };
  const thirdParallelEligibleCount = thirdParallelSources.games.length;
  const thirdParallelBracketSize = thirdParallelEligibleCount >= 2
    ? getNextPowerOfTwo(thirdParallelEligibleCount)
    : thirdParallelEligibleCount;
  const thirdParallelSourceRounds = thirdParallelSources.sections.map((section) => section.round.title);
  const thirdParallel = {
    eligibleCount: thirdParallelEligibleCount,
    sourceRound: thirdParallelSourceRounds.join(" e "),
    sourceRounds: thirdParallelSourceRounds,
    openingRound: thirdParallelEligibleCount >= 2
      ? getEliminationRoundName(thirdParallelBracketSize)
      : "Não formada",
    bracketSize: thirdParallelBracketSize,
    byeCount: Math.max(0, thirdParallelBracketSize - thirdParallelEligibleCount),
    matchCount: Math.max(0, thirdParallelEligibleCount - 1),
  };

  return {
    teamCount: safeTeamCount,
    groupCount: groups.length,
    groupDescription: describeCearenseGroupSizes(groups, individual ? "jogadores" : "duplas"),
    gamesPerTeamDescription: gamesPerTeam.join(" ou "),
    groupMatches,
    mainCount,
    initialParallelCount,
    mainBracketSize,
    mainOpeningRound: getEliminationRoundName(mainBracketSize),
    mainByes,
    openingMainGames,
    transferredCount,
    finalParallelCount,
    parallelBracketSize,
    parallelByes,
    parallelOpeningRound: getEliminationRoundName(parallelBracketSize),
    thirdParallel,
  };
}

export function resetCopinhaTieBreaks(data) {
  if (!isCopinhaData(data) && !isCearenseData(data)) return data;

  data.cupConfig = {
    ...(data.cupConfig || {}),
    tieBreakOverrides: {},
    groupTieBreakOverrides: {},
    campaignTieBreakOverrides: {},
  };

  return data;
}
