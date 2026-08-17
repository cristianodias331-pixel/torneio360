import { getCearenseQualified } from "./cearenseQualification.mjs";
import { getCupFormat } from "./cupFormat.mjs";
import { calculateCupGroupRankings } from "./cupGroupRanking.mjs";
import { getCopinhaManualTieOrder } from "./groupRankingRules.mjs";
import { defaultRankingCriteria, getRankingCriteria } from "./rankingCriteria.mjs";

export function sortRowsByPointsBalanceWins(first, second) {
  const pointsDifference = second.pts - first.pts;
  if (pointsDifference !== 0) return pointsDifference;

  const balanceDifference = second.bal - first.bal;
  if (balanceDifference !== 0) return balanceDifference;

  const winsDifference = second.w - first.w;
  if (winsDifference !== 0) return winsDifference;

  return first.name.localeCompare(second.name);
}

export function getCup18Qualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const direct = [];
  const thirds = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) direct.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) direct.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) thirds.push({ ...group.rows[2], groupPosition: 3 });
  });

  const sortedThirds = [...thirds].sort(sortRowsByPointsBalanceWins);
  const extraMain = sortedThirds.slice(0, 2);
  const parallel = sortedThirds.slice(2);
  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortMain(first, second) {
    if (first.groupPosition !== second.groupPosition) return first.groupPosition - second.groupPosition;

    for (const key of criteria.order) {
      const difference = second[key] - first[key];
      if (difference !== 0) return difference;
    }

    return first.name.localeCompare(second.name);
  }

  const main = [...direct, ...extraMain].sort(sortMain);
  return { main, repechage: parallel };
}

export function getCup21Qualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) main.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) main.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) repechage.push({ ...group.rows[2], groupPosition: 3 });
  });

  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortGeneral(first, second) {
    if (first.groupPosition !== second.groupPosition) return first.groupPosition - second.groupPosition;

    for (const key of criteria.order) {
      const difference = second[key] - first[key];
      if (difference !== 0) return difference;
    }

    return first.name.localeCompare(second.name);
  }

  main.sort(sortGeneral);
  repechage.sort(sortRowsByPointsBalanceWins);
  return { main, repechage };
}

export function compareCopinhaGroupCampaign(firstGroup, secondGroup) {
  const first = firstGroup.rows[0] || {};
  const second = secondGroup.rows[0] || {};
  const winsDifference = Number(second.w || 0) - Number(first.w || 0);
  if (winsDifference !== 0) return winsDifference;

  const balanceDifference = Number(second.bal || 0) - Number(first.bal || 0);
  if (balanceDifference !== 0) return balanceDifference;

  return firstGroup.id - secondGroup.id;
}

export function getCopinhaGroupTieKey(group) {
  const champion = group.rows[0] || {};
  return `${Number(champion.w || 0)}:${Number(champion.bal || 0)}`;
}

export function getCopinhaSeededGroups(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const baseGroups = [...groupRankings].sort(compareCopinhaGroupCampaign);
  const groupsFinished = baseGroups.every((group) => group.rows.every((row) => row.played === 2));

  if (!groupsFinished) {
    return { rankedGroups: baseGroups, unresolvedGroupTies: [] };
  }

  const rankedGroups = [];
  const unresolvedGroupTies = [];
  const storedOverrides = data.cupConfig?.groupTieBreakOverrides || {};

  for (let start = 0; start < baseGroups.length;) {
    let end = start + 1;
    const tieKey = getCopinhaGroupTieKey(baseGroups[start]);

    while (end < baseGroups.length && getCopinhaGroupTieKey(baseGroups[end]) === tieKey) {
      end += 1;
    }

    const tiedGroups = baseGroups.slice(start, end);

    if (tiedGroups.length === 1) {
      rankedGroups.push(tiedGroups[0]);
    } else {
      const manualOrder = getCopinhaManualTieOrder(tiedGroups, storedOverrides[tieKey]);

      if (manualOrder) {
        rankedGroups.push(...[...tiedGroups].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else {
        unresolvedGroupTies.push({
          tieKey,
          groupIds: tiedGroups.map((group) => group.id),
        });
        rankedGroups.push(...tiedGroups);
      }
    }

    start = end;
  }

  return { rankedGroups, unresolvedGroupTies };
}

export function getCopinhaQualified(data) {
  const { rankedGroups } = getCopinhaSeededGroups(data);
  const champions = rankedGroups
    .filter((group) => group.rows[0])
    .map((group, index) => ({ ...group.rows[0], groupPosition: 1, groupRank: index + 1 }));
  const runnersUp = rankedGroups
    .filter((group) => group.rows[1])
    .map((group, index) => ({ ...group.rows[1], groupPosition: 2, groupRank: index + 1 }));
  const thirds = rankedGroups
    .filter((group) => group.rows[2])
    .map((group, index) => ({ ...group.rows[2], groupPosition: 3, groupRank: index + 1 }));

  return {
    main: [...champions, ...runnersUp],
    repechage: rankedGroups.length > 2 ? thirds : [],
  };
}

export function getCupQualified(data) {
  const format = getCupFormat(data);
  const teamCount = data.cupConfig?.teamCount || 12;

  if (format === "cearense" || format === "cearense-individual" || format === "playranking" || format === "sunset") {
    return getCearenseQualified(data);
  }

  if (format === "copinha") return getCopinhaQualified(data);

  if (format === "cup18" || (!format && teamCount === 18)) return getCup18Qualified(data);
  if (format === "cup21" || (!format && teamCount === 21)) return getCup21Qualified(data);

  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) main.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) main.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) repechage.push({ ...group.rows[2], groupPosition: 3 });
  });

  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortGeneral(first, second) {
    if (first.groupPosition !== second.groupPosition) return first.groupPosition - second.groupPosition;

    for (const key of criteria.order) {
      const difference = second[key] - first[key];
      if (difference !== 0) return difference;
    }

    return first.name.localeCompare(second.name);
  }

  main.sort(sortGeneral);
  repechage.sort(sortGeneral);
  return { main, repechage };
}
