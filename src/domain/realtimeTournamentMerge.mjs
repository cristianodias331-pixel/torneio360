export function getCollaborationRevision(row) {
  if (row?.revision === null || row?.revision === undefined || row?.revision === "") return null;
  const revision = Number(row?.revision);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function compareCollaborationVersions(first, second) {
  const firstRevision = getCollaborationRevision(first);
  const secondRevision = getCollaborationRevision(second);

  if (firstRevision !== null || secondRevision !== null) {
    if (firstRevision === null) return -1;
    if (secondRevision === null) return 1;
    return firstRevision - secondRevision;
  }

  const firstUpdatedAt = Date.parse(first?.updated_at || first?.updatedAt || "") || 0;
  const secondUpdatedAt = Date.parse(second?.updated_at || second?.updatedAt || "") || 0;
  return firstUpdatedAt - secondUpdatedAt;
}

export function tournamentDataEquals(first, second) {
  if (Object.is(first, second)) return true;
  try {
    return JSON.stringify(first || {}) === JSON.stringify(second || {});
  } catch {
    return false;
  }
}

export function tournamentMutationDataEquals(first, second) {
  const firstData = { ...(first || {}) };
  const secondData = { ...(second || {}) };
  delete firstData.lifecycleStatus;
  delete secondData.lifecycleStatus;
  return tournamentDataEquals(firstData, secondData);
}

export function mergeRealtimeTournamentRow(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  if (compareCollaborationVersions(incoming, existing) < 0) return existing;

  const incomingHasCompleteData = incoming.data
    && typeof incoming.data === "object"
    && !Array.isArray(incoming.data)
    && Object.keys(incoming.data).length > 0;

  return {
    ...existing,
    ...incoming,
    data: incomingHasCompleteData ? incoming.data : existing.data,
  };
}
