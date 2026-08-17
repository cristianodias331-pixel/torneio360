import { getCupTeamName } from "./cupGroups.mjs";
import { getScoreWinnerSide, getWinningScore } from "./scoreRules.mjs";

export function getGameWinnerId(game, data = null) {
  const winningScore = getWinningScore(data);
  const winnerSide = getScoreWinnerSide(game, winningScore);

  if (game.isBye) {
    if (game.ids1?.length && !game.ids2?.length) return game.ids1[0];
    if (game.ids2?.length && !game.ids1?.length) return game.ids2[0];
  }

  if (!game.ids1?.length || !game.ids2?.length) return null;
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids1[0] : game.ids2[0];
}

export function getGameLoserId(game, data = null) {
  const winningScore = getWinningScore(data);
  const winnerSide = getScoreWinnerSide(game, winningScore);

  if (!game.ids1?.length || !game.ids2?.length) return null;
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids2[0] : game.ids1[0];
}

export function resolveBracketGame(game, allGames, data) {
  const copy = { ...game };

  if (copy.source1) {
    const sourceGame = allGames.find((item) => item.matchKey === copy.source1);

    const sourceId = sourceGame
      ? copy.source1Mode === "loser"
        ? getGameLoserId(resolveBracketGame(sourceGame, allGames, data), data)
        : getGameWinnerId(resolveBracketGame(sourceGame, allGames, data), data)
      : null;

    copy.ids1 = sourceId === null ? [] : [sourceId];
  }

  if (copy.source2) {
    const sourceGame = allGames.find((item) => item.matchKey === copy.source2);

    const sourceId = sourceGame
      ? copy.source2Mode === "loser"
        ? getGameLoserId(resolveBracketGame(sourceGame, allGames, data), data)
        : getGameWinnerId(resolveBracketGame(sourceGame, allGames, data), data)
      : null;

    copy.ids2 = sourceId === null ? [] : [sourceId];
  }

  copy.team1 = copy.ids1?.length
    ? [getCupTeamName(data, copy.ids1[0])]
    : [copy.isBye ? "BYE" : "Aguardando"];

  copy.team2 = copy.ids2?.length
    ? [getCupTeamName(data, copy.ids2[0])]
    : [copy.isBye ? "BYE" : "Aguardando"];

  return copy;
}

export function buildNextRound(previousGames, bracketType, roundName, keyPrefix) {
  const games = [];

  for (let i = 0; i < previousGames.length; i += 2) {
    games.push({
      phase: bracketType,
      roundName,
      matchKey: `${bracketType}_${keyPrefix}_${games.length + 1}`,
      source1: previousGames[i].matchKey,
      source2: previousGames[i + 1].matchKey,
      ids1: [],
      ids2: [],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: games.length + 1,
    });
  }

  return games;
}

export function buildThirdPlaceGame(semifinals, bracketType = "main") {
  if (!semifinals || semifinals.length < 2) return [];

  return [
    {
      phase: bracketType,
      roundName: "3º lugar",
      matchKey: `${bracketType}_third_1`,
      source1: semifinals[0].matchKey,
      source2: semifinals[1].matchKey,
      source1Mode: "loser",
      source2Mode: "loser",
      ids1: [],
      ids2: [],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: 2,
    },
  ];
}
