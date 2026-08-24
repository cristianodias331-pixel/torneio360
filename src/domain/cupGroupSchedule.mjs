import {
  createCearenseGroups,
  createCupGroups,
  createRoundRobinPairings,
  getTeamName,
} from "./cupGroups.mjs";

export function generateCearenseGroupSchedule(players, cupConfig) {
  const teamCount = cupConfig.teamCount || 4;
  const groups = createCearenseGroups(
    teamCount,
    cupConfig.format === "sunset" ? cupConfig.groupFormation : "automatic",
    cupConfig.groupSizes,
  );
  const teamNames = players.teams.map((team) => getTeamName(team));
  const groupRounds = groups.map((group) => createRoundRobinPairings(group.teamIds));
  const roundCount = Math.max(...groupRounds.map((rounds) => rounds.length));
  const rounds = Array.from({ length: roundCount }, () => []);

  groupRounds.forEach((scheduledRounds, groupIndex) => {
    scheduledRounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([id1, id2]) => {
        rounds[roundIndex].push({
          phase: "groups",
          groupId: groups[groupIndex].id,
          groupName: groups[groupIndex].name,
          team1: [teamNames[id1]],
          ids1: [id1],
          team2: [teamNames[id2]],
          ids2: [id2],
          s1: "",
          s2: "",
        });
      });
    });
  });

  return rounds.map((round) => round.map((game, index) => ({
    ...game,
    court: index + 1,
  })));
}

export function generateCupGroupSchedule(players, cupConfig) {
  const teamCount = cupConfig.teamCount || 12;
  const format = cupConfig.format || cupConfig.cupMode || "";

  if (format === "cearense" || format === "cearense-individual" || format === "playranking" || format === "sunset") {
    return generateCearenseGroupSchedule(players, cupConfig);
  }

  const groups = createCupGroups(teamCount, format, cupConfig);
  const teamNames = players.teams.map((team) => getTeamName(team));

  const roundTemplates = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  const rounds = [[], [], []];

  groups.forEach((group, groupIndex) => {
    roundTemplates.forEach(([aIndex, bIndex], roundIndex) => {
      const id1 = group.teamIds[aIndex];
      const id2 = group.teamIds[bIndex];

      rounds[roundIndex].push({
        phase: "groups",
        groupId: group.id,
        groupName: group.name,
        court: groupIndex + 1,
        team1: [teamNames[id1]],
        ids1: [id1],
        team2: [teamNames[id2]],
        ids2: [id2],
        s1: "",
        s2: "",
      });
    });
  });

  return rounds.map((round) =>
    round.map((game, index) => ({
      ...game,
      court: index + 1,
    }))
  );
}
