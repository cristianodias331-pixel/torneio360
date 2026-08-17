import {
  getBracketSeedOrder,
  getEliminationRoundName,
  getNextPowerOfTwo,
} from "./bracketBasics.mjs";
import { buildNextRound, buildThirdPlaceGame } from "./bracketProgression.mjs";

export function getCopinhaPreliminaryPairs(entries) {
  const remaining = [...entries];
  const pairs = [];

  while (remaining.length > 1) {
    const first = remaining.shift();
    let opponentIndex = -1;

    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].groupId !== first.groupId) {
        opponentIndex = index;
        break;
      }
    }

    if (opponentIndex < 0) opponentIndex = remaining.length - 1;
    pairs.push([first, remaining.splice(opponentIndex, 1)[0]]);
  }

  return pairs;
}

export function createCopinhaBracketGame({
  bracketType,
  roundName,
  matchKey,
  entry1,
  entry2,
  court,
}) {
  return {
    phase: bracketType,
    roundName,
    matchKey,
    source1: entry1?.sourceMatchKey || null,
    source2: entry2?.sourceMatchKey || null,
    source1Mode: entry1?.sourceMode || null,
    source2Mode: entry2?.sourceMode || null,
    ids1: Number.isInteger(entry1?.id) ? [entry1.id] : [],
    ids2: Number.isInteger(entry2?.id) ? [entry2.id] : [],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court,
  };
}

export function avoidSameGroupOpeningMatches(slots) {
  const arranged = [...slots];

  for (let index = 0; index < arranged.length; index += 2) {
    const first = arranged[index];
    const second = arranged[index + 1];

    if (!first || !second || first.groupId !== second.groupId) continue;

    let swapIndex = -1;

    for (let candidateIndex = 0; candidateIndex < arranged.length; candidateIndex += 1) {
      if (candidateIndex === index || candidateIndex === index + 1) continue;
      const candidate = arranged[candidateIndex];
      if (!candidate || candidate.groupId === first.groupId) continue;
      const preserveMainSeedType = first.groupPosition <= 2 || second.groupPosition <= 2;
      if (preserveMainSeedType && candidate.groupPosition !== second.groupPosition) continue;

      const candidatePairIndex = candidateIndex % 2 === 0 ? candidateIndex + 1 : candidateIndex - 1;
      const candidateOpponent = arranged[candidatePairIndex];

      if (!candidateOpponent || candidateOpponent.groupId !== second.groupId) {
        swapIndex = candidateIndex;
        break;
      }
    }

    if (swapIndex >= 0) {
      [arranged[index + 1], arranged[swapIndex]] = [arranged[swapIndex], arranged[index + 1]];
    }
  }

  return arranged;
}

export function buildCearenseEliminationRounds(entries, bracketType, bracketTitle, includeThirdPlace = false) {
  if (!Array.isArray(entries) || entries.length < 2) return [];

  const bracketSize = getNextPowerOfTwo(entries.length);
  const seedOrder = getBracketSeedOrder(bracketSize);
  const seededSlots = avoidSameGroupOpeningMatches(
    seedOrder.map((seed) => entries[seed - 1] || null)
  );
  const openingRoundName = getEliminationRoundName(bracketSize);
  const openingGames = [];

  for (let index = 0; index < seededSlots.length; index += 2) {
    const entry1 = seededSlots[index];
    const entry2 = seededSlots[index + 1];

    openingGames.push({
      ...createCopinhaBracketGame({
        bracketType,
        roundName: openingRoundName,
        matchKey: `${bracketType}_r${bracketSize}_${openingGames.length + 1}`,
        entry1,
        entry2,
        court: openingGames.length + 1,
      }),
      isBye: Boolean(entry1) !== Boolean(entry2),
    });
  }

  const rounds = [{ title: openingRoundName, bracketTitle, games: openingGames }];
  let currentGames = openingGames;
  let currentTeamCount = bracketSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(currentGames, bracketType, nextRoundName, `r${nextTeamCount}`);

    if (nextTeamCount === 2 && includeThirdPlace) {
      const thirdPlaceGames = buildThirdPlaceGame(currentGames, bracketType);

      if (thirdPlaceGames.length) {
        rounds.push({ title: "3º lugar", bracketTitle, games: thirdPlaceGames });
      }
    }

    rounds.push({ title: nextRoundName, bracketTitle, games: nextGames });
    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}
