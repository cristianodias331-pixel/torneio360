function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function getGameIdentity(game, fallbackIndex) {
  if (!isRecord(game)) return `invalid:${fallbackIndex}`;
  if (game.matchKey) return `match:${game.matchKey}`;
  const ids1 = normalizeList(game.ids1);
  const ids2 = normalizeList(game.ids2);
  const hasParticipantIds = ids1.length > 0 || ids2.length > 0;
  const identity = {
    ids1,
    ids2,
    team1: hasParticipantIds ? [] : normalizeList(game.team1),
    team2: hasParticipantIds ? [] : normalizeList(game.team2),
    entry1: game.entry1 ?? null,
    entry2: game.entry2 ?? null,
    source1: game.source1 ?? null,
    source2: game.source2 ?? null,
    source1Mode: game.source1Mode ?? null,
    source2Mode: game.source2Mode ?? null,
    isBye: Boolean(game.isBye),
  };
  const hasStableIdentity = hasParticipantIds
    || identity.team1.length > 0
    || identity.team2.length > 0
    || identity.entry1 !== null
    || identity.entry2 !== null
    || identity.source1 !== null
    || identity.source2 !== null;
  return hasStableIdentity ? JSON.stringify(identity) : `game:${fallbackIndex}`;
}

function hasCompleteScore(game) {
  return game?.s1 !== "" && game?.s1 !== null && game?.s1 !== undefined
    && game?.s2 !== "" && game?.s2 !== null && game?.s2 !== undefined;
}

function flattenGames(data, field) {
  const value = data?.[field];
  if (!Array.isArray(value)) return [];
  if (field === "schedule") return value.flatMap((round) => (Array.isArray(round) ? round : [round]));
  return value;
}

function countScheduleRounds(data) {
  const schedule = data?.schedule;
  if (!Array.isArray(schedule) || schedule.length === 0) return 0;
  return schedule.some(Array.isArray) ? schedule.filter(Array.isArray).length : 1;
}

function inspectCollection(beforeData, afterData, field) {
  const beforeGames = flattenGames(beforeData, field);
  const afterGames = flattenGames(afterData, field);
  const removedGames = Math.max(0, beforeGames.length - afterGames.length);
  const completedBeforeGames = beforeGames
    .map((game, index) => ({ game, identity: getGameIdentity(game, index) }))
    .filter(({ game }) => hasCompleteScore(game));
  if (!beforeGames.length) return null;

  const completedAfterIdentityCounts = afterGames
    .map((game, index) => ({ game, identity: getGameIdentity(game, index) }))
    .filter(({ game }) => hasCompleteScore(game))
    .reduce((counts, { identity }) => {
      counts.set(identity, (counts.get(identity) || 0) + 1);
      return counts;
    }, new Map());
  const removedScores = completedBeforeGames.reduce((count, { identity }) => {
    const remaining = completedAfterIdentityCounts.get(identity) || 0;
    if (remaining <= 0) return count + 1;
    completedAfterIdentityCounts.set(identity, remaining - 1);
    return count;
  }, 0);

  return {
    field,
    gamesBefore: beforeGames.length,
    gamesAfter: afterGames.length,
    removedGames,
    completedBefore: completedBeforeGames.length,
    completedAfter: afterGames.filter(hasCompleteScore).length,
    removedScores,
  };
}

export function inspectTournamentScoreRegression(beforeData, afterData) {
  const collections = ["schedule", "brackets"]
    .map((field) => inspectCollection(beforeData, afterData, field))
    .filter(Boolean);
  const completedBefore = collections.reduce((sum, item) => sum + item.completedBefore, 0);
  const completedAfter = collections.reduce((sum, item) => sum + item.completedAfter, 0);
  const removedScores = collections.reduce((sum, item) => sum + item.removedScores, 0);
  const gamesBefore = collections.reduce((sum, item) => sum + item.gamesBefore, 0);
  const gamesAfter = collections.reduce((sum, item) => sum + item.gamesAfter, 0);
  const removedGames = collections.reduce((sum, item) => sum + item.removedGames, 0);
  const roundsBefore = countScheduleRounds(beforeData);
  const roundsAfter = countScheduleRounds(afterData);
  const removedRounds = Math.max(0, roundsBefore - roundsAfter);
  const removalRatio = completedBefore > 0 ? removedScores / completedBefore : 0;

  return {
    comparable: collections.length > 0,
    completedBefore,
    completedAfter,
    removedScores,
    gamesBefore,
    gamesAfter,
    removedGames,
    roundsBefore,
    roundsAfter,
    removedRounds,
    removalRatio,
    unsafe: removedScores > 0 || removedGames > 0 || removedRounds > 0,
    collections,
  };
}
