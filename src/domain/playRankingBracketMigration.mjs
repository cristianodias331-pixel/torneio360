import { getCearenseQualified } from "./cearenseQualification.mjs";
import { syncCupBracketScores } from "./cupBracketOrchestration.mjs";
import { isPlayRankingData } from "./cupFormat.mjs";

export const PLAY_RANKING_BRACKET_VERSION = 3;
export const PLAY_RANKING_RETROACTIVE_PROFILE_ID = "fb6d9483-58f5-40ca-aa4c-cab34bb98136";
export const PLAY_RANKING_MIGRATION_BACKUP_KEY = "official-bracket-v3";

function hasStoredScore(game) {
  return game?.s1 !== "" && game?.s1 !== null && game?.s1 !== undefined
    && game?.s2 !== "" && game?.s2 !== null && game?.s2 !== undefined;
}

function countStoredScores(data) {
  return (data?.brackets || []).filter(hasStoredScore).length;
}

export function shouldMigratePlayRankingBracket(tournament, data = tournament?.data) {
  return String(tournament?.user_id || "") === PLAY_RANKING_RETROACTIVE_PROFILE_ID
    && isPlayRankingData(data)
    && Number(data?.cupConfig?.playRankingBracketVersion || 0) < PLAY_RANKING_BRACKET_VERSION;
}

export function migratePlayRankingBracketForReferenceProfile(tournament, normalizedData = tournament?.data) {
  if (!shouldMigratePlayRankingBracket(tournament, normalizedData)) {
    return { data: normalizedData, applied: false, blocked: false, preservedScores: 0, pendingScores: 0 };
  }

  const sourceData = structuredClone(normalizedData);
  const hasExistingBracket = Array.isArray(sourceData.brackets) && sourceData.brackets.length > 0;
  const versionedData = {
    ...sourceData,
    cupConfig: {
      ...(sourceData.cupConfig || {}),
      playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
    },
  };

  if (!hasExistingBracket) {
    return { data: versionedData, applied: true, blocked: false, preservedScores: 0, pendingScores: 0 };
  }

  const unresolvedCampaignTies = getCearenseQualified(versionedData).unresolvedCampaignTies;
  if (unresolvedCampaignTies.length > 0) {
    return {
      data: normalizedData,
      applied: false,
      blocked: true,
      unresolvedCampaignTies,
      preservedScores: countStoredScores(sourceData),
      pendingScores: 0,
    };
  }

  const previousScoreCount = countStoredScores(sourceData);
  const originalBracketBackup = Array.isArray(tournament?.data?.brackets)
    ? structuredClone(tournament.data.brackets)
    : structuredClone(sourceData.brackets);
  const existingBackups = Array.isArray(sourceData.privateData?.playRankingBracketBackups)
    ? sourceData.privateData.playRankingBracketBackups
    : [];
  const hasMigrationBackup = existingBackups.some((backup) => backup?.key === PLAY_RANKING_MIGRATION_BACKUP_KEY);
  const protectedData = {
    ...versionedData,
    privateData: {
      ...(sourceData.privateData || {}),
      playRankingBracketBackups: hasMigrationBackup
        ? existingBackups
        : [
          ...existingBackups,
          {
            key: PLAY_RANKING_MIGRATION_BACKUP_KEY,
            sourceVersion: Number(tournament?.data?.cupConfig?.playRankingBracketVersion)
              || Number(sourceData.cupConfig?.playRankingBracketVersion)
              || 0,
            brackets: originalBracketBackup,
          },
        ],
    },
  };
  const mainBracketMigratedData = syncCupBracketScores(protectedData);
  // A Paralela do Modelo Torneio 360 depende das derrotadas da abertura da
  // Principal. A segunda passagem ocorre depois que os placares equivalentes
  // já foram transportados e permite reconstruir essa chave derivada.
  const migratedData = syncCupBracketScores(mainBracketMigratedData);
  const preservedScores = countStoredScores(migratedData);

  return {
    data: migratedData,
    applied: true,
    blocked: false,
    backupCreated: !hasMigrationBackup,
    preservedScores,
    pendingScores: Math.max(0, previousScoreCount - preservedScores),
  };
}
