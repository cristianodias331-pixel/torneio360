import {
  getBracketSeedOrder,
  getEliminationRoundName,
  getNextPowerOfTwo,
} from "./bracketBasics.mjs";
import { createCopinhaBracketGame } from "./bracketConstruction.mjs";
import { buildNextRound, getGameLoserId } from "./bracketProgression.mjs";
import { compareCearenseCampaignMetrics } from "./campaignRanking.mjs";
import { getScoreWinnerSide, getWinningScore, isGameFinished } from "./scoreRules.mjs";

export function takeCompatibleParallelOpponent(entries, referenceEntry, fromEnd = true) {
  if (!entries.length) return null;

  const indexes = fromEnd
    ? Array.from({ length: entries.length }, (_, index) => entries.length - 1 - index)
    : Array.from({ length: entries.length }, (_, index) => index);
  const compatibleIndex = indexes.find((index) => entries[index]?.groupId !== referenceEntry?.groupId);
  const selectedIndex = compatibleIndex ?? indexes[0];

  return entries.splice(selectedIndex, 1)[0] || null;
}

export function pairPlayRankingTransferredEntries(transferredEntries, originalEntries) {
  const ownerByOriginalIndex = Array(originalEntries.length).fill(-1);

  function findOpponent(transferIndex, visitedOriginals) {
    for (let originalIndex = originalEntries.length - 1; originalIndex >= 0; originalIndex -= 1) {
      if (visitedOriginals.has(originalIndex)) continue;
      if (originalEntries[originalIndex]?.groupId === transferredEntries[transferIndex]?.groupId) continue;

      visitedOriginals.add(originalIndex);
      const currentOwner = ownerByOriginalIndex[originalIndex];

      if (currentOwner < 0 || findOpponent(currentOwner, visitedOriginals)) {
        ownerByOriginalIndex[originalIndex] = transferIndex;
        return true;
      }
    }

    return false;
  }

  transferredEntries.forEach((_, transferIndex) => {
    findOpponent(transferIndex, new Set());
  });

  const opponentIndexByTransfer = Array(transferredEntries.length).fill(-1);
  ownerByOriginalIndex.forEach((transferIndex, originalIndex) => {
    if (transferIndex >= 0) opponentIndexByTransfer[transferIndex] = originalIndex;
  });
  const usedOriginals = new Set(opponentIndexByTransfer.filter((index) => index >= 0));
  const remainingOriginals = originalEntries.filter((_, index) => !usedOriginals.has(index));

  const pairs = transferredEntries.map((entry, transferIndex) => {
    const matchedOriginalIndex = opponentIndexByTransfer[transferIndex];
    const opponent = matchedOriginalIndex >= 0
      ? originalEntries[matchedOriginalIndex]
      : takeCompatibleParallelOpponent(remainingOriginals, entry, true);

    return [entry, opponent];
  });

  return { pairs, remainingOriginals };
}

export function spreadPlayRankingOpeningPairs(pairs) {
  if (pairs.length <= 2) return pairs;

  const seedOrder = getBracketSeedOrder(pairs.length);
  const spread = Array(pairs.length).fill(null);

  pairs.forEach((pair, index) => {
    spread[seedOrder[index] - 1] = pair;
  });

  return spread;
}

