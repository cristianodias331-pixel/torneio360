import {
  chooseCircuitParticipantDisplayName,
  normalizeCircuitParticipantKey,
} from "../circuitNameIdentity.mjs";
import {
  applyCircuitDrawOrder,
  applyCircuitExtraPoints,
  applyCircuitManualParticipants,
  circuitRankingModes,
  circuitTieBreakOptions,
  getCircuitTieBreakOrder,
  normalizeCircuitRankingSettings,
} from "./circuitRankingSettings.mjs";
import { calculateCircuitPlacementRowsByConfig } from "./circuitPlacement.mjs";
import { isCupType, isIndividualCupType, isMixedType } from "./modalityClassification.mjs";
import { formatParticipantName } from "./participantNames.mjs";
import { defaultRankingCriteria } from "./rankingCriteria.mjs";
import { calculateCircuitTournamentRankingRows } from "./tournamentRanking.mjs";
import {
  getParticipantGender,
  participantGenderValues,
  resolveTournamentParticipantGender,
} from "./participantGenderRegistry.mjs";

function resolveCircuitRowGroup({ row, tournament, config, rankingSettings }) {
  const fallback = row.groupKey
    || (isMixedType(config) ? (Number(row.id) < Number(config.men || 0) ? "masculino" : "feminino") : "geral");
  if (rankingSettings.rankingDivision !== "gender") return fallback;
  const gender = resolveTournamentParticipantGender({
    tournament,
    settings: rankingSettings,
    name: row.name,
    fallbackGender: fallback,
  });
  return gender === participantGenderValues.masculine || gender === participantGenderValues.feminine
    ? gender
    : "geral";
}

