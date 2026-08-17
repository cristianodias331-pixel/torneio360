import { getMatchElapsedSeconds } from "./matchTimer.mjs";
import { defaultRankingCriteria, getRankingCriteria } from "./rankingCriteria.mjs";
import { getScoreWinnerSide } from "./scoreRules.mjs";

export function calculateScheduleRanking({
  names = [],
  schedule = [],
  winningScore = 4,
  timingComplete = false,
  rankingCriteriaValue = defaultRankingCriteria,
} = {}) {
  const table = names.map((name, id) => ({
    id,
    name,
    pts: 0,
    w: 0,
    bal: 0,
    played: 0,
    playTimeSeconds: 0,
  }));

  schedule.flat().forEach((game) => {
    const s1 = Number(game.s1);
    const s2 = Number(game.s2);

    if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

    const winnerSide = getScoreWinnerSide(game, winningScore);
    if (!winnerSide) return;

    const win1 = winnerSide === "team1";
    const win2 = winnerSide === "team2";
    const matchSeconds = timingComplete ? getMatchElapsedSeconds(game) : 0;

    game.ids1.forEach((id) => {
      if (!table[id]) return;
      table[id].pts += s1;
      table[id].bal += s1 - s2;
      table[id].played += 1;
      table[id].playTimeSeconds += matchSeconds;
      if (win1) table[id].w += 1;
    });

    game.ids2.forEach((id) => {
      if (!table[id]) return;
      table[id].pts += s2;
      table[id].bal += s2 - s1;
      table[id].played += 1;
      table[id].playTimeSeconds += matchSeconds;
      if (win2) table[id].w += 1;
    });
  });

  const criteria = getRankingCriteria(rankingCriteriaValue);

  return table.sort((a, b) => {
    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  });
}

export function calculateTeamGamesRanking({
  names = [],
  games = [],
  winningScore = 4,
  rankingCriteriaValue = defaultRankingCriteria,
} = {}) {
  const table = names.map((name, id) => ({
    id,
    name,
    pts: 0,
    w: 0,
    bal: 0,
    played: 0,
  }));

  games.forEach((game) => {
    const s1 = Number(game.s1);
    const s2 = Number(game.s2);
    const id1 = game.ids1?.[0];
    const id2 = game.ids2?.[0];
    const winnerSide = getScoreWinnerSide(game, winningScore);

    if (!winnerSide || !Number.isInteger(id1) || !Number.isInteger(id2)) return;
    if (!table[id1] || !table[id2] || Number.isNaN(s1) || Number.isNaN(s2)) return;

    table[id1].pts += s1;
    table[id1].bal += s1 - s2;
    table[id1].played += 1;
    if (winnerSide === "team1") table[id1].w += 1;

    table[id2].pts += s2;
    table[id2].bal += s2 - s1;
    table[id2].played += 1;
    if (winnerSide === "team2") table[id2].w += 1;
  });

  const criteria = getRankingCriteria(rankingCriteriaValue);
  return table
    .filter((row) => row.played > 0)
    .sort((first, second) => {
      for (const key of criteria.order) {
        const difference = Number(second[key] || 0) - Number(first[key] || 0);
        if (difference !== 0) return difference;
      }
      return first.name.localeCompare(second.name, "pt-BR");
    });
}
