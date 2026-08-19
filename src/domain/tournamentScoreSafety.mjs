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
  return JSON.stringify({
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
    fallbackIndex,
  });
}

function hasCompleteScore(game) {
  return game?.s1 !== "" && game?.s1 !== null && game?.s1 !== undefined
    && game?.s2 !== "" && game?.s2 !== null && game?.s2 !== undefined;
}

function flattenGames(data, field) {
  const value = data?.[field];
  if (!Array.isArray(value)) return [];
  if (field === "schedule") return value.filter(Array.isArray).flat();
  return value;
}

function inspectCollection(beforeData, afterData, field) {
  const beforeGames = flattenGames(beforeData, field);
  const afterGames = flattenGames(afterData, field);
  const completedBeforeGames = beforeGames
    .map((game, index) => ({ game, identity: getGameIdentity(game, index) }))
    .filter(({ game }) => hasCompleteScore(game));
  if (!completedBeforeGames.length) return null;

  const completedAfterIdentities = new Set(
    afterGames
      .map((game, index) => ({ game, identity: getGameIdentity(game, index) }))
      .filter(({ game }) => hasCompleteScore(game))
      .map(({ identity }) => identity)
  );
  const removedScores = completedBeforeGames.reduce(
    (count, { identity }) => count + (completedAfterIdentities.has(identity) ? 0 : 1),
    0
  );

  return {
    field,
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
  const removalRatio = completedBefore > 0 ? removedScores / completedBefore : 0;

  return {
    comparable: collections.length > 0,
    completedBefore,
    completedAfter,
    removedScores,
    removalRatio,
    unsafe: removedScores > 0,
    collections,
  };
}
