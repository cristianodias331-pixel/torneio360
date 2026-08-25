import { normalizeCircuitRankingSettings } from "./circuitRankingSettings.mjs";
import { defaultRankingCriteria } from "./rankingCriteria.mjs";
import { getCollaborationRevision } from "./realtimeTournamentMerge.mjs";
import { normalizeCircuitStatus } from "./statusFormatting.mjs";

export function normalizeCircuitTournamentIds(tournamentIds = []) {
  return [...new Set(
    (Array.isArray(tournamentIds) ? tournamentIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  )];
}

export function normalizeCircuitRow(row = {}) {
  const rankingSettings = normalizeCircuitRankingSettings(row.ranking_settings || row.rankingSettings);
  return {
    id: row.id,
    name: row.name || "",
    coverImageUrl: rankingSettings.coverImageUrl,
    coverImageThumbnailUrl: rankingSettings.coverImageThumbnailUrl,
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: normalizeCircuitStatus(row.status),
    tournamentIds: normalizeCircuitTournamentIds(row.tournament_ids),
    rankingCriteria: row.ranking_criteria || defaultRankingCriteria,
    rankingCriteriaMode: row.ranking_criteria_mode === "manual" ? "manual" : "automatic",
    rankingSettings,
    deletedAt: rankingSettings.deletedAt,
    rankingHistory: row.rankingHistory || {},
    updatedAt: row.updated_at,
    revision: getCollaborationRevision(row),
  };
}

export const circuitDirectorySelect = [
  "id",
  "name",
  "start_date",
  "end_date",
  "status",
  "tournament_ids",
  "ranking_criteria",
  "ranking_criteria_mode",
  "ranking_settings",
  "updated_at",
  "revision",
].join(",");

export const circuitHistorySelect = [
  "tournament_id",
  "group_key",
  "player_key",
  "player_name",
  "pts",
  "w",
  "bal",
  "played",
  "circuit_points",
  "placement_key",
  "placement_label",
  "titles",
  "runner_ups",
  "third_places",
].join(",");
