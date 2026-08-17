export function getGameParticipantIdentityEntries(game = {}) {
  return ["1", "2"].flatMap((side) => {
    const ids = Array.isArray(game[`ids${side}`]) ? game[`ids${side}`] : [];
    const names = Array.isArray(game[`team${side}`]) ? game[`team${side}`] : [];

    return ids.map((id, index) => ({
      key: `participant:${id}`,
      name: String(names[index] || names.join(" + ") || `Participante ${Number(id) + 1}`),
    }));
  });
}

export function getSharedGameParticipants(firstGame, secondGame) {
  const secondParticipants = new Map(
    getGameParticipantIdentityEntries(secondGame).map((participant) => [participant.key, participant])
  );

  return getGameParticipantIdentityEntries(firstGame)
    .filter((participant) => secondParticipants.has(participant.key))
    .map((participant) => ({
      ...participant,
      name: participant.name || secondParticipants.get(participant.key)?.name || "Participante",
    }));
}
