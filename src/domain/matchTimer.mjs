export const MAX_MATCH_TIMER_SECONDS = 59 * 60;

function clampMatchTimerSeconds(value) {
  return Math.min(
    MAX_MATCH_TIMER_SECONDS,
    Math.max(0, Math.floor(Number(value || 0)))
  );
}

export function getMatchTimerTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getMatchElapsedSeconds(game, now = Date.now()) {
  const storedSeconds = clampMatchTimerSeconds(game?.matchTimerElapsedSeconds);
  const finishedAt = getMatchTimerTimestamp(game?.matchTimerFinishedAt);

  // Um término registrado sempre congela o cronômetro. Essa precedência
  // também corrige partidas antigas que ficaram com `inProgress` ou
  // `matchTimerStartedAt` salvos por uma sincronização anterior.
  if (finishedAt !== null) {
    if (storedSeconds > 0) return storedSeconds;
    const firstStartedAt = getMatchTimerTimestamp(
      game?.matchTimerFirstStartedAt || game?.matchTimerStartedAt
    );
    return firstStartedAt === null
      ? 0
      : clampMatchTimerSeconds((finishedAt - firstStartedAt) / 1000);
  }

  const startedAt = getMatchTimerTimestamp(game?.matchTimerStartedAt);
  if (game?.inProgress !== true || startedAt === null) return storedSeconds;
  return clampMatchTimerSeconds(
    storedSeconds + Math.max(0, Math.floor((now - startedAt) / 1000))
  );
}

export function getMatchTimerRemainingMilliseconds(game, now = Date.now()) {
  if (game?.inProgress !== true || !game?.matchTimerStartedAt) return null;
  const elapsedSeconds = getMatchElapsedSeconds(game, now);
  if (elapsedSeconds >= MAX_MATCH_TIMER_SECONDS) return 0;
  const startedAt = getMatchTimerTimestamp(game.matchTimerStartedAt);
  if (startedAt === null) return null;
  const elapsedMilliseconds = Math.max(0, now - startedAt);
  const storedMilliseconds = clampMatchTimerSeconds(game?.matchTimerElapsedSeconds) * 1000;
  return Math.max(0, (MAX_MATCH_TIMER_SECONDS * 1000) - storedMilliseconds - elapsedMilliseconds);
}

export function capExpiredMatchTimer(game, now = Date.now()) {
  if (game?.inProgress !== true || !game?.matchTimerStartedAt) return false;
  if (getMatchElapsedSeconds(game, now) < MAX_MATCH_TIMER_SECONDS) return false;
  game.matchTimerElapsedSeconds = MAX_MATCH_TIMER_SECONDS;
  delete game.matchTimerStartedAt;
  game.inProgress = false;
  return true;
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
  game.matchTimerElapsedSeconds = clampMatchTimerSeconds(getMatchElapsedSeconds(game, now));
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
    matchTimerElapsedSeconds: clampMatchTimerSeconds(game.matchTimerElapsedSeconds),
  };
  if (game.matchTimerStartedAt) fields.matchTimerStartedAt = game.matchTimerStartedAt;
  if (game.matchTimerFirstStartedAt) fields.matchTimerFirstStartedAt = game.matchTimerFirstStartedAt;
  if (game.matchTimerFinishedAt) fields.matchTimerFinishedAt = game.matchTimerFinishedAt;
  return fields;
}
