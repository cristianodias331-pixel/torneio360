export function generatePublicId(now = Date.now, random = Math.random) {
  return `tfbt_${now().toString(36)}_${random().toString(36).slice(2, 8)}`;
}

export function generateCollaborationChangeId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function getPublicUrl(
  publicId,
  { origin = window.location.origin, pathname = window.location.pathname } = {},
) {
  return `${origin}${pathname}?public=${publicId}`;
}

export function getArenaPublicUrl(arenaId, { origin = window.location.origin } = {}) {
  const url = new URL(origin);
  url.searchParams.set("arena", arenaId);
  return url.toString();
}

export function getArenaPublicShareMessage(arenaId, options) {
  const url = getArenaPublicUrl(arenaId, options);
  return `Acompanhe os torneios e circuitos desta arena no Torneio360:\n${url}`;
}
