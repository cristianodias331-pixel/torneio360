import {
  getBracketSeedOrder,
  getEliminationRoundName,
  getLargestPowerOfTwo,
} from "./bracketBasics.mjs";
import {
  createCopinhaBracketGame,
  getCopinhaPreliminaryPairs,
} from "./bracketConstruction.mjs";
import { buildNextRound, buildThirdPlaceGame } from "./bracketProgression.mjs";

export function expandBracketPlanWithVisualByes(roundPlan) {
  const expandedPlan = structuredClone(roundPlan || []);
  const treeRounds = expandedPlan.filter((round) => !String(round.title || "").includes("3º"));

  for (let roundIndex = 0; roundIndex < treeRounds.length - 1; roundIndex += 1) {
    const currentRound = treeRounds[roundIndex];
    const nextRound = treeRounds[roundIndex + 1];
    const currentByKey = new Map(currentRound.games.map((game) => [game[0], game]));
    const orderedCurrentGames = [];

    nextRound.games = nextRound.games.map(([nextKey, firstReference, secondReference], nextGameIndex) => {
      const nextReferences = [firstReference, secondReference];
      const normalizedReferences = nextReferences.map((reference, sideIndex) => {
        if (typeof reference === "string" && reference.startsWith("w:")) {
          const sourceKey = reference.slice(2);
          const sourceGame = currentByKey.get(sourceKey);
          if (sourceGame) orderedCurrentGames.push(sourceGame);
          return reference;
        }

        const byeKey = `visual_bye_${roundIndex + 1}_${nextGameIndex + 1}_${sideIndex + 1}`;
        orderedCurrentGames.push([byeKey, reference, null]);
        return `w:${byeKey}`;
      });

      return [nextKey, ...normalizedReferences];
    });

    if (orderedCurrentGames.length === nextRound.games.length * 2) {
      currentRound.games = orderedCurrentGames;
    }
  }

  return expandedPlan;
}

export function getCopinhaEntryCode(entry) {
  const prefix = entry?.groupPosition === 1 ? "c" : entry?.groupPosition === 2 ? "r" : "t";
  return prefix ? `${prefix}${entry.groupRank}` : "";
}

export function getCopinhaPlanEntry(reference, entryByCode, bracketType) {
  if (typeof reference !== "string") return null;

  if (reference.startsWith("w:") || reference.startsWith("l:")) {
    return {
      sourceMatchKey: `${bracketType}_${reference.slice(2)}`,
      sourceMode: reference.startsWith("l:") ? "loser" : "winner",
    };
  }

  return entryByCode[reference] || null;
}

export function buildCopinhaBracketFromPlan(entries, bracketType, bracketTitle, roundPlan) {
  const entryByCode = Object.fromEntries(
    entries.map((entry) => [getCopinhaEntryCode(entry), entry])
  );

  return roundPlan.map((round) => ({
    title: round.title,
    bracketTitle,
    games: round.games.map(([key, first, second], index) => {
      const firstEntry = getCopinhaPlanEntry(first, entryByCode, bracketType);
      const secondEntry = getCopinhaPlanEntry(second, entryByCode, bracketType);
      return {
        ...createCopinhaBracketGame({
          bracketType,
          roundName: round.title,
          matchKey: `${bracketType}_${key}`,
          entry1: firstEntry,
          entry2: secondEntry,
          court: index + 1,
        }),
        isBye: Boolean(firstEntry) !== Boolean(secondEntry),
      };
    }),
  }));
}

export function buildCopinhaEliminationRounds(entries, bracketType, bracketTitle, includeThirdPlace = false) {
  if (!Array.isArray(entries) || entries.length < 2) return [];

  const teamCount = entries.length;
  const targetSize = getLargestPowerOfTwo(teamCount);
  const preliminaryGameCount = teamCount - targetSize;
  const directEntryCount = teamCount - preliminaryGameCount * 2;
  const directEntries = entries.slice(0, directEntryCount);
  const preliminaryPairs = getCopinhaPreliminaryPairs(entries.slice(directEntryCount));
  const preliminaryGames = preliminaryPairs.map(([entry1, entry2], index) => (
    createCopinhaBracketGame({
      bracketType,
      roundName: "Preliminar",
      matchKey: `${bracketType}_pre_${index + 1}`,
      entry1,
      entry2,
      court: index + 1,
    })
  ));

  const seededEntries = [
    ...directEntries,
    ...preliminaryGames.map((game) => ({ sourceMatchKey: game.matchKey })),
  ];
  const seedOrder = getBracketSeedOrder(targetSize);
  const openingRoundName = getEliminationRoundName(targetSize);
  const openingGames = [];

  for (let index = 0; index < seedOrder.length; index += 2) {
    openingGames.push(createCopinhaBracketGame({
      bracketType,
      roundName: openingRoundName,
      matchKey: `${bracketType}_r${targetSize}_${openingGames.length + 1}`,
      entry1: seededEntries[seedOrder[index] - 1],
      entry2: seededEntries[seedOrder[index + 1] - 1],
      court: openingGames.length + 1,
    }));
  }

  const rounds = [];

  if (preliminaryGames.length > 0) {
    rounds.push({
      title: "Preliminar",
      bracketTitle,
      games: preliminaryGames,
    });
  }

  rounds.push({
    title: openingRoundName,
    bracketTitle,
    games: openingGames,
  });

  let currentGames = openingGames;
  let currentTeamCount = targetSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(
      currentGames,
      bracketType,
      nextRoundName,
      `r${nextTeamCount}`
    );

    if (nextTeamCount === 2 && includeThirdPlace) {
      const thirdPlaceGames = buildThirdPlaceGame(currentGames, bracketType);

      if (thirdPlaceGames.length) {
        rounds.push({
          title: "3º lugar",
          bracketTitle,
          games: thirdPlaceGames,
        });
      }
    }

    rounds.push({
      title: nextRoundName,
      bracketTitle,
      games: nextGames,
    });

    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}
