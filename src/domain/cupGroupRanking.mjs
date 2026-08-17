import {
  compareOfficialCearenseChampions,
  getOfficialCearenseChampionTieKey,
} from "./campaignRanking.mjs";
import {
  getCupFormat,
  isCearenseData,
  isCopinhaData,
  isOfficialCearenseData,
} from "./cupFormat.mjs";
import { createCupGroups, getTeamName } from "./cupGroups.mjs";
import {
  getCopinhaManualTieOrder,
  rankCearenseGroupRows,
  rankCopinhaGroupRows,
  rankOfficialCearenseGroupRows,
} from "./groupRankingRules.mjs";
import { defaultRankingCriteria, getRankingCriteria } from "./rankingCriteria.mjs";
import { getScoreWinnerSide, getWinningScore } from "./scoreRules.mjs";

export function calculateCupGroupRankings(data, rankingCriteriaValue = defaultRankingCriteria) {
  const cupConfig = data.cupConfig || {};
  const teamCount = cupConfig.teamCount || 12;
  const format = getCupFormat(data);
  const groups = createCupGroups(teamCount, format, cupConfig);
  const teamNames = data.players.teams.map((team) => getTeamName(team));
  const criteria = getRankingCriteria(rankingCriteriaValue);
  const winningScore = getWinningScore(data);
  const isCopinha = isCopinhaData(data);
  const isCearense = isCearenseData(data);
  const isOfficialCearense = isOfficialCearenseData(data);
  const tieBreakOverrides = cupConfig.tieBreakOverrides || {};

  const groupRankings = groups.map((group) => {
    const rows = group.teamIds.map((id) => ({
      id,
      name: teamNames[id],
      groupId: group.id,
      groupName: group.name,
      pts: 0,
      w: 0,
      bal: 0,
      played: 0,
    }));

    const tableById = {};
    rows.forEach((row) => {
      tableById[row.id] = row;
    });

    const groupGames = (data.schedule || [])
      .flat()
      .filter((game) => game.phase === "groups" && game.groupId === group.id);

    groupGames.forEach((game) => {
      const s1 = Number(game.s1);
      const s2 = Number(game.s2);

      if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

      const winnerSide = getScoreWinnerSide(game, winningScore);
      if (!winnerSide) return;

      const win1 = winnerSide === "team1";
      const win2 = winnerSide === "team2";

      game.ids1.forEach((id) => {
        tableById[id].pts += s1;
        tableById[id].bal += s1 - s2;
        tableById[id].played += 1;
        if (win1) tableById[id].w += 1;
      });

      game.ids2.forEach((id) => {
        tableById[id].pts += s2;
        tableById[id].bal += s2 - s1;
        tableById[id].played += 1;
        if (win2) tableById[id].w += 1;
      });
    });

    if (isCopinha) {
      const ranked = rankCopinhaGroupRows(
        rows,
        groupGames,
        winningScore,
        tieBreakOverrides[String(group.id)]
      );

      return {
        ...group,
        rows: ranked.rows,
        unresolvedTieIds: ranked.unresolvedTieIds,
        rankingMode: "copinha",
      };
    }

    if (isCearense) {
      const ranked = isOfficialCearense
        ? rankOfficialCearenseGroupRows(
          rows,
          groupGames,
          winningScore,
          tieBreakOverrides[String(group.id)]
        )
        : rankCearenseGroupRows(
          rows,
          groupGames,
          winningScore,
          criteria,
          tieBreakOverrides[String(group.id)]
        );

      return {
        ...group,
        rows: ranked.rows,
        unresolvedTieIds: ranked.unresolvedTieIds,
        rankingMode: isOfficialCearense ? "cearense-official" : "cearense",
      };
    }

    rows.sort((a, b) => {
      for (const key of criteria.order) {
        const diff = b[key] - a[key];
        if (diff !== 0) return diff;
      }

      return a.name.localeCompare(b.name);
    });

    return {
      ...group,
      rows,
      unresolvedTieIds: [],
      rankingMode: "standard",
    };
  });

  if (!isOfficialCearense) return groupRankings;

  const storedCampaignOverrides = cupConfig.campaignTieBreakOverrides || {};
  const champions = groupRankings.map((group) => ({
    ...group.rows[0],
    groupSize: group.rows.length,
  }));
  champions.sort((a, b) => compareOfficialCearenseChampions(a, b) || a.name.localeCompare(b.name));
  let hasUnresolvedChampionTie = false;

  for (let start = 0; start < champions.length;) {
    let end = start + 1;
    while (end < champions.length && compareOfficialCearenseChampions(champions[start], champions[end]) === 0) end += 1;
    const tied = champions.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tied, storedCampaignOverrides[getOfficialCearenseChampionTieKey(tied[0])]);
    if (manualOrder) tied.sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id));
    else if (tied.length > 1) hasUnresolvedChampionTie = true;
    champions.splice(start, tied.length, ...tied);
    start = end;
  }

  const allGroupsReady = groupRankings.every((group) => (
    group.unresolvedTieIds.length === 0
    && group.rows.every((row) => row.played === group.rows.length - 1)
  ));
  if (!allGroupsReady || hasUnresolvedChampionTie) return groupRankings;

  const groupOrder = new Map(champions.map((row, index) => [row.groupId, index + 1]));
  return [...groupRankings]
    .sort((a, b) => groupOrder.get(a.id) - groupOrder.get(b.id))
    .map((group) => ({ ...group, groupRank: groupOrder.get(group.id) }));
}
