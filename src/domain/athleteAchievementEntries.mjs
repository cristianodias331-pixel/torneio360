function normalizeIdentityName(value) {
  return String(value || "")
    .replace(/^\s*\d+\.\s*/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildVerifiedPodiumEntries({
  podium,
  identityIndex,
  bracketName = "Principal",
  category = "",
  eventDate = "",
}) {
  if (!Array.isArray(podium) || podium.length === 0 || !(identityIndex instanceof Map)) return [];

  const bracketKey = String(bracketName || "Principal");
  const entries = [];
  const seen = new Set();

  podium.slice(0, 3).forEach((item, placementIndex) => {
    const identities = String(item?.name || "")
      .split(/\s+\+\s+/)
      .map((name) => identityIndex.get(normalizeIdentityName(name)) || null);

    identities.forEach((identity, identityIndexInTeam) => {
      if (!identity?.user_id) return;
      const entryKey = `${identity.user_id}:${bracketKey}`;
      if (seen.has(entryKey)) return;
      seen.add(entryKey);

      const partner = identities.length === 2
        ? identities[identityIndexInTeam === 0 ? 1 : 0]
        : null;

      entries.push({
        athlete_user_id: identity.user_id,
        partner_user_id: partner?.user_id || null,
        placement: placementIndex + 1,
        bracket_name: bracketKey,
        category: category || "",
        event_date: eventDate || "",
      });
    });
  });

  return entries;
}
