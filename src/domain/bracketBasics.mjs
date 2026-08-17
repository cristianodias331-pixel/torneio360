function createSeededGames(pairs, bracketType, roundName, keySegment) {
  return pairs.map((pair, index) => ({
    phase: bracketType,
    roundName,
    matchKey: `${bracketType}_${keySegment}_${index + 1}`,
    source1: null,
    source2: null,
    ids1: [pair[0]],
    ids2: [pair[1]],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court: index + 1,
  }));
}

export function seedBracket(teamIds, bracketType) {
  if (teamIds.length === 4) {
    return createSeededGames([
      [teamIds[0], teamIds[3]],
      [teamIds[1], teamIds[2]],
    ], bracketType, "Semifinal", "sf");
  }

  if (teamIds.length === 8) {
    return createSeededGames([
      [teamIds[0], teamIds[7]],
      [teamIds[3], teamIds[4]],
      [teamIds[2], teamIds[5]],
      [teamIds[1], teamIds[6]],
    ], bracketType, "Quartas de final", "qf");
  }

  if (teamIds.length === 7) {
    return createSeededGames([
      [teamIds[1], teamIds[6]],
      [teamIds[2], teamIds[5]],
      [teamIds[3], teamIds[4]],
    ], bracketType, "Preliminar", "pre");
  }

  if (teamIds.length === 14) {
    return createSeededGames([
      [teamIds[2], teamIds[13]],
      [teamIds[3], teamIds[12]],
      [teamIds[4], teamIds[11]],
      [teamIds[5], teamIds[10]],
      [teamIds[6], teamIds[9]],
      [teamIds[7], teamIds[8]],
    ], bracketType, "Preliminar", "pre");
  }

  if (teamIds.length === 16) {
    return createSeededGames([
      [teamIds[0], teamIds[15]],
      [teamIds[7], teamIds[8]],
      [teamIds[4], teamIds[11]],
      [teamIds[3], teamIds[12]],
      [teamIds[2], teamIds[13]],
      [teamIds[5], teamIds[10]],
      [teamIds[6], teamIds[9]],
      [teamIds[1], teamIds[14]],
    ], bracketType, "Oitavas de final", "r16");
  }

  return [];
}

export function generateParallelRoundRobin(teamIds) {
  const pairs = [
    [teamIds[0], teamIds[1]],
    [teamIds[2], teamIds[3]],
    [teamIds[0], teamIds[2]],
    [teamIds[1], teamIds[3]],
    [teamIds[0], teamIds[3]],
    [teamIds[1], teamIds[2]],
  ];

  return pairs.map((pair, index) => ({
    phase: "repechage",
    roundName: "Disputa Paralela",
    matchKey: `repechage_parallel_${index + 1}`,
    source1: null,
    source2: null,
    ids1: [pair[0]],
    ids2: [pair[1]],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court: (index % 2) + 1,
  }));
}

export function getLargestPowerOfTwo(value) {
  let power = 1;

  while (power * 2 <= value) {
    power *= 2;
  }

  return power;
}

export function getNextPowerOfTwo(value) {
  let power = 1;

  while (power < value) {
    power *= 2;
  }

  return power;
}

export function getBracketSeedOrder(size) {
  let order = [1, 2];

  while (order.length < size) {
    const nextSize = order.length * 2;
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }

  return order;
}

export function getEliminationRoundName(teamCount) {
  if (teamCount === 2) return "Final";
  if (teamCount === 4) return "Semifinal";
  if (teamCount === 8) return "Quartas de final";
  if (teamCount === 16) return "Oitavas de final";
  if (teamCount === 32) return "Fase de 32";
  return `Rodada de ${teamCount}`;
}
