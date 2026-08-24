export function getTeamName(team) {
  if (!team) return "";
  return [team.a, team.b].filter((name) => String(name || "").trim()).join(" + ");
}

export function getCupTeams(data) {
  return data?.players?.teams || [];
}

export function getCupTeamName(data, id) {
  const team = getCupTeams(data)[id];
  return getTeamName(team);
}

export function getGroupLetter(index) {
  return String.fromCharCode(65 + index);
}

export function normalizeCearenseGroupSizes(teamCount, groupSizes) {
  const safeTeamCount = Math.max(4, Math.min(32, Number(teamCount) || 4));
  if (!Array.isArray(groupSizes) || groupSizes.length === 0) return null;

  const normalized = groupSizes.map(Number);
  const valid = normalized.every((size) => Number.isInteger(size) && size >= 3 && size <= 4)
    && normalized.reduce((total, size) => total + size, 0) === safeTeamCount;

  return valid ? normalized : null;
}

export function createCearenseGroups(
  teamCount,
  groupFormation = "automatic",
  customGroupSizes = null,
) {
  const safeTeamCount = Math.max(4, Math.min(32, Number(teamCount) || 4));
  const groupSizes = [];
  const normalizedCustomGroupSizes = normalizeCearenseGroupSizes(safeTeamCount, customGroupSizes);

  if (normalizedCustomGroupSizes) {
    groupSizes.push(...normalizedCustomGroupSizes);
  } else if (groupFormation === "all-four" && safeTeamCount % 4 === 0) {
    groupSizes.push(...Array.from({ length: safeTeamCount / 4 }, () => 4));
  } else if (safeTeamCount <= 5) {
    groupSizes.push(safeTeamCount);
  } else {
    const groupCount = Math.floor(safeTeamCount / 3);
    const groupsWithFour = safeTeamCount % 3;

    for (let index = 0; index < groupCount; index += 1) {
      groupSizes.push(index < groupsWithFour ? 4 : 3);
    }
  }

  let nextTeamId = 0;

  return groupSizes.map((size, index) => {
    const teamIds = Array.from({ length: size }, () => nextTeamId++);

    return {
      id: index,
      name: `Grupo ${getGroupLetter(index)}`,
      teamIds,
    };
  });
}

export function describeCearenseGroupSizes(groups, participantPlural = "duplas") {
  const countsBySize = groups.reduce((summary, group) => {
    const size = group.teamIds.length;
    summary[size] = (summary[size] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(countsBySize)
    .sort(([firstSize], [secondSize]) => Number(firstSize) - Number(secondSize))
    .map(([size, count]) => `${count} ${count === 1 ? "grupo" : "grupos"} de ${size} ${participantPlural}`)
    .join(" e ");
}

export function createCupGroups(teamCount, format = "", cupConfig = {}) {
  if (format === "cearense" || format === "cearense-individual" || format === "playranking" || format === "sunset") {
    return createCearenseGroups(
      teamCount,
      format === "sunset" ? cupConfig.groupFormation : "automatic",
      cupConfig.groupSizes,
    );
  }

  const groups = [];

  for (let i = 0; i < teamCount / 3; i++) {
    groups.push({
      id: i,
      name: `Grupo ${getGroupLetter(i)}`,
      teamIds: [i * 3, i * 3 + 1, i * 3 + 2],
    });
  }

  return groups;
}

export function createRoundRobinPairings(teamIds) {
  const rotation = [...teamIds];

  if (rotation.length % 2 === 1) rotation.push(null);

  const rounds = [];

  for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
    const pairs = [];

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];

      if (first !== null && second !== null) pairs.push([first, second]);
    }

    rounds.push(pairs);
    rotation.splice(1, 0, rotation.pop());
  }

  return rounds;
}
