export function getMatchTimerTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getMatchElapsedSeconds(game, now = Date.now()) {
  const storedSeconds = Math.max(0, Math.floor(Number(game?.matchTimerElapsedSeconds || 0)));
  const startedAt = getMatchTimerTimestamp(game?.matchTimerStartedAt);
  if (game?.inProgress !== true || startedAt === null) return storedSeconds;
  return storedSeconds + Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatMatchDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMatchTotalDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function startMatchTimer(game, now = Date.now()) {
  if (!game || game.matchTimerStartedAt) return game;
  const startedAt = new Date(now).toISOString();
  game.matchTimerStartedAt = startedAt;
  if (!game.matchTimerFirstStartedAt) game.matchTimerFirstStartedAt = startedAt;
  delete game.matchTimerFinishedAt;
  return game;
}

export function stopMatchTimer(game, { finished = false, now = Date.now() } = {}) {
  if (!game) return game;
  game.matchTimerElapsedSeconds = getMatchElapsedSeconds(game, now);
  delete game.matchTimerStartedAt;
  if (finished && game.matchTimerFirstStartedAt) {
    game.matchTimerFinishedAt = new Date(now).toISOString();
  }
  return game;
}

export function resetMatchTimer(game) {
  if (!game) return game;
  delete game.matchTimerStartedAt;
  delete game.matchTimerFirstStartedAt;
  delete game.matchTimerFinishedAt;
  delete game.matchTimerElapsedSeconds;
  return game;
}

export function getMatchTimerFields(game) {
  if (!game) return {};
  const fields = {
    matchTimerElapsedSeconds: Math.max(0, Math.floor(Number(game.matchTimerElapsedSeconds || 0))),
  };
  if (game.matchTimerStartedAt) fields.matchTimerStartedAt = game.matchTimerStartedAt;
  if (game.matchTimerFirstStartedAt) fields.matchTimerFirstStartedAt = game.matchTimerFirstStartedAt;
  if (game.matchTimerFinishedAt) fields.matchTimerFinishedAt = game.matchTimerFinishedAt;
  return fields;
}
