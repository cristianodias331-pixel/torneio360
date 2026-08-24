import {
  compareOfficialCearenseChampions,
  getOfficialCearenseChampionTieKey,
  rankCearenseCampaignEntries,
} from "./campaignRanking.mjs";
import { isOfficialCearenseData } from "./cupFormat.mjs";
import { calculateCupGroupRankings } from "./cupGroupRanking.mjs";
import { getCopinhaManualTieOrder } from "./groupRankingRules.mjs";

export function getOfficialCearenseQualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const storedOverrides = data.cupConfig?.campaignTieBreakOverrides || {};
  const canRankGroups = groupRankings.every((group) => (
    group.unresolvedTieIds.length === 0
    && group.rows.every((row) => row.played === group.rows.length - 1)
  ));
  const champions = groupRankings.map((group) => ({
    ...group.rows[0],
    groupPosition: 1,
    groupSize: group.rows.length,
  })).filter((row) => Number.isInteger(row.id));
  const orderedChampions = [...champions].sort((a, b) => (
    compareOfficialCearenseChampions(a, b) || a.name.localeCompare(b.name)
  ));
  const rankedChampions = [];
  const unresolvedCampaignTies = [];

  for (let start = 0; start < orderedChampions.length;) {
    let end = start + 1;
    while (end < orderedChampions.length && compareOfficialCearenseChampions(orderedChampions[start], orderedChampions[end]) === 0) {
      end += 1;
    }

    const tied = orderedChampions.slice(start, end);
    const tieKey = getOfficialCearenseChampionTieKey(tied[0]);
    const manualOrder = getCopinhaManualTieOrder(tied, storedOverrides[tieKey]);

    if (tied.length > 1 && !manualOrder) {
      if (canRankGroups) {
        unresolvedCampaignTies.push({ tieKey, scope: "campeoes", teamIds: tied.map((row) => row.id), rows: tied });
      }
      rankedChampions.push(...tied);
    } else if (manualOrder) {
      rankedChampions.push(...[...tied].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else {
      rankedChampions.push(...tied);
    }
    start = end;
  }

  const groupRankById = new Map(rankedChampions.map((row, index) => [row.groupId, index + 1]));
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    group.rows.forEach((row, index) => {
      const entry = {
        ...row,
        groupPosition: index + 1,
        groupRank: groupRankById.get(group.id),
        groupSize: group.rows.length,
      };
      if (index < 2) main.push(entry);
      else repechage.push(entry);
    });
  });

  main.sort((a, b) => a.groupPosition - b.groupPosition || a.groupRank - b.groupRank);
  repechage.sort((a, b) => a.groupPosition - b.groupPosition || a.groupRank - b.groupRank);

  return { main, repechage, unresolvedCampaignTies };
}

export function getCearenseQualified(data) {
  if (isOfficialCearenseData(data)) return getOfficialCearenseQualified(data);

  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const storedOverrides = data.cupConfig?.campaignTieBreakOverrides || {};
  const campaignRankingOptions = {
    useCoefficient: data.cupConfig?.playRankingBracketVersion === 2,
  };
  const champions = [];
  const runnersUp = [];
  const parallel = [];

  groupRankings.forEach((group) => {
    group.rows.forEach((row, index) => {
      const entry = { ...row, groupPosition: index + 1 };

      if (index === 0) champions.push(entry);
      else if (index === 1) runnersUp.push(entry);
      else parallel.push(entry);
    });
  });

  const rankedChampions = rankCearenseCampaignEntries(champions, storedOverrides, "campeoes", campaignRankingOptions);
  const rankedRunnersUp = rankCearenseCampaignEntries(runnersUp, storedOverrides, "segundos", campaignRankingOptions);
  const rankedParallel = rankCearenseCampaignEntries(parallel, storedOverrides, "paralela", campaignRankingOptions);
  const addCampaignRank = (row, index) => ({ ...row, groupRank: index + 1 });

  return {
    main: [
      ...rankedChampions.rows.map(addCampaignRank),
      ...rankedRunnersUp.rows.map(addCampaignRank),
    ],
    repechage: rankedParallel.rows.map(addCampaignRank),
    unresolvedCampaignTies: [
      ...rankedChampions.unresolvedTies,
      ...rankedRunnersUp.unresolvedTies,
      ...rankedParallel.unresolvedTies,
    ],
  };
}
