export const ARENA_DIRECTORY_REFRESH_INTERVAL_MS = 60_000;
export const ARENA_DIRECTORY_RETRY_DELAY_MS = 450;
export const ARENA_DIRECTORY_CACHE_KEY = "t360.public-arena-directory.v2";
export const ARENA_DIRECTORY_CACHE_MAX_AGE_MS = 5 * 60_000;
export const PUBLIC_ARENA_BUNDLE_CACHE_PREFIX = "t360.public-arena-bundle.v2";
export const PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS = 30 * 60_000;
export const PUBLIC_ARENA_REQUEST_TIMEOUT_MS = 12_000;

const publicArenaBundleMemoryCache = new Map();
const publicTournamentDetailMemoryCache = new Map();
const publicCircuitDetailMemoryCache = new Map();
const publicArenaPhotoMemoryCache = new Map();

export function readPublicArenaCache(key, maxAge, now = Date.now()) {
  if (typeof window === "undefined") return null;

  try {
    const cached = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (!cached || (!Array.isArray(cached.data) && typeof cached.data !== "object")) return null;
    if (!Number.isFinite(Number(cached.savedAt))) return null;
    if (now - Number(cached.savedAt) > maxAge) return null;
    return cached.data;
  } catch (error) {
    return null;
  }
}

export function writePublicArenaCache(key, data, savedAt = Date.now()) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify({ data, savedAt }));
  } catch (error) {
    // O cache é apenas uma aceleração. Falhas de armazenamento não interrompem a navegação.
  }
}

export function readPublicArenaDirectoryCache(now = Date.now()) {
  const cached = readPublicArenaCache(
    ARENA_DIRECTORY_CACHE_KEY,
    ARENA_DIRECTORY_CACHE_MAX_AGE_MS,
    now,
  );
  return Array.isArray(cached) ? cached.filter((arena) => arena?.id) : null;
}

export function getPublicArenaBundleCacheKey({ arenaId = null, publicId = null } = {}) {
  const identifier = arenaId || publicId;
  return identifier ? `${PUBLIC_ARENA_BUNDLE_CACHE_PREFIX}:${identifier}` : "";
}

function readTimedMemoryCache(cache, key, maxAge, now = Date.now()) {
  if (!key) return null;

  const cached = cache.get(key);
  if (!cached || now - cached.savedAt > maxAge) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function writeTimedMemoryCache(cache, key, data, savedAt = Date.now()) {
  if (key) cache.set(key, { data, savedAt });
}

export function readPublicArenaBundleCache(params, now = Date.now()) {
  return readTimedMemoryCache(
    publicArenaBundleMemoryCache,
    getPublicArenaBundleCacheKey(params),
    PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS,
    now,
  );
}

export function writePublicArenaBundleCache(params, data, savedAt = Date.now()) {
  writeTimedMemoryCache(
    publicArenaBundleMemoryCache,
    getPublicArenaBundleCacheKey(params),
    data,
    savedAt,
  );
}

export function readPublicTournamentDetailCache(publicId, now = Date.now()) {
  return readTimedMemoryCache(
    publicTournamentDetailMemoryCache,
    publicId,
    PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS,
    now,
  );
}

export function writePublicTournamentDetailCache(publicId, data, savedAt = Date.now()) {
  writeTimedMemoryCache(publicTournamentDetailMemoryCache, publicId, data, savedAt);
}

export function readPublicCircuitDetailCache(circuitId, now = Date.now()) {
  return readTimedMemoryCache(
    publicCircuitDetailMemoryCache,
    circuitId,
    PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS,
    now,
  );
}

export function writePublicCircuitDetailCache(circuitId, data, savedAt = Date.now()) {
  writeTimedMemoryCache(publicCircuitDetailMemoryCache, circuitId, data, savedAt);
}

export function readPublicArenaPhotoCache(arenaId) {
  if (!arenaId || !publicArenaPhotoMemoryCache.has(arenaId)) {
    return { found: false, data: "" };
  }

  return {
    found: true,
    data: publicArenaPhotoMemoryCache.get(arenaId) || "",
  };
}

export function writePublicArenaPhotoCache(arenaId, photoUrl) {
  if (arenaId) publicArenaPhotoMemoryCache.set(arenaId, photoUrl || "");
}
