function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const normalized = normalizeJsonValue(value[key]);
        if (normalized !== undefined) result[key] = normalized;
        return result;
      }, {});
  }

  if (["undefined", "function", "symbol"].includes(typeof value)) return undefined;
  return value;
}

export function stableJsonStringify(value) {
  return JSON.stringify(normalizeJsonValue(value));
}

export function tournamentSnapshotMatches(serverTournament, expectedTournament, expectedData = expectedTournament?.data) {
  if (!serverTournament || !expectedTournament) return false;

  return String(serverTournament.id) === String(expectedTournament.id)
    && String(serverTournament.name || "") === String(expectedTournament.name || "")
    && String(serverTournament.type || "") === String(expectedTournament.type || "")
    && stableJsonStringify(serverTournament.data || {}) === stableJsonStringify(expectedData || {});
}