export function buildCircuitRankingGroups({
  circuit,
  tournaments = [],
  modalityConfigs = {},
  getTimingComplete = () => false,
}) {
  const selectedIds = new Set(
    (circuit?.tournament_ids || circuit?.tournamentIds || []).map((id) => String(id))
  );
  const groups = {
    geral: { key: "geral", title: "Ranking geral acumulado", rows: new Map() },
    masculino: { key: "masculino", title: "Ranking Masculino", rows: new Map() },
    feminino: { key: "feminino", title: "Ranking Feminino", rows: new Map() },
  };
  const rankingSettings = normalizeCircuitRankingSettings(circuit?.ranking_settings || circuit?.rankingSettings);
  const placementMode = rankingSettings.mode === circuitRankingModes.placement;
  if (placementMode) groups.geral.title = "Ranking geral por pontos";

  const sourceCircuitIds = rankingSettings.sourceCircuitIds;
  if (sourceCircuitIds.length > 0 && Array.isArray(circuit?.ranking_groups)) {
    const sourceIsTeam = rankingSettings.identity === "team";
    (circuit.ranking_groups || []).forEach((group) => {
      const groupKey = group.key || "geral";
      const table = groups[groupKey]?.rows || groups.geral.rows;
      (group.rows || []).forEach((row) => {
        const name = String(row.name || "Sem nome").trim() || "Sem nome";
        const key = normalizeCircuitParticipantKey(name, sourceIsTeam);
        const current = table.get(key);
        const rowStageScores = Array.isArray(row.stageScores)
          ? row.stageScores.map((score) => Number(score || 0))
          : [];
        if (!current) {
          table.set(key, {
            ...row,
            id: `${groupKey}:${key}`,
            name: formatParticipantName(name),
            extraPoints: Number(row.extraPoints || 0),
            stageScores: rowStageScores,
          });
          return;
        }
        const stageScores = [...(current.stageScores || []), ...rowStageScores]
          .sort((first, second) => second - first);
        table.set(key, {
          ...current,
          name: formatParticipantName(chooseCircuitParticipantDisplayName(current.name, name, sourceIsTeam)),
          pts: Number(current.pts || 0) + Number(row.pts || 0),
          w: Number(current.w || 0) + Number(row.w || 0),
          bal: Number(current.bal || 0) + Number(row.bal || 0),
          played: Number(current.played || 0) + Number(row.played || 0),
          tournaments: Number(current.tournaments || 0) + Number(row.tournaments || 0),
          circuitPoints: Number(current.circuitPoints || 0) + Number(row.circuitPoints || 0),
          extraPoints: Number(current.extraPoints || 0) + Number(row.extraPoints || 0),
          titles: Number(current.titles || 0) + Number(row.titles || 0),
          runnerUps: Number(current.runnerUps || 0) + Number(row.runnerUps || 0),
          thirdPlaces: Number(current.thirdPlaces || 0) + Number(row.thirdPlaces || 0),
          stageScores,
          bestStagePoints: Number(stageScores[0] || 0),
        });
      });
    });
  }

  tournaments
    .filter((tournament) => (
      selectedIds.has(String(tournament.id))
      && !tournament.data?.deletedAt
    ))
    .forEach((tournament) => {
      if (
        sourceCircuitIds.length > 0
        && Array.isArray(circuit?.ranking_groups)
        && circuit.ranking_groups.length > 0
      ) return;
      const config = modalityConfigs[tournament.type];
      if (!config) return;

      const timingComplete = Boolean(getTimingComplete(tournament));
      const rows = placementMode
        ? calculateCircuitPlacementRowsByConfig({
          tournament,
          settings: rankingSettings,
          config,
          timingComplete,
        })
        : calculateCircuitTournamentRankingRows({
          data: tournament.data || {},
          config,
          rankingCriteriaValue: tournament.data?.rankingCriteria || defaultRankingCriteria,
          timingComplete,
        });
      const teamRanking = (
        (isCupType(config) && !isIndividualCupType(config))
        || config.type === "fixed12"
        || config.type === "fixed16"
      ) && (!placementMode || rankingSettings.identity === "team");

      rows.forEach((row) => {
        if (Number(row.played || 0) <= 0) return;

        const groupKey = resolveCircuitRowGroup({ row, tournament, config, rankingSettings });
        const name = String(row.name || "Sem nome").trim() || "Sem nome";
        const playerKey = normalizeCircuitParticipantKey(name, teamRanking);
        const current = groups[groupKey].rows.get(playerKey) || {
          id: `${groupKey}:${playerKey}`,
          name: formatParticipantName(name),
          pts: 0,
          w: 0,
          bal: 0,
          played: 0,
          tournaments: 0,
          circuitPoints: 0,
          extraPoints: 0,
          titles: 0,
          runnerUps: 0,
          thirdPlaces: 0,
          stageScores: [],
        };

        const stageScores = [...current.stageScores, Number(row.circuitPoints || 0)]
          .sort((first, second) => second - first);
        groups[groupKey].rows.set(playerKey, {
          ...current,
          name: formatParticipantName(chooseCircuitParticipantDisplayName(current.name, name, teamRanking)),
          pts: current.pts + Number(row.pts || 0),
          w: current.w + Number(row.w || 0),
          bal: current.bal + Number(row.bal || 0),
          played: current.played + Number(row.played || 0),
          tournaments: current.tournaments + 1,
          circuitPoints: current.circuitPoints + Number(row.circuitPoints || 0),
          titles: current.titles + Number(row.titles || 0),
          runnerUps: current.runnerUps + Number(row.runnerUps || 0),
          thirdPlaces: current.thirdPlaces + Number(row.thirdPlaces || 0),
          stageScores,
          bestStagePoints: Number(stageScores[0] || 0),
        });
      });
    });

  applyCircuitManualParticipants(groups, rankingSettings);
  applyCircuitExtraPoints(groups, rankingSettings);

  const sortRows = (rows) => Array.from(rows.values()).sort((first, second) => {
    if (placementMode) {
      const pointDifference = Number(second.circuitPoints || 0) - Number(first.circuitPoints || 0);
      if (pointDifference !== 0) return pointDifference;
    }
    for (const key of ["w", "pts", "bal"]) {
      const difference = Number(second[key] || 0) - Number(first[key] || 0);
      if (difference !== 0) return difference;
    }
    const drawDifference = applyCircuitDrawOrder(first, second, rankingSettings);
    if (drawDifference !== 0) return drawDifference;
    return first.name.localeCompare(second.name, "pt-BR");
  });

  return [groups.masculino, groups.feminino, groups.geral]
    .map((group) => ({ ...group, rows: sortRows(group.rows) }))
    .filter((group) => group.rows.length > 0);
}

