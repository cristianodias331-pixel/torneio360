import { formatMatchTotalDuration } from "./matchTimer.mjs";

export const rankingCriteriaOptions = [
  {
    value: "wins_points_balance",
    label: "Vitórias > Total de Games > Saldo de games",
    order: ["w", "pts", "bal"],
  },
  {
    value: "wins_balance_points",
    label: "Vitórias > Saldo de games > Total de Games",
    order: ["w", "bal", "pts"],
  },
  {
    value: "points_wins_balance",
    label: "Total de Games > Vitórias > Saldo de games",
    order: ["pts", "w", "bal"],
  },
  {
    value: "points_balance_wins",
    label: "Total de Games > Saldo de games > Vitórias",
    order: ["pts", "bal", "w"],
  },
  {
    value: "balance_wins_points",
    label: "Saldo de games > Vitórias > Total de Games",
    order: ["bal", "w", "pts"],
  },
  {
    value: "balance_points_wins",
    label: "Saldo de games > Total de Games > Vitórias",
    order: ["bal", "pts", "w"],
  },
];

export const defaultRankingCriteria = "wins_points_balance";

// Modalidades de copa sempre classificam primeiro por vitórias. Esta constante
// é usada apenas na criação de novos torneios; os torneios já salvos mantêm o
// critério registrado neles.
export const cupRankingCriteria = "wins_balance_points";

export function getRankingCriteria(value) {
  return rankingCriteriaOptions.find((item) => item.value === value) || rankingCriteriaOptions[0];
}

export function getRankingColumnLabel(key) {
  return {
    w: "Vitórias",
    pts: "Total de Games",
    bal: "Saldo de games",
    playTimeSeconds: "Tempo em jogo",
  }[key] || key;
}

export function formatRankingMetricValue(key, value) {
  if (key === "playTimeSeconds") return formatMatchTotalDuration(value);
  return String(Number(value || 0));
}
