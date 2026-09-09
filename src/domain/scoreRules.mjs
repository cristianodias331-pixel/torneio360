export function getMaxScore(winningScore = 4) {
  return Number(winningScore) === 6 ? 7 : 4;
}

export function normalizeScoreInput(value, winningScore = 4) {
  if (value === "") return "";

  const number = Number(value);
  const maxScore = getMaxScore(winningScore);

  if (Number.isNaN(number)) return "";
  if (number < 0) return "0";
  if (number > maxScore) return String(maxScore);

  return String(Math.floor(number));
}

export function getWinningScore(data) {
  return Number(data?.winningScore || 4);
}

export function getScoreWinnerSide(game, winningScore = 4) {
  if (Array.isArray(game?.teamCupLegs)) {
    const legWinner = leg => !leg || [leg.s1, leg.s2].some(v => v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < 0)
      ? null : getScoreWinnerSide({ s1: leg.s1, s2: leg.s2 }, winningScore);
    const first = game.teamCupLegs.slice(0, 2).map(legWinner);
    if (first[0] && first[0] === first[1]) return first[0];
    if (first[0] && first[1]) return legWinner(game.teamCupLegs[2]);
    return null;
  }
  const s1 = Number(game.s1);
  const s2 = Number(game.s2);
  const target = Number(winningScore || 4);

  if (game.s1 === "" || game.s2 === "") return null;
  if (Number.isNaN(s1) || Number.isNaN(s2)) return null;
  if (s1 === s2) return null;

  if (target === 6) {
    if (s1 >= 6 && s1 > s2) return "team1";
    if (s2 >= 6 && s2 > s1) return "team2";
    return null;
  }

  if (s1 >= target && s1 > s2) return "team1";
  if (s2 >= target && s2 > s1) return "team2";

  return null;
}

export function isGameFinished(game, winningScore = 4) {
  return getScoreWinnerSide(game, winningScore) !== null;
}
