import {
  chooseCircuitParticipantDisplayName,
  normalizeCircuitParticipantKey,
} from "../circuitNameIdentity.mjs";
import { formatParticipantName } from "./participantNames.mjs";
import { normalizeParticipantGenderRegistry } from "./participantGenderRegistry.mjs";

export const circuitRankingModes = {
  performance: "performance",
  placement: "placement",
};

export const circuitTournamentFormats = {
  placement: "placement",
  cup: "cup",
};

export const circuitTieBreakOptions = [
  { value: "wins", label: "Maior quantidade de vitórias", key: "w" },
  { value: "titles", label: "Maior quantidade de títulos", key: "titles" },
  { value: "runnerUps", label: "Maior quantidade de vice-campeonatos", key: "runnerUps" },
  { value: "thirdPlaces", label: "Maior quantidade de terceiros lugares", key: "thirdPlaces" },
  { value: "bestStage", label: "Melhores pontuações obtidas nas etapas", key: "bestStagePoints" },
];

export const defaultCircuitPositionPoints = [1000, 800, 670, 500, 400, 330, 250, 200, 170, 140];
export const defaultCircuitOtherPositionPoints = 120;
export const defaultCircuitCupPoints = {
  champion: 1000,
  runnerUp: 800,
  semifinal: 670,
  quarterfinal: 500,
  round16: 330,
  round32: 170,
  groupStage: 0,
};

export function getCircuitCupPlacementKey(roundName) {
  const normalized = String(roundName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("quarta") && !normalized.includes("oitava")) return "runnerUp";
  if (normalized.includes("semi")) return "semifinal";
  if (normalized.includes("quarta")) return "quarterfinal";
  if (normalized.includes("oitava")) return "round16";
  if (normalized.includes("32") || normalized.includes("16º") || normalized.includes("preliminar")) return "round32";
  return "groupStage";
}

export function getCircuitPlacementLabel(key, position = null) {
  const labels = {
    champion: "Campeão",
    runnerUp: "Vice-campeão",
    third: "3º lugar",
    fourth: "4º lugar",
    semifinal: "Semifinal",
    quarterfinal: "Quartas de final",
    round16: "Oitavas de final",
    round32: "Fase de 32",
    groupStage: "Fase de grupos",
  };
  return position ? `${position}º lugar` : labels[key] || "Participação";
}

export function normalizeCircuitPointValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

export function normalizeCircuitTieBreakOrder(value) {
  const allowed = new Set(circuitTieBreakOptions.map((option) => option.value));
  const source = Array.isArray(value) ? value : [];
  const unique = source.filter((item, index) => allowed.has(item) && source.indexOf(item) === index);
  const fallback = ["wins", "bestStage"];
  fallback.forEach((item) => {
    if (!unique.includes(item)) unique.push(item);
  });
  return unique.slice(0, 2);
}