export function buildPlayRankingParallelRounds(transferredEntries, originalEntries, bracketTitle) {
  const transferred = [...transferredEntries];
  const originals = [...originalEntries];
  const totalEntries = transferred.length + originals.length;

  if (totalEntries < 2) return [];

  const bracketSize = getNextPowerOfTwo(totalEntries);
  const openingGameCount = totalEntries - bracketSize / 2;
  const transferredGamesCount = Math.min(openingGameCount, transferred.length, originals.length);
  const transferredByeCount = transferred.length - transferredGamesCount;
  const originalByeCount = originals.length - (transferredGamesCount + (openingGameCount - transferredGamesCount) * 2);
  const openingPairs = [];

  transferred.splice(0, transferredByeCount).forEach((entry) => {
    openingPairs.push([entry, null]);
  });

  originals.splice(0, Math.max(0, originalByeCount)).forEach((entry) => {
    openingPairs.push([entry, null]);
  });

  const transferPairing = pairPlayRankingTransferredEntries(transferred, originals);
  openingPairs.push(...transferPairing.pairs);
  originals.splice(0, originals.length, ...transferPairing.remainingOriginals);

  while (originals.length > 1) {
    const first = originals.shift();
    openingPairs.push([first, takeCompatibleParallelOpponent(originals, first, true)]);
  }

  if (originals.length === 1) openingPairs.push([originals.shift(), null]);

  while (openingPairs.length < bracketSize / 2) openingPairs.push([null, null]);

  const openingRoundName = getEliminationRoundName(bracketSize);
  const openingGames = spreadPlayRankingOpeningPairs(openingPairs).map(([entry1, entry2], index) => ({
    ...createCopinhaBracketGame({
      bracketType: "repechage",
      roundName: openingRoundName,
      matchKey: `repechage_r${bracketSize}_${index + 1}`,
      entry1,
      entry2,
      court: index + 1,
    }),
    isBye: Boolean(entry1) !== Boolean(entry2),
  }));
  const rounds = [{ title: openingRoundName, bracketTitle, games: openingGames }];
  let currentGames = openingGames;
  let currentTeamCount = bracketSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(
      currentGames,
      "repechage",
      nextRoundName,
      `r${nextTeamCount}`
    );

    rounds.push({ title: nextRoundName, bracketTitle, games: nextGames });
    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}

export function getPlayRankingOpeningLosses(data, mainRounds, qualifiedMain) {
  const openingRound = mainRounds?.[0];

  if (!openingRound) {
    return { ready: false, roundName: "Primeira fase", losses: [] };
  }

  const storedGames = Array.isArray(data.brackets) ? data.brackets : [];
  const storedByKey = new Map(storedGames.map((game) => [game.matchKey, game]));
  const playedOpeningGames = openingRound.games
    .filter((game) => !game.isBye && game.ids1?.length && game.ids2?.length)
    .map((game) => {
      const stored = storedByKey.get(game.matchKey) || {};
      return {
        ...game,
        s1: stored.s1 ?? "",
        s2: stored.s2 ?? "",
      };
    });

  const ready = playedOpeningGames.length > 0 && playedOpeningGames.every((game) => (
    isGameFinished(game, getWinningScore(data))
  ));

  if (!ready) {
    return { ready: false, roundName: openingRound.title, losses: [] };
  }

  const entryById = new Map(qualifiedMain.map((entry) => [entry.id, entry]));
  const seedIndexById = new Map(qualifiedMain.map((entry, index) => [entry.id, index]));
  const losses = playedOpeningGames
    .map((game) => {
      const loserId = getGameLoserId(game, data);
      const winnerSide = getScoreWinnerSide(game, getWinningScore(data));
      const entry = entryById.get(loserId);

      if (!entry || !winnerSide) return null;

      const loserGames = winnerSide === "team1" ? Number(game.s2) : Number(game.s1);
      const winnerGames = winnerSide === "team1" ? Number(game.s1) : Number(game.s2);

      return {
        ...entry,
        playRankingOrigin: "main-opening-loss",
        openingLossMargin: Math.abs(winnerGames - loserGames),
        openingLossGames: loserGames,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const marginDifference = first.openingLossMargin - second.openingLossMargin;
      if (marginDifference !== 0) return marginDifference;

      const gamesDifference = second.openingLossGames - first.openingLossGames;
      if (gamesDifference !== 0) return gamesDifference;

      const campaignDifference = compareCearenseCampaignMetrics(first, second, {
        useCoefficient: data.cupConfig?.playRankingBracketVersion === 2,
      });
      if (campaignDifference !== 0) return campaignDifference;

      const seedDifference = seedIndexById.get(first.id) - seedIndexById.get(second.id);
      if (seedDifference !== 0) return seedDifference;

      return first.name.localeCompare(second.name);
    });

  return { ready: true, roundName: openingRound.title, losses };
}
