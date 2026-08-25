export const USER_APP_STATE_MIN_CLOUD_INTERVAL_MS = 30_000;

const userAppStateSignatureFields = [
  "last_url",
  "last_panel",
  "last_tournament_id",
  "last_tournament_tab",
  "last_matches_tab",
  "last_circuit_id",
  "last_profile_subtab",
  "scroll_y",
];

export function getUserAppStateSyncSignature(payload = {}) {
  return JSON.stringify(userAppStateSignatureFields.map((field) => payload?.[field] ?? null));
}

export function getUserAppStateCloudDelay({
  payload,
  lastSignature = "",
  lastSavedAt = 0,
  now = Date.now(),
  force = false,
  minimumInterval = USER_APP_STATE_MIN_CLOUD_INTERVAL_MS,
} = {}) {
  const signature = getUserAppStateSyncSignature(payload);
  if (!force && signature === lastSignature) return null;
  if (force) return 0;
  return Math.max(0, Number(minimumInterval || 0) - Math.max(0, now - Number(lastSavedAt || 0)));
}