export function normalizeCircuitRankingSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sourcePoints = source.points && typeof source.points === "object" ? source.points : {};
  const sourceCup = sourcePoints.cup && typeof sourcePoints.cup === "object" ? sourcePoints.cup : {};
  const sourcePositions = Array.isArray(sourcePoints.positions) ? sourcePoints.positions : [];
  const sourceExtraPoints = Array.isArray(source.extraPoints) ? source.extraPoints : [];
  const sourceManualParticipants = Array.isArray(source.manualParticipants) ? source.manualParticipants : [];
  const sourceCircuitIds = Array.isArray(source.sourceCircuitIds) ? source.sourceCircuitIds : [];

  return {
    deletedAt: String(source.deletedAt || ""),
    mode: source.mode === circuitRankingModes.placement ? circuitRankingModes.placement : circuitRankingModes.performance,
    tournamentFormat: source.tournamentFormat === circuitTournamentFormats.cup
      ? circuitTournamentFormats.cup
      : (source.tournamentFormat === circuitTournamentFormats.placement ? circuitTournamentFormats.placement : ""),
    identity: source.identity === "team" ? "team" : "individual",
    rankingDivision: source.identity !== "team" && source.rankingDivision === "gender" ? "gender" : "general",
    genderRegistry: normalizeParticipantGenderRegistry(source.genderRegistry),
    sourceCircuitIds: [...new Set(sourceCircuitIds.map((id) => String(id)).filter(Boolean))],
    extraPoints: sourceExtraPoints.map((entry, index) => ({
      id: String(entry?.id || `extra-${index + 1}`),
      targetId: String(entry?.targetId || ""),
      targetName: String(entry?.targetName || "").trim(),
      groupKey: ["masculino", "feminino", "geral"].includes(entry?.groupKey) ? entry.groupKey : "geral",
      label: String(entry?.label || "Pontuação extra").trim() || "Pontuação extra",
      note: String(entry?.note || "").trim(),
      points: normalizeCircuitPointValue(entry?.points),
      createdAt: String(entry?.createdAt || ""),
    })).filter((entry) => entry.targetId && entry.targetName && entry.points > 0),
    manualParticipants: sourceManualParticipants.map((entry, index) => ({
      id: String(entry?.id || `manual-${index + 1}`),
      name: formatParticipantName(entry?.name || ""),
      groupKey: ["masculino", "feminino", "geral"].includes(entry?.groupKey) ? entry.groupKey : "geral",
      points: normalizeCircuitPointValue(entry?.points),
      wins: normalizeCircuitPointValue(entry?.wins),
      totalGames: normalizeCircuitPointValue(entry?.totalGames),
      balance: Number.isFinite(Number(entry?.balance)) ? Math.round(Number(entry.balance)) : 0,
      played: normalizeCircuitPointValue(entry?.played),
      note: String(entry?.note || "").trim(),
      createdAt: String(entry?.createdAt || ""),
      updatedAt: String(entry?.updatedAt || ""),
    })).filter((entry) => entry.id && entry.name),
    tieBreakOrder: source.tieBreakMode === "cearense"
      ? ["wins", "bestStage"]
      : normalizeCircuitTieBreakOrder(source.tieBreakOrder),
    tieBreakDrawOrder: Array.isArray(source.tieBreakDrawOrder)
      ? source.tieBreakDrawOrder.map((item) => String(item)).filter(Boolean)
      : [],
    tieBreakDrawSignatures: source.tieBreakDrawSignatures && typeof source.tieBreakDrawSignatures === "object"
      ? Object.fromEntries(Object.entries(source.tieBreakDrawSignatures).map(([key, signature]) => [String(key), String(signature)]))
      : {},
    points: {
      positions: defaultCircuitPositionPoints.map((fallback, index) => (
        Object.prototype.hasOwnProperty.call(sourcePositions, index)
          ? normalizeCircuitPointValue(sourcePositions[index])
          : fallback
      )),
      otherPositions: Object.prototype.hasOwnProperty.call(sourcePoints, "otherPositions")
        ? normalizeCircuitPointValue(sourcePoints.otherPositions)
        : (Object.prototype.hasOwnProperty.call(sourcePositions, 10)
          ? normalizeCircuitPointValue(sourcePositions[10])
          : defaultCircuitOtherPositionPoints),
      cup: Object.fromEntries(Object.entries(defaultCircuitCupPoints).map(([key, fallback]) => ([
        key,
        Object.prototype.hasOwnProperty.call(sourceCup, key)
          ? normalizeCircuitPointValue(sourceCup[key])
          : fallback,
      ]))),
    },
  };
}

export function getCircuitTieBreakOrder(settings) {
  return normalizeCircuitRankingSettings(settings).tieBreakOrder;
}

