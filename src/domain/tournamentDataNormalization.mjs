import {
  createDefaultCourtNumbers,
  normalizeCourtNumberValue,
  normalizeCourtNumbers,
} from "./courtNumbers.mjs";
import { modalityConfig } from "./modalityConfig.mjs";
import {
  isCupType,
  isFixedTeamType,
  isFlexibleSimpleType,
  isIndividualCupType,
  isMixedType,
  isReizinhoType,
} from "./modalityClassification.mjs";
import {
  getReizinhoPlayerCount,
  getSimplePlayerCount,
  getTournamentCourtCount,
} from "./modalitySettings.mjs";
import { normalizeParticipantAttendance } from "./participantAttendance.mjs";
import {
  getTournamentGenderLabel,
  inferTournamentGenderMode,
  normalizeParticipantGenderRegistry,
} from "./participantGenderRegistry.mjs";
import { formatParticipantName } from "./participantNames.mjs";
import {
  defaultRankingCriteria,
  rankingCriteriaOptions,
} from "./rankingCriteria.mjs";
import { getEffectiveTournamentGenderMode } from "./tournamentGenderConfig.mjs";

export function isTournamentDataObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeConfigurableCupName(value, fallback, legacyDefaults = []) {
  if (typeof value !== "string") return fallback;
  return legacyDefaults.includes(value.trim()) ? fallback : value;
}

export function normalizeNameList(values, count, label) {
  const source = Array.isArray(values) ? values : [];

  return Array.from({ length: count }, (_, index) => (
    typeof source[index] === "string" ? source[index] : `${label} ${index + 1}`
  ));
}

export function normalizeTeams(values, count) {
  const source = Array.isArray(values) ? values : [];

  return Array.from({ length: count }, (_, index) => {
    const team = isTournamentDataObject(source[index]) ? source[index] : {};

    return {
      a: typeof team.a === "string" ? team.a : `Atleta 1 da dupla ${index + 1}`,
      b: typeof team.b === "string" ? team.b : `Atleta 2 da dupla ${index + 1}`,
    };
  });
}

export function normalizeGameNames(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => String(item));
  }

  return value === null || value === undefined ? [] : [String(value)];
}

export function normalizeGameIds(value) {
  const source = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];

  return source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

export function normalizeGame(game, index) {
  const source = isTournamentDataObject(game) ? game : {};
  const court = Number(source.court);
  const courtNumberOverride = normalizeCourtNumberValue(source.courtNumberOverride || source.courtLabelOverride);

  const normalized = {
    ...source,
    court: Number.isFinite(court) && court > 0 ? court : index + 1,
    team1: normalizeGameNames(source.team1),
    team2: normalizeGameNames(source.team2),
    ids1: normalizeGameIds(source.ids1),
    ids2: normalizeGameIds(source.ids2),
    s1: source.s1 ?? "",
    s2: source.s2 ?? "",
  };

  delete normalized.courtLabelOverride;
  if (courtNumberOverride) normalized.courtNumberOverride = courtNumberOverride;

  return normalized;
}

export function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];

  return schedule
    .filter((round) => Array.isArray(round))
    .map((round) => round
      .filter((game) => isTournamentDataObject(game))
      .map((game, index) => normalizeGame(game, index))
    );
}

export function normalizeBrackets(brackets) {
  if (!Array.isArray(brackets)) return [];

  return brackets
    .filter((game) => isTournamentDataObject(game))
    .map((game, index) => normalizeGame(game, index));
}

export function formatParticipantNameWhileTyping(value) {
  const rawValue = String(value || "").normalize("NFKC");
  const hasTrailingSpace = /\s$/u.test(rawValue);
  const formattedValue = formatParticipantName(rawValue);
  return hasTrailingSpace && formattedValue ? `${formattedValue} ` : formattedValue;
}

export function normalizeIndividualCupPlayers(values, count) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: count }, (_, index) => {
    const participant = isTournamentDataObject(source[index]) ? source[index] : {};
    return {
      a: typeof participant.a === "string" ? participant.a : `Jogador ${index + 1}`,
      b: "",
    };
  });
}