export function buildCircuitRankingGroupsFromRecords({
  records = [],
  settings,
  criteriaValue = defaultRankingCriteria,
  tournaments = [],
  modalityConfigs = {},
}) {
  const rankingSettings = normalizeCircuitRankingSettings(settings);
  const placementMode = rankingSettings.mode === circuitRankingModes.placement;
  const tournamentById = new Map(
    (tournaments || []).map((tournament) => [String(tournament?.id || ""), tournament])
  );
  const groups = {
    geral: {
      title: rankingSettings.rankingDivision === "gender"
        ? "Gênero a confirmar"
        : placementMode ? "Ranking geral por pontos" : "Ranking geral acumulado",
      rows: new Map(),
    },
    masculino: { title: "Ranking Masculino", rows: new Map() },
    feminino: { title: "Ranking Feminino", rows: new Map() },
  };

  (records || []).forEach((record) => {
    const storedGroupKey = record.groupKey || "geral";
    const tournament = tournamentById.get(String(record.tournamentId || ""));
    const config = tournament ? modalityConfigs[tournament.type] : null;
    const registeredGender = getParticipantGender(
      rankingSettings.genderRegistry,
      record.name,
      { confirmedOnly: true }
    );
    const resolvedGroupKey = rankingSettings.rankingDivision === "gender"
      ? tournament
        ? resolveCircuitRowGroup({ row: record, tournament, config, rankingSettings })
        : registeredGender
      : storedGroupKey;
    const groupKey = resolvedGroupKey === participantGenderValues.masculine
      || resolvedGroupKey === participantGenderValues.feminine
      ? resolvedGroupKey
      : storedGroupKey === participantGenderValues.masculine
        || storedGroupKey === participantGenderValues.feminine
        ? storedGroupKey
        : "geral";
    const table = groups[groupKey]?.rows || groups.geral.rows;
    const name = String(record.name || "Sem nome").trim() || "Sem nome";
    const key = normalizeCircuitParticipantKey(record.playerKey || name, Boolean(record.isTeam));
    const current = table.get(key) || {
      id: `${groupKey}:${key}`,
      name: formatParticipantName(name),
      pts: 0,
      w: 0,
      bal: 0,
      played: 0,
      tournaments: 0,
      circuitPoints: 0,
      extraPoints: 0,
      titles: 0,
      runnerUps: 0,
      thirdPlaces: 0,
      stageScores: [],
    };

    const recordStageScores = Array.isArray(record.stageScores) && record.stageScores.length
      ? record.stageScores.map((score) => Number(score || 0))
      : [Number(record.circuitPoints || 0)];
    const stageScores = [...current.stageScores, ...recordStageScores]
      .sort((first, second) => second - first);
    table.set(key, {
      ...current,
      name: formatParticipantName(
        chooseCircuitParticipantDisplayName(current.name, name, Boolean(record.isTeam))
      ),
      pts: current.pts + Number(record.pts || 0),
      w: current.w + Number(record.w || 0),
      bal: current.bal + Number(record.bal || 0),
      played: current.played + Number(record.played || 0),
      tournaments: current.tournaments + Math.max(1, Number(record.tournaments || 0)),
      circuitPoints: current.circuitPoints + Number(record.circuitPoints || 0),
      extraPoints: current.extraPoints + Number(record.extraPoints || 0),
      titles: current.titles + Number(record.titles || 0),
      runnerUps: current.runnerUps + Number(record.runnerUps || 0),
      thirdPlaces: current.thirdPlaces + Number(record.thirdPlaces || 0),
      stageScores,
      bestStagePoints: Number(stageScores[0] || 0),
    });
  });

  applyCircuitManualParticipants(groups, rankingSettings);
  applyCircuitExtraPoints(groups, rankingSettings);

  void criteriaValue;
  const tieBreakOrder = getCircuitTieBreakOrder(rankingSettings);
  const sortRows = (rows) => Array.from(rows.values()).sort((first, second) => {
    if (placementMode) {
      const pointDifference = Number(second.circuitPoints || 0) - Number(first.circuitPoints || 0);
      if (pointDifference !== 0) return pointDifference;
    }
    for (const criterion of tieBreakOrder) {
      const key = circuitTieBreakOptions.find((option) => option.value === criterion)?.key;
      if (!key) continue;
      const difference = Number(second[key] || 0) - Number(first[key] || 0);
      if (difference !== 0) return difference;
    }
    const drawDifference = applyCircuitDrawOrder(first, second, rankingSettings);
    if (drawDifference !== 0) return drawDifference;
    return first.name.localeCompare(second.name, "pt-BR");
  });

  return [
    { key: "masculino", title: groups.masculino.title, rows: sortRows(groups.masculino.rows) },
    { key: "feminino", title: groups.feminino.title, rows: sortRows(groups.feminino.rows) },
    { key: "geral", title: groups.geral.title, rows: sortRows(groups.geral.rows) },
  ].filter((group) => group.rows.length > 0);
}