export function compareCircuitStageScores(first, second) {
  const firstScores = Array.isArray(first?.stageScores) && first.stageScores.length
    ? first.stageScores
    : [Number(first?.bestStagePoints || 0)];
  const secondScores = Array.isArray(second?.stageScores) && second.stageScores.length
    ? second.stageScores
    : [Number(second?.bestStagePoints || 0)];
  const length = Math.max(firstScores.length, secondScores.length);
  for (let index = 0; index < length; index += 1) {
    const difference = Number(secondScores[index] || 0) - Number(firstScores[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function getCircuitTieSignature(row, settings) {
  const values = [Number(row?.circuitPoints || row?.circuit_points || 0)];
  getCircuitTieBreakOrder(settings).forEach((criterion) => {
    if (criterion === "bestStage") {
      const scores = Array.isArray(row?.stageScores)
        ? row.stageScores.map((score) => Number(score || 0))
        : [Number(row?.bestStagePoints || 0)];
      while (scores.length > 0 && scores[scores.length - 1] === 0) scores.pop();
      values.push(...scores);
      return;
    }
    const option = circuitTieBreakOptions.find((item) => item.value === criterion);
    values.push(Number(row?.[option?.key] || 0));
  });
  return JSON.stringify(values);
}

export function getCircuitTieBreakLabel(settings, { compact = false } = {}) {
  const labels = getCircuitTieBreakOrder(settings).map((criterion) => {
    if (criterion === "wins") return "Vitórias";
    if (criterion === "bestStage") return compact ? "Melhores etapas" : "Melhores pontuações nas etapas";
    const option = circuitTieBreakOptions.find((item) => item.value === criterion);
    return option?.label?.replace(/^Maior (?:quantidade de )?/i, "") || criterion;
  });
  return [compact ? "Pontos" : "Todas as pontuações", ...labels, "Sorteio"].join(" → ");
}

export function applyCircuitDrawOrder(first, second, settings) {
  const normalized = normalizeCircuitRankingSettings(settings);
  const drawOrder = normalized.tieBreakDrawOrder;
  const firstId = String(first?.id || "");
  const secondId = String(second?.id || "");
  if (normalized.tieBreakDrawSignatures[firstId] !== getCircuitTieSignature(first, normalized)) return 0;
  if (normalized.tieBreakDrawSignatures[secondId] !== getCircuitTieSignature(second, normalized)) return 0;
  const firstIndex = drawOrder.indexOf(firstId);
  const secondIndex = drawOrder.indexOf(secondId);
  if (firstIndex >= 0 && secondIndex >= 0) return firstIndex - secondIndex;
  return 0;
}

export function getUnresolvedCircuitTieGroups(groups, settings) {
  const normalized = normalizeCircuitRankingSettings(settings);
  const drawOrder = normalized.tieBreakDrawOrder;
  return (groups || []).flatMap((group) => {
    const bySignature = new Map();
    (group.rows || []).forEach((row) => {
      const signature = getCircuitTieSignature(row, settings);
      if (!bySignature.has(signature)) bySignature.set(signature, []);
      bySignature.get(signature).push(row);
    });
    return Array.from(bySignature.values()).filter((rows) => (
      rows.length > 1
      && rows.some((row) => {
        const id = String(row.id || "");
        return !drawOrder.includes(id)
          || normalized.tieBreakDrawSignatures[id] !== getCircuitTieSignature(row, normalized);
      })
    ));
  });
}

export function getCircuitPlacementColumns(settings, { includeManual = false, totalsOnly = false } = {}) {
  const keys = getCircuitTieBreakOrder(settings);
  const columns = [
    { key: "circuitPoints", label: "Total de pontos" },
  ];
  if (totalsOnly) return columns;
  keys.forEach((criterion) => {
    const option = circuitTieBreakOptions.find((item) => item.value === criterion);
    if (option && !columns.some((column) => column.key === option.key)) {
      columns.push({ key: option.key, label: option.label.replace(/^Maior (?:quantidade de )?/i, "") });
    }
  });
  if (includeManual) {
    [
      { key: "w", label: "Vitórias" },
      { key: "pts", label: "Total de Games" },
      { key: "bal", label: "Saldo" },
      { key: "played", label: "Jogos" },
    ].forEach((column) => {
      if (!columns.some((item) => item.key === column.key)) columns.push(column);
    });
  }
  columns.push({ key: "tournaments", label: "Etapas" });
  return columns;
}

export function applyCircuitExtraPoints(groups, settings) {
  const normalized = normalizeCircuitRankingSettings(settings);
  const isTeam = normalized.identity === "team";
  normalized.extraPoints.forEach((entry) => {
    const preferredGroup = groups[entry.groupKey] || groups.geral;
    const candidates = preferredGroup ? [preferredGroup] : Object.values(groups);
    let target = null;
    for (const group of candidates) {
      target = Array.from(group?.rows?.values?.() || []).find((row) => (
        String(row.id || "") === entry.targetId
        || normalizeCircuitParticipantKey(row.name, isTeam) === normalizeCircuitParticipantKey(entry.targetName, isTeam)
      ));
      if (target) break;
    }
    if (!target) return;
    target.extraPoints = Number(target.extraPoints || 0) + entry.points;
    target.circuitPoints = Number(target.circuitPoints || 0) + entry.points;
  });
}

export function getCircuitManualParticipantKey(name, isTeam = false) {
  return normalizeCircuitParticipantKey(name, isTeam);
}

export function applyCircuitManualParticipants(groups, settings) {
  const normalized = normalizeCircuitRankingSettings(settings);
  const isTeam = normalized.identity === "team";
  normalized.manualParticipants.forEach((entry) => {
    const groupKey = groups[entry.groupKey] ? entry.groupKey : "geral";
    const table = groups[groupKey]?.rows || groups.geral.rows;
    const key = getCircuitManualParticipantKey(entry.name, isTeam);
    const current = table.get(key) || Array.from(table.values()).find((row) => (
      getCircuitManualParticipantKey(row.name, isTeam) === key
    )) || {
      id: `${groupKey}:${key}`,
      name: entry.name,
      pts: 0,
      w: 0,
      bal: 0,
      played: 0,
      tournaments: 0,
      circuitPoints: 0,
      extraPoints: 0,
      manualPoints: 0,
      titles: 0,
      runnerUps: 0,
      thirdPlaces: 0,
      stageScores: [],
    };
    const next = {
      ...current,
      name: formatParticipantName(chooseCircuitParticipantDisplayName(current.name, entry.name, isTeam)),
      pts: Number(current.pts || 0) + entry.totalGames,
      w: Number(current.w || 0) + entry.wins,
      bal: Number(current.bal || 0) + entry.balance,
      played: Number(current.played || 0) + entry.played,
      circuitPoints: Number(current.circuitPoints || 0) + entry.points,
      manualPoints: Number(current.manualPoints || 0) + entry.points,
      isManualEntry: Number(current.tournaments || 0) === 0,
    };
    table.set(key, next);
  });
}