export function createInitialData(type, config) {
  const simplePlayerCount = isFlexibleSimpleType(config)
    ? getSimplePlayerCount(config)
    : null;
  const reizinhoPlayerCount = isReizinhoType(config)
    ? getReizinhoPlayerCount(config)
    : null;
  const base = {
    rankingCriteria: defaultRankingCriteria,
    winningScore: 4,
    category: "",
    gender: "",
    participantGenderMode: "",
    genderOther: "",
    participantGenders: {},
    eventDate: "",
    eventDay: "",
    location: "",
    schedule: [],
    courtNumbers: createDefaultCourtNumbers(
      getTournamentCourtCount(config, simplePlayerCount
        ? { simplePlayerCount }
        : reizinhoPlayerCount ? { reizinhoPlayerCount } : null)
    ),
  };

  if (!config) {
    return { ...base, players: [] };
  }

  if (isMixedType(config)) {
    return {
      ...base,
      players: {
        men: Array.from({ length: config.men }, (_, i) => `Homem ${i + 1}`),
        women: Array.from({ length: config.women }, (_, i) => `Mulher ${i + 1}`),
      },
    };
  }

  if (isFixedTeamType(config)) {
    return {
      ...base,
      players: {
        teams: Array.from({ length: config.teams }, (_, i) => ({
          a: `Atleta 1 da dupla ${i + 1}`,
          b: `Atleta 2 da dupla ${i + 1}`,
        })),
      },
    };
  }

  if (isCupType(config)) {
    return {
      ...base,
      cupConfig: {
        format: config.cupMode || "standard",
        teamCount: config.defaultTeams,
        mainBracketName: config.defaultMainBracketName,
        repechageName: config.defaultRepechageName,
        ...(config.defaultSecondParallelName
          ? { secondParallelName: config.defaultSecondParallelName }
          : {}),
        ...(config.defaultThirdRepechageName
          ? { thirdRepechageName: config.defaultThirdRepechageName }
          : {}),
        ...(config.defaultSunsetBracketName
          ? { sunsetBracketName: config.defaultSunsetBracketName }
          : {}),
        ...(config.type === "sunset"
          ? { groupFormation: "automatic" }
          : {}),
        ...(config.type === "cearense" || config.type === "cearenseIndividual"
          ? {
            secondRepechageEnabled: true,
            thirdRepechageEnabled: false,
          }
          : {}),
        tieBreakOverrides: {},
        groupTieBreakOverrides: {},
        campaignTieBreakOverrides: {},
      },
      players: {
        teams: Array.from({ length: config.defaultTeams }, (_, i) => ({
          a: isIndividualCupType(config) ? `Jogador ${i + 1}` : `Atleta 1 da dupla ${i + 1}`,
          b: isIndividualCupType(config) ? "" : `Atleta 2 da dupla ${i + 1}`,
        })),
      },
      brackets: [],
    };
  }

  if (isFlexibleSimpleType(config)) {
    return {
      ...base,
      simplePlayerCount,
      players: Array.from({ length: simplePlayerCount }, (_, i) => `${config.label} ${i + 1}`),
    };
  }

  if (isReizinhoType(config)) {
    return {
      ...base,
      reizinhoPlayerCount,
      players: Array.from({ length: reizinhoPlayerCount }, (_, i) => `${config.label} ${i + 1}`),
    };
  }

  return {
    ...base,
    players: Array.from({ length: config.total }, (_, i) => `${config.label} ${i + 1}`),
  };
}

