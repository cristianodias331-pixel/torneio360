import { isFlexibleSimpleType, isReizinhoType } from "./modalityClassification.mjs";

export function getSimplePlayerCount(config, data = null) {
  const allowedCounts = config?.allowedPlayerCounts || [config?.total || 8];
  const storedCount = Number(
    data?.simplePlayerCount
      ?? (Array.isArray(data?.players) ? data.players.length : null)
      ?? config?.defaultPlayers
      ?? config?.total
      ?? 8
  );

  return allowedCounts.includes(storedCount)
    ? storedCount
    : (config?.defaultPlayers || config?.total || allowedCounts[0] || 8);
}

export function getReizinhoPlayerCount(config, data = null) {
  const allowedCounts = config?.allowedPlayerCounts || [4, 6];
  const storedCount = Number(
    data?.reizinhoPlayerCount
      ?? (Array.isArray(data?.players) ? data.players.length : null)
      ?? config?.defaultPlayers
      ?? 4
  );
  return allowedCounts.includes(storedCount) ? storedCount : (config?.defaultPlayers || 4);
}

export function getTournamentCourtCount(config, data = null) {
  if (isFlexibleSimpleType(config)) return Math.max(1, getSimplePlayerCount(config, data) / 2);
  if (isReizinhoType(config)) return 1;
  return Math.max(1, config?.courts || 1);
}