export function buildCircuitTournamentRankingRecords({
  tournaments = [],
  settings,
  modalityConfigs = {},
  getTimingComplete = () => false,
  onError = () => {},
}) {
  const records = {};
  const rankingSettings = normalizeCircuitRankingSettings(settings);
  const placementMode = rankingSettings.mode === circuitRankingModes.placement;

  (tournaments || []).forEach((tournament) => {
    const config = modalityConfigs[tournament.type];
    let rows = [];
    try {
      const timingComplete = Boolean(getTimingComplete(tournament));
      rows = placementMode
        ? calculateCircuitPlacementRowsByConfig({
          tournament,
          settings: rankingSettings,
          config,
          timingComplete,
        })
        : calculateCircuitTournamentRankingRows({
          data: tournament.data || {},
          config,
          rankingCriteriaValue: tournament.data?.rankingCriteria || defaultRankingCriteria,
          timingComplete,
        });
    } catch (error) {
      onError(error, tournament);
      return;
    }

    const teamRanking = (
      (isCupType(config) && !isIndividualCupType(config))
      || config?.type === "fixed12"
      || config?.type === "fixed16"
    ) && (!placementMode || rankingSettings.identity === "team");
    const nameOccurrences = new Map();

    rows.forEach((row) => {
      const groupKey = resolveCircuitRowGroup({ row, tournament, config, rankingSettings });
      const name = String(row.name || "Sem nome").trim() || "Sem nome";
      const key = `${groupKey}::${normalizeCircuitParticipantKey(name, teamRanking)}`;
      nameOccurrences.set(key, (nameOccurrences.get(key) || 0) + 1);
    });

    rows.forEach((row, rowIndex) => {
      if (Number(row.played || 0) <= 0) return;
      const groupKey = resolveCircuitRowGroup({ row, tournament, config, rankingSettings });
      const name = String(row.name || "Sem nome").trim() || "Sem nome";
      const normalizedName = normalizeCircuitParticipantKey(name, teamRanking);
      const duplicateNameKey = `${groupKey}::${normalizedName}`;
      const playerKey = nameOccurrences.get(duplicateNameKey) > 1
        ? `${normalizedName}#${row.id ?? rowIndex + 1}`
        : normalizedName;
      const recordKey = `${tournament.id}::${groupKey}::${playerKey}`;

      records[recordKey] = {
        tournamentId: tournament.id,
        groupKey,
        playerKey,
        name,
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
        circuitPoints: Number(row.circuitPoints || 0),
        placementKey: row.placementKey || "",
        placementLabel: row.placementLabel || "",
        titles: Number(row.titles || 0),
        runnerUps: Number(row.runnerUps || 0),
        thirdPlaces: Number(row.thirdPlaces || 0),
        isTeam: teamRanking,
      };
    });
  });

  return records;
}