export function normalizeTournamentData(type, rawData) {
  const config = modalityConfig[type];

  if (!config) {
    return isTournamentDataObject(rawData) ? rawData : createInitialData(type, config);
  }

  const defaults = createInitialData(type, config);
  const source = isTournamentDataObject(rawData) ? rawData : {};
  const sourcePlayers = isTournamentDataObject(source.players) ? source.players : {};
  const simplePlayerCount = isFlexibleSimpleType(config)
    ? getSimplePlayerCount(config, source)
    : null;
  const reizinhoPlayerCount = isReizinhoType(config)
    ? getReizinhoPlayerCount(config, source)
    : null;
  const validWinningScore = [4, 6].includes(Number(source.winningScore));
  const validRankingCriteria = rankingCriteriaOptions.some((item) => item.value === source.rankingCriteria);
  const participantGenderMode = getEffectiveTournamentGenderMode(type, inferTournamentGenderMode(source));
  const usedCourtNumbers = [
    ...(Array.isArray(source.schedule) ? source.schedule.flat() : []),
    ...(Array.isArray(source.brackets) ? source.brackets : []),
  ]
    .map((game) => Number(game?.court))
    .filter((court) => Number.isFinite(court) && court > 0);
  const sourceCourtNumbers = Array.isArray(source.courtNumbers) ? source.courtNumbers : source.courtLabels;
  const courtCount = Math.max(
    getTournamentCourtCount(config, simplePlayerCount
      ? { ...source, simplePlayerCount }
      : reizinhoPlayerCount ? { ...source, reizinhoPlayerCount } : source),
    sourceCourtNumbers?.length || 0,
    ...usedCourtNumbers,
    1
  );
  const normalized = {
    ...defaults,
    ...source,
    rankingCriteria: validRankingCriteria ? source.rankingCriteria : defaults.rankingCriteria,
    winningScore: validWinningScore ? Number(source.winningScore) : defaults.winningScore,
    namesShuffled: Boolean(source.namesShuffled),
    schedule: normalizeSchedule(source.schedule),
    courtNumbers: normalizeCourtNumbers(sourceCourtNumbers, courtCount),
    category: typeof source.category === "string"
      ? source.category
      : (source.participantGenderMode ? "" : String(source.gender || "")),
    participantGenderMode,
    genderOther: typeof source.genderOther === "string" ? source.genderOther : "",
    gender: String(
      source.gender
      || getTournamentGenderLabel(participantGenderMode, source.genderOther)
      || ""
    ),
    participantGenders: normalizeParticipantGenderRegistry(source.participantGenders),
  };
  delete normalized.courtLabels;

  if (isCupType(config)) {
    const sourceCupConfig = isTournamentDataObject(source.cupConfig) ? source.cupConfig : {};
    const requestedTeamCount = Number(sourceCupConfig.teamCount);
    const teamCount = config.allowedTeamCounts.includes(requestedTeamCount)
      ? requestedTeamCount
      : config.defaultTeams;
    const isCearenseConfig = config.type === "cearense" || config.type === "cearenseIndividual";
    const isPlayRankingConfig = config.type === "playranking";
    const isSunsetConfig = config.type === "sunset";

    return {
      ...normalized,
      cupConfig: {
        ...defaults.cupConfig,
        ...sourceCupConfig,
        format: typeof sourceCupConfig.format === "string"
          ? sourceCupConfig.format
          : defaults.cupConfig.format,
        teamCount,
        mainBracketName: typeof sourceCupConfig.mainBracketName === "string"
          ? sourceCupConfig.mainBracketName
          : defaults.cupConfig.mainBracketName,
        repechageName: normalizeConfigurableCupName(
          sourceCupConfig.repechageName,
          defaults.cupConfig.repechageName,
          isCearenseConfig
            ? ["2ª Disputa Paralela"]
            : isPlayRankingConfig
              ? ["Disputa Paralela"]
              : isSunsetConfig ? ["1ª Disputa Paralela"] : []
        ),
        secondParallelName: normalizeConfigurableCupName(
          sourceCupConfig.secondParallelName,
          defaults.cupConfig.secondParallelName,
          isSunsetConfig ? ["2ª Disputa Paralela"] : []
        ),
        thirdRepechageName: normalizeConfigurableCupName(
          sourceCupConfig.thirdRepechageName,
          defaults.cupConfig.thirdRepechageName,
          isCearenseConfig || isSunsetConfig ? ["3ª Disputa Paralela"] : []
        ),
        sunsetBracketName: typeof sourceCupConfig.sunsetBracketName === "string"
          ? sourceCupConfig.sunsetBracketName
          : defaults.cupConfig.sunsetBracketName,
        ...(config.type === "sunset"
          ? {
            groupFormation: sourceCupConfig.groupFormation === "all-four"
              && teamCount % 4 === 0
              ? "all-four"
              : "automatic",
          }
          : {}),
        ...(config.type === "cearense" || config.type === "cearenseIndividual"
          ? {
            secondRepechageEnabled: typeof sourceCupConfig.secondRepechageEnabled === "boolean"
              ? sourceCupConfig.secondRepechageEnabled
              : defaults.cupConfig.secondRepechageEnabled,
            thirdRepechageEnabled: typeof sourceCupConfig.thirdRepechageEnabled === "boolean"
              ? sourceCupConfig.thirdRepechageEnabled
              : defaults.cupConfig.thirdRepechageEnabled,
          }
          : {}),
        tieBreakOverrides: isTournamentDataObject(sourceCupConfig.tieBreakOverrides)
          ? sourceCupConfig.tieBreakOverrides
          : {},
        groupTieBreakOverrides: isTournamentDataObject(sourceCupConfig.groupTieBreakOverrides)
          ? sourceCupConfig.groupTieBreakOverrides
          : {},
        campaignTieBreakOverrides: isTournamentDataObject(sourceCupConfig.campaignTieBreakOverrides)
          ? sourceCupConfig.campaignTieBreakOverrides
          : {},
      },
      players: {
        teams: isIndividualCupType(config)
          ? normalizeIndividualCupPlayers(sourcePlayers.teams, teamCount)
          : normalizeTeams(sourcePlayers.teams, teamCount),
      },
      participantAttendance: normalizeParticipantAttendance(
        config,
        { teams: isIndividualCupType(config)
          ? normalizeIndividualCupPlayers(sourcePlayers.teams, teamCount)
          : normalizeTeams(sourcePlayers.teams, teamCount) },
        source.participantAttendance
      ),
      brackets: normalizeBrackets(source.brackets),
      groupsShuffled: Boolean(source.groupsShuffled),
    };
  }

  if (isFlexibleSimpleType(config)) {
    const players = normalizeNameList(source.players, simplePlayerCount, config.label);
    return {
      ...normalized,
      simplePlayerCount,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  if (isReizinhoType(config)) {
    const players = normalizeNameList(source.players, reizinhoPlayerCount, config.label);
    return {
      ...normalized,
      reizinhoPlayerCount,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  if (isMixedType(config)) {
    const players = {
      men: normalizeNameList(sourcePlayers.men, config.men, "Homem"),
      women: normalizeNameList(sourcePlayers.women, config.women, "Mulher"),
    };
    return {
      ...normalized,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  if (isFixedTeamType(config)) {
    const players = {
      teams: normalizeTeams(sourcePlayers.teams, config.teams),
    };
    return {
      ...normalized,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  const players = normalizeNameList(source.players, config.total, config.label);
  return {
    ...normalized,
    players,
    participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
  };
}

export function needsTournamentDataRepair(type, rawData) {
  const config = modalityConfig[type];
  if (!config || !isTournamentDataObject(rawData) || !Array.isArray(rawData.schedule)) return true;

  const players = isTournamentDataObject(rawData.players) ? rawData.players : {};

  if (isCupType(config)) {
    const cupConfig = isTournamentDataObject(rawData.cupConfig) ? rawData.cupConfig : {};
    const teamCount = Number(cupConfig.teamCount);

    return !Array.isArray(players.teams)
      || !config.allowedTeamCounts.includes(teamCount)
      || players.teams.length !== teamCount
      || !Array.isArray(rawData.brackets);
  }

  if (isFlexibleSimpleType(config)) {
    const playerCount = getSimplePlayerCount(config, rawData);
    return !config.allowedPlayerCounts.includes(playerCount)
      || !Array.isArray(rawData.players)
      || rawData.players.length !== playerCount;
  }

  if (isReizinhoType(config)) {
    const playerCount = getReizinhoPlayerCount(config, rawData);
    return !config.allowedPlayerCounts.includes(playerCount)
      || !Array.isArray(rawData.players)
      || rawData.players.length !== playerCount;
  }

  if (isMixedType(config)) {
    return !Array.isArray(players.men)
      || !Array.isArray(players.women)
      || players.men.length !== config.men
      || players.women.length !== config.women;
  }

  if (isFixedTeamType(config)) {
    return !Array.isArray(players.teams) || players.teams.length !== config.teams;
  }

  return !Array.isArray(rawData.players) || rawData.players.length !== config.total;
}
