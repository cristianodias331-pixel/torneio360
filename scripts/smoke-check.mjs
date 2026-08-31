import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { orderFixedMixedPair } from "../src/fixedMixedTeamOrder.mjs";
import { super12IndividualTemplate } from "../src/super12Schedule.mjs";
import { super20MixedTemplate } from "../src/super20MixedSchedule.mjs";
import { buildReizinhoGames, reizinhoPairRounds } from "../src/reizinhoSchedule.mjs";
import {
  chooseCircuitParticipantDisplayName,
  normalizeCircuitParticipantKey,
} from "../src/circuitNameIdentity.mjs";
import {
  compactCircuitRowsForDashboardCache,
  mergeConcurrentTournamentData,
  preservesTournamentCriticalData,
} from "../src/offlineDataStore.mjs";
import {
  MAX_MATCH_TIMER_SECONDS,
  capExpiredMatchTimer,
  formatMatchDuration,
  formatMatchTotalDuration,
  getMatchElapsedSeconds,
  resetMatchTimer,
  startMatchTimer,
  stopMatchTimer,
} from "../src/domain/matchTimer.mjs";
import {
  applyCourtNumberToGame,
  createDefaultCourtNumbers,
  getGameCourtLabel,
  getGameCourtNumber,
  normalizeCourtNumberValue,
  normalizeCourtNumbers,
} from "../src/domain/courtNumbers.mjs";
import {
  assignScheduleCourtNumbers,
  buildAutomaticCourtPool,
} from "../src/domain/automaticCourtAssignments.mjs";
import {
  formatDateBR,
  getBrazilDateISO,
  getBrazilDateTimeKey,
  getBrazilTodayISO,
  getCalendarDayDifference,
  getFreeTrialDetails,
  getWeekdayBR,
  isoDateToUtcDay,
} from "../src/domain/dateTime.mjs";
import {
  getAuthErrorMessage,
  isEmailNotConfirmedError,
  isProfilePendingEmailConfirmation,
  isUserAlreadyRegisteredError,
  isValidEmail,
  normalizeEmail,
} from "../src/domain/authValidation.mjs";
import {
  stableJsonStringify,
  tournamentMutationWasApplied,
  tournamentSnapshotMatches,
} from "../src/domain/tournamentPersistence.mjs";
import {
  clearAuthCallbackUrl,
  getAuthCallbackError,
  getAuthFlowFromLocation,
  getAuthRedirectUrl,
} from "../src/domain/authNavigation.mjs";
import {
  getBrazilianWhatsAppUrl,
  getPlanRegularizationWhatsAppUrl,
  getPlatformWhatsAppUrl,
} from "../src/domain/contactLinks.mjs";
import {
  formatStatusBR,
  normalizeCircuitStatus,
} from "../src/domain/statusFormatting.mjs";
import {
  HOMOLOGATION_LOAD_CIRCUIT_COUNT,
  HOMOLOGATION_LOAD_LAYOUT_VERSION,
  HOMOLOGATION_LOAD_MARKER,
  HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT,
  HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT,
  HOMOLOGATION_LOAD_TOURNAMENT_COUNT,
  HOMOLOGATION_LOAD_TOURNAMENTS_PER_CIRCUIT,
  assertHomologationLoadTarget,
  buildHomologationCircuitHistoryRows,
  buildHomologationCircuitRows,
  buildHomologationTournamentRows,
  isHomologationLoadCircuit,
} from "../src/domain/homologationLoadData.mjs";
import {
  getMaxScore,
  getScoreWinnerSide,
  getWinningScore,
  isGameFinished,
  normalizeScoreInput,
} from "../src/domain/scoreRules.mjs";
import { formatParticipantName } from "../src/domain/participantNames.mjs";
import {
  BRAZILIAN_STATES,
  normalizeBrazilianState,
} from "../src/domain/brazilLocations.mjs";
import {
  createInitialData,
  formatParticipantNameWhileTyping,
  isTournamentDataObject,
  needsTournamentDataRepair,
  normalizeBrackets,
  normalizeGame,
  normalizeGameIds,
  normalizeGameNames,
  normalizeIndividualCupPlayers,
  normalizeNameList,
  normalizeSchedule,
  normalizeTeams,
  normalizeTournamentData,
} from "../src/domain/tournamentDataNormalization.mjs";
import {
  getAutomaticEventStatus,
  getCircuitLifecycleStatus,
  getTournamentCompletionState,
  getTournamentEventSortKey,
  getTournamentLifecycleStatus,
  getTournamentRegistrationDeadline,
  insertTournamentsByEventSchedule,
  isRegistrationDeadlineOpen,
  sortTournamentsForDisplay,
} from "../src/domain/tournamentLifecycle.mjs";
import { createTournamentOperations } from "../src/domain/tournamentOperations.mjs";
import {
  getPublicCircuitDirectoryItem,
  getPublicTournamentDirectoryItem,
  getRegisteredAthletesForPublic,
  normalizePublicCircuitForDisplay,
  selectVisiblePublicCircuitRankingGroups,
  sortCircuitsForDisplay,
} from "../src/domain/publicArenaData.mjs";
import {
  ARENA_DIRECTORY_CACHE_KEY,
  PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS,
  getPublicArenaBundleCacheKey,
  readPublicArenaBundleCache,
  readPublicArenaPhotoCache,
  readPublicCircuitDetailCache,
  readPublicTournamentDetailCache,
  writePublicArenaBundleCache,
  writePublicArenaPhotoCache,
  writePublicCircuitDetailCache,
  writePublicTournamentDetailCache,
} from "../src/domain/publicArenaCache.mjs";
import { createPublicArenaApi } from "../src/services/publicArenaApi.mjs";
import {
  EVENT_MEDIA_BUCKET,
  uploadPreparedImagePair,
  uploadProfilePhoto,
} from "../src/services/mediaStorage.mjs";
import {
  normalizeTournamentSummaryRow,
  tournamentSummarySelect,
} from "../src/domain/tournamentSummary.mjs";
import {
  getUserAppStateCloudDelay,
  getUserAppStateSyncSignature,
} from "../src/domain/userAppStateSync.mjs";
import {
  circuitDirectorySelect,
  circuitHistorySelect,
  normalizeCircuitRow,
  normalizeCircuitTournamentIds,
} from "../src/domain/circuitDirectory.mjs";
import { createLatestEntitySignalProcessor } from "../src/services/latestEntitySignalProcessor.mjs";
import { createUserAppStateCloudQueue } from "../src/services/userAppStateCloudQueue.mjs";
import {
  generateCollaborationChangeId,
  generatePublicId,
  getArenaPublicShareMessage,
  getArenaPublicUrl,
  getPublicUrl,
} from "../src/domain/publicIdentifiers.mjs";
import {
  DEFAULT_TOURNAMENT_NAVIGATION,
  getOpenTournamentsStorageKey,
  getTournamentDraftStorageKey,
  getTournamentVenueKey,
  isRetryableConnectionError,
  normalizeCourtCenterEntry,
} from "../src/domain/localAppStorage.mjs";
import {
  getOppositeParticipantGender,
  getTournamentGenderLabel,
  getParticipantGender,
  inferTournamentGenderMode,
  mergeTournamentGenderCandidates,
  orderConfirmedMixedTeams,
  participantGenderValues,
  setParticipantGender,
  setParticipantGenders,
  tournamentGenderModes,
} from "../src/domain/participantGenderRegistry.mjs";
import {
  getCompatibleTournamentType,
  getEditableTournamentGenderFields,
  getEffectiveTournamentGenderMode,
  getGenderCompatibleTournamentTypes,
  getStoredTournamentGenderFields,
  getTournamentListGenderFilter,
  getTournamentClassificationLabels,
  matchesTournamentListGenderFilter,
  tournamentListGenderFilters,
} from "../src/domain/tournamentGenderConfig.mjs";
import {
  getGameSideAttendanceParticipants,
  getParticipantAttendanceEntries,
  normalizeAttendanceList,
  normalizeParticipantAttendance,
  reconcileParticipantAttendance,
  setParticipantAttendanceValue,
} from "../src/domain/participantAttendance.mjs";
import {
  cleanSpeechName,
  formatTeamForSpeech,
  getGameSpeechText,
  repeatText,
} from "../src/features/matchOperations/speechAnnouncements.mjs";
import {
  SHUFFLE_DURATION_SECONDS,
  SHUFFLE_MOVEMENT_INTERVAL_MS,
  createShuffleAnimationItems,
  createShuffleSlots,
  getShuffleNames,
  moveShuffleAnimationItems,
} from "../src/features/media/shuffleAnimation.mjs";
import {
  STORY_COVER_HEIGHT,
  STORY_COVER_WIDTH,
  clampStoryCoverTransform,
  getStoryCoverBackgroundRect,
  getStoryCoverBaseScale,
  getStoryCoverRenderRect,
  storyCoverHasNativeResolution,
} from "../src/features/media/storyCoverCrop.mjs";
import {
  applyCircuitDrawOrder,
  applyCircuitExtraPoints,
  applyCircuitManualParticipants,
  compareCircuitStageScores,
  defaultCircuitPositionPoints,
  getCircuitCupPlacementKey,
  getCircuitPerformanceColumns,
  getCircuitPlacementColumns,
  getCircuitRankingExportColumns,
  getCircuitPlacementLabel,
  getCircuitTieBreakLabel,
  getCircuitTieSignature,
  getUnresolvedCircuitTieGroups,
  normalizeCircuitPointValue,
  normalizeCircuitRankingSettings,
  normalizeCircuitTieBreakOrder,
} from "../src/domain/circuitRankingSettings.mjs";
import {
  normalizeRankingExportGroups,
  paginateRankingGroups,
} from "../src/domain/rankingPagination.mjs";
import {
  compareCollaborationVersions,
  getCollaborationRevision,
  mergeRealtimeTournamentRow,
  tournamentDataEquals,
  tournamentMutationDataEquals,
} from "../src/domain/realtimeTournamentMerge.mjs";
import { inspectTournamentScoreRegression } from "../src/domain/tournamentScoreSafety.mjs";
import {
  getGameParticipantIdentityEntries,
  getSharedGameParticipants,
} from "../src/domain/gameParticipants.mjs";
import {
  defaultRankingCriteria,
  formatRankingMetricValue,
  getRankingColumnLabel,
  getRankingCriteria,
  rankingCriteriaOptions,
} from "../src/domain/rankingCriteria.mjs";
import {
  calculateScheduleRanking,
  calculateTeamGamesRanking,
} from "../src/domain/rankingCalculation.mjs";
import {
  calculateCircuitTournamentRankingRows,
  calculateTournamentRanking,
} from "../src/domain/tournamentRanking.mjs";
import {
  calculateCircuitPlacementRowsByConfig,
  calculateCupPlacementRows,
  calculateRankPlacementRows,
  isCompletedCircuitGame,
} from "../src/domain/circuitPlacement.mjs";
import {
  buildCircuitRankingGroups,
  buildCircuitRankingGroupsFromRecords,
  buildCircuitTournamentRankingRecords,
  buildUniqueCombinedCircuitSourceSlices,
} from "../src/domain/circuitRankingAggregation.mjs";
import {
  getModalityDisplayName,
  modalityDisplayNames,
  modalityPickerDescriptions,
  modalityPickerGroups,
  normalizeModalitySearch,
} from "../src/domain/modalityCatalog.mjs";
import { allowedByPlan, modalityConfig } from "../src/domain/modalityConfig.mjs";
import {
  isCupType,
  isFixedTeamType,
  isFlexibleSimpleType,
  isIndividualCupType,
  isMixedType,
  isReizinhoType,
} from "../src/domain/modalityClassification.mjs";
import {
  getReizinhoPlayerCount,
  getSimplePlayerCount,
  getTournamentCourtCount,
} from "../src/domain/modalitySettings.mjs";
import {
  fixed12Template,
  super10MixedTemplate,
  super12MixedTemplate,
  super16MixedTemplate,
  super8Template,
} from "../src/domain/scheduleTemplates.mjs";
import {
  berger,
  optimizeCourts,
  shuffleArray,
} from "../src/domain/scheduleGeneration.mjs";
import { generateSchedule } from "../src/domain/tournamentScheduleFactory.mjs";
import {
  createCearenseGroups,
  createCupGroups,
  createRoundRobinPairings,
  describeCearenseGroupSizes,
  getCupTeamName,
  getCupTeams,
  getGroupLetter,
  getTeamName,
} from "../src/domain/cupGroups.mjs";
import {
  getCupFormat,
  isCampeonatoCearenseData,
  isCearenseData,
  isCearenseSecondParallelEnabled,
  isCearenseThirdParallelEnabled,
  isCopinhaData,
  isOfficialCearenseData,
  isPlayRankingData,
  isSunsetData,
} from "../src/domain/cupFormat.mjs";
import {
  generateCearenseGroupSchedule,
  generateCupGroupSchedule,
} from "../src/domain/cupGroupSchedule.mjs";
import {
  generateParallelRoundRobin,
  getBracketSeedOrder,
  getEliminationRoundName,
  getLargestPowerOfTwo,
  getNextPowerOfTwo,
  seedBracket,
} from "../src/domain/bracketBasics.mjs";
import {
  buildNextRound,
  buildThirdPlaceGame,
  getGameLoserId,
  getGameWinnerId,
  resolveBracketGame,
} from "../src/domain/bracketProgression.mjs";
import {
  avoidSameGroupOpeningMatches,
  buildCearenseEliminationRounds,
  createCopinhaBracketGame,
  getCopinhaPreliminaryPairs,
} from "../src/domain/bracketConstruction.mjs";
import {
  buildPlayRankingParallelRounds,
  getPlayRankingOpeningLosses,
  pairPlayRankingTransferredEntries,
} from "../src/domain/playRankingBracket.mjs";
import {
  buildCearenseThirdParallelRounds,
  getCearenseThirdParallelSources,
} from "../src/domain/cearenseThirdParallel.mjs";
import {
  buildSunsetChampionsRounds,
  buildSunsetMainRunnerUpFallback,
  buildSunsetParallelFromMainRound,
  getBracketChampionSource,
  getSunsetMainSourceGames,
} from "../src/domain/sunsetBracket.mjs";
import {
  buildCopinhaBracketFromPlan,
  buildCopinhaEliminationRounds,
  expandBracketPlanWithVisualByes,
  getCopinhaEntryCode,
  getCopinhaPlanEntry,
} from "../src/domain/cupBracketConstruction.mjs";
import {
  playRankingLegacyV2MainBracketPlans,
  playRankingLegacyV3MainBracketPlans,
  playRankingMainBracketPlans,
} from "../src/domain/cupBracketPlans.mjs";
import {
  generatePlayRankingBrackets,
  syncCupBracketScores,
} from "../src/domain/cupBracketOrchestration.mjs";
import {
  PLAY_RANKING_BRACKET_VERSION,
  PLAY_RANKING_RETROACTIVE_PROFILE_ID,
  migratePlayRankingBracketForReferenceProfile,
  shouldMigratePlayRankingBracket,
} from "../src/domain/playRankingBracketMigration.mjs";
import { createCupPresentation } from "../src/domain/cupPresentation.mjs";
import {
  getCopinhaHeadToHeadWinnerId,
  getCopinhaManualTieOrder,
  rankCearenseGroupRows,
  rankCopinhaGroupRows,
  rankOfficialCearenseGroupRows,
  rankPlayRankingGroupRows,
} from "../src/domain/groupRankingRules.mjs";
import {
  compareCearenseCampaignMetrics,
  compareOfficialCearenseChampions,
  getCearenseCampaignTieKey,
  getOfficialCearenseAdjustedBalance,
  getOfficialCearenseChampionTieKey,
  getReducedRatio,
  greatestCommonDivisor,
  haveSameCearenseCampaign,
  rankCearenseCampaignEntries,
} from "../src/domain/campaignRanking.mjs";
import { calculateCupGroupRankings } from "../src/domain/cupGroupRanking.mjs";
import {
  getCearenseQualified,
  getOfficialCearenseQualified,
} from "../src/domain/cearenseQualification.mjs";
import {
  getCopinhaQualified,
  getCopinhaSeededGroups,
  getCup18Qualified,
  getCup21Qualified,
  getCupQualified,
} from "../src/domain/cupQualification.mjs";

const root = new URL("../", import.meta.url);
const mainEntrySource = readFileSync(new URL("src/main.jsx", root), "utf8");
const organizerWorkspaceSource = readFileSync(new URL("src/OrganizerWorkspace.jsx", root), "utf8");
const organizationProfilePresentationSource = readFileSync(new URL("src/features/profile/OrganizationProfilePresentation.jsx", root), "utf8");
const organizationProfileContentPresentationSource = readFileSync(new URL("src/features/profile/OrganizationProfileContentPresentation.jsx", root), "utf8");
const platformChromeSource = readFileSync(new URL("src/features/appShell/PlatformChrome.jsx", root), "utf8");
const mainSource = `${mainEntrySource}\n${organizerWorkspaceSource}\n${platformChromeSource}`;
const lazyFeaturesSource = readFileSync(
  new URL("src/features/appShell/lazyFeatures.jsx", root),
  "utf8"
);
const loginScreenSource = readFileSync(
  new URL("src/features/auth/LoginScreen.jsx", root),
  "utf8"
);
const unifiedPlatformFrameSource = readFileSync(
  new URL("src/features/appShell/UnifiedPlatformFrame.jsx", root),
  "utf8"
);
const platformNavigationSource = readFileSync(
  new URL("src/domain/platformNavigation.mjs", root),
  "utf8"
);
const memberProfileWorkspaceSource = readFileSync(
  new URL("src/features/profile/MemberProfileWorkspace.jsx", root),
  "utf8"
);
const memberProfileDetailsSource = readFileSync(
  new URL("src/features/profile/MemberProfileDetailsModal.jsx", root),
  "utf8"
);
const tournamentRegistrationPanelSource = readFileSync(
  new URL("src/features/registration/TournamentRegistrationPanel.jsx", root),
  "utf8"
);
const athleteProfileActivitySource = readFileSync(
  new URL("src/features/profile/AthleteProfileActivity.jsx", root),
  "utf8"
);
const athleteActivityApiSource = readFileSync(
  new URL("src/services/athleteActivityApi.mjs", root),
  "utf8"
);
const athleteProfileActivityMigrationSource = readFileSync(
  new URL("supabase/migrations/202608270001_athlete_profile_activity.sql", root),
  "utf8"
);
const organizationRegistrantsPanelSource = readFileSync(
  new URL("src/features/profile/OrganizationRegistrantsPanel.jsx", root),
  "utf8"
);
const organizationRegistrantsApiSource = readFileSync(
  new URL("src/services/organizationRegistrantsApi.mjs", root),
  "utf8"
);
const organizationRegistrantsMigrationSource = readFileSync(
  new URL("supabase/migrations/202608270002_organization_registrants.sql", root),
  "utf8"
);
const registrationWorkflowMigrationSource = readFileSync(
  new URL("supabase/migrations/202608270005_tournament_registration_workflow.sql", root),
  "utf8"
);
const organizationPaymentApiSource = readFileSync(
  new URL("src/services/organizationPaymentApi.mjs", root),
  "utf8"
);
const organizationCoverApiSource = readFileSync(
  new URL("src/services/organizationCoverApi.mjs", root),
  "utf8"
);
const organizationCoverMigrationSource = readFileSync(
  new URL("supabase/migrations/202608270004_organization_profile_cover.sql", root),
  "utf8"
);
const profileImageEditorSource = readFileSync(
  new URL("src/features/profile/ProfileImageEditor.jsx", root),
  "utf8"
);
const tournamentPaymentPanelSource = readFileSync(
  new URL("src/features/registration/TournamentPaymentPanel.jsx", root),
  "utf8"
);
const organizationPublicPaymentsMigrationSource = readFileSync(
  new URL("supabase/migrations/202608270003_organization_public_payments.sql", root),
  "utf8"
);
const cupRankingDefaultsSource = readFileSync(
  new URL("src/domain/cupRankingDefaults.mjs", root),
  "utf8"
);
const viteConfigSource = readFileSync(new URL("vite.config.mjs", root), "utf8");
assert.ok(
  mainSource.includes('"Você está sem internet"')
    && !mainSource.includes('"Dados ainda não sincronizados"'),
  "A edição voltou a bloquear a tela entre dispositivos ou deixou de avisar quando não há internet."
);
assert.ok(
  mainSource.includes("function applyScheduleScoreChange")
    && mainSource.includes("function updateBracketScore")
    && mainSource.match(/function applyScheduleScoreChange[\s\S]*?allowScoreRegression: true/)
    && mainSource.match(/function updateBracketScore[\s\S]*?allowScoreRegression: true/),
  "A remoção manual de placar deixou de ser reconhecida como uma alteração intencional."
);
assert.ok(
  mainSource.match(/function migrateReferenceProfilePlayRankingTournaments[\s\S]*?String\(user\.id \|\| ""\) !== PLAY_RANKING_RETROACTIVE_PROFILE_ID/)
    && mainSource.match(/function migrateReferenceProfilePlayRankingTournaments[\s\S]*?modalityConfig\[item\?\.type\]\?\.type === "playranking"/)
    && mainSource.match(/function migrateReferenceProfilePlayRankingTournaments[\s\S]*?\.eq\("user_id", PLAY_RANKING_RETROACTIVE_PROFILE_ID\)/),
  "A atualização retroativa deixou de estar isolada ao perfil PLAY RANKING® e à sua modalidade Modelo Torneio 360."
);
const styleSource = [
  readFileSync(new URL("src/style.css", root), "utf8"),
  ...readdirSync(new URL("src/styles/", root))
    .filter((fileName) => fileName.endsWith(".css"))
    .sort()
    .map((fileName) => readFileSync(new URL(`src/styles/${fileName}`, root), "utf8")),
].join("\n");
const authValidationSource = readFileSync(
  new URL("src/domain/authValidation.mjs", root),
  "utf8"
);
const contactLinksSource = readFileSync(
  new URL("src/domain/contactLinks.mjs", root),
  "utf8"
);
const tournamentDataNormalizationSource = readFileSync(
  new URL("src/domain/tournamentDataNormalization.mjs", root),
  "utf8"
);
const tournamentLifecycleSource = readFileSync(
  new URL("src/domain/tournamentLifecycle.mjs", root),
  "utf8"
);
const tournamentOperationsSource = readFileSync(
  new URL("src/domain/tournamentOperations.mjs", root),
  "utf8"
);
const tournamentScheduleFactorySource = readFileSync(
  new URL("src/domain/tournamentScheduleFactory.mjs", root),
  "utf8"
);
const localAppStorageSource = readFileSync(
  new URL("src/domain/localAppStorage.mjs", root),
  "utf8"
);
const publicArenaDataSource = readFileSync(
  new URL("src/domain/publicArenaData.mjs", root),
  "utf8"
);
const publicArenaCacheSource = readFileSync(
  new URL("src/domain/publicArenaCache.mjs", root),
  "utf8"
);
const publicArenaApiSource = readFileSync(
  new URL("src/services/publicArenaApi.mjs", root),
  "utf8"
);
const publicEventCoversMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240001_public_event_covers.sql", root),
  "utf8"
);
const publicCoverThumbnailsMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240002_public_cover_thumbnails.sql", root),
  "utf8"
);
const groupedEventGeneralCoverMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240003_grouped_event_general_cover.sql", root),
  "utf8"
);
const platformTrafficScalingMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240004_platform_traffic_scaling.sql", root),
  "utf8"
);
const eventMediaStorageMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240005_event_media_storage.sql", root),
  "utf8"
);
const publicArenaSnapshotCacheMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240006_public_arena_snapshot_cache.sql", root),
  "utf8"
);
const tournamentChangeFeedMigrationSource = readFileSync(
  new URL("supabase/migrations/202608240007_tournament_change_feed.sql", root),
  "utf8"
);
const publicArenaEventPaginationMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250001_public_arena_event_pagination.sql", root),
  "utf8"
);
const publicArenaLegacyCompatibilityMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250002_public_arena_legacy_bundle_compatibility.sql", root),
  "utf8"
);
const circuitChangeFeedMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250003_circuit_change_feed.sql", root),
  "utf8"
);
const publicArenaInitialViewMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250004_public_arena_initial_view.sql", root),
  "utf8"
);
const publicArenaInitialViewOptimizedMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250005_public_arena_initial_view_optimized.sql", root),
  "utf8"
);
const publicCircuitRankingPerformanceMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250006_public_circuit_ranking_performance.sql", root),
  "utf8"
);
const publicCircuitSnapshotCacheMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250007_public_circuit_snapshot_cache.sql", root),
  "utf8"
);
const publicCircuitCacheWriteModeMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250008_public_circuit_cache_write_mode.sql", root),
  "utf8"
);
const publicArenaInitialViewCacheMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250009_public_arena_initial_view_cache.sql", root),
  "utf8"
);
const publicArenaInitialViewCacheFixMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250010_public_arena_initial_view_cache_fix.sql", root),
  "utf8"
);
const publicCircuitRankingPaginationMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250011_public_circuit_ranking_pagination.sql", root),
  "utf8"
);
const publicCircuitRankingPageCacheMigrationSource = readFileSync(
  new URL("supabase/migrations/202608250012_public_circuit_ranking_page_cache.sql", root),
  "utf8"
);
const organizerScaleCheckSource = readFileSync(
  new URL("scripts/organizer-scale-check.sql", root),
  "utf8"
);
const browserPerformanceCheckSource = readFileSync(
  new URL("scripts/browser-performance-check.mjs", root),
  "utf8"
);
const publicCircuitPaginationCheckSource = readFileSync(
  new URL("scripts/public-circuit-pagination-check.mjs", root),
  "utf8"
);
const latestEntitySignalProcessorSource = readFileSync(
  new URL("src/services/latestEntitySignalProcessor.mjs", root),
  "utf8"
);
const publicIdentifiersSource = readFileSync(
  new URL("src/domain/publicIdentifiers.mjs", root),
  "utf8"
);
const rankingShareButtonSource = readFileSync(
  new URL("src/features/rankingShare/RankingShareButton.jsx", root),
  "utf8"
);
const rankingShareExportSource = readFileSync(
  new URL("src/features/rankingShare/rankingShareExport.mjs", root),
  "utf8"
);
const rankingWorkbookExportSource = readFileSync(
  new URL("src/features/rankingShare/rankingWorkbookExport.mjs", root),
  "utf8"
);
const canvasToolsSource = readFileSync(new URL("src/features/media/canvasTools.mjs", root), "utf8");
const tournamentWorkspaceTabsSource = readFileSync(
  new URL("src/features/tournamentWorkspace/TournamentWorkspaceTabs.jsx", root),
  "utf8"
);
const tournamentRuntimeAdaptersSource = readFileSync(
  new URL("src/features/tournamentWorkspace/TournamentRuntimeAdapters.jsx", root),
  "utf8"
);
const courtCenterModalSource = readFileSync(
  new URL("src/features/courtCenter/CourtCenterModal.jsx", root),
  "utf8"
);
const modalityPickerSource = readFileSync(
  new URL("src/features/modalityPicker/ModalityPicker.jsx", root),
  "utf8"
);
const matchControlsSource = readFileSync(
  new URL("src/features/matchOperations/MatchControls.jsx", root),
  "utf8"
);
const matchScheduleSource = readFileSync(
  new URL("src/features/matchOperations/MatchSchedule.jsx", root),
  "utf8"
);
const speechAnnouncementsSource = readFileSync(
  new URL("src/features/matchOperations/speechAnnouncements.mjs", root),
  "utf8"
);
const tournamentSummaryViewsSource = readFileSync(
  new URL("src/features/matchOperations/TournamentSummaryViews.jsx", root),
  "utf8"
);
const participantManagementSource = readFileSync(
  new URL("src/features/participantManagement/ParticipantManagement.jsx", root),
  "utf8"
);
const publicArenaPresentationSource = readFileSync(
  new URL("src/features/publicArena/PublicArenaPresentation.jsx", root),
  "utf8"
);
const publicArenaPageControllerSource = readFileSync(
  new URL("src/features/publicArena/PublicArenaPageController.jsx", root),
  "utf8"
);
const publicPlatformHomeControllerSource = readFileSync(
  new URL("src/features/publicArena/PublicPlatformHomeController.jsx", root),
  "utf8"
);
const publicTournamentPageControllerSource = readFileSync(
  new URL("src/features/publicArena/PublicTournamentPageController.jsx", root),
  "utf8"
);
const publicCircuitScreenSource = readFileSync(
  new URL("src/features/publicArena/PublicCircuitScreen.jsx", root),
  "utf8"
);
const publicTournamentScreenSource = readFileSync(
  new URL("src/features/publicArena/PublicTournamentScreen.jsx", root),
  "utf8"
);
const storyCoverEditorSource = readFileSync(
  new URL("src/features/media/StoryCoverEditor.jsx", root),
  "utf8"
);
const storyCoverCropSource = readFileSync(
  new URL("src/features/media/storyCoverCrop.mjs", root),
  "utf8"
);
const rankingTablesSource = readFileSync(
  new URL("src/features/ranking/RankingTables.jsx", root),
  "utf8"
);
const cupPodiumSource = readFileSync(
  new URL("src/features/ranking/CupPodiumView.jsx", root),
  "utf8"
);
const tieBreakPanelsSource = readFileSync(
  new URL("src/features/ranking/TieBreakPanels.jsx", root),
  "utf8"
);
const cupBracketViewSource = readFileSync(
  new URL("src/features/brackets/CupBracketView.jsx", root),
  "utf8"
);
const publicBracketViewSource = readFileSync(
  new URL("src/features/brackets/PublicBracketView.jsx", root),
  "utf8"
);
const appUpdateNoticeSource = readFileSync(
  new URL("src/features/appShell/AppUpdateNotice.jsx", root),
  "utf8"
);
const shuffleVideoModalSource = readFileSync(
  new URL("src/features/media/ShuffleVideoModal.jsx", root),
  "utf8"
);
const shuffleAnimationSource = readFileSync(
  new URL("src/features/media/shuffleAnimation.mjs", root),
  "utf8"
);
const shuffleVideoExportSource = readFileSync(
  new URL("src/features/media/shuffleVideoExport.mjs", root),
  "utf8"
);
const tournamentErrorBoundarySource = readFileSync(
  new URL("src/features/tournamentWorkspace/TournamentErrorBoundary.jsx", root),
  "utf8"
);
const entryPresentationSource = readFileSync(
  new URL("src/features/appShell/EntryPresentation.jsx", root),
  "utf8"
);
const accessStatusViewsSource = readFileSync(
  new URL("src/features/appShell/AccessStatusViews.jsx", root),
  "utf8"
);
const tournamentFormatPanelsSource = readFileSync(
  new URL("src/features/tournamentConfig/TournamentFormatPanels.jsx", root),
  "utf8"
);
const tournamentFormatHelpSource = readFileSync(
  new URL("src/features/tournamentConfig/TournamentFormatHelp.jsx", root),
  "utf8"
);
const formatExplanationButtonSource = readFileSync(
  new URL("src/features/tournamentConfig/FormatExplanationButton.jsx", root),
  "utf8"
);
const circuitRankingSettingsPanelSource = readFileSync(
  new URL("src/features/circuitManagement/CircuitRankingSettings.jsx", root),
  "utf8"
);
const circuitExtraPointsPanelSource = readFileSync(
  new URL("src/features/circuitManagement/CircuitExtraPointsPanel.jsx", root),
  "utf8"
);
const tournamentCircuitManagerSource = readFileSync(
  new URL("src/features/circuitManagement/TournamentCircuitManager.jsx", root),
  "utf8"
);
const homologationLoadLabSource = readFileSync(
  new URL("src/features/testing/HomologationLoadLab.jsx", root),
  "utf8"
);
const confirmationDialogsSource = readFileSync(
  new URL("src/features/dialogs/ConfirmationDialogs.jsx", root),
  "utf8"
);
const installSource = readFileSync(new URL("src/InstallAppBanner.jsx", root), "utf8");
const indexSource = readFileSync(new URL("index.html", root), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("public/manifest.webmanifest", root), "utf8"));
const appVersion = JSON.parse(readFileSync(new URL("public/app-version.json", root), "utf8"));
assert.ok(
  styleSource.includes('@keyframes asyncActionIndicatorSpin')
    && styleSource.includes('button[aria-busy="true"]::after')
    && organizerWorkspaceSource.includes("if (circuitSavingRef.current) return false;")
    && organizerWorkspaceSource.includes("return await persistCircuit(form, options);")
    && organizerWorkspaceSource.includes('aria-busy={circuitSaving || coverImageLoading}')
    && publicArenaPresentationSource.includes('aria-busy={openingPublicId === tournament.public_id}')
    && publicArenaPresentationSource.includes('aria-busy={openingCircuitId === item.id}')
    && rankingTablesSource.includes('aria-busy={remotePagination.loading === true}')
    && rankingShareButtonSource.includes('aria-busy={status === "loading"}')
    && accessStatusViewsSource.includes('aria-busy={retrying}')
    && homologationLoadLabSource.includes("if (busyRef.current) return;")
    && homologationLoadLabSource.includes('aria-busy={busyAction === "remove"}')
    && tournamentCircuitManagerSource.includes("if (!changed || savingRef.current) return;")
    && circuitExtraPointsPanelSource.includes('aria-busy={extraSaving}')
    && tournamentWorkspaceTabsSource.includes('aria-busy={isBusy}'),
  "As ações demoradas perderam o indicador visual ou voltaram a aceitar cliques repetidos."
);
const publicArenaMigrationUrl = new URL("supabase/migrations/202608030001_public_arena_platform.sql", root);
assert.ok(existsSync(fileURLToPath(publicArenaMigrationUrl)), "A migração segura da plataforma pública está ausente.");
const publicArenaMigration = readFileSync(publicArenaMigrationUrl, "utf8");
const arenaDirectoryRulesMigrationUrl = new URL("supabase/migrations/202608040001_arena_directory_access_rules.sql", root);
assert.ok(existsSync(fileURLToPath(arenaDirectoryRulesMigrationUrl)), "A migração das regras do diretório de arenas está ausente.");
const arenaDirectoryRulesMigration = readFileSync(arenaDirectoryRulesMigrationUrl, "utf8");
const collaborationMigrationUrl = new URL("supabase/migrations/202608080001_data_integrity_and_collaboration.sql", root);
assert.ok(existsSync(fileURLToPath(collaborationMigrationUrl)), "A migração de integridade e colaboração está ausente.");
const collaborationMigration = readFileSync(collaborationMigrationUrl, "utf8");
const serverRevisionMigrationUrl = new URL("supabase/migrations/202608080002_server_revisions.sql", root);
assert.ok(existsSync(fileURLToPath(serverRevisionMigrationUrl)), "A migração de revisões do servidor está ausente.");
const serverRevisionMigration = readFileSync(serverRevisionMigrationUrl, "utf8");
const tournamentHistoryMigrationUrl = new URL("supabase/migrations/202608190001_tournament_data_history.sql", root);
assert.ok(existsSync(fileURLToPath(tournamentHistoryMigrationUrl)), "A migração do histórico de dados dos torneios está ausente.");
const tournamentHistoryMigration = readFileSync(tournamentHistoryMigrationUrl, "utf8");
const tournamentGuardMigrationUrl = new URL("supabase/migrations/202608190002_tournament_critical_data_guard.sql", root);
assert.ok(existsSync(fileURLToPath(tournamentGuardMigrationUrl)), "A proteção atômica dos torneios está ausente.");
const tournamentGuardMigration = readFileSync(tournamentGuardMigrationUrl, "utf8");
const circuitRankingSummaryMigrationUrl = new URL(
  "supabase/migrations/202608190003_circuit_ranking_summary_read.sql",
  root
);
assert.ok(
  existsSync(fileURLToPath(circuitRankingSummaryMigrationUrl)),
  "A leitura otimizada dos rankings de circuitos está ausente."
);
const circuitRankingSummaryMigration = readFileSync(circuitRankingSummaryMigrationUrl, "utf8");
const circuitScoringMigrationUrl = new URL("supabase/migrations/202608120001_circuit_scoring_models.sql", root);
assert.ok(existsSync(fileURLToPath(circuitScoringMigrationUrl)), "A migração dos modelos de pontuação dos circuitos está ausente.");
const circuitScoringMigration = readFileSync(circuitScoringMigrationUrl, "utf8");
const publicArenaReliabilityMigrationUrl = new URL("supabase/migrations/202608180001_public_arena_reliability.sql", root);
assert.ok(existsSync(fileURLToPath(publicArenaReliabilityMigrationUrl)), "A migração de confiabilidade dos perfis públicos está ausente.");
const publicArenaReliabilityMigration = readFileSync(publicArenaReliabilityMigrationUrl, "utf8");
const publicArenaPayloadMigrationUrl = new URL("supabase/migrations/202608180002_public_arena_payload_optimization.sql", root);
assert.ok(existsSync(fileURLToPath(publicArenaPayloadMigrationUrl)), "A migração de otimização dos perfis públicos está ausente.");
const publicArenaPayloadMigration = readFileSync(publicArenaPayloadMigrationUrl, "utf8");
const offlineStoreSource = readFileSync(new URL("src/offlineDataStore.mjs", root), "utf8");
const serviceWorkerSource = readFileSync(new URL("public/sw.js", root), "utf8");
const groupRankingRulesSource = readFileSync(new URL("src/domain/groupRankingRules.mjs", root), "utf8");
const campaignRankingSource = readFileSync(new URL("src/domain/campaignRanking.mjs", root), "utf8");
const cearenseQualificationSource = readFileSync(new URL("src/domain/cearenseQualification.mjs", root), "utf8");
const playRankingBracketSource = readFileSync(new URL("src/domain/playRankingBracket.mjs", root), "utf8");
const cearenseThirdParallelSource = readFileSync(new URL("src/domain/cearenseThirdParallel.mjs", root), "utf8");
const sunsetBracketSource = readFileSync(new URL("src/domain/sunsetBracket.mjs", root), "utf8");
const cupBracketConstructionSource = readFileSync(new URL("src/domain/cupBracketConstruction.mjs", root), "utf8");
const cupBracketPlansSource = readFileSync(new URL("src/domain/cupBracketPlans.mjs", root), "utf8");
const cupBracketOrchestrationSource = readFileSync(new URL("src/domain/cupBracketOrchestration.mjs", root), "utf8");
const cupPresentationSource = readFileSync(new URL("src/domain/cupPresentation.mjs", root), "utf8");
const cupFormatSummarySource = readFileSync(new URL("src/domain/cupFormatSummary.mjs", root), "utf8");
const circuitRankingSettingsSource = readFileSync(new URL("src/domain/circuitRankingSettings.mjs", root), "utf8");
const participantAttendanceSource = readFileSync(new URL("src/domain/participantAttendance.mjs", root), "utf8");
const tournamentRankingSource = readFileSync(new URL("src/domain/tournamentRanking.mjs", root), "utf8");
const circuitPlacementSource = readFileSync(new URL("src/domain/circuitPlacement.mjs", root), "utf8");
const circuitRankingAggregationSource = readFileSync(new URL("src/domain/circuitRankingAggregation.mjs", root), "utf8");
const participantImportSanitizersSource = participantManagementSource.slice(
  participantManagementSource.indexOf("function stripParticipantEmojis(value)"),
  participantManagementSource.indexOf("function sanitizeParticipantName(value)")
);
const prepareParticipantLineForTest = Function(
  `"use strict"; ${participantImportSanitizersSource}; return prepareParticipantLine;`
)();

assert.equal(formatDateBR("2026-08-18"), "18/08/2026", "A data brasileira deixou de ser formatada como antes.");
assert.equal(formatDateBR("texto legado"), "texto legado", "Uma data legada deixou de ser preservada.");
assert.equal(getBrazilDateISO("2026-08-18"), "2026-08-18", "Uma data ISO válida foi alterada.");
assert.equal(getBrazilTodayISO(new Date("2026-08-18T12:00:00.000Z")), "2026-08-18", "O fuso de São Paulo deixou de ser aplicado.");
assert.equal(
  getBrazilDateTimeKey(new Date("2026-08-18T15:30:00.000Z")),
  "2026-08-18T12:30",
  "A chave de data e hora deixou de respeitar o fuso de São Paulo."
);
assert.equal(isoDateToUtcDay("2026-02-30"), null, "Uma data impossível passou a ser aceita.");
assert.equal(getCalendarDayDifference("2026-08-17", "2026-08-18"), 1, "A diferença entre dias de calendário foi alterada.");
assert.equal(getWeekdayBR("2026-08-18"), "Terça-feira", "O dia da semana em português foi alterado.");
assert.deepEqual(
  getFreeTrialDetails({ status: "active", is_trial: true, trial_ends_at: getBrazilTodayISO() }, {}),
  { daysRemaining: 1, expiresAt: getBrazilTodayISO() },
  "O último dia do período gratuito deixou de ser contabilizado."
);
assert.equal(
  getFreeTrialDetails({ status: "inactive", is_trial: true, trial_ends_at: getBrazilTodayISO() }, {}),
  null,
  "Um acesso inativo passou a exibir período gratuito."
);
assert.equal(normalizeEmail("  TESTE@EXEMPLO.COM "), "teste@exemplo.com", "O e-mail deixou de ser normalizado.");
assert.equal(isValidEmail("teste@exemplo.com"), true, "Um e-mail válido deixou de ser aceito.");
assert.equal(isValidEmail("teste@exemplo"), false, "Um e-mail incompleto passou a ser aceito.");
assert.equal(
  isEmailNotConfirmedError({ code: "email_not_confirmed" }),
  true,
  "O erro de e-mail não confirmado deixou de ser reconhecido."
);
assert.equal(
  isUserAlreadyRegisteredError({ code: "user_already_exists" }),
  true,
  "O erro de usuário já cadastrado deixou de ser reconhecido."
);
assert.equal(
  getAuthErrorMessage({ code: "over_email_send_rate_limit" }, "Falha"),
  "Aguarde alguns minutos antes de pedir outro e-mail.",
  "O limite de envio de e-mail deixou de ter a orientação correta."
);
assert.equal(
  getAuthErrorMessage({ code: "unknown" }, "Mensagem padrão"),
  "Mensagem padrão",
  "Um erro desconhecido deixou de preservar a mensagem padrão."
);
assert.equal(
  isProfilePendingEmailConfirmation({ status: "pending", expires_at: null }),
  true,
  "Um perfil aguardando confirmação deixou de ser reconhecido."
);
assert.equal(
  isProfilePendingEmailConfirmation({ status: "pending", expires_at: "2026-08-18" }),
  false,
  "Um perfil com acesso definido passou a ser tratado como confirmação pendente."
);
assert.equal(formatStatusBR("active"), "ATIVO", "O status ativo deixou de ser traduzido.");
assert.equal(formatStatusBR("legado"), "LEGADO", "Um status legado deixou de ser preservado em maiúsculas.");
assert.equal(normalizeCircuitStatus("finished"), "closed", "Um circuito finalizado deixou de ser encerrado.");
assert.equal(normalizeCircuitStatus("archived"), "closed", "Um circuito arquivado deixou de ser encerrado.");
assert.equal(normalizeCircuitStatus("legado"), "active", "Um status antigo deixou de manter o circuito ativo.");
const authLocation = new URL("https://torneio360.com/app?auth=recovery");
assert.equal(
  getAuthRedirectUrl("confirm", authLocation),
  "https://torneio360.com/app?auth=confirm",
  "O endereço de retorno da confirmação de e-mail foi alterado."
);
assert.equal(
  getAuthFlowFromLocation(authLocation),
  "recovery",
  "O fluxo de recuperação deixou de ser reconhecido pela URL."
);
assert.equal(
  getAuthFlowFromLocation(new URL("https://torneio360.com/app#type=signup")),
  "confirm",
  "O fluxo de confirmação deixou de ser reconhecido pelo hash."
);
assert.equal(
  getAuthCallbackError(new URL("https://torneio360.com/app#error_description=otp+expired")),
  "Este link expirou ou já foi usado. Solicite um novo link para continuar.",
  "O aviso de link expirado foi alterado."
);
let clearedAuthUrl = "";
clearAuthCallbackUrl(
  new URL("https://torneio360.com/app?auth=confirm&code=abc&keep=1#error_description=invalid"),
  { replaceState: (_state, _title, value) => { clearedAuthUrl = value; } }
);
assert.equal(clearedAuthUrl, "/app?keep=1", "Os parâmetros temporários da autenticação deixaram de ser removidos.");
assert.equal(
  getBrazilianWhatsAppUrl("(85) 98873-9056"),
  "https://wa.me/5585988739056",
  "O código do Brasil deixou de ser acrescentado ao WhatsApp."
);
assert.equal(
  getBrazilianWhatsAppUrl("5585988739056", "Olá"),
  "https://wa.me/5585988739056?text=Ol%C3%A1",
  "Um número com código do país ou sua mensagem deixou de ser preservado."
);
assert.equal(getBrazilianWhatsAppUrl(""), "", "Um contato vazio passou a gerar link de WhatsApp.");
assert.ok(
  getPlatformWhatsAppUrl().startsWith("https://wa.me/5585988739056?text="),
  "O contato oficial da plataforma foi alterado."
);
assert.ok(
  decodeURIComponent(getPlanRegularizationWhatsAppUrl({ plan: "Premium" }, { email: "teste@exemplo.com" }))
    .includes("Plano atual: Premium. E-mail da conta: teste@exemplo.com."),
  "A mensagem de regularização deixou de identificar o plano e a conta."
);
assert.equal(
  getEffectiveTournamentGenderMode("Super 16 Mista (Dupla Aleatória)", tournamentGenderModes.masculine),
  tournamentGenderModes.mixed,
  "Uma modalidade mista deixou de fixar automaticamente o gênero do torneio."
);
assert.deepEqual(
  getGenderCompatibleTournamentTypes(
    ["Super 8", "Super 16 Mista (Dupla Aleatória)"],
    tournamentGenderModes.masculine
  ),
  ["Super 8"],
  "O filtro de gênero voltou a oferecer modalidade mista para torneio masculino."
);
assert.equal(
  getCompatibleTournamentType(
    "Super 16 Mista (Dupla Aleatória)",
    tournamentGenderModes.feminine,
    ["Super 8", "Super 16 Mista (Dupla Aleatória)"]
  ),
  "Super 8",
  "A troca de gênero deixou de escolher uma modalidade compatível."
);
assert.deepEqual(
  getStoredTournamentGenderFields("Super 8", tournamentGenderModes.other, "Não binário"),
  { participantGenderMode: tournamentGenderModes.other, genderOther: "Não binário", gender: "Não binário" },
  "Os campos de outro gênero deixaram de ser preservados."
);
assert.deepEqual(
  getEditableTournamentGenderFields({ category: "Open", participantGenderMode: "feminino" }, "Super 8"),
  { category: "Open", participantGenderMode: tournamentGenderModes.feminine, genderOther: "" },
  "A edição deixou de recuperar categoria e gênero já salvos."
);
assert.deepEqual(
  getTournamentClassificationLabels({ category: "Iniciante", participantGenderMode: "feminino" }),
  ["Iniciante", "Feminino"],
  "Os rótulos públicos de categoria e gênero foram alterados."
);
assert.equal(SHUFFLE_DURATION_SECONDS, 5, "O sorteio visual deixou de durar cinco segundos.");
assert.equal(SHUFFLE_MOVEMENT_INTERVAL_MS, 620, "O intervalo visual do embaralhamento foi alterado.");
assert.deepEqual(
  getShuffleNames(
    { players: { men: ["Carlos"], women: ["Ana"] } },
    { type: "mixed10" }
  ),
  ["Carlos", "Ana"],
  "O sorteio misto deixou de reunir homens e mulheres."
);
const shuffleSlotsForTest = createShuffleSlots(6, true);
assert.equal(shuffleSlotsForTest.length, 6, "A animação deixou de criar uma posição para cada participante.");
assert.ok(
  shuffleSlotsForTest.every((slot) => Number.isFinite(slot.left) && Number.isFinite(slot.top)),
  "A animação passou a gerar posições inválidas."
);
const shuffleAnimationItemsForTest = createShuffleAnimationItems(["Ana", "Bia"]);
assert.deepEqual(
  shuffleAnimationItemsForTest.map((item) => item.name).sort(),
  ["Ana", "Bia"],
  "A animação perdeu participantes antes do sorteio."
);
const movedShuffleItemsForTest = moveShuffleAnimationItems([
  { id: "a", name: "Ana", left: 10, top: 20, rotation: -1 },
  { id: "b", name: "Bia", left: 30, top: 40, rotation: 1 },
]);
assert.deepEqual(
  movedShuffleItemsForTest.map(({ left, top }) => ({ left, top })),
  [{ left: 30, top: 40 }, { left: 10, top: 20 }],
  "O embaralhamento visual deixou de movimentar os nomes."
);

assert.equal(getModalityDisplayName("Super 08"), "Super 8", "O nome público do Super 8 foi alterado.");
assert.equal(getModalityDisplayName("Modalidade legada"), "Modalidade legada", "Modalidades legadas devem preservar o nome armazenado.");
assert.equal(normalizeModalitySearch("  Torneio Cearense  "), "torneio cearense", "A busca de modalidades perdeu a normalização.");
assert.deepEqual(
  modalityPickerGroups.map((group) => group.title),
  ["Duplas fixas", "Ranking individual", "Mistas", "Copas e modelos"],
  "Os agrupamentos do seletor de modalidades foram alterados."
);
assert.equal(
  modalityPickerDescriptions["Campeonato Cearense"],
  "Grupos, chave principal e disputas paralelas configuráveis.",
  "A descrição do Campeonato Cearense foi alterada."
);
for (const type of ["cup", "cup18", "cup21", "copinha", "cearense", "cearenseIndividual", "playranking", "sunset"]) {
  assert.equal(isCupType({ type }), true, `A modalidade ${type} deixou de ser reconhecida como copa.`);
}
assert.equal(isCupType({ type: "mixed20" }), false, "Uma modalidade mista não pode ser reconhecida como copa.");
assert.equal(isCupType({ type: "futureCup", cupMode: "future-cup" }), true, "Uma nova copa com cupMode deve ser reconhecida sem ampliar uma lista manual.");
for (const type of ["mixed10", "mixed12", "mixed16", "mixed20", "mixed24"]) {
  assert.equal(isMixedType({ type }), true, `A modalidade ${type} deixou de ser reconhecida como mista.`);
}
assert.equal(isMixedType({ type: "super12" }), false, "O Super 12 individual não pode ser reconhecido como misto.");
for (const type of ["fixed12", "fixed16", "fixed20", "fixed24", "fixed28"]) {
  assert.equal(isFixedTeamType({ type }), true, `A modalidade ${type} deixou de ser reconhecida como dupla fixa.`);
}
assert.equal(isFixedTeamType({ type: "mixed20" }), false, "Uma modalidade mista não pode ser reconhecida como dupla fixa.");
assert.equal(isFlexibleSimpleType({ type: "simple8" }), true, "A modalidade Simples deixou de ser reconhecida.");
assert.equal(isReizinhoType({ type: "reizinho" }), true, "O Reizinho deixou de ser reconhecido.");
assert.equal(isIndividualCupType({ type: "cearenseIndividual" }), true, "A copa individual deixou de ser reconhecida.");
assert.equal(isIndividualCupType({ type: "legado", individualCup: true }), true, "A compatibilidade com copas individuais antigas foi perdida.");
const flexibleSimpleConfig = {
  type: "simple8",
  total: 8,
  defaultPlayers: 8,
  allowedPlayerCounts: [4, 6, 8, 10, 12, 14],
};
assert.equal(getSimplePlayerCount(flexibleSimpleConfig, { simplePlayerCount: 10 }), 10, "A quantidade escolhida da modalidade Simples foi alterada.");
assert.equal(getSimplePlayerCount(flexibleSimpleConfig, { players: Array(12).fill("") }), 12, "A quantidade já salva de jogadores não foi preservada.");
assert.equal(getSimplePlayerCount(flexibleSimpleConfig, { simplePlayerCount: 9 }), 8, "Uma quantidade inválida não voltou ao padrão seguro.");
const reizinhoConfig = { type: "reizinho", defaultPlayers: 4, allowedPlayerCounts: [4, 6] };
assert.equal(getReizinhoPlayerCount(reizinhoConfig, { reizinhoPlayerCount: 6 }), 6, "A escolha do Reizinho de seis atletas foi alterada.");
assert.equal(getTournamentCourtCount(flexibleSimpleConfig, { simplePlayerCount: 10 }), 5, "O número de quadras da modalidade Simples foi alterado.");
assert.equal(getTournamentCourtCount(reizinhoConfig, { reizinhoPlayerCount: 6 }), 1, "O Reizinho deve preservar uma quadra lógica.");
assert.equal(getTournamentCourtCount({ type: "super12", courts: 3 }), 3, "O número configurado de quadras foi alterado.");
assert.equal(formatParticipantName("  ANA   MARIA  "), "Ana Maria", "A formatação deve preservar nomes compostos e normalizar espaços.");
assert.equal(formatParticipantName("BÁRBARA DOS SANTOS"), "Bárbara dos Santos", "A formatação deve preservar acentos e conectores do português.");
assert.equal(formatParticipantName("d'ÁVILA e ANA-CLARA"), "D'Ávila e Ana-Clara", "A formatação deve preservar apóstrofos, hífens e conectores.");
assert.equal(formatParticipantName(""), "", "Um nome vazio deve permanecer vazio.");
assert.equal(isTournamentDataObject({}), true, "Um objeto de dados válido deixou de ser reconhecido.");
assert.equal(isTournamentDataObject([]), false, "Uma lista passou a ser tratada como objeto de dados do torneio.");
assert.deepEqual(
  normalizeNameList(["Ana"], 3, "Jogador"),
  ["Ana", "Jogador 2", "Jogador 3"],
  "A recuperação de nomes ausentes deixou de preservar o formato salvo."
);
assert.deepEqual(
  normalizeTeams([{ a: "Ana", b: "Bia" }], 2),
  [
    { a: "Ana", b: "Bia" },
    { a: "Atleta 1 da dupla 2", b: "Atleta 2 da dupla 2" },
  ],
  "A recuperação de duplas incompletas foi alterada."
);
assert.deepEqual(normalizeGameNames("Ana"), ["Ana"], "Um nome isolado deixou de ser convertido em lista.");
assert.deepEqual(normalizeGameIds(["1", -1, "x", 2]), [1, 2], "Os identificadores válidos de um jogo foram alterados.");
assert.deepEqual(
  normalizeGame({ court: 0, team1: "Ana", team2: ["Bia"], ids1: "1", courtLabelOverride: " 7 " }, 2),
  {
    court: 3,
    team1: ["Ana"],
    team2: ["Bia"],
    ids1: [1],
    ids2: [],
    s1: "",
    s2: "",
    courtNumberOverride: "7",
  },
  "A normalização segura de jogos antigos foi alterada."
);
assert.deepEqual(normalizeSchedule([[{ team1: "Ana" }], null]), [[{
  court: 1,
  team1: ["Ana"],
  team2: [],
  ids1: [],
  ids2: [],
  s1: "",
  s2: "",
}]], "Uma rodada inválida deixou de ser descartada.");
assert.deepEqual(normalizeBrackets(null), [], "Uma chave ausente deixou de ser recuperada como lista vazia.");
assert.equal(formatParticipantNameWhileTyping("ANA "), "Ana ", "O espaço final durante a digitação deixou de ser preservado.");
assert.deepEqual(
  normalizeIndividualCupPlayers([{ a: "Ana", b: "ignorado" }], 2),
  [{ a: "Ana", b: "" }, { a: "Jogador 2", b: "" }],
  "Os participantes da copa individual deixaram de ser normalizados corretamente."
);
const initialSuper12Data = createInitialData("Super 12", modalityConfig["Super 12"]);
assert.equal(initialSuper12Data.players.length, 12, "A criação inicial do Super 12 deixou de gerar doze participantes.");
assert.deepEqual(initialSuper12Data.schedule, [], "Um torneio novo deixou de começar sem rodadas.");
const initialCearenseData = createInitialData("Campeonato Cearense", modalityConfig["Campeonato Cearense"]);
assert.equal(initialCearenseData.cupConfig.repechageName, "Consolation", "A 1ª disputa paralela deixou de vir com o nome Consolation.");
assert.equal(initialCearenseData.cupConfig.thirdRepechageName, "Caridade", "A 2ª disputa paralela deixou de vir com o nome Caridade.");
assert.equal(initialCearenseData.cupConfig.secondRepechageEnabled, true, "A 1ª disputa paralela deixou de começar selecionada em Sim.");
assert.equal(initialCearenseData.cupConfig.thirdRepechageEnabled, false, "A 2ª disputa paralela deixou de começar selecionada em Não.");
const normalizedCearenseDefaults = normalizeTournamentData("Campeonato Cearense", {
  cupConfig: {
    secondRepechageEnabled: null,
    thirdRepechageEnabled: null,
  },
});
assert.equal(normalizedCearenseDefaults.cupConfig.repechageName, "Consolation", "Um Cearense antigo sem nome deixou de receber o preenchimento padrão.");
assert.equal(normalizedCearenseDefaults.cupConfig.thirdRepechageName, "Caridade", "A 2ª disputa paralela antiga sem nome deixou de receber Caridade.");
assert.equal(normalizedCearenseDefaults.cupConfig.secondRepechageEnabled, true, "Uma escolha antiga vazia deixou de assumir Sim na 1ª disputa.");
assert.equal(normalizedCearenseDefaults.cupConfig.thirdRepechageEnabled, false, "Uma escolha antiga vazia deixou de assumir Não na 2ª disputa.");
const normalizedCearenseChoices = normalizeTournamentData("Campeonato Cearense", {
  cupConfig: {
    repechageName: "Nome personalizado",
    thirdRepechageName: "Outro nome personalizado",
    secondRepechageEnabled: false,
    thirdRepechageEnabled: true,
  },
});
assert.equal(normalizedCearenseChoices.cupConfig.repechageName, "Nome personalizado", "O nome personalizado da disputa paralela deixou de ser preservado.");
assert.equal(normalizedCearenseChoices.cupConfig.thirdRepechageName, "Outro nome personalizado", "O nome personalizado da 2ª disputa deixou de ser preservado.");
assert.equal(normalizedCearenseChoices.cupConfig.secondRepechageEnabled, false, "A escolha Não já salva na 1ª disputa foi alterada.");
assert.equal(normalizedCearenseChoices.cupConfig.thirdRepechageEnabled, true, "A escolha Sim já salva na 2ª disputa foi alterada.");
const migratedCearenseNames = normalizeTournamentData("Campeonato Cearense", {
  cupConfig: {
    repechageName: "2ª Disputa Paralela",
    thirdRepechageName: "3ª Disputa Paralela",
  },
});
assert.equal(migratedCearenseNames.cupConfig.repechageName, "Consolation", "O antigo nome padrão da 1ª disputa não foi corrigido.");
assert.equal(migratedCearenseNames.cupConfig.thirdRepechageName, "Caridade", "O antigo nome padrão da 2ª disputa não foi corrigido.");
const initialPlayRankingData = createInitialData("Modelo Play Ranking", modalityConfig["Modelo Play Ranking"]);
assert.equal(initialPlayRankingData.cupConfig.repechageName, "Consolation", "O Modelo Torneio 360 deixou de iniciar sua disputa paralela como Consolation.");
assert.equal(isCearenseSecondParallelEnabled(initialPlayRankingData), true, "A 1ª disputa paralela do Modelo Torneio 360 deixou de começar ativa.");
const initialSunsetData = createInitialData("Copa Sunset", modalityConfig["Copa Sunset"]);
assert.equal(initialSunsetData.cupConfig.repechageName, "Consolation", "A 1ª disputa da Sunset deixou de vir como Consolation.");
assert.equal(initialSunsetData.cupConfig.secondParallelName, "Caridade", "A 2ª disputa da Sunset deixou de vir como Caridade.");
assert.equal(initialSunsetData.cupConfig.thirdRepechageName, "Também Ganhei", "A 3ª disputa da Sunset deixou de vir como Também Ganhei.");
assert.equal(initialSunsetData.cupConfig.sunsetBracketName, "Etapa Sunset", "A etapa entre campeãs deixou de vir como Etapa Sunset.");
assert.equal(isCearenseSecondParallelEnabled(initialSunsetData), true, "A 1ª disputa da Sunset deixou de começar ativa.");
assert.equal(isCearenseThirdParallelEnabled(initialSunsetData), true, "A 3ª disputa da Sunset deixou de começar ativa.");
const normalizedSuper12Data = normalizeTournamentData("Super 12", {
  players: ["Ana"],
  schedule: [[{ court: 1, team1: "Ana", team2: "Bia" }]],
  winningScore: 9,
  courtLabels: ["4", "5", "6"],
});
assert.equal(normalizedSuper12Data.players.length, 12, "Dados antigos do Super 12 deixaram de recuperar participantes ausentes.");
assert.equal(normalizedSuper12Data.players[0], "Ana", "Um participante salvo deixou de ser preservado na normalização.");
assert.equal(normalizedSuper12Data.winningScore, 4, "Um placar-alvo inválido deixou de voltar ao padrão seguro.");
assert.deepEqual(normalizedSuper12Data.courtNumbers.slice(0, 3), ["4", "5", "6"], "A numeração antiga das quadras deixou de ser recuperada.");
assert.equal(Object.hasOwn(normalizedSuper12Data, "courtLabels"), false, "O campo antigo de quadras deixou de ser migrado.");
assert.equal(
  needsTournamentDataRepair("Super 12", normalizedSuper12Data),
  false,
  "Dados normalizados do Super 12 passaram a pedir reparo desnecessário."
);
assert.equal(
  needsTournamentDataRepair("Super 12", { players: [], schedule: [] }),
  true,
  "Dados incompletos deixaram de ser identificados para reparo."
);
const completedTournament = {
  id: "completed",
  type: "Super 8",
  data: {
    schedule: [[{
      team1: ["Ana", "Bia"],
      team2: ["Carla", "Dora"],
      ids1: [0, 1],
      ids2: [2, 3],
      s1: 4,
      s2: 2,
    }]],
  },
};
assert.deepEqual(
  getTournamentCompletionState(completedTournament),
  { hasRequiredGames: true, completed: true, requiredGames: 1, completedGames: 1 },
  "Um torneio com todos os placares preenchidos deixou de ser reconhecido como concluído."
);
assert.equal(
  getTournamentLifecycleStatus({ type: "Super 8", data: { eventStartDate: "2099-01-01" } }, new Date("2026-08-18T12:00:00-03:00")),
  "upcoming",
  "Um torneio futuro deixou de aparecer como próximo."
);
assert.equal(
  getTournamentLifecycleStatus({ type: "Super 8", data: { eventEndDate: "2020-01-01" } }, new Date("2026-08-18T12:00:00-03:00")),
  "finished",
  "Um torneio com data encerrada deixou de aparecer como finalizado."
);
assert.equal(getAutomaticEventStatus("1900-01-01"), "finished", "Um evento encerrado deixou de respeitar a data final.");
assert.equal(getCircuitLifecycleStatus({ start_date: "2099-01-01", end_date: "2099-01-02" }), "upcoming", "Um circuito futuro deixou de aparecer como próximo.");
assert.equal(getTournamentEventSortKey({ data: { eventDate: "2026-08-20", eventStartTime: "09:30" } }), "2026-08-20T09:30", "A chave cronológica do torneio foi alterada.");
const manuallyOrderedTournaments = [
  { id: "second", data: { displayOrderMode: "manual", displayOrder: 1 } },
  { id: "first", data: { displayOrderMode: "manual", displayOrder: 0 } },
];
assert.deepEqual(sortTournamentsForDisplay(manuallyOrderedTournaments).map((item) => item.id), ["first", "second"], "A ordem manual salva deixou de ser preservada.");
assert.deepEqual(
  insertTournamentsByEventSchedule(
    [{ id: "later", type: "Super 8", data: { eventDate: "2099-01-03" } }],
    [{ id: "earlier", type: "Super 8", data: { eventDate: "2099-01-02" } }]
  ).map((item) => item.id),
  ["earlier", "later"],
  "A inserção cronológica de torneios foi alterada."
);
assert.equal(getTournamentRegistrationDeadline({ data: { registrationDeadline: "2099-01-01" } }), "2099-01-01", "O prazo de inscrição salvo deixou de ser lido.");
assert.equal(isRegistrationDeadlineOpen("2099-01-01"), true, "Um prazo futuro deixou de aceitar inscrições.");
const publicTournamentDirectoryItem = getPublicTournamentDirectoryItem({
  ...completedTournament,
  public_id: "public-completed",
  name: "Etapa concluída",
  data: {
    ...completedTournament.data,
    eventDate: "2026-08-18",
    eventStartTime: "09:00",
    category: "Open",
  },
});
assert.equal(publicTournamentDirectoryItem.public_id, "public-completed", "O diretório público perdeu o link do torneio.");
assert.equal(publicTournamentDirectoryItem.data.lifecycleStatus, "finished", "O diretório público deixou de identificar um torneio concluído.");
assert.equal(publicTournamentDirectoryItem.directoryEntry, true, "A versão compacta do torneio deixou de ser marcada como entrada de diretório.");
const publicCircuitDirectoryItem = getPublicCircuitDirectoryItem(
  {
    id: "circuit-1",
    name: "Circuito",
    status: "em andamento",
    tournament_ids: ["tournament-1"],
  },
  [{ key: "geral", title: "Geral", rows: [{ id: "ana", name: "Ana", pts: "12", stageScores: ["8", "4"] }] }],
);
assert.equal(publicCircuitDirectoryItem.status, "active", "O diretório público deixou de normalizar o status do circuito.");
assert.deepEqual(publicCircuitDirectoryItem.ranking_groups[0].rows[0].stageScores, [8, 4], "O diretório público deixou de normalizar a pontuação das etapas.");
assert.deepEqual(
  sortCircuitsForDisplay([
    { id: "finished", status: "finished", end_date: "2026-08-10" },
    { id: "next", status: "active", end_date: "2026-08-20" },
  ]).map((item) => item.id),
  ["next", "finished"],
  "Circuitos ativos deixaram de aparecer antes dos encerrados.",
);
const normalizedPublicCircuit = normalizePublicCircuitForDisplay({
  ranking_criteria: defaultRankingCriteria,
  ranking_groups: [{ title: "Geral", rows: [{ name: "Bia", w: 1 }, { name: "Ana", w: 2 }] }],
});
assert.deepEqual(
  normalizedPublicCircuit.ranking_groups[0].rows.map((row) => row.name),
  ["Ana", "Bia"],
  "O ranking público do circuito deixou de respeitar os critérios escolhidos.",
);
const normalizedPublicCircuitByTotalGames = normalizePublicCircuitForDisplay({
  ranking_settings: {
    mode: "performance",
    tieBreakOrder: ["totalGames", "balance", "wins"],
  },
  ranking_groups: [{
    title: "Geral",
    rows: [
      { name: "Ana", w: 3, pts: 10, bal: 1 },
      { name: "Bia", w: 2, pts: 14, bal: 4 },
    ],
  }],
});
assert.deepEqual(
  normalizedPublicCircuitByTotalGames.ranking_groups[0].rows.map((row) => row.name),
  ["Bia", "Ana"],
  "O ranking público do circuito voltou a usar uma ordem fixa diferente da escolhida pelo organizador.",
);
assert.equal(
  getTournamentListGenderFilter("Super 8", { participantGenderMode: tournamentGenderModes.masculine }),
  tournamentListGenderFilters.masculine,
  "O filtro da lista deixou de reconhecer torneios masculinos."
);
assert.equal(
  getTournamentListGenderFilter("Super 8", { participantGenderMode: tournamentGenderModes.open }),
  tournamentListGenderFilters.mixed,
  "O filtro da lista deixou de reunir Livre com Misto."
);
assert.equal(
  getTournamentListGenderFilter("Super 12 Mista (Dupla Aleatória)", {}),
  tournamentListGenderFilters.mixed,
  "Uma modalidade mista sem metadado legado deixou de aparecer em Misto/Livre."
);
assert.equal(
  matchesTournamentListGenderFilter("Super 8", { participantGenderMode: tournamentGenderModes.feminine }, tournamentListGenderFilters.masculine),
  false,
  "O filtro masculino passou a exibir torneios femininos."
);
const legacyGeneralCircuitGroup = [{ key: "geral", title: "Ranking geral acumulado", rows: [{ name: "Ana" }] }];
assert.deepEqual(
  selectVisiblePublicCircuitRankingGroups({
    storedGroups: legacyGeneralCircuitGroup,
    rebuiltGroups: [],
    rankingDivision: "gender",
  }),
  legacyGeneralCircuitGroup,
  "Um histórico geral válido não pode desaparecer quando a separação por gênero ainda não puder ser reconstruída.",
);
assert.deepEqual(
  selectVisiblePublicCircuitRankingGroups({
    storedGroups: legacyGeneralCircuitGroup,
    rebuiltGroups: [
      { key: "masculino", rows: [{ name: "Bruno" }] },
      { key: "feminino", rows: [{ name: "Carla" }] },
    ],
    rankingDivision: "gender",
  }).map((group) => group.key),
  ["masculino", "feminino"],
  "A separação por gênero deve substituir o fallback geral assim que estiver disponível.",
);
for (const [type, config] of Object.entries(modalityConfig)) {
  const publicSections = getRegisteredAthletesForPublic(createInitialData(type, config), config);
  assert.ok(
    Array.isArray(publicSections),
    `A modalidade ${type} deixou de produzir uma lista pública válida de participantes.`,
  );
}
assert.deepEqual(
  getRegisteredAthletesForPublic(
    { players: { teams: [{ a: "Ana", b: "Bia" }] } },
    { type: "cearense" },
  ),
  [{ title: "Duplas cadastradas", names: ["1. Ana + Bia"] }],
  "A lista pública de duplas cadastradas foi alterada.",
);
for (const type of ["fixed20", "fixed24", "fixed28"]) {
  assert.deepEqual(
    getRegisteredAthletesForPublic(
      { players: { teams: [{ a: "Ana", b: "Bia" }] } },
      { type },
    ),
    [{ title: "Duplas cadastradas", names: ["1. Ana + Bia"] }],
    `A lista pública de ${type} deixou de reconhecer o armazenamento por duplas.`,
  );
}
assert.deepEqual(
  getRegisteredAthletesForPublic(
    { players: { teams: [{ a: "Ana", b: "Bia" }] } },
    { type: "futureTeamFormat" },
  ),
  [{ title: "Duplas cadastradas", names: ["1. Ana + Bia"] }],
  "A visualização pública deve reconhecer duplas pela forma dos dados mesmo antes de conhecer uma nova modalidade.",
);
assert.deepEqual(
  getRegisteredAthletesForPublic(
    { players: { men: ["André"], women: ["Bia"] } },
    { type: "futureSocialFormat" },
  ),
  [
    { title: "Masculino", names: ["André"] },
    { title: "Feminino", names: ["Bia"] },
  ],
  "A visualização pública deve reconhecer grupos mistos pela forma dos dados mesmo antes de conhecer uma nova modalidade.",
);
assert.deepEqual(
  getRegisteredAthletesForPublic({ players: {} }, { type: "unknown" }),
  [{ title: "Atletas cadastrados", names: [] }],
  "Um formato desconhecido não pode derrubar a visualização pública por causa da forma de players.",
);
assert.equal(ARENA_DIRECTORY_CACHE_KEY, "t360.public-arena-directory.v3", "A chave do cache público de arenas foi alterada.");
assert.equal(getPublicArenaBundleCacheKey({ arenaId: "arena-1" }), "t360.public-arena-bundle.v2:arena-1", "A chave do perfil público em memória foi alterada.");
writePublicArenaBundleCache({ arenaId: "arena-cache" }, { profile: { id: "arena-cache" } }, 1_000);
assert.deepEqual(readPublicArenaBundleCache({ arenaId: "arena-cache" }, 1_001), { profile: { id: "arena-cache" } }, "Um perfil público válido deixou de ser recuperado do cache.");
assert.equal(readPublicArenaBundleCache({ arenaId: "arena-cache" }, 1_000 + PUBLIC_ARENA_BUNDLE_CACHE_MAX_AGE_MS + 1), null, "Um perfil público vencido continuou no cache.");
writePublicTournamentDetailCache("tournament-cache", { id: "tournament-cache" }, 2_000);
assert.deepEqual(readPublicTournamentDetailCache("tournament-cache", 2_001), { id: "tournament-cache" }, "O detalhe público do torneio deixou de ser recuperado do cache.");
writePublicCircuitDetailCache("circuit-cache", { id: "circuit-cache" }, 3_000);
assert.deepEqual(readPublicCircuitDetailCache("circuit-cache", 3_001), { id: "circuit-cache" }, "O detalhe público do circuito deixou de ser recuperado do cache.");
assert.deepEqual(readPublicArenaPhotoCache("arena-photo"), { found: false, data: "" }, "Uma foto ainda não consultada foi confundida com foto vazia em cache.");
writePublicArenaPhotoCache("arena-photo", "");
assert.deepEqual(readPublicArenaPhotoCache("arena-photo"), { found: true, data: "" }, "O cache deixou de lembrar que uma arena não possui foto.");

const legacyArenaRows = Array.from({ length: 25 }, (_, index) => ({
  id: `arena-${String(index + 1).padStart(2, "0")}`,
  arena_name: `Arena ${String(index + 1).padStart(2, "0")}`,
}));
let legacyArenaDirectoryCalls = 0;
const legacyPublicArenaApi = createPublicArenaApi({
  supabase: {
    async rpc(functionName) {
      if (functionName === "list_public_arenas_page") {
        return { data: null, error: { message: "function public.list_public_arenas_page does not exist" } };
      }
      if (functionName === "list_public_arenas") {
        legacyArenaDirectoryCalls += 1;
        return { data: legacyArenaRows, error: null };
      }
      throw new Error(`RPC inesperado no teste: ${functionName}`);
    },
  },
});
const legacyArenaPageOne = await legacyPublicArenaApi.fetchPublicArenaDirectory({ limit: 18 });
const legacyArenaPageTwo = await legacyPublicArenaApi.fetchPublicArenaDirectory({
  limit: 18,
  cursor: legacyArenaPageOne.nextCursor,
});
assert.equal(legacyArenaPageOne.data.length, 18, "O diretório legado deixou de respeitar o tamanho da primeira página.");
assert.equal(legacyArenaPageOne.hasMore, true, "O diretório legado não indicou a segunda página disponível.");
assert.equal(legacyArenaPageTwo.data.length, 7, "A continuação do diretório legado perdeu arenas.");
assert.equal(legacyArenaPageTwo.hasMore, false, "O diretório legado indicou páginas inexistentes.");
assert.equal(legacyArenaDirectoryCalls, 1, "A paginação compatível repetiu a consulta completa ao Supabase.");

assert.equal(
  tournamentSummarySelect.includes("data->>coverImageUrl") || tournamentSummarySelect.includes("data->>eventCoverImageUrl"),
  false,
  "A listagem leve voltou a transportar a capa completa em Base64.",
);
assert.equal(
  tournamentSummarySelect.includes("data->>coverImageThumbnailUrl")
    && tournamentSummarySelect.includes("data->>eventCoverImageThumbnailUrl"),
  true,
  "A listagem leve deixou de solicitar as miniaturas das capas.",
);
assert.deepEqual(
  normalizeTournamentSummaryRow({
    id: "summary-1",
    summary_cover_image_thumbnail_url: "data:image/jpeg;base64,mini",
    summary_event_cover_image_thumbnail_url: "data:image/jpeg;base64,event-mini",
  }).data,
  {
    coverImageThumbnailUrl: "data:image/jpeg;base64,mini",
    eventCoverImageThumbnailUrl: "data:image/jpeg;base64,event-mini",
  },
  "A normalização do resumo perdeu as miniaturas das capas.",
);
assert.equal(
  mainSource.includes("openTournamentIds.slice(-12)"),
  false,
  "O painel voltou a pré-carregar em massa os JSONs completos das abas antigas.",
);

const uploadedMediaObjects = [];
const fakeMediaStorage = {
  storage: {
    from(bucket) {
      assert.equal(bucket, EVENT_MEDIA_BUCKET, "O upload usou um bucket inesperado.");
      return {
        async upload(path, file, options) {
          uploadedMediaObjects.push({ path, file, options });
          return { data: { path }, error: null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `https://media.example/${path}` } };
        },
        async remove() {
          return { data: [], error: null };
        },
      };
    },
  },
};
const uploadedCoverPair = await uploadPreparedImagePair({
  supabase: fakeMediaStorage,
  userId: "owner-1",
  imageUrl: "data:image/jpeg;base64,Y2FwYQ==",
  thumbnailUrl: "data:image/jpeg;base64,bWluaQ==",
});
const uploadedProfilePhoto = await uploadProfilePhoto({
  supabase: fakeMediaStorage,
  userId: "owner-1",
  photoUrl: "data:image/png;base64,cGVyZmls",
});
assert.equal(uploadedMediaObjects.length, 3, "O armazenamento deixou de receber a capa, a miniatura ou a foto do perfil.");
assert.equal(uploadedMediaObjects.every((item) => item.path.startsWith("owner-1/")), true, "Uma imagem foi enviada fora da pasta do proprietário.");
assert.equal(uploadedMediaObjects.every((item) => item.options.cacheControl === "31536000"), true, "As imagens deixaram de usar cache imutável longo.");
assert.equal(uploadedCoverPair.imageUrl.startsWith("https://media.example/owner-1/"), true, "A capa salva não retornou URL pública.");
assert.equal(uploadedProfilePhoto.startsWith("https://media.example/owner-1/"), true, "A foto do perfil não retornou URL pública.");
assert.equal(
  eventMediaStorageMigrationSource.includes("insert into storage.buckets")
    && eventMediaStorageMigrationSource.includes("event_media_owner_insert")
    && eventMediaStorageMigrationSource.includes("auth.uid()::text"),
  true,
  "O bucket de mídia deixou de proteger os uploads pela pasta do proprietário.",
);
assert.equal(
  viteConfigSource.includes('name: "vendor-react"')
    && viteConfigSource.includes('name: "vendor-supabase"')
    && viteConfigSource.includes('name: "vendor-icons"')
    && viteConfigSource.includes("codeSplitting"),
  true,
  "O build deixou de separar dependências estáveis do código principal.",
);
assert.equal(
  publicArenaSnapshotCacheMigrationSource.includes("create table if not exists public.public_arena_snapshots")
    && publicArenaSnapshotCacheMigrationSource.includes("refresh_public_arena_snapshot")
    && publicArenaSnapshotCacheMigrationSource.includes("t360_public_tournament_directory_fingerprint")
    && publicArenaSnapshotCacheMigrationSource.includes("old.ranking_settings is not distinct from new.ranking_settings"),
  true,
  "O perfil público deixou de usar snapshot ou voltou a reconstruí-lo após qualquer placar.",
);
assert.equal(
  existsSync(new URL("scripts/public-load-check.mjs", root)),
  true,
  "O teste concorrente do perfil público foi removido.",
);
assert.equal(
  tournamentChangeFeedMigrationSource.includes("create table if not exists public.tournament_change_feed")
    && tournamentChangeFeedMigrationSource.includes("create trigger tournaments_signal_change")
    && tournamentChangeFeedMigrationSource.includes("alter publication supabase_realtime add table public.tournament_change_feed")
    && mainSource.includes('table: "tournament_change_feed"')
    && mainSource.includes("applyRemoteTournamentSignal")
    && mainSource.includes("tournamentSignalLoadStateRef")
    && !mainSource.includes('table: "tournaments", filter: `user_id=eq.${user.id}`'),
  true,
  "O Realtime voltou a transmitir o JSON completo de cada torneio em toda alteração.",
);
assert.equal(
  circuitChangeFeedMigrationSource.includes("create table if not exists public.circuit_change_feed")
    && circuitChangeFeedMigrationSource.includes("create trigger circuits_signal_change")
    && circuitChangeFeedMigrationSource.includes("alter publication supabase_realtime add table public.circuit_change_feed")
    && mainSource.includes('table: "circuit_change_feed"')
    && mainSource.includes("createLatestEntitySignalProcessor")
    && latestEntitySignalProcessorSource.includes("runningById")
    && !mainSource.includes('table: "circuits", filter: `user_id=eq.${user.id}`'),
  true,
  "O Realtime voltou a transmitir os dados completos do circuito em toda alteração.",
);
const appStatePayloadForTest = {
  last_url: "/?aba=circuitos",
  last_panel: "circuitos",
  last_circuit_id: "circuito-1",
  scroll_y: 240,
  updated_at: "2026-08-25T12:00:00.000Z",
};
const appStateSignatureForTest = getUserAppStateSyncSignature(appStatePayloadForTest);
assert.equal(
  appStateSignatureForTest,
  getUserAppStateSyncSignature({ ...appStatePayloadForTest, updated_at: "2026-08-25T12:01:00.000Z" }),
  "A data técnica voltou a provocar gravações repetidas do mesmo estado de navegação.",
);
assert.equal(
  getUserAppStateCloudDelay({ payload: appStatePayloadForTest, lastSignature: appStateSignatureForTest }),
  null,
  "Um estado de navegação idêntico deixou de ser descartado antes da gravação.",
);
assert.equal(
  getUserAppStateCloudDelay({ payload: appStatePayloadForTest, lastSavedAt: 5_000, now: 10_000 }),
  25_000,
  "O limite de gravações do estado de navegação deixou de respeitar 30 segundos.",
);
assert.equal(
  getUserAppStateCloudDelay({ payload: appStatePayloadForTest, force: true }),
  0,
  "A saída da página deixou de poder solicitar a última sincronização imediatamente.",
);
let appStateQueueNow = 10_000;
let appStateScheduledDelay = null;
let appStateScheduledFlush = null;
const appStateCloudWrites = [];
const appStateQueue = createUserAppStateCloudQueue({
  now: () => appStateQueueNow,
  savePayload: async (payload) => { appStateCloudWrites.push(payload); },
  schedule: (callback, delay) => {
    appStateScheduledFlush = callback;
    appStateScheduledDelay = delay;
    return { callback, delay };
  },
  cancel: () => {},
});
appStateQueue.seed({ ...appStatePayloadForTest, last_panel: "inicio" }, 5_000);
appStateQueue.queue(appStatePayloadForTest);
assert.equal(
  appStateScheduledDelay,
  25_000,
  "A fila modular do painel deixou de respeitar o intervalo mínimo entre gravações.",
);
appStateQueueNow = 35_000;
await appStateScheduledFlush();
assert.deepEqual(
  appStateCloudWrites,
  [appStatePayloadForTest],
  "A fila modular do painel não enviou o estado pendente mais recente.",
);
appStateScheduledFlush = null;
appStateQueue.queue({ ...appStatePayloadForTest, updated_at: "2026-08-25T12:05:00.000Z" });
assert.equal(
  appStateScheduledFlush,
  null,
  "A fila modular do painel voltou a agendar uma gravação para um estado idêntico.",
);
appStateQueue.dispose();

const normalizedCircuitDirectoryRow = normalizeCircuitRow({
  id: "circuito-1",
  name: "Circuito teste",
  status: "finished",
  tournament_ids: ["torneio-1", "torneio-1", "", "torneio-2"],
  ranking_settings: { coverImageUrl: "capa.jpg" },
  revision: 4,
});
assert.deepEqual(
  normalizedCircuitDirectoryRow.tournamentIds,
  ["torneio-1", "torneio-2"],
  "A listagem modular de circuitos deixou de remover identificadores vazios ou repetidos.",
);
assert.equal(normalizedCircuitDirectoryRow.status, "closed");
assert.equal(normalizedCircuitDirectoryRow.coverImageUrl, "capa.jpg");
assert.equal(normalizedCircuitDirectoryRow.revision, 4);
assert.deepEqual(
  normalizeCircuitTournamentIds([1, "1", " 2 ", null]),
  ["1", "2"],
  "A normalização reutilizável dos torneios do circuito ficou incompatível.",
);
assert.equal(circuitDirectorySelect.includes("ranking_settings"), true);
assert.equal(circuitHistorySelect.includes("circuit_points"), true);

let releaseFirstCircuitSignal;
const loadedCircuitSignalVersions = [];
const appliedCircuitSignalVersions = [];
const deletedCircuitSignalIds = [];
const circuitSignalProcessor = createLatestEntitySignalProcessor({
  getEntityId: (signal) => signal?.circuit_id,
  isDeleted: (signal) => Boolean(signal?.deleted),
  loadEntity: async (circuitId, signal) => {
    loadedCircuitSignalVersions.push(signal.version);
    if (signal.version === 1) {
      return new Promise((resolve) => {
        releaseFirstCircuitSignal = () => resolve({ id: circuitId, version: signal.version });
      });
    }
    return { id: circuitId, version: signal.version };
  },
  onUpdate: (row) => { appliedCircuitSignalVersions.push(row.version); },
  onDelete: (circuitId) => { deletedCircuitSignalIds.push(circuitId); },
});
const firstCircuitSignalRun = circuitSignalProcessor.handle({
  new: { circuit_id: "circuito-1", version: 1 },
});
circuitSignalProcessor.handle({ new: { circuit_id: "circuito-1", version: 2 } });
releaseFirstCircuitSignal();
await firstCircuitSignalRun;
assert.deepEqual(
  loadedCircuitSignalVersions,
  [1, 2],
  "Os sinais sucessivos do mesmo circuito deixaram de preservar a atualização mais recente.",
);
assert.deepEqual(appliedCircuitSignalVersions, [1, 2]);
await circuitSignalProcessor.handle({ new: { circuit_id: "circuito-1", deleted: true } });
assert.deepEqual(deletedCircuitSignalIds, ["circuito-1"]);
circuitSignalProcessor.dispose();
assert.equal(
  publicArenaEventPaginationMigrationSource.includes("create or replace function public.get_public_arena_overview")
    && publicArenaEventPaginationMigrationSource.includes("create or replace function public.list_public_arena_events_page")
    && publicArenaEventPaginationMigrationSource.includes("drop trigger if exists tournaments_refresh_public_arena_snapshot")
    && publicArenaEventPaginationMigrationSource.includes("get_public_circuit_with_tournaments")
    && publicArenaInitialViewMigrationSource.includes("create or replace function public.get_public_arena_initial_view")
    && publicArenaInitialViewMigrationSource.includes("public.get_public_arena_overview(owner_id, null)")
    && publicArenaInitialViewMigrationSource.includes("public.list_public_arena_events_page(")
    && publicArenaInitialViewOptimizedMigrationSource.includes("with candidates as materialized")
    && publicArenaInitialViewOptimizedMigrationSource.includes("from counts cross join page_payload")
    && publicCircuitRankingPerformanceMigrationSource.includes("valid_tournaments as materialized")
    && publicCircuitRankingPerformanceMigrationSource.includes("circuit_ranking_history_public_read_idx")
    && publicCircuitSnapshotCacheMigrationSource.includes("create table if not exists public.public_circuit_snapshots")
    && publicCircuitSnapshotCacheMigrationSource.includes("pg_advisory_xact_lock")
    && publicCircuitSnapshotCacheMigrationSource.includes("referencing new table as inserted_rows")
    && publicCircuitSnapshotCacheMigrationSource.includes("refresh_public_circuit_snapshot")
    && publicCircuitCacheWriteModeMigrationSource.includes("get_public_circuit_with_tournaments(uuid) volatile")
    && publicArenaInitialViewCacheMigrationSource.includes("create table if not exists public.public_arena_initial_snapshots")
    && publicArenaInitialViewCacheMigrationSource.includes("date_trunc('minute', statement_timestamp())")
    && publicArenaInitialViewCacheMigrationSource.includes("pg_advisory_xact_lock")
    && publicArenaInitialViewCacheMigrationSource.includes("tournaments_invalidate_public_arena_initial_snapshot")
    && publicArenaInitialViewCacheFixMigrationSource.includes("requested_limit integer")
    && !publicArenaInitialViewCacheFixMigrationSource.includes("snapshot.page_limit = page_limit")
    && publicCircuitRankingPaginationMigrationSource.includes("list_public_circuit_ranking_page")
    && publicCircuitRankingPaginationMigrationSource.includes("'rankPosition', page_rows.global_position")
    && publicCircuitRankingPaginationMigrationSource.includes("'ranking_pagination', jsonb_build_object")
    && publicCircuitRankingPageCacheMigrationSource.includes("create table if not exists public.public_circuit_ranking_rows")
    && publicCircuitRankingPageCacheMigrationSource.includes("ensure_public_circuit_snapshot")
    && publicCircuitRankingPageCacheMigrationSource.includes("refresh_public_circuit_ranking_rows")
    && publicCircuitRankingPageCacheMigrationSource.includes("from public.public_circuit_ranking_rows ranking")
    && organizerScaleCheckSource.trimStart().startsWith("begin;")
    && organizerScaleCheckSource.includes("cross join generate_series(1, 1000)")
    && organizerScaleCheckSource.includes("cross join generate_series(1, 250)")
    && organizerScaleCheckSource.trimEnd().endsWith("rollback;")
    && browserPerformanceCheckSource.includes("--headless=new")
    && browserPerformanceCheckSource.includes(".publicPage.publicArenaPage")
    && browserPerformanceCheckSource.includes("profileVisibleMs")
    && publicCircuitPaginationCheckSource.includes("list_public_circuit_ranking_page")
    && publicCircuitPaginationCheckSource.includes("posição global")
    && publicArenaApiSource.includes("fetchPublicArenaEventsPage")
    && publicArenaApiSource.includes("fetchPublicArenaInitialView")
    && publicArenaApiSource.includes('rpc("get_public_arena_initial_view"')
    && publicArenaApiSource.includes('rpc("list_public_arena_events_page"')
    && publicArenaApiSource.includes('rpc("list_public_circuit_ranking_page"')
    && publicArenaApiSource.includes("fetchPublicCircuitRankingAll")
    && publicArenaPageControllerSource.includes("PUBLIC_ARENA_EVENT_PAGE_SIZE")
    && publicArenaPageControllerSource.includes("fetchPublicArenaInitialView({ arenaId, publicId })")
    && publicArenaPageControllerSource.includes("loadPublicEventPage")
    && publicArenaPresentationSource.includes("serverPagination")
    && publicArenaPresentationSource.includes("serverPagination.onLoadMore"),
  true,
  "O perfil público deixou de paginar eventos no servidor ou perdeu as etapas dos circuitos.",
);
assert.equal(
  publicArenaLegacyCompatibilityMigrationSource.includes("public.build_public_arena_bundle_uncached")
    && publicArenaLegacyCompatibilityMigrationSource.includes("grant execute on function public.get_public_arena_bundle"),
  true,
  "Uma versão anterior do front-end pode perder os eventos durante a transição para a paginação.",
);

assert.equal(generatePublicId(() => 35, () => 0.5), "tfbt_z_i", "O formato dos links públicos foi alterado.");
assert.equal(
  generateCollaborationChangeId({ randomUUID: () => "change-id" }),
  "change-id",
  "A identificação das alterações colaborativas deixou de usar UUID quando disponível.",
);
assert.equal(
  getPublicUrl("public-1", { origin: "https://torneio360.com", pathname: "/painel" }),
  "https://torneio360.com/painel?public=public-1",
  "O link público direto do torneio foi alterado.",
);
assert.equal(
  getArenaPublicUrl("arena-1", { origin: "https://torneio360.com" }),
  "https://torneio360.com/?arena=arena-1",
  "O link público do perfil da arena foi alterado.",
);
assert.equal(
  getArenaPublicShareMessage("arena-1", { origin: "https://torneio360.com" }),
  "Acompanhe os torneios e circuitos desta arena no Torneio360:\nhttps://torneio360.com/?arena=arena-1",
  "A mensagem de compartilhamento do perfil da arena foi alterada.",
);
assert.deepEqual(
  DEFAULT_TOURNAMENT_NAVIGATION,
  { tournamentTab: "participantes", matchesTab: "grupos", scrollY: 0 },
  "A navegação padrão de um torneio aberto foi alterada."
);
assert.equal(getOpenTournamentsStorageKey("arena-1"), "torneio360:open-tournaments:v1:arena-1", "A chave das abas abertas mudou e poderia ocultar dados já salvos.");
assert.equal(getTournamentDraftStorageKey("arena-1", "torneio-2"), "torneio360:tournament-draft:arena-1:torneio-2", "A chave do rascunho mudou e poderia perder um backup local.");
assert.equal(getTournamentVenueKey({ data: { location: "Arena São João" } }), "arena-sao-joao", "A identidade do local deixou de ignorar somente acentos e espaços.");
assert.deepEqual(
  normalizeCourtCenterEntry({
    label: "Centro",
    numbers: ["4", "2", "2", ""],
    unavailableNumbers: ["4", "9"],
    tournamentPreferences: { torneio: ["2", "9", "2"] },
    configured: true,
  }),
  {
    label: "Centro",
    numbers: ["2", "4"],
    unavailableNumbers: ["4"],
    tournamentPreferences: { torneio: ["2"] },
    configured: true,
  },
  "A Central de Quadras deixou de preservar somente números válidos e disponíveis."
);
assert.equal(isRetryableConnectionError({ message: "Failed to fetch" }), true, "Uma falha temporária de rede deixou de preservar o backup local.");
assert.deepEqual(normalizeAttendanceList([true, 1, false], 4), [true, false, false, false], "A presença simples deixou de aceitar somente confirmações explícitas.");
const mixedAttendanceConfig = { type: "mixed10", men: 2, women: 2 };
const mixedAttendancePlayers = { men: ["Ana", "Bia"], women: ["Carla", "Dora"] };
assert.deepEqual(
  normalizeParticipantAttendance(mixedAttendanceConfig, mixedAttendancePlayers, { men: [true], women: [false, true] }),
  { men: [true, false], women: [false, true] },
  "A presença das modalidades mistas perdeu sua estrutura salva."
);
const cupAttendanceConfig = { type: "cearense" };
const cupAttendancePlayers = { teams: [{ a: "Ana", b: "Bia" }, { a: "Carla", b: "Dora" }] };
const cupAttendance = normalizeParticipantAttendance(cupAttendanceConfig, cupAttendancePlayers, { teams: [{ a: true, b: false }] });
assert.deepEqual(cupAttendance, { teams: [{ a: true, b: false }, { a: false, b: false }] }, "A presença das duplas perdeu sua estrutura salva.");
const individualCupAttendance = normalizeParticipantAttendance(
  { type: "cearenseIndividual" },
  { teams: [{ a: "Ana", b: "Reserva" }] },
  { teams: [{ a: true, b: true }] }
);
assert.deepEqual(individualCupAttendance, { teams: [{ a: true, b: false }] }, "A copa individual passou a confirmar um segundo integrante inexistente.");
assert.deepEqual(
  getParticipantAttendanceEntries(cupAttendanceConfig, { players: cupAttendancePlayers, participantAttendance: cupAttendance }).map((entry) => [entry.name, entry.confirmed]),
  [["Ana", true], ["Bia", false], ["Carla", false], ["Dora", false]],
  "A lista visual de presença das duplas foi alterada."
);
assert.deepEqual(
  getGameSideAttendanceParticipants({ players: cupAttendancePlayers, participantAttendance: cupAttendance }, { ids1: [0] }, "team1"),
  [{ name: "Ana", pending: false }, { name: "Bia", pending: true }],
  "O indicador de ausência dentro do jogo foi alterado."
);
const mutableAttendance = [false];
setParticipantAttendanceValue(mutableAttendance, { kind: "normal", index: 0 }, true);
assert.deepEqual(mutableAttendance, [true], "A confirmação individual deixou de atualizar o campo correto.");
assert.deepEqual(
  reconcileParticipantAttendance({ type: "super8" }, ["  ANA MARIA ", "Bia"], ["Ana Maria", "Carla"], [true, true]),
  [true, false],
  "A presença não foi preservada somente para o mesmo participante na mesma vaga."
);
assert.equal(normalizeCircuitPointValue(12.6), 13, "A pontuação do circuito deve continuar sendo arredondada.");
assert.equal(normalizeCircuitPointValue(-1), 0, "Uma pontuação negativa deve continuar sendo descartada.");
assert.equal(normalizeCircuitPointValue("inválido"), 0, "Uma pontuação inválida deve continuar sendo descartada.");
assert.equal(getCircuitCupPlacementKey("Semifinal"), "semifinal", "Uma eliminação na semifinal foi classificada incorretamente.");
assert.equal(getCircuitCupPlacementKey("Quartas de final"), "quarterfinal", "Uma eliminação nas quartas foi classificada incorretamente.");
assert.equal(getCircuitCupPlacementKey("Oitavas de final"), "round16", "Uma eliminação nas oitavas foi classificada incorretamente.");
assert.equal(getCircuitCupPlacementKey("Preliminar"), "round32", "Uma eliminação preliminar foi classificada incorretamente.");
assert.equal(getCircuitCupPlacementKey("Final"), "runnerUp", "O perdedor da final deixou de ser vice-campeão.");
assert.equal(getCircuitPlacementLabel("champion"), "Campeão", "O rótulo do campeão foi alterado.");
assert.equal(getCircuitPlacementLabel("", 7), "7º lugar", "O rótulo de uma colocação numérica foi alterado.");
assert.deepEqual(
  normalizeCircuitTieBreakOrder(["titles", "titles", "inválido"]),
  ["wins", "totalGames", "balance"],
  "Uma ordem inválida deve voltar ao padrão de Vitórias, Total de Games e Saldo."
);
assert.deepEqual(
  normalizeCircuitTieBreakOrder(["totalGames", "balance", "wins"]),
  ["totalGames", "balance", "wins"],
  "O circuito sem pontuação deve preservar a ordem escolhida pelo organizador."
);
const defaultCircuitSettings = normalizeCircuitRankingSettings();
assert.equal(defaultCircuitSettings.mode, "performance", "O modo padrão do circuito foi alterado.");
assert.deepEqual(defaultCircuitSettings.points.positions, defaultCircuitPositionPoints, "A pontuação padrão das dez colocações foi alterada.");
assert.equal(defaultCircuitSettings.points.otherPositions, 120, "A pontuação padrão das demais colocações foi alterada.");
const customCircuitSettingsInput = {
  mode: "placement",
  tournamentFormat: "cup",
  identity: "individual",
  rankingDivision: "gender",
  sourceCircuitIds: [1, "1", 2, ""],
  tieBreakMode: "cearense",
  points: { positions: [900], otherPositions: 75, cup: { champion: 1500 } },
  extraPoints: [{ targetId: "ana", targetName: "Ana", points: 25 }],
  manualParticipants: [{ id: "manual-ana", name: "  ANA   MARIA ", points: 30, wins: 2, totalGames: 18, balance: -2, played: 3 }],
};
const customCircuitSettingsSnapshot = JSON.stringify(customCircuitSettingsInput);
const customCircuitSettings = normalizeCircuitRankingSettings(customCircuitSettingsInput);
assert.equal(JSON.stringify(customCircuitSettingsInput), customCircuitSettingsSnapshot, "A normalização não pode alterar as configurações recebidas.");
assert.deepEqual(customCircuitSettings.sourceCircuitIds, ["1", "2"], "Os circuitos de origem duplicados não foram removidos.");
assert.equal(customCircuitSettings.manualParticipants[0].name, "Ana Maria", "O participante manual perdeu a formatação do nome.");
assert.deepEqual(customCircuitSettings.tieBreakOrder, ["wins", "totalGames", "balance"], "O circuito não aplicou seus critérios universais.");
assert.equal(customCircuitSettings.points.positions[0], 900, "Uma pontuação personalizada foi alterada.");
assert.equal(customCircuitSettings.points.positions[1], defaultCircuitPositionPoints[1], "Uma pontuação padrão ausente não foi restaurada.");
assert.equal(customCircuitSettings.points.cup.champion, 1500, "A pontuação personalizada do campeão foi alterada.");
assert.equal(compareCircuitStageScores({ stageScores: [100, 50] }, { stageScores: [80, 70] }), -20, "A comparação das melhores etapas foi alterada.");
assert.equal(compareCircuitStageScores({ bestStagePoints: 40 }, { bestStagePoints: 60 }), 20, "A comparação compatível com rankings antigos foi alterada.");
const tiedCircuitRows = [
  { id: "ana", name: "Ana", circuitPoints: 100, w: 2, stageScores: [80] },
  { id: "bia", name: "Bia", circuitPoints: 100, w: 2, stageScores: [80] },
];
const tiedCircuitSignature = getCircuitTieSignature(tiedCircuitRows[0], customCircuitSettings);
assert.equal(tiedCircuitSignature, getCircuitTieSignature(tiedCircuitRows[1], customCircuitSettings), "Linhas realmente empatadas receberam assinaturas diferentes.");
assert.equal(getCircuitTieBreakLabel(customCircuitSettings), "Pontos → Vitórias → Total de Games → Saldo de games → Sorteio", "O texto do desempate por pontos foi alterado.");
const circuitDrawSettings = {
  ...customCircuitSettings,
  tieBreakDrawOrder: ["bia", "ana"],
  tieBreakDrawSignatures: { ana: tiedCircuitSignature, bia: tiedCircuitSignature },
};
assert.equal(applyCircuitDrawOrder(tiedCircuitRows[0], tiedCircuitRows[1], circuitDrawSettings), 1, "A ordem do sorteio do desempate não foi respeitada.");
assert.equal(getUnresolvedCircuitTieGroups([{ rows: tiedCircuitRows }], customCircuitSettings).length, 1, "Um empate ainda não sorteado deixou de ser identificado.");
assert.equal(getUnresolvedCircuitTieGroups([{ rows: tiedCircuitRows }], circuitDrawSettings).length, 0, "Um empate já sorteado continua aparecendo como pendente.");
assert.deepEqual(
  getCircuitPlacementColumns(customCircuitSettings, { includeManual: true }).map((column) => column.key),
  ["circuitPoints", "w", "pts", "bal", "played", "tournaments"],
  "As colunas do ranking por pontos foram alteradas."
);
assert.deepEqual(
  getCircuitRankingExportColumns(customCircuitSettings).map((column) => column.key),
  ["circuitPoints", "w", "pts", "bal", "played", "tournaments"],
  "A imagem, o PDF e a planilha do circuito por pontos perderam dados do ranking."
);
assert.deepEqual(
  getCircuitRankingExportColumns({ ...customCircuitSettings, mode: "performance", sourceCircuitIds: [] })
    .map((column) => column.key),
  ["w", "pts", "bal", "played", "tournaments"],
  "O circuito sem pontuação não deve exibir uma coluna de pontos."
);
const circuitExtraRow = { id: "ana", name: "Ana", circuitPoints: 100, extraPoints: 0 };
const circuitExtraGroups = { geral: { rows: new Map([["ana", circuitExtraRow]]) } };
applyCircuitExtraPoints(circuitExtraGroups, customCircuitSettings);
assert.equal(circuitExtraRow.circuitPoints, 125, "A pontuação extra não foi somada ao total principal.");
assert.equal(circuitExtraRow.extraPoints, 25, "A pontuação extra não foi registrada separadamente para conferência.");
const circuitManualGroups = { geral: { rows: new Map() } };
applyCircuitManualParticipants(circuitManualGroups, customCircuitSettings);
const circuitManualRow = circuitManualGroups.geral.rows.get("ana maria");
assert.equal(circuitManualRow.name, "Ana Maria", "O participante manual não entrou no ranking com o nome formatado.");
assert.equal(circuitManualRow.circuitPoints, 30, "Os pontos do participante manual não foram somados.");
assert.equal(circuitManualRow.w, 2, "As vitórias do participante manual não foram somadas.");
assert.equal(circuitManualRow.pts, 18, "O Total de Games do participante manual não foi somado.");
const cupPlacementTournament = {
  type: "cearense",
  data: {
    players: { teams: [{ a: "Ana", b: "Bia" }, { a: "Carla", b: "Dora" }] },
    schedule: [],
    brackets: [{ phase: "main", roundName: "Final", ids1: [0], ids2: [1], s1: "6", s2: "4" }],
    winningScore: 6,
  },
};
const cupPlacementSnapshot = JSON.stringify(cupPlacementTournament);
assert.equal(isCompletedCircuitGame(cupPlacementTournament.data.brackets[0], cupPlacementTournament.data), true, "Uma final concluída deixou de ser reconhecida no circuito.");
const cupPlacementRows = calculateCupPlacementRows({
  tournament: cupPlacementTournament,
  settings: { identity: "team" },
  config: { type: "cearense" },
});
assert.equal(JSON.stringify(cupPlacementTournament), cupPlacementSnapshot, "O cálculo das colocações da Copa não pode alterar o torneio recebido.");
assert.deepEqual(
  cupPlacementRows.map(({ name, placementKey, circuitPoints }) => ({ name, placementKey, circuitPoints })),
  [
    { name: "Ana + Bia", placementKey: "champion", circuitPoints: 1000 },
    { name: "Carla + Dora", placementKey: "runnerUp", circuitPoints: 800 },
  ],
  "Campeão e vice perderam suas colocações ou pontuações no circuito."
);
const rankPlacementTournament = {
  type: "super8",
  data: {
    players: ["Ana", "Bia", "Carla", "Dora"],
    schedule: [[{ ids1: [0, 1], ids2: [2, 3], s1: "4", s2: "2" }]],
    winningScore: 4,
  },
};
const rankPlacementRows = calculateRankPlacementRows({
  tournament: rankPlacementTournament,
  settings: {},
  config: { type: "super8" },
});
assert.deepEqual(rankPlacementRows.map((row) => row.circuitPoints), [1000, 800, 670, 500], "A classificação final perdeu a tabela de pontos por posição.");
assert.deepEqual(
  calculateCircuitPlacementRowsByConfig({
    tournament: rankPlacementTournament,
    settings: {},
    config: { type: "super8" },
  }),
  rankPlacementRows,
  "O seletor das colocações deixou de encaminhar modalidades sem eliminatória."
);
const circuitAggregationInput = {
  circuit: {
    tournament_ids: ["etapa-1", "etapa-2", "ignorada"],
    ranking_criteria: "wins_points_balance",
  },
  tournaments: [
    {
      id: "etapa-1",
      type: "super8",
      data: {
        players: ["Barbara", "Bia", "Carla", "Dora"],
        schedule: [[{ ids1: [0, 1], ids2: [2, 3], s1: "4", s2: "2" }]],
        winningScore: 4,
      },
    },
    {
      id: "etapa-2",
      type: "super8",
      data: {
        players: ["Bárbara", "Bia", "Carla", "Dora"],
        schedule: [[{ ids1: [0, 2], ids2: [1, 3], s1: "4", s2: "1" }]],
        winningScore: 4,
      },
    },
    {
      id: "ignorada",
      type: "super8",
      data: {
        deletedAt: "2026-08-17T10:00:00.000Z",
        players: ["Bárbara", "Bia", "Carla", "Dora"],
        schedule: [[{ ids1: [0, 1], ids2: [2, 3], s1: "4", s2: "0" }]],
        winningScore: 4,
      },
    },
  ],
  modalityConfigs: { super8: { type: "super8" } },
};
const circuitAggregationSnapshot = JSON.stringify(circuitAggregationInput);
const circuitPerformanceGroups = buildCircuitRankingGroups(circuitAggregationInput);
assert.equal(JSON.stringify(circuitAggregationInput), circuitAggregationSnapshot, "A agregação do circuito não pode alterar os torneios ou o circuito recebidos.");
assert.deepEqual(circuitPerformanceGroups.map((group) => group.key), ["geral"], "Um circuito comum passou a criar divisões de ranking indevidas.");
const aggregatedBarbara = circuitPerformanceGroups[0].rows.find((row) => row.name === "Bárbara");
assert.ok(aggregatedBarbara, "Grafias com e sem acento deixaram de representar a mesma participante no circuito.");
assert.equal(aggregatedBarbara.tournaments, 2, "As duas etapas válidas não foram acumuladas para a mesma participante.");
assert.equal(aggregatedBarbara.w, 2, "As vitórias das etapas válidas não foram somadas.");
assert.equal(circuitPerformanceGroups[0].rows.filter((row) => normalizeCircuitParticipantKey(row.name) === "barbara").length, 1, "A participante foi duplicada por causa do acento.");

const combinedCircuitGroups = buildCircuitRankingGroups({
  circuit: {
    tournament_ids: [],
    ranking_settings: {
      mode: "placement",
      sourceCircuitIds: ["origem-1"],
      identity: "individual",
    },
    ranking_groups: [
      { key: "geral", rows: [{ name: "Barbara", circuitPoints: 100, w: 1, tournaments: 1, stageScores: [100] }] },
      { key: "geral", rows: [{ name: "Bárbara", circuitPoints: 80, w: 2, tournaments: 1, stageScores: [80] }] },
    ],
  },
});
assert.equal(combinedCircuitGroups[0].title, "Ranking geral por pontos", "O circuito somado perdeu o título do ranking por pontos.");
assert.equal(combinedCircuitGroups[0].rows.length, 1, "O circuito somado duplicou a participante por causa do acento.");
assert.equal(combinedCircuitGroups[0].rows[0].circuitPoints, 180, "Os pontos dos circuitos de origem não foram somados.");
assert.equal(combinedCircuitGroups[0].rows[0].w, 3, "As vitórias dos circuitos de origem não foram somadas.");
assert.deepEqual(combinedCircuitGroups[0].rows[0].stageScores, [100, 80], "As melhores etapas dos circuitos de origem perderam sua ordem.");
const historicalCircuitGroups = buildCircuitRankingGroupsFromRecords({
  records: [
    { groupKey: "geral", playerKey: "barbara", name: "Barbara", w: 1, pts: 6, bal: 2, played: 1, tournaments: 1 },
    { groupKey: "geral", playerKey: "bárbara", name: "Bárbara", w: 2, pts: 10, bal: 4, played: 2, tournaments: 1 },
    { groupKey: "geral", playerKey: "bia", name: "Bia", w: 2, pts: 12, bal: 3, played: 2, tournaments: 1 },
  ],
  settings: { mode: "performance" },
  criteriaValue: "wins_points_balance",
});
assert.deepEqual(
  historicalCircuitGroups[0].rows.map(({ name, w, pts, bal, played, tournaments }) => ({ name, w, pts, bal, played, tournaments })),
  [
    { name: "Bárbara", w: 3, pts: 16, bal: 6, played: 3, tournaments: 2 },
    { name: "Bia", w: 2, pts: 12, bal: 3, played: 2, tournaments: 1 },
  ],
  "A soma ou a ordenação do histórico já persistido do circuito foi alterada."
);
const customOrderCircuitGroups = buildCircuitRankingGroupsFromRecords({
  records: [
    { groupKey: "geral", playerKey: "ana", name: "Ana", w: 3, pts: 10, bal: 1, played: 3, tournaments: 1 },
    { groupKey: "geral", playerKey: "bia", name: "Bia", w: 2, pts: 14, bal: 4, played: 3, tournaments: 1 },
  ],
  settings: { mode: "performance", tieBreakOrder: ["totalGames", "balance", "wins"] },
});
assert.deepEqual(
  customOrderCircuitGroups[0].rows.map((row) => row.name),
  ["Bia", "Ana"],
  "O circuito sem pontuação não respeitou a ordem de critérios escolhida pelo organizador."
);
assert.equal(
  getCircuitTieBreakLabel({ mode: "performance", tieBreakOrder: ["totalGames", "balance", "wins"] }),
  "Total de Games → Saldo de games → Vitórias → Sorteio",
  "O resumo do circuito não refletiu a ordem escolhida pelo organizador."
);
assert.deepEqual(
  getCircuitPerformanceColumns({ mode: "performance", tieBreakOrder: ["totalGames", "balance", "wins"] }),
  [
    { key: "pts", label: "Total de Games" },
    { key: "bal", label: "Saldo de games" },
    { key: "w", label: "Vitórias" },
  ],
  "As colunas visuais do circuito não refletiram a ordem escolhida pelo organizador."
);
assert.deepEqual(
  getCircuitRankingExportColumns({ mode: "performance", tieBreakOrder: ["balance", "wins", "totalGames"] }).slice(0, 3),
  [
    { key: "bal", label: "Saldo de games" },
    { key: "w", label: "Vitórias" },
    { key: "pts", label: "Total de Games" },
  ],
  "A exportação do circuito não refletiu a ordem escolhida pelo organizador."
);
const historicalGenderGroups = buildCircuitRankingGroupsFromRecords({
  records: [
    {
      tournamentId: "copa-masculina",
      groupKey: "geral",
      playerKey: "carlos",
      name: "Carlos",
      circuitPoints: 500,
      placementKey: "quarterfinal",
      placementLabel: "Quartas de final",
      w: 2,
      pts: 14,
      bal: 3,
      played: 3,
      tournaments: 1,
    },
    {
      tournamentId: "copa-mista",
      groupKey: "geral",
      playerKey: "ana",
      name: "Ana",
      circuitPoints: 170,
      placementKey: "groupStage",
      placementLabel: "Fase de grupos",
      w: 1,
      pts: 9,
      bal: -1,
      played: 2,
      tournaments: 1,
    },
  ],
  settings: {
    mode: "placement",
    identity: "individual",
    rankingDivision: "gender",
    genderRegistry: {
      ana: { name: "Ana", gender: "feminino", confirmed: true },
    },
  },
  criteriaValue: "wins_points_balance",
  tournaments: [
    { id: "copa-masculina", type: "cearense", data: { category: "Masculino até C" } },
    { id: "copa-mista", type: "cearense", data: { participantGenderMode: "mista" } },
  ],
  modalityConfigs: { cearense: { type: "cearense" } },
});
assert.deepEqual(
  historicalGenderGroups.map(({ key }) => key),
  ["masculino", "feminino"],
  "Registros antigos de fases alcançadas não foram direcionados aos rankings por gênero."
);
assert.equal(
  historicalGenderGroups.find(({ key }) => key === "masculino")?.rows[0]?.circuitPoints,
  500,
  "Os pontos das quartas de final foram perdidos ao corrigir o ranking masculino."
);
assert.equal(
  historicalGenderGroups.find(({ key }) => key === "feminino")?.rows[0]?.circuitPoints,
  170,
  "Os pontos de participação na fase de grupos foram perdidos ao corrigir o ranking feminino."
);
const historicalRecordsInput = circuitAggregationInput.tournaments.slice(0, 2);
const historicalRecordsSnapshot = JSON.stringify(historicalRecordsInput);
const historicalRecords = buildCircuitTournamentRankingRecords({
  tournaments: historicalRecordsInput,
  settings: { mode: "performance" },
  modalityConfigs: circuitAggregationInput.modalityConfigs,
});
assert.equal(JSON.stringify(historicalRecordsInput), historicalRecordsSnapshot, "A preparação do histórico não pode alterar os torneios recebidos.");
assert.equal(Object.keys(historicalRecords).length, 8, "O histórico perdeu participantes com jogos válidos nas duas etapas.");
assert.equal(historicalRecords["etapa-1::geral::barbara"].w, 1, "O histórico da primeira etapa perdeu a vitória da participante.");
assert.equal(historicalRecords["etapa-2::geral::barbara"].name, "Bárbara", "O histórico não preservou a melhor grafia disponível do nome.");

function assertCompleteRound(round, participantCount, expectedGames, label) {
  assert.equal(round.length, expectedGames, `${label} recebeu uma quantidade incorreta de jogos.`);
  const participants = round.flat();
  assert.equal(participants.length, expectedGames * 4, `${label} recebeu um jogo incompleto.`);
  assert.deepEqual(
    [...participants].sort((first, second) => first - second),
    Array.from({ length: participantCount }, (_, index) => index + 1),
    `${label} não utiliza cada participante exatamente uma vez na rodada.`
  );
}

assert.equal(super8Template.length, 7, "O Super 8 deve preservar sete rodadas.");
super8Template.forEach((round, index) => assertCompleteRound(round.map((game) => game.flat()), 8, 2, `Super 8 — rodada ${index + 1}`));
assert.equal(super10MixedTemplate.length, 5, "O Super 10 mista deve preservar cinco rodadas.");
assert.ok(super10MixedTemplate.every((round) => round.length === 2), "O Super 10 mista deve preservar dois jogos por rodada.");
assert.equal(super12MixedTemplate.length, 6, "O Super 12 mista deve preservar seis rodadas.");
super12MixedTemplate.forEach((round, index) => assertCompleteRound(round, 12, 3, `Super 12 mista — rodada ${index + 1}`));
assert.equal(super16MixedTemplate.length, 8, "O Super 16 mista deve preservar oito rodadas.");
super16MixedTemplate.forEach((round, index) => assertCompleteRound(round, 16, 4, `Super 16 mista — rodada ${index + 1}`));
for (const [template, split, label] of [
  [super10MixedTemplate, 5, "Super 10 mista"],
  [super12MixedTemplate, 6, "Super 12 mista"],
  [super16MixedTemplate, 8, "Super 16 mista"],
]) {
  for (const game of template.flat()) {
    assert.ok(game[0] <= split && game[1] > split && game[2] <= split && game[3] > split, `${label} perdeu a formação homem/mulher das duplas.`);
  }
}
const super12MixedPartnerCounts = new Map();
const super12MixedOpponentCounts = new Map();
const incrementSuper12MixedPair = (counts, first, second) => {
  const key = [first, second].sort((left, right) => left - right).join("-");
  counts.set(key, (counts.get(key) || 0) + 1);
};
for (const [manA, womanA, manB, womanB] of super12MixedTemplate.flat()) {
  incrementSuper12MixedPair(super12MixedPartnerCounts, manA, womanA);
  incrementSuper12MixedPair(super12MixedPartnerCounts, manB, womanB);
  incrementSuper12MixedPair(super12MixedOpponentCounts, manA, manB);
  incrementSuper12MixedPair(super12MixedOpponentCounts, womanA, womanB);
  incrementSuper12MixedPair(super12MixedOpponentCounts, manA, womanB);
  incrementSuper12MixedPair(super12MixedOpponentCounts, manB, womanA);
}
for (let man = 1; man <= 6; man += 1) {
  for (let woman = 7; woman <= 12; woman += 1) {
    assert.equal(
      super12MixedPartnerCounts.get(`${man}-${woman}`),
      1,
      `O Super 12 mista repetiu ou omitiu a parceria entre os participantes ${man} e ${woman}.`
    );
  }
}
assert.ok(
  Math.max(...super12MixedOpponentCounts.values()) <= 2,
  "O Super 12 mista repetiu o mesmo confronto mais vezes que o mínimo necessário."
);
assert.equal(fixed12Template.length, 5, "As seis duplas fixas devem preservar cinco rodadas.");
const fixedPairKeys = new Set();
for (const [roundIndex, round] of fixed12Template.entries()) {
  assert.deepEqual(
    [...round.flat()].sort((first, second) => first - second),
    [1, 2, 3, 4, 5, 6],
    `Duplas fixas — rodada ${roundIndex + 1} não utiliza todas as duplas.`
  );
  for (const pair of round) fixedPairKeys.add([...pair].sort((first, second) => first - second).join("-"));
}
assert.equal(fixedPairKeys.size, 15, "As seis duplas fixas devem se enfrentar uma única vez.");
const bergerRounds = berger(8);
assert.equal(bergerRounds.length, 7, "O gerador todos contra todos deve preservar sete rodadas para oito participantes.");
const bergerPairs = new Set(bergerRounds.flat().map((pair) => [...pair].sort((first, second) => first - second).join("-")));
assert.equal(bergerPairs.size, 28, "O gerador todos contra todos deve produzir cada confronto uma única vez.");
const createFixedTeams = (count) => ({
  teams: Array.from({ length: count }, (_, index) => ({
    a: `Atleta ${index + 1}A`,
    b: `Atleta ${index + 1}B`,
  })),
});
const assertFixedTeamSchedule = (type, teamCount, expectedRounds, expectedGames) => {
  const schedule = generateSchedule(type, createFixedTeams(teamCount));
  assert.equal(schedule.length, expectedRounds, `${type} deve gerar ${expectedRounds} rodadas.`);
  assert.ok(schedule.every((round) => round.length === teamCount / 2), `${type} deve usar todas as duplas em cada rodada.`);
  const pairKeys = schedule.flat().map((game) => [...game.ids1, ...game.ids2].sort((a, b) => a - b).join("-"));
  assert.equal(pairKeys.length, expectedGames, `${type} deve gerar ${expectedGames} partidas.`);
  assert.equal(new Set(pairKeys).size, expectedGames, `${type} não pode repetir adversários.`);
  const appearances = Array.from({ length: teamCount }, () => 0);
  for (const game of schedule.flat()) {
    appearances[game.ids1[0]] += 1;
    appearances[game.ids2[0]] += 1;
  }
  assert.ok(appearances.every((count) => count === expectedRounds), `${type} deve colocar cada dupla em todas as rodadas.`);
};
assertFixedTeamSchedule("Super 10 (Dupla Fixa)", 10, 9, 45);
assertFixedTeamSchedule("Super 12 (Dupla Fixa)", 12, 11, 66);
const shuffleInput = [1, 2, 3, 4, 5, 6];
const shuffled = shuffleArray(shuffleInput);
assert.deepEqual(shuffleInput, [1, 2, 3, 4, 5, 6], "O sorteio não pode alterar a lista original.");
assert.deepEqual([...shuffled].sort((first, second) => first - second), shuffleInput, "O sorteio deve preservar todos os participantes.");
const courtSchedule = [
  [{ key: "a", ids1: [1, 2], ids2: [3, 4] }, { key: "b", ids1: [5, 6], ids2: [7, 8] }],
  [{ key: "c", ids1: [1, 3], ids2: [5, 7] }, { key: "d", ids1: [2, 4], ids2: [6, 8] }],
];
const courtScheduleSnapshot = JSON.stringify(courtSchedule);
const balancedCourtSchedule = optimizeCourts(courtSchedule);
assert.equal(JSON.stringify(courtSchedule), courtScheduleSnapshot, "A distribuição de quadras não pode alterar as rodadas originais.");
for (const round of balancedCourtSchedule) {
  assert.deepEqual(round.map((game) => game.court), [1, 2], "A distribuição deve preencher cada quadra lógica uma vez por rodada.");
}
assert.deepEqual(
  balancedCourtSchedule.flat().map((game) => game.key).sort(),
  ["a", "b", "c", "d"],
  "A distribuição de quadras não pode criar ou remover jogos."
);
assert.equal(getTeamName({ a: "Ana", b: "Bia" }), "Ana + Bia", "O nome público de uma dupla foi alterado.");
assert.equal(getTeamName({ a: "Ana", b: "" }), "Ana", "Uma dupla incompleta não deve ganhar separador vazio.");
assert.equal(getTeamName(null), "", "Uma equipe inexistente deve permanecer sem nome.");
const cupTeamsData = { players: { teams: [{ a: "Ana", b: "Bia" }] } };
assert.deepEqual(getCupTeams(cupTeamsData), cupTeamsData.players.teams, "As equipes salvas da copa não foram lidas.");
assert.equal(getCupTeamName(cupTeamsData, 0), "Ana + Bia", "O nome da equipe salva não foi preservado.");
assert.equal(getGroupLetter(0), "A", "O primeiro grupo deixou de ser o Grupo A.");
assert.equal(getGroupLetter(4), "E", "A sequência de letras dos grupos foi alterada.");
const expectedAutomaticGroupSizes = new Map([
  [4, [4]],
  [5, [5]],
  [6, [3, 3]],
  [7, [4, 3]],
  [8, [4, 4]],
  [9, [3, 3, 3]],
  [10, [4, 3, 3]],
  [16, [4, 3, 3, 3, 3]],
  [32, [4, 4, 3, 3, 3, 3, 3, 3, 3, 3]],
]);
for (const [teamCount, expectedSizes] of expectedAutomaticGroupSizes) {
  const groups = createCearenseGroups(teamCount);
  assert.deepEqual(groups.map((group) => group.teamIds.length), expectedSizes, `A formação automática de ${teamCount} participantes foi alterada.`);
  assert.deepEqual(groups.flatMap((group) => group.teamIds), Array.from({ length: teamCount }, (_, index) => index), `A formação de ${teamCount} participantes perdeu ou repetiu equipes.`);
}
assert.deepEqual(createCearenseGroups(16, "all-four").map((group) => group.teamIds.length), [4, 4, 4, 4], "A opção de quatro grupos de quatro foi alterada.");
assert.deepEqual(createCearenseGroups(12, "all-four").map((group) => group.teamIds.length), [4, 4, 4], "A formação completa em grupos de quatro foi alterada.");
assert.deepEqual(createCearenseGroups(10, "all-four").map((group) => group.teamIds.length), [4, 3, 3], "Uma quantidade incompatível com grupos de quatro deve preservar a formação automática.");
const playRankingMasculinoPrincipianteGroups = createCearenseGroups(
  13,
  "automatic",
  [3, 3, 4, 3]
);
assert.deepEqual(
  playRankingMasculinoPrincipianteGroups.map((group) => group.teamIds),
  [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9], [10, 11, 12]],
  "A composição específica do MASCULINO PRINCIPIANTE do PLAY RANKING® foi alterada."
);
assert.deepEqual(
  createCearenseGroups(13, "automatic", [3, 4, 3]).map((group) => group.teamIds.length),
  [4, 3, 3, 3],
  "Uma composição específica inválida não pode alterar a formação automática de outros torneios."
);
assert.equal(describeCearenseGroupSizes(createCearenseGroups(10)), "2 grupos de 3 duplas e 1 grupo de 4 duplas", "A descrição da formação dos grupos foi alterada.");
assert.equal(describeCearenseGroupSizes(createCearenseGroups(8), "jogadores"), "2 grupos de 4 jogadores", "A descrição da copa individual foi alterada.");
assert.deepEqual(createCupGroups(18).map((group) => group.teamIds.length), [3, 3, 3, 3, 3, 3], "A Copa de 18 perdeu os grupos de três.");
assert.deepEqual(createCupGroups(16, "sunset", { groupFormation: "all-four" }).map((group) => group.teamIds.length), [4, 4, 4, 4], "A Copa Sunset perdeu a formação escolhida pelo organizador.");
for (const participantCount of [3, 4]) {
  const ids = Array.from({ length: participantCount }, (_, index) => index);
  const snapshot = [...ids];
  const rounds = createRoundRobinPairings(ids);
  const pairs = new Set(rounds.flat().map((pair) => [...pair].sort((first, second) => first - second).join("-")));
  assert.deepEqual(ids, snapshot, "A criação das rodadas de grupo não pode alterar a lista original.");
  assert.equal(pairs.size, (participantCount * (participantCount - 1)) / 2, `O grupo de ${participantCount} perdeu confrontos do todos-contra-todos.`);
}
const cearenseFormatData = { cupConfig: { format: "cearense" } };
const individualCearenseFormatData = { cupConfig: { format: "cearense-individual" } };
const playRankingFormatData = { cupConfig: { format: "playranking" } };
const sunsetFormatData = { cupConfig: { format: "sunset" } };
assert.equal(getCupFormat({ cupConfig: { cupMode: "copinha" } }), "copinha", "O formato legado cupMode deixou de ser reconhecido.");
assert.equal(isCopinhaData({ cupConfig: { format: "copinha" } }), true, "A Copinha deixou de ser reconhecida.");
assert.equal(isCearenseData(cearenseFormatData), true, "O Campeonato Cearense deixou de ser reconhecido.");
assert.equal(isCearenseData(individualCearenseFormatData), true, "O Campeonato Cearense Individual deixou de ser reconhecido.");
assert.equal(isCampeonatoCearenseData(playRankingFormatData), false, "O Modelo Torneio 360 não pode ser confundido com o Campeonato Cearense oficial.");
assert.equal(isSunsetData(sunsetFormatData), true, "A Copa Sunset deixou de ser reconhecida.");
assert.equal(isOfficialCearenseData(sunsetFormatData), true, "A Copa Sunset deixou de compartilhar as regras oficiais previstas.");
assert.equal(isPlayRankingData(playRankingFormatData), true, "O Modelo Torneio 360 deixou de ser reconhecido.");
assert.equal(isCearenseSecondParallelEnabled(cearenseFormatData), false, "A 2ª paralela do Cearense deve respeitar a escolha do organizador.");
assert.equal(isCearenseSecondParallelEnabled({ cupConfig: { format: "cearense", secondRepechageEnabled: true } }), true, "A 2ª paralela ativada deixou de ser reconhecida.");
assert.equal(isCearenseSecondParallelEnabled(playRankingFormatData), true, "A paralela própria do Modelo Torneio 360 deve permanecer ativa.");
assert.equal(isCearenseThirdParallelEnabled(sunsetFormatData), true, "As chaves próprias da Copa Sunset devem permanecer ativas.");
assert.equal(isCearenseThirdParallelEnabled({ cupConfig: { format: "cearense", thirdRepechageEnabled: true } }), true, "A 3ª paralela ativada deixou de ser reconhecida.");

function createNamedTeams(count) {
  return { teams: Array.from({ length: count }, (_, index) => ({ a: `Atleta ${index + 1}`, b: `Parceiro ${index + 1}` })) };
}

function assertGroupSchedule(schedule, teamCount, expectedRoundCount, expectedGamesPerRound, label) {
  assert.equal(schedule.length, expectedRoundCount, `${label} recebeu uma quantidade incorreta de rodadas.`);
  assert.deepEqual(schedule.map((round) => round.length), expectedGamesPerRound, `${label} recebeu uma quantidade incorreta de jogos por rodada.`);
  const pairKeys = schedule.flat().map((game) => [...game.ids1, ...game.ids2].sort((first, second) => first - second).join("-"));
  assert.equal(new Set(pairKeys).size, pairKeys.length, `${label} repetiu um confronto na fase de grupos.`);
  for (const round of schedule) {
    assert.deepEqual(round.map((game) => game.court), Array.from({ length: round.length }, (_, index) => index + 1), `${label} alterou a numeração lógica das quadras.`);
    assert.ok(round.every((game) => game.phase === "groups" && game.s1 === "" && game.s2 === ""), `${label} gerou partidas com fase ou placar incorretos.`);
  }
  assert.ok(schedule.flat().every((game) => game.ids1[0] < teamCount && game.ids2[0] < teamCount), `${label} gerou uma equipe inexistente.`);
}

const cearensePlayers = createNamedTeams(7);
const cearensePlayersSnapshot = JSON.stringify(cearensePlayers);
const cearenseGroupSchedule = generateCearenseGroupSchedule(cearensePlayers, { teamCount: 7, format: "cearense" });
assertGroupSchedule(cearenseGroupSchedule, 7, 3, [3, 3, 3], "Campeonato Cearense com sete duplas");
assert.equal(cearenseGroupSchedule.flat().length, 9, "Os grupos de quatro e três devem gerar nove partidas.");
assert.equal(JSON.stringify(cearensePlayers), cearensePlayersSnapshot, "A geração da fase de grupos não pode alterar os participantes.");
const sunsetGroupSchedule = generateCupGroupSchedule(createNamedTeams(16), { teamCount: 16, format: "sunset", groupFormation: "all-four" });
assertGroupSchedule(sunsetGroupSchedule, 16, 3, [8, 8, 8], "Copa Sunset com grupos de quatro");
const playRankingMasculinoPrincipianteSchedule = generateCupGroupSchedule(
  createNamedTeams(13),
  { teamCount: 13, format: "playranking", groupSizes: [3, 3, 4, 3] }
);
assertGroupSchedule(
  playRankingMasculinoPrincipianteSchedule,
  13,
  3,
  [5, 5, 5],
  "MASCULINO PRINCIPIANTE do PLAY RANKING®"
);
const playRankingMasculinoPrincipianteGroupMembers = new Map();
playRankingMasculinoPrincipianteSchedule.flat().forEach((game) => {
  if (!playRankingMasculinoPrincipianteGroupMembers.has(game.groupId)) {
    playRankingMasculinoPrincipianteGroupMembers.set(game.groupId, new Set());
  }
  [...game.ids1, ...game.ids2].forEach((id) => (
    playRankingMasculinoPrincipianteGroupMembers.get(game.groupId).add(id)
  ));
});
assert.deepEqual(
  [...playRankingMasculinoPrincipianteGroupMembers.values()].map((ids) => [...ids].sort((a, b) => a - b)),
  [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9], [10, 11, 12]],
  "As partidas específicas deixaram de respeitar os quatro grupos e os mesmos nomes da referência."
);
const cup18GroupSchedule = generateCupGroupSchedule(createNamedTeams(18), { teamCount: 18, format: "cup18" });
assertGroupSchedule(cup18GroupSchedule, 18, 3, [6, 6, 6], "Copa de 18 duplas");
assert.equal(getLargestPowerOfTwo(14), 8, "A maior chave completa antes de 14 foi alterada.");
assert.equal(getNextPowerOfTwo(14), 16, "A chave de 14 participantes deve continuar usando 16 posições.");
assert.deepEqual(getBracketSeedOrder(4), [1, 4, 2, 3], "A ordem das sementes da chave de quatro foi alterada.");
assert.deepEqual(getBracketSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6], "A ordem das sementes da chave de oito foi alterada.");
assert.deepEqual(
  [2, 4, 8, 16, 32].map(getEliminationRoundName),
  ["Final", "Semifinal", "Quartas de final", "Oitavas de final", "Fase de 32"],
  "Os nomes das fases eliminatórias foram alterados."
);
assert.equal(getEliminationRoundName(64), "Rodada de 64", "Uma chave maior perdeu seu nome de compatibilidade.");
const seededExpectations = new Map([
  [4, [[1, 4], [2, 3]]],
  [7, [[2, 7], [3, 6], [4, 5]]],
  [8, [[1, 8], [4, 5], [3, 6], [2, 7]]],
  [14, [[3, 14], [4, 13], [5, 12], [6, 11], [7, 10], [8, 9]]],
  [16, [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]]],
]);
for (const [teamCount, expectedPairs] of seededExpectations) {
  const ids = Array.from({ length: teamCount }, (_, index) => index + 1);
  const snapshot = [...ids];
  const games = seedBracket(ids, "main");
  assert.deepEqual(games.map((game) => [game.ids1[0], game.ids2[0]]), expectedPairs, `A distribuição da chave de ${teamCount} foi alterada.`);
  assert.deepEqual(ids, snapshot, "A criação da chave não pode alterar a lista classificada.");
  assert.ok(games.every((game, index) => game.phase === "main" && game.court === index + 1 && game.s1 === "" && game.s2 === ""), `A chave de ${teamCount} perdeu seus campos iniciais.`);
}
const parallelRoundRobin = generateParallelRoundRobin([10, 20, 30, 40]);
assert.equal(parallelRoundRobin.length, 6, "A disputa paralela de quatro equipes deve preservar seis partidas.");
assert.equal(new Set(parallelRoundRobin.map((game) => [...game.ids1, ...game.ids2].sort().join("-"))).size, 6, "A disputa paralela deve manter todos contra todos uma vez.");
assert.deepEqual(parallelRoundRobin.map((game) => game.court), [1, 2, 1, 2, 1, 2], "A alternância lógica das quadras da paralela foi alterada.");
const completedBracketGame = { ids1: [0], ids2: [1], s1: "4", s2: "2" };
assert.equal(getGameWinnerId(completedBracketGame), 0, "O vencedor da partida eliminatória foi alterado.");
assert.equal(getGameLoserId(completedBracketGame), 1, "O perdedor da partida eliminatória foi alterado.");
assert.equal(getGameWinnerId({ ids1: [2], ids2: [], isBye: true, s1: "", s2: "" }), 2, "A classificação automática por BYE foi alterada.");
assert.equal(getGameLoserId({ ids1: [2], ids2: [], isBye: true, s1: "", s2: "" }), null, "Um BYE não pode produzir perdedor.");
assert.equal(getGameWinnerId({ ids1: [0], ids2: [1], s1: "", s2: "" }), null, "Uma partida sem placar não pode produzir vencedor.");
const bracketSemifinals = seedBracket([0, 1, 2, 3], "main").map((game, index) => ({
  ...game,
  s1: index === 0 ? "4" : "1",
  s2: index === 0 ? "2" : "4",
}));
const bracketFinal = buildNextRound(bracketSemifinals, "main", "Final", "final");
assert.equal(bracketFinal.length, 1, "Duas semifinais devem gerar uma final.");
assert.deepEqual([bracketFinal[0].source1, bracketFinal[0].source2], ["main_sf_1", "main_sf_2"], "A final perdeu a origem das semifinais.");
const bracketThirdPlace = buildThirdPlaceGame(bracketSemifinals, "main");
assert.deepEqual([bracketThirdPlace[0].source1Mode, bracketThirdPlace[0].source2Mode], ["loser", "loser"], "O 3º lugar deve receber os perdedores das semifinais.");
const bracketData = {
  winningScore: 4,
  players: {
    teams: [
      { a: "Equipe 1", b: "" },
      { a: "Equipe 2", b: "" },
      { a: "Equipe 3", b: "" },
      { a: "Equipe 4", b: "" },
    ],
  },
};
const allProgressionGames = [...bracketSemifinals, ...bracketFinal, ...bracketThirdPlace];
const resolvedFinal = resolveBracketGame(bracketFinal[0], allProgressionGames, bracketData);
assert.deepEqual([resolvedFinal.ids1, resolvedFinal.ids2], [[0], [2]], "Os vencedores das semifinais não avançaram corretamente para a final.");
assert.deepEqual([resolvedFinal.team1, resolvedFinal.team2], [["Equipe 1"], ["Equipe 3"]], "Os nomes dos finalistas não foram resolvidos corretamente.");
const resolvedThirdPlace = resolveBracketGame(bracketThirdPlace[0], allProgressionGames, bracketData);
assert.deepEqual([resolvedThirdPlace.ids1, resolvedThirdPlace.ids2], [[3], [1]], "Os perdedores das semifinais não avançaram corretamente para o 3º lugar.");
assert.deepEqual(buildThirdPlaceGame([], "main"), [], "Sem duas semifinais não pode existir disputa de 3º lugar.");
assert.equal(getCopinhaEntryCode({ groupPosition: 1, groupRank: 3 }), "c3", "A campeã de grupo perdeu seu código no plano da chave.");
assert.equal(getCopinhaEntryCode({ groupPosition: 2, groupRank: 4 }), "r4", "A segunda colocada perdeu seu código no plano da chave.");
assert.equal(getCopinhaEntryCode({ groupPosition: 3, groupRank: 2 }), "t2", "A terceira colocada perdeu seu código no plano da chave.");
const plannedEntryByCode = { c1: { id: 7 } };
assert.deepEqual(getCopinhaPlanEntry("c1", plannedEntryByCode, "main"), { id: 7 }, "Uma entrada direta do plano deixou de resolver a classificada.");
assert.deepEqual(
  getCopinhaPlanEntry("w:m1", plannedEntryByCode, "main"),
  { sourceMatchKey: "main_m1", sourceMode: "winner" },
  "A referência à vencedora de um jogo do plano foi alterada."
);
assert.deepEqual(
  getCopinhaPlanEntry("l:m2", plannedEntryByCode, "main"),
  { sourceMatchKey: "main_m2", sourceMode: "loser" },
  "A referência à perdedora de um jogo do plano foi alterada."
);
const compactBracketPlan = [
  { title: "1ª Rodada", games: [["m1", "c1", "r2"]] },
  { title: "Semifinal", games: [["m2", "w:m1", "c2"]] },
  { title: "3º lugar", games: [["m3", "l:m2", "l:m4"]] },
];
const compactBracketPlanSnapshot = JSON.stringify(compactBracketPlan);
const expandedBracketPlan = expandBracketPlanWithVisualByes(compactBracketPlan);
assert.equal(expandedBracketPlan[0].games.length, 2, "A expansão visual deixou de criar o BYE necessário.");
assert.deepEqual(expandedBracketPlan[0].games[0], ["m1", "c1", "r2"], "A expansão visual alterou o confronto existente.");
assert.match(expandedBracketPlan[0].games[1][0], /^visual_bye_/, "O BYE visual perdeu sua chave identificadora.");
assert.match(expandedBracketPlan[1].games[0][2], /^w:visual_bye_/, "A fase seguinte deixou de apontar para o BYE visual.");
assert.equal(JSON.stringify(compactBracketPlan), compactBracketPlanSnapshot, "A expansão visual não pode alterar o plano original.");
const plannedBracketEntries = [
  { id: 0, groupPosition: 1, groupRank: 1 },
  { id: 1, groupPosition: 2, groupRank: 1 },
];
const plannedBracketEntriesSnapshot = JSON.stringify(plannedBracketEntries);
const plannedBracket = buildCopinhaBracketFromPlan(
  plannedBracketEntries,
  "main",
  "Eliminatória Principal",
  [{ title: "Final", games: [["final_1", "c1", "r1"]] }]
);
assert.deepEqual([plannedBracket[0].games[0].ids1, plannedBracket[0].games[0].ids2], [[0], [1]], "O plano da chave deixou de posicionar as classificadas.");
assert.equal(plannedBracket[0].games[0].matchKey, "main_final_1", "O plano da chave alterou a chave persistida do confronto.");
assert.equal(JSON.stringify(plannedBracketEntries), plannedBracketEntriesSnapshot, "A aplicação do plano não pode alterar as classificadas.");
const playRankingSevenGroupEntries = [
  ...Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    groupPosition: 1,
    groupRank: index + 1,
  })),
  ...Array.from({ length: 7 }, (_, index) => ({
    id: index + 8,
    groupPosition: 2,
    groupRank: index + 1,
  })),
];
const playRankingSevenGroupOpening = buildCopinhaBracketFromPlan(
  playRankingSevenGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingMainBracketPlans[7])
)[0].games;
assert.deepEqual(
  playRankingSevenGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [
    [1, null],
    [14, 9],
    [4, 10],
    [13, 5],
    [6, 12],
    [11, 3],
    [7, 8],
    [null, 2],
  ],
  "O Modelo Torneio 360 com sete grupos deixou de reproduzir a distribuição de referência."
);
assert.deepEqual(
  playRankingSevenGroupOpening.map((game) => game.isBye),
  [true, false, false, false, false, false, false, true],
  "Os dois melhores campeões do Modelo Torneio 360 devem receber BYE nas extremidades da chave."
);
const playRankingLegacyV2SevenGroupOpening = buildCopinhaBracketFromPlan(
  playRankingSevenGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingLegacyV2MainBracketPlans[7])
)[0].games;
assert.deepEqual(
  playRankingLegacyV2SevenGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [
    [1, null],
    [12, 9],
    [4, 13],
    [11, 5],
    [6, 8],
    [14, 3],
    [7, 10],
    [2, null],
  ],
  "A versão 2 deixou de preservar a chave antiga enquanto não houver migração autorizada."
);
const playRankingFourGroupEntries = [
  ...Array.from({ length: 4 }, (_, index) => ({ id: index + 1, groupPosition: 1, groupRank: index + 1 })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: index + 5, groupPosition: 2, groupRank: index + 1 })),
];
const playRankingTwoGroupEntries = [
  { id: 1, groupPosition: 1, groupRank: 1 },
  { id: 2, groupPosition: 1, groupRank: 2 },
  { id: 3, groupPosition: 2, groupRank: 1 },
  { id: 4, groupPosition: 2, groupRank: 2 },
];
const playRankingTwoGroupOpening = buildCopinhaBracketFromPlan(
  playRankingTwoGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingMainBracketPlans[2])
)[0].games;
assert.deepEqual(
  playRankingTwoGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [[1, 4], [3, 2]],
  "A chave oficial com dois grupos deixou de posicionar Seed 1 × Seed 4 e Seed 3 × Seed 2."
);
const playRankingLegacyV3TwoGroupOpening = buildCopinhaBracketFromPlan(
  playRankingTwoGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingLegacyV3MainBracketPlans[2])
)[0].games;
assert.deepEqual(
  playRankingLegacyV3TwoGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [[1, 4], [2, 3]],
  "A versão 3 deixou de preservar a orientação anterior para torneios de outros perfis."
);
const playRankingFourGroupOpening = buildCopinhaBracketFromPlan(
  playRankingFourGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingMainBracketPlans[4])
)[0].games;
assert.deepEqual(
  playRankingFourGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [[1, 7], [6, 4], [3, 5], [8, 2]],
  "A chave oficial com quatro grupos não reproduziu os quatro confrontos de referência."
);
const playRankingFiveGroupReferenceEntries = [
  ...[12, 3, 6, 0, 9].map((id, index) => ({ id, groupPosition: 1, groupRank: index + 1 })),
  ...[13, 4, 7, 1, 10].map((id, index) => ({ id, groupPosition: 2, groupRank: index + 1 })),
];
const playRankingFiveGroupReferenceOpening = buildCopinhaBracketFromPlan(
  playRankingFiveGroupReferenceEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingMainBracketPlans[5])
)[0].games;
assert.deepEqual(
  playRankingFiveGroupReferenceOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [[12, null], [4, 7], [0, null], [null, 9], [6, null], [null, 13], [1, 10], [null, 3]],
  "A chave com cinco grupos deixou de reproduzir a matriz de seeds da plataforma de referência."
);
const playRankingSixGroupEntries = [
  ...Array.from({ length: 6 }, (_, index) => ({ id: index + 1, groupPosition: 1, groupRank: index + 1 })),
  ...Array.from({ length: 6 }, (_, index) => ({ id: index + 7, groupPosition: 2, groupRank: index + 1 })),
];
const playRankingSixGroupOpening = buildCopinhaBracketFromPlan(
  playRankingSixGroupEntries,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingMainBracketPlans[6])
)[0].games;
assert.deepEqual(
  playRankingSixGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  [[1, null], [8, 9], [4, null], [12, 5], [6, 7], [null, 3], [10, 11], [null, 2]],
  "A chave oficial com seis grupos não reproduziu os BYEs e confrontos de referência."
);
for (let groupCount = 2; groupCount <= 10; groupCount += 1) {
  const entries = [
    ...Array.from({ length: groupCount }, (_, index) => ({
      id: index + 1,
      groupPosition: 1,
      groupRank: index + 1,
    })),
    ...Array.from({ length: groupCount }, (_, index) => ({
      id: groupCount + index + 1,
      groupPosition: 2,
      groupRank: index + 1,
    })),
  ];
  const openingGames = buildCopinhaBracketFromPlan(
    entries,
    "main",
    "Eliminatória Principal",
    expandBracketPlanWithVisualByes(playRankingMainBracketPlans[groupCount])
  )[0].games;
  const expectedByeCount = getNextPowerOfTwo(groupCount * 2) - groupCount * 2;
  const byeSeedIds = openingGames
    .filter((game) => game.isBye)
    .flatMap((game) => [...game.ids1, ...game.ids2])
    .sort((first, second) => first - second);
  assert.deepEqual(
    byeSeedIds,
    Array.from({ length: expectedByeCount }, (_, index) => index + 1),
    `Os BYEs com ${groupCount} grupos deixaram de pertencer às melhores sementes.`
  );

  for (let groupRank = 1; groupRank <= groupCount; groupRank += 1) {
    const championId = groupRank;
    const runnerUpId = groupCount + groupRank;
    const championGameIndex = openingGames.findIndex((game) => [...game.ids1, ...game.ids2].includes(championId));
    const runnerUpGameIndex = openingGames.findIndex((game) => [...game.ids1, ...game.ids2].includes(runnerUpId));
    assert.ok(championGameIndex >= 0 && runnerUpGameIndex >= 0, `Uma semente sumiu da chave com ${groupCount} grupos.`);
    assert.notEqual(
      championGameIndex < openingGames.length / 2,
      runnerUpGameIndex < openingGames.length / 2,
      `Campeão e segundo colocado do grupo ${groupRank} não ficaram em metades opostas com ${groupCount} grupos.`
    );
  }
}
for (let teamCount = 4; teamCount <= 32; teamCount += 1) {
  const groupCount = createCearenseGroups(teamCount).length;
  assert.ok(
    playRankingMainBracketPlans[groupCount],
    `O Modelo Torneio 360 ficou sem matriz oficial para ${teamCount} duplas (${groupCount} grupos).`
  );
}
const copinhaEliminationEntries = [
  { id: 0, groupId: 0 },
  { id: 1, groupId: 1 },
  { id: 2, groupId: 0 },
  { id: 3, groupId: 1 },
  { id: 4, groupId: 2 },
  { id: 5, groupId: 3 },
];
const copinhaEliminationSnapshot = JSON.stringify(copinhaEliminationEntries);
const copinhaEliminationRounds = buildCopinhaEliminationRounds(
  copinhaEliminationEntries,
  "main",
  "Eliminatória Principal",
  true
);
assert.deepEqual(
  copinhaEliminationRounds.map((round) => round.title),
  ["Preliminar", "Semifinal", "3º lugar", "Final"],
  "A sequência eliminatória compatível de seis classificadas foi alterada."
);
assert.equal(copinhaEliminationRounds[0].games.length, 2, "Seis classificadas devem produzir dois jogos preliminares.");
assert.deepEqual(
  copinhaEliminationRounds[0].games.flatMap((game) => [...game.ids1, ...game.ids2]).sort((first, second) => first - second),
  [2, 3, 4, 5],
  "A fase preliminar recebeu participantes incorretos."
);
assert.deepEqual(
  copinhaEliminationRounds[1].games.flatMap((game) => [...game.ids1, ...game.ids2]).sort((first, second) => first - second),
  [0, 1],
  "As classificadas diretas deixaram de entrar na semifinal."
);
assert.equal(JSON.stringify(copinhaEliminationEntries), copinhaEliminationSnapshot, "A construção compatível da chave não pode alterar as classificadas.");
const preliminaryEntries = [
  { id: 0, groupId: 0 },
  { id: 1, groupId: 0 },
  { id: 2, groupId: 1 },
  { id: 3, groupId: 1 },
];
const preliminaryEntriesSnapshot = JSON.stringify(preliminaryEntries);
const preliminaryPairs = getCopinhaPreliminaryPairs(preliminaryEntries);
assert.deepEqual(
  preliminaryPairs.map((pair) => pair.map((entry) => entry.id)),
  [[0, 3], [1, 2]],
  "A fase preliminar deixou de evitar adversários do mesmo grupo."
);
assert.deepEqual(
  preliminaryPairs.flat().map((entry) => entry.id).sort((first, second) => first - second),
  [0, 1, 2, 3],
  "A fase preliminar perdeu ou repetiu um participante."
);
assert.equal(JSON.stringify(preliminaryEntries), preliminaryEntriesSnapshot, "A fase preliminar não pode alterar a lista classificada.");
const constructedBracketGame = createCopinhaBracketGame({
  bracketType: "main",
  roundName: "Semifinal",
  matchKey: "main_sf_1",
  entry1: { id: 7 },
  entry2: { sourceMatchKey: "main_qf_1", sourceMode: "winner" },
  court: 2,
});
assert.deepEqual(
  constructedBracketGame,
  {
    phase: "main",
    roundName: "Semifinal",
    matchKey: "main_sf_1",
    source1: null,
    source2: "main_qf_1",
    source1Mode: null,
    source2Mode: "winner",
    ids1: [7],
    ids2: [],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court: 2,
  },
  "O cartão criado para a chave perdeu sua origem, participante ou campos iniciais."
);
const openingSlots = [
  { id: 0, groupId: 0, groupPosition: 1 },
  { id: 1, groupId: 0, groupPosition: 2 },
  { id: 2, groupId: 1, groupPosition: 1 },
  { id: 3, groupId: 1, groupPosition: 2 },
];
const openingSlotsSnapshot = JSON.stringify(openingSlots);
const arrangedOpeningSlots = avoidSameGroupOpeningMatches(openingSlots);
for (let index = 0; index < arrangedOpeningSlots.length; index += 2) {
  assert.notEqual(arrangedOpeningSlots[index].groupId, arrangedOpeningSlots[index + 1].groupId, "A primeira fase colocou participantes do mesmo grupo frente a frente.");
}
assert.deepEqual(
  arrangedOpeningSlots.map((entry) => entry.id).sort((first, second) => first - second),
  [0, 1, 2, 3],
  "A reorganização da primeira fase perdeu ou repetiu um participante."
);
assert.equal(JSON.stringify(openingSlots), openingSlotsSnapshot, "A reorganização da chave não pode alterar a lista classificada.");
const cearenseBracketEntries = [
  { id: 0, groupId: 0, groupPosition: 1, name: "A" },
  { id: 1, groupId: 1, groupPosition: 1, name: "B" },
  { id: 2, groupId: 2, groupPosition: 1, name: "C" },
  { id: 3, groupId: 0, groupPosition: 2, name: "D" },
  { id: 4, groupId: 1, groupPosition: 2, name: "E" },
];
const cearenseBracketEntriesSnapshot = JSON.stringify(cearenseBracketEntries);
const cearenseEliminationRounds = buildCearenseEliminationRounds(
  cearenseBracketEntries,
  "main",
  "Eliminatória Principal",
  true
);
assert.deepEqual(
  cearenseEliminationRounds.map((round) => round.title),
  ["Quartas de final", "Semifinal", "3º lugar", "Final"],
  "A sequência da chave principal do Campeonato Cearense foi alterada."
);
const cearenseOpeningGames = cearenseEliminationRounds[0].games;
assert.equal(cearenseOpeningGames.length, 4, "Cinco classificados devem ocupar uma chave de oito posições.");
assert.equal(cearenseOpeningGames.filter((game) => game.isBye).length, 3, "Cinco classificados devem receber exatamente três BYEs.");
assert.deepEqual(
  cearenseOpeningGames.flatMap((game) => [...game.ids1, ...game.ids2]).sort((first, second) => first - second),
  [0, 1, 2, 3, 4],
  "A distribuição dos BYEs perdeu ou repetiu um classificado."
);
assert.equal(JSON.stringify(cearenseBracketEntries), cearenseBracketEntriesSnapshot, "A construção da eliminatória não pode alterar os classificados.");
const transferredParallelEntries = [
  { id: 10, groupId: 0, name: "Transferido A" },
  { id: 11, groupId: 1, name: "Transferido B" },
];
const originalParallelEntries = [
  { id: 20, groupId: 0, name: "Paralela A" },
  { id: 21, groupId: 1, name: "Paralela B" },
  { id: 22, groupId: 2, name: "Paralela C" },
];
const transferredParallelSnapshot = JSON.stringify(transferredParallelEntries);
const originalParallelSnapshot = JSON.stringify(originalParallelEntries);
const transferredPairing = pairPlayRankingTransferredEntries(transferredParallelEntries, originalParallelEntries);
assert.equal(transferredPairing.pairs.length, 2, "Cada eliminado transferido deve receber um adversário da paralela.");
assert.ok(
  transferredPairing.pairs.every(([transferred, opponent]) => opponent && transferred.groupId !== opponent.groupId),
  "Um eliminado transferido enfrentou alguém do próprio grupo apesar de existir alternativa."
);
assert.deepEqual(transferredPairing.remainingOriginals.map((entry) => entry.id), [20], "A lista restante da paralela foi alterada.");
assert.equal(JSON.stringify(transferredParallelEntries), transferredParallelSnapshot, "O pareamento não pode alterar os eliminados transferidos.");
assert.equal(JSON.stringify(originalParallelEntries), originalParallelSnapshot, "O pareamento não pode alterar os classificados originais da paralela.");
const extendedOriginalParallelEntries = [
  ...originalParallelEntries,
  { id: 23, groupId: 3, name: "Paralela D" },
  { id: 24, groupId: 4, name: "Paralela E" },
];
const extendedOriginalParallelSnapshot = JSON.stringify(extendedOriginalParallelEntries);
const playRankingParallelRounds = buildPlayRankingParallelRounds(
  transferredParallelEntries,
  extendedOriginalParallelEntries,
  "Disputa Paralela"
);
assert.deepEqual(
  playRankingParallelRounds.map((round) => round.title),
  ["Quartas de final", "Semifinal", "Final"],
  "A sequência da paralela do Modelo Torneio 360 foi alterada."
);
const playRankingOpeningGames = playRankingParallelRounds[0].games;
assert.equal(playRankingOpeningGames.length, 4, "Sete participantes devem ocupar quatro confrontos iniciais.");
assert.equal(playRankingOpeningGames.filter((game) => game.isBye).length, 1, "Sete participantes devem produzir exatamente um BYE.");
assert.deepEqual(
  playRankingOpeningGames.flatMap((game) => [...game.ids1, ...game.ids2]).sort((first, second) => first - second),
  [10, 11, 20, 21, 22, 23, 24],
  "A paralela perdeu ou repetiu um participante na abertura."
);
assert.equal(JSON.stringify(transferredParallelEntries), transferredParallelSnapshot, "A criação da paralela não pode alterar os eliminados transferidos.");
assert.equal(JSON.stringify(extendedOriginalParallelEntries), extendedOriginalParallelSnapshot, "A criação da paralela não pode alterar seus classificados originais.");
const openingLossQualified = [
  { id: 0, name: "A", groupId: 0, w: 3, bal: 8, pts: 12, played: 3 },
  { id: 1, name: "B", groupId: 1, w: 2, bal: 4, pts: 10, played: 3 },
  { id: 2, name: "C", groupId: 2, w: 2, bal: 3, pts: 9, played: 3 },
  { id: 3, name: "D", groupId: 3, w: 1, bal: 1, pts: 8, played: 3 },
];
const openingLossRounds = [{
  title: "Semifinal",
  games: [
    { matchKey: "main_sf_1", ids1: [0], ids2: [1], isBye: false, s1: "", s2: "" },
    { matchKey: "main_sf_2", ids1: [2], ids2: [3], isBye: false, s1: "", s2: "" },
  ],
}];
const openingLossData = {
  winningScore: 4,
  brackets: [
    { matchKey: "main_sf_1", s1: "4", s2: "3" },
    { matchKey: "main_sf_2", s1: "4", s2: "1" },
  ],
};
const openingLossDataSnapshot = JSON.stringify(openingLossData);
const openingLosses = getPlayRankingOpeningLosses(openingLossData, openingLossRounds, openingLossQualified);
assert.equal(openingLosses.ready, true, "A paralela não reconheceu a conclusão da primeira fase principal.");
assert.deepEqual(openingLosses.losses.map((entry) => entry.id), [1, 3], "Os melhores perdedores da abertura foram ordenados incorretamente.");
assert.deepEqual(
  openingLosses.losses.map((entry) => [entry.openingLossMargin, entry.openingLossGames]),
  [[1, 3], [3, 1]],
  "A margem ou os games dos eliminados da abertura foram alterados."
);
assert.equal(JSON.stringify(openingLossData), openingLossDataSnapshot, "A leitura dos eliminados não pode alterar os placares salvos.");
assert.equal(
  getPlayRankingOpeningLosses(
    { ...openingLossData, brackets: openingLossData.brackets.slice(0, 1) },
    openingLossRounds,
    openingLossQualified
  ).ready,
  false,
  "A disputa paralela não pode ser liberada com um confronto inicial pendente."
);
const thirdParallelMainRounds = [
  {
    title: "Oitavas de final",
    games: [
      { matchKey: "main_r16_1", isBye: false },
      { matchKey: "main_r16_2", isBye: false },
    ],
  },
  {
    title: "Quartas de final",
    games: [
      { matchKey: "main_qf_1", isBye: false },
      { matchKey: "main_qf_2", isBye: false },
    ],
  },
  {
    title: "Semifinal",
    games: [
      { matchKey: "main_sf_1", isBye: false },
      { matchKey: "main_sf_2", isBye: false },
    ],
  },
];
const thirdParallelMainRoundsSnapshot = JSON.stringify(thirdParallelMainRounds);
const thirdParallelSources = getCearenseThirdParallelSources(thirdParallelMainRounds);
assert.deepEqual(
  thirdParallelSources.sections.map((section) => section.round.title),
  ["Quartas de final", "Oitavas de final"],
  "A 3ª disputa paralela deixou de reunir quartas e a fase anterior aplicável."
);
assert.deepEqual(
  thirdParallelSources.games.map((game) => game.matchKey),
  ["main_qf_1", "main_qf_2", "main_r16_1", "main_r16_2"],
  "As origens da 3ª disputa paralela foram alteradas."
);
const thirdParallelRounds = buildCearenseThirdParallelRounds(thirdParallelMainRounds, "3ª Disputa Paralela");
assert.deepEqual(
  thirdParallelRounds.map((round) => round.title),
  ["Semifinal", "Final"],
  "Quatro eliminados devem continuar formando semifinal e final na 3ª paralela."
);
assert.deepEqual(
  thirdParallelRounds[0].games.map((game) => [game.source1, game.source2]),
  [["main_qf_1", "main_r16_2"], ["main_qf_2", "main_r16_1"]],
  "A 3ª paralela deixou de cruzar os eliminados das duas fases."
);
assert.ok(
  thirdParallelRounds[0].games.every((game) => game.source1Mode === "loser" && game.source2Mode === "loser"),
  "A 3ª paralela deve receber somente os perdedores das fases de origem."
);
assert.equal(JSON.stringify(thirdParallelMainRounds), thirdParallelMainRoundsSnapshot, "A 3ª paralela não pode alterar a chave principal salva.");
const semifinalOnlyThirdParallel = buildCearenseThirdParallelRounds(
  [{
    title: "Semifinal",
    games: [
      { matchKey: "main_sf_1", isBye: false },
      { matchKey: "main_sf_2", isBye: false },
    ],
  }],
  "3ª Disputa Paralela"
);
assert.deepEqual(semifinalOnlyThirdParallel.map((round) => round.title), ["Final"], "Dois eliminados devem entrar diretamente na final da 3ª paralela.");
assert.deepEqual(
  [semifinalOnlyThirdParallel[0].games[0].source1, semifinalOnlyThirdParallel[0].games[0].source2],
  ["main_sf_1", "main_sf_2"],
  "A final direta da 3ª paralela perdeu seus dois eliminados."
);
const sunsetMainRounds = [
  {
    title: "3º lugar",
    games: Array.from({ length: 4 }, (_, index) => ({ matchKey: `main_third_${index + 1}`, isBye: false })),
  },
  {
    title: "Quartas de final",
    games: [
      { matchKey: "main_qf_1", isBye: false },
      { matchKey: "main_qf_2", isBye: false },
      { matchKey: "main_qf_3", isBye: false },
      { matchKey: "main_qf_4", isBye: true },
    ],
  },
];
const sunsetMainRoundsSnapshot = JSON.stringify(sunsetMainRounds);
assert.deepEqual(
  getSunsetMainSourceGames(sunsetMainRounds, 4).map((game) => game.matchKey),
  ["main_qf_1", "main_qf_2", "main_qf_3"],
  "A Copa Sunset escolheu a disputa de 3º lugar ou incluiu um BYE como origem."
);
const sunsetParallelRounds = buildSunsetParallelFromMainRound(
  sunsetMainRounds,
  4,
  "thirdParallel",
  "3ª Disputa Paralela"
);
assert.deepEqual(
  sunsetParallelRounds.map((round) => round.title),
  ["Semifinal", "Final"],
  "Três eliminados da fase principal devem formar semifinal e final na Copa Sunset."
);
assert.equal(sunsetParallelRounds[0].games.filter((game) => game.isBye).length, 1, "Três eliminados da Copa Sunset devem produzir um BYE.");
assert.deepEqual(
  sunsetParallelRounds[0].games.flatMap((game) => [game.source1, game.source2]).filter(Boolean).sort(),
  ["main_qf_1", "main_qf_2", "main_qf_3"],
  "A paralela da Copa Sunset perdeu ou repetiu uma origem."
);
assert.equal(JSON.stringify(sunsetMainRounds), sunsetMainRoundsSnapshot, "A montagem da Copa Sunset não pode alterar a chave principal salva.");
const sunsetBracketSet = {
  main: [{ title: "Final", games: [{ matchKey: "main_final_1" }] }],
  repechage: [{ title: "Final", games: [{ matchKey: "repechage_final_1" }] }],
  secondParallel: [{ title: "Final", games: [{ matchKey: "secondParallel_final_1" }] }],
  thirdParallel: [{ title: "Final", games: [{ matchKey: "thirdParallel_final_1" }] }],
};
const sunsetRunnerUpFallback = buildSunsetMainRunnerUpFallback(
  sunsetBracketSet.main,
  "2ª Disputa Paralela"
);
assert.deepEqual(
  sunsetRunnerUpFallback.map((round) => round.title),
  ["Final"],
  "Sem eliminadas das oitavas, o vice da Principal deve ocupar a 2ª disputa paralela."
);
assert.equal(sunsetRunnerUpFallback[0].games[0].source1, "main_final_1");
assert.equal(sunsetRunnerUpFallback[0].games[0].source1Mode, "loser");
assert.equal(sunsetRunnerUpFallback[0].games[0].isBye, true);
assert.deepEqual(
  buildSunsetChampionsRounds({
    ...sunsetBracketSet,
    secondParallel: sunsetRunnerUpFallback,
  }, "Etapa Sunset")[0].games.map((game) => [game.source1, game.source2]),
  [["main_final_1", "repechage_final_1"], ["secondParallel_final_1", "thirdParallel_final_1"]],
  "O vice da Principal deve completar as duas semifinais da etapa Sunset sem alterar os cruzamentos."
);
assert.deepEqual(
  getBracketChampionSource(sunsetBracketSet.main),
  { sourceMatchKey: "main_final_1", sourceMode: "winner" },
  "A campeã de uma chave da Copa Sunset perdeu sua origem."
);
assert.equal(getBracketChampionSource([{ title: "Semifinal", games: [] }]), null, "Uma chave sem final não pode produzir campeã.");
const twoSunsetChampions = buildSunsetChampionsRounds(
  { ...sunsetBracketSet, secondParallel: [], thirdParallel: [] },
  "Etapa Sunset"
);
assert.deepEqual(twoSunsetChampions.map((round) => round.title), ["Final"], "Duas campeãs devem entrar diretamente na final Sunset.");
assert.deepEqual(
  [twoSunsetChampions[0].games[0].source1, twoSunsetChampions[0].games[0].source2],
  ["main_final_1", "repechage_final_1"],
  "A final Sunset de duas campeãs perdeu suas origens."
);
const threeSunsetChampions = buildSunsetChampionsRounds(
  { ...sunsetBracketSet, thirdParallel: [] },
  "Etapa Sunset"
);
assert.deepEqual(threeSunsetChampions.map((round) => round.title), ["Semifinal", "Final"], "Três campeãs devem formar semifinal e final Sunset.");
assert.equal(threeSunsetChampions[1].games[0].source1, "main_final_1", "A campeã principal deixou de avançar diretamente na chave Sunset de três campeãs.");
const fourSunsetChampions = buildSunsetChampionsRounds(sunsetBracketSet, "Etapa Sunset");
assert.deepEqual(fourSunsetChampions.map((round) => round.title), ["Semifinal", "Final"], "Quatro campeãs devem formar duas semifinais e uma final Sunset.");
assert.deepEqual(
  fourSunsetChampions[0].games.map((game) => [game.source1, game.source2]),
  [["main_final_1", "repechage_final_1"], ["secondParallel_final_1", "thirdParallel_final_1"]],
  "Os cruzamentos entre as quatro campeãs da Copa Sunset foram alterados."
);
const threeFinishedGroupGames = [
  { ids1: [0], ids2: [1], s1: "4", s2: "2" },
  { ids1: [0], ids2: [2], s1: "1", s2: "4" },
  { ids1: [1], ids2: [2], s1: "4", s2: "3" },
];
assert.equal(getCopinhaHeadToHeadWinnerId(0, 1, threeFinishedGroupGames, 4), 0, "O confronto direto deixou de reconhecer o vencedor.");
assert.equal(getCopinhaHeadToHeadWinnerId(0, 3, threeFinishedGroupGames, 4), null, "Um confronto inexistente não pode produzir vencedor.");
const basicTiedRows = [
  { id: 0, name: "Ana", w: 1, bal: 0, pts: 6 },
  { id: 1, name: "Bia", w: 1, bal: 0, pts: 6 },
  { id: 2, name: "Carla", w: 1, bal: 0, pts: 6 },
];
assert.deepEqual(getCopinhaManualTieOrder(basicTiedRows, [2, 0, 1]), [2, 0, 1], "A ordem registrada pelo sorteio foi alterada.");
assert.equal(getCopinhaManualTieOrder(basicTiedRows, [2, 0]), null, "Uma ordem incompleta não pode resolver o empate.");
assert.equal(getCopinhaManualTieOrder(basicTiedRows, [2, 2, 0]), null, "Uma ordem duplicada não pode resolver o empate.");
const unfinishedCopinha = rankCopinhaGroupRows(basicTiedRows, threeFinishedGroupGames.slice(0, 2), 4);
assert.deepEqual(unfinishedCopinha.unresolvedTieIds, [], "Um grupo incompleto não deve solicitar sorteio.");
const tripleCopinhaTie = rankCopinhaGroupRows(basicTiedRows, threeFinishedGroupGames, 4);
assert.deepEqual(tripleCopinhaTie.unresolvedTieIds, [0, 1, 2], "Três duplas empatadas devem permanecer para sorteio.");
const resolvedTripleCopinhaTie = rankCopinhaGroupRows(basicTiedRows, threeFinishedGroupGames, 4, [2, 0, 1]);
assert.deepEqual(resolvedTripleCopinhaTie.rows.map((row) => row.id), [2, 0, 1], "O sorteio registrado não foi aplicado ao grupo.");
const twoTiedRows = [
  { id: 0, name: "Ana", w: 1, bal: 0, pts: 6 },
  { id: 1, name: "Bia", w: 1, bal: 0, pts: 6 },
  { id: 2, name: "Carla", w: 0, bal: -2, pts: 4 },
];
const directCopinhaTie = rankCopinhaGroupRows(twoTiedRows, threeFinishedGroupGames, 4);
assert.deepEqual(directCopinhaTie.rows.slice(0, 2).map((row) => row.id), [0, 1], "O confronto direto da Copinha não foi aplicado.");
assert.deepEqual(directCopinhaTie.unresolvedTieIds, [], "Um confronto direto válido não pode permanecer pendente.");
const customCriteria = { order: ["pts", "w", "bal"] };
const cearenseTie = rankCearenseGroupRows(basicTiedRows, threeFinishedGroupGames, 4, customCriteria);
assert.deepEqual(cearenseTie.unresolvedTieIds, [0, 1, 2], "O empate absoluto da regra configurável de copa deve solicitar sorteio.");
const resolvedCearenseTie = rankCearenseGroupRows(basicTiedRows, threeFinishedGroupGames, 4, customCriteria, [1, 2, 0]);
assert.deepEqual(resolvedCearenseTie.rows.map((row) => row.id), [1, 2, 0], "A ordem sorteada do empate absoluto não foi preservada.");
const playRankingTotalGamesAreStatistics = rankPlayRankingGroupRows([
  { id: 0, name: "Ana", w: 1, bal: 0, pts: 5 },
  { id: 1, name: "Bia", w: 1, bal: 0, pts: 9 },
  { id: 2, name: "Carla", w: 0, bal: -2, pts: 7 },
], threeFinishedGroupGames, 4);
assert.deepEqual(
  playRankingTotalGamesAreStatistics.rows.slice(0, 2).map((row) => row.id),
  [0, 1],
  "O Total de Games não pode superar o confronto direto no Modelo Torneio 360."
);
assert.deepEqual(
  playRankingTotalGamesAreStatistics.unresolvedTieIds,
  [],
  "Um confronto direto válido do Modelo Torneio 360 não pode permanecer pendente."
);
const playRankingCircularHeadToHead = rankPlayRankingGroupRows([
  { id: 0, name: "Ana", w: 1, bal: 0, pts: 10, coefficient: ((6 / 10) + (5 / 12)) / 2 },
  { id: 1, name: "Bia", w: 1, bal: 0, pts: 10, coefficient: ((4 / 10) + (6 / 10)) / 2 },
  { id: 2, name: "Carla", w: 1, bal: 0, pts: 11, coefficient: ((4 / 10) + (7 / 12)) / 2 },
], [
  { ids1: [0], ids2: [1], s1: "6", s2: "4" },
  { ids1: [1], ids2: [2], s1: "6", s2: "4" },
  { ids1: [2], ids2: [0], s1: "7", s2: "5" },
], 6);
assert.deepEqual(
  playRankingCircularHeadToHead.rows.map((row) => row.id),
  [0, 1, 2],
  "O confronto direto circular não avançou corretamente para o coeficiente."
);
assert.deepEqual(playRankingCircularHeadToHead.unresolvedTieIds, [], "Coeficientes diferentes não podem exigir sorteio.");
const playRankingTripleTie = rankPlayRankingGroupRows(basicTiedRows, threeFinishedGroupGames, 4);
assert.deepEqual(playRankingTripleTie.unresolvedTieIds, [0, 1, 2], "Três duplas empatadas no Modelo Torneio 360 devem seguir para sorteio.");
const resolvedPlayRankingTripleTie = rankPlayRankingGroupRows(basicTiedRows, threeFinishedGroupGames, 4, [2, 1, 0]);
assert.deepEqual(resolvedPlayRankingTripleTie.rows.map((row) => row.id), [2, 1, 0], "O sorteio do Modelo Torneio 360 não foi respeitado.");
const officialDirectTie = rankOfficialCearenseGroupRows(twoTiedRows, threeFinishedGroupGames, 4);
assert.deepEqual(officialDirectTie.rows.slice(0, 2).map((row) => row.id), [0, 1], "O confronto direto oficial entre duas duplas não foi aplicado.");
const officialTripleTie = rankOfficialCearenseGroupRows(basicTiedRows, threeFinishedGroupGames, 4);
assert.deepEqual(officialTripleTie.unresolvedTieIds, [0, 1, 2], "O empate oficial entre três duplas deve solicitar sorteio.");
function completeGroupScheduleWithLowerIdWinning(schedule) {
  return schedule.map((round) => round.map((game) => {
    const firstWins = game.ids1[0] < game.ids2[0];
    return {
      ...game,
      s1: firstWins ? "4" : "2",
      s2: firstWins ? "2" : "4",
    };
  }));
}
const playRankingSevenGroupData = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: {
    teamCount: 21,
    format: "playranking",
    playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
  },
  players: createNamedTeams(21),
  schedule: completeGroupScheduleWithLowerIdWinning(
    generateCupGroupSchedule(createNamedTeams(21), { teamCount: 21, format: "playranking" })
  ),
  brackets: [],
};
const generatedPlayRankingSevenGroupOpening = generatePlayRankingBrackets(playRankingSevenGroupData).main[0].games;
assert.equal(generatedPlayRankingSevenGroupOpening.length, 8, "A chave integrada do Modelo Torneio 360 com sete grupos deve abrir com oito posições.");
assert.deepEqual(
  generatedPlayRankingSevenGroupOpening.map((game) => game.isBye),
  [true, false, false, false, false, false, false, true],
  "A geração integrada não manteve os BYEs do Modelo Torneio 360 no topo e na base."
);
assert.equal(
  new Set(generatedPlayRankingSevenGroupOpening.flatMap((game) => [...game.ids1, ...game.ids2])).size,
  14,
  "A chave integrada do Modelo Torneio 360 perdeu ou repetiu uma dupla classificada."
);
const legacyPlayRankingSevenGroupData = {
  ...playRankingSevenGroupData,
  cupConfig: { teamCount: 21, format: "playranking", playRankingBracketVersion: 2 },
};
const legacyPlayRankingSevenGroupOpening = generatePlayRankingBrackets(legacyPlayRankingSevenGroupData).main[0].games;
const expectedLegacyPlayRankingSevenGroupOpening = buildCopinhaBracketFromPlan(
  getCearenseQualified(legacyPlayRankingSevenGroupData).main,
  "main",
  "Eliminatória Principal",
  expandBracketPlanWithVisualByes(playRankingLegacyV2MainBracketPlans[7])
)[0].games;
assert.deepEqual(
  legacyPlayRankingSevenGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  expectedLegacyPlayRankingSevenGroupOpening.map((game) => [game.ids1[0] ?? null, game.ids2[0] ?? null]),
  "A versão 2 do Modelo Torneio 360 deixou de manter sua distribuição anterior."
);
const unversionedPlayRankingSevenGroupOpening = generatePlayRankingBrackets({
  ...playRankingSevenGroupData,
  cupConfig: { teamCount: 21, format: "playranking" },
}).main[0].games;
assert.deepEqual(
  unversionedPlayRankingSevenGroupOpening.map((game) => game.isBye),
  [true, false, false, false, true, false, false, false],
  "Uma chave sem versão foi migrada silenciosamente fora do perfil retroativo autorizado."
);
const retroactivePlayers = createNamedTeams(4);
const retroactiveBaseData = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 4, format: "playranking" },
  players: retroactivePlayers,
  schedule: completeGroupScheduleWithLowerIdWinning(
    generateCupGroupSchedule(retroactivePlayers, { teamCount: 4, format: "playranking" })
  ),
  brackets: [],
};
const retroactiveGenerated = syncCupBracketScores(retroactiveBaseData);
const retroactiveScored = {
  ...retroactiveGenerated,
  brackets: retroactiveGenerated.brackets.map((game, index) => (
    index === 0 ? { ...game, s1: "4", s2: "2" } : game
  )),
};
const referenceTournament = {
  user_id: PLAY_RANKING_RETROACTIVE_PROFILE_ID,
  type: "Modelo Play Ranking",
  data: retroactiveScored,
};
assert.equal(
  shouldMigratePlayRankingBracket(referenceTournament, retroactiveScored),
  true,
  "O perfil oficial PLAY RANKING deixou de ser reconhecido pela migração retroativa."
);
const retroactiveMigration = migratePlayRankingBracketForReferenceProfile(referenceTournament, retroactiveScored);
assert.equal(retroactiveMigration.applied, true, "A migração retroativa autorizada não foi aplicada.");
assert.equal(retroactiveMigration.data.cupConfig.playRankingBracketVersion, PLAY_RANKING_BRACKET_VERSION, "A migração não registrou a versão oficial.");
assert.equal(retroactiveMigration.preservedScores, 1, "Um placar do mesmo confronto deixou de ser transportado.");
assert.equal(retroactiveMigration.pendingScores, 0, "Um confronto idêntico foi marcado indevidamente como pendente.");
assert.deepEqual(
  retroactiveMigration.data.privateData.playRankingBracketBackups[0].brackets,
  retroactiveScored.brackets,
  "A chave anterior completa não foi preservada no backup reversível."
);
const otherProfileTournament = {
  ...referenceTournament,
  user_id: "95f7aefa-d2b9-4df5-9c64-97902f4298e4",
};
const otherProfileMigration = migratePlayRankingBracketForReferenceProfile(otherProfileTournament, retroactiveScored);
assert.equal(otherProfileMigration.applied, false, "Um torneio antigo do perfil Sunset foi alterado retroativamente.");
assert.equal(otherProfileMigration.data, retroactiveScored, "A migração tocou nos dados de outro perfil.");
const otherModalityData = { ...retroactiveScored, cupConfig: { teamCount: 4, format: "cearense" } };
assert.equal(
  migratePlayRankingBracketForReferenceProfile(referenceTournament, otherModalityData).applied,
  false,
  "A migração do PLAY RANKING atingiu outra modalidade do mesmo perfil."
);
const referenceSeedTeams = createNamedTeams(15);
referenceSeedTeams.teams[3] = { a: "Cristiano Oliveira", b: "Juliana Cassundé" };
referenceSeedTeams.teams[6] = { a: "Weverton Marques", b: "Julia Pinto" };
const referenceSeedTieKey = "campeoes:1/1:9/2:0.833333333333";
const referenceSeedData = {
  cupConfig: {
    teamCount: 15,
    format: "playranking",
    playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
    campaignTieBreakOverrides: { [referenceSeedTieKey]: [6, 3] },
  },
  players: referenceSeedTeams,
  schedule: [],
  brackets: [],
};
const referenceSeedTournament = {
  id: "6d5447dc-ffb1-4adb-ac11-8a80ea37ef3c",
  user_id: PLAY_RANKING_RETROACTIVE_PROFILE_ID,
  type: "Modelo Play Ranking",
  data: referenceSeedData,
};
assert.equal(
  shouldMigratePlayRankingBracket(referenceSeedTournament, referenceSeedData),
  true,
  "O desempate histórico invertido do PLAY RANKING® deixou de ser reconhecido."
);
const referenceSeedMigration = migratePlayRankingBracketForReferenceProfile(
  referenceSeedTournament,
  referenceSeedData
);
assert.deepEqual(
  referenceSeedMigration.data.cupConfig.campaignTieBreakOverrides[referenceSeedTieKey],
  [3, 6],
  "A ordem histórica não foi corrigida para Cristiano/Juliana antes de Weverton/Julia."
);
assert.equal(
  shouldMigratePlayRankingBracket(
    { ...referenceSeedTournament, data: referenceSeedMigration.data },
    referenceSeedMigration.data
  ),
  false,
  "A correção histórica deixou de ser idempotente."
);
assert.equal(
  shouldMigratePlayRankingBracket(
    { ...referenceSeedTournament, user_id: "95f7aefa-d2b9-4df5-9c64-97902f4298e4" },
    referenceSeedData
  ),
  false,
  "A correção específica do seed atingiu um perfil diferente do PLAY RANKING®."
);
const standardGroupPlayers = createNamedTeams(6);
const standardGroupSchedule = completeGroupScheduleWithLowerIdWinning(
  generateCupGroupSchedule(standardGroupPlayers, { teamCount: 6, format: "standard" })
);
const standardGroupScheduleSnapshot = JSON.stringify(standardGroupSchedule);
const standardGroupRankings = calculateCupGroupRankings({
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 6, format: "standard" },
  players: standardGroupPlayers,
  schedule: standardGroupSchedule,
});
assert.equal(standardGroupRankings.length, 2, "A tabela padrão perdeu um dos grupos.");
assert.deepEqual(standardGroupRankings[0].rows.map((row) => row.id), [0, 1, 2], "A ordem da tabela padrão foi alterada.");
assert.deepEqual(
  standardGroupRankings[0].rows.map(({ id, w, pts, bal, played }) => ({ id, w, pts, bal, played })),
  [
    { id: 0, w: 2, pts: 8, bal: 4, played: 2 },
    { id: 1, w: 1, pts: 6, bal: 0, played: 2 },
    { id: 2, w: 0, pts: 4, bal: -4, played: 2 },
  ],
  "A soma de vitórias, games, saldo ou partidas da fase de grupos foi alterada."
);
assert.equal(standardGroupRankings[0].rankingMode, "standard", "A tabela comum perdeu seu modo de classificação.");
assert.equal(JSON.stringify(standardGroupSchedule), standardGroupScheduleSnapshot, "O cálculo do ranking não pode alterar os jogos salvos.");
const playRankingIntegrationPlayers = createNamedTeams(6);
const playRankingIntegrationSchedule = generateCupGroupSchedule(
  playRankingIntegrationPlayers,
  { teamCount: 6, format: "playranking" }
).map((round) => round.map((game) => {
  const pairKey = [...game.ids1, ...game.ids2].sort((a, b) => a - b).join(":");
  const resultByPair = {
    "0:1": { winnerId: 0, winnerScore: "4", loserScore: "2" },
    "0:2": { winnerId: 2, winnerScore: "4", loserScore: "1" },
    "1:2": { winnerId: 1, winnerScore: "4", loserScore: "3" },
  }[pairKey];
  const winnerId = resultByPair?.winnerId ?? Math.min(game.ids1[0], game.ids2[0]);
  const winnerScore = resultByPair?.winnerScore ?? "4";
  const loserScore = resultByPair?.loserScore ?? "2";
  return {
    ...game,
    s1: game.ids1[0] === winnerId ? winnerScore : loserScore,
    s2: game.ids2[0] === winnerId ? winnerScore : loserScore,
  };
}));
const playRankingIntegrationGroups = calculateCupGroupRankings({
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 6, format: "playranking" },
  players: playRankingIntegrationPlayers,
  schedule: playRankingIntegrationSchedule,
});
assert.deepEqual(
  playRankingIntegrationGroups[0].rows.map((row) => row.id),
  [2, 0, 1],
  "O Modelo Torneio 360 não aplicou saldo e confronto direto antes do Total de Games."
);
assert.deepEqual(
  playRankingIntegrationGroups[0].rows.map(({ id, pts }) => ({ id, pts })),
  [{ id: 2, pts: 7 }, { id: 0, pts: 5 }, { id: 1, pts: 6 }],
  "O Total de Games deixou de ser preservado como estatística no Modelo Torneio 360."
);
const coefficientExampleSchedule = generateCupGroupSchedule(
  playRankingIntegrationPlayers,
  { teamCount: 6, format: "playranking" }
).map((round) => round.map((game) => {
  const pairKey = [...game.ids1, ...game.ids2].sort((a, b) => a - b).join(":");
  const resultByPair = {
    "0:1": { winnerId: 0, winnerScore: "6", loserScore: "4" },
    "0:2": { winnerId: 0, winnerScore: "6", loserScore: "0" },
    "1:2": { winnerId: 1, winnerScore: "6", loserScore: "1" },
  }[pairKey];
  const winnerId = resultByPair?.winnerId ?? Math.min(game.ids1[0], game.ids2[0]);
  const winnerScore = resultByPair?.winnerScore ?? "6";
  const loserScore = resultByPair?.loserScore ?? "2";
  return {
    ...game,
    s1: game.ids1[0] === winnerId ? winnerScore : loserScore,
    s2: game.ids2[0] === winnerId ? winnerScore : loserScore,
  };
}));
const coefficientExampleRows = calculateCupGroupRankings({
  winningScore: 6,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 6, format: "playranking" },
  players: playRankingIntegrationPlayers,
  schedule: coefficientExampleSchedule,
})[0].rows;
assert.deepEqual(
  coefficientExampleRows.map(({ id, w, bal, pts }) => ({ id, w, bal, pts })),
  [
    { id: 0, w: 2, bal: 8, pts: 12 },
    { id: 1, w: 1, bal: 3, pts: 10 },
    { id: 2, w: 0, bal: -11, pts: 1 },
  ],
  "O exemplo de Game Average alterou vitórias, saldo ou Total de Games."
);
assert.ok(Math.abs(coefficientExampleRows[0].coefficient - 0.8) < 1e-12, "O coeficiente 0,800 não foi calculado pela média partida a partida.");
assert.ok(Math.abs(coefficientExampleRows[1].coefficient - 0.6285714285714286) < 1e-12, "O coeficiente 0,629 não foi calculado corretamente.");
assert.ok(Math.abs(coefficientExampleRows[2].coefficient - 0.07142857142857142) < 1e-12, "O coeficiente 0,071 não foi calculado corretamente.");
const officialGroupPlayers = createNamedTeams(7);
const officialGroupSchedule = completeGroupScheduleWithLowerIdWinning(
  generateCupGroupSchedule(officialGroupPlayers, { teamCount: 7, format: "cearense" })
);
const officialGroupData = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 7, format: "cearense" },
  players: officialGroupPlayers,
  schedule: officialGroupSchedule,
};
const officialGroupRankings = calculateCupGroupRankings(officialGroupData);
assert.deepEqual(officialGroupRankings.map((group) => group.id), [0, 1], "Um empate entre campeões não pode reordenar os grupos antes do sorteio.");
assert.ok(officialGroupRankings.every((group) => group.rankingMode === "cearense-official"), "O ranking oficial perdeu sua identificação.");
assert.ok(officialGroupRankings.every((group) => group.groupRank === undefined), "Um empate oficial pendente não pode criar ordem definitiva dos grupos.");
const officialResolvedGroupRankings = calculateCupGroupRankings({
  ...officialGroupData,
  cupConfig: {
    ...officialGroupData.cupConfig,
    campaignTieBreakOverrides: { "campeoes-saldo-ajustado:4/1": [4, 0] },
  },
});
assert.deepEqual(officialResolvedGroupRankings.map((group) => group.id), [1, 0], "O sorteio registrado não reordenou os campeões oficiais.");
assert.deepEqual(officialResolvedGroupRankings.map((group) => group.groupRank), [1, 2], "A posição definitiva dos grupos oficiais foi alterada.");
const officialQualifiedBeforeTieBreak = getOfficialCearenseQualified(officialGroupData);
assert.deepEqual(officialQualifiedBeforeTieBreak.main.map((row) => row.id), [0, 4, 1, 5], "Os dois primeiros de cada grupo deixaram de avançar à chave principal.");
assert.deepEqual(officialQualifiedBeforeTieBreak.repechage.map((row) => row.id), [2, 6, 3], "As posições abaixo do segundo lugar deixaram de ir à disputa paralela.");
assert.equal(officialQualifiedBeforeTieBreak.unresolvedCampaignTies.length, 1, "O empate oficial entre campeões deixou de solicitar sorteio.");
const officialQualifiedAfterTieBreak = getOfficialCearenseQualified({
  ...officialGroupData,
  cupConfig: {
    ...officialGroupData.cupConfig,
    campaignTieBreakOverrides: { "campeoes-saldo-ajustado:4/1": [4, 0] },
  },
});
assert.deepEqual(officialQualifiedAfterTieBreak.main.map((row) => row.id), [4, 0, 5, 1], "A ordem oficial de campeões e segundos foi alterada após o sorteio.");
assert.deepEqual(officialQualifiedAfterTieBreak.repechage.map((row) => row.id), [6, 2, 3], "A ordem oficial da disputa paralela foi alterada após o sorteio.");
assert.equal(officialQualifiedAfterTieBreak.unresolvedCampaignTies.length, 0, "O desempate oficial registrado não pode permanecer pendente.");
assert.deepEqual(
  getCearenseQualified({
    ...officialGroupData,
    cupConfig: {
      ...officialGroupData.cupConfig,
      campaignTieBreakOverrides: { "campeoes-saldo-ajustado:4/1": [4, 0] },
    },
  }),
  officialQualifiedAfterTieBreak,
  "O classificador geral deixou de encaminhar o formato oficial para sua regra própria."
);
const playRankingQualified = getCearenseQualified({
  ...officialGroupData,
  cupConfig: { teamCount: 7, format: "playranking" },
});
const playRankingGroupRankings = calculateCupGroupRankings({
  ...officialGroupData,
  cupConfig: { teamCount: 7, format: "playranking" },
});
assert.ok(playRankingGroupRankings.every((group) => group.rankingMode === "playranking"), "A regra exclusiva do Modelo Torneio 360 não foi selecionada.");
assert.deepEqual(playRankingQualified.main.map((row) => row.id), [0, 4, 1, 5], "O Modelo Torneio 360 deixou de enviar campeões e segundos à principal.");
assert.deepEqual(playRankingQualified.repechage.map((row) => row.id), [2, 3, 6], "O Modelo Torneio 360 alterou os classificados iniciais da paralela.");
assert.deepEqual(
  playRankingQualified.unresolvedCampaignTies.map((tie) => tie.scope).sort(),
  ["campeoes", "paralela"],
  "Os empates proporcionais entre grupos deixaram de ser identificados por disputa."
);
const playRankingV3BeforeDraw = getCearenseQualified({
  ...officialGroupData,
  cupConfig: {
    teamCount: 7,
    format: "playranking",
    playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
  },
});
assert.ok(
  !playRankingV3BeforeDraw.unresolvedCampaignTies.some((tie) => tie.scope === "segundos"),
  "O segundo colocado não pode receber um sorteio independente do campeão de seu grupo."
);
const playRankingV3ChampionTie = playRankingV3BeforeDraw.unresolvedCampaignTies.find((tie) => tie.scope === "campeoes");
assert.ok(playRankingV3ChampionTie, "O empate entre campeões precisa continuar solicitando sorteio.");
const reversedChampionOrder = [...playRankingV3ChampionTie.teamIds].reverse();
const playRankingV3AfterDraw = getCearenseQualified({
  ...officialGroupData,
  cupConfig: {
    teamCount: 7,
    format: "playranking",
    playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
    campaignTieBreakOverrides: {
      [playRankingV3ChampionTie.tieKey]: reversedChampionOrder,
    },
  },
});
const playRankingV3Champions = playRankingV3AfterDraw.main.filter((row) => row.groupPosition === 1);
const playRankingV3RunnersUp = playRankingV3AfterDraw.main.filter((row) => row.groupPosition === 2);
assert.deepEqual(
  playRankingV3RunnersUp.map((row) => row.groupId),
  playRankingV3Champions.map((row) => row.groupId),
  "Cada segundo colocado deve acompanhar a posição sorteada do campeão do mesmo grupo."
);
assert.deepEqual(
  playRankingV3RunnersUp.map((row) => row.groupRank),
  playRankingV3Champions.map((row) => row.groupRank),
  "Campeão e segundo colocado do mesmo grupo perderam o seed vinculado."
);
assert.ok(
  cupRankingDefaultsSource.includes('PLAY_RANKING_GROUP_CRITERIA_LABEL =')
    && cupRankingDefaultsSource.includes('"Vitórias > Saldo de games > Confronto direto > Coeficiente > Sorteio"')
    && organizerWorkspaceSource.includes('getAutomaticCupRankingLabel(editForm.type)')
    && organizerWorkspaceSource.includes('getAutomaticCupRankingLabel(category.type)')
    && !organizerWorkspaceSource.includes('{PLAY_RANKING_GROUP_CRITERIA_LABEL}')
    && tieBreakPanelsSource.includes('"playranking"')
    && tournamentFormatHelpSource.includes("O Total de Games permanece visível somente como estatística.")
    && tournamentFormatHelpSource.includes("o segundo colocado acompanha a posição do campeão do seu grupo"),
  "O Modelo Torneio 360 não explica sua regra exclusiva ou voltou a tratar Total de Games como desempate do grupo."
);
const copinhaPlayers = createNamedTeams(9);
const copinhaSchedule = completeGroupScheduleWithLowerIdWinning(
  generateCupGroupSchedule(copinhaPlayers, { teamCount: 9, format: "copinha" })
);
const copinhaData = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 9, format: "copinha" },
  players: copinhaPlayers,
  schedule: copinhaSchedule,
};
const copinhaGroupsBeforeTieBreak = getCopinhaSeededGroups(copinhaData);
assert.deepEqual(copinhaGroupsBeforeTieBreak.rankedGroups.map((group) => group.id), [0, 1, 2], "Os grupos da Copinha foram reordenados antes do sorteio.");
assert.deepEqual(copinhaGroupsBeforeTieBreak.unresolvedGroupTies, [{ tieKey: "2:4", groupIds: [0, 1, 2] }], "O empate entre campeões da Copinha deixou de ser identificado.");
const resolvedCopinhaData = {
  ...copinhaData,
  cupConfig: { ...copinhaData.cupConfig, groupTieBreakOverrides: { "2:4": [2, 1, 0] } },
};
assert.deepEqual(getCopinhaSeededGroups(resolvedCopinhaData).rankedGroups.map((group) => group.id), [2, 1, 0], "A ordem sorteada dos grupos da Copinha não foi preservada.");
const copinhaQualified = getCopinhaQualified(resolvedCopinhaData);
assert.deepEqual(copinhaQualified.main.map((row) => row.id), [6, 3, 0, 7, 4, 1], "A Copinha alterou a ordem de campeões e segundos classificados.");
assert.deepEqual(copinhaQualified.repechage.map((row) => row.id), [8, 5, 2], "A Copinha alterou a ordem da consolação.");
assert.deepEqual(getCupQualified(resolvedCopinhaData), copinhaQualified, "O classificador geral deixou de encaminhar a Copinha à regra própria.");
const standardQualificationData = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 6, format: "standard" },
  players: standardGroupPlayers,
  schedule: standardGroupSchedule,
};
const standardQualified = getCupQualified(standardQualificationData);
assert.deepEqual(standardQualified.main.map((row) => row.id), [0, 3, 1, 4], "A Copa padrão alterou os dois classificados de cada grupo.");
assert.deepEqual(standardQualified.repechage.map((row) => row.id), [2, 5], "A Copa padrão alterou os terceiros colocados.");
const cup18Players = createNamedTeams(18);
const cup18Data = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 18, format: "cup18" },
  players: cup18Players,
  schedule: completeGroupScheduleWithLowerIdWinning(generateCupGroupSchedule(cup18Players, { teamCount: 18, format: "cup18" })),
};
const cup18Qualified = getCup18Qualified(cup18Data);
assert.deepEqual(
  [cup18Qualified.main.length, cup18Qualified.repechage.length],
  [14, 4],
  "A compatibilidade da Copa de 18 deixou de classificar doze equipes diretas e dois melhores terceiros."
);
assert.equal(cup18Qualified.main.filter((row) => row.groupPosition === 3).length, 2, "A Copa de 18 deve manter somente dois terceiros na principal.");
const cup21Players = createNamedTeams(21);
const cup21Data = {
  winningScore: 4,
  rankingCriteria: "wins_points_balance",
  cupConfig: { teamCount: 21, format: "cup21" },
  players: cup21Players,
  schedule: completeGroupScheduleWithLowerIdWinning(generateCupGroupSchedule(cup21Players, { teamCount: 21, format: "cup21" })),
};
const cup21Qualified = getCup21Qualified(cup21Data);
assert.deepEqual([cup21Qualified.main.length, cup21Qualified.repechage.length], [14, 7], "A compatibilidade da Copa de 21 alterou principal ou paralela.");
assert.deepEqual(
  getCupQualified({ ...cup21Data, cupConfig: { teamCount: 21 } }),
  cup21Qualified,
  "Um torneio antigo de 21 duplas deixou de usar sua regra compatível."
);
const { calculateParallelRanking: calculateTestParallelRanking } = createCupPresentation({
  getCupPlayTimeById: () => new Map(),
});
const [parallelFinalist1, parallelFinalist2] = cup21Qualified.repechage.map((row) => row.id);
const pendingParallelFinalData = {
  ...cup21Data,
  brackets: [{
    phase: "repechage",
    roundName: "Final",
    matchKey: "repechage_final_1",
    ids1: [parallelFinalist1],
    ids2: [parallelFinalist2],
    s1: "",
    s2: "",
  }],
};
assert.deepEqual(
  calculateTestParallelRanking(pendingParallelFinalData),
  [],
  "A Disputa Paralela exibiu campeão e vice antes da conclusão da final."
);
const finishedParallelRanking = calculateTestParallelRanking({
  ...pendingParallelFinalData,
  brackets: pendingParallelFinalData.brackets.map((game) => ({ ...game, s1: "4", s2: "2" })),
});
assert.equal(finishedParallelRanking[0]?.id, parallelFinalist1, "A final concluída não liberou a campeã da Disputa Paralela.");
assert.equal(finishedParallelRanking[1]?.id, parallelFinalist2, "A final concluída não liberou a vice da Disputa Paralela.");
const roundRobinParallelGames = generateParallelRoundRobin(cup18Qualified.repechage.map((row) => row.id));
assert.deepEqual(
  calculateTestParallelRanking({ ...cup18Data, brackets: roundRobinParallelGames }),
  [],
  "A Disputa Paralela todos contra todos exibiu ranking antes de todos os jogos."
);
assert.equal(
  calculateTestParallelRanking({
    ...cup18Data,
    brackets: roundRobinParallelGames.map((game) => ({ ...game, s1: "4", s2: "2" })),
  }).length,
  4,
  "A Disputa Paralela todos contra todos não liberou o ranking após todos os jogos."
);
const proportionalCampaignTwoGames = { id: 10, name: "Ana", groupId: 0, groupPosition: 1, played: 2, w: 2, bal: 6, pts: 12 };
const proportionalCampaignThreeGames = { id: 20, name: "Bia", groupId: 1, groupPosition: 1, played: 3, w: 3, bal: 9, pts: 18 };
assert.equal(compareCearenseCampaignMetrics(proportionalCampaignTwoGames, proportionalCampaignThreeGames), 0, "Campanhas proporcionais de grupos diferentes deixaram de ser equivalentes.");
assert.equal(haveSameCearenseCampaign(proportionalCampaignTwoGames, proportionalCampaignThreeGames), true, "A equivalência proporcional entre grupos foi alterada.");
assert.ok(
  compareCearenseCampaignMetrics(
    proportionalCampaignTwoGames,
    { ...proportionalCampaignThreeGames, w: 2 }
  ) < 0,
  "A campanha com melhor percentual de vitórias deixou de vir primeiro."
);
assert.ok(
  compareCearenseCampaignMetrics(
    { ...proportionalCampaignTwoGames, coefficient: 0.8 },
    { ...proportionalCampaignTwoGames, id: 11, coefficient: 0.762 },
    { useCoefficient: true }
  ) < 0,
  "O maior coeficiente deixou de decidir campanhas com o mesmo percentual de vitórias e saldo médio."
);
assert.equal(greatestCommonDivisor(12, 18), 6, "O divisor comum usado nas chaves de empate foi alterado.");
assert.equal(getReducedRatio(-4, 6), "-2/3", "A redução de saldos negativos foi alterada.");
assert.equal(
  getCearenseCampaignTieKey("campeoes", proportionalCampaignTwoGames),
  getCearenseCampaignTieKey("campeoes", proportionalCampaignThreeGames),
  "Campanhas proporcionais deixaram de compartilhar a mesma chave de desempate."
);
const unresolvedCampaigns = rankCearenseCampaignEntries(
  [proportionalCampaignTwoGames, proportionalCampaignThreeGames],
  {},
  "campeoes"
);
assert.equal(unresolvedCampaigns.unresolvedTies.length, 1, "Um empate proporcional entre grupos deixou de solicitar sorteio.");
assert.deepEqual(unresolvedCampaigns.unresolvedTies[0].teamIds, [10, 20], "O empate entre grupos perdeu seus participantes.");
const campaignTieKey = getCearenseCampaignTieKey("campeoes", proportionalCampaignTwoGames);
const resolvedCampaigns = rankCearenseCampaignEntries(
  [proportionalCampaignTwoGames, proportionalCampaignThreeGames],
  { [campaignTieKey]: [20, 10] },
  "campeoes"
);
assert.deepEqual(resolvedCampaigns.rows.map((row) => row.id), [20, 10], "A ordem sorteada entre campanhas equivalentes não foi preservada.");
assert.equal(resolvedCampaigns.unresolvedTies.length, 0, "Um sorteio registrado não pode permanecer pendente.");
const sameGroupCampaigns = rankCearenseCampaignEntries(
  [
    { ...proportionalCampaignTwoGames, id: 30, groupPosition: 1 },
    { ...proportionalCampaignTwoGames, id: 31, name: "Carla", groupPosition: 2 },
  ],
  {},
  "paralela"
);
assert.deepEqual(sameGroupCampaigns.rows.map((row) => row.id), [30, 31], "A posição original dentro do mesmo grupo foi alterada.");
assert.equal(sameGroupCampaigns.unresolvedTies.length, 0, "Duas posições do mesmo grupo não podem abrir sorteio entre grupos.");
const officialFourTeamChampion = { bal: 6, groupSize: 4 };
const officialThreeTeamChampion = { bal: 4, groupSize: 3 };
assert.deepEqual(getOfficialCearenseAdjustedBalance(officialFourTeamChampion), { numerator: 12, denominator: 3 }, "O saldo ajustado do grupo de quatro foi alterado.");
assert.deepEqual(getOfficialCearenseAdjustedBalance(officialThreeTeamChampion), { numerator: 4, denominator: 1 }, "O saldo do grupo de três foi alterado.");
assert.equal(compareOfficialCearenseChampions(officialFourTeamChampion, officialThreeTeamChampion), 0, "Saldos oficiais equivalentes deixaram de empatar.");
assert.equal(
  getOfficialCearenseChampionTieKey(officialFourTeamChampion),
  getOfficialCearenseChampionTieKey(officialThreeTeamChampion),
  "Campeões com saldo oficial equivalente deixaram de compartilhar a chave de sorteio."
);

assert.equal(normalizeCircuitParticipantKey("B\u00e1rbara"), normalizeCircuitParticipantKey("barbara"));
assert.equal(normalizeCircuitParticipantKey("Jo\u00e3o da Silva"), normalizeCircuitParticipantKey("joao da silva"));
assert.equal(chooseCircuitParticipantDisplayName("Barbara", "B\u00e1rbara"), "B\u00e1rbara");
assert.equal(chooseCircuitParticipantDisplayName("B\u00e1rbara", "barbara"), "B\u00e1rbara");
assert.equal(
  chooseCircuitParticipantDisplayName("Jo\u00e3o Barbara", "Joao B\u00e1rbara"),
  "Jo\u00e3o B\u00e1rbara"
);
assert.equal(
  normalizeCircuitParticipantKey("B\u00e1rbara + Jo\u00e3o", true),
  normalizeCircuitParticipantKey("joao + barbara", true)
);
assert.equal(
  chooseCircuitParticipantDisplayName("Jo\u00e3o + Barbara", "B\u00e1rbara + Joao", true),
  "Jo\u00e3o + B\u00e1rbara"
);

assert.equal(prepareParticipantLineForTest("🏆 1. João da Silva"), "João da Silva");
assert.equal(prepareParticipantLineForTest("✅✅ 2️⃣ - Maria"), "Maria");
assert.equal(prepareParticipantLineForTest("• #3 Carlos + Ana"), "Carlos + Ana");
assert.equal(prepareParticipantLineForTest("👉 (4) Pedro / Beatriz"), "Pedro / Beatriz");
assert.equal(prepareParticipantLineForTest("⚽ - 5º Lucas e Carla"), "Lucas e Carla");
assert.equal(prepareParticipantLineForTest("✨ Dupla 12: Roberto & Fernanda"), "Roberto & Fernanda");
assert.equal(prepareParticipantLineForTest("Ana 💜 + João 🏆"), "Ana + João");
assert.equal(prepareParticipantLineForTest("Carlos 👨🏽‍🤝‍👨 / Beatriz 🇧🇷"), "Carlos / Beatriz");

assert.equal(getMaxScore(4), 4, "O limite do placar de quatro games foi alterado.");
assert.equal(getMaxScore(6), 7, "O limite do placar de seis games foi alterado.");
assert.equal(normalizeScoreInput("8", 6), "7", "O placar não respeita o limite da partida.");
assert.equal(normalizeScoreInput("-2", 4), "0", "O placar não deve aceitar valor negativo.");
assert.equal(getWinningScore({ winningScore: 6 }), 6, "A pontuação escolhida pelo organizador não é lida.");
assert.equal(getScoreWinnerSide({ s1: "6", s2: "4" }, 6), "team1", "O vencedor da partida não é reconhecido.");
assert.equal(getScoreWinnerSide({ s1: "4", s2: "4" }, 4), null, "O empate não pode finalizar uma partida.");
assert.equal(isGameFinished({ s1: "2", s2: "4" }, 4), true, "A partida concluída não é reconhecida.");

const normalizedRankingGroups = normalizeRankingExportGroups([
  { title: "Ranking geral", rows: [{ name: "Ana" }, { name: "Bia" }, { name: "Carla" }, { name: "Dani" }] },
  { title: "Vazio", rows: [] },
]);
assert.equal(normalizedRankingGroups.length, 1, "Grupos vazios não devem gerar páginas de ranking.");
const rankingPages = paginateRankingGroups(normalizedRankingGroups, {
  maxHeight: 192,
  rowHeight: 64,
  groupOverhead: 64,
});
assert.equal(rankingPages.length, 2, "O ranking não foi dividido conforme o espaço disponível.");
assert.equal(rankingPages[0][0].rows.length, 2, "A primeira página recebeu uma quantidade incorreta de participantes.");
assert.equal(rankingPages[1][0].title, "Ranking geral — continuação", "A continuação do ranking perdeu sua identificação.");
assert.equal(rankingPages[1][0].startIndex, 2, "A numeração da continuação do ranking foi reiniciada.");
assert.equal(defaultRankingCriteria, "wins_points_balance", "O critério padrão do ranking foi alterado.");
assert.equal(rankingCriteriaOptions.length, 6, "Alguma ordem válida dos critérios de ranking foi removida.");
assert.deepEqual(getRankingCriteria("points_balance_wins").order, ["pts", "bal", "w"], "A ordem escolhida do ranking não é respeitada.");
assert.equal(getRankingCriteria("inexistente").value, defaultRankingCriteria, "Um critério inválido não retorna ao padrão seguro.");
assert.equal(getRankingColumnLabel("pts"), "Total de Games", "A nomenclatura de Total de Games foi alterada.");
assert.equal(getRankingColumnLabel("coefficient"), "Coeficiente", "A coluna de coeficiente do Modelo Torneio 360 foi alterada.");
assert.equal(formatRankingMetricValue("coefficient", 0.6285714285714286), "0.629", "O coeficiente não é exibido com três casas decimais.");
assert.equal(formatRankingMetricValue("playTimeSeconds", 125), "00:02:05", "O tempo total em jogo não usa horas, minutos e segundos no ranking.");
assert.equal(formatMatchDuration(125), "02:05", "O cronômetro da partida deixou de usar minutos e segundos.");
assert.equal(formatMatchTotalDuration(77264), "21:27:44", "O total acumulado não usa horas, minutos e segundos.");

const scheduleRanking = calculateScheduleRanking({
  names: ["Ana", "Bia", "Carla", "Dani"],
  schedule: [[
    {
      ids1: [0, 1],
      ids2: [2, 3],
      s1: "4",
      s2: "2",
      matchTimerElapsedSeconds: 75,
    },
    { ids1: [0, 2], ids2: [1, 3], s1: "", s2: "" },
  ]],
  winningScore: 4,
  timingComplete: true,
  rankingCriteriaValue: "wins_points_balance",
});
assert.deepEqual(
  scheduleRanking.map(({ name, w, pts, bal, played, playTimeSeconds }) => ({ name, w, pts, bal, played, playTimeSeconds })),
  [
    { name: "Ana", w: 1, pts: 4, bal: 2, played: 1, playTimeSeconds: 75 },
    { name: "Bia", w: 1, pts: 4, bal: 2, played: 1, playTimeSeconds: 75 },
    { name: "Carla", w: 0, pts: 2, bal: -2, played: 1, playTimeSeconds: 75 },
    { name: "Dani", w: 0, pts: 2, bal: -2, played: 1, playTimeSeconds: 75 },
  ],
  "A soma de vitórias, games, saldo, partidas ou tempo do ranking básico foi alterada."
);
const tournamentRankingData = {
  players: ["Ana", "Bia", "Carla", "Dani"],
  schedule: [[{ ids1: [0, 1], ids2: [2, 3], s1: "4", s2: "2", matchTimerElapsedSeconds: 75 }]],
  winningScore: 4,
};
assert.deepEqual(
  calculateTournamentRanking({
    data: tournamentRankingData,
    config: { type: "super8" },
    rankingCriteriaValue: "wins_points_balance",
    timingComplete: true,
  }).map(({ name, w, pts, bal, played }) => ({ name, w, pts, bal, played })),
  scheduleRanking.map(({ name, w, pts, bal, played }) => ({ name, w, pts, bal, played })),
  "A delegação do ranking do torneio alterou o resultado matemático."
);
assert.deepEqual(
  calculateTournamentRanking({
    data: { players: { teams: [{ a: "Ana", b: "Bia" }, { a: "Carla", b: "Dani" }] }, schedule: [] },
    config: { type: "fixed12" },
  }).map((row) => row.name),
  ["Ana + Bia", "Carla + Dani"],
  "O ranking das duplas fixas perdeu a composição dos nomes."
);
assert.ok(
  tournamentRankingSource.includes("return calculateScheduleRanking({")
    && tournamentRankingSource.includes("rankingCriteriaValue,"),
  "O ranking principal não utiliza o cálculo de domínio protegido."
);
const teamGamesRanking = calculateTeamGamesRanking({
  names: ["Dupla A", "Dupla B", "Dupla sem jogo"],
  games: [
    { ids1: [0], ids2: [1], s1: "6", s2: "4" },
    { ids1: [1], ids2: [0], s1: "7", s2: "6" },
  ],
  winningScore: 6,
  rankingCriteriaValue: "wins_points_balance",
});
assert.deepEqual(
  teamGamesRanking.map(({ name, w, pts, bal, played }) => ({ name, w, pts, bal, played })),
  [
    { name: "Dupla A", w: 1, pts: 12, bal: 1, played: 2 },
    { name: "Dupla B", w: 1, pts: 11, bal: -1, played: 2 },
  ],
  "A tabela acumulada das copas mudou vitórias, games, saldo ou remoção de equipes sem partidas."
);
assert.deepEqual(
  calculateCircuitTournamentRankingRows({
    data: {
      players: { teams: [{ a: "Dupla A", b: "" }, { a: "Dupla B", b: "" }, { a: "Dupla sem jogo", b: "" }] },
      schedule: [[
        { ids1: [0], ids2: [1], s1: "6", s2: "4" },
        { ids1: [1], ids2: [0], s1: "7", s2: "6" },
      ]],
      brackets: [],
      winningScore: 6,
    },
    config: { type: "cearense" },
    rankingCriteriaValue: "wins_points_balance",
  }).map(({ name, w, pts, bal, played }) => ({ name, w, pts, bal, played })),
  teamGamesRanking.map(({ name, w, pts, bal, played }) => ({ name, w, pts, bal, played })),
  "A delegação do ranking acumulado das copas alterou os resultados."
);
assert.ok(
  tournamentRankingSource.includes("return calculateTeamGamesRanking({")
    && tournamentRankingSource.includes("names: teams.map((team) => getTeamName(team))"),
  "O ranking acumulado das copas não utiliza o cálculo de domínio protegido."
);

const requiredApplicationMarkers = [
  "supabase.auth.signInWithPassword",
  "supabase.auth.signUp",
  "supabase.auth.resetPasswordForEmail",
  'function Dashboard(',
  'function TournamentScreen(',
  'function PublicTournamentPage(',
  'function PublicPlatformHome(',
  'function PublicArenaPage(',
  'function calculateRanking(',
  'function calculateCircuitTournamentRanking(',
  'function buildPublicCircuitRankingGroups(',
  'function generateCupBrackets(',
  '.from("profiles")',
  '.from("tournaments")',
  '.from("circuits")',
  '.eq("user_id", user.id)',
  '.eq("is_public", true)',
  '?public=${publicId}',
  'panel: "inicio"',
  'panel: "ajustes"',
  'setCreateTournamentOpen(true)',
];

for (const marker of requiredApplicationMarkers) {
  assert.ok(
    [
      mainSource,
      loginScreenSource,
      publicIdentifiersSource,
      cupBracketOrchestrationSource,
      tournamentRuntimeAdaptersSource,
      publicTournamentPageControllerSource,
    ].some((source) => source.includes(marker)),
    `Fluxo essencial ausente: ${marker}`,
  );
}

assert.ok(
  matchScheduleSource.includes('const advanceScoreFocus = (side, currentInput) =>')
    && matchScheduleSource.includes('side === "team1" ? game?.s2 : game?.s1')
    && matchScheduleSource.includes('advanceScoreFocus(side, currentInput)')
    && matchScheduleSource.includes('advanceScoreFocus(side, event.currentTarget)'),
  "O preenchimento do placar deve avançar para o adversário independentemente do lado iniciado."
);

const noticeModalSource = confirmationDialogsSource.slice(
  confirmationDialogsSource.indexOf("function NoticeModal("),
  confirmationDialogsSource.indexOf("function ConfirmRegenerationModal(")
);
assert.ok(
  noticeModalSource.includes("return createPortal(")
    && noticeModalSource.includes("document.body"),
  "Os avisos devem ser renderizados acima das abas e dos cabeçalhos fixos."
);

assert.ok(
  mainSource.includes('event.target.closest("#torneio360-main-sidebar, .sidebarMobileToggle")')
    && mainSource.includes('document.addEventListener("pointerdown", closeOnOutsidePress)')
    && mainSource.includes('document.removeEventListener("pointerdown", closeOnOutsidePress)'),
  "O menu principal deve ser recolhido ao clicar ou tocar fora dele."
);

assert.ok(
  modalityPickerSource.includes("export default function ModalityPicker(")
    && modalityPickerGroups.some((group) => group.title === "Duplas fixas")
    && modalityPickerGroups.some((group) => group.title === "Ranking individual")
    && modalityPickerGroups.some((group) => group.title === "Mistas")
    && modalityPickerGroups.some((group) => group.title === "Copas e modelos")
    && modalityPickerSource.includes('placeholder="Ex.: Super 8, Copa ou Simples"')
    && mainSource.includes("<ModalityPicker value={newType}")
    && mainSource.includes("<ModalityPicker value={item.type}")
    && styleSource.includes(".modalityPickerPanel")
    && styleSource.includes(".modalityPickerItems > button.selected")
    && styleSource.includes("z-index: 22010")
    && styleSource.includes('html[data-theme="dark"] .proDashboard.playAppShell .modalityPickerTrigger')
    && styleSource.includes("top: max(10px, env(safe-area-inset-top)) !important")
    && styleSource.includes("max-height: none !important")
    && modalityPickerSource.includes('querySelector(".playTopbar")'),
  "O seletor de modalidades perdeu a busca, os grupos, a seleção lilás ou a adaptação para celular."
);

assert.ok(
  mainSource.includes('aria-label="Pesquisar torneios cadastrados"')
    && mainSource.includes('aria-label="Pesquisar circuitos cadastrados"')
    && mainSource.includes('placeholder="Ex.: nome, modalidade, categoria ou local"')
    && mainSource.includes('placeholder="Ex.: nome do circuito, torneio ou modalidade"')
    && styleSource.includes(".platformUnifiedSearch")
    && styleSource.includes(".eventListToolbar .eventListSearch")
    && styleSource.includes('.proDashboard.theme-dark .platformUnifiedSearch'),
  "As pesquisas unificadas de torneios e circuitos perderam o filtro, o padrao visual ou o tema noturno."
);

assert.ok(
  mainSource.includes('const [sidebarExpanded, setSidebarExpanded] = useState(false)')
    && mainSource.includes('className="sidebarMobileToggle"')
    && mainSource.includes('className={`sidebarBackdrop ${expanded ? "visible" : ""}`}')
    && mainSource.includes('playSidebar proSidebar ${className} ${expanded ? "isExpanded" : ""}')
    && mainSource.includes("<Menu aria-hidden=\"true\"")
    && mainSource.includes("<PlatformSidebar")
    && unifiedPlatformFrameSource.includes('className="unifiedPlatformSidebar"')
    && mainSource.includes("<PlatformTopbar")
    && !mainSource.includes('className="sidebarExpandToggle"')
    && styleSource.includes(".playSidebar.proSidebar.isExpanded")
    && !styleSource.includes(".playSidebar.proSidebar:hover")
    && styleSource.includes("@media (min-width: 1025px)")
    && styleSource.includes("button.sidebarMobileToggle")
    && styleSource.includes("padding-left: 84px !important")
    && styleSource.includes(".unifiedPlatformShell.proDashboard .playSidebar.proSidebar.unifiedPlatformSidebar")
    && styleSource.includes("translateX(-104%)")
    && styleSource.includes("@media (max-width: 1024px)")
    && styleSource.includes("button.sidebarBackdrop.visible"),
  "O menu lateral perdeu o estado compacto, a expansão flutuante ou a adaptação por toque."
);

for (const actionClass of [
  "actionCreateBtn",
  "actionConfirmBtn",
  "actionRestoreBtn",
  "actionShuffleBtn",
  "actionGenerateBtn",
  "actionOpenBtn",
]) {
  assert.ok(
    mainSource.includes(actionClass) && styleSource.includes(`button.${actionClass}`),
    `A cor semantica da acao ${actionClass} esta ausente.`
  );
}

assert.ok(
  styleSource.includes("background: var(--ui-surface-raised) !important;")
    && styleSource.includes("color: var(--ui-text-strong) !important;"),
  "A base visual dos botoes voltou a impor uma cor de acao generica."
);

assert.ok(
  mainSource.includes("ensureArenaProfileReadyForPublication")
    && mainSource.includes("Informe o nome da organização e o nome do responsável"),
  "A criação de eventos não exige o perfil público mínimo da arena."
);
assert.ok(
  arenaDirectoryRulesMigration.includes("private.promote_confirmed_organizer")
    && arenaDirectoryRulesMigration.includes("private.provision_profile_from_auth_user")
    && arenaDirectoryRulesMigration.includes("public.t360_arena_directory_visible")
    && arenaDirectoryRulesMigration.includes("profile.arena_name")
    && arenaDirectoryRulesMigration.includes("profile.name")
    && arenaDirectoryRulesMigration.includes("account.email_confirmed_at")
    && arenaDirectoryRulesMigration.includes("event_end_value::date")
    && arenaDirectoryRulesMigration.includes("circuit.end_date"),
  "A migração perdeu critérios essenciais de ativação, teste ou visibilidade pública."
);

assert.ok(
  mainSource.includes("createPublicArenaApi({ supabase })")
    && publicArenaApiSource.includes("fetchPublicArenaDirectory")
    && publicArenaApiSource.includes("list_public_arenas_page")
    && publicArenaApiSource.includes("nextCursor")
    && publicArenaApiSource.includes("ARENA_DIRECTORY_CACHE_KEY")
    && publicArenaApiSource.includes("directoryRequestInFlight")
    && publicArenaPresentationSource.includes('className="publicArenaDirectoryOrganizer"'),
  "A compatibilidade do diretório de organizações perdeu paginação ou identificação do responsável."
);
assert.ok(
  publicPlatformHomeControllerSource.includes("PublicTournamentFeedSection")
    && publicPlatformHomeControllerSource.includes("PublicExploreSection")
    && publicPlatformHomeControllerSource.includes("fetchPublicTournamentFeed")
    && publicPlatformHomeControllerSource.includes("fetchPublicArenaDirectory")
    && publicPlatformHomeControllerSource.includes("fetchPublicMemberDirectory")
    && publicPlatformHomeControllerSource.includes("embedded")
    && publicArenaPresentationSource.includes("UnifiedPlatformFrame")
    && publicArenaPresentationSource.includes("activePanel={activePanel}")
    && publicPlatformHomeControllerSource.includes("PlatformGlobalSearch")
    && publicArenaPresentationSource.includes("<GlobalSearch />")
    && publicArenaPresentationSource.includes("<TournamentFeed />")
    && !publicArenaPresentationSource.includes('<a href="#perfis">Atletas</a>')
    && !publicArenaPresentationSource.includes('<a href="#organizacoes">Organizações</a>'),
  "A visão geral pública voltou a usar uma página paralela ou diretórios fora do fluxo principal."
);
assert.ok(
  platformTrafficScalingMigrationSource.includes("profiles_public_directory_search_trgm_idx")
    && platformTrafficScalingMigrationSource.includes("create function public.list_public_arenas_page")
    && platformTrafficScalingMigrationSource.includes("p_after_sort_name")
    && platformTrafficScalingMigrationSource.includes("get_public_tournament_if_changed")
    && publicArenaApiSource.includes("refreshPublicTournamentDetail")
    && publicArenaPageControllerSource.includes("PUBLIC_TOURNAMENT_REFRESH_INTERVAL_MS")
    && publicArenaPageControllerSource.includes("PUBLIC_ARENA_BUNDLE_REFRESH_INTERVAL_MS"),
  "A proteção de tráfego perdeu índices, paginação por cursor ou atualização pública condicional."
);
assert.ok(
  publicArenaPageControllerSource.includes("PUBLIC_ARENA_LOADING_MIN_DURATION_MS = 1500")
    && publicArenaPageControllerSource.includes("EMBEDDED_ARENA_LOADING_MIN_DURATION_MS = 650")
    && publicArenaPageControllerSource.includes("EmbeddedArenaLoadingState")
    && publicArenaApiSource.includes("fetchPublicArenaBundle")
    && publicArenaApiSource.includes("PUBLIC_ARENA_REQUEST_TIMEOUT_MS")
    && publicArenaCacheSource.includes("publicArenaBundleMemoryCache")
    && publicArenaPageControllerSource.includes("readPublicArenaBundleCache")
    && publicArenaPageControllerSource.includes("onPlaying"),
  "O perfil público perdeu o carregamento profissional ou a recuperação contra falhas temporárias."
);
assert.ok(
  publicArenaPresentationSource.includes("initialVisibleItems = 8")
    && publicArenaPresentationSource.includes("publicArenaLoadMore")
    && publicArenaPresentationSource.includes('loading="lazy"')
    && styleSource.includes(".publicArenaLoadMore"),
  "O perfil público voltou a renderizar todos os eventos e imagens pesadas de uma vez."
);
assert.ok(
  publicArenaReliabilityMigration.includes("create or replace function public.get_public_arena_bundle_base")
    && publicArenaReliabilityMigration.includes("'athlete', 'visitor', 'spectator'")
    && !publicArenaReliabilityMigration.includes("'athlete', 'visitor', 'spectator', 'organizer_pending'"),
  "A listagem e a abertura do perfil público voltaram a usar regras incompatíveis."
);
assert.ok(
  publicArenaPayloadMigration.includes("t360_public_tournament_summary_data")
    && publicArenaPayloadMigration.includes("'directoryEntry', true")
    && publicArenaApiSource.includes("fetchPublicTournamentDetail")
    && publicArenaCacheSource.includes("publicTournamentDetailMemoryCache")
    && publicArenaPageControllerSource.includes("onOpenTournament={openPublicTournament}")
    && publicTournamentPageControllerSource.includes("onOpenTournament={openPublicTournament}"),
  "O perfil público voltou a baixar todos os jogos e placares antes de o visitante abrir um torneio."
);

const expectedModalityLabels = [
  "Reizinho",
  "Super 6 (dupla fixa)",
  "Super 8",
  "Super 8 (dupla fixa)",
  "Super 10 (dupla fixa)",
  "Super 12 (dupla fixa)",
  "Super 12",
  "Super 10 mista",
  "Super 12 mista",
  "Super 16 mista",
  "Super 20 mista",
  "Simples (1 contra 1 por jogo)",
  "Torneio modelo Campeonato Cearense",
  "Torneio modelo Campeonato Cearense — Individual",
  "Modelo Torneio 360",
];

for (const label of expectedModalityLabels) {
  assert.ok(Object.values(modalityDisplayNames).includes(label), `Nome de modalidade ausente: ${label}`);
}

const premiumModalities = allowedByPlan.premium;
const premiumOrder = [
  "Super 12 Mista (Dupla Fixa)",
  "Super 08",
  "Super 16 Mista (Dupla Fixa)",
  "Super 12",
  "Super 10 Mista (Dupla Aleatória)",
  "Super 12 Mista (Dupla Aleatória)",
  "Super 16 Mista (Dupla Aleatória)",
  "Super 20 Mista (Dupla Aleatória)",
  "Simples 8",
];
const premiumPositions = premiumOrder.map((type) => premiumModalities.indexOf(type));
assert.ok(premiumPositions.every((position) => position >= 0), "A lista Premium perdeu uma modalidade obrigatória.");
assert.deepEqual([...premiumPositions].sort((a, b) => a - b), premiumPositions, "A ordem das modalidades está incorreta.");
assert.ok(premiumModalities.includes("Modelo Play Ranking"), "O Modelo Play Ranking não está liberado no plano Premium.");
assert.ok(
  modalityDisplayNames["Modelo Play Ranking"] === "Modelo Torneio 360",
  "O nome público do Modelo Torneio 360 não preserva a modalidade interna existente."
);
assert.ok(
  JSON.stringify(modalityConfig["Simples 8"]?.allowedPlayerCounts) === JSON.stringify([4, 6, 8, 10, 12, 14])
    && tournamentFormatPanelsSource.includes("function SimpleConfigPanel")
    && tournamentFormatPanelsSource.includes("config.allowedPlayerCounts.map")
    && tournamentScheduleFactorySource.includes("berger(players.length)"),
  "A modalidade Simples não permite escolher as quantidades pares de 4 a 14 ou perdeu o todos contra todos."
);
assert.ok(
  tournamentFormatPanelsSource.includes("function ReizinhoConfigPanel")
    && tournamentFormatPanelsSource.includes("export default function CupConfigPanel")
    && tournamentFormatPanelsSource.includes("secondRepechageEnabled")
    && tournamentFormatPanelsSource.includes("thirdRepechageEnabled")
    && tournamentFormatPanelsSource.includes("groupFormation")
    && tournamentRuntimeAdaptersSource.includes("<CupConfigPanelView"),
  "Os painéis de formato perderam quantidades, paralelas, formação de grupos ou a composição com o torneio."
);

assert.equal(modalityConfig["Modelo Play Ranking"]?.type, "playranking", "A configuração do Modelo Play Ranking está ausente.");
assert.ok(playRankingBracketSource.includes("function getPlayRankingOpeningLosses"), "A transferência das derrotadas da primeira fase está ausente.");
assert.ok(playRankingBracketSource.includes("function buildPlayRankingParallelRounds"), "A chave paralela especial do Modelo Play Ranking está ausente.");
assert.ok(tournamentFormatHelpSource.includes("export default function TournamentFormatInfoButton"), "A explicação dinâmica dos modelos está ausente.");
assert.ok(
  cupFormatSummarySource.includes("function getCearenseFormatSummary(")
    && tournamentFormatHelpSource.includes('isSunset ? data.cupConfig?.groupFormation : "automatic"'),
  "A explicação não acompanha a quantidade, o formato individual ou a formação dos grupos escolhida."
);
assert.ok(publicTournamentScreenSource.includes("publicView />"), "A explicação do formato não está acessível ao visitante.");
assert.ok(styleSource.includes(".formatInfoDialog"), "A explicação dinâmica está sem acabamento responsivo.");

assert.ok(
  groupRankingRulesSource.includes("function rankOfficialCearenseGroupRows")
    && cearenseQualificationSource.includes("function getOfficialCearenseQualified")
    && cupBracketPlansSource.includes("export const cearenseMainBracketPlans")
    && cupBracketConstructionSource.includes("function expandBracketPlanWithVisualByes")
    && cupBracketConstructionSource.includes("isBye: Boolean(firstEntry) !== Boolean(secondEntry)")
    && cearenseThirdParallelSource.includes("function getCearenseThirdParallelSources")
    && cupFormatSummarySource.includes('from "./cearenseThirdParallel.mjs"')
    && cearenseThirdParallelSource.includes("games: [...quarterfinalGames, ...previousRoundGames]")
    && cupFormatSummarySource.includes("getNextPowerOfTwo(thirdParallelEligibleCount)")
    && cearenseThirdParallelSource.includes("sourceEntries.length === 2")
    && cearenseThirdParallelSource.includes("sourceEntries.length === 4")
    && cearenseThirdParallelSource.includes("function buildCearenseThirdParallelRounds")
    && cearenseThirdParallelSource.includes('"thirdParallel",')
    && modalityConfig["Campeonato Cearense"]?.defaultRepechageName === "Consolation"
    && modalityConfig["Campeonato Cearense"]?.defaultThirdRepechageName === "Caridade"
    && tournamentFormatHelpSource.includes('const ordinal = isSecond ? "1ª" : "2ª"')
    && cupPresentationSource.includes('phase === "thirdParallel"')
    && mainSource.includes('activeMatchesTab === "paralela3"')
    && publicTournamentScreenSource.includes('activePublicMatchesTab === "paralela3"'),
  "O Campeonato Cearense perdeu a classificação oficial, o chaveamento definido ou suas disputas paralelas."
);
assert.ok(
  styleSource.includes(".cearenseGroupRankingStack")
    && tieBreakPanelsSource.includes("melhor grupo ·"),
  "A ordem visual dos melhores grupos do Campeonato Cearense está ausente."
);

for (const removedType of ["Copa - 12 ou 24 duplas", "Copa - 21 duplas", "Copinha - grupos de 3"]) {
  assert.ok(!premiumModalities.includes(`"${removedType}"`), `A modalidade removida ainda pode ser criada: ${removedType}`);
}

assert.equal(super12IndividualTemplate.length, 11, "O Super 12 deve possuir 11 rodadas.");
const super12Partners = new Map();
const super12Opponents = new Map();
const super12PairKey = (first, second) => [first, second].sort((a, b) => a - b).join("-");

for (const round of super12IndividualTemplate) {
  assert.equal(round.length, 3, "Cada rodada do Super 12 deve usar 3 quadras.");
  assert.deepEqual(
    round.flat(2).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index + 1),
    "Todos os 12 participantes devem jogar exatamente uma vez por rodada."
  );

  for (const [firstTeam, secondTeam] of round) {
    for (const team of [firstTeam, secondTeam]) {
      const key = super12PairKey(...team);
      super12Partners.set(key, (super12Partners.get(key) || 0) + 1);
    }

    for (const first of firstTeam) {
      for (const second of secondTeam) {
        const key = super12PairKey(first, second);
        super12Opponents.set(key, (super12Opponents.get(key) || 0) + 1);
      }
    }
  }
}

for (let first = 1; first <= 12; first += 1) {
  for (let second = first + 1; second <= 12; second += 1) {
    const key = super12PairKey(first, second);
    assert.equal(super12Partners.get(key), 1, `A parceria ${key} deve acontecer uma vez.`);
    assert.equal(super12Opponents.get(key), 2, `O confronto ${key} deve acontecer duas vezes.`);
  }
}

assert.equal(modalityConfig["Super 12"]?.type, "super12", "A modalidade Super 12 individual não está cadastrada.");
assert.ok(tournamentScheduleFactorySource.includes('config.type === "super12"'), "A geração da tabela fixa do Super 12 está ausente.");

assert.deepEqual(
  reizinhoPairRounds[4],
  [
    [[1, 2], [3, 4]],
    [[1, 3], [2, 4]],
    [[1, 4], [2, 3]],
  ],
  "O Reizinho tradicional deve ter as três parcerias possíveis para quatro atletas."
);
assert.equal(buildReizinhoGames(4).length, 3, "O Reizinho de 4 atletas deve ter 3 rodadas.");
assert.equal(buildReizinhoGames(4).flat().length, 3, "O Reizinho de 4 atletas deve ter 3 partidas.");

const reizinhoSixGames = buildReizinhoGames(6);
assert.equal(reizinhoSixGames.length, 5, "O Reizinho de 6 atletas deve ter 5 rodadas.");
assert.ok(reizinhoSixGames.every((round) => round.length === 3), "Cada rodada do Reizinho de 6 atletas deve ter 3 partidas.");
assert.equal(reizinhoSixGames.flat().length, 15, "O Reizinho de 6 atletas deve ter 15 partidas.");

const reizinhoPartners = new Map();
const reizinhoOpponents = new Map();
const reizinhoGamesPerAthlete = Array(7).fill(0);
const reizinhoPairKey = (first, second) => [first, second].sort((a, b) => a - b).join("-");

for (const pairs of reizinhoPairRounds[6]) {
  assert.deepEqual(
    pairs.flat().sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
    "Cada atleta deve integrar exatamente uma dupla por rodada no Reizinho de 6."
  );
  for (const pair of pairs) {
    const key = reizinhoPairKey(...pair);
    reizinhoPartners.set(key, (reizinhoPartners.get(key) || 0) + 1);
  }
}

for (const round of reizinhoSixGames) {
  for (const [firstPair, secondPair] of round) {
    for (const athlete of [...firstPair, ...secondPair]) reizinhoGamesPerAthlete[athlete] += 1;
    for (const first of firstPair) {
      for (const second of secondPair) {
        const key = reizinhoPairKey(first, second);
        reizinhoOpponents.set(key, (reizinhoOpponents.get(key) || 0) + 1);
      }
    }
  }
}

for (let first = 1; first <= 6; first += 1) {
  assert.equal(reizinhoGamesPerAthlete[first], 10, `O atleta ${first} deve jogar 10 partidas no Reizinho de 6.`);
  for (let second = first + 1; second <= 6; second += 1) {
    const key = reizinhoPairKey(first, second);
    assert.equal(reizinhoPartners.get(key), 1, `A parceria ${key} deve ocorrer exatamente uma vez no Reizinho de 6.`);
    assert.equal(reizinhoOpponents.get(key), 4, `Os atletas ${key} devem se enfrentar exatamente quatro vezes no Reizinho de 6.`);
  }
}

assert.ok(
  modalityConfig["Campeonato Cearense Individual"]?.type === "cearenseIndividual"
    && modalityConfig["Campeonato Cearense Individual"]?.cupMode === "cearense-individual"
    && modalityConfig["Campeonato Cearense Individual"]?.individualCup === true
    && mainSource.includes('isIndividualCupType(config)'),
  "O Campeonato Cearense Individual perdeu a configuração de partidas um contra um."
);
assert.ok(
  confirmationDialogsSource.includes("function ConfirmModalityChangeModal")
    && confirmationDialogsSource.includes("function ConfirmEventGroupModalityChangeModal")
    && mainSource.includes("const modalityChanged = editForm.type !== editTarget.type")
    && mainSource.includes("createInitialData(editForm.type, nextModalityConfig)")
    && mainSource.includes("const [editTournamentSaving, setEditTournamentSaving] = useState(false)")
    && mainSource.includes('editTournamentSaving ? "Salvando..."')
    && confirmationDialogsSource.includes('A mudança pode alterar participantes, rodadas e placares da competição.')
    && confirmationDialogsSource.includes('busy ? "Salvando..." : "Confirmar alteração"')
    && confirmationDialogsSource.includes("compactModalityChangeConfirmBox")
    && mainSource.includes("confirmModalityChanges: true")
    && mainSource.includes("confirmModalityChange: true"),
  "A edição segura da modalidade de um torneio existente está ausente."
);

const singleTournamentEditStart = mainSource.indexOf("async function saveEditedTournament");
const singleTournamentEditEnd = mainSource.indexOf("async function openEditEventGroup", singleTournamentEditStart);
const singleTournamentEditSource = mainSource.slice(singleTournamentEditStart, singleTournamentEditEnd);
assert.ok(
  singleTournamentEditStart >= 0
    && singleTournamentEditEnd > singleTournamentEditStart
    && singleTournamentEditSource.includes('showNotice("success", "Torneio atualizado"')
    && singleTournamentEditSource.includes("displayOrder: editTarget.data.displayOrder")
    && singleTournamentEditSource.includes("displayOrderMode: editTarget.data.displayOrderMode")
    && singleTournamentEditSource.includes("setEditTarget(null)")
    && singleTournamentEditSource.includes("setEditForm(null)")
    && singleTournamentEditSource.indexOf("setEditTournamentSaving(true)") < singleTournamentEditSource.indexOf("setEditTarget(null)")
    && singleTournamentEditSource.includes("const replacedTournaments = currentTournaments.map")
    && singleTournamentEditSource.includes("catch (localStateError)")
    && singleTournamentEditSource.indexOf("if (!saveResult?.ok)") < singleTournamentEditSource.indexOf("const replacedTournaments")
    && singleTournamentEditSource.indexOf('showNotice("success", "Torneio atualizado"') > singleTournamentEditSource.indexOf("setEditTarget(null)")
    && singleTournamentEditSource.includes('"Torneio não atualizado"')
    && singleTournamentEditSource.includes("O formulário foi mantido para você tentar novamente.")
    && singleTournamentEditSource.includes("setModalityChangeConfirmation(null)")
    && !singleTournamentEditSource.includes("closeEditorOnSubmit")
    && !singleTournamentEditSource.includes("persistTournamentOrderSequence("),
  "A edição individual deve permanecer visível durante o salvamento e informar todos os resultados ao organizador."
);
assert.ok(
  confirmationDialogsSource.includes('className="confirmOverlay noticeOverlay"')
    && confirmationDialogsSource.includes('aria-live="assertive"')
    && styleSource.includes(".noticeOverlay")
    && styleSource.includes("z-index: 120000 !important"),
  "As notificações globais precisam aparecer acima do editor que iniciou a ação."
);

const createTournamentStart = mainSource.indexOf("async function createTournament()");
const createTournamentEnd = mainSource.indexOf("async function confirmDeleteTournament()", createTournamentStart);
const createTournamentSource = mainSource.slice(createTournamentStart, createTournamentEnd);
assert.ok(
  createTournamentStart >= 0
    && createTournamentEnd > createTournamentStart
    && createTournamentSource.includes("const confirmedCreatedTournaments")
    && createTournamentSource.includes("catch (localProjectionError)")
    && createTournamentSource.includes("setCreateTournamentOpen(false)")
    && createTournamentSource.includes('showNotice("success", isMultiCategory ? "Torneios criados" : "Torneio criado"')
    && createTournamentSource.includes('selectedTournamentId: null')
    && createTournamentSource.includes('document.getElementById("historico-torneios")')
    && createTournamentSource.includes("setTournamentStatusFilter(getTournamentLifecycleStatus(confirmedCreatedTournaments[0]))")
    && !createTournamentSource.includes("setSelected(firstCreatedTournament)")
    && createTournamentSource.indexOf("if (creationError)") < createTournamentSource.indexOf("setCreateTournamentOpen(false)"),
  "Após a criação confirmada, o editor deve fechar, a lista deve aparecer e a confirmação visual deve ser exibida."
);
assert.equal(
  stableJsonStringify({ rodada: 1, placares: { b: 2, a: 4 } }),
  stableJsonStringify({ placares: { a: 4, b: 2 }, rodada: 1 }),
  "A confirmação da gravação deve ignorar apenas a ordem das chaves do JSON retornado pelo banco."
);
assert.equal(
  tournamentSnapshotMatches(
    { id: "torneio-1", name: "Etapa", type: "Super 8", data: { placares: { b: 2, a: 4 } } },
    { id: "torneio-1", name: "Etapa", type: "Super 8", data: { placares: { a: 4, b: 2 } } }
  ),
  true,
  "A gravação já concluída no servidor deve ser reconhecida mesmo após uma resposta ambígua."
);
assert.equal(
  tournamentSnapshotMatches(
    { id: "torneio-1", name: "Etapa", type: "Super 8", data: { placares: { jogo: 4 } } },
    { id: "torneio-1", name: "Etapa", type: "Super 8", data: { placares: { jogo: 3 } } }
  ),
  false,
  "A confirmação nunca pode aceitar como salva uma versão com placares diferentes."
);
assert.equal(
  tournamentMutationWasApplied(
    { id: "torneio-1", last_change_id: "87d4755c-4588-422b-83f7-a4bf19df064c" },
    "87d4755c-4588-422b-83f7-a4bf19df064c"
  ),
  true,
  "Uma resposta demorada deve ser confirmada pelo identificador exclusivo da mutação salva."
);
assert.equal(
  tournamentMutationWasApplied(
    { id: "torneio-1", last_change_id: "alteracao-anterior" },
    "alteracao-atual"
  ),
  false,
  "A confirmação não pode aceitar o identificador de outra alteração."
);
assert.ok(
  mainSource.includes("async function confirmTournamentSnapshotOnServer")
    && mainSource.includes("confirmedAfterAmbiguousResponse: true")
    && mainSource.includes('const confirmationColumns = "*"')
    && mainSource.includes("if (tournamentSnapshotMatches(data, updated, persistedData))")
    && !mainSource.includes("if (!updated.changeId && tournamentSnapshotMatches(data, updated, persistedData))")
    && singleTournamentEditSource.includes("const editChangeId = generateCollaborationChangeId()")
    && singleTournamentEditSource.includes("changeId: editChangeId")
    && mainSource.includes('.select("id,user_id,name,type,status,created_at,updated_at,revision,last_change_id")')
    && mainSource.includes(".abortSignal(signal)")
    && mainSource.includes("async function executeTournamentRequest")
    && mainSource.includes("A resposta da gravação falhou, mas o torneio foi confirmado no servidor."),
  "A edição precisa limitar a espera e confirmar no servidor antes de exibir um erro de gravação."
);
assert.ok(
  styleSource.includes("z-index: 22010")
    && styleSource.includes("z-index: 22000"),
  "O seletor de modalidades precisa permanecer acima do modal de edição."
);

assert.deepEqual(
  orderFixedMixedPair("Ana Beatriz", "João Pedro"),
  ["João Pedro", "Ana Beatriz"],
  "A importação deve colocar o homem no primeiro campo da dupla mista fixa."
);
assert.deepEqual(
  orderFixedMixedPair("Marcos", "Carla"),
  ["Marcos", "Carla"],
  "A importação deve manter uma dupla mista que já esteja na ordem correta."
);
assert.deepEqual(
  orderFixedMixedPair("Raquel", "Wadson"),
  ["Wadson", "Raquel"],
  "A importação deve reconhecer nomes que não terminam em A ou O."
);
assert.deepEqual(
  orderFixedMixedPair("Ana", "Carla"),
  ["Ana", "Carla"],
  "Duas mulheres devem permanecer na ordem em que foram coladas."
);
assert.deepEqual(
  orderFixedMixedPair("João", "Marcos"),
  ["João", "Marcos"],
  "Dois homens devem permanecer na ordem em que foram colados."
);
assert.deepEqual(
  orderFixedMixedPair("Gaivola", "Junior"),
  ["Gaivola", "Junior"],
  "Um nome desconhecido não deve ser reorganizado por suposição."
);
assert.deepEqual(
  orderFixedMixedPair("Maria", "Carlo"),
  ["Carlo", "Maria"],
  "Uma mulher seguida de um homem reconhecido deve ser invertida."
);
assert.deepEqual(
  orderFixedMixedPair("Giovana", "Junior"),
  ["Junior", "Giovana"],
  "A ordem da linha colada deve preencher o homem antes da mulher."
);
assert.ok(
  !participantManagementSource.includes("orderFixedMixedPair")
    && participantManagementSource.includes("o parceiro receberá automaticamente a categoria oposta")
    && participantManagementSource.includes("orderConfirmedMixedTeams"),
  "O importador misto deve vincular os gêneros da dupla e colocar o homem na primeira posição."
);
assert.deepEqual(
  orderConfirmedMixedTeams(
    [{ a: "Ana", b: "Mario" }, { a: "Carlos", b: "Junia" }],
    {
      ana: { name: "Ana", gender: "feminino", confirmed: true },
      mario: { name: "Mario", gender: "masculino", confirmed: true },
      carlos: { name: "Carlos", gender: "masculino", confirmed: true },
      junia: { name: "Junia", gender: "feminino", confirmed: true },
    }
  ),
  [{ a: "Mario", b: "Ana" }, { a: "Carlos", b: "Junia" }],
  "Duplas fixas mistas confirmadas devem salvar o homem primeiro e a mulher depois."
);
assert.equal(
  inferTournamentGenderMode({ participantGenderMode: "mista" }),
  tournamentGenderModes.mixed,
  "O gênero estruturado do torneio deve reconhecer a opção Mista."
);
assert.equal(
  inferTournamentGenderMode({ gender: "Masculino iniciante" }),
  tournamentGenderModes.masculine,
  "Torneios antigos devem continuar reconhecendo gênero no campo legado."
);
assert.equal(getTournamentGenderLabel(tournamentGenderModes.open), "Livre");
assert.equal(
  getOppositeParticipantGender(participantGenderValues.masculine),
  participantGenderValues.feminine,
  "Uma confirmação masculina em dupla mista deve definir a parceira como feminina."
);
assert.ok(
  mainSource.includes("Categoria")
    && mainSource.includes("TournamentGenderSelector")
    && mainSource.includes("participantGenderMode"),
  "Criação e edição devem separar Categoria da escolha estruturada de Gênero."
);
const tournamentGenderSelectorSource = readFileSync(
  new URL("src/features/tournamentConfig/TournamentGenderSelector.jsx", root),
  "utf8"
);
assert.ok(
  tournamentGenderSelectorSource.includes('<option value="" disabled>Escolha a composição</option>')
    && tournamentGenderSelectorSource.includes("required={!fixedByModality}"),
  "A criação deve iniciar sem gênero selecionado e exigir uma escolha do organizador."
);
assert.equal(BRAZILIAN_STATES.length, 27, "O formulário deve oferecer todos os estados brasileiros e o Distrito Federal.");
assert.equal(normalizeBrazilianState("Ceará"), "CE");
assert.equal(normalizeBrazilianState("sp"), "SP");
assert.ok(
  mainSource.includes("profileUsesForeignState")
    && mainSource.includes("Estado estrangeiro")
    && mainSource.includes("Digite o estado, província ou região")
    && mainSource.includes("onReconcileOwnProfile={reconcileOwnProfile}")
    && !mainSource.includes("profileSaveConfirmationOpen")
    && mainSource.includes('"Alterações salvas"'),
  "O perfil deve confirmar o salvamento em primeiro plano e permitir estado estrangeiro manual."
);
assert.ok(
  mainSource.includes("<label>Organização</label>")
    && mainSource.includes('placeholder="Nome da sua organização"')
    && mainSource.includes("Selecione o estado")
    && mainSource.includes("Selecione a cidade")
    && mainSource.includes('"Alterações salvas"')
    && mainSource.includes("O perfil da sua organização foi atualizado com sucesso."),
  "O perfil deve usar Organização, seleção Estado/Cidade e confirmação explícita de salvamento."
);
const confirmedGenderRegistry = setParticipantGender({}, "Bárbara Souza", participantGenderValues.feminine);
assert.equal(
  getParticipantGender(confirmedGenderRegistry, "Barbara Souza", { confirmedOnly: true }),
  participantGenderValues.feminine,
  "A confirmação de gênero deve reconhecer o mesmo nome com ou sem acento."
);
assert.deepEqual(
  setParticipantGender(confirmedGenderRegistry, "Barbara Souza", participantGenderValues.unknown),
  {},
  "Não informar o gênero não deve persistir uma classificação definitiva."
);
const bulkGenderRegistry = setParticipantGenders({}, [
  { name: "João Lima", gender: participantGenderValues.masculine },
  { name: "Maria Lima", gender: participantGenderValues.feminine },
]);
assert.equal(
  Object.keys(bulkGenderRegistry).length,
  2,
  "A confirmação em lote deve salvar todos os gêneros sem reconstruir o cadastro a cada atleta."
);
const circuitHistoryGenderCandidates = mergeTournamentGenderCandidates(
  [{
    id: "tournament-1",
    name: "Etapa atual",
    type: "super8",
    data: { players: ["Ana Souza"] },
  }],
  { super8: { type: "super8" } },
  {
    rankingRecords: {
      first: { tournamentId: "tournament-1", name: "Ana Souza", groupKey: "feminino" },
      second: { tournamentId: "old-tournament", name: "Raul Soares", groupKey: "geral" },
    },
  }
);
assert.deepEqual(
  circuitHistoryGenderCandidates.map((candidate) => candidate.name),
  ["Ana Souza", "Raul Soares"],
  "A confirmação de gênero deve incluir atletas preservados somente no histórico do circuito."
);
assert.equal(
  circuitHistoryGenderCandidates.find((candidate) => candidate.name === "Ana Souza")?.suggestion,
  participantGenderValues.feminine,
  "O histórico não pode duplicar um atleta e deve preservar uma sugestão de gênero conhecida."
);
assert.equal(
  circuitHistoryGenderCandidates.find((candidate) => candidate.name === "Raul Soares")?.tournaments?.[0],
  "Histórico do circuito",
  "Atletas de etapas antigas precisam continuar disponíveis para edição do gênero."
);

assert.equal(super20MixedTemplate.length, 10, "O Super 20 mista deve possuir 10 rodadas.");
const super20Partners = new Set();
const super20Opponents = new Map();

for (const round of super20MixedTemplate) {
  assert.equal(round.length, 5, "Cada rodada do Super 20 mista deve usar 5 quadras.");
  assert.deepEqual(
    round.flat().sort((a, b) => a - b),
    Array.from({ length: 20 }, (_, index) => index + 1),
    "Todos os 20 participantes devem jogar exatamente uma vez por rodada."
  );

  for (const [firstMan, firstWoman, secondMan, secondWoman] of round) {
    assert.ok(firstMan <= 10 && secondMan <= 10, "Cada dupla deve possuir um homem.");
    assert.ok(firstWoman > 10 && secondWoman > 10, "Cada dupla deve possuir uma mulher.");

    for (const [man, woman] of [[firstMan, firstWoman], [secondMan, secondWoman]]) {
      const partnership = `${man}-${woman}`;
      assert.ok(!super20Partners.has(partnership), `A parceria ${partnership} não pode se repetir.`);
      super20Partners.add(partnership);
    }

    for (const [first, second] of [
      [firstMan, secondMan],
      [firstWoman, secondWoman],
      [firstMan, secondWoman],
      [secondMan, firstWoman],
    ]) {
      const opponentKey = super12PairKey(first, second);
      super20Opponents.set(opponentKey, (super20Opponents.get(opponentKey) || 0) + 1);
    }
  }
}

assert.equal(super20Partners.size, 100, "Cada homem deve formar dupla uma vez com cada mulher.");
assert.ok(
  [...super20Opponents.values()].every((count) => count <= 2),
  "Nenhum adversário deve ser repetido mais de duas vezes no Super 20 mista."
);
assert.equal(modalityConfig["Super 20 Mista (Dupla Aleatória)"]?.type, "mixed20", "A modalidade Super 20 mista não está cadastrada.");
assert.ok(tournamentScheduleFactorySource.includes('config.type === "mixed20"'), "A tabela fixa do Super 20 mista não está ligada ao gerador.");

assert.deepEqual(normalizeCourtNumbers(["Quadra 8", "", "12"], 3), ["8", "2", "12"], "Os números personalizados das quadras não são normalizados.");
assert.deepEqual(createDefaultCourtNumbers(3), ["1", "2", "3"], "A sequência padrão das quadras foi alterada.");
assert.equal(normalizeCourtNumberValue("Quadra 0007"), "7", "O número visível da quadra não é normalizado.");
assert.equal(getGameCourtNumber({ court: 2 }, ["4", "8"]), "8", "A exibição das quadras não possui uma fonte numérica única e segura.");
assert.equal(getGameCourtLabel({ court: 2 }, ["4", "8"]), "Quadra 8", "A palavra Quadra não permanece fixa na apresentação.");
assert.equal(getGameCourtLabel({ court: 2, courtAssignmentPending: true }, ["4", "8"]), "Aguardando quadra", "Jogos excedentes ainda inventam um número de quadra.");
const courtOverrideGame = { court: 1, courtLabelOverride: "Quadra 3" };
applyCourtNumberToGame(courtOverrideGame, "Quadra 9", ["1"]);
assert.deepEqual(courtOverrideGame, { court: 1, courtNumberOverride: "9" }, "A troca rápida não preserva somente o número escolhido.");
const courtReturningToOriginalNumber = { court: 1, courtNumberOverride: "2" };
applyCourtNumberToGame(courtReturningToOriginalNumber, "1", ["1"]);
assert.deepEqual(
  courtReturningToOriginalNumber,
  { court: 1, courtNumberOverride: "1" },
  "Voltar ao número estrutural da quadra apagou a escolha operacional do jogo."
);
assert.ok(tournamentDataNormalizationSource.includes('courtNumbers: createDefaultCourtNumbers'), "Novos torneios não recebem os números padrão das quadras.");
const configuredCourtPool = buildAutomaticCourtPool({
  configured: true,
  centralCourtNumbers: ["4", "7", "9"],
  preferredCourtNumbers: ["7", "4"],
  unavailableCourtNumbers: ["9"],
  fallbackCount: 6,
});
assert.deepEqual(configuredCourtPool, ["7", "4"], "A Central não é a fonte exclusiva das quadras configuradas.");
assert.deepEqual(
  buildAutomaticCourtPool({ configured: false, fallbackCount: 3 }),
  ["1", "2", "3"],
  "Sem configuração na Central, o sistema não adota mais a sequência 1, 2, 3."
);
const waitingCourtSchedule = assignScheduleCourtNumbers([[
  { court: 1, s1: "", s2: "" },
  { court: 2, s1: "", s2: "" },
  { court: 3, s1: "", s2: "" },
]], ["4", "7"], 4);
assert.deepEqual(
  waitingCourtSchedule[0].map((game) => getGameCourtLabel(game, ["4", "7"])),
  ["Quadra 4", "Quadra 7", "Aguardando quadra"],
  "Jogos além da capacidade ainda recebem números inexistentes."
);
const releasedCourtSchedule = assignScheduleCourtNumbers([[
  { court: 1, courtNumberOverride: "4", s1: "4", s2: "1" },
  { court: 2, s1: "", s2: "" },
  { court: 3, s1: "", s2: "" },
]], ["4", "7"], 4);
assert.deepEqual(
  releasedCourtSchedule[0].map((game) => getGameCourtLabel(game, ["4", "7"])),
  ["Quadra 4", "Quadra 7", "Quadra 4"],
  "A quadra finalizada não é reaproveitada automaticamente pelo próximo jogo da fila."
);
assert.ok(!mainSource.includes("onEditCourt={requestCourtAssignment}"), "A escolha de quadra ainda aparece dentro do torneio.");
assert.ok(!matchScheduleSource.includes("onEditCourt"), "O cartão de jogo ainda oferece edição de quadra.");
assert.ok(courtCenterModalSource.includes("já está cadastrada neste local"), "A Central não explica quando um número está repetido.");
assert.ok(courtCenterModalSource.includes("courtCenterNumberMessage"), "A Central não apresenta confirmação ou erro ao editar o número.");
assert.ok(speechAnnouncementsSource.includes("getGameCourtLabel(game, courtNumbers)"), "A chamada por voz não usa o número visível da quadra.");
assert.ok(styleSource.includes("QUADRAS PERSONALIZADAS — AGOSTO 2026"), "O acabamento visual das quadras personalizadas está ausente.");
assert.ok(styleSource.includes(".courtNameBadge"), "O selo visual da quadra está ausente.");
assert.ok(styleSource.includes(".courtEditorSheet"), "O editor responsivo de quadras está sem estilo.");
assert.ok(
  styleSource.includes(".courtEditorColumns")
    && styleSource.includes(".courtEditorColumn.free")
    && styleSource.includes(".courtEditorColumn.occupied")
    && styleSource.includes("button.courtEditorOption.free")
    && styleSource.includes("button.courtEditorOption.occupied")
    && styleSource.includes(".courtEditorConfirmation"),
  "O editor de quadras não mantém as colunas e confirmações semânticas."
);
assert.ok(
  styleSource.includes('html[data-theme="dark"] .courtEditorCurrent')
    && styleSource.includes("--court-free-surface: #102d25")
    && styleSource.includes("--court-busy-surface: #332116"),
  "O seletor de quadras não possui acabamento explícito no tema escuro."
);
assert.ok(styleSource.includes(".courtDuplicateModal"), "O aviso de quadra repetida está sem apresentação visual.");

assert.ok(indexSource.includes('src/main.jsx'), "A entrada React não está ligada ao index.html.");
assert.ok(indexSource.includes('torneio360-favicon-96.png'), "O novo favicon do Torneio360 não está configurado.");
assert.ok(indexSource.includes('manifest.webmanifest'), "O manifesto instalável não está ligado ao site.");
assert.ok(indexSource.includes('torneio360-apple-touch-icon.png'), "O ícone para atalhos Apple não está configurado.");
assert.equal(manifest.display, "standalone", "O atalho não está configurado para abrir como app.");
assert.ok(installSource.includes('beforeinstallprompt'), "O convite de instalação não captura o evento do navegador.");
assert.ok(installSource.includes('appinstalled'), "A confirmação de instalação não está sendo monitorada.");
assert.ok(installSource.includes('Instalar agora'), "O botão não oferece a instalação nativa quando ela está disponível.");
assert.ok(installSource.includes('Abrir no Chrome'), "O Android não possui alternativa para navegadores internos.");
assert.ok(!installSource.includes('Já instalei'), "O Android ainda pode ocultar o aviso sem concluir a instalação.");
assert.ok(installSource.includes('torneio360_app_installed_v3'), "A mensagem corrigida não será reexibida para testes anteriores.");
assert.ok(installSource.includes('Instalação em andamento...'), "A instalação lenta não possui retorno visual para o usuário.");
assert.ok(installSource.includes('INSTALL_RECOVERY_DELAY_MS = 10 * 60 * 1000'), "A ajuda de instalação reaparece cedo demais.");
assert.ok(
  !installSource.includes('if (outcome === "accepted") confirmManualInstallation()'),
  "O aceite do prompt ainda oculta a mensagem antes da confirmação real do navegador."
);
assert.ok(
  loginScreenSource.includes('document.getElementById("acesso")?.scrollIntoView({ behavior: "auto", block: "start" })'),
  "A recuperação de senha não leva o usuário diretamente ao formulário de nova senha."
);
assert.ok(
  publicArenaApiSource.includes('.rpc("get_public_tournament", { p_public_id: normalizedPublicId })'),
  "O link público voltou a consultar uma tabela protegida em vez da função segura."
);
assert.ok(
  publicArenaApiSource.includes('.rpc("get_public_arena_bundle",'),
  "O perfil público não consulta o pacote seguro e atualizado da arena."
);
assert.ok(rankingTablesSource.includes('title="Ranking do dia"'), "O ranking do torneio não usa o título Ranking do dia.");
assert.ok(
  cupPodiumSource.includes("export default function CupPodiumView")
    && cupPodiumSource.includes('presentation: "podium"')
    && cupPodiumSource.includes('variant === "parallel" ? 1 : 3'),
  "A apresentação do pódio das Copas perdeu a principal ou o campeão das disputas paralelas."
);
assert.ok(publicCircuitScreenSource.includes('placementMode ? "Ranking geral por pontos" : "Ranking geral acumulado"'), "O ranking público do circuito não identifica corretamente o modelo escolhido.");
assert.ok(
  publicCircuitScreenSource.includes("remotePagination={getRemotePagination")
    && publicCircuitScreenSource.includes("loadFullConfig: async () =>")
    && rankingTablesSource.includes("p.rankPosition || p.rank_position")
    && rankingTablesSource.includes("onClick={remotePagination.onLoadMore}")
    && rankingShareButtonSource.includes('typeof config.loadFullConfig === "function"')
    && rankingShareButtonSource.includes("downloadRankingWorkbook(activeConfig)"),
  "O ranking público do circuito perdeu paginação no servidor, posição global ou exportação completa sob demanda."
);
assert.ok(
  !circuitRankingSettingsPanelSource.includes("function CircuitTournamentFormatSelector")
    && !mainSource.includes("getCircuitCompatibleTournaments")
    && publicCircuitScreenSource.includes("Torneios do circuito")
    && circuitRankingSettingsPanelSource.includes("Todas as modalidades podem participar do mesmo circuito"),
  "O circuito ainda restringe a mistura de modalidades ou não explica o cálculo automático de cada etapa."
);
assert.ok(
  circuitRankingSettingsSource.includes("const defaultCircuitPositionPoints = [1000, 800, 670, 500, 400, 330, 250, 200, 170, 140]")
    && circuitRankingSettingsSource.includes("defaultCircuitOtherPositionPoints")
    && circuitPlacementSource.includes("normalizedSettings.points.otherPositions")
    && circuitRankingSettingsPanelSource.includes("Outras colocações"),
  "A pontuação por classificação final não limita os campos individuais ao 10º lugar ou não pontua as demais colocações."
);
assert.ok(
  circuitRankingSettingsSource.includes("circuitTieBreakOrderOptions")
    && getCircuitTieBreakLabel({ mode: "placement" }) === "Pontos → Vitórias → Total de Games → Saldo de games → Sorteio"
    && getCircuitTieBreakLabel({ mode: "performance", tieBreakOrder: ["balance", "totalGames", "wins"] }) === "Saldo de games → Total de Games → Vitórias → Sorteio",
  "O ranking do circuito não mantém a ordem fixa com pontos ou a escolha livre sem pontuação."
);
assert.ok(
  circuitRankingSettingsPanelSource.includes("Pontuação por classificação final")
    && circuitRankingSettingsPanelSource.includes("Pontuação por fases alcançadas")
    && circuitRankingSettingsPanelSource.includes("Disputas paralelas")
    && circuitRankingSettingsPanelSource.includes("Nenhuma disputa paralela concede pontos"),
  "As duas tabelas de pontos ou a exclusão das disputas paralelas estão incompletas."
);
assert.ok(
  circuitRankingSettingsPanelSource.includes('className="circuitChoiceCheck"')
    && styleSource.includes(".circuitChoiceCheck")
    && styleSource.includes("var(--ui-surface-raised)"),
  "Os cartões de escolha não seguem a seleção com quadradinho, lilás e contraste nos dois temas."
);
assert.ok(publicArenaPageControllerSource.includes('tournaments={Array.isArray(selectedCircuit.tournaments) ? selectedCircuit.tournaments : tournaments}'), "O ranking público do circuito não recebe os torneios para cálculo imediato.");
assert.ok(publicCircuitScreenSource.includes('className="publicCircuitName"'), "O nome do circuito não recebe destaque no ranking público.");
assert.ok(
  rankingShareExportSource.includes('pts: "Total de Games"'),
  "A coluna de games ainda usa a nomenclatura antiga."
);
assert.ok(
  rankingShareExportSource.includes("const stats = exportColumns")
    && rankingShareExportSource.includes("criteriaLabel || criteria.label"),
  "A imagem compartilhada não respeita nem identifica a ordem de critérios do ranking."
);
assert.ok(
  mainSource.includes('rankingCriteria: effectiveCircuitCriteria')
    && publicCircuitScreenSource.includes('rankingCriteria: circuit?.ranking_criteria || defaultRankingCriteria'),
  "O compartilhamento do ranking do circuito não recebe seu critério efetivo."
);
assert.ok(
  rankingShareExportSource.includes('async function copyRankingImageToClipboard(file)')
    && rankingShareExportSource.includes('new Blob([await file.arrayBuffer()], { type: "image/png" })')
    && rankingShareExportSource.includes('if (isMobileShareDevice() && await nativeShareRankingFiles(files, config))')
    && rankingShareExportSource.includes('const imageCopied = await copyRankingImageToClipboard(files[0]);'),
  "O compartilhamento não separa o envio móvel da cópia PNG direta no notebook."
);
assert.ok(
  rankingShareButtonSource.includes('className="rankingExportDialog"')
    && rankingShareButtonSource.includes('Imprimir / salvar PDF multipágina')
    && rankingShareButtonSource.includes('downloadRankingFiles(exportFiles)')
    && rankingShareButtonSource.includes('shareRankingImages(nextConfig)')
    && rankingShareExportSource.includes('paginateRankingGroups(normalizedGroups')
    && styleSource.includes('.rankingExportOverlay'),
  "O ranking não apresenta exportação paginada para imagem, impressão e download."
);
assert.ok(
  rankingShareButtonSource.includes("Baixar planilha editável (.xlsx)")
    && rankingShareButtonSource.includes("downloadRankingWorkbook(activeConfig)")
    && rankingWorkbookExportSource.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    && rankingWorkbookExportSource.includes("TORNEIO360_LOGO")
    && rankingWorkbookExportSource.includes("workbookGroups")
    && mainSource.includes("editableWorkbook: true"),
  "O ranking do circuito não oferece uma planilha XLSX editável, identificada e separada por tabela."
);
assert.ok(
  rankingShareButtonSource.includes("export default function RankingShareButton")
    && rankingShareButtonSource.includes('from "./rankingShareExport.mjs"')
    && lazyFeaturesSource.includes('React.lazy(() => import("../rankingShare/RankingShareButton.jsx"))'),
  "O componente visual de compartilhamento não preserva a interface das ações existentes."
);
assert.ok(
  canvasToolsSource.includes('export const TORNEIO360_LOGO = "/torneio360-logo.png";')
    && canvasToolsSource.includes("export function loadShareImage(source)")
    && canvasToolsSource.includes("export function drawRoundedRect(context")
    && canvasToolsSource.includes("export function getPodiumInitials(name)"),
  "As ferramentas de mídia compartilhadas não foram preservadas no módulo extraído."
);
assert.ok(
  tournamentWorkspaceTabsSource.includes("export default function TournamentWorkspaceTabs")
    && tournamentWorkspaceTabsSource.includes("MatchStatusSummary")
    && tournamentWorkspaceTabsSource.includes('<MatchStatusSummary data={tournament.data} compact vertical />')
    && tournamentWorkspaceTabsSource.includes('className="desktopTournamentTabs"')
    && tournamentWorkspaceTabsSource.includes('className="mobileTournamentWorkspaceActions"')
    && tournamentWorkspaceTabsSource.includes("Central de torneios")
    && tournamentWorkspaceTabsSource.includes("Remover da barra?")
    && tournamentWorkspaceTabsSource.includes("TOURNAMENT_TAB_COLORS")
    && tournamentRuntimeAdaptersSource.includes("<TournamentWorkspaceTabsView {...props} MatchStatusSummary={TournamentMatchStatusSummary}"),
  "A Central de Torneios Abertos perdeu abas, versão móvel, busca, confirmação ou resumo dos jogos."
);
assert.ok(
  courtCenterModalSource.includes("export default function CourtCenterModal")
    && courtCenterModalSource.includes("configured: true")
    && courtCenterModalSource.includes("Quantas quadras estão disponíveis neste local?")
    && courtCenterModalSource.includes("A quadra será liberada automaticamente ao concluir o placar.")
    && courtCenterModalSource.includes("Distribuição inicial por torneio")
    && courtCenterModalSource.includes("recebem automaticamente a próxima quadra liberada")
    && tournamentRuntimeAdaptersSource.includes("<CourtCenterModalView")
    && tournamentRuntimeAdaptersSource.includes("normalizeCourtCenterEntry={normalizeCourtCenterEntry}"),
  "A Central de Quadras perdeu capacidade, ocupação, preferências ou compatibilidade com o estado salvo."
);
assert.ok(
  rankingShareExportSource.includes('async function createCupPodiumShareFile({')
    && rankingShareExportSource.includes('config?.presentation === "podium"')
    && cupPodiumSource.includes('presentation: "podium"')
    && cupPodiumSource.includes('const podiumLimit = variant === "parallel" ? 1 : 3;'),
  "O compartilhamento das copas não preserva o pódio visual ou ainda mostra vice e terceiro nas disputas paralelas."
);
assert.ok(
  rankingShareExportSource.includes("const RANKING_SHARE_ROW_HEIGHT = 64;")
    && rankingShareExportSource.includes("const RANKING_SHARE_GROUP_OVERHEAD = 64;")
    && rankingShareExportSource.includes('context.font = "800 18px Arial";'),
  "O ranking completo voltou a usar linhas grandes e pode mostrar menos de dez participantes por imagem."
);
assert.ok(
  canvasToolsSource.includes('function wrapCanvasItems(context, items, maxWidth')
    && rankingShareExportSource.includes('wrapCanvasItems(context, stats, 430).forEach'),
  "O compartilhamento do ranking ainda pode ocultar critérios com reticências."
);
assert.ok(
  rankingShareButtonSource.includes('config.buttonLabel || "Compartilhar ranking"'),
  "O botão compacto não identifica o ranking compartilhado."
);
assert.ok(
  tieBreakPanelsSource.includes("function TieBreakDrawOverlay")
    && tieBreakPanelsSource.includes("function CopinhaTieBreakPanel")
    && tieBreakPanelsSource.includes("function CupGroupRankingView")
    && tieBreakPanelsSource.includes("Sortear em 5 segundos"),
  "Os painéis de desempate ou a tabela dos grupos perderam a apresentação existente."
);
assert.ok(
  mainSource.includes('const [newRankingCriteria, setNewRankingCriteria] = useState("");')
    && cupRankingDefaultsSource.includes('function getNewTournamentRankingCriteria(type, selectedCriteria = "")')
    && cupRankingDefaultsSource.includes('isCupType(modalityConfig[type]) ? cupRankingCriteria : selectedCriteria')
    && mainSource.includes('if (!isMultiCategory && !rankingCriteriaOptions.some((option) => option.value === effectiveNewRankingCriteria))')
    && mainSource.includes('getNewTournamentRankingCriteria(item.type, item.rankingCriteria)')
    && mainSource.includes('showNotice("warning", "Critério obrigatório"')
    && mainSource.includes('<option value="">Escolha a ordem dos critérios</option>')
    && mainSource.includes('rankingCriteria: isMultiCategory ? defaultRankingCriteria : effectiveNewRankingCriteria,')
    && mainSource.includes('aria-label="Critério automático das modalidades de copa"'),
  "A criação não preserva a escolha obrigatória nas modalidades comuns ou o critério automático nas copas."
);
assert.ok(
  participantAttendanceSource.includes('function normalizeParticipantAttendance(config, players, attendance)')
    && participantAttendanceSource.includes('function getGameSideAttendanceParticipants(data, game, side)')
    && matchScheduleSource.includes('className="matchAttendancePending"')
    && !mainSource.includes('if (!ensureParticipantsConfirmed()) return;')
    && mainSource.includes('function showGeneratedGamesNotice(message)')
    && mainSource.includes('A geração foi concluída normalmente e os placares continuam liberados.')
    && mainSource.includes('Confirmar todos')
    && mainSource.includes('Marcar todos como pendentes'),
  "A presença deve continuar visível nos jogos sem impedir a geração das rodadas."
);
assert.ok(
  tournamentDataNormalizationSource.includes('export function normalizeTournamentData(type, rawData)')
    && mainSource.indexOf('from "./domain/tournamentDataNormalization.mjs"') < mainSource.indexOf('function TournamentScreen('),
  "Os utilitários de participantes precisam permanecer no escopo global antes da normalização dos torneios."
);
assert.ok(
  participantManagementSource.includes('function stripParticipantEmojis(value)')
    && participantManagementSource.includes('\\p{Extended_Pictographic}')
    && participantManagementSource.includes('\\p{Regional_Indicator}')
    && participantManagementSource.includes('Símbolos e emojis em qualquer posição serão ignorados.'),
  "A importação em massa deve remover emojis completos em qualquer posição da lista colada."
);
assert.ok(
    publicTournamentScreenSource.includes('const publicRankingReady = isCup || publicCompletionState.completed;')
    && publicTournamentScreenSource.includes('className="publicRankingLocked"')
    && publicTournamentScreenSource.includes('O ranking será exibido quando todos os jogos reais estiverem concluídos.'),
  "O ranking público das modalidades comuns não está protegido, ou a Copa continua bloqueada indevidamente."
);
assert.ok(
  mainSource.includes('function toggleScheduleGameStatus(roundIndex, gameIndex)')
    && mainSource.includes('function toggleBracketGameStatus(matchKey)')
    && matchScheduleSource.includes('Em jogo')
    && matchScheduleSource.includes('is-in-progress'),
  "O status persistente de jogo em curso está ausente."
);
assert.ok(
    matchScheduleSource.includes('<ScheduleStatusFilters')
    && cupBracketViewSource.includes('<MatchStatusSummary')
    && cupBracketViewSource.includes('scope="bracket"')
    && cupBracketViewSource.includes('bracketMatchKeys={currentPhaseMatchKeys}')
    && tournamentOperationsSource.includes('scope !== "all" && item.scope !== scope'),
  "A fase de grupos ou o resumo isolado da chave aberta está ausente."
);
assert.ok(
  matchScheduleSource.includes('className="scheduleSearch platformUnifiedSearch"')
    && matchScheduleSource.includes('className="scheduleOverviewPrimary"')
    && matchScheduleSource.includes('const SCHEDULE_STATUS_FILTERS = [')
    && matchScheduleSource.includes('aria-pressed={value === filter.value}')
    && matchScheduleSource.includes('if (nextFilter === "all") {')
    && matchScheduleSource.includes('setScheduleSearchValue("");')
    && matchScheduleSource.includes('const [scheduleFilterSnapshot, setScheduleFilterSnapshot] = useState(null);')
    && matchScheduleSource.includes('frozenFilterGameKeys.has(`${roundIndex}:${gameIndex}`)')
    && matchScheduleSource.includes('summary: { ...scheduleSummary }')
    && matchScheduleSource.includes('getScheduleGameSearchText(game, roundIndex, courtNumbers, winningScore)')
    && matchScheduleSource.includes('placeholder="Nome, rodada ou quadra"')
    && matchControlsSource.includes('Repetir chamada')
    && matchControlsSource.includes('<option value={1}>1 vez</option>')
    && styleSource.includes('.scheduleSearch {')
    && styleSource.includes('button.scheduleStatusFilter.active')
    && styleSource.includes('grid-template-columns: repeat(3, minmax(0, max-content));')
    && styleSource.includes('.proDashboard.playAppShell button.openTournamentTabClose {')
    && styleSource.includes('max-height: 18px !important;')
    && organizerWorkspaceSource.includes('key={`${tournament.id}:${activeTournamentTab}:${activeMatchesTab}`}'),
  "Os filtros, a pesquisa operacional ou o seletor compacto das partidas estão ausentes."
);
assert.ok(
  mainSource.includes('function prepareEditableBracketData(currentData)')
    && mainSource.includes('return syncCupBracketScores(copy);')
    && mainSource.includes('const copy = prepareEditableBracketData(prev);'),
  "A 3ª Disputa Paralela exibida dinamicamente não pode receber placares persistentes."
);
assert.ok(
  styleSource.includes('.proDashboard.playAppShell button.matchCardStatus.is-waiting')
    && styleSource.includes('-webkit-text-fill-color: #52657b !important;')
    && styleSource.includes('.proDashboard.playAppShell button.matchCardStatus.is-in-progress'),
  "Os textos dos status das partidas podem desaparecer no tema claro."
);
assert.ok(
  mainSource.includes('Editar evento completo')
    && mainSource.includes('function openEditEventGroup(group)')
    && mainSource.includes('function saveEditedEventGroup({ confirmModalityChanges = false } = {})')
    && mainSource.includes('Adicionar categoria'),
  "A edição conjunta de eventos com várias categorias está ausente."
);
assert.deepEqual(modalityConfig["Campeonato Cearense"]?.allowedTeamCounts, Array.from({ length: 29 }, (_, index) => index + 4), "O Campeonato Cearense não aceita todas as quantidades de 4 a 32 duplas.");
assert.deepEqual(createCearenseGroups(7).map((group) => group.teamIds.length), [4, 3], "A distribuição própria de grupos do Campeonato Cearense está ausente.");
assert.ok(
  modalityConfig["Copa Sunset"]?.type === "sunset"
    && cupBracketOrchestrationSource.includes('function generateSunsetBrackets(data)')
    && sunsetBracketSource.includes('function buildSunsetChampionsRounds(brackets, bracketTitle)')
    && tournamentDataNormalizationSource.includes('groupFormation === "all-four"')
    && cupPresentationSource.includes('phase === "secondParallel"')
    && cupPresentationSource.includes('phase === "sunsetFinal"')
    && styleSource.includes('.sunsetGroupFormationChoice'),
  "A Copa Sunset perdeu a formação opcional de grupos de quatro ou suas chaves independentes."
);
assert.ok(campaignRankingSource.includes('function compareCearenseCampaignMetrics('), "A comparação normalizada entre grupos está ausente.");
assert.ok(cupBracketOrchestrationSource.includes('function generateCearenseBrackets(data)'), "As chaves Principal e Paralela do Campeonato Cearense estão ausentes.");
assert.ok(mainSource.includes('campaignTieBreakOverrides'), "O sorteio de empate absoluto entre grupos não é persistido.");
assert.ok(matchScheduleSource.includes('className="matchByeScore">BYE</span>'), "Os BYEs do Campeonato Cearense não são identificados no cartão universal da chave.");
assert.ok(!mainSource.includes('Classificação automática (BYE)'), "O texto longo de classificação automática ainda aparece no BYE.");
assert.ok(cupBracketOrchestrationSource.includes('buildCearenseEliminationRounds(qualified.main, "main", mainName, true)'), "A chave principal do Campeonato Cearense não cria a disputa de 3º lugar.");
assert.ok(
  matchScheduleSource.includes("function UniversalMatchCard(")
    && matchScheduleSource.includes('className="matchTeamStack"')
    && matchScheduleSource.includes('className="matchVsDivider"')
    && cupBracketViewSource.includes('className="bracketTreeViewport"')
    && cupBracketViewSource.includes('className="bracketTreeCanvas"')
    && styleSource.includes(".bracketTreeViewport")
    && styleSource.includes("overflow-x: auto")
    && styleSource.includes(".bracketMatchNode.hasNext.isTopSeed::after"),
  "O cartão universal ou o esqueleto conectado da Copa não está presente."
);
assert.ok(
  allowedByPlan.premium.includes("Campeonato Cearense")
    && allowedByPlan.premium.includes("Copa Sunset"),
  "A extração do catálogo alterou as modalidades liberadas no plano Premium."
);
assert.ok(
  cupBracketViewSource.includes("export default function CupBracketView")
    && cupBracketViewSource.includes("export function BracketColumn")
    && cupBracketViewSource.includes("MatchStatusSummary")
    && cupBracketViewSource.includes("speakBracketRound")
    && tournamentRuntimeAdaptersSource.includes("<CupBracketViewComponent"),
  "A apresentação das chaves perdeu fases, resumo, chamadas ou a composição com a tela do torneio."
);
assert.ok(
  publicBracketViewSource.includes("export function PublicScheduleView")
    && publicBracketViewSource.includes("export function PublicCupBracketView")
    && publicBracketViewSource.includes("export function PublicBracketColumn")
    && publicBracketViewSource.includes("readOnly")
    && publicTournamentScreenSource.includes("<PublicCupBracketView"),
  "A visualização pública perdeu rodadas, chaves, paralelas ou o modo somente leitura."
);
assert.ok(tieBreakPanelsSource.includes('showPodium={false}'), "A classificação da fase de grupos ainda exibe troféus de pódio.");
assert.ok(localAppStorageSource.includes('tournamentTab: "participantes"'), "Abrir um torneio não direciona para Participantes.");
assert.ok(mainSource.includes('public_id: generatePublicId()'), "Novos torneios não recebem link público automaticamente.");
assert.ok(
  publicArenaDataSource.includes("export function getPublicTournamentDirectoryItem")
    && publicArenaDataSource.includes("export function normalizePublicCircuitForDisplay")
    && mainSource.includes('from "./domain/publicArenaData.mjs"'),
  "As transformações públicas deixaram de ficar isoladas do componente principal."
);
assert.ok(
  publicIdentifiersSource.includes("export function generatePublicId")
    && storyCoverCropSource.includes("export function readStoryCoverFile")
    && mainSource.includes('from "./domain/publicIdentifiers.mjs"')
    && mainSource.includes('import("./features/media/storyCoverCrop.mjs")'),
  "Os identificadores públicos ou o tratamento de imagens voltaram ao componente principal."
);
assert.ok(
  lazyFeaturesSource.includes("function lazyNamed(importer, exportName)")
    && mainSource.includes("<React.Suspense")
    && mainSource.includes('import("./domain/tournamentScheduleFactory.mjs")')
    && lazyFeaturesSource.includes('import("../matchOperations/speechAnnouncements.mjs")'),
  "As áreas pesadas deixaram de ser carregadas sob demanda ou perderam o fallback seguro."
);
assert.ok(
  publicArenaPresentationSource.includes("<OrganizationProfileContentPresentation")
    && organizationProfileContentPresentationSource.includes('className="profilePublicationFilters organizationPublicationKinds"')
    && organizationProfileContentPresentationSource.includes('className="profileTournamentGrid"'),
  "O link público não abre a mesma experiência real de publicações do perfil da organização."
);
assert.ok(mainSource.includes('navigator.serviceWorker.register("/sw.js")'), "O service worker do app não está registrado.");
assert.ok(!mainSource.includes("@torenio360"), "O usuário do Instagram continua escrito incorretamente.");
assert.ok(!mainSource.includes("data:image/png;base64"), "Ainda existem imagens PNG Base64 no JavaScript.");
assert.ok(confirmationDialogsSource.includes("function ConfirmCircuitDeleteModal"), "A exclusão do circuito não possui confirmação própria.");
assert.ok(!mainSource.includes('window.confirm("Excluir este circuito?'), "A exclusão do circuito ainda usa a confirmação simples do navegador.");
assert.ok(mainSource.includes('const [circuitEditForm, setCircuitEditForm]'), "A edição do circuito não abre em um formulário separado.");
assert.ok(tournamentLifecycleSource.includes("export function getAutomaticEventStatus"), "O status de torneios e circuitos não é calculado automaticamente pelas datas.");
assert.ok(
  tournamentLifecycleSource.includes('return String(endDate) < getBrazilTodayISO() ? "finished" : "active"')
    && publicArenaMigration.includes("then 'finished'"),
  "O status automático não respeita os valores permitidos pelo banco de produção."
);
assert.ok(mainSource.includes('<ChevronDown />'), "O circuito não usa a seta para abrir e fechar.");
assert.ok(styleSource.includes("CONTRASTE ENTRE TEMAS E CIRCUITOS"), "A camada final de contraste dos temas está ausente.");
assert.ok(styleSource.includes(".gameWaiting .gameTeams > div"), "Os jogadores sem placar continuam sem correção de contraste.");
assert.ok(styleSource.includes(".arenaPublicDetailsGrid span"), "Os dados públicos da arena continuam sem correção de contraste.");
assert.ok(
  /button\.circuitItemSummary::before\s*\{[^}]*content:\s*none\s*!important;[^}]*display:\s*none\s*!important;/s.test(styleSource),
  "O cabeçalho do circuito ainda pode exibir o monograma duplicado."
);
assert.ok(styleSource.includes(".rankingTableScroll > .rankingTable"), "Os rankings internos não possuem rolagem horizontal responsiva.");
assert.ok(rankingTablesSource.includes('className="rankingTablePanel"'), "O painel do ranking não isola a largura mínima da tabela.");
assert.ok(
  /\.rankingTablePanel\s*\{[^}]*min-width:\s*0\s*!important;/s.test(styleSource),
  "A largura da tabela ainda pode expandir a página inteira."
);
assert.ok(
  /\.rankingTableScroll\s*\{[^}]*overflow-x:\s*auto\s*!important;/s.test(styleSource),
  "A rolagem horizontal deixou de ficar disponível somente na tabela."
);
assert.ok(
  /\.circuitTournamentOption\s*\{[^}]*position:\s*relative\s*!important;[^}]*min-width:\s*0\s*!important;/s.test(styleSource),
  "O cartão de seleção do circuito não contém o checkbox invisível."
);
assert.ok(
  /\.circuitTournamentOption\s*>\s*input\[type="checkbox"\]\s*\{[^}]*inset:\s*0\s*!important;[^}]*width:\s*100%\s*!important;[^}]*height:\s*100%\s*!important;[^}]*margin:\s*0\s*!important;[^}]*padding:\s*0\s*!important;/s.test(styleSource),
  "O checkbox invisível ainda pode criar rolagem horizontal na página."
);
assert.ok(styleSource.includes(".gameFinished .gameTeams > div.winnerTeam"), "O vencedor não possui contraste próprio após o placar.");
assert.ok(styleSource.includes(".gameFinished .gameTeams > div.loserTeam"), "O perdedor não possui contraste próprio após o placar.");
assert.ok(styleSource.includes('"team1 score1"'), "No celular, cada placar não está alinhado ao respectivo atleta.");
assert.ok(contactLinksSource.includes("function getBrazilianWhatsAppUrl"), "Os links de WhatsApp não possuem normalização brasileira.");
assert.ok(contactLinksSource.includes('digits.startsWith("55") && digits.length >= 12'), "O código do país não é preservado quando já foi informado.");
assert.ok(
  mainEntrySource.includes("getWhatsAppUrl: getBrazilianWhatsAppUrl")
    && mainEntrySource.includes("getWhatsAppUrl={getBrazilianWhatsAppUrl}")
    && publicArenaPageControllerSource.includes("getWhatsAppUrl={getBrazilianWhatsAppUrl}")
    && publicTournamentScreenSource.includes("getBrazilianWhatsAppUrl(publicOrganizer.whatsapp)")
    && publicPlatformHomeControllerSource.includes("getWhatsAppUrl={getWhatsAppUrl}"),
  "Nem todos os links de WhatsApp usam o código +55 automático."
);
assert.ok(authValidationSource.includes("function isUserAlreadyRegisteredError"), "O cadastro não reconhece e-mails que já possuem conta.");
assert.ok(loginScreenSource.includes("Este e-mail já possui uma conta"), "O cadastro não orienta o usuário a entrar com a conta existente.");
assert.ok(
  !loginScreenSource.includes("Como você quer começar?")
    && !loginScreenSource.includes("initialAccountType")
    && loginScreenSource.includes('account_type: "athlete"')
    && loginScreenSource.includes("Uma conta para toda a plataforma"),
  "O cadastro voltou a separar atleta e organizador em tipos diferentes de acesso."
);
assert.ok(
  unifiedPlatformFrameSource.includes('panel: "overview"')
    && unifiedPlatformFrameSource.includes('panel: "profile"')
    && !unifiedPlatformFrameSource.includes('panel: "explore"')
    && !unifiedPlatformFrameSource.includes('panel: "create"')
    && memberProfileWorkspaceSource.includes("MemberSocialOverview")
    && memberProfileWorkspaceSource.includes("A criação de torneios e circuitos pertence a uma identidade de organização"),
  "A conta gratuita voltou a usar uma área separada ou perdeu o bloqueio de assinatura."
);
assert.ok(
  memberProfileDetailsSource.includes("Categoria esportiva")
    && memberProfileDetailsSource.includes("Nível técnico")
    && memberProfileDetailsSource.includes("Esta informação não será exibida publicamente")
    && !memberProfileDetailsSource.includes("Gênero do atleta")
    && tournamentRegistrationPanelSource.includes("Selecione sua categoria esportiva")
    && tournamentRegistrationPanelSource.includes("Complete apenas o que falta no perfil")
    && tournamentRegistrationPanelSource.includes("categorias esportivas diferentes"),
  "O cadastro e a inscrição voltaram a confundir categoria esportiva com gênero ou nível técnico."
);
assert.ok(
  organizerWorkspaceSource.includes("<PlatformSidebar")
    && organizerWorkspaceSource.includes("<PlatformTopbar")
    && unifiedPlatformFrameSource.includes("<PlatformSidebar")
    && unifiedPlatformFrameSource.includes("<PlatformTopbar")
    && mainEntrySource.includes("subscribePlatformNavigation")
    && platformNavigationSource.includes("window.history[method]")
    && publicTournamentScreenSource.includes('embedded ? " embeddedPublicTournament"')
    && publicPlatformHomeControllerSource.includes("navigatePlatform({ public: item.public_id })"),
  "A navegação pública voltou a criar uma página paralela ou a recarregar a aplicação inteira."
);
assert.ok(
  !platformChromeSource.includes("Usando como")
    && !platformChromeSource.includes("PlatformIdentityContext")
    && organizerWorkspaceSource.includes("Abrir perfil da organização")
    && organizerWorkspaceSource.includes('label: "Perfis"')
    && organizerWorkspaceSource.includes("Meu perfil de atleta")
    && organizerWorkspaceSource.includes("Conta e segurança")
    && organizerWorkspaceSource.includes('profileIdentity === "athlete"')
    && organizerWorkspaceSource.includes("organizerProfile.photoUrl")
    && organizerWorkspaceSource.includes("organizerProfile.coverUrl"),
  "A barra superior voltou a duplicar a identidade ou ocultou o acesso ao perfil da organização."
);
assert.ok(
  organizerWorkspaceSource.includes("Torneios/Circuitos")
    && athleteProfileActivitySource.includes("Procurando dupla")
    && organizerWorkspaceSource.includes("Desafios")
    && !organizerWorkspaceSource.includes("Publicações do atleta")
    && athleteProfileActivitySource.includes("Quem pratica mais?")
    && athleteProfileActivitySource.includes("Disputar uma partida")
    && athleteProfileActivitySource.includes("Avisar que procuro dupla")
    && !athleteProfileActivitySource.includes("textarea")
    && athleteActivityApiSource.includes("get_my_athlete_activity")
    && athleteActivityApiSource.includes("send_athlete_challenge")
    && athleteProfileActivityMigrationSource.includes("create table if not exists public.athlete_partner_searches")
    && athleteProfileActivityMigrationSource.includes("create table if not exists public.athlete_challenges")
    && athleteProfileActivityMigrationSource.includes("'whatsapp', ''")
    && athleteProfileActivityMigrationSource.includes("'organization', null")
    && athleteProfileActivityMigrationSource.includes("where member.is_public = true")
    && athleteProfileActivityMigrationSource.includes("candidate_registration.partner_name")
    && athleteProfileActivityMigrationSource.includes("revoke all on public.athlete_challenges"),
  "O perfil do atleta perdeu a jornada esportiva, voltou a aceitar mensagens livres ou expôs contatos protegidos."
);
assert.ok(
  organizerWorkspaceSource.includes("<OrganizationRegistrantsPanel")
    && organizationProfilePresentationSource.includes("Inscritos")
    && organizationProfilePresentationSource.includes("organizationIdentityBadge")
    && organizerWorkspaceSource.includes("<OrganizationProfilePresentation")
    && organizerWorkspaceSource.includes("athleteIdentityBadge")
    && organizerWorkspaceSource.includes("openOrganizationProfileImageEditor")
    && organizerWorkspaceSource.includes("organizationProfileImageEditor")
    && !organizerWorkspaceSource.includes("Conquistas da organização")
    && organizationRegistrantsPanelSource.includes("Aprovados")
    && organizationRegistrantsPanelSource.includes("Em análise")
    && organizationRegistrantsPanelSource.includes("Procuram dupla")
    && organizationRegistrantsPanelSource.includes("Categoria")
    && organizationRegistrantsPanelSource.includes("Categoria esportiva")
    && organizationRegistrantsPanelSource.includes("Modalidade")
    && organizationRegistrantsApiSource.includes("get_my_organization_registrations")
    && organizationRegistrantsApiSource.includes("review_tournament_registration_workflow")
    && organizationRegistrantsApiSource.includes("registration-receipts")
    && organizationRegistrantsMigrationSource.includes("tournament.user_id = auth.uid()")
    && organizationRegistrantsMigrationSource.includes("payment_status in ('pending', 'paid')")
    && organizationRegistrantsMigrationSource.includes("revoke all on function public.get_my_organization_registrations")
    && registrationWorkflowMigrationSource.includes("public = false")
    && registrationWorkflowMigrationSource.includes("workflow_status in ('draft', 'submitted', 'approved', 'rejected')")
    && registrationWorkflowMigrationSource.includes("review_tournament_registration_workflow"),
  "A organização perdeu o painel protegido de inscritos, os estados financeiros ou a edição unificada do perfil."
);
assert.ok(
  organizerWorkspaceSource.includes('openOrganizationProfileImageEditor(file, "cover")')
    && organizerWorkspaceSource.includes("A nova capa foi salva separadamente")
    && !organizerWorkspaceSource.includes("profileAvatarEditBadge")
    && styleSource.includes("z-index: 10110")
    && styleSource.includes("inset: 76px 0 0")
    && styleSource.includes("inset: 70px 0 0")
    && profileImageEditorSource.includes("outputWidth: 1702")
    && profileImageEditorSource.includes("outputHeight: 630")
    && profileImageEditorSource.includes('fit: "contain"')
    && styleSource.includes("aspect-ratio: 851 / 315")
    && styleSource.includes("object-fit: contain")
    && organizationCoverApiSource.includes("get_my_organization_profile_cover")
    && organizationCoverApiSource.includes("set_my_organization_profile_cover")
    && organizationCoverMigrationSource.includes("cover_url text not null default ''")
    && organizerWorkspaceSource.includes("Entrar no grupo do WhatsApp")
    && organizerWorkspaceSource.includes("Chave Pix pública")
    && organizerWorkspaceSource.includes("Pagamento com cartão")
    && organizationPaymentApiSource.includes("get_public_organization_payment_settings")
    && organizationPublicPaymentsMigrationSource.includes("pix_key text not null default ''")
    && organizationPublicPaymentsMigrationSource.includes("card_payment_link text not null default ''")
    && organizationPublicPaymentsMigrationSource.includes("public.build_public_arena_profile_uncached")
    && tournamentPaymentPanelSource.includes("Selecionar comprovante")
    && tournamentPaymentPanelSource.includes("armazenamento privado")
    && tournamentPaymentPanelSource.includes("Somente você e a organização responsável"),
  "A capa, o modal, os dados públicos ou a preparação segura do pagamento da organização regrediram."
);
assert.ok(
  organizerWorkspaceSource.includes('{ panel: "inicio", label: "Início", Icon: LayoutDashboard }')
    && organizerWorkspaceSource.includes('{ panel: "notificacoes", label: "Notificações", Icon: Bell, unreadCount: unreadNotificationCount }')
    && organizerWorkspaceSource.includes('{ panel: "ajustes", label: "Perfis", Icon: UserRound }')
    && !unifiedPlatformFrameSource.includes('label: "Explorar"')
    && !unifiedPlatformFrameSource.includes('label: "Criar"')
    && organizerWorkspaceSource.includes("<OrganizationProfileContentPresentation")
    && publicArenaPresentationSource.includes("<OrganizationProfileContentPresentation")
    && organizationProfileContentPresentationSource.includes("profileTournamentToolbar")
    && organizationProfileContentPresentationSource.includes("Pesquisar torneios no perfil da organização")
    && organizationProfileContentPresentationSource.includes("profileTournamentGenderFilters")
    && organizationProfileContentPresentationSource.includes("canManageEvents")
    && organizationProfileContentPresentationSource.includes("canEdit")
    && organizerWorkspaceSource.includes('setOrganizationGalleryStatus("local")')
    && organizerWorkspaceSource.includes("A capa já aparece separada neste perfil")
    && organizerWorkspaceSource.includes("A capa do perfil é separada")
    && !organizerWorkspaceSource.includes("A primeira foto é usada como capa")
    && !organizerWorkspaceSource.match(/organizationProfileAvatarShortcut[\s\S]{0,900}profileAvatarEditBadge/),
  "A navegação simplificada, os filtros do perfil ou a remoção da câmera azul da organização regrediram."
);
assert.ok(
  publicPlatformHomeControllerSource.includes('variant="discovery"')
    && publicArenaPresentationSource.includes("publicTournamentDiscoverySearch")
    && publicArenaPresentationSource.includes("Encontre um torneio"),
  "Início e Explorar voltaram a apresentar o mesmo feed sem uma experiência de descoberta."
);
assert.ok(
  /\.publicTournamentPost\s*\{[^}]*grid-template-columns:\s*minmax\(230px,\s*31%\)/s.test(styleSource)
    && /\.publicTournamentPostImage\s+img\s*\{[^}]*object-fit:\s*contain/s.test(styleSource)
    && styleSource.includes('"poster organization"')
    && styleSource.includes(".proDashboard.theme-dark .embeddedPublicTournament.publicPage")
    && styleSource.includes(".proDashboard.theme-dark .embeddedPublicTournament .rankingTable td")
    && styleSource.includes(".proDashboard.theme-dark .embeddedPublicTournament .partnerFinder"),
  "As publicações ou o torneio público perderam a organização visual e o contraste do modo escuro."
);
assert.ok(contactLinksSource.includes("function getPlanRegularizationWhatsAppUrl"), "A regularização do plano não possui mensagem própria no WhatsApp.");
assert.ok(accessStatusViewsSource.includes("window.location.assign(regularizationUrl)"), "O acesso vencido não direciona o usuário para o WhatsApp.");
assert.ok(accessStatusViewsSource.includes("Regularizar pelo WhatsApp"), "A tela de acesso vencido não possui alternativa manual para abrir o WhatsApp.");
assert.ok(styleSource.includes("CONTATOS PÚBLICOS, TESTE GRÁTIS E ACESSO VENCIDO"), "Os novos destaques públicos estão sem estilos.");

assert.ok(
  mainSource.includes("let circuitPersistence = await persistCircuitRankings(")
    && mainSource.includes("persistedTournament.id")
    && mainSource.includes("{ affectedTournamentId: affectedId }")
    && mainSource.includes('.eq("tournament_id", normalizedAffectedTournamentId)')
    && !mainSource.includes('"Placar salvo; ranking pendente"'),
  "O placar pode ser marcado como salvo antes de atualizar o ranking dos circuitos."
);
assert.ok(
  mainSource.includes("rankingHistorySaved = await saveCircuitHistoryToSupabase("),
  "O salvamento do circuito ainda ignora falhas no histórico do ranking."
);
assert.ok(circuitRankingSettingsSource.includes("function applyCircuitExtraPoints"), "A pontuação extra do circuito não entra no cálculo do ranking.");
assert.ok(circuitRankingSettingsSource.includes("target.circuitPoints = Number(target.circuitPoints || 0) + entry.points"), "A pontuação extra não é somada ao total principal.");
assert.ok(circuitExtraPointsPanelSource.includes('className="confirmOverlay" role="dialog"') && circuitExtraPointsPanelSource.includes("Excluir esta pontuação extra?"), "A exclusão da pontuação extra não usa a confirmação segura da plataforma.");
assert.ok(styleSource.includes("button.createCircuitButton") && styleSource.includes("button.combineCircuitsButton"), "As cores semânticas das ações dos circuitos não estão protegidas da regra neutra global.");
assert.ok(mainSource.includes("Somar circuitos"), "A ação para somar circuitos está ausente.");
assert.ok(circuitRankingSettingsPanelSource.includes("Masculino e feminino"), "O ranking separado das duplas mistas está ausente.");
assert.ok(
  circuitRankingAggregationSource.includes("if (Number(row.played || 0) <= 0) return;"),
  "Participantes sem jogo válido ainda podem entrar no ranking do circuito."
);
assert.ok(
  tournamentRankingSource.includes("const games = [...(data.schedule || []).flat(), ...bracketGames];"),
  "O ranking do circuito não soma a fase de grupos e o mata-mata das Copas."
);
assert.ok(
  cupPresentationSource.includes('.filter((game) => game.phase === "main")')
    && circuitRankingAggregationSource.includes("calculateCircuitPlacementRowsByConfig")
    && circuitRankingSettingsPanelSource.includes("function CircuitRankingSettingsEditor")
    && circuitRankingSettingsPanelSource.includes('role="radiogroup" aria-label="Quem acumula os pontos"')
    && circuitRankingSettingsPanelSource.includes("getCircuitTieBreakLabel(settings)")
    && tournamentRankingSource.includes('const mainBracketGames = (data.brackets || []).filter((game) => game.phase === "main")')
    && styleSource.includes('button:is(.selected, [aria-checked="true"])')
    && circuitRankingSettingsPanelSource.includes("Não concedem pontos e nenhum resultado, vitória, game ou saldo participa do ranking"),
  "O ranking configurável não exclui as paralelas ou perdeu sua configuração explicativa."
);
assert.ok(
  circuitScoringMigration.includes("add column if not exists ranking_settings jsonb")
    && circuitScoringMigration.includes("add column if not exists circuit_points integer")
    && circuitScoringMigration.includes("get_public_arena_bundle_base"),
  "A persistência ou a visualização pública do novo modelo de pontuação está incompleta."
);
assert.ok(
  publicArenaMigration.includes("selected_tournament.value = history.tournament_id::text"),
  "O ranking público ainda pode somar um torneio removido do circuito."
);
assert.ok(
  publicArenaMigration.includes("create table if not exists public.circuit_ranking_history")
    && publicArenaMigration.includes("primary key (user_id, circuit_id, tournament_id, group_key, player_key)"),
  "A persistência do ranking acumulado não cria sua tabela de histórico no Supabase."
);
assert.ok(
  publicArenaMigration.includes("circuit_ranking_history_owner_update")
    && publicArenaMigration.includes("user_id = auth.uid()"),
  "O histórico do ranking do circuito não está protegido por organizador."
);
assert.ok(
  publicArenaMigration.includes("where circuit.ranking_criteria_mode = 'automatic'"),
  "Circuitos automáticos antigos não recebem o critério do torneio vinculado."
);
assert.ok(
  publicArenaMigration.includes("coalesce(linked_tournament.data ->> 'deletedAt', '') = ''"),
  "O ranking público ainda pode somar torneios enviados à lixeira."
);
assert.ok(
  publicArenaMigration.includes("as restrictive")
    && publicArenaMigration.includes("lower(coalesce(status, '')) = 'active'")
    && publicArenaMigration.includes("auth.jwt() -> 'app_metadata' ->> 'role'"),
  "Visitantes ou contas sem acesso ainda podem alterar o perfil da arena."
);
assert.ok(
  publicArenaMigration.includes("profiles_no_direct_insert_guard")
    && publicArenaMigration.includes("with check (false)"),
  "Um visitante autenticado ainda pode criar um perfil diretamente pelo cliente."
);
assert.ok(
  mainSource.includes('["athlete", "visitor", "spectator"].includes(sessionRole)'),
  "Uma conta visitante ainda pode abrir o painel administrativo."
);
assert.ok(
  publicArenaPageControllerSource.includes("organizer={organizer}"),
  "O torneio público ainda usa somente a cópia antiga dos dados da arena."
);
assert.ok(
  circuitRankingSettingsPanelSource.includes('className="circuitIdentityHint"'),
  "O circuito não orienta sobre a identidade dos participantes pelo nome."
);
assert.ok(
  publicArenaMigration.includes("'athlete', 'visitor', 'spectator', 'organizer_pending'"),
  "Contas visitantes ou ainda pendentes podem aparecer no diretório público."
);
assert.ok(
  mainSource.includes('.rpc("set_tournament_order", {')
    && mainSource.includes("sortTournamentsByStoredOrder"),
  "A ordem escolhida ao arrastar os torneios não é persistida e recarregada."
);
assert.ok(
  publicArenaMigration.includes("create or replace function public.set_tournament_order"),
  "A ordenação dos torneios não possui uma operação transacional segura."
);
assert.ok(
  mainSource.includes('dragOverTournamentId === t.id')
    && styleSource.includes('content: "Solte aqui"'),
  "O arraste não apresenta um destino visual claro para o organizador."
);
assert.ok(
  styleSource.includes("Ordenação persistente dos cartões de torneio")
    && styleSource.includes(".proDashboard.playAppShell .moveLineBtn span"),
  "A alça de três traços não recebeu o novo contraste visual."
);
assert.ok(
  participantManagementSource.includes('preparedLine.split(/\\s*(?:\\+|&|\\/|-|\\s+[xX]\\s+|\\s+[eE]\\s+)\\s*/u)')
    && participantManagementSource.includes("Espaços dentro do nome continuam sendo nome e sobrenome."),
  "A importação de duplas não reconhece todos os separadores sem preservar nomes compostos."
);
const fixedPairSeparator = /\s*(?:\+|&|\/|-|\s+[xX]\s+|\s+[eE]\s+)\s*/u;
[
  ["Ana + Carla", ["Ana", "Carla"]],
  ["Ana / Carla", ["Ana", "Carla"]],
  ["Ana - Carla", ["Ana", "Carla"]],
  ["Ana e Carla", ["Ana", "Carla"]],
  ["Ana & Carla", ["Ana", "Carla"]],
  ["Ana Maria da Silva", ["Ana Maria da Silva"]],
].forEach(([line, expected]) => {
  assert.deepEqual(
    line.split(fixedPairSeparator),
    expected,
    `A importação interpretou incorretamente a linha: ${line}`
  );
});
assert.ok(
  styleSource.includes("PERFIS E TORNEIOS PÚBLICOS — COMPOSIÇÃO FINAL NO CELULAR")
    && styleSource.includes('grid-template-areas: "back logo access"'),
  "O cabeçalho público móvel não separa navegação, logo e acesso do organizador."
);
assert.ok(
  tournamentLifecycleSource.includes("export function isRegistrationDeadlineOpen(deadline)")
    && publicArenaPresentationSource.includes("<RegistrationStatus open={registrationOpen}")
    && !mainSource.includes("isCircuitRegistrationOpen")
    && (
      (mainSource.match(/className=\{`publicCircuitStatus \$\{circuitStatus\}`\}/g) || []).length
      + (publicArenaPresentationSource.match(/className=\{`publicCircuitStatus \$\{circuitStatus\}`\}/g) || []).length
    ) === 1,
  "Torneios devem mostrar inscrições; circuitos devem mostrar somente andamento ou encerramento."
);
assert.ok(
  tournamentLifecycleSource.includes("export function getTournamentCompletionState")
    && tournamentLifecycleSource.includes("export function getTournamentLifecycleStatus")
    && tournamentLifecycleSource.includes('requiredGames.every((game) => isTournamentGameFinished(game, winningScore))'),
  "O encerramento do torneio não está vinculado à conclusão dos placares obrigatórios."
);
assert.ok(
  tournamentLifecycleSource.includes('item.data?.displayOrderMode === "manual"')
    && mainSource.includes('persistTournamentOrderSequence(list, { manual: true })'),
  "A ordem automática ainda pode ser confundida com uma reorganização manual."
);
assert.ok(
  mainSource.includes('item.data?.multiCategoryEvent === true && item.data?.eventGroupKey')
    && mainSource.includes('const eventGroupKey = isMultiCategory ? generatePublicId() : null;')
    && mainSource.includes('categoryTournamentCard'),
  "Eventos independentes ainda podem ser agrupados ou as categorias não possuem configuração própria."
);
assert.ok(
  appUpdateNoticeSource.includes("function AppUpdateNotice")
    && appUpdateNoticeSource.includes('/app-version.json?t=')
    && mainSource.includes("<AppUpdateNotice />")
    && packageJson.scripts?.prebuild === "node scripts/write-build-version.mjs"
    && typeof appVersion.version === "string",
  "O app instalado não possui verificação profissional de novas versões."
);
assert.ok(
  entryPresentationSource.includes("export function PlanCard")
    && entryPresentationSource.includes("export function Info")
    && entryPresentationSource.includes("export function BeachLogo")
    && entryPresentationSource.includes("export function PlatformSupportLinks")
    && entryPresentationSource.includes("export const PLATFORM_SUPPORT")
    && mainSource.includes("<BeachLogo")
    && mainSource.includes("<PlatformSupportLinks")
    && !mainSource.includes("function PlanCard(")
    && !mainSource.includes("function PlatformSupportLinks("),
  "A apresentação da entrada, da marca e do suporte voltou a depender do arquivo principal."
);
assert.ok(
  accessStatusViewsSource.includes("export function ProfileUnavailable")
    && accessStatusViewsSource.includes("export function AccessPreparing")
    && accessStatusViewsSource.includes("export function Blocked")
    && accessStatusViewsSource.includes("export function FreeTrialNotice")
    && mainSource.includes("<ProfileUnavailable")
    && mainSource.includes("<AccessPreparing")
    && mainSource.includes('return renderMemberWorkspace({')
    && mainSource.includes('regularizationUrl: getPlanRegularizationWhatsAppUrl')
    && mainSource.includes("<FreeTrialNotice")
    && !mainSource.includes("function AccessPreparing("),
  "As telas visuais de situação do acesso voltaram a depender do arquivo principal."
);
assert.ok(
  publicArenaPresentationSource.includes("export function PublicArenaHeroHeaderView")
    && publicArenaPresentationSource.includes("export function PublicArenaTournamentCardsView")
    && publicArenaPresentationSource.includes("export function PublicArenaPageView")
    && publicArenaPresentationSource.includes("export function PublicArenaDirectoryView")
    && publicArenaPresentationSource.includes("export function PublicPlatformHomeView")
    && mainSource.includes("<PublicArenaHeroHeaderView")
    && mainSource.includes("<PublicArenaTournamentCardsView")
    && publicArenaPageControllerSource.includes("<PublicArenaPageView")
    && mainSource.includes("function PublicArenaPage("),
  "A apresentação pública da arena voltou a depender da consulta ou da composição principal."
);
const expandedCircuitLayout = styleSource.match(/\.circuitManagerPage \.circuitItem\.expanded \{([\s\S]*?)\}/)?.[1] || "";
assert.ok(
  expandedCircuitLayout.includes("position: relative")
    && !expandedCircuitLayout.includes("position: fixed")
    && !expandedCircuitLayout.includes("100vmax"),
  "O circuito expandido voltou a ser exibido como uma camada sobreposta ao painel."
);
const eventEditorLayout = styleSource.match(/\.eventEditorOverlay \{([\s\S]*?)\}/)?.[1] || "";
assert.ok(
  eventEditorLayout.includes("position: relative")
    && !eventEditorLayout.includes("position: fixed")
    && !eventEditorLayout.includes("backdrop-filter: blur"),
  "A criação de torneios e circuitos voltou a cobrir o painel com uma janela sobreposta."
);
assert.ok(
  styleSource.includes(".proDashboard .circuitStatus-closed")
    && styleSource.includes(".publicCircuitStatus.closed")
    && styleSource.includes("#f97316"),
  "O status encerrado dos circuitos não recebeu a identificação laranja."
);
assert.ok(
  mainSource.includes('const [tournamentStatusFilter, setTournamentStatusFilter] = useState("active")')
    && mainSource.includes('const [circuitStatusFilter, setCircuitStatusFilter] = useState("active")')
    && mainSource.includes('aria-pressed={tournamentStatusFilter === "finished"}')
    && mainSource.includes('aria-pressed={circuitStatusFilter === "upcoming"}')
    && tournamentLifecycleSource.includes("export function getCircuitLifecycleStatus(circuit)"),
  "Os status de torneios e circuitos não funcionam como filtros completos."
);
assert.ok(
  styleSource.includes(".tournamentStatusSummary button.finished.selected")
    && styleSource.includes("background: #8b5cf6 !important")
    && styleSource.includes("background: #22c55e !important")
    && styleSource.includes("background: #fb923c !important")
    && styleSource.includes(".proDashboard .eventManagerToolbar > button")
    && styleSource.includes("linear-gradient(135deg, #fb923c, #f97316) !important"),
  "As cores dos filtros ou o destaque laranja dos botões de criação foram sobrescritos."
);
const circuitActionsPosition = mainSource.indexOf('className="circuitDetailActions"');
const circuitRankingPosition = mainSource.indexOf('className="circuitRankingBox"', circuitActionsPosition);
assert.ok(
  circuitActionsPosition >= 0
    && circuitRankingPosition > circuitActionsPosition
    && mainSource.includes('className="circuitDetailBackButton"')
    && mainSource.includes('onClick={() => openOrganizerCircuit(circuit)}')
    && mainSource.includes('organizerCircuitsToRender.map')
    && mainSource.includes('aria-pressed={circuitStatusFilter === "combined"}')
    && mainSource.includes('params.set("circuito", next.circuitId)')
    && styleSource.includes(".circuitDetailNavigation")
    && styleSource.includes(".circuitOpenAction"),
  "A lista de circuitos precisa permanecer leve e abrir um único circuito com ações antes do ranking."
);
assert.ok(
  mainSource.includes('className="circuitRankingSpinner"')
    && mainSource.includes('className="circuitRankingLoadingProgress"')
    && mainSource.includes("Carregando dados do circuito")
    && styleSource.includes("@keyframes circuitRankingSpin")
    && styleSource.includes(".circuitRankingLoadingCopy")
    && styleSource.includes(".circuitDetailActions button.editBtn")
    && styleSource.includes(".circuitDetailActions button.deleteBtn")
    && styleSource.includes(".proDashboard.theme-dark.playAppShell .circuitDetailActions button.editBtn"),
  "O detalhe do circuito perdeu o carregamento visível ou o contraste das ações nos temas claro e escuro."
);
assert.ok(
  mainSource.includes("setTournaments(optimisticTournaments)")
    && mainSource.includes("setTournaments(remainingTournaments)")
    && mainSource.includes("setTrashTournaments((current) => [")
    && mainSource.includes("protectConcurrentData: true")
    && mainSource.includes('directoryUpdate = directoryUpdate.eq("updated_at", item.updated_at)'),
  "Criar e mover para a lixeira voltaram a aguardar sincronizações secundárias antes de atualizar a tela."
);
assert.ok(
  publicArenaPresentationSource.includes("Quero me inscrever em")
    && mainSource.includes("registrationDeadline: details.registrationDeadline || \"\"")
    && styleSource.includes("PERFIL PÚBLICO DA ARENA — INSCRIÇÕES E MOBILE FINAL"),
  "A inscrição pública não preserva a data limite ou não encaminha ao WhatsApp da arena."
);
assert.ok(
  styleSource.includes(".publicPage.publicArenaPage .publicArenaHeader")
    && styleSource.includes("grid-template-columns: minmax(0, 1fr) !important;")
    && styleSource.includes("overflow-wrap: break-word !important;"),
  "O perfil público ainda pode comprimir o nome da arena no celular."
);
assert.ok(
  styleSource.includes("grid-template-columns: minmax(350px, 0.78fr) minmax(0, 1.22fr) !important;")
    && styleSource.includes("padding: 11px clamp(24px, 4vw, 58px) !important;"),
  "O cabeçalho do perfil público ainda ocupa altura excessiva no notebook."
);
assert.ok(
  styleSource.includes("grid-template-columns: minmax(240px, 0.58fr) minmax(0, 1.42fr) minmax(190px, auto) !important;")
    && styleSource.includes(".publicHeaderWithLogo:not(.publicArenaHeader)"),
  "O cabeçalho público do torneio ainda está desorganizado no notebook."
);
assert.ok(
  mainSource.includes("const saveQueueRef = useRef(Promise.resolve(true))")
    && mainSource.includes("queueTournamentSave(latestDataRef.current"),
  "As gravações do torneio podem terminar fora de ordem e sobrescrever dados mais novos."
);
assert.ok(
  mainSource.includes("submittedChangesRef.current.get(changeId)")
    && mainSource.includes("lastConfirmedDataVersionRef.current >= version")
    && mainSource.includes("}, 15000)")
    && mainSource.includes("confirmedAfterQueue"),
  "Uma confirmação Realtime da própria gravação pode voltar a ser exibida como erro entre dispositivos."
);
assert.ok(
  mainSource.includes('onReconcileOwnProfile={reconcileOwnProfile}')
    && mainSource.includes('await onReconcileOwnProfile?.()')
    && mainSource.includes('await supabase.auth.refreshSession()')
    && mainSource.includes('.maybeSingle()')
    && mainSource.slice(
      mainSource.indexOf("async function saveOrganizerProfile("),
      mainSource.indexOf("function toggleNewPublicInfo")
    ).includes('"Perfil não salvo"')
    && !mainSource.slice(
      mainSource.indexOf("async function saveOrganizerProfile("),
      mainSource.indexOf("function toggleNewPublicInfo")
    ).match(/\.select\("\*"\)\s*\.single\(\)/),
  "O salvamento do perfil deve reconciliar a conta dentro do Dashboard e sempre informar falhas ao organizador."
);
assert.ok(
  localAppStorageSource.includes("export function saveTournamentDraft(")
    && mainSource.includes("serverRevisionRef.current")
    && mainSource.includes("readTournamentDraft(userId, tournament)")
    && offlineStoreSource.includes('const PENDING_TOURNAMENT_STORE = "pending_tournaments"'),
  "Placares e confrontos ainda não possuem backup local durante uma falha de conexão."
);
assert.ok(
  mainSource.includes('.channel(`torneio360-collaboration-${user.id}`)')
    && mainSource.includes('"postgres_changes"')
    && mainSource.includes("syncPendingTournamentDrafts")
    && mainSource.includes("p_expected_revision: serverRevision")
    && mainSource.includes('.eq("revision", serverRevision)'),
  "Alterações simultâneas ainda podem sobrescrever uma versão mais nova sem sincronização."
);
assert.ok(
  collaborationMigration.includes("create or replace function public.replace_circuit_ranking_history")
    && collaborationMigration.includes("create or replace function public.set_tournament_order_safe")
    && collaborationMigration.includes("p_source_versions jsonb")
    && collaborationMigration.includes("tournament.updated_at is not distinct from source_version.updated_at")
    && collaborationMigration.includes("alter publication supabase_realtime add table"),
  "A migração não protege operações compostas ou não habilita atualização em tempo real."
);
assert.ok(
  mainSource.includes('"get_circuit_ranking_summary"')
    && mainSource.includes("normalizeCircuitSummaryRows")
    && mainSource.includes("usando histórico completo")
    && circuitRankingSummaryMigration.includes("security invoker")
    && circuitRankingSummaryMigration.includes("history.user_id = auth.uid()")
    && !circuitRankingSummaryMigration.includes("delete from")
    && !circuitRankingSummaryMigration.includes("update public.tournaments"),
  "A otimização dos circuitos não possui fallback seguro ou pode modificar dados oficiais."
);
assert.ok(
  serviceWorkerSource.includes('const STATIC_CACHE = "torneio360-app-shell-v3"')
    && serviceWorkerSource.includes("async function cacheApplicationShell()")
    && serviceWorkerSource.includes('path.startsWith("/assets/")')
    && serviceWorkerSource.includes('event.request.mode === "navigate"')
    && serviceWorkerSource.includes('await caches.match("/")'),
  "O aplicativo não possui uma base offline para reabrir a interface sem conexão."
);

const nonOverlappingMerge = mergeConcurrentTournamentData(
  { name: "Torneio", settings: { court: "1", category: "A" } },
  { name: "Torneio local", settings: { court: "1", category: "A" } },
  { name: "Torneio", settings: { court: "2", category: "A" } }
);
assert.deepEqual(nonOverlappingMerge.conflicts, [], "Campos diferentes deveriam ser unidos automaticamente.");
assert.equal(nonOverlappingMerge.data.name, "Torneio local");
assert.equal(nonOverlappingMerge.data.settings.court, "2");

const scoreMerge = mergeConcurrentTournamentData(
  { scores: [{ home: 0, away: 0 }, { home: 0, away: 0 }] },
  { scores: [{ home: 6, away: 2 }, { home: 0, away: 0 }] },
  { scores: [{ home: 0, away: 0 }, { home: 4, away: 6 }] }
);
assert.deepEqual(scoreMerge.conflicts, [], "Placares de jogos diferentes deveriam ser unidos automaticamente.");
assert.deepEqual(scoreMerge.data.scores, [{ home: 6, away: 2 }, { home: 4, away: 6 }]);

const sameFieldConflict = mergeConcurrentTournamentData(
  { score: 0 },
  { score: 6 },
  { score: 7 }
);
assert.deepEqual(sameFieldConflict.conflicts, ["score"], "O mesmo campo alterado em dois dispositivos deve gerar conflito explícito.");
assert.equal(sameFieldConflict.data.score, 6, "A alteração que está sendo salva por último deve prevalecer automaticamente.");

const intentionalScoreRemovalMerge = mergeConcurrentTournamentData(
  {
    schedule: [[{
      matchKey: "round-1-game-1",
      ids1: [1],
      ids2: [2],
      team1: ["Ana"],
      team2: ["Bia"],
      s1: 4,
      s2: 2,
      courtNumberOverride: "1",
    }]],
  },
  {
    schedule: [[{
      matchKey: "round-1-game-1",
      ids1: [1],
      ids2: [2],
      team1: ["Ana"],
      team2: ["Bia"],
      s1: "",
      s2: 2,
      courtNumberOverride: "1",
    }]],
  },
  {
    schedule: [[{
      matchKey: "round-1-game-1",
      ids1: [1],
      ids2: [2],
      team1: ["Ana"],
      team2: ["Bia"],
      s1: 4,
      s2: 2,
      courtNumberOverride: "3",
    }]],
  }
);
assert.equal(
  intentionalScoreRemovalMerge.data.schedule[0][0].s1,
  "",
  "A remoção manual do placar deve prevalecer mesmo quando outro dispositivo altera outro campo."
);
assert.equal(
  intentionalScoreRemovalMerge.data.schedule[0][0].courtNumberOverride,
  "3",
  "A sincronização deve manter também a alteração independente feita no outro dispositivo."
);

const createSuper20Data = () => ({
  players: {
    men: Array.from({ length: 10 }, (_, index) => `Homem ${index + 1}`),
    women: Array.from({ length: 10 }, (_, index) => `Mulher ${index + 1}`),
  },
  schedule: super20MixedTemplate.map((round) => round.map((players, courtIndex) => ({
    court: courtIndex + 1,
    ids1: [players[0] - 1, players[1] - 1],
    ids2: [players[2] - 1, players[3] - 1],
    team1: [],
    team2: [],
    s1: "",
    s2: "",
  }))),
  brackets: [],
});
const super20BaseData = createSuper20Data();
const super20LocalData = structuredClone(super20BaseData);
const super20RemoteData = structuredClone(super20BaseData);
super20LocalData.schedule[2][3].s1 = 6;
super20LocalData.schedule[2][3].s2 = 4;
super20RemoteData.schedule[7][1].s1 = 3;
super20RemoteData.schedule[7][1].s2 = 6;
const super20ConcurrentMerge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  super20RemoteData
);
assert.equal(super20ConcurrentMerge.data.schedule.length, 10, "A sincronização não pode reduzir as rodadas do Super 20.");
assert.ok(
  super20ConcurrentMerge.data.schedule.every((round) => round.length === 5),
  "A sincronização não pode reduzir os cinco jogos de cada rodada do Super 20."
);
assert.deepEqual(
  [super20ConcurrentMerge.data.schedule[2][3].s1, super20ConcurrentMerge.data.schedule[2][3].s2],
  [6, 4],
  "O placar alterado no primeiro aparelho deve permanecer."
);
assert.deepEqual(
  [super20ConcurrentMerge.data.schedule[7][1].s1, super20ConcurrentMerge.data.schedule[7][1].s2],
  [3, 6],
  "O placar alterado no segundo aparelho deve permanecer."
);
const reorderedSuper20Data = structuredClone(super20BaseData);
[reorderedSuper20Data.schedule[2][0], reorderedSuper20Data.schedule[2][1]] = [
  reorderedSuper20Data.schedule[2][1],
  reorderedSuper20Data.schedule[2][0],
];
const structuralSuper20Merge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  reorderedSuper20Data
);
assert.deepEqual(
  structuralSuper20Merge.data.schedule[2],
  super20LocalData.schedule[2],
  "Uma tabela reorganizada não pode receber placares por índice em confrontos diferentes."
);
const roundReorderedSuper20Data = structuredClone(super20BaseData);
[roundReorderedSuper20Data.schedule[0], roundReorderedSuper20Data.schedule[1]] = [
  roundReorderedSuper20Data.schedule[1],
  roundReorderedSuper20Data.schedule[0],
];
const roundStructuralMerge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  roundReorderedSuper20Data
);
assert.deepEqual(
  roundStructuralMerge.data.schedule,
  super20LocalData.schedule,
  "A troca de rodadas não pode criar uma tabela híbrida nem duplicar confrontos."
);
assert.equal(
  preservesTournamentCriticalData(super20LocalData, reorderedSuper20Data),
  false,
  "A protecao deve rejeitar uma reparacao que troca os confrontos do Super 20."
);
const bracketBase = {
  brackets: [{
    matchKey: "final",
    source1: "semi-1",
    source2: "semi-2",
    team1: ["Ana", "Bia"],
    team2: ["Clara", "Duda"],
    s1: "",
    s2: "",
  }],
};
const bracketLocal = structuredClone(bracketBase);
bracketLocal.brackets[0].s1 = 6;
bracketLocal.brackets[0].s2 = 4;
const bracketRemote = structuredClone(bracketBase);
bracketRemote.brackets[0].source1 = "semi-3";
bracketRemote.brackets[0].team1 = ["Eva", "Fabi"];
const bracketStructuralMerge = mergeConcurrentTournamentData(bracketBase, bracketLocal, bracketRemote);
assert.deepEqual(
  bracketStructuralMerge.data.brackets,
  bracketLocal.brackets,
  "Um placar nao pode ser reaproveitado em participantes diferentes da mesma chave."
);
assert.ok(
  preservesTournamentCriticalData(super20LocalData, structuredClone(super20LocalData)),
  "Uma normalização segura deve preservar todos os placares do Super 20."
);
const unsafeSuper20Repair = structuredClone(super20LocalData);
unsafeSuper20Repair.schedule[2][3].s1 = "";
assert.equal(
  preservesTournamentCriticalData(super20LocalData, unsafeSuper20Repair),
  false,
  "Uma reparação que apaga placar do Super 20 precisa ser bloqueada."
);
const missingUnscoredGame = structuredClone(super20BaseData);
missingUnscoredGame.schedule[0].pop();
const missingGameSafety = inspectTournamentScoreRegression(super20BaseData, missingUnscoredGame);
assert.equal(
  missingGameSafety.unsafe,
  true,
  "Uma versão parcial não pode remover nem mesmo um jogo que ainda não recebeu placar."
);
assert.equal(missingGameSafety.removedGames, 1);
const missingRoundData = structuredClone(super20BaseData);
missingRoundData.schedule = [missingRoundData.schedule.flat()];
const missingRoundSafety = inspectTournamentScoreRegression(super20BaseData, missingRoundData);
assert.equal(
  missingRoundSafety.removedRounds > 0,
  true,
  "Uma versão nova não pode reduzir silenciosamente as rodadas já salvas."
);
const duplicateGameBefore = {
  schedule: [[
    { team1: ["Ana"], team2: ["Bia"], s1: 4, s2: 2 },
    { team1: ["Ana"], team2: ["Bia"], s1: 4, s2: 1 },
  ]],
};
const duplicateGameAfter = structuredClone(duplicateGameBefore);
duplicateGameAfter.schedule[0][1].s1 = "";
duplicateGameAfter.schedule[0][1].s2 = "";
assert.equal(
  inspectTournamentScoreRegression(duplicateGameBefore, duplicateGameAfter).removedScores,
  1,
  "Dois confrontos iguais devem proteger cada placar separadamente."
);
const editedCompletedScore = structuredClone(super20LocalData);
editedCompletedScore.schedule[2][3].s1 = 4;
editedCompletedScore.schedule[2][3].s2 = 6;
assert.equal(
  inspectTournamentScoreRegression(super20LocalData, editedCompletedScore).unsafe,
  false,
  "A proteção não pode impedir a correção normal de um placar preenchido."
);
const bracketParticipantProgression = structuredClone(bracketBase);
bracketParticipantProgression.brackets[0].team1 = ["Eva", "Fabi"];
assert.equal(
  inspectTournamentScoreRegression(bracketBase, bracketParticipantProgression).unsafe,
  false,
  "A proteção não pode bloquear o preenchimento normal dos participantes de uma chave."
);
assert.ok(
  mainSource.includes('.rpc("save_tournament_snapshot_safe"')
    && mainSource.includes('inspectTournamentScoreRegression(serverTournament.data, persistedData)')
    && tournamentGuardMigration.includes("create trigger tournaments_protect_critical_data")
    && tournamentGuardMigration.includes("TOURNAMENT_CRITICAL_DATA_REGRESSION")
    && tournamentGuardMigration.includes("count_tournament_rounds")
    && tournamentGuardMigration.includes("p_allow_critical_reset"),
  "A gravação ainda não está comparando a nuvem nem protegida atomicamente no banco."
);
assert.ok(
  serverRevisionMigration.includes("add column if not exists revision bigint not null default 0")
    && serverRevisionMigration.includes("new.revision := coalesce(old.revision, 0) + 1")
    && serverRevisionMigration.includes("new.updated_at := clock_timestamp()")
    && serverRevisionMigration.includes("add column if not exists last_change_id uuid"),
  "A versão de concorrência ainda depende do relógio dos aparelhos."
);
assert.ok(
  serverRevisionMigration.includes("create trigger tournaments_bump_collaboration_revision")
    && serverRevisionMigration.includes("create trigger circuits_bump_collaboration_revision"),
  "As revisões do servidor não estão ligadas às tabelas de torneios e circuitos."
);
assert.ok(
  mainSource.includes('.eq("revision", expectedRevision)')
    && mainSource.includes("selectedRef.current")
    && mainSource.includes("Sincronizando a alteração mais recente...")
    && !mainSource.includes("Qual versão deseja manter?")
    && !mainSource.includes("Usar versão da nuvem")
    && !mainSource.includes("Manter versão deste aparelho"),
  "A sincronização ainda pode pedir escolha manual ou aceitar uma versão antiga."
);
assert.ok(
  confirmationDialogsSource.includes("function ConfirmRegenerationModal")
    && mainSource.includes("function requestShuffleNames()")
    && mainSource.includes("function requestGenerate()")
    && mainSource.includes("function requestGenerateBrackets()")
    && mainSource.includes('action: "shuffle"')
    && mainSource.includes('action: "generate"')
    && mainSource.includes('action: "brackets"')
    && mainSource.includes('action: "group-score"')
    && mainSource.includes("Placares e resultados já preenchidos nas chaves podem ser removidos."),
  "A repetição de sorteios ou gerações não pede confirmação sobre os dados que podem mudar."
);
assert.ok(
  formatExplanationButtonSource.includes("export default function FormatExplanationButton")
    && formatExplanationButtonSource.includes("export function SimpleFormatInfoButton")
    && formatExplanationButtonSource.includes("Como funciona com ${playerCount} jogadores")
    && !mainSource.includes('<div className="infoBox">\n          <p><strong>Todos contra todos:</strong>'),
  "A modalidade Simples não está usando o mesmo padrão roxo de explicação dos demais formatos."
);
assert.ok(
  tournamentFormatHelpSource.includes("export function ParallelDisputeChoice")
    && tournamentFormatHelpSource.includes("Realizar {ordinal} disputa paralela?")
    && tournamentDataNormalizationSource.includes("secondRepechageEnabled: true")
    && tournamentDataNormalizationSource.includes("thirdRepechageEnabled: false")
    && tournamentDataNormalizationSource.includes('typeof sourceCupConfig.secondRepechageEnabled === "boolean"')
    && mainSource.includes("function ensureCearenseParallelChoices")
    && mainSource.includes("isCearenseSecondParallelEnabled(data)")
    && mainSource.includes("isCearenseThirdParallelEnabled(data)"),
  "As escolhas obrigatórias das disputas paralelas ou a compatibilidade com torneios antigos estão incompletas."
);
assert.ok(
  cupFormatSummarySource.includes("parallelOpeningRound: getEliminationRoundName(parallelBracketSize)")
    && cupFormatSummarySource.includes("const thirdParallelSources = thirdParallelPlan")
    && cupFormatSummarySource.includes("const thirdParallel = {")
    && tournamentFormatHelpSource.includes("Todos os 3º colocados são ordenados primeiro")
    && tournamentFormatHelpSource.includes("summary.thirdParallel.sourceRound")
    && tournamentFormatHelpSource.includes("summary.thirdParallel.matchCount")
    && tournamentFormatHelpSource.includes("O que acontece ao escolher Sim ou Não"),
  "As explicações das disputas paralelas deixaram de detalhar participantes, ordem, chave, BYEs ou efeitos da escolha."
);
assert.ok(
  tournamentLifecycleSource.includes('phase === "repechage" && !isCearenseSecondParallelEnabled(data)')
    && tournamentLifecycleSource.includes('phase === "thirdParallel" && !isCearenseThirdParallelEnabled(data)')
    && mainSource.includes("const secondParallelVisible = isCearenseSecondParallelEnabled(data)")
    && mainSource.includes("const thirdParallelVisible = isCearenseThirdParallelEnabled(data)")
    && styleSource.includes(".parallelChoiceCard")
    && styleSource.includes(".parallelChoiceOptions button.selected.yes")
    && styleSource.includes("html[data-theme=\"dark\"] .parallelChoiceOptions button.selected.no"),
  "Disputas desativadas ainda podem aparecer, bloquear o encerramento ou perder a adaptação de tema."
);
assert.ok(
  shuffleAnimationSource.includes("export const SHUFFLE_DURATION_SECONDS = 5")
    && shuffleAnimationSource.includes("export function moveShuffleAnimationItems(items)")
    && mainSource.includes("items: moveShuffleAnimationItems(prev.items)")
    && shuffleAnimationSource.includes("window.innerWidth <= 760")
    && mainSource.includes("{shuffleOverlay && createPortal(")
    && styleSource.includes("z-index: 20000")
    && styleSource.includes("animation: shuffleProgressFill 5s linear forwards")
    && styleSource.includes("max-width: 29vw"),
  "O sorteio visual não está animado por 5 segundos ou ainda pode ficar coberto no celular."
);
assert.ok(
  shuffleVideoExportSource.includes("export function createShuffleVideoSnapshot")
    && shuffleVideoExportSource.includes("export async function createShuffleVideoFile")
    && shuffleVideoModalSource.includes("export default function ShuffleVideoModal")
    && shuffleVideoExportSource.includes("function getShuffleVideoMotionOrder")
    && shuffleVideoExportSource.includes("const previousOrder = getShuffleVideoMotionOrder")
    && shuffleVideoExportSource.includes("const nextOrder = getShuffleVideoMotionOrder")
    && mainSource.includes("copy.lastShuffleVideo = videoSnapshot")
    && shuffleVideoModalSource.includes("Continuar sem gerar")
    && shuffleVideoModalSource.includes("Baixar vídeo")
    && !shuffleVideoModalSource.includes("Compartilhar vídeo")
    && !shuffleVideoExportSource.includes("function shareShuffleVideo")
    && shuffleVideoExportSource.includes("const SHUFFLE_VIDEO_WIDTH = 720")
    && shuffleVideoExportSource.includes("const SHUFFLE_VIDEO_HEIGHT = 1280")
    && styleSource.includes(".shuffleVideoOverlay")
    && styleSource.includes("html[data-theme=\"dark\"] .shuffleVideoModal")
    && styleSource.includes("width: min(240px, 72vw)")
    && styleSource.includes("max-height: calc(100dvh - 20px)")
    && styleSource.includes("html[data-theme=\"dark\"] .confirmBox"),
  "O vídeo do sorteio perdeu o embaralhamento real, o download confiável, o formato vertical ou a adaptação dos modais aos temas e ao celular."
);
assert.ok(
  styleSource.includes("JOGOS NO CELULAR — CABEÇALHO EM DUAS LINHAS")
    && styleSource.includes('"match-meta"')
    && styleSource.includes('"match-controls"')
    && styleSource.includes('"match-teams"')
    && styleSource.includes("padding-bottom: calc(92px + env(safe-area-inset-bottom)) !important"),
  "Os cartões dos jogos podem voltar a sobrepor fase, status, quadra e chamada no celular."
);
assert.ok(
  mainSource.includes("Salvando antes de sair...")
    && mainSource.includes("Sincronização pendente")
    && mainSource.includes("A cópia local durável já foi criada"),
  "O torneio deixou de aguardar o salvamento ou voltou a prender a tela após criar a cópia local durável."
);
assert.ok(
  tournamentCircuitManagerSource.includes("function TournamentCircuitManagerModal")
    && tournamentCircuitManagerSource.includes("+ Adicionar ao circuito")
    && tournamentCircuitManagerSource.includes("Gerenciar circuitos")
    && mainSource.includes("saveTournamentCircuitMembership")
    && tournamentCircuitManagerSource.includes("Criar novo circuito com este torneio")
    && styleSource.includes(".tournamentCircuitOverlay")
    && styleSource.includes("max-height: calc(100dvh - 20px)")
    && styleSource.includes('html[data-theme="dark"] .tournamentCircuitDialog'),
  "O atalho do ranking para circuitos perdeu o gerenciamento, a criação guiada ou a adaptação aos temas e ao celular."
);
assert.ok(
  circuitRankingSettingsSource.includes("manualParticipants: sourceManualParticipants.map")
    && circuitRankingSettingsSource.includes("function applyCircuitManualParticipants")
    && circuitExtraPointsPanelSource.includes('Adicionar ${participantLabel} manualmente')
    && circuitExtraPointsPanelSource.includes("Participantes e resultados complementares")
    && circuitExtraPointsPanelSource.includes("Somar ao atleta existente?")
    && circuitExtraPointsPanelSource.includes("Cadastros manuais")
    && circuitRankingAggregationSource.includes("applyCircuitManualParticipants(groups, rankingSettings)")
    && mainSource.includes("getCircuitPlacementColumns(rankingSettings, { includeManual: true })")
    && !mainSource.includes('columns.push({ key: "manualPoints", label: "Manual" })')
    && styleSource.includes(".circuitManualParticipantContent")
    && styleSource.includes("--bracket-node-height: 226px"),
  "A inclusão manual no ranking ou o espaçamento seguro dos confrontos ficou incompleto."
);
assert.ok(
  publicArenaMigration.includes("jsonb_set(")
    && publicArenaMigration.includes("'{displayOrder}'"),
  "A reordenação pode substituir o objeto do torneio em vez de preservar placares e confrontos."
);

const timerTestGame = { inProgress: true, matchTimerElapsedSeconds: 30 };
const timerStart = Date.parse("2026-08-16T12:00:00.000Z");
startMatchTimer(timerTestGame, timerStart);
assert.equal(getMatchElapsedSeconds(timerTestGame, timerStart + 15000), 45, "O cronômetro não soma o trecho ativo ao tempo salvo.");
const expiredTimerTestGame = {
  inProgress: true,
  matchTimerStartedAt: new Date(timerStart).toISOString(),
  matchTimerFirstStartedAt: new Date(timerStart).toISOString(),
};
assert.equal(
  getMatchElapsedSeconds(expiredTimerTestGame, timerStart + 7200000),
  MAX_MATCH_TIMER_SECONDS,
  "O cronômetro ultrapassou o limite de segurança de 59 minutos."
);
assert.equal(
  capExpiredMatchTimer(expiredTimerTestGame, timerStart + 7200000),
  true,
  "O cronômetro vencido não foi paralisado."
);
assert.equal(expiredTimerTestGame.inProgress, false, "O jogo vencido continuou marcado como em andamento.");
assert.equal(expiredTimerTestGame.matchTimerElapsedSeconds, MAX_MATCH_TIMER_SECONDS, "O tempo vencido não foi fixado em 59 minutos.");
assert.equal(expiredTimerTestGame.matchTimerStartedAt, undefined, "O início ativo permaneceu após o limite de segurança.");
assert.equal(
  getMatchElapsedSeconds({
    matchTimerElapsedSeconds: 45,
    matchTimerStartedAt: new Date(timerStart).toISOString(),
    matchTimerFinishedAt: new Date(timerStart + 45000).toISOString(),
    inProgress: true,
  }, timerStart + 3600000),
  45,
  "Uma partida finalizada voltou a acumular tempo por causa de estado antigo."
);
stopMatchTimer(timerTestGame, { finished: true, now: timerStart + 15000 });
assert.equal(timerTestGame.matchTimerElapsedSeconds, 45, "O cronômetro não preserva o tempo quando o placar é finalizado.");
assert.equal(formatMatchDuration(3661), "61:01", "O cronômetro não mantém minutos acima de 59 no formato MM:SS.");
assert.equal(formatMatchDuration(-10), "00:00", "O cronômetro não deve exibir duração negativa.");
assert.equal(startMatchTimer(null), null, "O cronômetro deve tolerar jogo ausente.");
const resetTimerTestGame = {
  matchTimerStartedAt: "2026-08-16T12:00:00.000Z",
  matchTimerFirstStartedAt: "2026-08-16T12:00:00.000Z",
  matchTimerFinishedAt: "2026-08-16T12:01:00.000Z",
  matchTimerElapsedSeconds: 60,
};
resetMatchTimer(resetTimerTestGame);
assert.deepEqual(resetTimerTestGame, {}, "A redefinição do jogo deve remover todos os dados do cronômetro.");
assert.ok(
  tournamentRuntimeAdaptersSource.includes("function TournamentTimingSummary")
    && tournamentSummaryViewsSource.includes("export function TournamentTimingSummaryView")
    && tournamentSummaryViewsSource.includes("export function TournamentMatchStatusSummaryView")
    && tournamentOperationsSource.includes("complete: operationalGames.length > 0")
    && tournamentOperationsSource.includes("if (!getTournamentTimingSummary(data).complete) return playTimeById")
    && tournamentOperationsSource.includes("matchTimerFinishedAt")
    && matchScheduleSource.includes('className="matchStatusTimer"')
    && rankingShareExportSource.includes('playTimeSeconds: "Tempo em jogo"')
    && rankingShareExportSource.includes("Tempo geral do torneio")
    && styleSource.includes(".matchStatusTimer")
    && styleSource.includes("html[data-theme=\"dark\"] .tournamentTimingSummary")
    && styleSource.includes(".bracketTree .matchStatusTimer"),
  "A cronometragem perdeu persistência, segurança contra dados incompletos, ranking, compartilhamento ou contraste responsivo."
);
assert.ok(
  tournamentErrorBoundarySource.includes("export default class TournamentErrorBoundary")
    && tournamentErrorBoundarySource.includes("Os dados salvos dessa edição precisam ser revisados")
    && mainSource.includes("<TournamentErrorBoundary"),
  "A proteção visual contra falhas ao abrir um torneio está ausente."
);

assert.deepEqual(
  getSharedGameParticipants(
    { ids1: [3], team1: ["Ana"], ids2: [8], team2: ["Bia"] },
    { ids1: [3], team1: ["Ana"], ids2: [11], team2: ["Carla"] }
  ).map((participant) => participant.name),
  ["Ana"],
  "O sistema não reconhece o mesmo participante em dois jogos."
);
assert.equal(
  cleanSpeechName("  Ana   +   Bia  "),
  "Ana  e  Bia",
  "A extração da chamada por voz alterou a limpeza dos nomes."
);
assert.equal(
  formatTeamForSpeech(["Ana", "Bia"]),
  "Ana e Bia",
  "A extração da chamada por voz alterou a leitura da dupla."
);
assert.equal(
  getGameSpeechText(
    { team1: ["Ana"], team2: ["Bia"], court: 0, groupName: "Grupo A" },
    { courtNumbers: ["4"], includeClosing: false }
  ),
  "Atenção atletas. Grupo A.  Quadra 4. Ana contra Bia.",
  "A extração da chamada por voz alterou o anúncio do jogo."
);
assert.equal(repeatText("Jogo.", 2), "Jogo. Jogo.", "A repetição da chamada por voz foi alterada.");
assert.equal(getCollaborationRevision({ revision: "7" }), 7, "A revisão colaborativa válida não foi preservada.");
assert.equal(getCollaborationRevision({ revision: -1 }), null, "Uma revisão colaborativa inválida foi aceita.");
assert.ok(
  compareCollaborationVersions({ revision: 8 }, { revision: 7 }) > 0,
  "A comparação colaborativa deixou uma versão antiga superar a mais nova."
);
assert.equal(
  mergeRealtimeTournamentRow(
    { id: "torneio", revision: 8, data: { score: 6 } },
    { id: "torneio", revision: 7, data: { score: 1 } }
  ).data.score,
  6,
  "Uma atualização antiga substituiu dados mais novos do torneio."
);
assert.deepEqual(
  mergeRealtimeTournamentRow(
    { id: "torneio", revision: 7, data: { score: 6 } },
    { id: "torneio", revision: 8, name: "Atualizado", data: {} }
  ),
  { id: "torneio", revision: 8, name: "Atualizado", data: { score: 6 } },
  "Uma atualização parcial apagou os dados completos já carregados."
);
assert.deepEqual(
  mergeRealtimeTournamentRow(
    {
      id: "torneio",
      revision: 7,
      data: { schedule: [[{ s1: 4, s2: 2 }]], eventName: "Antes" },
      __summary: false,
    },
    {
      id: "torneio",
      revision: 8,
      data: { eventName: "Depois" },
      __summary: true,
    }
  ),
  {
    id: "torneio",
    revision: 8,
    data: { schedule: [[{ s1: 4, s2: 2 }]], eventName: "Depois" },
    __summary: false,
  },
  "Um resumo mais novo apagou jogos e placares completos já carregados."
);
assert.equal(tournamentDataEquals({ score: 6 }, { score: 6 }), true, "Dados idênticos deixaram de ser reconhecidos.");
assert.equal(
  tournamentMutationDataEquals(
    { score: 6, lifecycleStatus: "active" },
    { score: 6, lifecycleStatus: "finished" }
  ),
  true,
  "O status automático passou a gerar uma falsa alteração dos dados do torneio."
);
const stableGame = (id, s1, s2) => ({
  matchKey: id,
  ids1: [1],
  ids2: [2],
  team1: ["Ana"],
  team2: ["Bia"],
  s1,
  s2,
});
const protectedScoreRegression = inspectTournamentScoreRegression(
  { schedule: [[stableGame("j1", 4, 2), stableGame("j2", 4, 1), stableGame("j3", 4, 3)]] },
  { schedule: [[stableGame("j1", "", ""), stableGame("j2", "", ""), stableGame("j3", 4, 3)]] }
);
assert.equal(protectedScoreRegression.unsafe, true, "A remoção em massa de placares deixou de ser bloqueada.");
assert.equal(protectedScoreRegression.removedScores, 2, "A proteção contou incorretamente os placares removidos.");
assert.equal(
  inspectTournamentScoreRegression(
    { schedule: [[stableGame("j1", 4, 2), stableGame("j2", 4, 1), stableGame("j3", 4, 3)]] },
    {}
  ).unsafe,
  true,
  "A ausência completa da tabela deixou de ser tratada como perda de placares."
);
assert.equal(
  inspectTournamentScoreRegression(
    { schedule: [[stableGame("j1", 4, 2), stableGame("j2", 4, 1), stableGame("j3", 4, 3)]] },
    { schedule: [[stableGame("j1", "", ""), stableGame("j2", 4, 1), stableGame("j3", 4, 3)]] }
  ).unsafe,
  true,
  "A remoção de um único placar deixou de ser bloqueada."
);
const renamedScoredGame = { ...stableGame("j1", 4, 2), team1: ["Ana Maria"], team2: ["Bia Souza"] };
assert.equal(
  inspectTournamentScoreRegression(
    { schedule: [[stableGame("j1", 4, 2), stableGame("j2", 4, 1)]] },
    { schedule: [[renamedScoredGame, stableGame("j2", 4, 1)]] }
  ).unsafe,
  false,
  "A correção do nome de um atleta com o mesmo identificador passou a bloquear o salvamento."
);
assert.ok(
  tournamentHistoryMigration.includes("create table if not exists public.tournament_data_history")
    && tournamentHistoryMigration.includes("before update of data on public.tournaments")
    && tournamentHistoryMigration.includes("old.data"),
  "O banco deixou de arquivar a versão anterior dos dados antes de uma alteração."
);
assert.equal(
  getSharedGameParticipants(
    { ids1: [3], team1: ["João"], ids2: [], team2: [] },
    { ids1: [9], team1: ["João"], ids2: [], team2: [] }
  ).length,
  0,
  "O sistema confunde homônimos cadastrados como participantes diferentes."
);
assert.deepEqual(
  getGameParticipantIdentityEntries({ ids1: [4], team1: ["Bárbara"], ids2: [], team2: [] }),
  [{ key: "participant:4", name: "Bárbara" }],
  "A identificação interna do participante não preserva o nome exibido."
);
const tournamentOperationsForTest = createTournamentOperations();
const activeCourtDataForTest = {
  courtNumbers: ["1", "2", "3", "4"],
  schedule: [[{
    court: 1,
    ids1: [1],
    team1: ["Ana"],
    ids2: [2],
    team2: ["Bia"],
    s1: "",
    s2: "",
    inProgress: true,
  }]],
};
assert.equal(
  tournamentOperationsForTest.getTournamentActiveCourtUsages(
    { id: "court-test", name: "Teste", data: activeCourtDataForTest },
    activeCourtDataForTest
  )[0]?.courtNumber,
  "1",
  "A Central deixou de reconhecer a quadra inicial de um jogo em andamento."
);
applyCourtNumberToGame(activeCourtDataForTest.schedule[0][0], "3", activeCourtDataForTest.courtNumbers);
assert.equal(
  tournamentOperationsForTest.getTournamentActiveCourtUsages(
    { id: "court-test", name: "Teste", data: activeCourtDataForTest },
    activeCourtDataForTest
  )[0]?.courtNumber,
  "3",
  "A Central continuou ocupando a quadra antiga depois da troca em um jogo em andamento."
);
applyCourtNumberToGame(activeCourtDataForTest.schedule[0][0], "1", activeCourtDataForTest.courtNumbers);
assert.equal(
  tournamentOperationsForTest.getTournamentActiveCourtUsages(
    { id: "court-test", name: "Teste", data: activeCourtDataForTest },
    activeCourtDataForTest
  )[0]?.courtNumber,
  "1",
  "A Central não reconheceu a volta intencional para o número estrutural original."
);
assert.ok(
  mainSource.includes("venueCourtUsages={activeVenueUsages}")
    && mainSource.includes("const currentTournamentUsages = getTournamentActiveCourtUsages(")
    && mainSource.includes("getTournamentActiveCourtUsages({ ...tournament, data: nextData }, nextData)"),
  "A troca de quadra deixou de atualizar imediatamente a Central e os outros torneios abertos."
);
assert.ok(
  mainSource.includes("setOperationalGameState(target, true, courtNumber)")
    && mainSource.includes("return getAvailableCentralCourtNumbers(usages)[0] || null")
    && matchControlsSource.includes("Usar Quadra {number} livre"),
  "A chamada de jogo deixou de persistir a quadra visível ou voltou a inventar uma quadra fora da Central."
);
assert.ok(
  mainSource.includes("occupied: activeOccupiedCourtNumbers.size")
    && courtCenterModalSource.includes("<strong>{usageByNumber.size}</strong> em uso"),
  "A Central voltou a contar jogos repetidos como se fossem quadras físicas diferentes."
);
const cappedTournamentTimer = tournamentOperationsForTest.capExpiredTournamentMatchTimers({
  schedule: [[{
    ids1: [1],
    team1: ["Ana"],
    ids2: [2],
    team2: ["Bia"],
    s1: "",
    s2: "",
    inProgress: true,
    matchTimerStartedAt: new Date(timerStart).toISOString(),
    matchTimerFirstStartedAt: new Date(timerStart).toISOString(),
  }]],
}, timerStart + 7200000);
assert.equal(cappedTournamentTimer.cappedCount, 1, "O torneio não identificou o cronômetro vencido.");
assert.equal(cappedTournamentTimer.data.schedule[0][0].inProgress, false, "O torneio não paralisou o jogo vencido.");
assert.equal(cappedTournamentTimer.data.schedule[0][0].matchTimerElapsedSeconds, MAX_MATCH_TIMER_SECONDS, "O torneio não preservou 59 minutos no jogo vencido.");
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    schedule: [[
      { ids1: [1], team1: ["Ana"], ids2: [2], team2: ["Bia"], s1: 4, s2: 1 },
      { ids1: [3], team1: ["Carla"], ids2: [4], team2: ["Dora"], s1: "", s2: "", inProgress: true },
      { ids1: [5], team1: ["Eva"], ids2: [6], team2: ["Fê"], s1: "", s2: "" },
    ]],
  }),
  { waiting: 1, inProgress: 1, finished: 1, total: 3 },
  "O resumo operacional deixou de separar jogos aguardando, em andamento e finalizados."
);
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    cupConfig: { format: "playranking" },
    brackets: [
      { phase: "main", matchKey: "main_semifinal_1", ids1: [1], team1: ["Ana"], ids2: [2], team2: ["Bia"], s1: "", s2: "" },
      { phase: "main", matchKey: "main_semifinal_2", ids1: [3], team1: ["Carla"], ids2: [4], team2: ["Dora"], s1: 4, s2: 2 },
      { phase: "main", matchKey: "main_final_1", source1: "main_semifinal_1", source2: "main_semifinal_2", ids1: [], ids2: [], team1: null, team2: null, s1: "", s2: "" },
      { phase: "main", matchKey: "main_bye_1", ids1: [5], team1: ["Eva"], ids2: [], team2: ["BYE"], s1: "", s2: "", isBye: true },
    ],
  }),
  { waiting: 2, inProgress: 0, finished: 1, total: 3 },
  "Uma partida futura da copa deixou de entrar em A chamar ou um BYE voltou a ser contado."
);
const disabledCearenseParallelData = {
  cupConfig: {
    format: "cearense",
    secondRepechageEnabled: false,
    thirdRepechageEnabled: false,
  },
  brackets: [
    { phase: "main", matchKey: "main_final_1", ids1: [1], team1: ["Ana"], ids2: [2], team2: ["Bia"], s1: 4, s2: 1 },
    {
      phase: "repechage",
      matchKey: "repechage_sf_1",
      ids1: [3],
      team1: ["Carla"],
      ids2: [4],
      team2: ["Dora"],
      s1: "",
      s2: "",
      inProgress: true,
      matchTimerStartedAt: new Date(timerStart).toISOString(),
      matchTimerFirstStartedAt: new Date(timerStart).toISOString(),
    },
    { phase: "thirdParallel", matchKey: "thirdParallel_sf_1", ids1: [5], team1: ["Eva"], ids2: [6], team2: ["Fê"], s1: "", s2: "" },
    { phase: "repechage", matchKey: "repechage_bye_1", ids1: [7], team1: ["Gabi"], ids2: [], team2: ["BYE"], s1: "", s2: "", isBye: true },
  ],
};
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary(disabledCearenseParallelData),
  { waiting: 0, inProgress: 0, finished: 1, total: 1 },
  "Disputas paralelas desativadas no Campeonato Cearense não podem aparecer no resumo operacional."
);
assert.equal(
  tournamentOperationsForTest.getTournamentActiveCourtUsages(
    { id: "cearense-disabled", name: "Cearense", data: disabledCearenseParallelData },
    disabledCearenseParallelData
  ).length,
  0,
  "Uma disputa paralela desativada não pode manter quadra ocupada."
);
assert.equal(
  tournamentOperationsForTest.getNextMatchTimerExpiryDelay(disabledCearenseParallelData, timerStart + 7200000),
  null,
  "O cronômetro de uma disputa paralela desativada não pode interferir no torneio."
);
const disabledParallelTimerCap = tournamentOperationsForTest.capExpiredTournamentMatchTimers(
  disabledCearenseParallelData,
  timerStart + 7200000
);
assert.equal(disabledParallelTimerCap.cappedCount, 0, "Uma fase desativada não pode ser alterada pelo limite dos cronômetros.");
assert.equal(disabledParallelTimerCap.data.brackets[1].inProgress, true, "Os dados preservados de uma fase desativada foram modificados.");
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    ...disabledCearenseParallelData,
    cupConfig: {
      ...disabledCearenseParallelData.cupConfig,
      secondRepechageEnabled: true,
      thirdRepechageEnabled: true,
    },
  }),
  { waiting: 1, inProgress: 1, finished: 1, total: 3 },
  "Disputas paralelas ativadas devem continuar participando do resumo operacional, sem somar BYEs."
);
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    ...disabledCearenseParallelData,
    cupConfig: {
      format: "cearense-individual",
      secondRepechageEnabled: false,
      thirdRepechageEnabled: false,
    },
  }),
  { waiting: 0, inProgress: 0, finished: 1, total: 1 },
  "A Copa Cearense Individual deve ignorar as mesmas disputas paralelas desativadas."
);
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    ...disabledCearenseParallelData,
    cupConfig: { format: "playranking" },
  }),
  { waiting: 1, inProgress: 1, finished: 1, total: 3 },
  "As fases próprias dos outros modelos de copa não podem ser ocultadas pelas opções exclusivas do Cearense."
);
assert.deepEqual(
  tournamentOperationsForTest.getTournamentMatchStatusSummary({
    ...disabledCearenseParallelData,
    cupConfig: { format: "playranking" },
  }, {
    scope: "bracket",
    bracketMatchKeys: ["repechage_sf_1"],
  }),
  { waiting: 0, inProgress: 1, finished: 0, total: 1 },
  "O resumo de uma disputa eliminatória deve contar somente os jogos da chave aberta."
);
assert.deepEqual(
  tournamentOperationsForTest.getTournamentTimingSummary({
    schedule: [[{
      ids1: [1],
      team1: ["Ana"],
      ids2: [2],
      team2: ["Bia"],
      s1: 4,
      s2: 1,
      matchTimerFirstStartedAt: "2026-08-18T12:00:00.000Z",
      matchTimerFinishedAt: "2026-08-18T12:00:45.000Z",
      matchTimerElapsedSeconds: 45,
    }]],
  }, new Date("2026-08-18T13:00:00.000Z").getTime()),
  { timedGames: 1, durationSeconds: 45, complete: true },
  "O tempo geral deixou de somar somente os cronômetros finalizados das partidas."
);
const participantConflictsForTest = tournamentOperationsForTest.getInProgressParticipantConflicts(
  {
    courtNumbers: ["2", "3", "4"],
    schedule: [[
      { court: 0, ids1: [3], team1: ["Ana"], ids2: [6], team2: ["Bia"], s1: "", s2: "", inProgress: true },
      { court: 1, ids1: [3], team1: ["Ana"], ids2: [7], team2: ["Carla"], s1: "", s2: "", inProgress: false },
      { court: 2, ids1: [9], team1: ["Dani"], ids2: [10], team2: ["Eva"], s1: "", s2: "", inProgress: true },
    ]],
  },
  { ids1: [3], team1: ["Ana"], ids2: [8], team2: ["Fê"] },
  "target"
);
assert.equal(participantConflictsForTest.length, 1, "O aviso considera jogos aguardando ou participantes diferentes como ocupados.");
assert.equal(participantConflictsForTest[0].participants[0].name, "Ana", "O aviso não identifica quem já está em jogo.");
assert.ok(
  tournamentOperationsSource.includes("function getInProgressParticipantConflicts")
    && mainSource.includes("participantOccupancyConflict")
    && matchControlsSource.includes("Chamar mesmo assim")
    && mainSource.includes("skipParticipantCheck: true")
    && mainSource.includes("requestOperationalGameStart(target, targetGame)")
    && styleSource.includes(".participantOccupancyModal")
    && styleSource.includes('html[data-theme="dark"] .participantOccupancyList li')
    && styleSource.includes("@media (max-width: 520px)"),
  "O aviso não bloqueante de participantes ocupados perdeu a confirmação, as chaves ou a adaptação visual."
);

assert.equal(
  normalizeCircuitRankingSettings({ coverImageUrl: "data:image/jpeg;base64,capa" }).coverImageUrl,
  "data:image/jpeg;base64,capa",
  "A foto própria do circuito deixou de ser preservada nas configurações persistidas."
);
assert.equal(
  normalizeCircuitRankingSettings({ coverImageThumbnailUrl: "data:image/jpeg;base64,mini" }).coverImageThumbnailUrl,
  "data:image/jpeg;base64,mini",
  "A miniatura própria do circuito deixou de ser preservada nas configurações persistidas."
);
assert.equal(
  getPublicTournamentDirectoryItem({
    id: "evento-com-capa",
    data: { eventCoverImageThumbnailUrl: "data:image/jpeg;base64,mini-evento" },
  }).data.eventCoverImageThumbnailUrl,
  "data:image/jpeg;base64,mini-evento",
  "A miniatura geral do evento com várias categorias deixou de chegar ao perfil público."
);
assert.equal(STORY_COVER_WIDTH, 1080, "A largura padrão da capa Stories foi alterada.");
assert.equal(STORY_COVER_HEIGHT, 1920, "A altura padrão da capa Stories foi alterada.");
assert.equal(getStoryCoverBaseScale(3000, 2000), 0.36, "A foto horizontal não é mais preservada inteira dentro do quadro 9:16.");
assert.deepEqual(
  clampStoryCoverTransform({ sourceWidth: 3000, sourceHeight: 2000, zoom: 1, x: 9999, y: 9999 }),
  { zoom: 1, x: 0, y: 0 },
  "A foto inteira deveria permanecer centralizada antes do zoom."
);
assert.deepEqual(
  clampStoryCoverTransform({ sourceWidth: 3000, sourceHeight: 2000, zoom: 3, x: 9999, y: 9999 }),
  { zoom: 3, x: 1080, y: 120 },
  "O arraste após o zoom deixou de respeitar os limites da fotografia."
);
assert.deepEqual(
  getStoryCoverBackgroundRect(3000, 2000),
  { width: 2880, height: 1920, left: -900, top: 0 },
  "O fundo adaptativo não cobre corretamente o quadro 9:16."
);
assert.deepEqual(
  getStoryCoverRenderRect({ sourceWidth: 1080, sourceHeight: 1920, zoom: 1, x: 0, y: 0 }),
  { zoom: 1, x: 0, y: 0, width: 1080, height: 1920, left: 0, top: 0 },
  "Uma foto Stories pronta deixou de preencher exatamente a saída."
);
assert.equal(storyCoverHasNativeResolution(2160, 3840), true, "Fotos grandes deixaram de ser reconhecidas como adequadas.");
assert.equal(storyCoverHasNativeResolution(540, 960), false, "Fotos pequenas deixaram de receber o alerta de nitidez.");
assert.ok(
  mainSource.includes("readStoryCoverFile")
    && mainSource.includes("StoryCoverEditor")
    && mainSource.includes("createPortal(")
    && mainSource.includes("document.body")
    && mainSource.includes("1080 × 1920 px (9:16)")
    && mainSource.includes("Foto do circuito")
    && !mainSource.includes('className="photoZoomButtons"')
    && storyCoverEditorSource.includes('canvas.toDataURL("image/jpeg", 0.88)')
    && storyCoverEditorSource.includes('thumbnailCanvas.toDataURL("image/jpeg", 0.8)')
    && storyCoverEditorSource.includes("getStoryCoverBackgroundRect")
    && storyCoverEditorSource.includes("context.filter")
    && storyCoverEditorSource.includes("handlePointerMove")
    && storyCoverEditorSource.includes("handleWheel")
    && storyCoverEditorSource.includes('document.querySelectorAll(\'[aria-modal="true"]\')')
    && storyCoverEditorSource.includes('body.style.position = "fixed"')
    && storyCoverEditorSource.includes("dialog.inert = true")
    && publicTournamentScreenSource.includes("PublicImageLightbox")
    && publicCircuitScreenSource.includes("PublicImageLightbox")
    && publicArenaPresentationSource.includes('organizer.photoUrl || "/torneio360-profile.png"')
    && publicArenaApiSource.includes("get_public_tournament_cover")
    && publicArenaApiSource.includes("get_public_circuit_cover")
    && publicEventCoversMigrationSource.includes("create or replace function public.get_public_tournament_cover")
    && publicEventCoversMigrationSource.includes("create or replace function public.get_public_circuit_cover")
    && publicEventCoversMigrationSource.includes("- 'coverImageUrl'")
    && publicCoverThumbnailsMigrationSource.includes("eventCoverImageThumbnailUrl")
    && groupedEventGeneralCoverMigrationSource.includes("multiCategoryEvent")
    && groupedEventGeneralCoverMigrationSource.includes("eventCoverImageUrl")
    && publicArenaApiSource.includes("tournamentData.multiCategoryEvent === true")
    && publicArenaPresentationSource.includes("previewSrc")
    && publicArenaPresentationSource.includes("publicArenaGroupedEventFrame")
    && publicArenaPresentationSource.includes("publicArenaGroupedEventItems")
    && mainSource.includes('const eventCoverImageUrl = firstDetails.eventCoverImageUrl || ""')
    && styleSource.includes("CAPAS RESPONSIVAS — REGRAS FINAIS DA HOMOLOGAÇÃO")
    && styleSource.includes("CARTÕES PÚBLICOS PADRONIZADOS — HOMOLOGAÇÃO")
    && styleSource.includes(".storyCoverEditorModal .actionConfirmBtn")
    && styleSource.includes("FOTOS PÚBLICAS DE EVENTOS E CIRCUITOS")
    && styleSource.includes(".publicArenaEventCover.profile-photo")
    && styleSource.includes(".publicArenaEventCover.profile-photo .publicImagePreviewButton")
    && styleSource.includes("box-sizing: border-box !important")
    && styleSource.includes(".publicCoverPreviewButton.publicTournamentCover")
    && styleSource.includes(".storyCoverEditorFrame")
    && styleSource.includes("aspect-ratio: 9 / 16")
    && styleSource.includes("z-index: 110000")
    && styleSource.includes(".storyCoverUnderlyingModalLocked")
    && styleSource.includes('html[data-theme="dark"] .tournamentCoverDropzone'),
  "As imagens públicas perderam o editor Stories, a moldura circular, o contraste noturno ou a ampliação."
);

for (const logoPath of ["public/torneio360-logo.png", "public/torneio360-logo-blue.png"]) {
  assert.ok(existsSync(fileURLToPath(new URL(logoPath, root))), `Asset obrigatório ausente: ${logoPath}`);
}

assert.deepEqual(
  assertHomologationLoadTarget({
    supabaseUrl: "https://vcixhzvytkrautotinpi.supabase.co",
    userEmail: "torneio360@gmail.com",
  }),
  { projectRef: "vcixhzvytkrautotinpi", email: "torneio360@gmail.com" },
  "A trava do laboratório deixou de reconhecer o banco isolado de homologação."
);
assert.throws(
  () => assertHomologationLoadTarget({
    supabaseUrl: "https://dttutybojealkvuywszt.supabase.co",
    userEmail: "torneio360@gmail.com",
  }),
  /banco oficial/i,
  "O laboratório deixou de recusar explicitamente o banco oficial."
);
assert.equal(
  isHomologationLoadCircuit(
    { name: "Circuito normal", ranking_settings: { loadTestMarker: HOMOLOGATION_LOAD_MARKER } },
    []
  ),
  true,
  "Um circuito explicitamente marcado deixou de ser reconhecido como massa de teste."
);
assert.equal(
  isHomologationLoadCircuit(
    { name: "[TESTE DE CARGA] Legado", tournament_ids: ["load-1", "load-2"] },
    new Set(["load-1", "load-2"])
  ),
  true,
  "Um circuito legado ligado somente a torneios de teste deixou de ser removível."
);
assert.equal(
  isHomologationLoadCircuit(
    { name: "[TESTE DE CARGA] Não apagar", tournament_ids: ["load-1", "real-1"] },
    new Set(["load-1"])
  ),
  false,
  "A remoção do laboratório passou a alcançar um circuito ligado a dados reais."
);
const loadTestBatchId = "11111111-2222-4333-8444-555555555555";
const loadTestUserId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const loadTestNow = new Date("2026-08-25T12:00:00.000Z");
const loadTestTournaments = buildHomologationTournamentRows({
  userId: loadTestUserId,
  batchId: loadTestBatchId,
  now: loadTestNow,
});
assert.equal(loadTestTournaments.length, HOMOLOGATION_LOAD_TOURNAMENT_COUNT, "A massa não gera mais a quantidade ampliada de torneios prevista.");
assert.equal(
  loadTestTournaments.filter((row) => row.status === "finished").length,
  Math.round(HOMOLOGATION_LOAD_TOURNAMENT_COUNT * 0.7),
  "A proporção de torneios finalizados da massa foi alterada."
);
assert.ok(
  loadTestTournaments.every((row) => row.data.loadTestMarker === HOMOLOGATION_LOAD_MARKER && row.data.schedule.length > 0),
  "Algum torneio de carga perdeu a identificação ou as partidas."
);
assert.ok(
  loadTestTournaments.filter((row) => row.status === "finished").every((row) => (
    row.data.schedule.flat().every((game) => game.s1 !== "" && game.s2 !== "")
  )),
  "Os torneios finalizados do laboratório deixaram de receber todos os placares."
);
const insertedLoadTournaments = loadTestTournaments.map((row, index) => ({
  ...row,
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
}));
const loadTestCircuits = buildHomologationCircuitRows({
  userId: loadTestUserId,
  batchId: loadTestBatchId,
  tournaments: insertedLoadTournaments,
  now: loadTestNow,
});
assert.equal(loadTestCircuits.length, HOMOLOGATION_LOAD_CIRCUIT_COUNT, "A massa não gera mais a quantidade ampliada de circuitos prevista.");
assert.ok(
  loadTestCircuits.every((row) => row.tournament_ids.length === HOMOLOGATION_LOAD_TOURNAMENTS_PER_CIRCUIT),
  "Os circuitos de carga perderam a quantidade ampliada de etapas."
);
const summableLoadTestCircuits = loadTestCircuits.filter((row) => row.ranking_settings.loadTestRole === "summable");
const overlapLoadTestCircuits = loadTestCircuits.filter((row) => row.ranking_settings.loadTestRole === "overlap");
assert.equal(summableLoadTestCircuits.length, HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT, "A massa perdeu os circuitos próprios para testar soma.");
assert.equal(overlapLoadTestCircuits.length, HOMOLOGATION_LOAD_CIRCUIT_COUNT - HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT, "A massa perdeu os circuitos próprios para testar sobreposição.");
assert.ok(
  loadTestCircuits.every((row) => row.ranking_settings.loadTestLayoutVersion === HOMOLOGATION_LOAD_LAYOUT_VERSION),
  "Algum circuito foi criado com a organização antiga do laboratório."
);
const summableTournamentIds = summableLoadTestCircuits.flatMap((row) => row.tournament_ids);
assert.equal(
  new Set(summableTournamentIds).size,
  summableTournamentIds.length,
  "Os circuitos marcados como somáveis ainda compartilham etapas."
);
assert.ok(
  overlapLoadTestCircuits.some((row, index) => index > 0 && row.tournament_ids.some((id) => overlapLoadTestCircuits[index - 1].tournament_ids.includes(id))),
  "Os circuitos de sobreposição deixaram de exercitar o aviso e a contagem única de etapa repetida."
);
const uniqueCombinedSlices = buildUniqueCombinedCircuitSourceSlices({
  circuit: { rankingSettings: { sourceCircuitIds: ["circuit-a", "circuit-b"] } },
  circuits: [
    { id: "circuit-a", tournamentIds: ["stage-1", "stage-2"], rankingSettings: {} },
    { id: "circuit-b", tournamentIds: ["stage-2", "stage-3"], rankingSettings: {} },
  ],
});
assert.deepEqual(
  uniqueCombinedSlices.map((slice) => slice.tournamentIds),
  [["stage-1", "stage-2"], ["stage-3"]],
  "O circuito somado voltou a contar uma etapa compartilhada mais de uma vez."
);
const loadTestHistory = buildHomologationCircuitHistoryRows({
  circuit: { ...loadTestCircuits[0], id: "99999999-9999-4999-8999-999999999999" },
  now: loadTestNow,
});
assert.equal(
  loadTestHistory.length,
  HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT,
  "O ranking do circuito de carga não gera mais as 500 linhas previstas."
);
assert.equal(new Set(loadTestHistory.map((row) => row.player_key)).size, loadTestHistory.length, "O ranking de carga possui chaves duplicadas.");
const compactedCircuitCache = compactCircuitRowsForDashboardCache([
  { id: "circuit-1", name: "Circuito grande", rankingHistory: { atleta: { points: 100 } } },
]);
assert.deepEqual(
  compactedCircuitCache,
  [{ id: "circuit-1", name: "Circuito grande" }],
  "O cache offline voltou a copiar o ranking completo dos circuitos."
);

for (const iconPath of [
  "public/torneio360-profile.png",
  "public/torneio360-favicon-96.png",
  "public/torneio360-apple-touch-icon.png",
  "public/torneio360-app-icon-192.png",
  "public/torneio360-app-icon-512.png",
  "public/sw.js",
]) {
  assert.ok(existsSync(fileURLToPath(new URL(iconPath, root))), `Asset instalável ausente: ${iconPath}`);
}

for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
  assert.notEqual(version, "latest", `A dependência ${name} ainda usa latest.`);
  assert.ok(!/[xX*]/.test(version), `A dependência ${name} não está fixada: ${version}`);
}

console.log("Smoke check concluído: autenticação, torneios, circuitos, ranking, compartilhamento e entrada visual estão presentes.");
