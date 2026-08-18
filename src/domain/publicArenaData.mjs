import {
  applyCircuitDrawOrder,
  circuitRankingModes,
  circuitTieBreakOptions,
  compareCircuitStageScores,
  getCircuitTieBreakOrder,
  normalizeCircuitRankingSettings,
} from "./circuitRankingSettings.mjs";
import {
  isCupType,
  isIndividualCupType,
  isMixedType,
} from "./modalityClassification.mjs";
import {
  defaultRankingCriteria,
  getRankingCriteria,
} from "./rankingCriteria.mjs";
import { normalizeCircuitStatus } from "./statusFormatting.mjs";
import {
  getTournamentLifecycleStatus,
  isPublicItemFinished,
} from "./tournamentLifecycle.mjs";

export function getPublicTournamentDirectoryItem(tournament) {
  const details = tournament?.data || {};

  return {
    id: tournament?.id || tournament?.public_id,
    public_id: tournament?.public_id || null,
    name: tournament?.name || "Torneio",
    type: tournament?.type || "",
    data: {
      eventDate: details.eventDate || "",
      eventEndDate: details.eventEndDate || details.eventDate || "",
      eventStartTime: details.eventStartTime || "",
      location: details.location || "",
      category: details.category || "",
      gender: details.gender || "",
      participantGenderMode: details.participantGenderMode || "",
      genderOther: details.genderOther || "",
      coverImageUrl: details.coverImageUrl || "",
      registrationDeadline: details.registrationDeadline || "",
      eventName: details.eventName || "",
      eventGroupKey: details.eventGroupKey || "",
      multiCategoryEvent: details.multiCategoryEvent === true,
      displayOrder: details.displayOrder,
      displayOrderMode: details.displayOrderMode || "automatic",
      lifecycleStatus: getTournamentLifecycleStatus(tournament),
    },
    directoryEntry: true,
  };
}

export function getPublicCircuitDirectoryItem(
  circuit,
  rankingGroups = [],
  rankingCriteria = defaultRankingCriteria,
) {
  const rankingSettings = normalizeCircuitRankingSettings(circuit?.ranking_settings || circuit?.rankingSettings);

  return {
    id: circuit?.id,
    name: circuit?.name || "Circuito",
    start_date: circuit?.start_date || circuit?.startDate || "",
    end_date: circuit?.end_date || circuit?.endDate || "",
    status: normalizeCircuitStatus(circuit?.status),
    tournament_ids: circuit?.tournament_ids || circuit?.tournamentIds || [],
    ranking_criteria: rankingCriteria,
    ranking_settings: rankingSettings,
    ranking_groups: rankingGroups.map((group) => ({
      key: group.key,
      title: group.title,
      rows: (group.rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
        tournaments: Number(row.tournaments || 0),
        circuitPoints: Number(row.circuitPoints || 0),
        titles: Number(row.titles || 0),
        runnerUps: Number(row.runnerUps || 0),
        thirdPlaces: Number(row.thirdPlaces || 0),
        extraPoints: Number(row.extraPoints || 0),
        bestStagePoints: Number(row.stageScores?.[0] || row.bestStagePoints || 0),
        stageScores: Array.isArray(row.stageScores)
          ? row.stageScores.map((score) => Number(score || 0))
          : [],
      })),
    })),
  };
}

export function sortCircuitsForDisplay(items) {
  return [...(items || [])].sort((first, second) => {
    const firstFinished = isPublicItemFinished(first, "circuit");
    const secondFinished = isPublicItemFinished(second, "circuit");
    if (firstFinished !== secondFinished) return firstFinished ? 1 : -1;

    const firstDate = String(
      first?.end_date || first?.endDate || first?.start_date || first?.startDate || "9999-12-31",
    );
    const secondDate = String(
      second?.end_date || second?.endDate || second?.start_date || second?.startDate || "9999-12-31",
    );
    return firstFinished ? secondDate.localeCompare(firstDate) : firstDate.localeCompare(secondDate);
  });
}

export function normalizePublicCircuitForDisplay(circuit, { directoryEntry = true } = {}) {
  const criteria = getRankingCriteria(circuit?.ranking_criteria || defaultRankingCriteria);
  const rankingSettings = normalizeCircuitRankingSettings(circuit?.ranking_settings);
  const placementMode = rankingSettings.mode === circuitRankingModes.placement
    || rankingSettings.sourceCircuitIds.length > 0;
  const rankingGroups = (circuit?.ranking_groups || []).map((group) => ({
    ...group,
    rows: [...(group.rows || [])].sort((first, second) => {
      if (placementMode) {
        const pointDifference = Number(second.circuitPoints || second.circuit_points || 0)
          - Number(first.circuitPoints || first.circuit_points || 0);
        if (pointDifference !== 0) return pointDifference;

        for (const criterion of getCircuitTieBreakOrder(rankingSettings)) {
          if (criterion === "bestStage") {
            const difference = compareCircuitStageScores(first, second);
            if (difference !== 0) return difference;
            continue;
          }

          const option = circuitTieBreakOptions.find((item) => item.value === criterion);
          const difference = Number(second[option?.key] || 0) - Number(first[option?.key] || 0);
          if (difference !== 0) return difference;
        }

        const drawDifference = applyCircuitDrawOrder(first, second, rankingSettings);
        if (drawDifference !== 0) return drawDifference;
      }

      for (const key of criteria.order) {
        const difference = Number(second[key] || 0) - Number(first[key] || 0);
        if (difference !== 0) return difference;
      }

      return String(first.name || "").localeCompare(String(second.name || ""), "pt-BR");
    }),
  }));

  return {
    ...circuit,
    directoryEntry,
    ranking_groups: rankingGroups,
  };
}

export function getRegisteredAthletesForPublic(data, config) {
  if (!data?.players) return [];

  if (isMixedType(config)) {
    return [
      {
        title: "Masculino",
        names: (data.players.men || []).filter(Boolean),
      },
      {
        title: "Feminino",
        names: (data.players.women || []).filter(Boolean),
      },
    ];
  }

  if (isIndividualCupType(config)) {
    return [
      {
        title: "Jogadores cadastrados",
        names: (data.players.teams || [])
          .map((player, index) => `${index + 1}. ${player.a || `Jogador ${index + 1}`}`)
          .filter(Boolean),
      },
    ];
  }

  if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
    return [
      {
        title: "Duplas cadastradas",
        names: (data.players.teams || [])
          .map((team, index) => `${index + 1}. ${team.a || "Atleta 1"} + ${team.b || "Atleta 2"}`)
          .filter(Boolean),
      },
    ];
  }

  return [
    {
      title: "Atletas cadastrados",
      names: (data.players || []).filter(Boolean),
    },
  ];
}
