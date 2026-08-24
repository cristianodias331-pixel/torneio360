import { getCopinhaManualTieOrder } from "./groupRankingRules.mjs";

export function compareCearenseCampaignMetrics(first, second, { useCoefficient = false } = {}) {
  const firstPlayed = Math.max(1, Number(first.played) || 0);
  const secondPlayed = Math.max(1, Number(second.played) || 0);

  for (const key of useCoefficient ? ["w", "bal"] : ["w", "bal", "pts"]) {
    const difference = Number(second[key] || 0) * firstPlayed - Number(first[key] || 0) * secondPlayed;
    if (difference !== 0) return difference;
  }

  if (useCoefficient) {
    const coefficientDifference = Number(second.coefficient || 0) - Number(first.coefficient || 0);
    if (Math.abs(coefficientDifference) >= 1e-12) return coefficientDifference;
  }

  return 0;
}

export function haveSameCearenseCampaign(first, second, { useCoefficient = false } = {}) {
  const firstPlayed = Math.max(1, Number(first.played) || 0);
  const secondPlayed = Math.max(1, Number(second.played) || 0);

  const sameProportionalMetrics = (useCoefficient ? ["w", "bal"] : ["w", "bal", "pts"]).every((key) => (
    Number(first[key] || 0) * secondPlayed === Number(second[key] || 0) * firstPlayed
  ));

  return sameProportionalMetrics && (!useCoefficient
    || Math.abs(Number(first.coefficient || 0) - Number(second.coefficient || 0)) < 1e-12);
}

export function greatestCommonDivisor(first, second) {
  let a = Math.abs(Number(first) || 0);
  let b = Math.abs(Number(second) || 0);

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a || 1;
}

export function getReducedRatio(value, divisor) {
  const safeDivisor = Math.max(1, Number(divisor) || 0);
  const commonDivisor = greatestCommonDivisor(value, safeDivisor);
  return `${Number(value || 0) / commonDivisor}/${safeDivisor / commonDivisor}`;
}

export function getCearenseCampaignTieKey(scope, row, { useCoefficient = false } = {}) {
  const finalMetric = useCoefficient
    ? Number(row.coefficient || 0).toFixed(12)
    : getReducedRatio(row.pts, row.played);
  return `${scope}:${getReducedRatio(row.w, row.played)}:${getReducedRatio(row.bal, row.played)}:${finalMetric}`;
}

export function rankCearenseCampaignEntries(entries, storedOverrides, scope, { useCoefficient = false } = {}) {
  const baseEntries = [...entries].sort((a, b) => {
    const comparison = compareCearenseCampaignMetrics(a, b, { useCoefficient });
    if (comparison !== 0) return comparison;
    if (a.groupId === b.groupId) return a.groupPosition - b.groupPosition;
    return a.name.localeCompare(b.name);
  });
  const rankedEntries = [];
  const unresolvedTies = [];

  for (let start = 0; start < baseEntries.length;) {
    let end = start + 1;

    while (end < baseEntries.length && haveSameCearenseCampaign(baseEntries[start], baseEntries[end], { useCoefficient })) {
      end += 1;
    }

    const tiedEntries = baseEntries.slice(start, end);
    const distinctGroups = new Set(tiedEntries.map((entry) => entry.groupId));

    if (tiedEntries.length === 1 || distinctGroups.size === 1) {
      rankedEntries.push(...tiedEntries);
    } else {
      const tieKey = getCearenseCampaignTieKey(scope, tiedEntries[0], { useCoefficient });
      const manualOrder = getCopinhaManualTieOrder(tiedEntries, storedOverrides[tieKey]);

      if (manualOrder) {
        rankedEntries.push(...[...tiedEntries].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else {
        unresolvedTies.push({
          tieKey,
          scope,
          teamIds: tiedEntries.map((entry) => entry.id),
          rows: tiedEntries,
        });
        rankedEntries.push(...tiedEntries);
      }
    }

    start = end;
  }

  return { rows: rankedEntries, unresolvedTies };
}

export function getOfficialCearenseAdjustedBalance(row) {
  const groupSize = Number(row.groupSize) || 3;
  return groupSize === 4
    ? { numerator: Number(row.bal || 0) * 2, denominator: 3 }
    : { numerator: Number(row.bal || 0), denominator: 1 };
}

export function compareOfficialCearenseChampions(first, second) {
  const firstBalance = getOfficialCearenseAdjustedBalance(first);
  const secondBalance = getOfficialCearenseAdjustedBalance(second);
  return secondBalance.numerator * firstBalance.denominator
    - firstBalance.numerator * secondBalance.denominator;
}

export function getOfficialCearenseChampionTieKey(row) {
  const balance = getOfficialCearenseAdjustedBalance(row);
  return `campeoes-saldo-ajustado:${getReducedRatio(balance.numerator, balance.denominator)}`;
}
