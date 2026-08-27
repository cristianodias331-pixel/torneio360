import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./styles/30-organizer-event-management.css";
import "./styles/40-organizer-data-and-navigation.css";
import "./styles/41-responsive-public-covers.css";
import "./styles/42-workspace-density-and-courts.css";
import "./styles/51-unified-profile.css";
import "./styles/55-partner-finder.css";
import { normalizeCircuitParticipantKey } from "./circuitNameIdentity.mjs";
import {
  Award,
  AtSign,
  Camera,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  CircleHelp,
  CloudCheck,
  CloudOff,
  Compass,
  Clock3,
  Copy,
  Dices,
  Flame,
  GitBranch,
  Grid3X3,
  Images,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Shapes,
  Share2,
  Sun,
  Tag,
  Target,
  Trash2,
  Trophy,
  Undo2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  CircuitExtraPointsPanel,
  CircuitGenderRegistryPanel,
  CircuitRankingSettingsEditor,
  ConfirmCircuitDeleteModal,
  ConfirmClearScoresModal,
  ConfirmClearTableModal,
  ConfirmDuplicateCourtModal,
  ConfirmEventGroupModalityChangeModal,
  ConfirmModal,
  ConfirmModalityChangeModal,
  ConfirmRegenerationModal,
  ConfirmTrashPermanentDeleteModal,
  CopinhaTieBreakPanel,
  CourtAssignmentModal,
  CourtBadge,
  CourtConfigPanel,
  CourtOccupancyModal,
  CupGroupRankingView,
  CupPodiumView,
  EmailConfirmationPendingScreen,
  LoginScreen,
  ModalityPicker,
  NoticeModal,
  ParticipantOccupancyModal,
  PublicArenaPageController,
  PublicCircuitScreenView,
  PublicCupBracketView,
  PublicPlatformHomeController,
  PublicExploreSection,
  PublicScheduleView,
  PublicTournamentPageController,
  PublicTournamentScreenView,
  RankingShareButton,
  ReizinhoConfigPanel,
  ShuffleVideoModal,
  SimpleFormatInfoButton,
  StoryCoverEditor,
  TieBreakDrawOverlay,
  TournamentCircuitButton,
  TournamentCircuitManagerModal,
  TournamentGenderSelector,
  VoiceRepeatSelector,
  createShuffleVideoFileOnDemand,
  downloadShuffleVideoOnDemand,
} from "./features/appShell/lazyFeatures.jsx";
import {
  AccessPreparing,
  Blocked,
  FreeTrialNotice,
  ProfileUnavailable,
} from "./features/appShell/AccessStatusViews.jsx";
import {
  BeachLogo,
  Info,
  PlanCard,
  PlatformSupportLinks,
} from "./features/appShell/EntryPresentation.jsx";
import { PlatformSidebar, PlatformTopbar } from "./features/appShell/PlatformChrome.jsx";
import TournamentErrorBoundary from "./features/tournamentWorkspace/TournamentErrorBoundary.jsx";
import MemberProfileDetailsModal from "./features/profile/MemberProfileDetailsModal.jsx";
import ProfileImageEditor from "./features/profile/ProfileImageEditor.jsx";
import {
  MAX_MEMBER_GALLERY_PHOTOS,
  createMemberProfileFallback,
  getMemberProfileInitials,
  normalizeMemberHandle,
  validateMemberProfile,
} from "./domain/memberProfile.mjs";
import { validatePublicTextFields } from "./domain/contentModeration.mjs";
import {
  loadMyMemberProfile,
  saveMyMemberProfile,
} from "./services/memberProfileApi.mjs";
import {
  loadMyOrganizationGallery,
  saveMyOrganizationGallery,
} from "./services/publicSocialApi.mjs";
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
} from "./domain/tournamentGenderConfig.mjs";
import {
  tournamentMutationWasApplied,
  tournamentSnapshotMatches,
} from "./domain/tournamentPersistence.mjs";
import {
  BRAZILIAN_STATES,
  loadBrazilianCities,
  normalizeBrazilianState,
} from "./domain/brazilLocations.mjs";
import {
  isTournamentSummary,
  normalizeTournamentSummaryRow,
  tournamentSummarySelect,
} from "./domain/tournamentSummary.mjs";
import {
  circuitDirectorySelect,
  circuitHistorySelect,
  normalizeCircuitRow,
  normalizeCircuitTournamentIds,
} from "./domain/circuitDirectory.mjs";
import {
  listPendingTournaments,
  mergeConcurrentTournamentData,
  preservesTournamentCriticalData,
  readDashboardCache,
  requestDurableOfflineStorage,
  saveDashboardCache,
} from "./offlineDataStore.mjs";
import {
  applyCourtNumberToGame,
  createDefaultCourtNumbers,
  getGameCourtLabel,
  getGameCourtNumber,
  normalizeCourtNumberValue,
  normalizeCourtNumbers,
} from "./domain/courtNumbers.mjs";
import {
  formatDateBR,
  getBrazilDateISO,
  getBrazilDateTimeKey,
  getBrazilTodayISO,
  getCalendarDayDifference,
  getFreeTrialDetails,
  getWeekdayBR,
  isoDateToUtcDay,
} from "./domain/dateTime.mjs";
import {
  getBrazilianWhatsAppUrl,
  getPlanRegularizationWhatsAppUrl,
  getPlatformWhatsAppUrl,
} from "./domain/contactLinks.mjs";
import { formatStatusBR, normalizeCircuitStatus } from "./domain/statusFormatting.mjs";
import {
  createInitialData,
  formatParticipantNameWhileTyping,
  needsTournamentDataRepair,
  normalizeTournamentData,
} from "./domain/tournamentDataNormalization.mjs";
import {
  compareTournamentsByEventSchedule,
  getAutomaticEventStatus,
  getCircuitLifecycleStatus,
  getTournamentCompletionState,
  getTournamentEventSortKey,
  getTournamentLifecycleStatus,
  getTournamentRegistrationDeadline,
  insertTournamentsByEventSchedule,
  isPublicItemFinished,
  isRegistrationDeadlineOpen,
  sortTournamentsByDisplayOrder,
  sortTournamentsByEventSchedule,
  sortTournamentsChronologically,
  sortTournamentsForDisplay,
} from "./domain/tournamentLifecycle.mjs";
import { resetCopinhaTieBreaks } from "./domain/cupFormatSummary.mjs";
import {
  generateCollaborationChangeId,
  generatePublicId,
  getArenaPublicShareMessage,
  getArenaPublicUrl,
  getPublicUrl,
} from "./domain/publicIdentifiers.mjs";
import {
  getPublicCircuitDirectoryItem,
  getPublicTournamentDirectoryItem,
  getRegisteredAthletesForPublic,
  normalizePublicCircuitForDisplay,
  sortCircuitsForDisplay,
} from "./domain/publicArenaData.mjs";
import {
  PUBLIC_ARENA_BUNDLE_REFRESH_INTERVAL_MS,
  PUBLIC_ARENA_EVENT_PAGE_SIZE,
  PUBLIC_TOURNAMENT_REFRESH_INTERVAL_MS,
  readPublicArenaBundleCache,
} from "./domain/publicArenaCache.mjs";
import { copyToClipboard } from "./services/clipboard.mjs";
import { createLatestEntitySignalProcessor } from "./services/latestEntitySignalProcessor.mjs";
import { createUserAppStateCloudQueue } from "./services/userAppStateCloudQueue.mjs";
import {
  DEFAULT_TOURNAMENT_NAVIGATION,
  TOURNAMENT_DRAFT_CHANGED_EVENT,
  clearTournamentDraft,
  isBrowserOffline,
  isRetryableConnectionError,
  listLocalTournamentDrafts,
  normalizeCourtCenterEntry,
  readCachedProfile,
  readCourtCenters,
  readLocalUserAppState,
  readOpenTournamentIds,
  readOpenTournamentNavigation,
  readPublicViewStorage,
  readTournamentDraft,
  saveCachedProfile,
  saveCourtCenters,
  saveLocalUserAppState,
  saveOpenTournamentIds,
  saveOpenTournamentNavigation,
  savePublicViewStorage,
  saveTournamentDraft,
  getTournamentVenueKey,
  getTournamentVenueLabel,
} from "./domain/localAppStorage.mjs";
import {
  getMatchElapsedSeconds,
  getMatchTimerFields,
  resetMatchTimer,
  startMatchTimer,
  stopMatchTimer,
} from "./domain/matchTimer.mjs";
import {
  getMaxScore,
  getScoreWinnerSide,
  getWinningScore,
  isGameFinished,
  normalizeScoreInput,
} from "./domain/scoreRules.mjs";
import {
  getGameSideAttendanceParticipants,
  getParticipantAttendanceEntries,
  normalizeParticipantAttendance,
  reconcileParticipantAttendance,
  setParticipantAttendanceValue,
} from "./domain/participantAttendance.mjs";
import {
  getTournamentGenderLabel,
  getParticipantGender,
  inferTournamentGenderMode,
  mergeParticipantGenderRegistries,
  mergeTournamentGenderCandidates,
  normalizeParticipantGenderRegistry,
  orderConfirmedMixedTeams,
  participantGenderValues,
  setParticipantGender,
  tournamentGenderModes,
} from "./domain/participantGenderRegistry.mjs";
import {
  circuitRankingModes,
  defaultCircuitCupPoints,
  defaultCircuitOtherPositionPoints,
  defaultCircuitPositionPoints,
  getCircuitManualParticipantKey,
  getCircuitPerformanceColumns,
  getCircuitPlacementColumns,
  getCircuitRankingExportColumns,
  getCircuitTieBreakLabel,
  getCircuitTieSignature,
  getUnresolvedCircuitTieGroups,
  normalizeCircuitPointValue,
  normalizeCircuitRankingSettings,
  normalizeCircuitTieBreakOrder,
} from "./domain/circuitRankingSettings.mjs";
import {
  compareCollaborationVersions,
  getCollaborationRevision,
  mergeRealtimeTournamentRow,
  tournamentDataEquals,
  tournamentMutationDataEquals,
} from "./domain/realtimeTournamentMerge.mjs";
import { inspectTournamentScoreRegression } from "./domain/tournamentScoreSafety.mjs";
import {
  cupRankingCriteria,
  defaultRankingCriteria,
  formatRankingMetricValue,
  getRankingColumnLabel,
  getRankingCriteria,
  rankingCriteriaOptions,
} from "./domain/rankingCriteria.mjs";
import {
  buildCircuitRankingGroupsFromRecords,
  buildCircuitTournamentRankingRecords,
  buildUniqueCombinedCircuitSourceSlices,
} from "./domain/circuitRankingAggregation.mjs";
import {
  getModalityDisplayName,
  modalityPickerDescriptions,
  modalityPickerGroups,
  normalizeModalitySearch,
} from "./domain/modalityCatalog.mjs";
import { allowedByPlan, modalityConfig } from "./domain/modalityConfig.mjs";
import {
  getAutomaticCupRankingLabel,
  getNewTournamentRankingCriteria,
} from "./domain/cupRankingDefaults.mjs";
import {
  isCupType,
  isFixedTeamType,
  isFlexibleSimpleType,
  isIndividualCupType,
  isMixedType,
  isReizinhoType,
} from "./domain/modalityClassification.mjs";
import {
  getReizinhoPlayerCount,
  getSimplePlayerCount,
  getTournamentCourtCount,
} from "./domain/modalitySettings.mjs";
import { shuffleArray } from "./domain/scheduleGeneration.mjs";
import {
  createCupGroups,
  createRoundRobinPairings,
  getCupTeamName,
  getCupTeams,
  getGroupLetter,
  getTeamName,
} from "./domain/cupGroups.mjs";
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
} from "./domain/cupFormat.mjs";
import {
  generateCupGroupSchedule,
} from "./domain/cupGroupSchedule.mjs";
import {
  resolveBracketGame,
} from "./domain/bracketProgression.mjs";
import {
  rebuildCupBracketGames,
  syncCupBracketScores,
} from "./domain/cupBracketOrchestration.mjs";
import { calculateCupGroupRankings } from "./domain/cupGroupRanking.mjs";
import { getCearenseQualified } from "./domain/cearenseQualification.mjs";
import { getCopinhaSeededGroups } from "./domain/cupQualification.mjs";
import {
  PLAY_RANKING_BRACKET_VERSION,
  PLAY_RANKING_RETROACTIVE_PROFILE_ID,
  migratePlayRankingBracketForReferenceProfile,
} from "./domain/playRankingBracketMigration.mjs";
import { createTournamentOperations } from "./domain/tournamentOperations.mjs";
import { createCupPresentation } from "./domain/cupPresentation.mjs";
import { createTournamentRuntimeAdapters } from "./features/tournamentWorkspace/TournamentRuntimeAdapters.jsx";

const HOMOLOGATION_LOAD_LAB_ENABLED = String(import.meta.env.VITE_SUPABASE_URL || "")
  .includes("vcixhzvytkrautotinpi.supabase.co");
const HomologationLoadLab = HOMOLOGATION_LOAD_LAB_ENABLED
  ? React.lazy(() => import("./features/testing/HomologationLoadLab.jsx"))
  : null;

function normalizeProfileSubtab(value) {
  const requested = String(value || "").trim();
  if (["publicacoes", "fotos", "contato", "conquistas", "conta"].includes(requested)) return requested;
  if (requested === "editar") return "contato";
  return "publicacoes";
}

export function createOrganizerWorkspace(runtime) {
  const { supabase } = runtime;
  const TORNEIO360_TAGLINE = "Gestão inteligente de torneios";
  const {
    capExpiredTournamentMatchTimers,
    getCupPlayTimeById,
    getInProgressParticipantConflicts,
    getNextMatchTimerExpiryDelay,
    getTournamentActiveCourtUsages,
    getTournamentMatchStatusSummary,
    getTournamentOperationalGames,
    getTournamentTimingSummary,
  } = createTournamentOperations({ syncCupBracketScores });
  const { getSafeCupPresentation } = createCupPresentation({ getCupPlayTimeById });
  const {
    CupBracketView,
    CupConfigPanel,
    CourtCenterModal,
    ParticipantImportModal,
    PlayerInputs,
    RankingTable,
    RankingView,
    ScheduleView,
    SimpleConfigPanel,
    TournamentTimingSummary,
    TournamentWorkspaceTabs,
    calculateRanking,
  } = createTournamentRuntimeAdapters({
    getTournamentMatchStatusSummary,
    getTournamentOperationalGames,
    getTournamentTimingSummary,
  });

  async function logout() {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error(error);
    }

    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.includes("supabase") || key.includes("sb-") || key.includes("auth")) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
    } catch (error) {
      console.error(error);
    }

    window.location.replace("/");
  }

function Dashboard({ profile, user, onProfileChange, onReconcileOwnProfile, publicPlatformHomeRuntime }) {
  const [tournaments, setTournaments] = useState([]);
  const [trashTournaments, setTrashTournaments] = useState([]);
  const [trashCircuits, setTrashCircuits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [networkOnline, setNetworkOnline] = useState(() => !isBrowserOffline());
  const [pendingSyncCount, setPendingSyncCount] = useState(() => listLocalTournamentDrafts(user.id).length);
  const [dashboardUsingOfflineCache, setDashboardUsingOfflineCache] = useState(false);
  const [openTournamentIds, setOpenTournamentIds] = useState(() => readOpenTournamentIds(user.id));
  const [courtCenters, setCourtCenters] = useState(() => readCourtCenters(user.id));
  const [courtCenterOpen, setCourtCenterOpen] = useState(false);
  const [liveCourtUsagesByTournament, setLiveCourtUsagesByTournament] = useState({});
  const tournamentNavigationGuardRef = useRef(null);
  const openTournamentNavigationRef = useRef(readOpenTournamentNavigation(user.id));
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
const [newCategory, setNewCategory] = useState("");
const [newGenderMode, setNewGenderMode] = useState("");
const [newGenderOther, setNewGenderOther] = useState("");
const [newMultiCategoryEvent, setNewMultiCategoryEvent] = useState("nao");
const [newCategorySchedules, setNewCategorySchedules] = useState([{
  category: "",
  participantGenderMode: "",
  genderOther: "",
  date: "",
  endDate: "",
  registrationDeadline: "",
  time: "",
  type: "",
  location: "",
  winningScore: "4",
  rankingCriteria: "",
  coverImageUrl: "",
  coverImageThumbnailUrl: "",
}]);
const [newDate, setNewDate] = useState("");
const [newEndDate, setNewEndDate] = useState("");
const [newRegistrationDeadline, setNewRegistrationDeadline] = useState("");
const [newPartnerFinderEnabled, setNewPartnerFinderEnabled] = useState(true);
const [newPartnerFinderDeadline, setNewPartnerFinderDeadline] = useState("");
const [newRegulationsText, setNewRegulationsText] = useState("");
const [newRegulationsPdfUrl, setNewRegulationsPdfUrl] = useState("");
const [newEventStartTime, setNewEventStartTime] = useState("");
const [newDailyStartTimes, setNewDailyStartTimes] = useState({});
const [newDay, setNewDay] = useState("");
const [newLocation, setNewLocation] = useState("");
const [newCoverImageUrl, setNewCoverImageUrl] = useState("");
const [newCoverImageThumbnailUrl, setNewCoverImageThumbnailUrl] = useState("");
const [coverImageLoading, setCoverImageLoading] = useState(false);
const [coverImageEditor, setCoverImageEditor] = useState(null);
const coverImageApplyRef = useRef(null);
const [newWinningScore, setNewWinningScore] = useState(4);
const [newRankingCriteria, setNewRankingCriteria] = useState("");
const [newPublicInfo, setNewPublicInfo] = useState({
  showArenaName: true,
  showOrganizerName: true,
  showWhatsapp: true,
  showWhatsappGroupLink: true,
  showInstagram: true,
  showAddress: true,
  showMapsLink: true,
  showCityState: true,
});
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const profileSaveSuccessTimerRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editTournamentSaving, setEditTournamentSaving] = useState(false);
  const [modalityChangeConfirmation, setModalityChangeConfirmation] = useState(null);
  const [eventGroupModalityConfirmation, setEventGroupModalityConfirmation] = useState(null);
  const [editEventGroup, setEditEventGroup] = useState(null);
  const [editEventGroupSaving, setEditEventGroupSaving] = useState(false);
  const [draggedTournamentId, setDraggedTournamentId] = useState(null);
  const [dragOverTournamentId, setDragOverTournamentId] = useState(null);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState("active");
  const [tournamentGenderFilter, setTournamentGenderFilter] = useState(tournamentListGenderFilters.all);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [createCircuitOpen, setCreateCircuitOpen] = useState(false);
  const [circuitTournamentTarget, setCircuitTournamentTarget] = useState(null);
  const [combineCircuitsOpen, setCombineCircuitsOpen] = useState(false);
  const [circuitStatusFilter, setCircuitStatusFilter] = useState("active");
  const [circuitSearch, setCircuitSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [profileSubtab, setProfileSubtab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeProfileSubtab(params.get("perfil"));
  });
  const [profilePublicationFilter, setProfilePublicationFilter] = useState("all");
  const [memberProfileEditorOpen, setMemberProfileEditorOpen] = useState(false);
  const [memberProfileImageEditor, setMemberProfileImageEditor] = useState(null);
  const [activePanel, setActivePanel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("aba") || "inicio";
  });
  const [browsingPublicTournament, setBrowsingPublicTournament] = useState(null);
  const [browsingPublicTournamentLoading, setBrowsingPublicTournamentLoading] = useState(false);
  const [colorMode, setColorMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem(`torneio360:color-mode:${user.id}`);
      if (savedMode === "light" || savedMode === "dark") return savedMode;
    } catch {
      // A preferência continua funcional durante a sessão mesmo sem armazenamento local.
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [circuits, setCircuits] = useState([]);
  const tournamentsRef = useRef(tournaments);
  const trashTournamentsRef = useRef(trashTournaments);
  const trashCircuitsRef = useRef(trashCircuits);
  const circuitsRef = useRef(circuits);
  const selectedRef = useRef(selected);
  const dashboardLoadInFlightRef = useRef(false);
  const dashboardLastLoadedAtRef = useRef(0);
  const playRankingRetroMigrationInFlightRef = useRef(null);
  const tournamentRealtimeEpochRef = useRef(0);
  const tournamentSignalLoadStateRef = useRef(new Map());
  const circuitRealtimeEpochRef = useRef(0);
  const circuitHistoryLoadedIdsRef = useRef(new Set());
  const circuitHistoryLoadPromisesRef = useRef(new Map());
  const circuitRankingViewCacheRef = useRef(new Map());
  const tournamentDetailsLoadPromisesRef = useRef(new Map());
  const [circuitHistoryLoadState, setCircuitHistoryLoadState] = useState({});
  const [circuitForm, setCircuitForm] = useState({
    id: null,
    name: "",
    coverImageUrl: "",
    coverImageThumbnailUrl: "",
    startDate: "",
    endDate: "",
    tournamentIds: [],
    rankingCriteria: defaultRankingCriteria,
    rankingCriteriaMode: "automatic",
    rankingSettings: normalizeCircuitRankingSettings(),
  });
  const [circuitEditForm, setCircuitEditForm] = useState(null);
  const [combinedCircuitForm, setCombinedCircuitForm] = useState({ name: "", sourceCircuitIds: [] });
  const [combinedCircuitSaving, setCombinedCircuitSaving] = useState(false);
  const [circuitSaving, setCircuitSaving] = useState(false);
  const circuitSavingRef = useRef(false);
  const combinedCircuitSavingRef = useRef(false);
  const [circuitDeleteTarget, setCircuitDeleteTarget] = useState(null);
  const [trashCategory, setTrashCategory] = useState("tournaments");
  const [trashSearch, setTrashSearch] = useState("");
  const [selectedTrashTournamentIds, setSelectedTrashTournamentIds] = useState([]);
  const [selectedTrashCircuitIds, setSelectedTrashCircuitIds] = useState([]);
  const [trashPermanentAction, setTrashPermanentAction] = useState(null);
  const [trashActionBusy, setTrashActionBusy] = useState(false);
  const [expandedCircuitId, setExpandedCircuitId] = useState(() => (
    new URLSearchParams(window.location.search).get("circuito")
  ));
  const [expandedCircuitToolsId, setExpandedCircuitToolsId] = useState(null);
  const [restoredTournamentId, setRestoredTournamentId] = useState(null);
  const circuitPersistenceQueueRef = useRef(Promise.resolve());
  const appStateSaveTimerRef = useRef(null);
  const appStateCloudQueueRef = useRef(null);
  const restoredAppStateRef = useRef(false);
  const appStateRestoreReadyRef = useRef(false);
  const pendingScrollRestoreRef = useRef(null);
  const scrollRestoreTimersRef = useRef([]);
  const initialAppRouteRef = useRef(`${window.location.pathname}${window.location.search}${window.location.hash || ""}`);
  const initialRouteIsExplicitRef = useRef(isExplicitAppRoute(initialAppRouteRef.current));

  useEffect(() => { tournamentsRef.current = tournaments; }, [tournaments]);
  useEffect(() => { trashTournamentsRef.current = trashTournaments; }, [trashTournaments]);
  useEffect(() => { trashCircuitsRef.current = trashCircuits; }, [trashCircuits]);
  useEffect(() => { circuitsRef.current = circuits; }, [circuits]);
  useEffect(() => {
    const availableIds = new Set(trashTournaments.map((item) => String(item.id)));
    setSelectedTrashTournamentIds((current) => current.filter((id) => availableIds.has(id)));
  }, [trashTournaments]);
  useEffect(() => {
    const availableIds = new Set(trashCircuits.map((item) => String(item.id)));
    setSelectedTrashCircuitIds((current) => current.filter((id) => availableIds.has(id)));
  }, [trashCircuits]);
  selectedRef.current = selected;

  function getRelativeAppRoute() {
    return `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
  }

  function isExplicitAppRoute(route) {
    try {
      const url = new URL(route, window.location.origin);
      const params = url.searchParams;

      return Boolean(
        params.get("torneio") ||
        params.get("tab") ||
        params.get("partidas") ||
        params.get("perfil") ||
        params.get("circuito") ||
        (params.get("aba") && params.get("aba") !== "inicio")
      );
    } catch {
      return false;
    }
  }

  function getStateRoute(state) {
    if (!state?.last_url || typeof state.last_url !== "string") return null;

    try {
      const url = new URL(state.last_url, window.location.origin);
      if (url.origin !== window.location.origin) return null;

      if (!url.searchParams.get("aba") && state.last_panel) url.searchParams.set("aba", state.last_panel);
      if (!url.searchParams.get("torneio") && state.last_tournament_id) url.searchParams.set("torneio", state.last_tournament_id);
      if (!url.searchParams.get("tab") && state.last_tournament_tab) url.searchParams.set("tab", state.last_tournament_tab);
      if (!url.searchParams.get("partidas") && state.last_matches_tab) url.searchParams.set("partidas", state.last_matches_tab);
      if (!url.searchParams.get("perfil") && state.last_profile_subtab) url.searchParams.set("perfil", state.last_profile_subtab);
      if (!url.searchParams.get("circuito") && state.last_circuit_id) url.searchParams.set("circuito", state.last_circuit_id);

      return `${url.pathname}${url.search}${url.hash || ""}`;
    } catch {
      return null;
    }
  }

  function areAppRoutesEqual(firstRoute, secondRoute) {
    try {
      const first = new URL(firstRoute, window.location.origin);
      const second = new URL(secondRoute, window.location.origin);

      if (first.pathname !== second.pathname || first.hash !== second.hash) return false;

      return ["aba", "torneio", "tab", "partidas", "perfil", "circuito"].every(
        (key) => first.searchParams.get(key) === second.searchParams.get(key)
      );
    } catch {
      return false;
    }
  }

  function clearPendingScrollRestore() {
    scrollRestoreTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollRestoreTimersRef.current = [];
    pendingScrollRestoreRef.current = null;
  }

  function applyPendingScrollRestore() {
    const pending = pendingScrollRestoreRef.current;
    if (!pending || Date.now() > pending.expiresAt) {
      pendingScrollRestoreRef.current = null;
      return;
    }

    const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (pending.top > maximumScroll + 2) return;

    const scrollToSavedPosition = () => {
      if (pendingScrollRestoreRef.current?.token !== pending.token) return;
      window.scrollTo({ top: pending.top, left: 0, behavior: "auto" });
      pendingScrollRestoreRef.current = null;
      scrollRestoreTimersRef.current = [];
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(scrollToSavedPosition);
    } else {
      scrollToSavedPosition();
    }
  }

  function queueScrollRestore(scrollY) {
    const top = Math.max(0, Math.round(Number(scrollY) || 0));
    const token = `${Date.now()}:${top}`;

    scrollRestoreTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollRestoreTimersRef.current = [];
    pendingScrollRestoreRef.current = {
      top,
      token,
      expiresAt: Date.now() + 3000,
    };

    scrollRestoreTimersRef.current = [setTimeout(applyPendingScrollRestore, 120)];
  }

  function applySavedAppState(state, { restoreRoute = false } = {}) {
    if (!state || typeof state !== "object") return false;

    const savedRoute = getStateRoute(state);
    const initialRoute = initialAppRouteRef.current;
    const routeMatchesInitial = savedRoute && areAppRoutesEqual(savedRoute, initialRoute);
    const canRestoreDetails = restoreRoute || routeMatchesInitial;

    if (restoreRoute && savedRoute) {
      window.history.replaceState(null, "", savedRoute);
    }

    if (!canRestoreDetails) return false;

    const currentParams = new URLSearchParams(window.location.search);
    if (state.last_panel) setActivePanel(state.last_panel);
    if (state.last_profile_subtab) setProfileSubtab(normalizeProfileSubtab(state.last_profile_subtab));
    const circuitId = currentParams.get("circuito") || state.last_circuit_id;
    if (circuitId) setExpandedCircuitId(circuitId);

    const tournamentId = state.last_tournament_id || currentParams.get("torneio");
    if (tournamentId) setRestoredTournamentId(tournamentId);

    if (state.scroll_y !== undefined && state.scroll_y !== null) {
      queueScrollRestore(state.scroll_y);
    }

    return true;
  }

  function updateAppUrl(next = {}) {
    const params = new URLSearchParams(window.location.search);

    if (next.activePanel) params.set("aba", next.activePanel);
    else if (!params.get("aba")) params.set("aba", activePanel || "inicio");

    if (Object.prototype.hasOwnProperty.call(next, "selectedTournamentId")) {
      if (next.selectedTournamentId) params.set("torneio", next.selectedTournamentId);
      else params.delete("torneio");
    }

    if (Object.prototype.hasOwnProperty.call(next, "profileSubtab")) {
      if (next.profileSubtab) params.set("perfil", next.profileSubtab);
      else params.delete("perfil");
    }

    if (Object.prototype.hasOwnProperty.call(next, "tournamentTab")) {
      if (next.tournamentTab) params.set("tab", next.tournamentTab);
      else params.delete("tab");
    }

    if (Object.prototype.hasOwnProperty.call(next, "matchesTab")) {
      if (next.matchesTab) params.set("partidas", next.matchesTab);
      else params.delete("partidas");
    }

    if (Object.prototype.hasOwnProperty.call(next, "circuitId")) {
      if (next.circuitId) params.set("circuito", next.circuitId);
      else params.delete("circuito");
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
    scheduleUserAppStateSave({
      activePanel: params.get("aba") || activePanel || "inicio",
      selectedTournamentId: params.get("torneio"),
      profileSubtab: params.get("perfil") || profileSubtab,
      circuitId: Object.prototype.hasOwnProperty.call(next, "circuitId")
        ? next.circuitId
        : (params.get("circuito") || expandedCircuitId),
    });
  }

  function ensureCloudConnection(actionLabel = "concluir esta ação") {
    if (!isBrowserOffline()) return true;
    showNotice(
      "warning",
      "Sem conexão com a internet",
      `Para evitar um cadastro incompleto, reconecte-se antes de ${actionLabel}. As alterações feitas dentro de um torneio aberto continuam protegidas neste aparelho.`
    );
    return false;
  }

  async function guardSelectedTournamentBeforeLeaving() {
    if (!selected?.id || typeof tournamentNavigationGuardRef.current !== "function") return true;
    captureCurrentTournamentNavigation();
    const canLeave = await tournamentNavigationGuardRef.current();
    if (canLeave) tournamentNavigationGuardRef.current = null;
    return canLeave;
  }

  async function goToPanel(panel) {
    if (!await guardSelectedTournamentBeforeLeaving()) return false;
    setSidebarExpanded(false);
    setSelected(null);
    setExpandedCircuitId(null);
    setExpandedCircuitToolsId(null);
    setBrowsingPublicTournament(null);
    setActivePanel(panel);
    updateAppUrl({ activePanel: panel, selectedTournamentId: null, circuitId: null });
    return true;
  }

  async function openPublishedTournamentFromFeed(item) {
    const publicId = String(item?.public_id || "").trim();
    if (!publicId || browsingPublicTournamentLoading) return;
    setBrowsingPublicTournamentLoading(true);
    try {
      const result = await publicPlatformHomeRuntime.fetchPublicTournamentDetail(publicId);
      if (result?.error || !result?.data) {
        showNotice("error", "Torneio indisponível", "Não foi possível abrir esta publicação agora.");
        return;
      }
      setBrowsingPublicTournament(result.data);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } finally {
      setBrowsingPublicTournamentLoading(false);
    }
  }

  function openOrganizerCircuit(circuit) {
    if (!circuit?.id) return;
    setExpandedCircuitId(circuit.id);
    setExpandedCircuitToolsId(null);
    setCreateCircuitOpen(false);
    setCombineCircuitsOpen(false);
    updateAppUrl({ activePanel: "circuitos", selectedTournamentId: null, circuitId: circuit.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeOrganizerCircuit() {
    setExpandedCircuitId(null);
    setExpandedCircuitToolsId(null);
    updateAppUrl({ activePanel: "circuitos", selectedTournamentId: null, circuitId: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openProfileSection(nextSubtab = "publicacoes") {
    if (!await guardSelectedTournamentBeforeLeaving()) return;
    const normalizedSubtab = normalizeProfileSubtab(nextSubtab);
    setSidebarExpanded(false);
    setProfileMenuOpen(false);
    setSelected(null);
    setProfileSubtab(normalizedSubtab);
    if (normalizedSubtab !== "contato") setProfileEditing(false);
    setActivePanel("ajustes");
    updateAppUrl({ activePanel: "ajustes", selectedTournamentId: null, profileSubtab: normalizedSubtab });
  }

  function openProfileSettings() {
    void openProfileSection("publicacoes");
  }

  function toggleColorMode() {
    setColorMode((currentMode) => currentMode === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    saveOpenTournamentIds(user.id, openTournamentIds);
  }, [openTournamentIds, user.id]);

  useEffect(() => {
    saveCourtCenters(user.id, courtCenters);
  }, [courtCenters, user.id]);

  useEffect(() => {
    const openIds = new Set(openTournamentIds);
    const openItems = tournaments.filter((tournament) => openIds.has(tournament.id));
    if (!openItems.length) return;

    const suggestionsByVenue = new Map();
    openItems.forEach((tournament) => {
      const venueKey = getTournamentVenueKey(tournament);
      const config = modalityConfig[tournament.type];
      const recommendedCount = config ? getTournamentCourtCount(config, tournament.data || {}) : 0;
      const current = suggestionsByVenue.get(venueKey) || {
        label: getTournamentVenueLabel(tournament),
        recommendedCount: 0,
      };
      current.recommendedCount += recommendedCount;
      suggestionsByVenue.set(venueKey, current);
    });

    setCourtCenters((currentCenters) => {
      let changed = false;
      const nextCenters = { ...currentCenters };
      suggestionsByVenue.forEach((suggestion, venueKey) => {
        const existing = nextCenters[venueKey];
        if (existing?.configured === true) return;
        if (
          existing
          && existing.label === suggestion.label
        ) return;
        nextCenters[venueKey] = normalizeCourtCenterEntry({
          ...existing,
          label: suggestion.label,
          numbers: existing?.numbers || [],
          configured: false,
        }, suggestion.label);
        changed = true;
      });
      return changed ? nextCenters : currentCenters;
    });
  }, [openTournamentIds, tournaments]);

  useEffect(() => {
    if (!selected?.id) return;
    setOpenTournamentIds((currentIds) => currentIds.includes(selected.id)
      ? currentIds
      : [...currentIds, selected.id].slice(-50));
  }, [selected?.id]);

  useEffect(() => {
    if (!tournaments.length || !openTournamentIds.length) return;
    const availableIds = new Set(tournaments.map((tournament) => tournament.id));
    const validIds = openTournamentIds.filter((id) => availableIds.has(id));
    if (validIds.length !== openTournamentIds.length) setOpenTournamentIds(validIds);
  }, [tournaments, openTournamentIds]);

  useEffect(() => {
    try {
      localStorage.setItem(`torneio360:color-mode:${user.id}`, colorMode);
    } catch {
      // O tema permanece aplicado enquanto esta sessão estiver aberta.
    }

    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = colorMode;

    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    };
  }, [colorMode, user.id]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!sidebarExpanded) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("#torneio360-main-sidebar, .sidebarMobileToggle")) return;
      setSidebarExpanded(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarExpanded(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarExpanded]);

  useEffect(() => {
    updateAppUrl({ activePanel });
  }, [activePanel]);

  useEffect(() => {
    if (selected || tournaments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const tournamentId = restoredTournamentId || params.get("torneio");
    if (!tournamentId) return;

    const savedTournament = tournaments.find((item) => item.id === tournamentId);
    if (savedTournament) {
      void activateTournament(savedTournament, { skipSaveGuard: true }).then((opened) => {
        if (opened && restoredTournamentId === savedTournament.id) setRestoredTournamentId(null);
      });
    }
  }, [tournaments, selected, restoredTournamentId]);

  useEffect(() => {
    if (restoredAppStateRef.current) return;

    let cancelled = false;

    async function restoreUserAppState() {
      const localState = readLocalUserAppState(user.id);
      const restoreRoute = !initialRouteIsExplicitRef.current;
      const restoredLocally = applySavedAppState(localState, { restoreRoute });

      try {
        const { data, error } = await supabase
          .from("user_app_state")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (cancelled || error || !data?.last_url) return;
        getAppStateCloudQueue().seed(data);

        // A cópia local é síncrona e costuma ser a mais recente ao voltar para
        // a mesma aba. O Supabase continua como recuperação entre dispositivos.
        if (!restoredLocally) {
          applySavedAppState(data, { restoreRoute });
        }

        if (!localState || getAppStateTimestamp(data) > getAppStateTimestamp(localState)) {
          saveLocalUserAppState(user.id, data);
        }
      } catch (error) {
        console.error("Erro ao restaurar posição do usuário", error);
      } finally {
        if (!cancelled) {
          restoredAppStateRef.current = true;
          appStateRestoreReadyRef.current = true;
        }
      }
    }

    restoreUserAppState();

    return () => { cancelled = true; };
  }, [user.id]);

  useEffect(() => {
    const saveNow = () => saveUserAppState();
    const saveBeforeLeaving = () => saveUserAppState({}, { forceCloud: true });
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
    };
    const saveAfterScroll = () => scheduleUserAppStateSave();
    const interval = setInterval(saveNow, 60000);
    window.addEventListener("pagehide", saveBeforeLeaving);
    window.addEventListener("beforeunload", saveBeforeLeaving);
    window.addEventListener("blur", saveNow);
    window.addEventListener("scroll", saveAfterScroll, { passive: true });
    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      saveNow();
      clearInterval(interval);
      window.removeEventListener("pagehide", saveBeforeLeaving);
      window.removeEventListener("beforeunload", saveBeforeLeaving);
      window.removeEventListener("blur", saveNow);
      window.removeEventListener("scroll", saveAfterScroll);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [activePanel, selected?.id, expandedCircuitId, profileSubtab, user.id]);

  useEffect(() => () => {
    appStateCloudQueueRef.current?.dispose();
    appStateCloudQueueRef.current = null;
  }, [user.id]);

  useEffect(() => {
    applyPendingScrollRestore();
  }, [activePanel, selected?.id, tournaments.length]);

  useEffect(() => () => clearPendingScrollRestore(), []);

  useEffect(() => {
    if (!appStateRestoreReadyRef.current) return;
    scheduleUserAppStateSave({
      profileSubtab,
      circuitId: expandedCircuitId,
    });
  }, [profileSubtab, expandedCircuitId]);

  useEffect(() => {
    if (!expandedCircuitId || activePanel !== "circuitos") return;
    void loadCircuitRankingHistory(expandedCircuitId);
  }, [activePanel, expandedCircuitId, circuits.length]);

  function getAppStateCloudQueue() {
    if (!appStateCloudQueueRef.current) {
      appStateCloudQueueRef.current = createUserAppStateCloudQueue({
        isOffline: isBrowserOffline,
        savePayload: async (payload) => {
          const { error } = await supabase
            .from("user_app_state")
            .upsert(payload, { onConflict: "user_id" });
          if (error) throw error;
        },
        onError: (error) => console.error("Erro ao salvar posição do usuário", error),
      });
    }
    return appStateCloudQueueRef.current;
  }

  async function saveUserAppState(extra = {}, { forceCloud = false } = {}) {
    if (!appStateRestoreReadyRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const pendingScroll = pendingScrollRestoreRef.current;
    const scrollY = pendingScroll && Date.now() <= pendingScroll.expiresAt
      ? pendingScroll.top
      : Math.max(0, Math.round(window.scrollY || 0));
    const payload = {
      user_id: user.id,
      last_url: `${window.location.pathname}${window.location.search}${window.location.hash || ""}`,
      last_panel: extra.activePanel || activePanel || params.get("aba") || "inicio",
      last_tournament_id: extra.selectedTournamentId ?? params.get("torneio"),
      last_tournament_tab: extra.tournamentTab || params.get("tab"),
      last_matches_tab: extra.matchesTab || params.get("partidas"),
      last_circuit_id: Object.prototype.hasOwnProperty.call(extra, "circuitId")
        ? extra.circuitId
        : expandedCircuitId,
      last_profile_subtab: extra.profileSubtab || profileSubtab,
      scroll_y: scrollY,
      updated_at: new Date().toISOString(),
    };

    saveLocalUserAppState(user.id, payload);
    getAppStateCloudQueue().queue(payload, { force: forceCloud });
  }

  function scheduleUserAppStateSave(extra = {}) {
    if (!appStateRestoreReadyRef.current) return;
    if (appStateSaveTimerRef.current) clearTimeout(appStateSaveTimerRef.current);
    appStateSaveTimerRef.current = setTimeout(() => saveUserAppState(extra), 1500);
  }
  const [photoEditor, setPhotoEditor] = useState(null);
  const [profileEditing, setProfileEditing] = useState(false);

  const photoPointersRef = useRef(new Map());
  const photoPreviewRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const lastPhotoDragRef = useRef(null);
  const lastPhotoPinchRef = useRef(null);
  const [organizerProfile, setOrganizerProfile] = useState(() => {
    const saved = localStorage.getItem(`organizerProfile:${user.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem(`organizerProfile:${user.id}`);
      }
    }

    return {
      photoUrl: profile.photo_url || "",
      arenaName: profile.arena_name || "",
      organizerName: profile.name || "",
      email: user.email || "",
      whatsapp: profile.phone || "",
      address: profile.address || "",
      mapsLink: profile.maps_link || "",
      city: profile.city || "",
      state: profile.state || "",
      instagramHandle: profile.instagram_handle || "",
      instagramLink: profile.instagram_link || "",
      whatsappGroupLink: profile.whatsapp_group_link || "",
      pixKey: "",
      isPublic: true,
    };
  });
  const [profileCityOptions, setProfileCityOptions] = useState([]);
  const [profileCitiesLoading, setProfileCitiesLoading] = useState(false);
  const [profileCitiesError, setProfileCitiesError] = useState("");
  const [profileUsesForeignState, setProfileUsesForeignState] = useState(() => {
    const currentState = String(organizerProfile.state || "").trim();
    return Boolean(currentState && !normalizeBrazilianState(currentState));
  });
  const organizerProfileBaseRef = useRef({ ...organizerProfile });
  const [organizationGallery, setOrganizationGallery] = useState([]);
  const organizationGalleryBaseRef = useRef([]);
  const [organizationGalleryStatus, setOrganizationGalleryStatus] = useState("loading");
  const [organizationGallerySaving, setOrganizationGallerySaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadMyOrganizationGallery({ supabase })
      .then((photos) => {
        if (!active) return;
        organizationGalleryBaseRef.current = photos;
        setOrganizationGallery(photos);
        setOrganizationGalleryStatus("ready");
      })
      .catch((error) => {
        console.warn("Galeria da organização ainda não está disponível:", error);
        if (active) setOrganizationGalleryStatus("unavailable");
      });
    return () => { active = false; };
  }, [supabase]);

  const memberProfileFallback = useMemo(() => createMemberProfileFallback({
    user,
    accessProfile: profile,
  }), [profile.name, user.email, user.id, user.user_metadata?.full_name, user.user_metadata?.name]);
  const [memberProfile, setMemberProfile] = useState(() => createMemberProfileFallback({
    user,
    accessProfile: profile,
  }));
  const memberProfileBaseRef = useRef(memberProfile);
  const [memberProfileStatus, setMemberProfileStatus] = useState("loading");
  const [memberProfileSaving, setMemberProfileSaving] = useState(false);
  const [memberProfileErrors, setMemberProfileErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    setMemberProfileStatus("loading");

    loadMyMemberProfile({ supabase, fallback: memberProfileFallback })
      .then(({ profile: loadedProfile, schemaAvailable }) => {
        if (!mounted) return;
        memberProfileBaseRef.current = loadedProfile;
        setMemberProfile(loadedProfile);
        setMemberProfileStatus(schemaAvailable ? "ready" : "unavailable");
      })
      .catch((error) => {
        console.error("Erro ao carregar o perfil pessoal:", error);
        if (!mounted) return;
        memberProfileBaseRef.current = memberProfileFallback;
        setMemberProfile(memberProfileFallback);
        setMemberProfileStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [memberProfileFallback, supabase]);

  const allowedTypes = allowedByPlan[profile.plan] || [];
  const freeTrialDetails = getFreeTrialDetails(profile, user);
  const profileDisplayName = memberProfile.displayName || memberProfileFallback.displayName;
  const profileInitials = getMemberProfileInitials(memberProfile);
  const panelMeta = {
    inicio: {
      title: "Início",
      description: "Acompanhe as publicações mais recentes da comunidade.",
    },
    explorar: {
      title: "Explorar",
      description: "Encontre torneios, organizações e atletas no mesmo ambiente.",
    },
    criar: {
      title: "Criar e gerenciar",
      description: "Crie conteúdo pela organização e acompanhe tudo o que já foi publicado.",
    },
    circuitos: {
      title: "Criar e gerenciar",
      description: "Crie conteúdo pela organização e acompanhe tudo o que já foi publicado.",
    },
    modalidades: {
      title: "Criar e gerenciar",
      description: "Crie conteúdo pela organização e acompanhe tudo o que já foi publicado.",
    },
    lixeira: {
      title: "Lixeira",
      description: "Recupere torneios excluídos nos últimos 30 dias.",
    },
    ajustes: {
      title: "Perfil da organização",
      description: "Veja o perfil como o público e edite somente quando necessário.",
    },
  };
  const currentPanelMeta = panelMeta[activePanel] || panelMeta.inicio;
  const tournamentLifecycleCounts = tournaments.reduce((counts, item) => {
    const status = getTournamentLifecycleStatus(item);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 });
  const tournamentGenderCounts = tournaments.reduce((counts, item) => {
    if (getTournamentLifecycleStatus(item) !== tournamentStatusFilter) return counts;
    counts[tournamentListGenderFilters.all] += 1;
    const genderFilter = getTournamentListGenderFilter(item.type, item.data || {});
    if (genderFilter) counts[genderFilter] += 1;
    return counts;
  }, {
    [tournamentListGenderFilters.all]: 0,
    [tournamentListGenderFilters.masculine]: 0,
    [tournamentListGenderFilters.feminine]: 0,
    [tournamentListGenderFilters.mixed]: 0,
  });
  const normalizedTournamentSearch = normalizeModalitySearch(tournamentSearch);
  const organizerVisibleTournaments = tournaments.filter((item) => {
    if (getTournamentLifecycleStatus(item) !== tournamentStatusFilter) return false;
    if (!matchesTournamentListGenderFilter(item.type, item.data || {}, tournamentGenderFilter)) return false;
    if (!normalizedTournamentSearch) return true;

    const details = item.data || {};
    const searchable = [
      item.name,
      getModalityDisplayName(item.type),
      details.eventName,
      ...getTournamentClassificationLabels(details),
      details.category,
      details.location,
      details.eventDate,
      details.eventStartTime,
    ].filter(Boolean).join(" ");

    return normalizeModalitySearch(searchable).includes(normalizedTournamentSearch);
  });
  const groupedTournaments = organizerVisibleTournaments.reduce((groups, item) => {
    const groupKey = item.data?.multiCategoryEvent === true && item.data?.eventGroupKey
      ? item.data.eventGroupKey
      : item.id;
    const groupName = item.data?.eventName || item.name;
    const existing = groups.find((group) => group.key === groupKey);

    if (existing) existing.items.push(item);
    else groups.push({ key: groupKey, name: groupName, items: [item] });

    return groups;
  }, []);

  const multiTournamentGroups = groupedTournaments.filter((group) => (
    group.items.length > 1 || group.items[0]?.data?.multiCategoryEvent === true
  ));
  const isolatedTournaments = groupedTournaments.flatMap((group) => (
    group.items.length === 1 && group.items[0]?.data?.multiCategoryEvent !== true ? group.items : []
  ));
  const isCombinedCircuitEntry = (circuit) => (
    normalizeCircuitRankingSettings(circuit?.rankingSettings).sourceCircuitIds.length > 0
  );
  const circuitLifecycleCounts = circuits.reduce((counts, circuit) => {
    if (isCombinedCircuitEntry(circuit)) return counts;
    const status = getCircuitLifecycleStatus(circuit);
    counts[status] += 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 });
  const combinedCircuitCount = circuits.filter(isCombinedCircuitEntry).length;
  const normalizedCircuitSearch = normalizeModalitySearch(circuitSearch);
  const visibleOrganizerCircuits = circuits.filter((circuit) => {
    const combined = isCombinedCircuitEntry(circuit);
    if (circuitStatusFilter === "combined") {
      if (!combined) return false;
    } else if (combined || getCircuitLifecycleStatus(circuit) !== circuitStatusFilter) {
      return false;
    }
    if (!normalizedCircuitSearch) return true;

    const selectedTournaments = getCircuitSelectedTournaments(circuit);
    const searchable = [
      circuit.name,
      circuit.startDate,
      circuit.endDate,
      ...selectedTournaments.flatMap((item) => [
        item.name,
        item.data?.eventName,
        getModalityDisplayName(item.type),
        item.data?.gender,
        item.data?.location,
      ]),
    ].filter(Boolean).join(" ");

    return normalizeModalitySearch(searchable).includes(normalizedCircuitSearch);
  });
  const openedOrganizerCircuit = expandedCircuitId
    ? circuits.find((circuit) => String(circuit.id) === String(expandedCircuitId)) || null
    : null;
  const organizerCircuitsToRender = openedOrganizerCircuit
    ? [openedOrganizerCircuit]
    : visibleOrganizerCircuits;

  async function loadCircuits({ silentError = false, retryAfterRealtime = true } = {}) {
    const realtimeEpoch = circuitRealtimeEpochRef.current;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const deleteLimit = thirtyDaysAgo.toISOString();
    const { data, error } = await supabase
      .from("circuits")
      .select(circuitDirectorySelect)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar circuitos:", error);
      if (!silentError) showNotice("error", "Erro ao carregar circuitos", "Não foi possível carregar seus circuitos do Supabase.");
      return;
    }

    const baseCircuits = (data || []).map(normalizeCircuitRow);

    if (circuitRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadCircuits({ silentError, retryAfterRealtime: false });
      return circuitsRef.current;
    }

    const loadedCircuits = baseCircuits;

    const expiredTrashCircuits = loadedCircuits.filter((circuit) => (
      circuit.deletedAt && circuit.deletedAt < deleteLimit
    ));
    if (expiredTrashCircuits.length) {
      const { error: purgeError } = await supabase
        .from("circuits")
        .delete()
        .eq("user_id", user.id)
        .in("id", expiredTrashCircuits.map((circuit) => circuit.id));
      if (purgeError) console.error("Erro ao excluir circuitos expirados da lixeira:", purgeError);
    }

    const validCircuits = loadedCircuits.filter((circuit) => (
      !circuit.deletedAt || circuit.deletedAt >= deleteLimit
    ));

    const currentCircuitsById = new Map(
      [...circuitsRef.current, ...trashCircuitsRef.current].map((item) => [String(item.id), item])
    );
    const reconciledCircuits = validCircuits.map((loadedCircuit) => {
      const currentCircuit = currentCircuitsById.get(String(loadedCircuit.id));
      const reconciledCircuit = !currentCircuit
        || compareCollaborationVersions(loadedCircuit, currentCircuit) >= 0
        ? loadedCircuit
        : currentCircuit;
      return {
        ...reconciledCircuit,
        rankingHistory: currentCircuit?.rankingHistory || {},
      };
    });
    const sortedCircuits = sortCircuitsForDisplay(reconciledCircuits.filter((circuit) => !circuit.deletedAt));
    const nextTrashCircuits = reconciledCircuits.filter((circuit) => circuit.deletedAt);
    circuitsRef.current = sortedCircuits;
    trashCircuitsRef.current = nextTrashCircuits;
    setCircuits(sortedCircuits);
    setTrashCircuits(nextTrashCircuits);
    return sortedCircuits;
  }

  function normalizeCircuitHistoryRows(historyRows = []) {
    const rankingHistory = {};
    historyRows.forEach((row) => {
      const key = `${row.tournament_id}::${row.group_key || "geral"}::${row.player_key}`;
      rankingHistory[key] = {
        tournamentId: row.tournament_id,
        groupKey: row.group_key || "geral",
        playerKey: row.player_key || key.split("::").pop(),
        name: row.player_name,
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
        circuitPoints: Number(row.circuit_points || 0),
        extraPoints: 0,
        placementKey: row.placement_key || "",
        placementLabel: row.placement_label || "",
        titles: Number(row.titles || 0),
        runnerUps: Number(row.runner_ups || 0),
        thirdPlaces: Number(row.third_places || 0),
      };
    });
    return rankingHistory;
  }

  function normalizeCircuitSummaryRows(summaryRows = []) {
    const rankingHistory = {};
    summaryRows.forEach((row, index) => {
      const groupKey = row.group_key || "geral";
      const playerKey = row.player_key || `resumo-${index + 1}`;
      const key = `resumo::${groupKey}::${playerKey}::${index}`;
      rankingHistory[key] = {
        tournamentId: null,
        groupKey,
        playerKey,
        name: row.player_name || "Sem nome",
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
        tournaments: Number(row.tournaments || 0),
        circuitPoints: Number(row.circuit_points || 0),
        extraPoints: 0,
        titles: Number(row.titles || 0),
        runnerUps: Number(row.runner_ups || 0),
        thirdPlaces: Number(row.third_places || 0),
        stageScores: Array.isArray(row.stage_scores)
          ? row.stage_scores.map((score) => Number(score || 0))
          : [],
      };
    });
    return rankingHistory;
  }

  async function loadCircuitRankingHistory(circuitId, { force = false } = {}) {
    const normalizedCircuitId = String(circuitId || "");
    if (!normalizedCircuitId) return null;
    if (isBrowserOffline()) {
      setCircuitHistoryLoadState((current) => ({ ...current, [normalizedCircuitId]: "error" }));
      return null;
    }
    const existingCircuit = circuitsRef.current.find((circuit) => String(circuit.id) === normalizedCircuitId);
    if (!existingCircuit) return null;
    if (!force && circuitHistoryLoadedIdsRef.current.has(normalizedCircuitId)) {
      setCircuitHistoryLoadState((current) => (
        current[normalizedCircuitId] === "loaded"
          ? current
          : { ...current, [normalizedCircuitId]: "loaded" }
      ));
      return existingCircuit.rankingHistory || {};
    }

    const pendingRequest = circuitHistoryLoadPromisesRef.current.get(normalizedCircuitId);
    if (pendingRequest) return pendingRequest;

    setCircuitHistoryLoadState((current) => ({ ...current, [normalizedCircuitId]: "loading" }));

    const request = (async () => {
      // O resumo é calculado no banco apenas para leitura. O histórico completo
      // continua sendo a fonte oficial e permanece intocado, permitindo voltar
      // automaticamente ao fluxo anterior enquanto a função ainda não estiver
      // disponível em algum ambiente.
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        "get_circuit_ranking_summary",
        { p_circuit_id: normalizedCircuitId }
      );

      let data = summaryData;
      let error = null;
      let summaryLoaded = !summaryError;

      if (summaryError) {
        console.warn("Resumo otimizado do circuito indisponível; usando histórico completo.", summaryError);
        const fallbackResult = await supabase
          .from("circuit_ranking_history")
          .select(circuitHistorySelect)
          .eq("user_id", user.id)
          .eq("circuit_id", normalizedCircuitId);
        data = fallbackResult.data;
        error = fallbackResult.error;
        summaryLoaded = false;
      }

      if (error) {
        console.error("Erro ao carregar histórico do circuito:", error);
        setCircuitHistoryLoadState((current) => ({ ...current, [normalizedCircuitId]: "error" }));
        showNotice("warning", "Ranking temporariamente indisponível", "O circuito foi aberto, mas o histórico do ranking não pôde ser atualizado agora.");
        return null;
      }

      let rankingHistory = summaryLoaded
        ? normalizeCircuitSummaryRows(data || [])
        : normalizeCircuitHistoryRows(data || []);

      // Circuitos criados antes da tabela derivada de ranking podem possuir
      // torneios e placares completos, mas nenhum registro histórico ainda.
      // Nesse caso, reconstrói apenas o dado derivado a partir dos snapshots
      // completos. Os torneios, rodadas, chaves e placares não são regravados.
      if (
        Object.keys(rankingHistory).length === 0
        && normalizeCircuitTournamentIds(existingCircuit.tournamentIds).length > 0
      ) {
        const selectedTournamentIds = normalizeCircuitTournamentIds(existingCircuit.tournamentIds);
        const hydratedRows = await loadFullTournamentRows(selectedTournamentIds, { silentError: true });
        const hydratedById = new Map(
          hydratedRows.map((tournament) => [String(tournament.id), tournament])
        );
        const completeTournamentSource = selectedTournamentIds
          .map((id) => hydratedById.get(String(id)))
          .filter((tournament) => tournament && !isTournamentSummary(tournament));
        const allSelectedTournamentsLoaded = completeTournamentSource.length === selectedTournamentIds.length;

        if (allSelectedTournamentsLoaded) {
          const rebuiltHistory = buildCircuitRankingHistory(existingCircuit, completeTournamentSource);
          if (Object.keys(rebuiltHistory).length > 0) {
            rankingHistory = rebuiltHistory;
            const historySaved = await saveCircuitHistoryToSupabase(
              existingCircuit.id,
              rebuiltHistory,
              completeTournamentSource
            );
            if (!historySaved) {
              console.warn("O ranking legado foi reconstruído para exibição, mas será persistido novamente na próxima sincronização.");
            }
          }
        }
      }

      circuitHistoryLoadedIdsRef.current.add(normalizedCircuitId);
      circuitRankingViewCacheRef.current.delete(normalizedCircuitId);
      const nextCircuits = circuitsRef.current.map((circuit) => (
        String(circuit.id) === normalizedCircuitId
          ? { ...circuit, rankingHistory }
          : circuit
      ));
      circuitsRef.current = nextCircuits;
      setCircuits(nextCircuits);
      setCircuitHistoryLoadState((current) => ({ ...current, [normalizedCircuitId]: "loaded" }));
      return rankingHistory;
    })().finally(() => {
      circuitHistoryLoadPromisesRef.current.delete(normalizedCircuitId);
    });

    circuitHistoryLoadPromisesRef.current.set(normalizedCircuitId, request);
    return request;
  }

  async function saveCircuitHistoryToSupabase(
    circuitId,
    history,
    sourceTournaments = [],
    { affectedTournamentId = null } = {}
  ) {
    const rows = Object.entries(history || {}).map(([recordKey, record]) => ({
      user_id: user.id,
      circuit_id: circuitId,
      tournament_id: record.tournamentId,
      group_key: record.groupKey || "geral",
      player_key: record.playerKey || recordKey.split("::").pop(),
      player_name: record.name || "Sem nome",
      pts: Number(record.pts || 0),
      w: Number(record.w || 0),
      bal: Number(record.bal || 0),
      played: Number(record.played || 0),
      circuit_points: Number(record.circuitPoints || 0),
      placement_key: record.placementKey || "",
      placement_label: record.placementLabel || "",
      titles: Number(record.titles || 0),
      runner_ups: Number(record.runnerUps || 0),
      third_places: Number(record.thirdPlaces || 0),
      updated_at: new Date().toISOString(),
    }));
    const sourceVersions = (sourceTournaments || [])
      .filter((tournament) => tournament?.id && tournament?.updated_at)
      .map((tournament) => ({
        tournament_id: tournament.id,
        updated_at: tournament.updated_at,
      }));

    const normalizedAffectedTournamentId = affectedTournamentId === null
      ? null
      : String(affectedTournamentId);

    if (normalizedAffectedTournamentId !== null) {
      const tournamentRows = rows.filter((row) => (
        String(row.tournament_id) === normalizedAffectedTournamentId
      ));
      const tournamentVersions = sourceVersions.filter((item) => (
        String(item.tournament_id) === normalizedAffectedTournamentId
      ));

      if (tournamentVersions.length) {
        const { data: currentVersions, error: versionsError } = await supabase
          .from("tournaments")
          .select("id, updated_at")
          .eq("user_id", user.id)
          .in("id", tournamentVersions.map((item) => item.tournament_id));
        const currentVersionById = new Map(
          (currentVersions || []).map((item) => [String(item.id), item.updated_at])
        );
        const sourceStillCurrent = !versionsError && tournamentVersions.every((item) => (
          currentVersionById.get(String(item.tournament_id)) === item.updated_at
        ));
        if (!sourceStillCurrent) {
          console.warn("O ranking incremental aguardará a versão mais recente do torneio.", versionsError);
          return false;
        }
      }

      if (tournamentRows.length) {
        const { error: upsertError } = await supabase
          .from("circuit_ranking_history")
          .upsert(tournamentRows, { onConflict: "user_id,circuit_id,tournament_id,group_key,player_key" });
        if (upsertError) {
          console.error("Erro ao atualizar o histórico do torneio no circuito:", upsertError);
          return false;
        }
      }

      const { data: savedRows, error: savedRowsError } = await supabase
        .from("circuit_ranking_history")
        .select("tournament_id, group_key, player_key")
        .eq("user_id", user.id)
        .eq("circuit_id", circuitId)
        .eq("tournament_id", normalizedAffectedTournamentId);
      if (savedRowsError) {
        console.error("Erro ao conferir o histórico incremental do circuito:", savedRowsError);
        return false;
      }

      const currentKeys = new Set(
        tournamentRows.map((row) => `${row.tournament_id}::${row.group_key}::${row.player_key}`)
      );
      const staleRows = (savedRows || []).filter((row) => {
        const key = `${row.tournament_id}::${row.group_key || "geral"}::${row.player_key}`;
        return !currentKeys.has(key);
      });
      const removalResults = await Promise.all(staleRows.map(async (row) => {
        const { error } = await supabase
          .from("circuit_ranking_history")
          .delete()
          .eq("user_id", user.id)
          .eq("circuit_id", circuitId)
          .eq("tournament_id", row.tournament_id)
          .eq("group_key", row.group_key || "geral")
          .eq("player_key", row.player_key);
        if (error) {
          console.error("Erro ao remover linha antiga do torneio no circuito:", error);
          return false;
        }
        return true;
      }));

      return removalResults.every((result) => result !== false);
    }

    const { error: atomicReplaceError } = await supabase.rpc("replace_circuit_ranking_history", {
      p_circuit_id: circuitId,
      p_rows: rows.map((row) => ({
        tournament_id: row.tournament_id,
        group_key: row.group_key,
        player_key: row.player_key,
        player_name: row.player_name,
        pts: row.pts,
        w: row.w,
        bal: row.bal,
        played: row.played,
        circuit_points: row.circuit_points,
        placement_key: row.placement_key,
        placement_label: row.placement_label,
        titles: row.titles,
        runner_ups: row.runner_ups,
        third_places: row.third_places,
        updated_at: row.updated_at,
      })),
      p_source_versions: sourceVersions,
    });

    if (!atomicReplaceError) return true;

    const atomicFunctionMissing = /replace_circuit_ranking_history|function.*does not exist|schema cache/i.test(
      `${atomicReplaceError.message || ""} ${atomicReplaceError.code || ""}`
    );
    if (!atomicFunctionMissing) {
      console.error("Erro ao substituir histórico do circuito em uma transação:", atomicReplaceError);
      return false;
    }

    // Compatibilidade temporária enquanto a função transacional ainda não foi
    // aplicada no banco: grava os dados novos antes de remover os antigos. Uma
    // falha nunca apaga primeiro o histórico que já estava confirmado.
    if (sourceVersions.length) {
      const { data: currentVersions, error: versionsError } = await supabase
        .from("tournaments")
        .select("id, updated_at")
        .eq("user_id", user.id)
        .in("id", sourceVersions.map((item) => item.tournament_id));
      const currentVersionById = new Map((currentVersions || []).map((item) => [String(item.id), item.updated_at]));
      const sourceStillCurrent = !versionsError && sourceVersions.every((item) => (
        currentVersionById.get(String(item.tournament_id)) === item.updated_at
      ));
      if (!sourceStillCurrent) {
        console.warn("O ranking não foi substituído porque um torneio recebeu dados mais recentes.", versionsError);
        return false;
      }
    }

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("circuit_ranking_history")
        .upsert(rows, { onConflict: "user_id,circuit_id,tournament_id,group_key,player_key" });

      if (upsertError) {
        console.error("Erro ao salvar histórico do circuito:", upsertError);
        return false;
      }
    }

    const currentKeys = new Set(
      rows.map((row) => `${row.tournament_id}::${row.group_key}::${row.player_key}`)
    );

    const { data: savedRows, error: savedRowsError } = await supabase
      .from("circuit_ranking_history")
      .select("tournament_id, group_key, player_key")
      .eq("user_id", user.id)
      .eq("circuit_id", circuitId);

    if (savedRowsError) {
      console.error("Erro ao conferir histórico do circuito:", savedRowsError);
      return false;
    }

    const staleRows = (savedRows || []).filter((row) => {
      const key = `${row.tournament_id}::${row.group_key || "geral"}::${row.player_key}`;
      return !currentKeys.has(key);
    });

    const removalResults = await Promise.all(
      staleRows.map(async (row) => {
        const { error } = await supabase
          .from("circuit_ranking_history")
          .delete()
          .eq("user_id", user.id)
          .eq("circuit_id", circuitId)
          .eq("tournament_id", row.tournament_id)
          .eq("group_key", row.group_key || "geral")
          .eq("player_key", row.player_key);

        if (error) {
          console.error("Erro ao remover histórico antigo do circuito:", error);
          return false;
        }
        return true;
      })
    );

    return removalResults.every((result) => result !== false);
  }

  function saveCircuits(nextCircuits) {
    const sortedCircuits = sortCircuitsForDisplay(nextCircuits);
    circuitsRef.current = sortedCircuits;
    setCircuits(sortedCircuits);
  }

  function getCircuitTournamentSelection(circuit, tournamentSource = tournaments) {
    const settings = normalizeCircuitRankingSettings(circuit?.rankingSettings);
    const directIds = normalizeCircuitTournamentIds(circuit?.tournamentIds);
    const sourceIds = normalizeCircuitTournamentIds(settings.sourceCircuitIds.flatMap((sourceId) => {
      const source = circuitsRef.current.find((item) => String(item.id) === String(sourceId));
      return source?.tournamentIds || [];
    }));
    const effectiveIds = normalizeCircuitTournamentIds([...directIds, ...sourceIds]);
    const tournamentsById = new Map(
      (Array.isArray(tournamentSource) ? tournamentSource : []).map((tournament) => [String(tournament.id), tournament])
    );

    return {
      directIds,
      effectiveIds,
      selectedTournaments: effectiveIds.map((id) => tournamentsById.get(id)).filter(Boolean),
      unavailableIds: directIds.filter((id) => !tournamentsById.has(id)),
    };
  }

  function getCircuitSelectedTournaments(circuit, tournamentSource = tournaments) {
    return getCircuitTournamentSelection(circuit, tournamentSource).selectedTournaments;
  }

  function getArenaParticipantGenderRegistry() {
    const circuitRegistries = circuitsRef.current.map((circuit) => (
      normalizeCircuitRankingSettings(circuit?.rankingSettings).genderRegistry
    ));
    const tournamentRegistries = tournamentsRef.current.map((tournament) => (
      tournament?.data?.participantGenders
    ));
    return mergeParticipantGenderRegistries(...circuitRegistries, ...tournamentRegistries);
  }

  function getCircuitGenderCandidates(form, tournamentSource = tournaments) {
    const selectedTournaments = getCircuitSelectedTournaments(form || {}, tournamentSource);
    const currentCircuit = form?._baseCircuit
      || circuitsRef.current.find((circuit) => String(circuit.id) === String(form?.id));
    return mergeTournamentGenderCandidates(selectedTournaments, modalityConfig, {
      rankingRecords: currentCircuit?.rankingHistory || {},
    });
  }

  function getEffectiveCircuitRankingSettings(value) {
    const settings = normalizeCircuitRankingSettings(value);
    return normalizeCircuitRankingSettings({
      ...settings,
      genderRegistry: mergeParticipantGenderRegistries(
        getArenaParticipantGenderRegistry(),
        settings.genderRegistry
      ),
    });
  }

  function resetCircuitForm() {
    setCircuitForm({
      id: null,
      name: "",
      coverImageUrl: "",
      coverImageThumbnailUrl: "",
      startDate: "",
      endDate: "",
      tournamentIds: [],
      rankingCriteria: defaultRankingCriteria,
      rankingCriteriaMode: "automatic",
      rankingSettings: normalizeCircuitRankingSettings({
        genderRegistry: getArenaParticipantGenderRegistry(),
      }),
    });
  }

  function getCircuitCriteriaInfo(tournamentIds = [], tournamentSource = tournaments) {
    void tournamentIds;
    void tournamentSource;
    return {
      value: defaultRankingCriteria,
      mixed: false,
      count: 0,
    };
  }

  function getCircuitEffectiveCriteria(circuit, tournamentSource = tournaments) {
    void circuit;
    void tournamentSource;
    return defaultRankingCriteria;
  }

  function toggleCircuitTournament(tournamentId, editing = false) {
    const updateForm = editing ? setCircuitEditForm : setCircuitForm;
    const currentForm = editing ? circuitEditForm : circuitForm;
    const isAddingTournament = !(currentForm?.tournamentIds || []).some((id) => String(id) === String(tournamentId));
    if (isAddingTournament) {
      void loadFullTournamentRows([tournamentId], { silentError: true });
    }
    updateForm((prev) => {
      if (!prev) return prev;
      const normalizedTournamentId = String(tournamentId);
      const currentTournamentIds = normalizeCircuitTournamentIds(prev.tournamentIds);
      const selected = currentTournamentIds.includes(normalizedTournamentId);
      const tournamentIds = selected
        ? currentTournamentIds.filter((id) => id !== normalizedTournamentId)
        : [...currentTournamentIds, normalizedTournamentId];
      return {
        ...prev,
        tournamentIds,
        rankingCriteria: defaultRankingCriteria,
        rankingCriteriaMode: "automatic",
      };
    });
  }

  async function saveCircuit(form = circuitForm, options = {}) {
    if (circuitSavingRef.current) return false;
    circuitSavingRef.current = true;
    setCircuitSaving(true);
    try {
      return await persistCircuit(form, options);
    } finally {
      circuitSavingRef.current = false;
      setCircuitSaving(false);
    }
  }

  async function persistCircuit(form = circuitForm, { silentSuccess = false, closeEditor = true } = {}) {
    if (!ensureCloudConnection("salvar o circuito")) return;
    if (!form?.name.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para o circuito.");
      return;
    }
    const circuitModeration = validatePublicTextFields({ name: form.name });
    if (!circuitModeration.allowed) {
      showNotice("warning", "Conteúdo não permitido", circuitModeration.message);
      return;
    }

    if (!form.startDate || !form.endDate) {
      showNotice("warning", "Datas obrigatórias", "Informe a data inicial e a data final do circuito.");
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      showNotice("warning", "Período inválido", "A data final não pode ser anterior à data inicial.");
      return;
    }

    const isEditing = Boolean(form.id);
    const latestCircuit = isEditing
      ? circuitsRef.current.find((item) => String(item.id) === String(form.id))
      : null;
    const previousCircuit = isEditing
      ? (form._baseCircuit || latestCircuit)
      : null;
    const comparisonCircuit = latestCircuit || previousCircuit;
    const selectedTournamentIds = normalizeCircuitTournamentIds(form.tournamentIds);
    const nextRankingSettings = normalizeCircuitRankingSettings({
      ...form.rankingSettings,
      coverImageUrl: form.coverImageUrl,
      coverImageThumbnailUrl: form.coverImageThumbnailUrl,
      tournamentFormat: "",
      genderRegistry: mergeParticipantGenderRegistries(
        getArenaParticipantGenderRegistry(),
        form.rankingSettings?.genderRegistry
      ),
    });
    const nextStatus = getAutomaticEventStatus(form.endDate);
    const nextRankingCriteria = defaultRankingCriteria;
    const nextRankingCriteriaMode = "automatic";
    const circuitAlreadyMatches = isEditing
      && form.name.trim() === String(comparisonCircuit?.name || "").trim()
      && form.startDate === (comparisonCircuit?.startDate || "")
      && form.endDate === (comparisonCircuit?.endDate || "")
      && nextStatus === comparisonCircuit?.status
      && JSON.stringify(selectedTournamentIds) === JSON.stringify(normalizeCircuitTournamentIds(comparisonCircuit?.tournamentIds))
      && nextRankingCriteria === comparisonCircuit?.rankingCriteria
      && nextRankingCriteriaMode === (comparisonCircuit?.rankingCriteriaMode === "manual" ? "manual" : "automatic")
      && JSON.stringify(nextRankingSettings) === JSON.stringify(normalizeCircuitRankingSettings(comparisonCircuit?.rankingSettings));

    if (circuitAlreadyMatches) {
      if (closeEditor) setCircuitEditForm(null);
      if (!silentSuccess) {
        showNotice("success", "Circuito já está atualizado", "Nenhuma alteração precisava ser enviada novamente.");
      }
      return true;
    }
    const comparableRankingSettings = (value) => {
      const normalized = normalizeCircuitRankingSettings(value);
      return { ...normalized, coverImageUrl: "", coverImageThumbnailUrl: "", genderRegistry: {}, rankingDivision: "general" };
    };
    const rankingCalculationChanged = !isEditing
      || JSON.stringify(selectedTournamentIds) !== JSON.stringify((previousCircuit?.tournamentIds || []).map(String))
      || form.rankingCriteriaMode !== (previousCircuit?.rankingCriteriaMode === "manual" ? "manual" : "automatic")
      || (form.rankingCriteriaMode === "manual" && form.rankingCriteria !== previousCircuit?.rankingCriteria)
      || JSON.stringify(comparableRankingSettings(form.rankingSettings))
        !== JSON.stringify(comparableRankingSettings(previousCircuit?.rankingSettings));

    let effectiveTournamentSource = tournamentsRef.current;
    if (rankingCalculationChanged) {
      const fullTournamentRows = await loadFullTournamentRows(selectedTournamentIds, { silentError: true });
      const fullTournamentRowsById = new Map(fullTournamentRows.map((row) => [String(row.id), row]));
      const missingTournamentDetails = selectedTournamentIds.some((id) => !fullTournamentRowsById.has(id));
      if (missingTournamentDetails) {
        showNotice(
          "warning",
          "Torneios ainda carregando",
          "Não foi possível obter agora todos os resultados necessários para calcular este circuito. Nenhuma informação do circuito foi alterada."
        );
        return false;
      }
      const effectiveTournamentById = new Map(
        tournamentsRef.current.map((tournament) => [String(tournament.id), tournament])
      );
      fullTournamentRows.forEach((row) => effectiveTournamentById.set(String(row.id), row));
      effectiveTournamentSource = [...effectiveTournamentById.values()];
    }

    if (!isEditing && !ensureArenaProfileReadyForPublication()) return;

    const rowPayload = {
      user_id: user.id,
      name: form.name.trim(),
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      status: nextStatus,
      tournament_ids: selectedTournamentIds,
      ranking_criteria: nextRankingCriteria,
      ranking_criteria_mode: nextRankingCriteriaMode,
      ranking_settings: nextRankingSettings,
      updated_at: new Date().toISOString(),
    };

    let data = null;
    let error = null;

    if (!isEditing) {
      ({ data, error } = await supabase.from("circuits").insert(rowPayload).select("*").single());
    } else {
      let mergeBase = form._baseCircuit || circuitsRef.current.find((item) => item.id === form.id);
      let candidatePayload = rowPayload;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        let updateQuery = supabase
          .from("circuits")
          .update(candidatePayload)
          .eq("id", form.id)
          .eq("user_id", user.id);
        const expectedRevision = getCollaborationRevision(mergeBase);
        if (expectedRevision !== null) updateQuery = updateQuery.eq("revision", expectedRevision);
        else if (mergeBase?.updatedAt) updateQuery = updateQuery.eq("updated_at", mergeBase.updatedAt);
        ({ data, error } = await updateQuery.select("*").maybeSingle());
        if (error || data) break;

        const { data: remoteRow, error: remoteError } = await supabase
          .from("circuits")
          .select("*")
          .eq("id", form.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (remoteError || !remoteRow) {
          error = remoteError;
          break;
        }

        const remoteCircuit = normalizeCircuitRow(remoteRow);
        const baseFields = mergeBase ? {
          name: mergeBase.name,
          startDate: mergeBase.startDate,
          endDate: mergeBase.endDate,
          tournamentIds: mergeBase.tournamentIds,
          rankingCriteria: mergeBase.rankingCriteria,
          rankingCriteriaMode: mergeBase.rankingCriteriaMode,
          rankingSettings: mergeBase.rankingSettings,
        } : {};
        const localFields = {
          name: candidatePayload.name,
          startDate: candidatePayload.start_date,
          endDate: candidatePayload.end_date,
          tournamentIds: candidatePayload.tournament_ids,
          rankingCriteria: candidatePayload.ranking_criteria,
          rankingCriteriaMode: candidatePayload.ranking_criteria_mode,
          rankingSettings: candidatePayload.ranking_settings,
        };
        const remoteFields = {
          name: remoteCircuit.name,
          startDate: remoteCircuit.startDate,
          endDate: remoteCircuit.endDate,
          tournamentIds: remoteCircuit.tournamentIds,
          rankingCriteria: remoteCircuit.rankingCriteria,
          rankingCriteriaMode: remoteCircuit.rankingCriteriaMode,
          rankingSettings: remoteCircuit.rankingSettings,
        };
        const merged = mergeBase
          ? mergeConcurrentTournamentData(baseFields, localFields, remoteFields).data
          : localFields;

        candidatePayload = {
          ...candidatePayload,
          name: merged.name,
          start_date: merged.startDate || null,
          end_date: merged.endDate || null,
          status: getAutomaticEventStatus(merged.endDate),
          tournament_ids: merged.tournamentIds || [],
          ranking_criteria: merged.rankingCriteria,
          ranking_criteria_mode: merged.rankingCriteriaMode,
          ranking_settings: normalizeCircuitRankingSettings(merged.rankingSettings),
          updated_at: new Date().toISOString(),
        };
        mergeBase = remoteCircuit;
      }
    }

    if (error || !data) {
      console.error("Erro ao salvar circuito:", error);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao salvar" : "Circuito atualizado em outro dispositivo",
        error
          ? "Não foi possível salvar o circuito no Supabase."
          : "A sincronização continua protegida. Tente salvar novamente; a última alteração será aplicada automaticamente."
      );
      return;
    }

    const payload = normalizeCircuitRow(data);
    const previousHistory = circuitsRef.current.find((item) => item.id === payload.id)?.rankingHistory
      || previousCircuit?.rankingHistory
      || {};
    const payloadWithHistory = { ...payload, rankingHistory: previousHistory };
    const updatedHistory = rankingCalculationChanged
      ? buildCircuitRankingHistory(payloadWithHistory, effectiveTournamentSource)
      : previousHistory;
    const finalPayload = { ...payloadWithHistory, rankingHistory: updatedHistory };

    const currentCircuits = circuitsRef.current;
    const nextCircuits = isEditing
      ? currentCircuits.map((item) => item.id === form.id ? finalPayload : item)
      : [finalPayload, ...currentCircuits];

    saveCircuits(nextCircuits);
    let rankingHistorySaved = true;
    if (rankingCalculationChanged) {
      rankingHistorySaved = await saveCircuitHistoryToSupabase(
        finalPayload.id,
        finalPayload.rankingHistory,
        getCircuitSelectedTournaments(finalPayload, effectiveTournamentSource)
      );
    }
    void syncPublicArenaDirectory(tournamentsRef.current, nextCircuits, { updateLocalState: false })
      .catch((directoryError) => console.warn("Não foi possível conferir o diretório público em segundo plano:", directoryError));
    if (isEditing) {
      if (closeEditor) setCircuitEditForm(null);
    } else {
      resetCircuitForm();
      setCreateCircuitOpen(false);
    }
    if (!rankingHistorySaved) {
      showNotice(
        "warning",
        "Circuito salvo; ranking pendente",
        "Os dados do circuito foram salvos, mas o histórico do ranking precisa de uma nova tentativa."
      );
      return false;
    }
    if (!silentSuccess) {
      showNotice("success", isEditing ? "Circuito atualizado" : "Circuito criado", "As alterações foram salvas no Supabase.");
    }
    return true;
  }

  function getTournamentCircuitMembership(tournament) {
    if (!tournament) return [];
    const tournamentId = String(tournament.id);
    return circuitsRef.current.filter((circuit) => (
      normalizeCircuitRankingSettings(circuit.rankingSettings).sourceCircuitIds.length === 0
      && (circuit.tournamentIds || []).some((id) => String(id) === tournamentId)
    ));
  }

  function getCompatibleCircuitsForTournament(tournament) {
    if (!tournament) return [];
    const tournamentId = String(tournament.id);
    return circuitsRef.current.filter((circuit) => {
      const settings = normalizeCircuitRankingSettings(circuit.rankingSettings);
      if (settings.sourceCircuitIds.length > 0) return false;
      const alreadySelected = (circuit.tournamentIds || []).some((id) => String(id) === tournamentId);
      return alreadySelected || !circuit.deletedAt;
    });
  }

  async function saveTournamentCircuitMembership(tournament, selectedCircuitIds) {
    if (!tournament || !ensureCloudConnection("atualizar os circuitos deste torneio")) return false;
    const tournamentId = String(tournament.id);
    const selectedSet = new Set((selectedCircuitIds || []).map((id) => String(id)));
    const eligibleCircuits = getCompatibleCircuitsForTournament(tournament);
    const changedCircuitIds = eligibleCircuits
      .filter((circuit) => {
        const currentlySelected = (circuit.tournamentIds || []).some((id) => String(id) === tournamentId);
        return currentlySelected !== selectedSet.has(String(circuit.id));
      })
      .map((circuit) => String(circuit.id));

    if (changedCircuitIds.length === 0) return true;

    for (const circuitId of changedCircuitIds) {
      const currentCircuit = circuitsRef.current.find((item) => String(item.id) === circuitId);
      if (!currentCircuit) continue;
      const shouldInclude = selectedSet.has(circuitId);
      const withoutTournament = (currentCircuit.tournamentIds || []).filter((id) => String(id) !== tournamentId);
      const tournamentIds = shouldInclude ? [...withoutTournament, tournament.id] : withoutTournament;
      const saved = await saveCircuit({
        ...currentCircuit,
        tournamentIds,
        _baseCircuit: currentCircuit,
      }, { silentSuccess: true, closeEditor: false });
      if (!saved) return false;
    }

    showNotice(
      "success",
      "Circuitos atualizados",
      "A participação deste torneio nos circuitos foi salva. Jogos, placares e regras do torneio não foram alterados."
    );
    return true;
  }

  async function createCircuitFromTournament(tournament) {
    if (!tournament) return false;
    const moved = await goToPanel("circuitos");
    if (!moved) return false;
    const details = tournament.data || {};
    const startDate = details.eventDate || getBrazilTodayISO();
    const endDate = details.eventEndDate && details.eventEndDate >= startDate
      ? details.eventEndDate
      : startDate;
    setCircuitForm({
      id: null,
      name: "",
      coverImageUrl: "",
      coverImageThumbnailUrl: "",
      startDate,
      endDate,
      tournamentIds: [tournament.id],
      rankingCriteria: details.rankingCriteria || defaultRankingCriteria,
      rankingCriteriaMode: "automatic",
      rankingSettings: normalizeCircuitRankingSettings({
        tournamentFormat: "",
        genderRegistry: getArenaParticipantGenderRegistry(),
      }),
    });
    setCircuitStatusFilter("active");
    setCreateCircuitOpen(true);
    return true;
  }

  function editCircuit(circuit) {
    const buildEditForm = (editableCircuit) => ({
      _baseCircuit: editableCircuit,
      id: editableCircuit.id,
      name: editableCircuit.name || "",
      coverImageUrl: editableCircuit.coverImageUrl || editableCircuit.rankingSettings?.coverImageUrl || "",
      coverImageThumbnailUrl: editableCircuit.coverImageThumbnailUrl || editableCircuit.rankingSettings?.coverImageThumbnailUrl || "",
      startDate: editableCircuit.startDate || "",
      endDate: editableCircuit.endDate || "",
      tournamentIds: normalizeCircuitTournamentIds(editableCircuit.tournamentIds),
      rankingCriteria: getCircuitEffectiveCriteria(editableCircuit),
      rankingCriteriaMode: editableCircuit.rankingCriteriaMode === "manual" ? "manual" : "automatic",
      rankingSettings: getEffectiveCircuitRankingSettings(editableCircuit.rankingSettings),
    });

    // Abre primeiro com os dados já disponíveis; o histórico completo chega em
    // segundo plano e apenas atualiza a base de comparação do mesmo editor.
    setCircuitEditForm(buildEditForm(circuit));
    void Promise.all([
      loadFullTournamentRows(circuit.tournamentIds || [], { silentError: true }),
      loadCircuitRankingHistory(circuit.id),
    ]).then(([, rankingHistory]) => {
      const latestCircuit = circuitsRef.current.find((item) => String(item.id) === String(circuit.id)) || circuit;
      const editableCircuit = rankingHistory ? { ...latestCircuit, rankingHistory } : latestCircuit;
      setCircuitEditForm((current) => {
        if (!current || String(current.id) !== String(circuit.id)) return current;
        return {
          ...current,
          _baseCircuit: editableCircuit,
          rankingSettings: {
            ...getEffectiveCircuitRankingSettings(editableCircuit.rankingSettings),
            ...current.rankingSettings,
            genderRegistry: mergeParticipantGenderRegistries(
              editableCircuit.rankingSettings?.genderRegistry,
              current.rankingSettings?.genderRegistry
            ),
          },
        };
      });
    }).catch((error) => {
      console.warn("Não foi possível completar os dados do editor do circuito:", error);
    });
  }

  async function updateCircuitRankingRule(circuit, rankingCriteria, rankingCriteriaMode = "manual") {
    if (!ensureCloudConnection("alterar o critério do circuito")) return;
    const nextCircuit = {
      ...circuit,
      rankingCriteria,
      rankingCriteriaMode,
    };
    const nextCircuits = circuits.map((item) => item.id === circuit.id ? nextCircuit : item);
    setCircuits(nextCircuits);

    const criteriaUpdate = supabase
      .from("circuits")
      .update({
        ranking_criteria: rankingCriteria,
        ranking_criteria_mode: rankingCriteriaMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", circuit.id)
      .eq("user_id", user.id);
    const { data: criteriaSaved, error } = await criteriaUpdate.select("*").maybeSingle();

    if (error || !criteriaSaved) {
      console.error("Erro ao atualizar critério do circuito:", error);
      setCircuits(circuits);
      showNotice(
        error ? "error" : "warning",
        error ? "Critério não alterado" : "Circuito atualizado em outro dispositivo",
        error ? "Não foi possível salvar o critério do circuito." : "Abra novamente o circuito para usar a versão mais recente."
      );
      return;
    }

    const savedCircuit = {
      ...normalizeCircuitRow(criteriaSaved),
      rankingHistory: circuit.rankingHistory || {},
    };
    const synchronizedCircuits = nextCircuits.map((item) => item.id === circuit.id ? savedCircuit : item);
    saveCircuits(synchronizedCircuits);
    void syncPublicArenaDirectory(tournamentsRef.current, synchronizedCircuits, { updateLocalState: false })
      .catch((directoryError) => console.warn("Não foi possível conferir o diretório público em segundo plano:", directoryError));
  }

  async function updateCircuitRankingSettings(circuit, rankingSettings) {
    if (!ensureCloudConnection("atualizar o ranking do circuito")) return false;
    const normalizedSettings = normalizeCircuitRankingSettings(rankingSettings);
    const previousCircuits = circuitsRef.current;
    const nextCircuit = { ...circuit, rankingSettings: normalizedSettings };
    const nextCircuits = previousCircuits.map((item) => item.id === circuit.id ? nextCircuit : item);
    saveCircuits(nextCircuits);

    const { data: savedCircuit, error } = await supabase
      .from("circuits")
      .update({ ranking_settings: normalizedSettings, updated_at: new Date().toISOString() })
      .eq("id", circuit.id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();

    if (error || !savedCircuit) {
      console.error("Erro ao atualizar configurações do ranking do circuito:", error);
      saveCircuits(previousCircuits);
      showNotice("error", "Ranking não atualizado", "Não foi possível salvar as configurações do ranking do circuito.");
      return false;
    }

    const normalizedCircuit = {
      ...normalizeCircuitRow(savedCircuit),
      rankingHistory: circuit.rankingHistory || {},
    };
    const savedCircuits = nextCircuits.map((item) => item.id === circuit.id ? normalizedCircuit : item);
    saveCircuits(savedCircuits);
    void syncPublicArenaDirectory(tournamentsRef.current, savedCircuits, { updateLocalState: false })
      .catch((directoryError) => console.warn("Não foi possível conferir o diretório público em segundo plano:", directoryError));
    return true;
  }

  function toggleCombinedCircuitSource(circuitId) {
    const normalizedCircuitId = String(circuitId);
    setCombinedCircuitForm((previous) => ({
      ...previous,
      sourceCircuitIds: previous.sourceCircuitIds.some((id) => String(id) === normalizedCircuitId)
        ? previous.sourceCircuitIds.filter((id) => String(id) !== normalizedCircuitId)
        : [...previous.sourceCircuitIds, normalizedCircuitId],
    }));
  }

  async function saveCombinedCircuit() {
    if (combinedCircuitSavingRef.current) return;
    const selectedSources = normalizeCircuitTournamentIds(combinedCircuitForm.sourceCircuitIds)
      .map((id) => circuitsRef.current.find((circuit) => String(circuit.id) === String(id)))
      .filter(Boolean);
    if (!combinedCircuitForm.name.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para o circuito somado.");
      return;
    }
    if (selectedSources.length < 2) {
      showNotice("warning", "Selecione dois circuitos", "Escolha pelo menos dois circuitos para somar.");
      return;
    }
    const sourceSettings = selectedSources.map((source) => normalizeCircuitRankingSettings(source.rankingSettings));
    const tournamentOwners = new Map();
    const repeatedStages = new Map();
    for (const source of selectedSources) {
      for (const tournamentId of source.tournamentIds || []) {
        const key = String(tournamentId);
        if (tournamentOwners.has(key)) {
          const repeatedTournament = tournamentsRef.current.find((tournament) => String(tournament.id) === key);
          const repeatedTournamentName = repeatedTournament?.name
            || repeatedTournament?.data?.eventName
            || `Torneio ${key}`;
          const repeated = repeatedStages.get(key) || {
            name: repeatedTournamentName,
            circuitNames: new Set([tournamentOwners.get(key)]),
          };
          repeated.circuitNames.add(source.name);
          repeatedStages.set(key, repeated);
          continue;
        }
        tournamentOwners.set(key, source.name);
      }
    }
    const dates = selectedSources.flatMap((source) => [source.startDate, source.endDate]).filter(Boolean).sort();
    const placementSourceIndex = sourceSettings.findIndex((settings) => settings.mode === circuitRankingModes.placement);
    const base = sourceSettings[placementSourceIndex >= 0 ? placementSourceIndex : 0];
    const combinedMode = placementSourceIndex >= 0
      ? circuitRankingModes.placement
      : circuitRankingModes.performance;
    const combinedIdentity = sourceSettings.every((settings) => settings.identity === "team")
      ? "team"
      : "individual";
    const combinedRankingDivision = combinedIdentity === "individual"
      && sourceSettings.some((settings) => settings.rankingDivision === "gender")
      ? "gender"
      : "general";
    const combinedGenderRegistry = mergeParticipantGenderRegistries(
      getArenaParticipantGenderRegistry(),
      ...sourceSettings.map((settings) => settings.genderRegistry)
    );

    combinedCircuitSavingRef.current = true;
    setCombinedCircuitSaving(true);
    try {
      const created = await saveCircuit({
        id: null,
        name: combinedCircuitForm.name.trim(),
        startDate: dates[0] || getBrazilTodayISO(),
        endDate: dates[dates.length - 1] || getBrazilTodayISO(),
        tournamentIds: [...tournamentOwners.keys()],
        rankingCriteria: getCircuitEffectiveCriteria(selectedSources[0]),
        rankingCriteriaMode: "manual",
        rankingSettings: normalizeCircuitRankingSettings({
          ...base,
          mode: combinedMode,
          identity: combinedIdentity,
          rankingDivision: combinedRankingDivision,
          genderRegistry: combinedGenderRegistry,
          sourceCircuitIds: selectedSources.map((source) => String(source.id)),
          extraPoints: [],
          manualParticipants: [],
        }),
      }, { silentSuccess: true });
      if (created) {
        setCombinedCircuitForm({ name: "", sourceCircuitIds: [] });
        setCombineCircuitsOpen(false);
        if (repeatedStages.size > 0) {
          const repeatedExamples = [...repeatedStages.values()].slice(0, 2).map((stage) => stage.name).join(" e ");
          showNotice(
            "warning",
            "Circuitos somados com etapa compartilhada",
            `${repeatedStages.size} etapa(s) apareciam em mais de um circuito e foram contadas apenas uma vez${repeatedExamples ? `: ${repeatedExamples}` : ""}. Para essas etapas, vale a regra do primeiro circuito selecionado.`
          );
        } else {
          showNotice("success", "Circuito somado criado", "Os circuitos foram consolidados com sucesso.");
        }
      }
    } finally {
      combinedCircuitSavingRef.current = false;
      setCombinedCircuitSaving(false);
    }
  }

  async function drawCircuitRankingTies(circuit, rankingGroups) {
    const settings = normalizeCircuitRankingSettings(circuit.rankingSettings);
    const tieGroups = getUnresolvedCircuitTieGroups(rankingGroups, settings);
    if (tieGroups.length === 0) return;
    const shuffledIds = tieGroups.flatMap((rows) => {
      const ids = rows.map((row) => String(row.id || ""));
      for (let index = ids.length - 1; index > 0; index -= 1) {
        const randomValues = new Uint32Array(1);
        globalThis.crypto.getRandomValues(randomValues);
        const swapIndex = randomValues[0] % (index + 1);
        [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
      }
      return ids;
    });
    const tieBreakDrawSignatures = Object.fromEntries(
      tieGroups.flatMap((rows) => rows.map((row) => ([
        String(row.id || ""),
        getCircuitTieSignature(row, settings),
      ])))
    );
    const success = await updateCircuitRankingSettings(circuit, {
      ...settings,
      tieBreakDrawOrder: shuffledIds,
      tieBreakDrawSignatures,
    });
    if (success) showNotice("success", "Sorteio concluído", "A ordem do empate foi sorteada e salva no circuito.");
  }

  async function syncAutomaticCircuitCriteria(nextTournaments, circuitSource = circuits) {
    const changedCircuits = [];
    const nextCircuits = (circuitSource || []).map((circuit) => {
      if (circuit.rankingCriteriaMode === "manual") return circuit;
      const inheritedCriteria = getCircuitEffectiveCriteria(circuit, nextTournaments);
      if (inheritedCriteria === circuit.rankingCriteria) return circuit;
      const updated = { ...circuit, rankingCriteria: inheritedCriteria, rankingCriteriaMode: "automatic" };
      changedCircuits.push(updated);
      return updated;
    });

    if (!changedCircuits.length) return nextCircuits;
    setCircuits(nextCircuits);

    const syncResults = await Promise.all(changedCircuits.map(async (circuit) => {
      const { error } = await supabase
        .from("circuits")
        .update({
          ranking_criteria: circuit.rankingCriteria,
          ranking_criteria_mode: "automatic",
          updated_at: new Date().toISOString(),
        })
        .eq("id", circuit.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("Erro ao sincronizar critério automático do circuito:", error);
        return false;
      }
      return true;
    }));

    if (syncResults.some((result) => result === false)) {
      showNotice(
        "warning",
        "Critério do circuito pendente",
        "O torneio foi preservado, mas não foi possível atualizar agora o critério automático de todos os circuitos."
      );
    }

    return nextCircuits;
  }

  async function deleteCircuit() {
    if (!circuitDeleteTarget) return;
    if (!ensureCloudConnection("mover o circuito para a lixeira")) return;

    const target = circuitDeleteTarget;
    const circuitId = target.id;
    const deletedAt = new Date().toISOString();
    const previousCircuits = circuits;
    const previousTrashCircuits = trashCircuits;
    const deletedRankingSettings = {
      ...normalizeCircuitRankingSettings(target.rankingSettings),
      deletedAt,
    };
    const deletedCircuit = {
      ...target,
      deletedAt,
      rankingSettings: deletedRankingSettings,
      updatedAt: deletedAt,
    };

    setCircuitDeleteTarget(null);
    saveCircuits(circuits.filter((item) => item.id !== circuitId));
    trashCircuitsRef.current = [
      deletedCircuit,
      ...trashCircuitsRef.current.filter((item) => item.id !== circuitId),
    ];
    setTrashCircuits(trashCircuitsRef.current);

    let circuitUpdate = supabase
      .from("circuits")
      .update({ ranking_settings: deletedRankingSettings, updated_at: deletedAt })
      .eq("id", circuitId)
      .eq("user_id", user.id);
    if (target.updatedAt) circuitUpdate = circuitUpdate.eq("updated_at", target.updatedAt);
    const { data: movedRow, error } = await circuitUpdate.select("*").maybeSingle();

    if (error || !movedRow) {
      saveCircuits(previousCircuits);
      trashCircuitsRef.current = previousTrashCircuits;
      setTrashCircuits(previousTrashCircuits);
      console.error("Erro ao excluir circuito:", error);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao mover" : "Circuito atualizado em outro dispositivo",
        error ? "Não foi possível mover o circuito para a lixeira." : "Confira a versão mais recente antes de movê-lo."
      );
      return;
    }

    const confirmedCircuit = {
      ...normalizeCircuitRow(movedRow),
      rankingHistory: target.rankingHistory || {},
    };
    trashCircuitsRef.current = [
      confirmedCircuit,
      ...trashCircuitsRef.current.filter((item) => item.id !== circuitId),
    ];
    setTrashCircuits(trashCircuitsRef.current);
    await syncPublicArenaDirectory(tournaments, circuitsRef.current);
    if (circuitEditForm?.id === circuitId) setCircuitEditForm(null);
    cacheCurrentDashboard();
    showNotice("success", "Circuito movido para a lixeira", "Você pode recuperá-lo em até 30 dias.");
  }

  function normalizeCircuitPlayerKey(value, isTeam = false) {
    return normalizeCircuitParticipantKey(value, isTeam);
  }

  function getCircuitTournamentRankingRecords(circuit, tournamentSource = tournaments) {
    const records = {};
    const rankingSettings = getEffectiveCircuitRankingSettings(circuit?.rankingSettings);

    if (rankingSettings.sourceCircuitIds.length > 0) {
      buildUniqueCombinedCircuitSourceSlices({ circuit, circuits: circuitsRef.current }).forEach((sourceCircuit) => {
        const sourceIsTeam = normalizeCircuitRankingSettings(sourceCircuit.rankingSettings).identity === "team";
        getCircuitRanking(sourceCircuit, getCircuitEffectiveCriteria(sourceCircuit), tournamentSource).forEach((group) => {
          (group.rows || []).forEach((row, rowIndex) => {
            const playerKey = normalizeCircuitPlayerKey(row.name, sourceIsTeam);
            const recordKey = `combined-${sourceCircuit.id}-${rowIndex}::${group.key || "geral"}::${playerKey}`;
            records[recordKey] = {
              tournamentId: (sourceCircuit.tournamentIds || [])[0] || (circuit.tournamentIds || [])[0],
              groupKey: group.key || "geral",
              playerKey,
              name: row.name,
              pts: Number(row.pts || 0),
              w: Number(row.w || 0),
              bal: Number(row.bal || 0),
              played: Number(row.played || 0),
              tournaments: Number(row.tournaments || 0),
              circuitPoints: Number(row.circuitPoints || 0),
              extraPoints: Number(row.extraPoints || 0),
              titles: Number(row.titles || 0),
              runnerUps: Number(row.runnerUps || 0),
              thirdPlaces: Number(row.thirdPlaces || 0),
              stageScores: Array.isArray(row.stageScores) ? row.stageScores : [],
              placementKey: "combinedCircuit",
              placementLabel: sourceCircuit.name,
              isTeam: sourceIsTeam,
            };
          });
        });
      });
      return records;
    }

    return buildCircuitTournamentRankingRecords({
      tournaments: getCircuitSelectedTournaments(circuit, tournamentSource),
      settings: rankingSettings,
      modalityConfigs: modalityConfig,
      getTimingComplete: (tournament) => getTournamentTimingSummary(tournament?.data || {}).complete,
      onError: (error, tournament) => {
        console.error(`Erro ao calcular o ranking do torneio ${tournament.id} no circuito:`, error);
      },
    });
  }

  function buildCircuitRankingHistory(circuit, tournamentSource = tournaments) {
    return getCircuitTournamentRankingRecords(circuit, tournamentSource);
  }

  function getCircuitRanking(circuit, criteriaValue = getCircuitEffectiveCriteria(circuit), tournamentSource = tournaments) {
    const rankingSettings = getEffectiveCircuitRankingSettings(circuit?.rankingSettings);
    const history = rankingSettings.sourceCircuitIds.length > 0 ? {} : buildCircuitRankingHistory(circuit, tournamentSource);
    const records = [];

    if (rankingSettings.sourceCircuitIds.length > 0) {
      buildUniqueCombinedCircuitSourceSlices({ circuit, circuits: circuitsRef.current }).forEach((sourceCircuit) => {
        const sourceIsTeam = normalizeCircuitRankingSettings(sourceCircuit.rankingSettings).identity === "team";
        getCircuitRanking(sourceCircuit, getCircuitEffectiveCriteria(sourceCircuit), tournamentSource).forEach((group) => {
          (group.rows || []).forEach((row) => records.push({
            ...row,
            groupKey: group.key || "geral",
            playerKey: normalizeCircuitPlayerKey(row.name, sourceIsTeam),
            tournaments: Number(row.tournaments || 0),
            isTeam: sourceIsTeam,
          }));
        });
      });
    } else {
      records.push(...Object.values(history));
    }

    return buildCircuitRankingGroupsFromRecords({
      records,
      settings: rankingSettings,
      criteriaValue,
      tournaments: tournamentSource,
      modalityConfigs: modalityConfig,
    });
  }

  function getPersistedCircuitRanking(circuit, criteriaValue = getCircuitEffectiveCriteria(circuit)) {
    const circuitId = String(circuit?.id || "");
    const rankingHistory = circuit?.rankingHistory || {};
    const rankingSettingsSource = circuit?.rankingSettings || {};
    const cached = circuitRankingViewCacheRef.current.get(circuitId);

    if (
      cached
      && cached.rankingHistory === rankingHistory
      && cached.rankingSettingsSource === rankingSettingsSource
      && cached.criteriaValue === criteriaValue
    ) {
      return cached.groups;
    }

    const groups = buildCircuitRankingGroupsFromRecords({
      records: Object.values(rankingHistory),
      settings: getEffectiveCircuitRankingSettings(rankingSettingsSource),
      criteriaValue,
      tournaments: tournamentsRef.current,
      modalityConfigs: modalityConfig,
    });
    circuitRankingViewCacheRef.current.set(circuitId, {
      rankingHistory,
      rankingSettingsSource,
      criteriaValue,
      groups,
    });
    if (circuitRankingViewCacheRef.current.size > 40) {
      const oldestKey = circuitRankingViewCacheRef.current.keys().next().value;
      circuitRankingViewCacheRef.current.delete(oldestKey);
    }
    return groups;
  }

  async function persistCircuitRankings(
    tournamentSource = tournaments,
    circuitSource = circuits,
    affectedTournamentId = null
  ) {
    const affectedId = affectedTournamentId === null ? null : String(affectedTournamentId);
    const affectedCircuits = (circuitSource || []).filter((circuit) => (
      affectedId === null || (circuit.tournamentIds || []).some((id) => String(id) === affectedId)
    ));
    const requiredTournamentIds = [...new Set(affectedCircuits.flatMap((circuit) => (
      (circuit.tournamentIds || []).map(String)
    )))];
    const hydratedRows = await loadFullTournamentRows(requiredTournamentIds, { silentError: true });
    const effectiveTournamentById = new Map(
      (tournamentSource || []).map((tournament) => [String(tournament.id), tournament])
    );
    hydratedRows.forEach((row) => effectiveTournamentById.set(String(row.id), row));
    const effectiveTournamentSource = [...effectiveTournamentById.values()];
    const missingDetails = requiredTournamentIds.some((id) => {
      const tournament = effectiveTournamentSource.find((item) => String(item.id) === id);
      return !tournament || isTournamentSummary(tournament);
    });
    if (missingDetails) {
      return { circuits: circuitSource || [], success: false };
    }
    const circuitsToPersist = [];
    let changed = false;

    const nextCircuits = (circuitSource || []).map((circuit) => {
      const isAffected = affectedId === null
        || (circuit.tournamentIds || []).some((id) => String(id) === affectedId);
      if (!isAffected) return circuit;

      const rankingHistory = buildCircuitRankingHistory(circuit, effectiveTournamentSource);
      const historyChanged = JSON.stringify(circuit.rankingHistory || {}) !== JSON.stringify(rankingHistory);
      if (historyChanged) changed = true;
      const nextCircuit = historyChanged ? { ...circuit, rankingHistory } : circuit;
      circuitsToPersist.push(nextCircuit);
      return nextCircuit;
    });

    if (changed) saveCircuits(nextCircuits);

    const persistCurrentSnapshot = () => Promise.all(
      circuitsToPersist.map((circuit) => saveCircuitHistoryToSupabase(
        circuit.id,
        circuit.rankingHistory || {},
        getCircuitSelectedTournaments(circuit, effectiveTournamentSource),
        { affectedTournamentId: affectedId }
      ))
    );
    const queuedPersistence = circuitPersistenceQueueRef.current.then(
      persistCurrentSnapshot,
      persistCurrentSnapshot
    );
    const guardedPersistence = queuedPersistence.catch((error) => {
      console.error("Erro na fila de atualização do ranking do circuito:", error);
      return [false];
    });
    circuitPersistenceQueueRef.current = guardedPersistence.then(() => undefined);
    const persistenceResults = await guardedPersistence;

    return {
      circuits: nextCircuits,
      success: persistenceResults.every((result) => result !== false),
    };
  }

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  async function shareArenaProfile() {
    const url = getArenaPublicUrl(user.id);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: organizerProfile.arenaName || "Arena Torneio360",
          text: getArenaPublicShareMessage(user.id),
          url,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copied = await copyToClipboard(url);
    showNotice(
      copied ? "success" : "error",
      copied ? "Link do perfil copiado" : "Não foi possível copiar",
      copied
        ? "Envie este link para qualquer pessoa acompanhar a arena sem login."
        : "Tente novamente em alguns instantes."
    );
  }

  function updateOrganizerProfile(field, value) {
    setOrganizerProfile((prev) => ({ ...prev, [field]: value }));
  }

  function updateOrganizerState(nextState) {
    if (nextState) setProfileUsesForeignState(false);
    setOrganizerProfile((prev) => ({
      ...prev,
      state: nextState,
      city: normalizeBrazilianState(prev.state) === nextState ? prev.city : "",
    }));
  }

  function updateForeignStatePreference(enabled) {
    if (normalizeBrazilianState(organizerProfile.state)) return;
    setProfileUsesForeignState(enabled);
    setOrganizerProfile((prev) => ({
      ...prev,
      state: "",
      city: "",
    }));
  }

  useEffect(() => {
    const currentState = String(organizerProfile.state || "").trim();
    if (normalizeBrazilianState(currentState)) {
      setProfileUsesForeignState(false);
    } else if (currentState) {
      setProfileUsesForeignState(true);
    }
  }, [organizerProfile.state]);

  useEffect(() => {
    const stateCode = normalizeBrazilianState(organizerProfile.state);
    if (!stateCode) {
      setProfileCityOptions([]);
      setProfileCitiesLoading(false);
      setProfileCitiesError("");
      return undefined;
    }

    const controller = new AbortController();
    setProfileCitiesLoading(true);
    setProfileCitiesError("");

    loadBrazilianCities(stateCode, { signal: controller.signal })
      .then((cities) => setProfileCityOptions(cities))
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setProfileCityOptions([]);
        setProfileCitiesError(error?.message || "Não foi possível carregar as cidades.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileCitiesLoading(false);
      });

    return () => controller.abort();
  }, [organizerProfile.state]);

  function organizerProfileFromRow(row, fallback = {}) {
    return {
      photoUrl: row?.photo_url ?? fallback.photoUrl ?? "",
      arenaName: row?.arena_name ?? fallback.arenaName ?? "",
      organizerName: row?.name ?? fallback.organizerName ?? "",
      email: user.email || fallback.email || "",
      whatsapp: row?.phone ?? fallback.whatsapp ?? "",
      address: row?.address ?? fallback.address ?? "",
      mapsLink: row?.maps_link ?? fallback.mapsLink ?? "",
      city: row?.city ?? fallback.city ?? "",
      state: row?.state ?? fallback.state ?? "",
      instagramHandle: row?.instagram_handle ?? fallback.instagramHandle ?? "",
      instagramLink: row?.instagram_link ?? fallback.instagramLink ?? "",
      whatsappGroupLink: row?.whatsapp_group_link ?? fallback.whatsappGroupLink ?? "",
      pixKey: fallback.pixKey ?? "",
      isPublic: row?.is_public ?? fallback.isPublic ?? true,
    };
  }

  function openDatePicker(e) {
    e.currentTarget.showPicker?.();
  }

  async function prepareTournamentCover(file, applyImage) {
    if (!file || coverImageLoading) return;
    setCoverImageLoading(true);

    try {
      const { readStoryCoverFile } = await import("./features/media/storyCoverCrop.mjs");
      const imageUrl = await readStoryCoverFile(file);
      coverImageApplyRef.current = applyImage;
      setCoverImageEditor({ imageUrl, fileName: file.name || "" });
    } catch (error) {
      coverImageApplyRef.current = null;
      setCoverImageLoading(false);
      showNotice("warning", "Foto não adicionada", error.message || "Escolha outra imagem.");
    }
  }

  function cancelTournamentCoverEditor() {
    coverImageApplyRef.current = null;
    setCoverImageEditor(null);
    setCoverImageLoading(false);
  }

  async function applyTournamentCover(images) {
    try {
      const { uploadPreparedImagePair } = await import("./services/mediaStorage.mjs");
      const uploadedImages = await uploadPreparedImagePair({
        supabase,
        userId: user.id,
        imageUrl: images?.imageUrl,
        thumbnailUrl: images?.thumbnailUrl,
      });
      coverImageApplyRef.current?.(uploadedImages);
      coverImageApplyRef.current = null;
      setCoverImageEditor(null);
      showNotice("info", "Foto enquadrada", "A capa foi preparada e enviada. Salve as alterações para concluir.");
    } catch (error) {
      console.error("Erro ao enviar a capa para o armazenamento:", error);
      throw new Error("Não foi possível enviar a imagem agora. Confira a conexão e tente novamente.");
    } finally {
      setCoverImageLoading(false);
    }
  }

  function buildOrganizerProfilePayload() {
    return {
      name: organizerProfile.organizerName || profile.name || user.email || "Organizador",
      arena_name: organizerProfile.arenaName || profile.arena_name || profile.name || "Minha arena",
      phone: organizerProfile.whatsapp || "",
      address: organizerProfile.address || "",
      maps_link: organizerProfile.mapsLink || "",
      city: organizerProfile.city || "",
      state: organizerProfile.state || "",
      photo_url: organizerProfile.photoUrl || "",
      instagram_handle: organizerProfile.instagramHandle || "",
      instagram_link: organizerProfile.instagramLink || "",
      whatsapp_group_link: organizerProfile.whatsappGroupLink || "",
      is_public: true,
    };
  }

  async function saveOrganizerProfile() {
    if (!user?.id || profileSaving) return;
    if (!ensureCloudConnection("salvar o perfil")) return;
    const profileModeration = validatePublicTextFields({
      organization: organizerProfile.arenaName,
      organizer: organizerProfile.organizerName,
      instagram: organizerProfile.instagramHandle,
    });
    if (!profileModeration.allowed) {
      showNotice("warning", "Conteúdo não permitido", profileModeration.message);
      return;
    }
    setProfileSaveSuccess(false);
    if (profileSaveSuccessTimerRef.current) clearTimeout(profileSaveSuccessTimerRef.current);
    setProfileSaving(true);

    let publicProfileData = buildOrganizerProfilePayload();
    if (/^data:image\//i.test(publicProfileData.photo_url)) {
      try {
        const { uploadProfilePhoto } = await import("./services/mediaStorage.mjs");
        const uploadedPhotoUrl = await uploadProfilePhoto({
          supabase,
          userId: user.id,
          photoUrl: publicProfileData.photo_url,
        });
        publicProfileData = { ...publicProfileData, photo_url: uploadedPhotoUrl };
      } catch (error) {
        console.error("Erro ao enviar a foto do perfil:", error);
        setProfileSaving(false);
        showNotice("error", "Foto não enviada", "Não foi possível enviar a foto agora. Confira a conexão e tente novamente.");
        return;
      }
    }
    const baseProfile = organizerProfileBaseRef.current;
    const basePublicProfileData = {
      name: baseProfile.organizerName || profile.name || user.email || "Organizador",
      arena_name: baseProfile.arenaName || profile.arena_name || profile.name || "Minha arena",
      phone: baseProfile.whatsapp || "",
      address: baseProfile.address || "",
      maps_link: baseProfile.mapsLink || "",
      city: baseProfile.city || "",
      state: baseProfile.state || "",
      photo_url: baseProfile.photoUrl || "",
      instagram_handle: baseProfile.instagramHandle || "",
      instagram_link: baseProfile.instagramLink || "",
      whatsapp_group_link: baseProfile.whatsappGroupLink || "",
      is_public: baseProfile.isPublic ?? true,
    };
    const changedProfileData = Object.fromEntries(
      Object.entries(publicProfileData).filter(([key, value]) => value !== basePublicProfileData[key])
    );
    const privateProfileChanged = String(organizerProfile.pixKey || "") !== String(baseProfile.pixKey || "");

    if (Object.keys(changedProfileData).length === 0 && !privateProfileChanged) {
      setProfileSaving(false);
      showNotice("info", "Perfil já está atualizado", "Não há novas alterações para enviar.");
      return;
    }

    try {
      localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify({
        ...organizerProfile,
        organizerName: publicProfileData.name,
        arenaName: publicProfileData.arena_name,
        isPublic: publicProfileData.is_public,
      }));
    } catch (storageError) {
      console.warn("Não foi possível preparar a cópia local do perfil.", storageError);
    }

    if (Object.keys(changedProfileData).length === 0 && privateProfileChanged) {
      organizerProfileBaseRef.current = { ...organizerProfile };
      setProfileSaving(false);
      setProfileSaveSuccess(true);
      showNotice("success", "Dado privado salvo", "A chave Pix foi mantida somente neste dispositivo de homologação.");
      profileSaveSuccessTimerRef.current = setTimeout(() => {
        setProfileSaveSuccess(false);
        profileSaveSuccessTimerRef.current = null;
      }, 2600);
      return;
    }

    try {
      // Uma conta recém-confirmada pode abrir a plataforma antes de a linha do
      // perfil estar visível para a sessão atual. Reconcilia e renova a sessão
      // antes do UPDATE para que o primeiro salvamento também seja confiável.
      await onReconcileOwnProfile?.();
      await supabase.auth.refreshSession();

      const updateProfile = () => supabase
        .from("profiles")
        .update(changedProfileData)
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      let { data, error } = await updateProfile();

      // UPDATE sem linha não é sucesso. Reprovisiona o perfil e tenta uma vez,
      // sem usar .single(), que transformava zero linhas no erro PGRST116.
      if (!error && !data) {
        await onReconcileOwnProfile?.();
        await supabase.auth.refreshSession();
        ({ data, error } = await updateProfile());
      }

      if (error || !data) {
        const saveError = error || new Error("O perfil ainda não está disponível para esta conta.");
        console.error("Erro ao salvar perfil no Supabase:", saveError);
        showNotice(
          "error",
          "Perfil não salvo",
          "Não foi possível concluir o cadastro agora. Atualize a página e tente novamente."
        );
        return;
      }

      onProfileChange?.((prev) => ({ ...prev, ...data }));
      const savedOrganizerProfile = organizerProfileFromRow(data, organizerProfile);
      organizerProfileBaseRef.current = savedOrganizerProfile;
      setOrganizerProfile(savedOrganizerProfile);
      try {
        localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(savedOrganizerProfile));
      } catch (storageError) {
        console.warn("Não foi possível atualizar a cópia local do perfil salvo.", storageError);
      }
      saveCachedProfile(user.id, { ...profile, ...data });

      setProfileSaveSuccess(true);
      showNotice(
        "success",
        "Alterações salvas",
        "O perfil da sua organização foi atualizado com sucesso."
      );
      profileSaveSuccessTimerRef.current = setTimeout(() => {
        setProfileSaveSuccess(false);
        profileSaveSuccessTimerRef.current = null;
      }, 2600);
    } catch (error) {
      console.error("Erro inesperado ao salvar o perfil:", error);
      showNotice(
        "error",
        "Perfil não salvo",
        "Não foi possível salvar as alterações agora. Tente novamente em alguns instantes."
      );
    } finally {
      setProfileSaving(false);
    }
  }

  function updateMemberProfile(field, value) {
    setMemberProfile((current) => ({
      ...current,
      [field]: field === "handle" ? normalizeMemberHandle(value) : value,
    }));
    setMemberProfileErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function closeMemberProfileImageEditor() {
    setMemberProfileImageEditor((current) => {
      if (current?.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(current.sourceUrl);
      return null;
    });
  }

  function openMemberProfileImageEditor(file, kind) {
    if (!file || memberProfileSaving) return;
    if (!String(file.type || "").startsWith("image/")) {
      showNotice("warning", "Imagem não reconhecida", "Escolha uma foto em JPG, PNG ou WebP.");
      return;
    }
    setMemberProfileImageEditor((current) => {
      if (current?.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(current.sourceUrl);
      return {
        kind,
        sourceUrl: URL.createObjectURL(file),
        fileName: file.name || "imagem",
      };
    });
  }

  async function applyMemberProfileImage({ imageUrl }) {
    const field = memberProfileImageEditor?.kind === "cover" ? "coverUrl" : "photoUrl";
    const nextProfile = { ...memberProfile, [field]: imageUrl };
    setMemberProfile(nextProfile);
    const saved = await saveMemberProfile(nextProfile);
    if (saved) closeMemberProfileImageEditor();
    return saved;
  }

  async function handleMemberGalleryFiles(files) {
    if (!files?.length || memberProfileSaving) return;
    const availableSlots = Math.max(0, MAX_MEMBER_GALLERY_PHOTOS - memberProfile.galleryPhotos.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (selectedFiles.length === 0) {
      showNotice("info", "Galeria completa", `O perfil aceita até ${MAX_MEMBER_GALLERY_PHOTOS} fotos.`);
      return;
    }

    try {
      const { prepareSocialPostImageFile } = await import("./features/media/imageResize.mjs");
      const preparedPhotos = await Promise.all(selectedFiles.map(async (file) => {
        const prepared = await prepareSocialPostImageFile(file);
        return prepared.imageUrl;
      }));
      setMemberProfile((current) => ({
        ...current,
        galleryPhotos: [...current.galleryPhotos, ...preparedPhotos].slice(0, MAX_MEMBER_GALLERY_PHOTOS),
      }));
      setMemberProfileErrors((current) => {
        if (!current.galleryPhotos) return current;
        const next = { ...current };
        delete next.galleryPhotos;
        return next;
      });
    } catch (error) {
      showNotice("warning", "Fotos não adicionadas", error?.message || "Escolha outras imagens.");
    }
  }

  function removeMemberGalleryPhoto(index) {
    if (memberProfileSaving) return;
    setMemberProfile((current) => ({
      ...current,
      galleryPhotos: current.galleryPhotos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  async function saveMemberProfile(profileOverride = null) {
    if (!user?.id || memberProfileSaving) return false;
    if (!ensureCloudConnection("salvar o perfil pessoal")) return false;

    const requestedProfile = profileOverride?.userId ? profileOverride : memberProfile;
    const validation = validateMemberProfile(requestedProfile);
    setMemberProfileErrors(validation.errors);
    if (!validation.valid) {
      showNotice("warning", "Revise o perfil", "Corrija os campos indicados antes de salvar.");
      return false;
    }

    if (memberProfileStatus === "unavailable") {
      showNotice(
        "warning",
        "Estrutura ainda não aplicada",
        "O banco do site teste precisa receber a nova migração antes de salvar o perfil pessoal."
      );
      return false;
    }

    if (JSON.stringify(validation.profile) === JSON.stringify(memberProfileBaseRef.current)) {
      showNotice("info", "Perfil já está atualizado", "Não há novas alterações para enviar.");
      return true;
    }

    setMemberProfileSaving(true);
    let profileToSave = validation.profile;

    try {
      if (/^data:image\//i.test(profileToSave.photoUrl)) {
        const { uploadMemberProfilePhoto } = await import("./services/mediaStorage.mjs");
        const photoUrl = await uploadMemberProfilePhoto({
          supabase,
          userId: user.id,
          photoUrl: profileToSave.photoUrl,
        });
        profileToSave = { ...profileToSave, photoUrl };
      }

      if (/^data:image\//i.test(profileToSave.coverUrl)) {
        const { uploadMemberProfileCover } = await import("./services/mediaStorage.mjs");
        const coverUrl = await uploadMemberProfileCover({
          supabase,
          userId: user.id,
          coverUrl: profileToSave.coverUrl,
        });
        profileToSave = { ...profileToSave, coverUrl };
      }

      if (profileToSave.galleryPhotos.some((photoUrl) => /^data:image\//i.test(photoUrl))) {
        const { uploadMemberProfileGalleryPhoto } = await import("./services/mediaStorage.mjs");
        const galleryPhotos = await Promise.all(profileToSave.galleryPhotos.map((photoUrl, index) => (
          /^data:image\//i.test(photoUrl)
            ? uploadMemberProfileGalleryPhoto({
              supabase,
              userId: user.id,
              photoUrl,
              position: index + 1,
            })
            : photoUrl
        )));
        profileToSave = { ...profileToSave, galleryPhotos };
      }

      const result = await saveMyMemberProfile({
        supabase,
        profile: profileToSave,
        fallback: memberProfileFallback,
      });

      if (!result.schemaAvailable) {
        setMemberProfileStatus("unavailable");
        showNotice(
          "warning",
          "Estrutura ainda não aplicada",
          "O banco do site teste precisa receber a nova migração antes de salvar o perfil pessoal."
        );
        return false;
      }

      memberProfileBaseRef.current = result.profile;
      setMemberProfile(result.profile);
      setMemberProfileStatus("ready");
      showNotice(
        "success",
        "Perfil pessoal atualizado",
        "Sua identidade foi salva sem alterar os dados da organização."
      );
      return true;
    } catch (error) {
      console.error("Erro ao salvar o perfil pessoal:", error);
      const duplicateHandle = String(error?.code || "") === "23505"
        || String(error?.message || "").toLocaleLowerCase("pt-BR").includes("nome de usuário já está em uso");
      if (duplicateHandle) {
        setMemberProfileErrors((current) => ({ ...current, handle: "Este nome de usuário já está em uso." }));
        showNotice("warning", "Nome de usuário indisponível", "Escolha outro identificador e tente novamente.");
      } else {
        showNotice("error", "Perfil não salvo", "Não foi possível salvar o perfil pessoal agora. Tente novamente.");
      }
      return false;
    } finally {
      setMemberProfileSaving(false);
    }
  }

  async function saveMemberProfileAndClose() {
    const saved = await saveMemberProfile();
    if (saved) setMemberProfileEditorOpen(false);
  }

  function toggleNewPublicInfo(field) {
    setNewPublicInfo((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function buildTournamentPublicInfo() {
    return {
      visibility: { ...newPublicInfo },
      organizer: {
        photoUrl: organizerProfile.photoUrl || "",
        arenaName: organizerProfile.arenaName || "",
        organizerName: organizerProfile.organizerName || "",
        whatsapp: organizerProfile.whatsapp || "",
        instagramHandle: organizerProfile.instagramHandle || "",
        instagramLink: organizerProfile.instagramLink || "",
        whatsappGroupLink: organizerProfile.whatsappGroupLink || "",
        address: organizerProfile.address || "",
        mapsLink: organizerProfile.mapsLink || "",
        city: organizerProfile.city || "",
        state: organizerProfile.state || "",
      },
    };
  }

  function ensureArenaProfileReadyForPublication() {
    const arenaName = String(organizerProfile.arenaName || profile.arena_name || "").trim();
    const organizerName = String(organizerProfile.organizerName || profile.name || "").trim();

    if (arenaName && organizerName) return true;

    showNotice(
      "warning",
      "Complete o perfil da arena",
      "Informe o nome da organização e o nome do responsável antes de criar um evento público."
    );
    openProfileSection("editar");
    return false;
  }

  async function syncPublicArenaDirectory(
    nextTournaments = tournaments,
    nextCircuits = circuits,
    { updateLocalState = true, protectConcurrentData = false } = {}
  ) {
    const activeTournaments = (nextTournaments || []).filter((item) => !item.data?.deletedAt);
    if (!activeTournaments.length) return [];

    const normalizedTournaments = activeTournaments.map((item) => ({
      ...item,
      public_id: item.public_id || generatePublicId(),
      is_public: true,
    }));
    const updatedTournaments = await Promise.all(normalizedTournaments.map(async (item) => {
      const originalItem = activeTournaments.find((candidate) => candidate.id === item.id);
      const needsDirectoryUpdate = !originalItem?.public_id || originalItem?.is_public !== true;
      if (!needsDirectoryUpdate) return item;

      let directoryUpdate = supabase
        .from("tournaments")
        .update({
          public_id: item.public_id,
          is_public: true,
        })
        .eq("id", item.id)
        .eq("user_id", user.id);
      const itemRevision = getCollaborationRevision(item);
      if (protectConcurrentData && itemRevision !== null) {
        directoryUpdate = directoryUpdate.eq("revision", itemRevision);
      } else if (protectConcurrentData && item.updated_at) {
        directoryUpdate = directoryUpdate.eq("updated_at", item.updated_at);
      }
      const { data: savedDirectoryItem, error } = await directoryUpdate.select("*").maybeSingle();

      if (error) {
        console.warn("Não foi possível atualizar o diretório público da arena:", error);
        return item;
      }

      return savedDirectoryItem || item;
    }));

    if (updateLocalState) {
      const updatedById = new Map(updatedTournaments.map((item) => [String(item.id), item]));
      const reconciledTournaments = sortTournamentsByStoredOrder(
        tournamentsRef.current.map((current) => {
          const updated = updatedById.get(String(current.id));
          return updated ? mergeRealtimeTournamentRow(current, updated) : current;
        })
      );
      tournamentsRef.current = reconciledTournaments;
      setTournaments(reconciledTournaments);
    }
    return updatedTournaments;
  }


  function handleOrganizerPhotoFile(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      showNotice("warning", "Arquivo inválido", "Escolha uma imagem para usar como foto de perfil.");
      return;
    }
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      showNotice("warning", "Imagem muito grande", "Escolha uma imagem com até 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoEditor({ imageUrl: String(reader.result || ""), zoom: 1, x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }

  function clampPhotoZoom(value) {
    return Math.min(4, Math.max(1, Number(value) || 1));
  }

  function clampPhotoOffset(value) {
    return Math.min(160, Math.max(-160, Number(value) || 0));
  }

  function handlePhotoPointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    photoPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (photoPointersRef.current.size === 1) {
      lastPhotoDragRef.current = { x: e.clientX, y: e.clientY };
      lastPhotoPinchRef.current = null;
    }

    if (photoPointersRef.current.size === 2) {
      const points = Array.from(photoPointersRef.current.values());
      lastPhotoPinchRef.current = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      lastPhotoDragRef.current = null;
    }
  }

  function handlePhotoPointerMove(e) {
    if (!photoPointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    photoPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (photoPointersRef.current.size === 1 && lastPhotoDragRef.current) {
      const dx = e.clientX - lastPhotoDragRef.current.x;
      const dy = e.clientY - lastPhotoDragRef.current.y;
      lastPhotoDragRef.current = { x: e.clientX, y: e.clientY };

      setPhotoEditor((prev) => prev ? {
        ...prev,
        x: clampPhotoOffset((prev.x || 0) + dx),
        y: clampPhotoOffset((prev.y || 0) + dy),
      } : prev);
    }

    if (photoPointersRef.current.size === 2 && lastPhotoPinchRef.current) {
      const points = Array.from(photoPointersRef.current.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const ratio = distance / lastPhotoPinchRef.current;
      lastPhotoPinchRef.current = distance;

      setPhotoEditor((prev) => prev ? {
        ...prev,
        zoom: clampPhotoZoom((prev.zoom || 1) * ratio),
      } : prev);
    }
  }

  function handlePhotoPointerEnd(e) {
    photoPointersRef.current.delete(e.pointerId);
    lastPhotoDragRef.current = null;
    lastPhotoPinchRef.current = null;

    if (photoPointersRef.current.size === 1) {
      const point = Array.from(photoPointersRef.current.values())[0];
      lastPhotoDragRef.current = { x: point.x, y: point.y };
    }
  }

  function handlePhotoWheel(e) {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -0.08 : 0.08;
    setPhotoEditor((prev) => prev ? {
      ...prev,
      zoom: clampPhotoZoom((prev.zoom || 1) + direction),
    } : prev);
  }

  function drawPhotoEditorCanvas(canvas, outputSize, onDone) {
    if (!canvas || !photoEditor?.imageUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.onload = () => {
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();

      const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
      const scale = baseScale * Number(photoEditor.zoom || 1);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const previewSize = photoPreviewRef.current?.getBoundingClientRect()?.width || outputSize;
      const offsetScale = outputSize / previewSize;
      const offsetX = Number(photoEditor.x || 0) * offsetScale;
      const offsetY = Number(photoEditor.y || 0) * offsetScale;

      ctx.drawImage(
        image,
        (outputSize - drawWidth) / 2 + offsetX,
        (outputSize - drawHeight) / 2 + offsetY,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      onDone?.(canvas);
    };
    image.src = photoEditor.imageUrl;
  }

  useEffect(() => {
    if (!photoEditor?.imageUrl || !photoCanvasRef.current || !photoPreviewRef.current) return;
    const previewSize = Math.round(photoPreviewRef.current.getBoundingClientRect().width || 220);
    drawPhotoEditorCanvas(photoCanvasRef.current, previewSize);
  }, [photoEditor]);

  function applyEditedOrganizerPhoto() {
    if (!photoEditor?.imageUrl) return;

    const canvas = document.createElement("canvas");
    drawPhotoEditorCanvas(canvas, 360, (finalCanvas) => {
      const photoUrl = finalCanvas.toDataURL("image/png", 0.92);
      setOrganizerProfile((prev) => {
        const next = { ...prev, photoUrl };
        localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(next));
        return next;
      });
      setPhotoEditor(null);
      showNotice("info", "Foto preparada", "Ajuste concluído. Clique em “Salvar alterações” para enviar a foto à nuvem.");
    });
  }

  function removeOrganizerPhoto() {
    setOrganizerProfile((prev) => {
      const next = { ...prev, photoUrl: "" };
      localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  async function handleOrganizationGalleryFiles(files) {
    if (!files?.length || organizationGallerySaving) return;
    const availableSlots = Math.max(0, 6 - organizationGallery.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (selectedFiles.length === 0) {
      showNotice("info", "Galeria completa", "A organização aceita até seis fotos.");
      return;
    }
    try {
      const { prepareSocialPostImageFile } = await import("./features/media/imageResize.mjs");
      const prepared = await Promise.all(selectedFiles.map((file) => prepareSocialPostImageFile(file)));
      setOrganizationGallery((current) => [
        ...current,
        ...prepared.map((entry) => entry.imageUrl),
      ].slice(0, 6));
    } catch (error) {
      showNotice("warning", "Fotos não adicionadas", error?.message || "Escolha outras imagens.");
    }
  }

  function removeOrganizationGalleryPhoto(index) {
    if (organizationGallerySaving) return;
    setOrganizationGallery((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  async function saveOrganizationGallery() {
    if (!user?.id || organizationGallerySaving) return;
    if (organizationGalleryStatus !== "ready") {
      showNotice("warning", "Galeria indisponível", "A estrutura da galeria precisa estar disponível no site teste.");
      return;
    }
    if (JSON.stringify(organizationGallery) === JSON.stringify(organizationGalleryBaseRef.current)) {
      showNotice("info", "Galeria já atualizada", "Não há novas fotos para enviar.");
      return;
    }
    setOrganizationGallerySaving(true);
    try {
      const { uploadOrganizationProfileGalleryPhoto } = await import("./services/mediaStorage.mjs");
      const uploadedPhotos = await Promise.all(organizationGallery.map((photoUrl, index) => (
        /^data:image\//i.test(photoUrl)
          ? uploadOrganizationProfileGalleryPhoto({ supabase, userId: user.id, photoUrl, position: index + 1 })
          : photoUrl
      )));
      const savedPhotos = await saveMyOrganizationGallery({ supabase, photoUrls: uploadedPhotos });
      organizationGalleryBaseRef.current = savedPhotos;
      setOrganizationGallery(savedPhotos);
      showNotice("success", "Galeria atualizada", "As fotos da organização foram salvas no perfil público.");
    } catch (error) {
      console.error("Erro ao salvar galeria da organização:", error);
      showNotice("error", "Galeria não salva", "Não foi possível salvar as fotos agora.");
    } finally {
      setOrganizationGallerySaving(false);
    }
  }

  function sortTournamentsByStoredOrder(items) {
    return sortTournamentsForDisplay(items);
  }

  function mergeTournamentDirectoryRow(current, incoming) {
    if (!current) return incoming;
    if (!incoming) return current;
    if (isTournamentSummary(incoming) && !isTournamentSummary(current)) {
      if (compareCollaborationVersions(incoming, current) < 0) return current;
      return {
        ...current,
        ...incoming,
        data: { ...(current.data || {}), ...(incoming.data || {}) },
        __summary: false,
      };
    }
    return mergeRealtimeTournamentRow(current, incoming);
  }

  async function persistTournamentOrderSequence(items, { manual = false } = {}) {
    let orderedTournaments = (items || []).map((tournament, displayOrder) => ({
      ...tournament,
      data: {
        ...(tournament.data || {}),
        displayOrder,
        displayOrderMode: manual ? "manual" : (tournament.data?.displayOrderMode || "automatic"),
      },
    }));

    if (orderedTournaments.length === 0) return { tournaments: [], error: null };

    let { error } = await supabase.rpc("set_tournament_order_safe", {
      p_tournament_ids: orderedTournaments.map((tournament) => tournament.id),
    });

    const safeFunctionMissing = error && /set_tournament_order_safe|function.*does not exist|schema cache/i.test(
      `${error.message || ""} ${error.code || ""}`
    );

    if (safeFunctionMissing) {
      ({ error } = await supabase.rpc("set_tournament_order", {
        p_tournament_ids: orderedTournaments.map((tournament) => tournament.id),
      }));
    }

    if (!error && manual && safeFunctionMissing) {
      const fullRows = await loadFullTournamentRows(
        orderedTournaments.map((tournament) => tournament.id),
        { silentError: true }
      );
      const fullRowsById = new Map(fullRows.map((row) => [String(row.id), row]));
      const missingFullRow = orderedTournaments.some((tournament) => (
        !fullRowsById.has(String(tournament.id))
      ));
      if (missingFullRow) {
        return {
          tournaments: orderedTournaments,
          error: new Error("Os detalhes completos dos torneios não puderam ser carregados para salvar a ordem."),
        };
      }
      orderedTournaments = orderedTournaments.map((tournament, displayOrder) => {
        const fullTournament = fullRowsById.get(String(tournament.id));
        return {
          ...fullTournament,
          data: {
            ...(fullTournament.data || {}),
            displayOrder,
            displayOrderMode: "manual",
          },
        };
      });
      const updates = await Promise.all(orderedTournaments.map((tournament) => (
        (() => {
          let markerUpdate = supabase
          .from("tournaments")
          .update({ data: tournament.data })
          .eq("id", tournament.id)
          .eq("user_id", user.id);
          const tournamentRevision = getCollaborationRevision(tournament);
          if (tournamentRevision !== null) markerUpdate = markerUpdate.eq("revision", tournamentRevision);
          else if (tournament.updated_at) markerUpdate = markerUpdate.eq("updated_at", tournament.updated_at);
          return markerUpdate.select("*").maybeSingle();
        })()
      )));
      const markerError = updates.find((result) => result.error)?.error || null;
      const markerConflict = updates.some((result) => !result.error && !result.data);
      if (markerError || markerConflict) {
        return {
          tournaments: orderedTournaments,
          error: markerError || new Error("A ordem encontrou um torneio alterado em outra aba."),
        };
      }
    }

    if (!error) {
      const { data: refreshedRows, error: refreshError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", user.id)
        .in("id", orderedTournaments.map((tournament) => tournament.id));
      if (refreshError || (refreshedRows || []).length !== orderedTournaments.length) {
        return {
          tournaments: orderedTournaments,
          error: refreshError || new Error("Não foi possível confirmar as novas versões da ordem."),
        };
      }
      const refreshedById = new Map((refreshedRows || []).map((row) => [String(row.id), row]));
      orderedTournaments = orderedTournaments.map((tournament) => (
        mergeRealtimeTournamentRow(tournament, refreshedById.get(String(tournament.id)))
      ));
    }

    return { tournaments: orderedTournaments, error };
  }

  async function confirmTournamentSnapshotOnServer(updated, persistedData) {
    // A escrita do Postgres pode terminar depois que a resposta HTTP é
    // interrompida em conexões lentas. O identificador exclusivo confirma a
    // mutação exata sem depender da serialização completa do JSON retornado.
    const confirmationDelays = [0, 400, 1000, 2200, 4200];
    let latestTournament = null;
    let latestError = null;
    // A confirmação precisa ler o snapshot completo. Em algumas respostas
    // intermediárias do PostgREST o identificador da mutação pode não voltar,
    // embora nome, modalidade e dados já tenham sido gravados corretamente.
    // Conferir também o conteúdo evita declarar erro depois de um salvamento
    // que de fato terminou no servidor.
    const confirmationColumns = "*";

    for (const delay of confirmationDelays) {
      if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));

      const { data, error } = await executeTournamentRequest((signal) => (
        supabase
          .from("tournaments")
          .select(confirmationColumns)
          .eq("id", updated.id)
          .eq("user_id", user.id)
          .abortSignal(signal)
          .maybeSingle()
      ), 5000);

      if (error) {
        latestError = error;
        continue;
      }

      latestTournament = data;
      if (tournamentMutationWasApplied(data, updated.changeId)) {
        return {
          matched: true,
          tournament: {
            ...updated,
            ...data,
            data: persistedData,
            __summary: false,
          },
          error: null,
        };
      }
      if (tournamentSnapshotMatches(data, updated, persistedData)) {
        return { matched: true, tournament: { ...data, __summary: false }, error: null };
      }
    }

    return { matched: false, tournament: latestTournament, error: latestError };
  }

  async function executeTournamentRequest(queryFactory, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await queryFactory(controller.signal);
    } catch (error) {
      return { data: null, error };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function persistTournamentSnapshot(updated, { expectedUpdatedAt = null, expectedRevision = null } = {}) {
    if (isTournamentSummary(updated)) {
      const error = new Error("A gravação foi interrompida porque os detalhes completos do torneio ainda não foram carregados.");
      console.error(error);
      return { ok: false, error, retryable: true };
    }
    const lifecycleStatus = getTournamentLifecycleStatus(updated);
    const persistedData = { ...(updated.data || {}), lifecycleStatus };
    const { data: serverTournament, error: serverReadError } = await executeTournamentRequest((signal) => (
      supabase
        .from("tournaments")
        .select("*")
        .eq("id", updated.id)
        .eq("user_id", user.id)
        .abortSignal(signal)
        .maybeSingle()
    ), 8000);

    if (serverReadError) {
      console.error("Erro ao conferir a cópia protegida do torneio:", serverReadError);
      return { ok: false, error: serverReadError, retryable: isRetryableConnectionError(serverReadError) };
    }

    if (!serverTournament) {
      const error = new Error("O torneio não foi encontrado antes da gravação protegida.");
      return { ok: false, error, retryable: false };
    }

    const serverRevision = getCollaborationRevision(serverTournament);
    if (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0
      && serverRevision !== null && serverRevision !== expectedRevision) {
      return { ok: false, conflict: true, serverTournament: { ...serverTournament, __summary: false } };
    }
    if ((!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      && expectedUpdatedAt && serverTournament.updated_at !== expectedUpdatedAt) {
      return { ok: false, conflict: true, serverTournament: { ...serverTournament, __summary: false } };
    }

    const scoreSafety = inspectTournamentScoreRegression(serverTournament.data, persistedData);
    if (scoreSafety.unsafe && updated.allowScoreRegression !== true) {
      const error = new Error(
        `Gravação protegida: ${scoreSafety.removedScores} placares, ${scoreSafety.removedGames} jogos e ${scoreSafety.removedRounds} rodadas seriam removidos.`
      );
      error.code = "TOURNAMENT_SCORE_REGRESSION";
      console.error(error, scoreSafety);
      return { ok: false, error, protected: true, scoreSafety };
    }
    const nextUpdatedAt = new Date().toISOString();

    const safeSaveArgs = {
      p_tournament_id: updated.id,
      p_name: updated.name,
      p_type: updated.type,
      p_data: persistedData,
      p_status: lifecycleStatus === "finished" ? "finished" : "active",
      p_last_change_id: updated.changeId || null,
      p_expected_revision: serverRevision,
      p_expected_updated_at: serverRevision === null ? serverTournament.updated_at : null,
      p_allow_critical_reset: updated.allowScoreRegression === true,
    };
    let { data: savedTournament, error } = await executeTournamentRequest((signal) => (
      supabase
        .rpc("save_tournament_snapshot_safe", safeSaveArgs)
        .select("id,user_id,name,type,status,created_at,updated_at,revision,last_change_id")
        .abortSignal(signal)
        .maybeSingle()
    ), 20000);

    const safeFunctionMissing = error && /save_tournament_snapshot_safe|function.*does not exist|schema cache/i.test(
      `${error.message || ""} ${error.details || ""} ${error.hint || ""}`
    );
    if (safeFunctionMissing) {
      let query = supabase
        .from("tournaments")
        .update({
          name: updated.name,
          type: updated.type,
          data: persistedData,
          status: lifecycleStatus === "finished" ? "finished" : "active",
          updated_at: nextUpdatedAt,
          last_change_id: updated.changeId || null,
        })
        .eq("id", updated.id)
        .eq("user_id", user.id);
      if (serverRevision !== null) query = query.eq("revision", serverRevision);
      else if (serverTournament.updated_at) query = query.eq("updated_at", serverTournament.updated_at);
      ({ data: savedTournament, error } = await executeTournamentRequest((signal) => (
        query
          .select("id,user_id,name,type,status,created_at,updated_at,revision,last_change_id")
          .abortSignal(signal)
          .maybeSingle()
      ), 20000));
    }

    if (error) {
      const confirmation = await confirmTournamentSnapshotOnServer(updated, persistedData);
      if (confirmation.matched) {
        console.warn("A resposta da gravação falhou, mas o torneio foi confirmado no servidor.", error);
        return {
          ok: true,
          tournament: confirmation.tournament,
          confirmedAfterAmbiguousResponse: true,
        };
      }
      console.error("Erro ao salvar torneio:", error, confirmation.error || "");
      return { ok: false, error, retryable: isRetryableConnectionError(error) };
    }

    if (!savedTournament) {
      const confirmation = await confirmTournamentSnapshotOnServer(updated, persistedData);
      if (confirmation.matched) {
        return {
          ok: true,
          tournament: confirmation.tournament,
          confirmedAfterAmbiguousResponse: true,
        };
      }

      if (confirmation.error && !confirmation.tournament) {
        console.error("Erro ao conferir versão do torneio:", confirmation.error);
        return {
          ok: false,
          error: confirmation.error,
          retryable: isRetryableConnectionError(confirmation.error),
        };
      }

      return { ok: false, conflict: true, serverTournament: confirmation.tournament };
    }

    return {
      ok: true,
      tournament: {
        ...updated,
        ...savedTournament,
        data: persistedData,
        __summary: false,
      },
    };
  }

  async function syncPendingTournamentDrafts(tournamentSource = []) {
    if (isBrowserOffline()) return { tournaments: tournamentSource, syncedCount: 0, pendingRetryCount: 0 };

    const localDrafts = listLocalTournamentDrafts(user.id);
    const indexedDrafts = await listPendingTournaments(user.id);
    const draftsByTournament = new Map();

    [...indexedDrafts, ...localDrafts].forEach((draft) => {
      if (!draft?.tournamentId || !draft?.data) return;
      const current = draftsByTournament.get(draft.tournamentId);
      if (!current || Number(draft.updatedAt || 0) >= Number(current.updatedAt || 0)) {
        draftsByTournament.set(draft.tournamentId, draft);
      }
    });

    if (!draftsByTournament.size) {
      setPendingSyncCount(0);
      return { tournaments: tournamentSource, syncedCount: 0, pendingRetryCount: 0 };
    }

    let nextTournaments = [...tournamentSource];
    let syncedCount = 0;
    let pendingRetryCount = 0;

    for (const draft of draftsByTournament.values()) {
      if (selectedRef.current?.id && String(selectedRef.current.id) === String(draft.tournamentId)) continue;
      let serverTournament = nextTournaments.find((item) => String(item.id) === String(draft.tournamentId));
      if (!serverTournament) continue;
      if (isTournamentSummary(serverTournament)) {
        const hydratedTournament = await hydrateTournamentDetails(serverTournament, { silentError: true });
        if (!hydratedTournament) {
          pendingRetryCount += 1;
          continue;
        }
        serverTournament = hydratedTournament;
        nextTournaments = nextTournaments.map((item) => (
          String(item.id) === String(serverTournament.id) ? serverTournament : item
        ));
      }

      if (JSON.stringify(serverTournament.data || {}) === JSON.stringify(draft.data || {})) {
        clearTournamentDraft(user.id, serverTournament.id);
        syncedCount += 1;
        continue;
      }

      let dataToPersist = draft.data;
      const draftBaseRevision = draft.baseRevision !== null
        && draft.baseRevision !== undefined
        && Number.isSafeInteger(Number(draft.baseRevision))
        ? Number(draft.baseRevision)
        : null;
      const serverRevision = getCollaborationRevision(serverTournament);
      const serverChangedSinceDraft = draftBaseRevision !== null && serverRevision !== null
        ? draftBaseRevision !== serverRevision
        : Boolean(draft.baseUpdatedAt && serverTournament.updated_at && draft.baseUpdatedAt !== serverTournament.updated_at);

      if (serverChangedSinceDraft) {
        const merged = mergeConcurrentTournamentData(
          draft.baseData || {},
          draft.data,
          serverTournament.data || {}
        );
        dataToPersist = merged.data;
      }

      let result = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        result = await persistTournamentSnapshot({
          ...serverTournament,
          data: dataToPersist,
          scoreSafetyBaseData: serverTournament.data,
          allowScoreRegression: draft.allowScoreRegression === true,
        }, {
          expectedUpdatedAt: serverTournament.updated_at || null,
          expectedRevision: getCollaborationRevision(serverTournament),
        });

        if (result.ok || !result.conflict || !result.serverTournament?.data) break;

        const merged = mergeConcurrentTournamentData(
          serverTournament.data || {},
          dataToPersist,
          result.serverTournament.data || {}
        );
        dataToPersist = merged.data;
        serverTournament = result.serverTournament;
      }

      if (result?.ok && result.tournament) {
        nextTournaments = nextTournaments.map((item) => (
          item.id === result.tournament.id ? result.tournament : item
        ));
        clearTournamentDraft(user.id, result.tournament.id);
        syncedCount += 1;
      } else {
        pendingRetryCount += 1;
      }

      if (result?.retryable) {
        break;
      }
    }

    setPendingSyncCount(listLocalTournamentDrafts(user.id).length);
    return { tournaments: nextTournaments, syncedCount, pendingRetryCount };
  }

  function mergeFullTournamentRowsIntoState(rows = []) {
    if (!rows.length) return;
    const rowsById = new Map(rows.map((row) => [String(row.id), { ...row, __summary: false }]));
    const mergeRow = (current) => {
      const fullRow = rowsById.get(String(current.id));
      return fullRow ? mergeRealtimeTournamentRow(current, fullRow) : current;
    };
    const nextTournaments = sortTournamentsByStoredOrder(tournamentsRef.current.map(mergeRow));
    const nextTrashTournaments = trashTournamentsRef.current.map(mergeRow);
    tournamentsRef.current = nextTournaments;
    trashTournamentsRef.current = nextTrashTournaments;
    setTournaments(nextTournaments);
    setTrashTournaments(nextTrashTournaments);
    setSelected((current) => current?.id && rowsById.has(String(current.id))
      ? mergeRealtimeTournamentRow(current, rowsById.get(String(current.id)))
      : current);
  }

  async function loadFullTournamentRows(tournamentIds, { silentError = false } = {}) {
    const ids = [...new Set((tournamentIds || []).map(String).filter(Boolean))];
    if (!ids.length) return [];

    const loadedRows = [...tournamentsRef.current, ...trashTournamentsRef.current]
      .filter((item) => ids.includes(String(item.id)) && !isTournamentSummary(item));
    const loadedIds = new Set(loadedRows.map((item) => String(item.id)));
    const missingIds = ids.filter((id) => !loadedIds.has(id));
    if (!missingIds.length) return loadedRows;
    if (isBrowserOffline()) return loadedRows;

    const requestKey = missingIds.slice().sort().join(",");
    const existingRequest = tournamentDetailsLoadPromisesRef.current.get(requestKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", user.id)
        .in("id", missingIds);
      if (error) {
        console.error("Erro ao carregar detalhes dos torneios:", error);
        if (!silentError) showNotice("error", "Detalhes indisponíveis", "Não foi possível carregar agora os dados completos do torneio.");
        return loadedRows;
      }
      const fullRows = (data || []).map((row) => ({ ...row, __summary: false }));
      mergeFullTournamentRowsIntoState(fullRows);
      return [...loadedRows, ...fullRows];
    })().finally(() => tournamentDetailsLoadPromisesRef.current.delete(requestKey));

    tournamentDetailsLoadPromisesRef.current.set(requestKey, request);
    return request;
  }

  async function hydrateTournamentDetails(tournament, { silentError = false } = {}) {
    if (!tournament?.id) return null;
    const currentTournament = [...tournamentsRef.current, ...trashTournamentsRef.current]
      .find((item) => String(item.id) === String(tournament.id));
    const candidate = currentTournament || tournament;
    if (!isTournamentSummary(candidate)) return candidate;
    const rows = await loadFullTournamentRows([candidate.id], { silentError });
    return rows.find((item) => String(item.id) === String(candidate.id)) || null;
  }

  async function loadTournaments({ silentError = false, retryAfterRealtime = true } = {}) {
    const realtimeEpoch = tournamentRealtimeEpochRef.current;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleteLimit = thirtyDaysAgo.toISOString();

    let { data, error } = await supabase
      .from("tournaments")
      .select(tournamentSummarySelect)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    let loadedAsSummaries = !error;
    if (error) {
      console.warn("A listagem leve de torneios não está disponível; usando leitura compatível.", error);
      ({ data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }));
      loadedAsSummaries = false;
    }

    if (error) {
      if (!silentError) showNotice("error", "Erro ao carregar", "Não foi possível carregar seus torneios.");
      console.error(error);
      return;
    }

    if (tournamentRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadTournaments({ silentError, retryAfterRealtime: false });
      return tournamentsRef.current;
    }

    const currentRows = [...tournamentsRef.current, ...trashTournamentsRef.current];
    const currentRowsById = new Map(currentRows.map((item) => [String(item.id), item]));
    // Abas antigas continuam visíveis como resumos e são hidratadas somente
    // quando o organizador volta a abri-las. Pré-carregar até 12 JSONs completos
    // fazia perfis grandes transferirem megabytes antes de qualquer ação.
    const retainedFullIds = new Set(
      selectedRef.current?.id ? [String(selectedRef.current.id)] : []
    );
    const allTournaments = (data || []).map((item) => {
      const incoming = loadedAsSummaries ? normalizeTournamentSummaryRow(item) : item;
      const current = currentRowsById.get(String(incoming.id));
      if (!loadedAsSummaries) return mergeTournamentDirectoryRow(current, incoming);
      if (current && compareCollaborationVersions(incoming, current) < 0) return current;
      if (current && !isTournamentSummary(current) && retainedFullIds.has(String(incoming.id))) {
        return {
          ...current,
          ...incoming,
          data: { ...(current.data || {}), ...(incoming.data || {}) },
          __summary: false,
        };
      }
      return incoming;
    });
    const expiredTrash = allTournaments.filter((item) => item.data?.deletedAt && item.data.deletedAt < deleteLimit);

    if (expiredTrash.length) {
      const { error: purgeError } = await supabase
        .from("tournaments")
        .delete()
        .eq("user_id", user.id)
        .in("id", expiredTrash.map((item) => item.id));

      if (purgeError) console.error("Erro ao excluir itens expirados da lixeira:", purgeError);
    }

    const validTournaments = allTournaments.filter((item) => !item.data?.deletedAt || item.data.deletedAt >= deleteLimit);
    const activeSource = validTournaments.filter((item) => !item.data?.deletedAt);
    const activeTournaments = sortTournamentsByStoredOrder(activeSource);
    const nextTrashTournaments = validTournaments.filter((item) => item.data?.deletedAt);

    if (tournamentRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadTournaments({ silentError, retryAfterRealtime: false });
      return tournamentsRef.current;
    }

    tournamentsRef.current = activeTournaments;
    trashTournamentsRef.current = nextTrashTournaments;
    setTournaments(activeTournaments);
    setTrashTournaments(nextTrashTournaments);
    setSelected((current) => {
      if (!current?.id) return current;
      const loadedCurrent = activeTournaments.find((item) => item.id === current.id);
      return loadedCurrent ? mergeTournamentDirectoryRow(current, loadedCurrent) : current;
    });
    if (loadedAsSummaries && retainedFullIds.size > 0) {
      void loadFullTournamentRows([...retainedFullIds], { silentError: true });
    }
    return activeTournaments;
  }

  async function migrateReferenceProfilePlayRankingTournaments(tournamentSource = []) {
    if (String(user.id || "") !== PLAY_RANKING_RETROACTIVE_PROFILE_ID || isBrowserOffline()) {
      return {
        tournaments: tournamentSource,
        migratedCount: 0,
        blockedCount: 0,
        failedCount: 0,
        preservedScores: 0,
      };
    }

    if (playRankingRetroMigrationInFlightRef.current) {
      return playRankingRetroMigrationInFlightRef.current;
    }

    const migrationRequest = (async () => {
      const candidates = (tournamentSource || []).filter((item) => (
        !item?.data?.deletedAt
        && modalityConfig[item?.type]?.type === "playranking"
      ));
      if (!candidates.length) {
        return {
          tournaments: tournamentSource,
          migratedCount: 0,
          blockedCount: 0,
          failedCount: 0,
          preservedScores: 0,
        };
      }

      const { data: freshRows, error: freshRowsError } = await executeTournamentRequest((signal) => (
        supabase
          .from("tournaments")
          .select("*")
          .eq("user_id", PLAY_RANKING_RETROACTIVE_PROFILE_ID)
          .in("id", candidates.map((item) => item.id))
          .abortSignal(signal)
      ), 20000);
      if (freshRowsError) {
        console.error("Erro ao carregar os torneios protegidos do PLAY RANKING®:", freshRowsError);
        return {
          tournaments: tournamentSource,
          migratedCount: 0,
          blockedCount: 0,
          failedCount: candidates.length,
          preservedScores: 0,
        };
      }

      const fullRows = (freshRows || []).map((item) => ({ ...item, __summary: false }));
      const fullRowsById = new Map(fullRows.map((item) => [String(item.id), item]));
      const savedById = new Map();
      let migratedCount = 0;
      let blockedCount = 0;
      let failedCount = 0;
      let preservedScores = 0;

      for (const candidate of candidates) {
        let current = fullRowsById.get(String(candidate.id));
        if (!current || isTournamentSummary(current)) {
          failedCount += 1;
          continue;
        }

        let finished = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const normalizedData = normalizeTournamentData(current.type, current.data);
          const migration = migratePlayRankingBracketForReferenceProfile(current, normalizedData);

          if (migration.blocked) {
            blockedCount += 1;
            finished = true;
            break;
          }
          if (!migration.applied) {
            finished = true;
            break;
          }

          const result = await persistTournamentSnapshot({
            ...current,
            data: migration.data,
            scoreSafetyBaseData: current.data,
            allowScoreRegression: true,
            changeId: generateCollaborationChangeId(),
          }, {
            expectedUpdatedAt: current.updated_at || null,
            expectedRevision: getCollaborationRevision(current),
          });

          if (result.ok && result.tournament) {
            savedById.set(String(result.tournament.id), result.tournament);
            migratedCount += 1;
            preservedScores += migration.preservedScores;
            finished = true;
            break;
          }
          if (result.conflict && result.serverTournament?.data) {
            current = { ...result.serverTournament, __summary: false };
            continue;
          }

          failedCount += 1;
          finished = true;
          break;
        }

        if (!finished) failedCount += 1;
      }

      const nextTournaments = sortTournamentsByStoredOrder(
        tournamentsRef.current.map((item) => (
          savedById.get(String(item.id)) || item
        ))
      );
      tournamentsRef.current = nextTournaments;
      setTournaments(nextTournaments);

      return {
        tournaments: nextTournaments,
        migratedCount,
        blockedCount,
        failedCount,
        preservedScores,
      };
    })().finally(() => {
      playRankingRetroMigrationInFlightRef.current = null;
    });

    playRankingRetroMigrationInFlightRef.current = migrationRequest;
    return migrationRequest;
  }

  async function loadDashboardData({ reconnecting = false } = {}) {
    if (dashboardLoadInFlightRef.current) return;
    dashboardLoadInFlightRef.current = true;

    try {
      const cached = await readDashboardCache(user.id);
      const hasCachedDashboard = Boolean(cached && (
        Array.isArray(cached.tournaments) || Array.isArray(cached.circuits)
      ));

      if (hasCachedDashboard && tournamentsRef.current.length === 0 && circuitsRef.current.length === 0) {
        const cachedTournaments = Array.isArray(cached.tournaments) ? cached.tournaments : [];
        const cachedTrash = Array.isArray(cached.trashTournaments) ? cached.trashTournaments : [];
        const cachedCircuits = Array.isArray(cached.circuits) ? cached.circuits : [];
        const cachedTrashCircuits = Array.isArray(cached.trashCircuits) ? cached.trashCircuits : [];
        tournamentsRef.current = cachedTournaments;
        trashTournamentsRef.current = cachedTrash;
        circuitsRef.current = cachedCircuits;
        trashCircuitsRef.current = cachedTrashCircuits;
        setTournaments(cachedTournaments);
        setTrashTournaments(cachedTrash);
        setCircuits(cachedCircuits);
        setTrashCircuits(cachedTrashCircuits);
        setDashboardUsingOfflineCache(true);
      }

      if (isBrowserOffline()) {
        setNetworkOnline(false);
        if (!hasCachedDashboard) {
          showNotice(
            "warning",
            "Primeiro acesso precisa de internet",
            "Este aparelho ainda não possui uma cópia dos seus torneios. Reconecte-se uma vez para preparar o acesso seguro offline."
          );
        }
        return;
      }

      const [loadedTournaments, loadedCircuits] = await Promise.all([
        loadTournaments({ silentError: hasCachedDashboard }),
        loadCircuits({ silentError: hasCachedDashboard }),
      ]);

      if (Array.isArray(loadedTournaments) && Array.isArray(loadedCircuits)) {
        const pendingSync = await syncPendingTournamentDrafts(loadedTournaments);
        const synchronizedById = new Map(
          pendingSync.tournaments.map((item) => [String(item.id), item])
        );
        const synchronizedTournaments = sortTournamentsByStoredOrder(
          tournamentsRef.current.map((current) => {
            const synchronized = synchronizedById.get(String(current.id));
            return synchronized ? mergeTournamentDirectoryRow(current, synchronized) : current;
          })
        );
        tournamentsRef.current = synchronizedTournaments;
        setTournaments(synchronizedTournaments);

        const playRankingMigration = await migrateReferenceProfilePlayRankingTournaments(
          synchronizedTournaments
        );
        const readyTournaments = playRankingMigration.tournaments;

        const criteriaCircuits = await syncAutomaticCircuitCriteria(readyTournaments, loadedCircuits);
        const readyCircuits = criteriaCircuits || loadedCircuits;
        circuitsRef.current = readyCircuits;
        setCircuits(readyCircuits);

        await saveDashboardCache(user.id, {
          tournaments: readyTournaments,
          trashTournaments: trashTournamentsRef.current,
          circuits: readyCircuits,
          trashCircuits: trashCircuitsRef.current,
        });
        setDashboardUsingOfflineCache(false);
        setNetworkOnline(true);
        dashboardLastLoadedAtRef.current = Date.now();

        if (pendingSync.pendingRetryCount > 0) {
          showNotice(
            "warning",
            "Sincronização ainda em andamento",
            "As alterações continuam protegidas neste aparelho e serão enviadas automaticamente assim que a conexão estiver estável."
          );
        } else if (reconnecting && pendingSync.syncedCount > 0) {
          showNotice(
            "success",
            "Dados sincronizados",
            `${pendingSync.syncedCount} alteração(ões) guardada(s) neste aparelho foram enviada(s) para a nuvem.`
          );
        } else if (playRankingMigration.failedCount > 0) {
          showNotice(
            "warning",
            "Atualização parcialmente pendente",
            `${playRankingMigration.failedCount} torneio(s) do Modelo Torneio 360 do PLAY RANKING® não puderam ser atualizados agora. Nenhum dado anterior foi descartado.`
          );
        } else if (playRankingMigration.blockedCount > 0) {
          showNotice(
            "warning",
            "Sorteio necessário",
            `${playRankingMigration.blockedCount} torneio(s) do Modelo Torneio 360 mantiveram a chave anterior porque ainda existe desempate pendente na fase de grupos.`
          );
        } else if (playRankingMigration.migratedCount > 0) {
          showNotice(
            "success",
            "Estrutura oficial aplicada",
            `${playRankingMigration.migratedCount} torneio(s) do PLAY RANKING® foram atualizados com backup da chave anterior e ${playRankingMigration.preservedScores} placar(es) compatível(is) preservado(s).`
          );
        }
      } else if (hasCachedDashboard) {
        setDashboardUsingOfflineCache(true);
      }

    } finally {
      dashboardLoadInFlightRef.current = false;
    }
  }

  function cacheCurrentDashboard() {
    void saveDashboardCache(user.id, {
      tournaments: tournamentsRef.current,
      trashTournaments: trashTournamentsRef.current,
      circuits: circuitsRef.current,
      trashCircuits: trashCircuitsRef.current,
    });
  }

  function applyRemoteTournamentChange(payload) {
    const eventType = payload?.eventType;
    const incomingRow = eventType === "DELETE" ? payload?.old : payload?.new;
    if (!incomingRow?.id) return;
    tournamentRealtimeEpochRef.current += 1;

    if (eventType === "DELETE") {
      tournamentsRef.current = tournamentsRef.current.filter((item) => item.id !== incomingRow.id);
      trashTournamentsRef.current = trashTournamentsRef.current.filter((item) => item.id !== incomingRow.id);
      setTournaments(tournamentsRef.current);
      setTrashTournaments(trashTournamentsRef.current);
      setSelected((current) => current?.id === incomingRow.id ? null : current);
      cacheCurrentDashboard();
      return;
    }

    const existingRow = tournamentsRef.current.find((item) => item.id === incomingRow.id)
      || trashTournamentsRef.current.find((item) => item.id === incomingRow.id)
      || (selectedRef.current?.id === incomingRow.id ? selectedRef.current : null);
    if (existingRow && compareCollaborationVersions(incomingRow, existingRow) < 0) return;
    const row = mergeRealtimeTournamentRow(existingRow, incomingRow);

    if (row.data?.deletedAt) {
      tournamentsRef.current = tournamentsRef.current.filter((item) => item.id !== row.id);
      trashTournamentsRef.current = [
        row,
        ...trashTournamentsRef.current.filter((item) => item.id !== row.id),
      ];
    } else {
      const withoutCurrent = tournamentsRef.current.filter((item) => item.id !== row.id);
      tournamentsRef.current = sortTournamentsByStoredOrder([row, ...withoutCurrent]);
      trashTournamentsRef.current = trashTournamentsRef.current.filter((item) => item.id !== row.id);
    }

    setTournaments(tournamentsRef.current);
    setTrashTournaments(trashTournamentsRef.current);
    setSelected((current) => current?.id === row.id ? row : current);
    cacheCurrentDashboard();
  }

  function applyRemoteTournamentSignal(payload) {
    const signal = payload?.new || payload?.old;
    const tournamentId = signal?.tournament_id;
    if (!tournamentId) return;

    const signalKey = String(tournamentId);
    const runningState = tournamentSignalLoadStateRef.current.get(signalKey);
    if (runningState) {
      runningState.latestSignal = signal;
      runningState.pending = true;
      return;
    }

    const loadState = { latestSignal: signal, pending: false };
    tournamentSignalLoadStateRef.current.set(signalKey, loadState);

    const reconcileSignal = async () => {
      do {
        loadState.pending = false;
        const latestSignal = loadState.latestSignal;

        if (latestSignal.deleted) {
          applyRemoteTournamentChange({ eventType: "DELETE", old: { id: tournamentId } });
          continue;
        }

        const tournamentIsOpen = String(selectedRef.current?.id || "") === signalKey;
        const query = supabase
          .from("tournaments")
          .select(tournamentIsOpen ? "*" : tournamentSummarySelect)
          .eq("id", tournamentId)
          .eq("user_id", user.id)
          .maybeSingle();
        const { data, error } = await query;

        if (error) {
          console.warn("Não foi possível reconciliar a atualização leve do torneio.", error);
          continue;
        }
        if (!data) {
          applyRemoteTournamentChange({ eventType: "DELETE", old: { id: tournamentId } });
          continue;
        }

        const row = tournamentIsOpen
          ? { ...data, __summary: false }
          : normalizeTournamentSummaryRow(data);
        applyRemoteTournamentChange({ eventType: "UPDATE", new: row });
      } while (loadState.pending);
    };

    void reconcileSignal()
      .catch((error) => console.warn("Falha ao processar sinal de atualização do torneio.", error))
      .finally(() => tournamentSignalLoadStateRef.current.delete(signalKey));
  }

  function applyRemoteCircuitChange(payload) {
    const eventType = payload?.eventType;
    const row = eventType === "DELETE" ? payload?.old : payload?.new;
    if (!row?.id) return;
    circuitRealtimeEpochRef.current += 1;

    if (eventType === "DELETE") {
      saveCircuits(circuitsRef.current.filter((item) => item.id !== row.id));
      trashCircuitsRef.current = trashCircuitsRef.current.filter((item) => item.id !== row.id);
      setTrashCircuits(trashCircuitsRef.current);
      cacheCurrentDashboard();
      return;
    }

    const previous = circuitsRef.current.find((item) => item.id === row.id)
      || trashCircuitsRef.current.find((item) => item.id === row.id);
    if (previous && compareCollaborationVersions(row, previous) < 0) return;
    const normalized = {
      ...normalizeCircuitRow(row),
      rankingHistory: previous?.rankingHistory || {},
    };
    if (normalized.deletedAt) {
      saveCircuits(circuitsRef.current.filter((item) => item.id !== row.id));
      trashCircuitsRef.current = [
        normalized,
        ...trashCircuitsRef.current.filter((item) => item.id !== row.id),
      ];
    } else {
      saveCircuits([normalized, ...circuitsRef.current.filter((item) => item.id !== row.id)]);
      trashCircuitsRef.current = trashCircuitsRef.current.filter((item) => item.id !== row.id);
    }
    setTrashCircuits(trashCircuitsRef.current);
    cacheCurrentDashboard();
  }

  function applyRemoteProfileChange(payload) {
    if (payload?.eventType === "DELETE" || !payload?.new?.id) return;
    const remoteRow = payload.new;
    const remoteOrganizerProfile = organizerProfileFromRow(remoteRow, organizerProfileBaseRef.current);

    setOrganizerProfile((current) => {
      const previousBase = organizerProfileBaseRef.current;
      const merged = { ...current };

      Object.keys(remoteOrganizerProfile).forEach((field) => {
        const localFieldWasEdited = current[field] !== previousBase[field];
        if (!localFieldWasEdited) merged[field] = remoteOrganizerProfile[field];
      });

      organizerProfileBaseRef.current = remoteOrganizerProfile;
      try {
        localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(merged));
      } catch (error) {
        console.warn("Não foi possível atualizar a cópia local do perfil.", error);
      }
      return merged;
    });

    onProfileChange?.((current) => ({ ...current, ...remoteRow }));
    saveCachedProfile(user.id, { ...profile, ...remoteRow });
  }

  useEffect(() => {
    void requestDurableOfflineStorage();
    void loadDashboardData();
  }, []);

  useEffect(() => {
    const refreshPendingCount = async (event) => {
      if (event?.detail?.userId && event.detail.userId !== user.id) return;
      const localCount = listLocalTournamentDrafts(user.id).length;
      const indexedCount = (await listPendingTournaments(user.id)).length;
      setPendingSyncCount(Math.max(localCount, indexedCount));
    };
    const handleOnline = () => {
      setNetworkOnline(true);
      void loadDashboardData({ reconnecting: true });
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      setDashboardUsingOfflineCache(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(TOURNAMENT_DRAFT_CHANGED_EVENT, refreshPendingCount);
    void refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(TOURNAMENT_DRAFT_CHANGED_EVENT, refreshPendingCount);
    };
  }, [user.id]);

  useEffect(() => {
    const circuitSignalProcessor = createLatestEntitySignalProcessor({
      getEntityId: (signal) => signal?.circuit_id,
      isDeleted: (signal) => Boolean(signal?.deleted),
      loadEntity: async (circuitId) => {
        const { data, error } = await supabase
          .from("circuits")
          .select(circuitDirectorySelect)
          .eq("id", circuitId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      onDelete: (circuitId) => {
        applyRemoteCircuitChange({ eventType: "DELETE", old: { id: circuitId } });
      },
      onUpdate: (row) => {
        applyRemoteCircuitChange({ eventType: "UPDATE", new: row });
      },
      onError: (error) => {
        console.warn("Não foi possível reconciliar a atualização leve do circuito.", error);
      },
    });
    const channel = supabase
      .channel(`torneio360-collaboration-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_change_feed", filter: `user_id=eq.${user.id}` },
        applyRemoteTournamentSignal
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circuit_change_feed", filter: `user_id=eq.${user.id}` },
        circuitSignalProcessor.handle
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        applyRemoteProfileChange
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Atualização em tempo real temporariamente indisponível; a conferência de segurança continuará ativa.", error);
        }
      });

    const refreshWhenVisible = () => {
      const refreshIsStale = Date.now() - dashboardLastLoadedAtRef.current >= 5 * 60 * 1000;
      if (document.visibilityState === "visible" && !isBrowserOffline() && refreshIsStale) {
        void loadDashboardData();
      }
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 5 * 60 * 1000);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      circuitSignalProcessor.dispose();
      void supabase.removeChannel(channel);
    };
  }, [user.id]);

  async function createTournament() {
    if (saving) return;
    if (!ensureCloudConnection("criar um novo torneio")) return;
    if (!ensureArenaProfileReadyForPublication()) return;
    const isMultiCategory = newMultiCategoryEvent === "sim";
    const validCategorySchedules = newCategorySchedules.filter((item) => item.category.trim());

    if (!newName.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para este torneio.");
      return;
    }

    const tournamentModeration = validatePublicTextFields({
      name: newName,
      category: newCategory,
      categoryNames: newCategorySchedules.map((item) => item.category).join(" "),
      location: newLocation,
      regulations: newRegulationsText,
    });
    if (!tournamentModeration.allowed) {
      showNotice("warning", "Conteúdo não permitido", tournamentModeration.message);
      return;
    }

    if (newRegulationsPdfUrl.trim() && !/^https?:\/\/\S+$/i.test(newRegulationsPdfUrl.trim())) {
      showNotice("warning", "Link do regulamento inválido", "Informe um link público iniciado por http:// ou https://.");
      return;
    }

    if (!isMultiCategory && !newType) {
  showNotice("warning", "Modalidade obrigatória", "Escolha a modalidade do torneio.");
  return;
}

    const effectiveNewGenderMode = getEffectiveTournamentGenderMode(newType, newGenderMode);
    if (!isMultiCategory && !effectiveNewGenderMode) {
      showNotice("warning", "Gênero obrigatório", "Escolha Masculino, Feminino, Mista, Livre ou Outro.");
      return;
    }
    if (!isMultiCategory && effectiveNewGenderMode === tournamentGenderModes.other && !newGenderOther.trim()) {
      showNotice("warning", "Informe o gênero", "Escreva o gênero escolhido na opção Outro.");
      return;
    }

    const effectiveNewRankingCriteria = getNewTournamentRankingCriteria(newType, newRankingCriteria);
    if (!isMultiCategory && !rankingCriteriaOptions.some((option) => option.value === effectiveNewRankingCriteria)) {
      showNotice("warning", "Critério obrigatório", "Escolha a ordem dos critérios do ranking antes de criar o torneio.");
      return;
    }

    if (!isMultiCategory && !allowedTypes.includes(newType)) {
      showNotice("warning", "Modalidade não liberada", "Seu plano não permite essa modalidade.");
      return;
    }

    if (!isMultiCategory && (!newDate || !newEndDate)) {
      showNotice("warning", "Datas obrigatórias", "Informe a data de início e a data de encerramento do torneio.");
      return;
    }

    if (profile.plan === "basic" && tournaments.length >= 1) {
      showNotice("warning", "Limite do plano básico", "O plano Basic permite apenas 1 campeonato por vez.");
      return;
    }

    if (!isMultiCategory && newDate && newEndDate && newEndDate < newDate) {
      showNotice("warning", "Período inválido", "A data final do torneio não pode ser anterior à data inicial.");
      return;
    }

    if (!isMultiCategory && newRegistrationDeadline && newDate && newRegistrationDeadline > newDate) {
      showNotice("warning", "Inscrições após o início", "A data de encerramento das inscrições não pode ser depois do início do torneio.");
      return;
    }

    if (isMultiCategory && validCategorySchedules.length === 0) {
      showNotice("warning", "Categoria obrigatória", "Adicione pelo menos uma categoria para este evento.");
      return;
    }

    if (isMultiCategory) {
      const incompleteCategory = validCategorySchedules.find((item) => (
        !allowedTypes.includes(item.type)
        || !getEffectiveTournamentGenderMode(item.type, item.participantGenderMode)
        || Boolean(
          getEffectiveTournamentGenderMode(item.type, item.participantGenderMode) === tournamentGenderModes.other
          && !item.genderOther?.trim()
        )
        || !rankingCriteriaOptions.some((option) => option.value === getNewTournamentRankingCriteria(item.type, item.rankingCriteria))
        || !item.date
        || !["4", "6", 4, 6].includes(item.winningScore)
        || Boolean(item.endDate && item.endDate < item.date)
        || Boolean(item.registrationDeadline && item.registrationDeadline > item.date)
      ));
      if (incompleteCategory) {
        showNotice("warning", "Categoria incompleta", `Revise gênero, modalidade, data e critério de ${incompleteCategory.category}.`);
        return;
      }
    }

    setSaving(true);

    const eventGroupKey = isMultiCategory ? generatePublicId() : null;
    const config = modalityConfig[newType];
    const categoryStartDates = isMultiCategory
      ? validCategorySchedules.map((item) => item.date).filter(Boolean).sort()
      : [];
    const categoryEndDates = isMultiCategory
      ? validCategorySchedules.map((item) => item.endDate || item.date).filter(Boolean).sort()
      : [];
    const eventStartDate = isMultiCategory ? categoryStartDates[0] : newDate;
    const eventEndDate = isMultiCategory ? categoryEndDates[categoryEndDates.length - 1] : (newEndDate || newDate);

    const baseData = {
      eventName: newName.trim(),
      eventGroupKey,
      multiCategoryEvent: isMultiCategory,
      eventStartDate,
      eventEndDate,
      eventGroupStartDate: isMultiCategory ? eventStartDate : "",
      eventGroupEndDate: isMultiCategory ? eventEndDate : "",
      eventPeriodLabel: eventEndDate && eventEndDate !== eventStartDate ? `${formatDateBR(eventStartDate)} até ${formatDateBR(eventEndDate)}` : formatDateBR(eventStartDate),
      registrationDeadline: isMultiCategory ? "" : newRegistrationDeadline,
      partnerFinder: {
        enabled: newPartnerFinderEnabled,
        deadline: newPartnerFinderDeadline || newRegistrationDeadline || "",
        paymentAfterPair: true,
        organizerCanSuggest: true,
      },
      regulations: {
        text: newRegulationsText.trim(),
        pdfUrl: newRegulationsPdfUrl.trim(),
      },
      location: isMultiCategory ? "" : newLocation.trim(),
      publicInfo: buildTournamentPublicInfo(),
      coverImageUrl: newCoverImageUrl,
      coverImageThumbnailUrl: newCoverImageThumbnailUrl,
      eventCoverImageUrl: newCoverImageUrl,
      eventCoverImageThumbnailUrl: newCoverImageThumbnailUrl,
      winningScore: isMultiCategory ? 4 : (Number(newWinningScore) || 4),
      rankingCriteria: isMultiCategory ? defaultRankingCriteria : effectiveNewRankingCriteria,
      publishedOnProfile: true,
      publishedAt: new Date().toISOString(),
    };

    const rowsToInsert = isMultiCategory
      ? validCategorySchedules.map((item) => {
        const categoryType = item.type;
        const categoryConfig = modalityConfig[categoryType];
        return ({
          user_id: user.id,
          public_id: generatePublicId(),
          is_public: true,
          name: item.category.trim(),
          type: categoryType,
          data: {
            ...createInitialData(categoryType, categoryConfig),
            ...baseData,
            category: item.category.trim(),
            ...getStoredTournamentGenderFields(categoryType, item.participantGenderMode, item.genderOther),
            eventDate: item.date,
            eventStartDate: item.date,
            eventEndDate: item.endDate || item.date,
            registrationDeadline: item.registrationDeadline,
            partnerFinder: {
              ...baseData.partnerFinder,
              deadline: newPartnerFinderDeadline || item.registrationDeadline || "",
            },
            eventDay: getWeekdayBR(item.date),
            eventStartTime: item.time,
            location: item.location.trim(),
            winningScore: Number(item.winningScore) || 4,
            rankingCriteria: getNewTournamentRankingCriteria(item.type, item.rankingCriteria),
            coverImageUrl: item.coverImageUrl || newCoverImageUrl,
            coverImageThumbnailUrl: item.coverImageThumbnailUrl || newCoverImageThumbnailUrl,
            usesEventCover: !item.coverImageUrl,
          },
          status: "active",
        });
      })
      : [{
          user_id: user.id,
          public_id: generatePublicId(),
          is_public: true,
          name: newName.trim(),
          type: newType,
          data: {
            ...createInitialData(newType, config),
            ...baseData,
            category: newCategory.trim(),
            ...getStoredTournamentGenderFields(newType, newGenderMode, newGenderOther),
            eventDate: newDate,
            eventDay: getWeekdayBR(newDate),
            eventStartTime: newEventStartTime,
          },
          status: "active",
        }];

    let createdTournaments = null;
    let creationError = null;
    try {
      const result = await supabase
        .from("tournaments")
        .insert(rowsToInsert)
        .select("*");
      createdTournaments = result.data;
      creationError = result.error;
    } catch (error) {
      creationError = error;
    } finally {
      setSaving(false);
    }

    if (creationError) {
      showNotice("error", "Erro ao criar torneio", "Tente novamente em alguns instantes.");
      console.error(creationError);
      return;
    }

    // O banco já confirmou a criação. A organização local da lista não pode
    // impedir o fechamento do editor nem esconder a confirmação de sucesso.
    const confirmedCreatedTournaments = Array.isArray(createdTournaments)
      ? createdTournaments.filter(Boolean)
      : [];
    const currentTournaments = Array.isArray(tournaments) ? tournaments.filter(Boolean) : [];
    const createdIds = new Set(confirmedCreatedTournaments.map((tournament) => String(tournament.id)));
    const safeInsertion = [
      ...currentTournaments.filter((tournament) => !createdIds.has(String(tournament.id))),
      ...confirmedCreatedTournaments,
    ];
    let manualOrderActive = false;
    let optimisticTournaments = safeInsertion;
    try {
      manualOrderActive = hasSavedManualTournamentOrder(currentTournaments);
      const chronologicalInsertion = insertTournamentsByEventSchedule(
        currentTournaments,
        confirmedCreatedTournaments
      );
      optimisticTournaments = manualOrderActive
        ? chronologicalInsertion.map((tournament, displayOrder) => ({
            ...tournament,
            data: { ...(tournament.data || {}), displayOrder, displayOrderMode: "manual" },
          }))
        : chronologicalInsertion;
    } catch (localProjectionError) {
      console.error("O torneio foi criado, mas a lista local precisou usar a ordem segura:", localProjectionError);
    }
    tournamentsRef.current = optimisticTournaments;
    setTournaments(optimisticTournaments);

    setNewName("");
    setNewType("");
setNewCategory("");
setNewGenderMode("");
setNewGenderOther("");
setNewMultiCategoryEvent("nao");
setNewCategorySchedules([{
  category: "",
  participantGenderMode: "",
  genderOther: "",
  date: "",
  endDate: "",
  registrationDeadline: "",
  time: "",
  type: "",
  location: "",
  winningScore: "4",
  rankingCriteria: "",
  coverImageUrl: "",
  coverImageThumbnailUrl: "",
}]);
setNewDate("");
setNewEndDate("");
setNewRegistrationDeadline("");
setNewPartnerFinderEnabled(true);
setNewPartnerFinderDeadline("");
setNewRegulationsText("");
setNewRegulationsPdfUrl("");
setNewEventStartTime("");
setNewDailyStartTimes({});
setNewDay("");
setNewLocation("");
setNewCoverImageUrl("");
setNewCoverImageThumbnailUrl("");
setNewWinningScore(4);
setNewRankingCriteria("");
setNewPublicInfo({
  showArenaName: true,
  showOrganizerName: true,
  showWhatsapp: true,
  showWhatsappGroupLink: true,
  showInstagram: true,
  showAddress: true,
  showMapsLink: true,
  showCityState: true,
});
    setCreateTournamentOpen(false);
    setSelected(null);
    setTournamentSearch("");
    if (confirmedCreatedTournaments[0]) {
      setTournamentStatusFilter(getTournamentLifecycleStatus(confirmedCreatedTournaments[0]));
    }
    updateAppUrl({ activePanel: "criar", selectedTournamentId: null });
    saveUserAppState({ activePanel: "criar", selectedTournamentId: null });
    showNotice("success", isMultiCategory ? "Torneios criados" : "Torneio criado", isMultiCategory ? "As categorias foram criadas como torneios separados dentro do mesmo evento." : "O torneio foi criado com sucesso.");
    window.requestAnimationFrame(() => {
      document.getElementById("historico-torneios")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    void (async () => {
      let tournamentsForDirectory = optimisticTournaments;
      if (manualOrderActive) {
        const savedOrder = await persistTournamentOrderSequence(optimisticTournaments, { manual: true });
        if (savedOrder.error) console.error("Erro ao posicionar os novos torneios por data e hora:", savedOrder.error);
        else tournamentsForDirectory = savedOrder.tournaments;
      }
      await syncPublicArenaDirectory(tournamentsForDirectory, circuits, {
        updateLocalState: false,
        protectConcurrentData: true,
      });
    })().catch((backgroundError) => {
      console.error("Erro na sincronização posterior à criação do torneio:", backgroundError);
    });
  }

  async function confirmDeleteTournament() {
    if (!deleteTarget) return;
    if (!ensureCloudConnection("mover o torneio para a lixeira")) return;

    const target = await hydrateTournamentDetails(deleteTarget);
    if (!target) return;
    const previousTournaments = tournaments;
    const previousTrashTournaments = trashTournaments;
    const previousOpenTournamentIds = openTournamentIds;
    const deletedAt = new Date().toISOString();
    const deletedTournament = {
      ...target,
      is_public: false,
      data: { ...(target.data || {}), deletedAt },
      updated_at: deletedAt,
    };
    const remainingTournaments = tournaments.filter((tournament) => tournament.id !== target.id);

    setDeleteTarget(null);
    setTournaments(remainingTournaments);
    setTrashTournaments((current) => [
      deletedTournament,
      ...current.filter((tournament) => tournament.id !== target.id),
    ]);
    setOpenTournamentIds((current) => current.filter((id) => id !== target.id));

    let deleteUpdate = supabase
      .from("tournaments")
      .update({
        is_public: false,
        data: deletedTournament.data,
        updated_at: deletedAt,
      })
      .eq("id", target.id)
      .eq("user_id", user.id);
    const targetRevision = getCollaborationRevision(target);
    if (targetRevision !== null) deleteUpdate = deleteUpdate.eq("revision", targetRevision);
    else if (target.updated_at) deleteUpdate = deleteUpdate.eq("updated_at", target.updated_at);
    const { data: movedTournament, error } = await deleteUpdate.select("*").maybeSingle();

    if (error || !movedTournament) {
      setTournaments(previousTournaments);
      setTrashTournaments(previousTrashTournaments);
      tournamentsRef.current = previousTournaments;
      trashTournamentsRef.current = previousTrashTournaments;
      setOpenTournamentIds(previousOpenTournamentIds);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao mover" : "Torneio atualizado em outro dispositivo",
        error
          ? "Não foi possível mover este torneio para a lixeira."
          : "Recarregamos a proteção porque outra pessoa alterou o torneio. Confira a versão atual antes de excluí-lo."
      );
      console.error(error);
      return;
    }

    showNotice("success", "Torneio movido para a lixeira", "Você pode recuperar este torneio em até 30 dias.");

    void (async () => {
      const confirmedDeletedTournament = mergeRealtimeTournamentRow(deletedTournament, movedTournament);
      tournamentsRef.current = remainingTournaments;
      trashTournamentsRef.current = [
        confirmedDeletedTournament,
        ...trashTournamentsRef.current.filter((item) => item.id !== target.id),
      ];
      setTrashTournaments(trashTournamentsRef.current);

      let tournamentsForDirectory = remainingTournaments;
      if (hasSavedManualTournamentOrder(previousTournaments)) {
        const remainingOrder = await persistTournamentOrderSequence(remainingTournaments, { manual: true });
        if (remainingOrder.error) console.error("Erro ao compactar a ordem após excluir o torneio:", remainingOrder.error);
        else tournamentsForDirectory = remainingOrder.tournaments;
      }
      const { circuits: rankedCircuits } = await persistCircuitRankings(tournamentsForDirectory, circuits, target.id);
      await syncPublicArenaDirectory(tournamentsForDirectory, rankedCircuits, {
        updateLocalState: false,
        protectConcurrentData: true,
      });
    })().catch((backgroundError) => {
      console.error("Erro na sincronização posterior ao envio para a lixeira:", backgroundError);
    });
  }

  async function restoreTournament(tournament) {
    if (!ensureCloudConnection("recuperar o torneio")) return;
    const hydratedTournament = await hydrateTournamentDetails(tournament);
    if (!hydratedTournament) return;
    tournament = hydratedTournament;
    const restoredData = { ...(tournament.data || {}) };
    delete restoredData.deletedAt;

    let restoreUpdate = supabase
      .from("tournaments")
      .update({
        public_id: tournament.public_id || generatePublicId(),
        is_public: true,
        data: restoredData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", user.id);
    const tournamentRevision = getCollaborationRevision(tournament);
    if (tournamentRevision !== null) restoreUpdate = restoreUpdate.eq("revision", tournamentRevision);
    else if (tournament.updated_at) restoreUpdate = restoreUpdate.eq("updated_at", tournament.updated_at);
    const { data: restoredRow, error } = await restoreUpdate.select("*").maybeSingle();

    if (error || !restoredRow) {
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao recuperar" : "Torneio atualizado em outro dispositivo",
        error ? "Não foi possível recuperar este torneio." : "Atualize a lixeira e tente novamente."
      );
      console.error(error);
      return;
    }

    const restoredTournament = restoredRow;
    if (hasSavedManualTournamentOrder(tournaments)) {
      const restoredOrder = await persistTournamentOrderSequence(
        insertTournamentsByEventSchedule(tournaments, [restoredTournament]),
        { manual: true }
      );
      if (restoredOrder.error) console.error("Erro ao posicionar o torneio recuperado:", restoredOrder.error);
    }

    const refreshedTournaments = await loadTournaments();
    const { circuits: rankedCircuits } = await persistCircuitRankings(refreshedTournaments || [], circuits, tournament.id);
    await syncPublicArenaDirectory(refreshedTournaments || [], rankedCircuits);
    showNotice("success", "Torneio recuperado", "O torneio voltou para o histórico.");
  }

  async function restoreCircuit(circuit) {
    if (!ensureCloudConnection("recuperar o circuito")) return;
    const restoredSettings = {
      ...normalizeCircuitRankingSettings(circuit.rankingSettings),
      deletedAt: "",
    };
    let restoreUpdate = supabase
      .from("circuits")
      .update({ ranking_settings: restoredSettings, updated_at: new Date().toISOString() })
      .eq("id", circuit.id)
      .eq("user_id", user.id);
    if (circuit.updatedAt) restoreUpdate = restoreUpdate.eq("updated_at", circuit.updatedAt);
    const { data: restoredRow, error } = await restoreUpdate.select("*").maybeSingle();

    if (error || !restoredRow) {
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao recuperar" : "Circuito atualizado em outro dispositivo",
        error ? "Não foi possível recuperar este circuito." : "Atualize a lixeira e tente novamente."
      );
      console.error(error);
      return;
    }

    const restoredCircuit = {
      ...normalizeCircuitRow(restoredRow),
      rankingHistory: circuit.rankingHistory || {},
    };
    trashCircuitsRef.current = trashCircuitsRef.current.filter((item) => item.id !== circuit.id);
    setTrashCircuits(trashCircuitsRef.current);
    saveCircuits([restoredCircuit, ...circuitsRef.current.filter((item) => item.id !== circuit.id)]);
    setSelectedTrashCircuitIds((current) => current.filter((id) => id !== String(circuit.id)));
    await syncPublicArenaDirectory(tournamentsRef.current, circuitsRef.current);
    cacheCurrentDashboard();
    showNotice("success", "Circuito recuperado", "O circuito voltou para a área de circuitos.");
  }

  function toggleTrashSelection(kind, itemId) {
    const normalizedId = String(itemId);
    const setter = kind === "circuits" ? setSelectedTrashCircuitIds : setSelectedTrashTournamentIds;
    setter((current) => current.includes(normalizedId)
      ? current.filter((id) => id !== normalizedId)
      : [...current, normalizedId]);
  }

  function requestPermanentTrashDeletion(kind, ids, all = false) {
    const normalizedIds = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
    if (!normalizedIds.length) return;
    setTrashPermanentAction({ kind, ids: normalizedIds, all });
  }

  async function confirmPermanentTrashDeletion() {
    if (!trashPermanentAction || trashActionBusy) return;
    if (!ensureCloudConnection("excluir definitivamente os itens da lixeira")) return;
    const { kind, ids, all } = trashPermanentAction;
    setTrashActionBusy(true);

    const table = kind === "circuits" ? "circuits" : "tournaments";
    const { data: deletedRows, error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", user.id)
      .in("id", ids)
      .select("id");

    if (error || (deletedRows || []).length !== ids.length) {
      console.error(`Erro ao excluir definitivamente ${kind}:`, error);
      setTrashActionBusy(false);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao excluir definitivamente" : "Alguns itens foram atualizados em outro dispositivo",
        "Atualize a lixeira e tente novamente. Nenhum item que não tenha sido confirmado pelo servidor será removido da tela."
      );
      return;
    }

    if (kind === "circuits") {
      trashCircuitsRef.current = trashCircuitsRef.current.filter((item) => !ids.includes(String(item.id)));
      setTrashCircuits(trashCircuitsRef.current);
      setSelectedTrashCircuitIds((current) => current.filter((id) => !ids.includes(id)));
    } else {
      trashTournamentsRef.current = trashTournamentsRef.current.filter((item) => !ids.includes(String(item.id)));
      setTrashTournaments(trashTournamentsRef.current);
      setSelectedTrashTournamentIds((current) => current.filter((id) => !ids.includes(id)));
    }

    setTrashActionBusy(false);
    setTrashPermanentAction(null);
    cacheCurrentDashboard();
    showNotice(
      "success",
      all ? "Lixeira limpa" : "Exclusão definitiva concluída",
      `${ids.length} ${ids.length === 1 ? "item foi excluído" : "itens foram excluídos"} definitivamente.`
    );
  }

  function getTrashDaysLeft(item) {
    const baseDate = item.data?.deletedAt || item.deletedAt || item.updated_at || item.updatedAt || item.created_at;
    if (!baseDate) return 30;
    const deletedAt = new Date(baseDate).getTime();
    const expiresAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  function registerTournamentNavigationGuard(guard) {
    tournamentNavigationGuardRef.current = typeof guard === "function" ? guard : null;
  }

  function persistTournamentNavigation(tournamentId, updates = {}) {
    if (!tournamentId) return;
    const nextNavigation = {
      ...openTournamentNavigationRef.current,
      [tournamentId]: {
        ...(openTournamentNavigationRef.current[tournamentId] || {}),
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };
    openTournamentNavigationRef.current = nextNavigation;
    saveOpenTournamentNavigation(user.id, nextNavigation);
  }

  function captureCurrentTournamentNavigation() {
    if (!selected?.id) return;
    const params = new URLSearchParams(window.location.search);
    persistTournamentNavigation(selected.id, {
      tournamentTab: params.get("tab") || "participantes",
      matchesTab: params.get("partidas") || "grupos",
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
    });
  }

  async function activateTournament(tournament, { skipSaveGuard = false } = {}) {
    if (!tournament?.id) return false;
    if (selected?.id === tournament.id) return true;

    if (!skipSaveGuard && selected?.id) {
      captureCurrentTournamentNavigation();
      const canNavigate = tournamentNavigationGuardRef.current
        ? await tournamentNavigationGuardRef.current()
        : true;
      if (!canNavigate) return false;
    }

    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournament.id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      showNotice("error", "Erro ao abrir", "Não foi possível abrir este torneio.");
      console.error(error);
      return false;
    }

    const savedNavigation = openTournamentNavigationRef.current[data.id] || {};

    updateAppUrl({
      activePanel: "criar",
      selectedTournamentId: data.id,
      tournamentTab: savedNavigation.tournamentTab || DEFAULT_TOURNAMENT_NAVIGATION.tournamentTab,
      matchesTab: savedNavigation.matchesTab || DEFAULT_TOURNAMENT_NAVIGATION.matchesTab,
    });
    setOpenTournamentIds((currentIds) => currentIds.includes(data.id)
      ? currentIds
      : [...currentIds, data.id].slice(-50));
    setSelected(data);
    queueScrollRestore(savedNavigation.scrollY || 0);
    return true;
  }

  async function openTournament(tournament) {
    return activateTournament(tournament);
  }

  async function closeOpenTournament(tournament) {
    if (!tournament?.id) return false;
    const closingIndex = openTournamentIds.indexOf(tournament.id);
    const remainingIds = openTournamentIds.filter((id) => id !== tournament.id);

    if (selected?.id !== tournament.id) {
      setOpenTournamentIds(remainingIds);
      return true;
    }

    captureCurrentTournamentNavigation();
    const canNavigate = tournamentNavigationGuardRef.current
      ? await tournamentNavigationGuardRef.current()
      : true;
    if (!canNavigate) return false;

    tournamentNavigationGuardRef.current = null;
    const fallbackId = remainingIds[Math.min(Math.max(closingIndex, 0), remainingIds.length - 1)]
      || remainingIds[remainingIds.length - 1];
    const fallbackTournament = tournaments.find((item) => item.id === fallbackId);

    if (fallbackTournament) {
      const switched = await activateTournament(fallbackTournament, { skipSaveGuard: true });
      if (!switched) return false;
    } else {
      closeSelectedTournament();
    }

    setOpenTournamentIds((currentIds) => currentIds.filter((id) => id !== tournament.id));
    return true;
  }

  async function saveTournament(updated) {
    if (isBrowserOffline()) return { ok: false, retryable: true, offline: true };

    const saveResult = await persistTournamentSnapshot(updated, {
      expectedUpdatedAt: updated.updated_at || null,
      expectedRevision: getCollaborationRevision(updated),
    });
    if (!saveResult.ok) return saveResult;

    const persistedTournament = saveResult.tournament;
    setSelected((current) => current?.id === persistedTournament.id
      ? mergeRealtimeTournamentRow(current, persistedTournament)
      : current);
    const nextTournaments = tournamentsRef.current.map((t) => (
      t.id === persistedTournament.id ? mergeRealtimeTournamentRow(t, persistedTournament) : t
    ));
    tournamentsRef.current = nextTournaments;
    setTournaments(nextTournaments);
    void saveDashboardCache(user.id, {
      tournaments: nextTournaments,
      trashTournaments: trashTournamentsRef.current,
      circuits: circuitsRef.current,
      trashCircuits: trashCircuitsRef.current,
    });
    void (async () => {
      const criteriaCircuits = await syncAutomaticCircuitCriteria(nextTournaments, circuitsRef.current);
      let circuitPersistence = await persistCircuitRankings(
        nextTournaments,
        criteriaCircuits || circuitsRef.current,
        persistedTournament.id
      );
      if (!circuitPersistence.success) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        circuitPersistence = await persistCircuitRankings(
          tournamentsRef.current,
          circuitsRef.current,
          persistedTournament.id
        );
      }
      if (!circuitPersistence.success) {
        console.warn("O placar foi salvo e o ranking do circuito será atualizado na próxima sincronização.");
      }
      await saveDashboardCache(user.id, {
        tournaments: tournamentsRef.current,
        trashTournaments: trashTournamentsRef.current,
        circuits: circuitsRef.current,
        trashCircuits: trashCircuitsRef.current,
      });
    })().catch((error) => {
      console.error("Erro ao atualizar o ranking derivado do circuito:", error);
    });
    return { ok: true, tournament: persistedTournament };
  }

  async function openEditTournament(tournament) {
    const hydratedTournament = await hydrateTournamentDetails(tournament);
    if (!hydratedTournament) return;
    tournament = hydratedTournament;
    const details = tournament.data || {};
    const genderFields = getEditableTournamentGenderFields(details, tournament.type);
    setEditTournamentSaving(false);
    setEditTarget(tournament);
    setEditForm({
      name: tournament.name || "",
      type: tournament.type || "",
      eventName: details.eventName || "",
      category: genderFields.category,
      participantGenderMode: genderFields.participantGenderMode,
      genderOther: genderFields.genderOther,
      eventDate: details.eventDate || "",
      eventEndDate: details.eventEndDate || details.eventDate || "",
      registrationDeadline: details.registrationDeadline || "",
      partnerFinderEnabled: details.partnerFinder?.enabled !== false,
      partnerFinderDeadline: details.partnerFinder?.deadline || details.registrationDeadline || "",
      regulationsText: details.regulations?.text || "",
      regulationsPdfUrl: details.regulations?.pdfUrl || "",
      eventStartTime: details.eventStartTime || "",
      location: details.location || "",
      coverImageUrl: details.coverImageUrl || "",
      coverImageThumbnailUrl: details.coverImageThumbnailUrl || "",
      winningScore: Number(details.winningScore || 4),
      rankingCriteria: details.rankingCriteria || defaultRankingCriteria,
    });
  }

  function updateEditForm(field, value) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "participantGenderMode") {
        next.type = getCompatibleTournamentType(prev.type, value, allowedTypes);
      }
      return next;
    });
  }

  async function saveEditedTournament({ confirmModalityChange = false } = {}) {
    if (!editTarget || !editForm || editTournamentSaving) return;
    if (!ensureCloudConnection("salvar as informações do torneio")) return;

    if (!editForm.name.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para este torneio.");
      return;
    }

    const tournamentModeration = validatePublicTextFields({
      name: editForm.name,
      eventName: editForm.eventName,
      category: editForm.category,
      location: editForm.location,
      regulations: editForm.regulationsText,
    });
    if (!tournamentModeration.allowed) {
      showNotice("warning", "Conteúdo não permitido", tournamentModeration.message);
      return;
    }

    if (editForm.regulationsPdfUrl?.trim() && !/^https?:\/\/\S+$/i.test(editForm.regulationsPdfUrl.trim())) {
      showNotice("warning", "Link do regulamento inválido", "Informe um link público iniciado por http:// ou https://.");
      return;
    }

    if (!editForm.eventDate || (!editTarget.data?.multiCategoryEvent && !editForm.eventEndDate)) {
      showNotice("warning", "Datas obrigatórias", "Informe a data de início e a data de encerramento do torneio.");
      return;
    }

    if (editForm.eventDate && editForm.eventEndDate && editForm.eventEndDate < editForm.eventDate) {
      showNotice("warning", "Período inválido", "A data final não pode ser anterior à data inicial.");
      return;
    }

    const modalityChanged = editForm.type !== editTarget.type;
    const nextModalityConfig = modalityConfig[editForm.type];
    if (modalityChanged && !nextModalityConfig) {
      showNotice("warning", "Modalidade obrigatória", "Escolha uma modalidade válida para continuar.");
      return;
    }
    if (modalityChanged && !confirmModalityChange) {
      setModalityChangeConfirmation({ fromType: editTarget.type, toType: editForm.type });
      return;
    }

    const effectiveEditGenderMode = getEffectiveTournamentGenderMode(editForm.type, editForm.participantGenderMode);
    if (!effectiveEditGenderMode) {
      showNotice("warning", "Gênero obrigatório", "Escolha Masculino, Feminino, Mista, Livre ou Outro.");
      return;
    }
    if (effectiveEditGenderMode === tournamentGenderModes.other && !editForm.genderOther.trim()) {
      showNotice("warning", "Informe o gênero", "Escreva o gênero escolhido na opção Outro.");
      return;
    }

    const isGroupedCategory = Boolean(editTarget.data?.multiCategoryEvent);
    const structuralData = modalityChanged
      ? createInitialData(editForm.type, nextModalityConfig)
      : (editTarget.data || {});
    const updatedData = {
      ...structuralData,
      ...(editTarget.data?.displayOrder !== undefined && editTarget.data?.displayOrder !== null
        ? { displayOrder: editTarget.data.displayOrder }
        : {}),
      ...(editTarget.data?.displayOrderMode
        ? { displayOrderMode: editTarget.data.displayOrderMode }
        : {}),
      publicInfo: editTarget.data?.publicInfo || structuralData.publicInfo,
      multiCategoryEvent: editTarget.data?.multiCategoryEvent,
      eventGroupKey: editTarget.data?.eventGroupKey,
      eventCoverImageUrl: editTarget.data?.eventCoverImageUrl,
      eventCoverImageThumbnailUrl: editTarget.data?.eventCoverImageThumbnailUrl,
      usesEventCover: editTarget.data?.usesEventCover,
      eventName: editForm.eventName.trim(),
      category: editForm.category.trim(),
      ...getStoredTournamentGenderFields(editForm.type, editForm.participantGenderMode, editForm.genderOther),
      eventDate: editForm.eventDate,
      eventStartDate: editForm.eventDate,
      eventEndDate: isGroupedCategory ? editForm.eventDate : (editForm.eventEndDate || editForm.eventDate),
      eventPeriodLabel: isGroupedCategory
        ? formatDateBR(editForm.eventDate)
        : editForm.eventEndDate && editForm.eventEndDate !== editForm.eventDate
          ? `${formatDateBR(editForm.eventDate)} até ${formatDateBR(editForm.eventEndDate)}`
          : formatDateBR(editForm.eventDate),
      eventDay: isGroupedCategory
        ? getWeekdayBR(editForm.eventDate)
        : editForm.eventEndDate && editForm.eventEndDate !== editForm.eventDate
          ? `${getWeekdayBR(editForm.eventDate)} até ${getWeekdayBR(editForm.eventEndDate)}`
          : getWeekdayBR(editForm.eventDate),
      registrationDeadline: editForm.registrationDeadline,
      partnerFinder: {
        ...(structuralData.partnerFinder || {}),
        enabled: editForm.partnerFinderEnabled !== false,
        deadline: editForm.partnerFinderDeadline || editForm.registrationDeadline || "",
        paymentAfterPair: true,
        organizerCanSuggest: true,
      },
      regulations: {
        text: String(editForm.regulationsText || "").trim(),
        pdfUrl: String(editForm.regulationsPdfUrl || "").trim(),
      },
      eventStartTime: editForm.eventStartTime,
      location: editForm.location.trim(),
      coverImageUrl: editForm.coverImageUrl || "",
      coverImageThumbnailUrl: editForm.coverImageThumbnailUrl || "",
      winningScore: Number(editForm.winningScore) || 4,
      rankingCriteria: editForm.rankingCriteria || defaultRankingCriteria,
    };

    const statusCandidate = {
      ...editTarget,
      name: editForm.name.trim(),
      type: editForm.type,
      data: updatedData,
    };
    const lifecycleStatus = getTournamentLifecycleStatus(statusCandidate);
    const updated = {
      ...statusCandidate,
      status: lifecycleStatus === "finished" ? "finished" : "active",
      data: { ...updatedData, lifecycleStatus },
    };

    let finalUpdated = updated;
    let mergeBase = editTarget;
    let saveResult = null;
    const editChangeId = generateCollaborationChangeId();
    // Mantém o formulário ou a confirmação visível em estado de salvamento.
    // Assim, nenhuma falha de persistência deixa o organizador em uma tela
    // silenciosa depois que os modais são fechados.
    setEditTournamentSaving(true);

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        saveResult = await persistTournamentSnapshot({
          ...finalUpdated,
          changeId: editChangeId,
          scoreSafetyBaseData: mergeBase.data,
          allowScoreRegression: modalityChanged,
        }, {
          expectedUpdatedAt: mergeBase.updated_at || null,
          expectedRevision: getCollaborationRevision(mergeBase),
        });
        if (saveResult.ok || !saveResult.conflict || !saveResult.serverTournament) break;

        const remoteTournament = saveResult.serverTournament;
        const merged = mergeConcurrentTournamentData(
          { name: mergeBase.name, type: mergeBase.type, data: mergeBase.data || {} },
          { name: finalUpdated.name, type: finalUpdated.type, data: finalUpdated.data || {} },
          {
            name: remoteTournament.name,
            type: remoteTournament.type,
            data: remoteTournament.data || {},
          }
        );
        finalUpdated = {
          ...remoteTournament,
          name: merged.data.name,
          type: merged.data.type,
          data: merged.data.data,
        };
        mergeBase = remoteTournament;
      }

    } catch (error) {
      // Este bloco cobre apenas a persistência. Depois que ela for confirmada,
      // nenhum processamento local poderá transformar um sucesso em falha.
      console.error("Erro inesperado ao salvar o torneio:", error);
      setModalityChangeConfirmation(null);
      showNotice(
        "error",
        "Torneio não atualizado",
        "Ocorreu um erro inesperado durante o salvamento. O formulário foi mantido para você tentar novamente."
      );
      setEditTournamentSaving(false);
      return;
    }

    if (!saveResult?.ok) {
      setModalityChangeConfirmation(null);
      if (saveResult?.conflict) {
        showNotice(
          "warning",
          "Sincronização ainda em andamento",
          "As informações foram preservadas. Tente salvar novamente; a alteração mais recente será aplicada automaticamente."
        );
      } else if (saveResult?.protected) {
        showNotice(
          "warning",
          "Alteração não aplicada",
          "A proteção do torneio impediu que participantes, rodadas ou placares fossem removidos. Revise a alteração e tente novamente."
        );
      } else {
        console.error("Não foi possível confirmar a edição do torneio:", saveResult?.error);
        showNotice(
          "error",
          "Torneio não atualizado",
          "Não foi possível confirmar o salvamento. O formulário foi mantido para você tentar novamente."
        );
      }
      setEditTournamentSaving(false);
      return;
    }

    // A partir daqui o snapshot já foi confirmado no servidor. A atualização
    // da lista é defensiva porque ela é apenas uma projeção local do dado salvo.
    finalUpdated = saveResult.tournament || finalUpdated;
    const currentTournaments = Array.isArray(tournaments) ? tournaments.filter(Boolean) : [];
    const replacedTournaments = currentTournaments.map((tournament) => (
      String(tournament?.id) === String(finalUpdated.id) ? finalUpdated : tournament
    ));
    let orderedTournaments = replacedTournaments;
    try {
      orderedTournaments = hasSavedManualTournamentOrder(replacedTournaments)
        ? replacedTournaments
        : sortTournamentsByEventSchedule(replacedTournaments);
    } catch (localStateError) {
      console.error("O torneio foi salvo, mas a ordenação local precisou usar a lista original:", localStateError);
    }

    setTournaments(orderedTournaments);
    setEditTarget(null);
    setEditForm(null);
    setModalityChangeConfirmation(null);
    setEditTournamentSaving(false);
    showNotice("success", "Torneio atualizado", "As informações foram salvas com sucesso.");

    void (async () => {
      const criteriaCircuits = await syncAutomaticCircuitCriteria(orderedTournaments, circuitsRef.current);
      const { circuits: rankedCircuits, success: circuitRankingSaved } = await persistCircuitRankings(
        orderedTournaments,
        criteriaCircuits || circuitsRef.current,
        finalUpdated.id
      );
      await syncPublicArenaDirectory(orderedTournaments, rankedCircuits);
      if (!circuitRankingSaved) {
        showNotice(
          "warning",
          "Torneio atualizado; ranking pendente",
          "O torneio está salvo. O ranking do circuito será atualizado na próxima sincronização."
        );
      }
    })().catch((error) => {
      console.error("Erro ao atualizar os dados derivados do torneio editado:", error);
      showNotice(
        "warning",
        "Torneio atualizado; sincronização pendente",
        "O torneio está salvo. Os dados derivados serão atualizados na próxima sincronização."
      );
    });
  }

  async function openEditEventGroup(group) {
    const groupSummaryItems = tournaments.filter((tournament) => (
      tournament.data?.multiCategoryEvent === true
      && tournament.data?.eventGroupKey === group.key
    ));
    await loadFullTournamentRows(groupSummaryItems.map((tournament) => tournament.id));
    const groupItems = tournamentsRef.current.filter((tournament) => (
      tournament.data?.multiCategoryEvent === true
      && tournament.data?.eventGroupKey === group.key
    ));
    const firstTournament = groupItems[0] || group.items[0];
    const firstDetails = firstTournament?.data || {};
    const eventCoverImageUrl = firstDetails.eventCoverImageUrl || "";
    const eventCoverImageThumbnailUrl = firstDetails.eventCoverImageThumbnailUrl || "";

    setEditEventGroup({
      key: group.key,
      eventName: firstDetails.eventName || group.name || "",
      coverImageUrl: eventCoverImageUrl,
      coverImageThumbnailUrl: eventCoverImageThumbnailUrl,
      publicInfo: firstDetails.publicInfo || buildTournamentPublicInfo(),
      categories: (groupItems.length ? groupItems : group.items).map((tournament) => {
        const details = tournament.data || {};
        const genderFields = getEditableTournamentGenderFields(details, tournament.type);
        const usesEventCover = details.usesEventCover === true
          || (!details.usesEventCover && Boolean(eventCoverImageUrl) && details.coverImageUrl === eventCoverImageUrl);
        return {
          key: tournament.id,
          id: tournament.id,
          original: tournament,
          name: tournament.name || details.category || details.gender || "",
          participantGenderMode: genderFields.participantGenderMode,
          genderOther: genderFields.genderOther,
          type: tournament.type || "",
          eventDate: details.eventDate || "",
          eventEndDate: details.eventEndDate || details.eventDate || "",
          registrationDeadline: details.registrationDeadline || "",
          eventStartTime: details.eventStartTime || "",
          location: details.location || "",
          winningScore: Number(details.winningScore || 4),
          rankingCriteria: details.rankingCriteria || defaultRankingCriteria,
          coverImageUrl: usesEventCover ? "" : (details.coverImageUrl || ""),
          coverImageThumbnailUrl: usesEventCover ? "" : (details.coverImageThumbnailUrl || ""),
          usesEventCover,
          removed: false,
          hasGeneratedGames: Boolean(details.schedule?.length || details.brackets?.length),
        };
      }),
    });
  }

  function updateEventGroupField(field, value) {
    setEditEventGroup((current) => ({ ...current, [field]: value }));
  }

  function updateEventGroupCategory(key, field, value) {
    setEditEventGroup((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.key === key
          ? {
            ...category,
            [field]: value,
            ...(field === "participantGenderMode"
              ? { type: getCompatibleTournamentType(category.type, value, allowedTypes) }
              : {}),
          }
          : category
      )),
    }));
  }

  function addEventGroupCategory() {
    setEditEventGroup((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          key: `new-${generatePublicId()}`,
          id: null,
          original: null,
          name: "",
          participantGenderMode: "",
          genderOther: "",
          type: "",
          eventDate: "",
          eventEndDate: "",
          registrationDeadline: "",
          eventStartTime: "",
          location: "",
          winningScore: 4,
          rankingCriteria: "",
          coverImageUrl: "",
          coverImageThumbnailUrl: "",
          usesEventCover: true,
          removed: false,
          hasGeneratedGames: false,
        },
      ],
    }));
  }

  function toggleEventGroupCategoryRemoved(key) {
    setEditEventGroup((current) => {
      const category = current.categories.find((item) => item.key === key);
      if (!category) return current;
      if (!category.removed && current.categories.filter((item) => !item.removed).length <= 1) {
        showNotice("warning", "Uma categoria é obrigatória", "O evento precisa permanecer com pelo menos uma categoria.");
        return current;
      }
      if (!category.id) {
        return { ...current, categories: current.categories.filter((item) => item.key !== key) };
      }
      return {
        ...current,
        categories: current.categories.map((item) => (
          item.key === key ? { ...item, removed: !item.removed } : item
        )),
      };
    });
  }

  async function saveEditedEventGroup({ confirmModalityChanges = false } = {}) {
    if (!editEventGroup || editEventGroupSaving) return;
    if (!ensureCloudConnection("salvar o evento completo")) return;

    const activeCategories = editEventGroup.categories.filter((category) => !category.removed);
    if (!editEventGroup.eventName.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite o nome geral do evento.");
      return;
    }

    const invalidCategory = activeCategories.find((category) => (
      !category.name.trim()
      || (!allowedTypes.includes(category.type) && category.original?.type !== category.type)
      || !getEffectiveTournamentGenderMode(category.type, category.participantGenderMode)
      || Boolean(
        getEffectiveTournamentGenderMode(category.type, category.participantGenderMode) === tournamentGenderModes.other
        && !category.genderOther?.trim()
      )
      || !category.eventDate
      || !rankingCriteriaOptions.some((option) => option.value === category.rankingCriteria)
      || ![4, 6].includes(Number(category.winningScore))
      || Boolean(category.eventEndDate && category.eventEndDate < category.eventDate)
      || Boolean(category.registrationDeadline && category.registrationDeadline > category.eventDate)
    ));

    if (invalidCategory) {
      showNotice(
        "warning",
        "Categoria incompleta",
        `Revise nome, gênero, modalidade, data, games e critério de ${invalidCategory.name || "uma categoria"}.`
      );
      return;
    }

    const changedModalities = activeCategories.filter((category) => (
      category.id && category.original?.type !== category.type
    ));
    if (changedModalities.length > 0 && !confirmModalityChanges) {
      setEventGroupModalityConfirmation({ count: changedModalities.length });
      return;
    }

    setEditEventGroupSaving(true);
    const startDates = activeCategories.map((category) => category.eventDate).sort();
    const endDates = activeCategories.map((category) => category.eventEndDate || category.eventDate).sort();
    const groupStartDate = startDates[0];
    const groupEndDate = endDates[endDates.length - 1];
    const savedRows = [];

    for (const category of activeCategories.filter((item) => item.id)) {
      const original = category.original;
      const modalityChanged = original.type !== category.type;
      const structuralData = modalityChanged
        ? createInitialData(category.type, modalityConfig[category.type])
        : (original.data || {});
      const updatedData = {
        ...structuralData,
        publicInfo: original.data?.publicInfo || structuralData.publicInfo,
        eventName: editEventGroup.eventName.trim(),
        eventGroupKey: editEventGroup.key,
        multiCategoryEvent: true,
        eventGroupStartDate: groupStartDate,
        eventGroupEndDate: groupEndDate,
        eventPeriodLabel: groupEndDate !== groupStartDate
          ? `${formatDateBR(groupStartDate)} até ${formatDateBR(groupEndDate)}`
          : formatDateBR(groupStartDate),
        eventCoverImageUrl: editEventGroup.coverImageUrl || "",
        eventCoverImageThumbnailUrl: editEventGroup.coverImageThumbnailUrl || "",
        usesEventCover: category.usesEventCover,
        category: category.name.trim(),
        ...getStoredTournamentGenderFields(category.type, category.participantGenderMode, category.genderOther),
        eventDate: category.eventDate,
        eventStartDate: category.eventDate,
        eventEndDate: category.eventEndDate || category.eventDate,
        eventDay: getWeekdayBR(category.eventDate),
        registrationDeadline: category.registrationDeadline,
        eventStartTime: category.eventStartTime,
        location: category.location.trim(),
        winningScore: Number(category.winningScore) || 4,
        rankingCriteria: category.rankingCriteria,
        coverImageUrl: category.usesEventCover ? (editEventGroup.coverImageUrl || "") : category.coverImageUrl,
        coverImageThumbnailUrl: category.usesEventCover
          ? (editEventGroup.coverImageThumbnailUrl || "")
          : (category.coverImageThumbnailUrl || ""),
      };
      const result = await persistTournamentSnapshot({
        ...original,
        name: category.name.trim(),
        type: category.type,
        data: updatedData,
        scoreSafetyBaseData: original.data,
        allowScoreRegression: modalityChanged,
      }, {
        expectedUpdatedAt: original.updated_at || null,
        expectedRevision: getCollaborationRevision(original),
      });

      if (!result.ok) {
        setEditEventGroupSaving(false);
        await loadTournaments({ silentError: true });
        showNotice("error", "Evento não concluído", "Uma categoria foi alterada em outro dispositivo ou não pôde ser salva. Revise o conjunto e tente novamente.");
        return;
      }
      savedRows.push(result.tournament);
    }

    const newCategories = activeCategories.filter((item) => !item.id);
    if (newCategories.length > 0) {
      const rows = newCategories.map((category) => ({
        user_id: user.id,
        public_id: generatePublicId(),
        is_public: true,
        name: category.name.trim(),
        type: category.type,
        data: {
          ...createInitialData(category.type, modalityConfig[category.type]),
          eventName: editEventGroup.eventName.trim(),
          eventGroupKey: editEventGroup.key,
          multiCategoryEvent: true,
          eventGroupStartDate: groupStartDate,
          eventGroupEndDate: groupEndDate,
          eventPeriodLabel: groupEndDate !== groupStartDate
            ? `${formatDateBR(groupStartDate)} até ${formatDateBR(groupEndDate)}`
            : formatDateBR(groupStartDate),
          eventCoverImageUrl: editEventGroup.coverImageUrl || "",
          eventCoverImageThumbnailUrl: editEventGroup.coverImageThumbnailUrl || "",
          usesEventCover: category.usesEventCover,
          publicInfo: editEventGroup.publicInfo,
          publishedOnProfile: true,
          publishedAt: new Date().toISOString(),
          category: category.name.trim(),
          ...getStoredTournamentGenderFields(category.type, category.participantGenderMode, category.genderOther),
          eventDate: category.eventDate,
          eventStartDate: category.eventDate,
          eventEndDate: category.eventEndDate || category.eventDate,
          eventDay: getWeekdayBR(category.eventDate),
          registrationDeadline: category.registrationDeadline,
          eventStartTime: category.eventStartTime,
          location: category.location.trim(),
          winningScore: Number(category.winningScore) || 4,
          rankingCriteria: category.rankingCriteria,
          coverImageUrl: category.usesEventCover ? (editEventGroup.coverImageUrl || "") : category.coverImageUrl,
          coverImageThumbnailUrl: category.usesEventCover
            ? (editEventGroup.coverImageThumbnailUrl || "")
            : (category.coverImageThumbnailUrl || ""),
        },
        status: "active",
      }));
      const { data: insertedRows, error } = await supabase.from("tournaments").insert(rows).select("*");
      if (error) {
        setEditEventGroupSaving(false);
        await loadTournaments({ silentError: true });
        showNotice("error", "Categoria não adicionada", "As alterações existentes foram preservadas, mas não foi possível adicionar a nova categoria.");
        return;
      }
      savedRows.push(...(insertedRows || []));
    }

    for (const category of editEventGroup.categories.filter((item) => item.id && item.removed)) {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("tournaments")
        .update({
          is_public: false,
          data: { ...(category.original.data || {}), deletedAt },
          updated_at: deletedAt,
        })
        .eq("id", category.id)
        .eq("user_id", user.id);
      if (error) console.error("Erro ao mover categoria removida para a lixeira:", error);
    }

    const refreshedTournaments = await loadTournaments({ silentError: true }) || tournamentsRef.current;
    const criteriaCircuits = await syncAutomaticCircuitCriteria(refreshedTournaments, circuitsRef.current);
    const { circuits: rankedCircuits } = await persistCircuitRankings(
      refreshedTournaments,
      criteriaCircuits || circuitsRef.current
    );
    await syncPublicArenaDirectory(refreshedTournaments, rankedCircuits);
    setEditEventGroupSaving(false);
    setEditEventGroup(null);
    setEventGroupModalityConfirmation(null);
    showNotice("success", "Evento atualizado", "Os dados gerais e as categorias foram salvos em conjunto.");
  }

  function getEventDateRange() {
    if (!newDate) return [];

    const endDate = newEndDate || newDate;
    if (endDate < newDate) return [];

    const dates = [];
    const current = new Date(`${newDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  const eventDateRange = getEventDateRange();
  const isMultiDayEvent = eventDateRange.length > 1;

  function updateDailyStartTime(date, time) {
    setNewDailyStartTimes((prev) => ({ ...prev, [date]: time }));
  }

  function updateCategorySchedule(index, field, value) {
    setNewCategorySchedules((prev) =>
      prev.map((item, itemIndex) => itemIndex === index
        ? {
          ...item,
          [field]: value,
          ...(field === "participantGenderMode"
            ? { type: getCompatibleTournamentType(item.type, value, allowedTypes) }
            : {}),
        }
        : item)
    );
  }

  function addCategorySchedule() {
    setNewCategorySchedules((prev) => [...prev, {
      category: "",
      participantGenderMode: "",
      genderOther: "",
      date: "",
      endDate: "",
      registrationDeadline: "",
      time: "",
      type: "",
      location: "",
      winningScore: "4",
      rankingCriteria: "",
      coverImageUrl: "",
      coverImageThumbnailUrl: "",
    }]);
  }

  function removeCategorySchedule(index) {
    setNewCategorySchedules((prev) => prev.length <= 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function duplicateCategorySchedule(index) {
    setNewCategorySchedules((prev) => {
      const source = prev[index] || {};
      const copy = { ...source, category: "" };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  async function moveTournamentByDrag(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    if (!ensureCloudConnection("alterar a ordem dos torneios")) return;

    const previousTournaments = tournaments;
    const list = [...previousTournaments];
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    setTournaments(list);

    const savedOrder = await persistTournamentOrderSequence(list, { manual: true });
    const { error } = savedOrder;

    if (error) {
      console.error("Erro ao salvar a ordem dos torneios:", error);
      setTournaments(previousTournaments);
      showNotice("error", "Ordem não salva", "Não foi possível manter a nova posição dos torneios.");
      return;
    }

    setTournaments(savedOrder.tournaments);

    showNotice("success", "Ordem atualizada", "A posição dos torneios será mantida ao atualizar a página.");
  }
  function closeSelectedTournament() {
    captureCurrentTournamentNavigation();
    tournamentNavigationGuardRef.current = null;
    updateAppUrl({ activePanel: "criar", selectedTournamentId: null });
    saveUserAppState({ activePanel: "criar", selectedTournamentId: null });
    setSelected(null);
  }

  function rememberTournamentNavigation({ tournamentId, tournamentTab, matchesTab }) {
    persistTournamentNavigation(tournamentId, {
      tournamentTab: tournamentTab || "participantes",
      matchesTab: matchesTab || "grupos",
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
    });
    saveUserAppState({
      activePanel: "criar",
      selectedTournamentId: tournamentId,
      tournamentTab,
      matchesTab,
    });
  }

  function renderAppSidebar() {
    const navItems = [
      { panel: "inicio", label: "Início", Icon: LayoutDashboard },
      { panel: "explorar", label: "Explorar", Icon: Compass },
      { panel: "criar", label: "Criar", Icon: PlusCircle },
      { panel: "ajustes", label: "Perfil da organização", Icon: UserRound },
    ];
    const sidebarActivePanel = ["criar", "circuitos", "modalidades"].includes(activePanel)
      ? "criar"
      : activePanel;

    return (
      <PlatformSidebar
        activePanel={sidebarActivePanel}
        expanded={sidebarExpanded}
        items={navItems}
        onNavigate={goToPanel}
        onExpandedChange={setSidebarExpanded}
      />
    );
  }

  function renderCreationNavigation() {
    if (!["criar", "circuitos", "modalidades"].includes(activePanel)) return null;
    return (
      <nav className="creationContextNavigation" aria-label="Conteúdo da organização">
        <div>
          <span>Identidade de organização</span>
          <strong>O que você quer administrar?</strong>
        </div>
        <div role="tablist" aria-label="Tipos de conteúdo">
          <button type="button" role="tab" aria-selected={activePanel === "criar"} className={activePanel === "criar" ? "active" : ""} onClick={() => goToPanel("criar")}><Trophy aria-hidden="true" /> Torneios</button>
          <button type="button" role="tab" aria-selected={activePanel === "circuitos"} className={activePanel === "circuitos" ? "active" : ""} onClick={() => goToPanel("circuitos")}><GitBranch aria-hidden="true" /> Circuitos</button>
          <button type="button" role="tab" aria-selected={activePanel === "modalidades"} className={activePanel === "modalidades" ? "active" : ""} onClick={() => goToPanel("modalidades")}><Shapes aria-hidden="true" /> Modalidades</button>
        </div>
      </nav>
    );
  }

  async function logoutSafely() {
    if (!await guardSelectedTournamentBeforeLeaving()) return;

    if (listLocalTournamentDrafts(user.id).length > 0) {
      if (isBrowserOffline()) {
        showNotice(
          "warning",
          "Sincronize antes de sair",
          "Há alterações protegidas somente neste aparelho. Reconecte-se para enviá-las à nuvem antes de encerrar a sessão."
        );
        return;
      }

      await syncPendingTournamentDrafts(tournamentsRef.current);
      if (listLocalTournamentDrafts(user.id).length > 0) {
        showNotice(
          "warning",
          "Alterações ainda pendentes",
          "Alguns dados precisam ser revisados ou sincronizados. Abra o torneio indicado antes de sair."
        );
        return;
      }
    }

    await logout();
  }

  function renderAppTopbar() {
    const syncStatus = !networkOnline
      ? {
          className: "offline",
          label: pendingSyncCount > 0 ? `${pendingSyncCount} pendente(s) no aparelho` : "Modo offline",
          Icon: CloudOff,
        }
      : pendingSyncCount > 0
        ? { className: "pending", label: "Sincronizando dados", Icon: RefreshCw }
        : { className: "synced", label: "Dados sincronizados", Icon: CloudCheck };
    const SyncStatusIcon = syncStatus.Icon;

    const actions = (
      <>
          <div
            className={`cloudSyncStatus ${syncStatus.className}`}
            role="status"
            aria-live="polite"
            title={syncStatus.label}
          >
            <SyncStatusIcon aria-hidden="true" />
            <span>{syncStatus.label}</span>
          </div>
          <button
            type="button"
            className="themeToggleButton"
            onClick={toggleColorMode}
            aria-label={colorMode === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
            aria-pressed={colorMode === "dark"}
            title={colorMode === "dark" ? "Modo claro" : "Modo noturno"}
          >
            {colorMode === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span>{colorMode === "dark" ? "Modo claro" : "Modo noturno"}</span>
          </button>

          <div className="profileMenuWrap" ref={profileMenuRef}>
            <div className={`profileControl ${activePanel === "ajustes" || activePanel === "lixeira" ? "accountAreaActive" : ""}`}>
              <button type="button" className="profileTrigger" onClick={openProfileSettings} title="Abrir perfil da organização">
                <span className="profileAvatar" aria-hidden="true">
                  {memberProfile.photoUrl ? <img src={memberProfile.photoUrl} alt="" /> : <span>{profileInitials}</span>}
                </span>
                <span className="profileTriggerCopy">
                  <strong>{organizerProfile.arenaName || profileDisplayName}</strong>
                  <small>Abrir perfil da organização</small>
                </span>
              </button>
              <button
                type="button"
                className="profileMenuToggle"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label="Abrir menu da conta"
                aria-expanded={profileMenuOpen}
              >
                <ChevronDown aria-hidden="true" />
              </button>
            </div>

            {profileMenuOpen ? (
              <div className="profileDropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "ajustes" && profileSubtab !== "conta" ? "profileDropdownCurrent" : ""}`}
                  onClick={openProfileSettings}
                  aria-current={activePanel === "ajustes" && profileSubtab !== "conta" ? "page" : undefined}
                >
                  <Settings aria-hidden="true" />
                  <span><strong>Perfil da organização</strong><small>Identidade pública e publicações</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "ajustes" && profileSubtab === "conta" ? "profileDropdownCurrent" : ""}`}
                  onClick={() => openProfileSection("conta")}
                  aria-current={activePanel === "ajustes" && profileSubtab === "conta" ? "page" : undefined}
                >
                  <LifeBuoy aria-hidden="true" />
                  <span><strong>Ajuda e suporte</strong><small>WhatsApp, Instagram e e-mail</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "lixeira" ? "profileDropdownCurrent" : ""}`}
                  onClick={() => { setProfileMenuOpen(false); goToPanel("lixeira"); }}
                  aria-current={activePanel === "lixeira" ? "page" : undefined}
                >
                  <Trash2 aria-hidden="true" />
                  <span><strong>Lixeira</strong><small>Itens excluídos recentemente</small></span>
                </button>
                <div className="profileDropdownDivider" />
                <button type="button" role="menuitem" className="profileDropdownItem profileDropdownLogout" onClick={logoutSafely}>
                  <LogOut aria-hidden="true" />
                  <span><strong>Sair</strong><small>Encerrar esta sessão</small></span>
                </button>
              </div>
            ) : null}
          </div>
      </>
    );

    return (
      <PlatformTopbar
        sidebarExpanded={sidebarExpanded}
        onSidebarExpandedChange={setSidebarExpanded}
        tagline={TORNEIO360_TAGLINE}
        actions={actions}
      />
    );
  }

  function renderDataSafetyBanner() {
    if (networkOnline && !dashboardUsingOfflineCache && pendingSyncCount === 0) return null;

    return (
      <aside className={`dataSafetyBanner ${networkOnline ? "pending" : "offline"}`} role="status" aria-live="polite">
        {networkOnline ? <RefreshCw aria-hidden="true" /> : <CloudOff aria-hidden="true" />}
        <div>
          <strong>{networkOnline ? "Sincronização em andamento" : "Você está sem internet"}</strong>
          <span>
            {networkOnline
              ? "As alterações guardadas neste aparelho estão sendo conferidas com a nuvem."
              : "Você pode continuar no torneio aberto. Nomes, sorteios, rodadas e placares ficam protegidos neste aparelho e serão enviados quando a conexão voltar."}
          </span>
        </div>
      </aside>
    );
  }

  const workspaceOpenTournaments = openTournamentIds
    .map((id) => tournaments.find((tournament) => tournament.id === id))
    .filter(Boolean);
  const workspaceCourtUsages = workspaceOpenTournaments.flatMap((tournament) => {
    const storedUsages = getTournamentActiveCourtUsages(tournament, tournament.data || {});
    const currentUsages = liveCourtUsagesByTournament[tournament.id] || storedUsages;
    return currentUsages.map((usage) => ({
      ...usage,
      venueKey: getTournamentVenueKey(tournament),
      venueLabel: getTournamentVenueLabel(tournament),
    }));
  });
  const activeVenueKey = selected ? getTournamentVenueKey(selected) : workspaceOpenTournaments[0]
    ? getTournamentVenueKey(workspaceOpenTournaments[0])
    : null;
  const activeCourtCenter = activeVenueKey
    ? normalizeCourtCenterEntry(courtCenters[activeVenueKey], selected ? getTournamentVenueLabel(selected) : "Local não informado")
    : normalizeCourtCenterEntry(null);
  const activeTournamentPreferredCourtNumbers = selected
    ? activeCourtCenter.tournamentPreferences?.[selected.id] || []
    : [];
  const activeVenueUsages = activeVenueKey
    ? workspaceCourtUsages.filter((usage) => usage.venueKey === activeVenueKey)
    : [];
  const activeOccupiedCourtNumbers = new Set(activeVenueUsages.map((usage) => normalizeCourtNumberValue(usage.courtNumber)));
  const activeUnavailableCourtNumbers = new Set(activeCourtCenter.unavailableNumbers);
  const activeCourtCenterSummary = {
    occupied: activeOccupiedCourtNumbers.size,
    free: activeCourtCenter.numbers.filter((number) => (
      !activeOccupiedCourtNumbers.has(number) && !activeUnavailableCourtNumbers.has(number)
    )).length,
  };

  function updateCourtCenter(venueKey, nextEntry) {
    setCourtCenters((currentCenters) => ({
      ...currentCenters,
      [venueKey]: normalizeCourtCenterEntry(nextEntry),
    }));
  }

  function registerActiveCourtNumber(number) {
    const nextNumber = normalizeCourtNumberValue(number);
    if (!activeVenueKey || !nextNumber) return false;

    setCourtCenters((currentCenters) => {
      const currentCenter = normalizeCourtCenterEntry(
        currentCenters[activeVenueKey],
        selected ? getTournamentVenueLabel(selected) : "Local não informado"
      );
      if (currentCenter.numbers.includes(nextNumber)) return currentCenters;

      return {
        ...currentCenters,
        [activeVenueKey]: normalizeCourtCenterEntry({
          ...currentCenter,
          numbers: [...currentCenter.numbers, nextNumber],
          configured: true,
        }),
      };
    });
    return true;
  }

  function updateLiveCourtUsages(tournamentId, nextUsages) {
    setLiveCourtUsagesByTournament((current) => {
      if (!Array.isArray(nextUsages)) {
        const next = { ...current };
        delete next[tournamentId];
        return next;
      }

      return {
        ...current,
        [tournamentId]: nextUsages,
      };
    });
  }

  if (selected) {
    return (
      <div className={`playAppShell proDashboard theme-${colorMode}`}>
        <NoticeModal notice={notice} onClose={() => setNotice(null)} />
        {circuitTournamentTarget ? (
          <TournamentCircuitManagerModal
            key={circuitTournamentTarget.id}
            tournament={circuitTournamentTarget}
            compatibleCircuits={getCompatibleCircuitsForTournament(circuitTournamentTarget)}
            currentCircuitIds={getTournamentCircuitMembership(circuitTournamentTarget).map((circuit) => circuit.id)}
            onClose={() => setCircuitTournamentTarget(null)}
            onSave={(selectedCircuitIds) => saveTournamentCircuitMembership(circuitTournamentTarget, selectedCircuitIds)}
            onCreate={() => createCircuitFromTournament(circuitTournamentTarget)}
          />
        ) : null}
        {courtCenterOpen ? (
          <CourtCenterModal
            openTournaments={workspaceOpenTournaments}
            activeTournamentId={selected.id}
            centers={courtCenters}
            usages={workspaceCourtUsages}
            onChange={updateCourtCenter}
            onClose={() => setCourtCenterOpen(false)}
          />
        ) : null}
        {renderAppSidebar()}
        <div className="playMain">
          {renderAppTopbar()}
          {renderDataSafetyBanner()}
          <TournamentWorkspaceTabs
            tournaments={tournaments}
            openTournamentIds={openTournamentIds}
            activeTournamentId={selected.id}
            onSelectTournament={openTournament}
            onCloseTournament={closeOpenTournament}
            onOpenCourtCenter={() => setCourtCenterOpen(true)}
            courtCenterSummary={activeCourtCenterSummary}
          />
          <main className="playContent tournamentWorkspaceContent">
            <TournamentErrorBoundary tournamentId={selected.id} onBack={closeSelectedTournament}>
              <TournamentScreen
                key={selected.id}
                tournament={selected}
                openTournaments={openTournamentIds.map((id) => tournaments.find((item) => item.id === id)).filter(Boolean)}
                userId={user.id}
                onBack={closeSelectedTournament}
                onSave={saveTournament}
                onNavigationStateChange={rememberTournamentNavigation}
                onRegisterNavigationGuard={registerTournamentNavigationGuard}
                onManageCircuits={() => setCircuitTournamentTarget(selected)}
                circuitMembershipCount={getTournamentCircuitMembership(selected).length}
                arenaGenderRegistry={getArenaParticipantGenderRegistry()}
                centralCourtNumbers={activeCourtCenter.numbers}
                centralUnavailableCourtNumbers={activeCourtCenter.unavailableNumbers}
                venueCourtUsages={activeVenueUsages}
                preferredCourtNumbers={activeTournamentPreferredCourtNumbers}
                onOpenCourtCenter={() => setCourtCenterOpen(true)}
                onRegisterCentralCourtNumber={registerActiveCourtNumber}
                onCourtUsagesChange={updateLiveCourtUsages}
              />
            </TournamentErrorBoundary>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={`playAppShell proDashboard theme-${colorMode}`}>
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <MemberProfileDetailsModal
        open={memberProfileEditorOpen}
        profile={memberProfile}
        errors={memberProfileErrors}
        loading={memberProfileStatus === "loading"}
        saving={memberProfileSaving}
        schemaAvailable={memberProfileStatus !== "unavailable"}
        profileKind="organization"
        onChange={updateMemberProfile}
        onClose={() => { if (!memberProfileSaving) setMemberProfileEditorOpen(false); }}
        onSave={saveMemberProfileAndClose}
      />

      {memberProfileImageEditor ? (
        <ProfileImageEditor
          kind={memberProfileImageEditor.kind}
          sourceUrl={memberProfileImageEditor.sourceUrl}
          fileName={memberProfileImageEditor.fileName}
          onCancel={closeMemberProfileImageEditor}
          onApply={applyMemberProfileImage}
        />
      ) : null}

      <ConfirmModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTournament}
      />

      <ConfirmCircuitDeleteModal
        target={circuitDeleteTarget}
        onCancel={() => setCircuitDeleteTarget(null)}
        onConfirm={deleteCircuit}
      />

      <ConfirmTrashPermanentDeleteModal
        action={trashPermanentAction}
        busy={trashActionBusy}
        onCancel={() => { if (!trashActionBusy) setTrashPermanentAction(null); }}
        onConfirm={() => void confirmPermanentTrashDeletion()}
      />

      <ConfirmModalityChangeModal
        confirmation={modalityChangeConfirmation}
        busy={editTournamentSaving}
        onCancel={() => { if (!editTournamentSaving) setModalityChangeConfirmation(null); }}
        onConfirm={() => void saveEditedTournament({ confirmModalityChange: true })}
      />

      <ConfirmEventGroupModalityChangeModal
        confirmation={eventGroupModalityConfirmation}
        onCancel={() => setEventGroupModalityConfirmation(null)}
        onConfirm={() => void saveEditedEventGroup({ confirmModalityChanges: true })}
      />

      {editTarget && editForm && !modalityChangeConfirmation ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true">
          <div className="editTournamentModal" aria-busy={editTournamentSaving}>
            <div className="editTournamentHeader">
              <div>
                <h2>Editar torneio</h2>
                <p>Atualize as informações principais deste torneio.</p>
              </div>
              <button type="button" className="secondaryBtn" disabled={editTournamentSaving} onClick={() => { setEditTarget(null); setEditForm(null); }}>Fechar</button>
            </div>

            <div className="editTournamentGrid">
              <div className="formField">
                <label>Nome do evento/torneio</label>
                <input value={editForm.name} onChange={(e) => updateEditForm("name", e.target.value)} />
              </div>

              <div className="formField">
                <label>Categoria</label>
                <input value={editForm.category} onChange={(e) => updateEditForm("category", e.target.value)} placeholder="Ex: Iniciante, Open ou Sub-18" />
              </div>

              <div className="formField">
                <label>Modalidade</label>
                <ModalityPicker value={editForm.type} options={getGenderCompatibleTournamentTypes(allowedTypes, editForm.participantGenderMode)} onChange={(type) => updateEditForm("type", type)} legacyLabel="Modalidade legada preservada neste torneio." />
              </div>

              <div className="formField fullField tournamentGenderField">
                <label>Gênero</label>
                <TournamentGenderSelector
                  type={editForm.type}
                  value={editForm.participantGenderMode}
                  customValue={editForm.genderOther}
                  onChange={(value) => updateEditForm("participantGenderMode", value)}
                  onCustomChange={(value) => updateEditForm("genderOther", value)}
                />
              </div>

              <div className="formField">
                <label>Local</label>
                <input value={editForm.location} onChange={(e) => updateEditForm("location", e.target.value)} />
              </div>

              <div className="formField fullField tournamentCoverField">
                <div className="tournamentCoverIntro">
                  <div>
                    <strong><Camera aria-hidden="true" /> Foto do torneio</strong>
                    <span>Padrão Stories: 1080 × 1920 px (9:16). Escolha qualquer foto e ajuste o enquadramento na tela seguinte.</span>
                  </div>
                  {editForm.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => setEditForm((prev) => ({ ...prev, coverImageUrl: "", coverImageThumbnailUrl: "" }))}>Remover foto</button> : null}
                </div>
                <label className={`tournamentCoverDropzone ${editForm.coverImageUrl ? "hasImage" : ""}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setEditForm((prev) => ({
                        ...prev,
                        coverImageUrl: imageUrl,
                        coverImageThumbnailUrl: thumbnailUrl,
                      })));
                    }}
                  />
                  {editForm.coverImageUrl ? <img src={editForm.coverImageUrl} alt="Prévia da foto do torneio" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do evento"}</span>}
                </label>
              </div>

              <div className="formField">
                <label>Início</label>
                <input className="clickableDateInput" type="date" required value={editForm.eventDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("eventDate", e.target.value)} />
              </div>

              {!editTarget.data?.multiCategoryEvent && (
              <div className="formField">
                <label>Fim</label>
                <input className="clickableDateInput" type="date" required value={editForm.eventEndDate} min={editForm.eventDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("eventEndDate", e.target.value)} />
              </div>
              )}

              <div className="formField">
                <label>Encerramento das inscrições</label>
                <input className="clickableDateInput" type="date" value={editForm.registrationDeadline} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("registrationDeadline", e.target.value)} />
              </div>

              <section className="partnerFinderConfig fullField">
                <div>
                  <span><Users aria-hidden="true" /></span>
                  <div><strong>Encontre sua dupla</strong><small>Aceitar atletas sem parceiro e destacar quem está procurando dupla.</small></div>
                </div>
                <label className="partnerFinderConfigToggle">
                  <input type="checkbox" checked={editForm.partnerFinderEnabled !== false} onChange={(event) => updateEditForm("partnerFinderEnabled", event.target.checked)} />
                  <span>{editForm.partnerFinderEnabled !== false ? "Ativado" : "Desativado"}</span>
                </label>
                {editForm.partnerFinderEnabled !== false ? (
                  <label className="partnerFinderConfigDeadline">
                    <span>Prazo para formar a dupla</span>
                    <input className="clickableDateInput" type="date" value={editForm.partnerFinderDeadline || ""} max={editForm.eventDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEditForm("partnerFinderDeadline", event.target.value)} />
                  </label>
                ) : null}
              </section>

              <section className="tournamentRegulationsConfig fullField">
                <header><ClipboardPaste aria-hidden="true" /><div><strong>Regulamento do torneio</strong><small>Escreva as regras e/ou informe um link público para o PDF.</small></div></header>
                <label>
                  <span>Texto do regulamento</span>
                  <textarea rows={5} maxLength={5000} value={editForm.regulationsText || ""} onChange={(event) => updateEditForm("regulationsText", event.target.value)} placeholder="Categorias, formato, critérios, conduta, premiação e demais regras." />
                </label>
                <label>
                  <span>Link público do PDF</span>
                  <input type="url" value={editForm.regulationsPdfUrl || ""} onChange={(event) => updateEditForm("regulationsPdfUrl", event.target.value)} placeholder="https://.../regulamento.pdf" />
                </label>
              </section>

              <div className="formField">
                <label>Horário de início</label>
                <input type="time" value={editForm.eventStartTime} onChange={(e) => updateEditForm("eventStartTime", e.target.value)} />
              </div>

              <div className="formField">
                <label>Set para vencer</label>
                <select value={editForm.winningScore} onChange={(e) => updateEditForm("winningScore", Number(e.target.value))}>
                  <option value={4}>4 games</option>
                  <option value={6}>6 games</option>
                </select>
              </div>

              <div className="formField fullField">
                <label>Critério do ranking</label>
                {modalityConfig[editForm.type]?.type === "playranking" ? (
                  <select value="playranking_group_rule" disabled aria-label="Critério automático do Modelo Torneio 360">
                    <option value="playranking_group_rule">{getAutomaticCupRankingLabel(editForm.type)}</option>
                  </select>
                ) : (
                  <select value={editForm.rankingCriteria} onChange={(e) => updateEditForm("rankingCriteria", e.target.value)}>
                    {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="editTournamentActions">
              <button type="button" className="cancelBtn" disabled={editTournamentSaving} onClick={() => { setEditTarget(null); setEditForm(null); }}>Cancelar</button>
              <button type="button" className="actionConfirmBtn" disabled={editTournamentSaving || coverImageLoading} aria-busy={editTournamentSaving || coverImageLoading} onClick={() => void saveEditedTournament()}>
                {coverImageLoading ? "Preparando foto..." : editTournamentSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editEventGroup && !eventGroupModalityConfirmation ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true" aria-labelledby="edit-event-group-title">
          <div className="editTournamentModal editEventGroupModal">
            <div className="editTournamentHeader">
              <div>
                <span className="modalEyebrow">Evento com várias categorias</span>
                <h2 id="edit-event-group-title">Editar evento completo</h2>
                <p>Altere os dados gerais e todas as categorias sem abrir cada torneio separadamente.</p>
              </div>
              <button type="button" className="secondaryBtn" onClick={() => setEditEventGroup(null)} disabled={editEventGroupSaving}>Fechar</button>
            </div>

            <section className="eventGroupGeneralFields">
              <div className="formField">
                <label>Nome geral do evento</label>
                <input value={editEventGroup.eventName} onChange={(event) => updateEventGroupField("eventName", event.target.value)} />
              </div>

              <div className="formField tournamentCoverField">
                <div className="tournamentCoverIntro">
                  <div>
                    <strong><Camera aria-hidden="true" /> Foto geral do evento</strong>
                    <span>Padrão Stories: 1080 × 1920 px (9:16). As categorias configuradas para usar esta foto serão atualizadas juntas.</span>
                  </div>
                  {editEventGroup.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => setEditEventGroup((prev) => ({ ...prev, coverImageUrl: "", coverImageThumbnailUrl: "" }))}>Remover foto</button> : null}
                </div>
                <label className={`tournamentCoverDropzone ${editEventGroup.coverImageUrl ? "hasImage" : ""}`}>
                  <input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setEditEventGroup((prev) => ({
                      ...prev,
                      coverImageUrl: imageUrl,
                      coverImageThumbnailUrl: thumbnailUrl,
                    })));
                  }} />
                  {editEventGroup.coverImageUrl
                    ? <img src={editEventGroup.coverImageUrl} alt="Prévia da foto geral do evento" />
                    : <span><Camera aria-hidden="true" /> Escolher foto geral</span>}
                </label>
              </div>
            </section>

            <div className="eventGroupEditIntro">
              <div>
                <strong>Categorias do evento</strong>
                <span>Modalidade, local, datas, games e critério são definidos em cada categoria.</span>
              </div>
              <button type="button" className="secondaryBtn" onClick={addEventGroupCategory}>+ Adicionar categoria</button>
            </div>

            <div className="eventGroupCategoryEditorList">
              {editEventGroup.categories.map((category, index) => (
                <section className={`eventGroupCategoryEditor ${category.removed ? "removed" : ""}`} key={category.key}>
                  <header>
                    <div>
                      <span>Categoria {index + 1}</span>
                      <strong>{category.name || "Nova categoria"}</strong>
                    </div>
                    <button
                      type="button"
                      className={category.removed ? "secondaryBtn" : "deleteBtn"}
                      onClick={() => toggleEventGroupCategoryRemoved(category.key)}
                    >
                      {category.removed ? "Restaurar" : category.id ? "Mover para lixeira" : "Remover"}
                    </button>
                  </header>

                  {category.removed ? (
                    <p className="eventGroupRemovalNotice">Esta categoria será movida para a lixeira quando as alterações forem salvas.</p>
                  ) : (
                    <div className="editTournamentGrid eventGroupCategoryFields">
                      <div className="formField">
                        <label>Categoria</label>
                        <input value={category.name} onChange={(event) => updateEventGroupCategory(category.key, "name", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Modalidade</label>
                        <ModalityPicker value={category.type} options={getGenderCompatibleTournamentTypes(allowedTypes, category.participantGenderMode)} onChange={(type) => updateEventGroupCategory(category.key, "type", type)} legacyLabel="Modalidade legada preservada nesta categoria." />
                        {category.hasGeneratedGames ? <small>Ao trocar a modalidade, a confirmação explicará quais dados esportivos serão reiniciados.</small> : null}
                      </div>
                      <div className="formField fullField tournamentGenderField">
                        <label>Gênero</label>
                        <TournamentGenderSelector
                          compact
                          type={category.type}
                          value={category.participantGenderMode}
                          customValue={category.genderOther}
                          onChange={(value) => updateEventGroupCategory(category.key, "participantGenderMode", value)}
                          onCustomChange={(value) => updateEventGroupCategory(category.key, "genderOther", value)}
                        />
                      </div>
                      <div className="formField">
                        <label>Início</label>
                        <input className="clickableDateInput" type="date" value={category.eventDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "eventDate", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Fim</label>
                        <input className="clickableDateInput" type="date" min={category.eventDate || undefined} value={category.eventEndDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "eventEndDate", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Inscrições até</label>
                        <input className="clickableDateInput" type="date" max={category.eventDate || undefined} value={category.registrationDeadline} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "registrationDeadline", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Horário</label>
                        <input type="time" value={category.eventStartTime} onChange={(event) => updateEventGroupCategory(category.key, "eventStartTime", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Local</label>
                        <input value={category.location} onChange={(event) => updateEventGroupCategory(category.key, "location", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Set para vencer</label>
                        <select value={category.winningScore} onChange={(event) => updateEventGroupCategory(category.key, "winningScore", Number(event.target.value))}>
                          <option value={4}>4 games</option>
                          <option value={6}>6 games</option>
                        </select>
                      </div>
                      <div className="formField fullField">
                        <label>Critério do ranking</label>
                        {modalityConfig[category.type]?.type === "playranking" ? (
                          <select value="playranking_group_rule" disabled aria-label="Critério automático do Modelo Torneio 360">
                            <option value="playranking_group_rule">{getAutomaticCupRankingLabel(category.type)}</option>
                          </select>
                        ) : (
                          <select value={category.rankingCriteria} onChange={(event) => updateEventGroupCategory(category.key, "rankingCriteria", event.target.value)}>
                            <option value="">Escolha o critério</option>
                            {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="formField fullField categoryEditCoverField">
                        <label className="eventCoverToggle">
                          <input type="checkbox" checked={category.usesEventCover} onChange={(event) => updateEventGroupCategory(category.key, "usesEventCover", event.target.checked)} />
                          Usar a foto geral do evento
                        </label>
                        {!category.usesEventCover ? (
                          <label className={`categoryCoverPicker ${category.coverImageUrl ? "hasImage" : ""}`}>
                            <input type="file" accept="image/*" onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setEditEventGroup((current) => ({
                                ...current,
                                categories: current.categories.map((item) => item.key === category.key
                                  ? { ...item, coverImageUrl: imageUrl, coverImageThumbnailUrl: thumbnailUrl }
                                  : item),
                              })));
                            }} />
                            {category.coverImageUrl ? <img src={category.coverImageUrl} alt={`Foto de ${category.name || "categoria"}`} /> : <span><Camera aria-hidden="true" /> Escolher foto própria</span>}
                          </label>
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="editTournamentActions eventGroupEditActions">
              <button type="button" className="secondaryBtn" onClick={() => setEditEventGroup(null)} disabled={editEventGroupSaving}>Cancelar</button>
              <button type="button" onClick={() => void saveEditedEventGroup()} disabled={editEventGroupSaving || coverImageLoading} aria-busy={editEventGroupSaving || coverImageLoading}>
                {coverImageLoading ? "Preparando foto..." : editEventGroupSaving ? "Salvando conjunto..." : "Salvar evento completo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {circuitEditForm ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true" aria-labelledby="edit-circuit-title">
          <div className="editTournamentModal circuitEditModal">
            <div className="editTournamentHeader">
              <div>
                <span className="modalEyebrow">Circuitos</span>
                <h2 id="edit-circuit-title">Editar circuito</h2>
                <p>Atualize os dados e os torneios vinculados sem sair desta tela.</p>
              </div>
              <button type="button" className="secondaryBtn" onClick={() => setCircuitEditForm(null)}>Fechar</button>
            </div>

            <div className="editTournamentGrid circuitEditGrid">
              <div className="formField fullField">
                <label>Nome do circuito</label>
                <input value={circuitEditForm.name} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Circuito Verão" />
              </div>
              <div className="formField fullField tournamentCoverField">
                <div className="tournamentCoverIntro">
                  <div>
                    <strong><Camera aria-hidden="true" /> Foto do circuito</strong>
                    <span>Padrão Stories: 1080 × 1920 px (9:16). Escolha qualquer foto e ajuste o enquadramento na tela seguinte.</span>
                  </div>
                  {circuitEditForm.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => setCircuitEditForm((prev) => ({ ...prev, coverImageUrl: "", coverImageThumbnailUrl: "" }))}>Remover foto</button> : null}
                </div>
                <label className={`tournamentCoverDropzone ${circuitEditForm.coverImageUrl ? "hasImage" : ""}`}>
                  <input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setCircuitEditForm((prev) => ({
                      ...prev,
                      coverImageUrl: imageUrl,
                      coverImageThumbnailUrl: thumbnailUrl,
                    })));
                  }} />
                  {circuitEditForm.coverImageUrl ? <img src={circuitEditForm.coverImageUrl} alt="Prévia da foto do circuito" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do circuito"}</span>}
                </label>
              </div>
              <div className="formField">
                <label>Data inicial</label>
                <input className="clickableDateInput" type="date" required value={circuitEditForm.startDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              </div>
              <div className="formField">
                <label>Data final</label>
                <input className="clickableDateInput" type="date" required value={circuitEditForm.endDate} min={circuitEditForm.startDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </div>
              <div className="formField fullField">
                <label>Situação automática</label>
                <div className="automaticStatusField">{getAutomaticEventStatus(circuitEditForm.endDate) === "finished" ? "Encerrado" : "Ativo"}</div>
              </div>
            </div>

            <div className="circuitTournamentPicker circuitEditTournamentPicker">
              <div className="circuitPickerTitle">
                <strong>Torneios do circuito</strong>
                <span>{getCircuitTournamentSelection(circuitEditForm).selectedTournaments.length} considerado(s) no circuito</span>
              </div>
              <p className="circuitSelectionGuidance">Os cartões marcados com ✓ são os mesmos exibidos em “Torneios do circuito”.</p>
              {getCircuitTournamentSelection(circuitEditForm).unavailableIds.length > 0 ? (
                <p className="circuitSelectionNotice">
                  {getCircuitTournamentSelection(circuitEditForm).unavailableIds.length} vínculo(s) antigo(s) não aparece(m) porque o torneio não está mais disponível na lista atual.
                </p>
              ) : null}
              {tournaments.length === 0 ? (
                <p>Nenhum torneio criado ainda.</p>
              ) : (
                <div className="circuitTournamentList">
                  {tournaments.map((t) => {
                    const details = t.data || {};
                    const checked = normalizeCircuitTournamentIds(circuitEditForm.tournamentIds).includes(String(t.id));
                    return (
                      <label className={`circuitTournamentOption ${checked ? "selected" : ""}`} key={t.id}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCircuitTournament(t.id, true)} />
                        <span className="circuitCheckVisual">{checked ? "✓" : ""}</span>
                        <span className="circuitTournamentText">
                          <strong>{details.eventName || t.name}</strong>
                          <small>{[t.name, getModalityDisplayName(t.type), details.eventDate ? formatDateBR(details.eventDate) : null].filter(Boolean).join(" · ")}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <CircuitGenderRegistryPanel
              candidates={getCircuitGenderCandidates(circuitEditForm)}
              value={circuitEditForm.rankingSettings?.genderRegistry}
              knownRegistry={getArenaParticipantGenderRegistry()}
              onChange={(genderRegistry) => setCircuitEditForm((prev) => ({
                ...prev,
                rankingSettings: { ...prev.rankingSettings, genderRegistry },
              }))}
            />

            <CircuitRankingSettingsEditor
              value={circuitEditForm.rankingSettings}
              onChange={(rankingSettings) => setCircuitEditForm((prev) => ({ ...prev, rankingSettings }))}
            />

            <div className="editTournamentActions">
              <button type="button" className="secondaryBtn" onClick={() => setCircuitEditForm(null)}>Cancelar</button>
              <button
                type="button"
                className="actionConfirmBtn"
                disabled={circuitSaving || coverImageLoading}
                aria-busy={circuitSaving || coverImageLoading}
                onClick={() => saveCircuit(circuitEditForm)}
              >
                {coverImageLoading ? "Preparando foto..." : circuitSaving ? "Salvando circuito..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {coverImageEditor ? (
        createPortal(
          <StoryCoverEditor
            sourceUrl={coverImageEditor.imageUrl}
            fileName={coverImageEditor.fileName}
            onCancel={cancelTournamentCoverEditor}
            onApply={applyTournamentCover}
          />,
          document.body
        )
      ) : null}

      {photoEditor ? (
        <div className="photoEditorOverlay" role="dialog" aria-modal="true">
          <div className="photoEditorModal">
            <h2>Ajustar foto de perfil</h2>
            <p>Arraste a imagem para alinhar. Use o movimento de pinça no celular ou a roda do mouse para aproximar.</p>
            <div
              ref={photoPreviewRef}
              className="photoEditorPreview"
              onPointerDown={handlePhotoPointerDown}
              onPointerMove={handlePhotoPointerMove}
              onPointerUp={handlePhotoPointerEnd}
              onPointerCancel={handlePhotoPointerEnd}
              onWheel={handlePhotoWheel}
            >
              <canvas ref={photoCanvasRef} aria-label="Prévia da foto ajustada" />
            </div>
            <div className="photoEditorHint">Toque e arraste para mover • Pinça ou roda do mouse para zoom</div>
            <div className="photoEditorActions">
              <button type="button" className="cancelBtn" onClick={() => setPhotoEditor(null)}>Cancelar</button>
              <button type="button" onClick={applyEditedOrganizerPhoto}>Aplicar foto</button>
            </div>
          </div>
        </div>
      ) : null}

      {renderAppSidebar()}

      <div className="playMain">
        {renderAppTopbar()}
        {renderDataSafetyBanner()}

        <main className="playContent">
          {activePanel !== "ajustes" ? <section className="playTitleBlock">
            <div>
              <span className="pageEyebrow">Painel de gestão</span>
              <h1>{currentPanelMeta.title}</h1>
              <p>{currentPanelMeta.description}</p>
            </div>
            <div className="playPlanPill">Plano {profile.plan} · {formatStatusBR(profile.status)}</div>
          </section> : null}

          {freeTrialDetails && activePanel !== "ajustes" ? <FreeTrialNotice details={freeTrialDetails} formatDate={formatDateBR} /> : null}
          {renderCreationNavigation()}

          {["inicio", "explorar"].includes(activePanel) && (
            <React.Suspense fallback={<section className="card"><p>Carregando publicações...</p></section>}>
              {browsingPublicTournament
                ? publicPlatformHomeRuntime.renderPublicTournament({
                    tournament: browsingPublicTournament,
                    embedded: true,
                    viewer: user,
                    onBackToArena: () => {
                      setBrowsingPublicTournament(null);
                      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                    },
                  })
                : browsingPublicTournamentLoading
                  ? <section className="card"><p>Carregando o torneio no mesmo ambiente...</p></section>
                  : activePanel === "explorar" ? (
                    <PublicExploreSection
                      runtime={publicPlatformHomeRuntime}
                      hasSession
                      onOpenTournament={openPublishedTournamentFromFeed}
                    />
                  ) : (
                    <PublicPlatformHomeController
                      session={{ user }}
                      runtime={publicPlatformHomeRuntime}
                      embedded
                      onOpenTournament={openPublishedTournamentFromFeed}
                    />
                  )}
            </React.Suspense>
          )}

    {activePanel === "criar" && (
    <>
    <section className="card eventManagerToolbar">
      <div>
        <span className="managerEyebrow">Organização dos eventos</span>
        <h2>Meus torneios</h2>
        <p>Acompanhe os eventos em andamento, os próximos e o histórico encerrado.</p>
      </div>
      <button type="button" className="actionCreateBtn" onClick={() => setCreateTournamentOpen(true)}>+ Criar torneio</button>
    </section>

    {createTournamentOpen ? (
    <div className="eventEditorOverlay" role="dialog" aria-modal="true" aria-label="Criar torneio">
    <section className="card playCreateCard eventEditorSheet">
  <div className="eventEditorHeading">
    <div><span className="managerEyebrow">Novo evento</span><h2>Criar novo torneio</h2></div>
    <button type="button" className="secondaryBtn" onClick={() => setCreateTournamentOpen(false)}>Fechar</button>
  </div>

  <div className="formField">
    <label>Nome do evento/torneio</label>
    <input
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      placeholder="Ex: Campeão Open"
    />
  </div>

  <div className="formField">
    <label>Evento com várias categorias e/ou em mais de um dia?</label>
    <select value={newMultiCategoryEvent} onChange={(e) => setNewMultiCategoryEvent(e.target.value)}>
      <option value="nao">Não</option>
      <option value="sim">Sim</option>
    </select>
  </div>

  {newMultiCategoryEvent === "nao" && (
  <>
    <div className="formField">
      <label>Categoria</label>
      <input
        value={newCategory}
        onChange={(e) => setNewCategory(e.target.value)}
        placeholder="Ex: Iniciante, Open ou Sub-18"
      />
    </div>
    <div className="formField fullField tournamentGenderField">
      <label>Gênero</label>
      <TournamentGenderSelector
        type={newType}
        value={newGenderMode}
        customValue={newGenderOther}
        onChange={(value) => {
          setNewGenderMode(value);
          setNewType((currentType) => getCompatibleTournamentType(currentType, value, allowedTypes));
        }}
        onCustomChange={setNewGenderOther}
      />
    </div>
  </>
  )}

  {newMultiCategoryEvent === "sim" && (
  <div className="formField fullField eventScheduleBox">
    <div className="eventScheduleHeader">
      <strong><Tag aria-hidden="true" /> Torneios deste evento</strong>
      <span>Cada categoria pode ter modalidade, local, data, horário, games, critério e foto próprios.</span>
    </div>

    <div className="categoryScheduleList">
      {newCategorySchedules.map((item, index) => (
        <div className="categoryScheduleItem categoryTournamentCard" key={index}>
          <div className="formField compactField">
            <label>Categoria</label>
            <input value={item.category} onChange={(e) => updateCategorySchedule(index, "category", e.target.value)} placeholder="Ex: Iniciante ou Open" />
          </div>

          <div className="formField compactField categoryWideField">
            <label>Modalidade</label>
            <ModalityPicker value={item.type} options={getGenderCompatibleTournamentTypes(allowedTypes, item.participantGenderMode)} onChange={(type) => updateCategorySchedule(index, "type", type)} />
          </div>

          <div className="formField compactField categoryWideField tournamentGenderField">
            <label>Gênero</label>
            <TournamentGenderSelector
              compact
              type={item.type}
              value={item.participantGenderMode}
              customValue={item.genderOther}
              onChange={(value) => updateCategorySchedule(index, "participantGenderMode", value)}
              onCustomChange={(value) => updateCategorySchedule(index, "genderOther", value)}
            />
          </div>

          <div className="formField compactField">
            <label>Data</label>
            <input className="clickableDateInput" type="date" value={item.date} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "date", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Fim desta categoria</label>
            <input className="clickableDateInput" type="date" value={item.endDate} min={item.date || newDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "endDate", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Inscrições até</label>
            <input className="clickableDateInput" type="date" value={item.registrationDeadline} max={item.date || newDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "registrationDeadline", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Horário</label>
            <input type="time" value={item.time} onChange={(e) => updateCategorySchedule(index, "time", e.target.value)} />
          </div>

          <div className="formField compactField categoryWideField">
            <label>Local</label>
            <input value={item.location} onChange={(e) => updateCategorySchedule(index, "location", e.target.value)} placeholder="Ex: Arena Beach Sports" />
          </div>

          <div className="formField compactField">
            <label>Set para vencer</label>
            <select value={item.winningScore} onChange={(e) => updateCategorySchedule(index, "winningScore", e.target.value)}>
              <option value="4">4 games</option>
              <option value="6">6 games</option>
            </select>
          </div>

          <div className="formField compactField categoryCriteriaField">
            <label>Critério do ranking</label>
            {isCupType(modalityConfig[item.type]) ? (
              <select value={cupRankingCriteria} disabled aria-label="Critério automático das modalidades de copa">
                <option value={cupRankingCriteria}>{getAutomaticCupRankingLabel(item.type)}</option>
              </select>
            ) : (
              <select value={item.rankingCriteria} onChange={(e) => updateCategorySchedule(index, "rankingCriteria", e.target.value)}>
                <option value="">Escolha o critério</option>
                {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </div>

          <label className={`categoryCoverPicker ${item.coverImageUrl ? "hasImage" : ""}`}>
            <input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setNewCategorySchedules((current) => current.map((category, categoryIndex) => (
                categoryIndex === index
                  ? { ...category, coverImageUrl: imageUrl, coverImageThumbnailUrl: thumbnailUrl }
                  : category
              ))));
            }} />
            {item.coverImageUrl
              ? <img src={item.coverImageUrl} alt={`Foto de ${item.category || `categoria ${index + 1}`}`} />
              : <span><Camera aria-hidden="true" /> Foto própria</span>}
          </label>

          <div className="categoryScheduleActions">
            <button type="button" className="secondaryBtn" onClick={() => duplicateCategorySchedule(index)}>Duplicar</button>
            <button type="button" className="deleteBtn" onClick={() => removeCategorySchedule(index)} disabled={newCategorySchedules.length <= 1}>Remover</button>
          </div>
        </div>
      ))}
    </div>

    <button type="button" className="secondaryBtn" onClick={addCategorySchedule}>
      + Adicionar categoria
    </button>
  </div>
  )}

  {newMultiCategoryEvent === "nao" && (
  <div className="formField fullField eventScheduleBox">
    <div className="eventScheduleHeader">
      <strong><CalendarDays aria-hidden="true" /> Datas e horários do evento</strong>
      <span>Organize o período do torneio, inscrições e início dos jogos.</span>
    </div>

    <div className="eventScheduleGrid">
      <div className="formField compactField">
        <label>Início do torneio</label>
        <input
          className="clickableDateInput"
          type="date"
          required
          value={newDate}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          onChange={(e) => {
            setNewDate(e.target.value);
            if (newEndDate && e.target.value && newEndDate < e.target.value) setNewEndDate(e.target.value);
          }}
        />
      </div>

      <div className="formField compactField">
        <label>Fim do torneio</label>
        <input
          className="clickableDateInput"
          type="date"
          required
          value={newEndDate}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          min={newDate || undefined}
          onChange={(e) => setNewEndDate(e.target.value)}
        />
      </div>

      <div className="formField compactField">
        <label>Encerramento das inscrições</label>
        <input
          className="clickableDateInput"
          type="date"
          value={newRegistrationDeadline}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          max={newDate || undefined}
          onChange={(e) => setNewRegistrationDeadline(e.target.value)}
        />
      </div>

      {newMultiCategoryEvent === "nao" && (
      <div className="formField compactField">
        <label>{isMultiDayEvent ? "Horário padrão de início" : "Horário de início"}</label>
        <input
          type="time"
          value={newEventStartTime}
          onChange={(e) => setNewEventStartTime(e.target.value)}
        />
      </div>
      )}
    </div>

    {newMultiCategoryEvent === "nao" && isMultiDayEvent && (
      <div className="dailyTimesBox">
        <div className="dailyTimesIntro">
          <strong>Horário por dia</strong>
          <span>Use quando cada dia do torneio começar em um horário diferente.</span>
        </div>

        <div className="dailyTimesGrid">
          {eventDateRange.map((date) => (
            <div className="dailyTimeItem" key={date}>
              <label>{formatDateBR(date)} · {getWeekdayBR(date)}</label>
              <input
                type="time"
                value={newDailyStartTimes[date] || newEventStartTime}
                onChange={(e) => updateDailyStartTime(date, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  )}

  <section className="partnerFinderConfig fullField">
    <div>
      <span><Users aria-hidden="true" /></span>
      <div>
        <strong>Encontre sua dupla</strong>
        <small>Permite que um atleta entre sozinho e procure outro participante compatível dentro deste torneio.</small>
      </div>
    </div>
    <label className="partnerFinderConfigToggle">
      <input type="checkbox" checked={newPartnerFinderEnabled} onChange={(event) => setNewPartnerFinderEnabled(event.target.checked)} />
      <span>{newPartnerFinderEnabled ? "Ativado" : "Desativado"}</span>
    </label>
    {newPartnerFinderEnabled ? (
      <label className="partnerFinderConfigDeadline">
        <span>Prazo para formar a dupla</span>
        <input className="clickableDateInput" type="date" value={newPartnerFinderDeadline} max={newDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => setNewPartnerFinderDeadline(event.target.value)} />
        <small>Se ficar vazio, será usado o encerramento das inscrições.</small>
      </label>
    ) : null}
  </section>

  <section className="tournamentRegulationsConfig fullField">
    <header><ClipboardPaste aria-hidden="true" /><div><strong>Regulamento do torneio</strong><small>Escreva as regras e/ou informe um link público para o PDF.</small></div></header>
    <label>
      <span>Texto do regulamento</span>
      <textarea rows={5} maxLength={5000} value={newRegulationsText} onChange={(event) => setNewRegulationsText(event.target.value)} placeholder="Categorias, formato, critérios, conduta, premiação e demais regras." />
      <small>{newRegulationsText.length}/5000</small>
    </label>
    <label>
      <span>Link público do PDF</span>
      <input type="url" value={newRegulationsPdfUrl} onChange={(event) => setNewRegulationsPdfUrl(event.target.value)} placeholder="https://.../regulamento.pdf" />
    </label>
  </section>

  <div className="formField fullField tournamentCoverField">
    <div className="tournamentCoverIntro">
      <div>
        <strong><Camera aria-hidden="true" /> {newMultiCategoryEvent === "sim" ? "Foto geral do evento" : "Foto do torneio"}</strong>
        <span>{newMultiCategoryEvent === "sim" ? "Padrão Stories: 1080 × 1920 px (9:16). As categorias sem foto própria usarão esta imagem." : "Padrão Stories: 1080 × 1920 px (9:16). Se não escolher, a foto redonda da arena será usada no cartão."}</span>
      </div>
      {newCoverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => { setNewCoverImageUrl(""); setNewCoverImageThumbnailUrl(""); }}>Remover foto</button> : null}
    </div>
    <label className={`tournamentCoverDropzone ${newCoverImageUrl ? "hasImage" : ""}`}>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => {
            setNewCoverImageUrl(imageUrl);
            setNewCoverImageThumbnailUrl(thumbnailUrl);
          });
        }}
      />
      {newCoverImageUrl ? <img src={newCoverImageUrl} alt="Prévia da foto do torneio" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do evento"}</span>}
    </label>
  </div>

  {newMultiCategoryEvent === "nao" && (
  <>
  <div className="formField">
    <label>Local</label>
    <input
      value={newLocation}
      onChange={(e) => setNewLocation(e.target.value)}
      placeholder="Ex: Arena Beach Sports"
    />
  </div>

  <div className="formField fullField">
    <label>Modalidade</label>
    <ModalityPicker value={newType} options={getGenderCompatibleTournamentTypes(allowedTypes, newGenderMode)} onChange={setNewType} />
  </div>

  <div className="formField">
    <label>Set para vencer</label>
    <select value={newWinningScore} onChange={(e) => setNewWinningScore(Number(e.target.value))}>
      <option value={4}>4 games</option>
      <option value={6}>6 games</option>
    </select>
  </div>

  <div className="formField fullField">
    <label>Critério do ranking <span aria-hidden="true">*</span></label>
    {isCupType(modalityConfig[newType]) ? (
      <select value={cupRankingCriteria} disabled aria-label="Critério automático das modalidades de copa">
        <option value={cupRankingCriteria}>{getAutomaticCupRankingLabel(newType)}</option>
      </select>
    ) : (
      <select value={newRankingCriteria} onChange={(e) => setNewRankingCriteria(e.target.value)} required aria-required="true">
        <option value="">Escolha a ordem dos critérios</option>
        {rankingCriteriaOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )}
  </div>
  </>
  )}

 <button type="button" className="actionCreateBtn" onClick={createTournament} disabled={saving || coverImageLoading} aria-busy={saving || coverImageLoading}>
  {coverImageLoading ? "Preparando foto..." : saving ? "Salvando..." : "Criar torneio"}
</button>
      </section>
      </div>
      ) : null}

<section id="historico-torneios" className="card">
  <h2>Torneios cadastrados</h2>
  <div className="tournamentStatusSummary eventListToolbar" aria-label="Filtrar torneios por situação">
    <button type="button" className={`active ${tournamentStatusFilter === "active" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "active"} onClick={() => setTournamentStatusFilter("active")}>
      <strong>{tournamentLifecycleCounts.active}</strong> Em andamento
    </button>
    <button type="button" className={`upcoming ${tournamentStatusFilter === "upcoming" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "upcoming"} onClick={() => setTournamentStatusFilter("upcoming")}>
      <strong>{tournamentLifecycleCounts.upcoming}</strong> Próximos
    </button>
    <button type="button" className={`finished ${tournamentStatusFilter === "finished" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "finished"} onClick={() => setTournamentStatusFilter("finished")}>
      <strong>{tournamentLifecycleCounts.finished}</strong> Encerrados
    </button>
    <label className="eventListSearch platformUnifiedSearch">
      <Search aria-hidden="true" />
      <input
        type="search"
        value={tournamentSearch}
        onChange={(event) => setTournamentSearch(event.target.value)}
        aria-label="Pesquisar torneios cadastrados"
        placeholder="Ex.: nome, modalidade, categoria ou local"
      />
      {tournamentSearch ? <button type="button" aria-label="Limpar pesquisa de torneios" onClick={() => setTournamentSearch("")}><X aria-hidden="true" /></button> : null}
    </label>
  </div>
  <div className="tournamentGenderSubtabs" aria-label="Filtrar torneios por gênero">
    <span className="tournamentGenderSubtabsLabel">Gênero</span>
    {[
      { value: tournamentListGenderFilters.all, label: "Todos" },
      { value: tournamentListGenderFilters.masculine, label: "Masculino" },
      { value: tournamentListGenderFilters.feminine, label: "Feminino" },
      { value: tournamentListGenderFilters.mixed, label: "Misto/Livre" },
    ].map((option) => (
      <button
        type="button"
        key={option.value}
        className={tournamentGenderFilter === option.value ? "selected" : ""}
        aria-pressed={tournamentGenderFilter === option.value}
        onClick={() => setTournamentGenderFilter(option.value)}
      >
        {option.label} <strong>{tournamentGenderCounts[option.value]}</strong>
      </button>
    ))}
  </div>

  {tournaments.length === 0 ? (
    <p>Nenhum torneio criado ainda.</p>
  ) : organizerVisibleTournaments.length === 0 ? (
    <p className="eventStatusEmpty">{tournamentSearch.trim()
      ? `Nenhum torneio encontrado para “${tournamentSearch.trim()}” nos filtros selecionados.`
      : `Nenhum torneio ${tournamentStatusFilter === "active" ? "em andamento" : tournamentStatusFilter === "upcoming" ? "próximo" : "encerrado"}${tournamentGenderFilter === tournamentListGenderFilters.all ? "" : ` em ${tournamentGenderFilter === tournamentListGenderFilters.masculine ? "Masculino" : tournamentGenderFilter === tournamentListGenderFilters.feminine ? "Feminino" : "Misto/Livre"}`}.`}</p>
  ) : (
    <div className="eventGroupList">
      {isolatedTournaments.length > 0 && (
        <div className="tournamentList isolatedTournamentGrid">
          {isolatedTournaments.map((t) => {
            const details = t.data || {};

            return (
                <div
                  className={`tournamentItem ${draggedTournamentId ? "dragMode" : ""} ${draggedTournamentId === t.id ? "dragging" : ""} ${dragOverTournamentId === t.id && draggedTournamentId !== t.id ? "dropTarget" : ""}`}
                  key={t.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (draggedTournamentId && draggedTournamentId !== t.id) setDragOverTournamentId(t.id);
                  }}
                  onDrop={() => {
                    void moveTournamentByDrag(draggedTournamentId, t.id);
                    setDraggedTournamentId(null);
                    setDragOverTournamentId(null);
                  }}
                >
                  <button
                    type="button"
                    className="moveLineBtn"
                    title="Segure e arraste para reorganizar"
                    aria-label={`Mover ${t.name}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedTournamentId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedTournamentId(null);
                      setDragOverTournamentId(null);
                    }}
                  >
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </button>

                  <div className="tournamentInfo">
                    <div className="tournamentTitleRow">
                      <strong>{t.name}</strong>
                      <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
                      <span className={`tournamentLifecycleBadge ${getTournamentLifecycleStatus(t)}`}>
                        {getTournamentLifecycleStatus(t) === "finished" ? "Encerrado" : getTournamentLifecycleStatus(t) === "upcoming" ? "Próximo" : "Em andamento"}
                      </span>
                    </div>

                    <div className="tournamentMeta">
                      {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                      {getTournamentClassificationLabels(details).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
                      {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                      {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                      {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
                    </div>
                  </div>

                  <div className="tournamentActions">
                    <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
                    <button type="button" className="actionOpenBtn" onClick={() => openTournament(t)}>Abrir</button>
                    <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
                    <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {multiTournamentGroups.map((group) => (
        <div className="eventGroupCard" key={group.key}>
          <div className="eventGroupHeader">
            <div>
              <strong>{group.name}</strong>
              <span>{group.items.length} {group.items.length === 1 ? "categoria" : "categorias"}</span>
            </div>
            <button type="button" className="editEventGroupBtn" onClick={() => openEditEventGroup(group)}>
              Editar evento completo
            </button>
          </div>

          <div className="tournamentList eventTournamentGrid">
            {group.items.map((t) => {
              const details = t.data || {};

              return (
                <div
                  className={`tournamentItem ${draggedTournamentId ? "dragMode" : ""} ${draggedTournamentId === t.id ? "dragging" : ""} ${dragOverTournamentId === t.id && draggedTournamentId !== t.id ? "dropTarget" : ""}`}
                  key={t.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (draggedTournamentId && draggedTournamentId !== t.id) setDragOverTournamentId(t.id);
                  }}
                  onDrop={() => {
                    void moveTournamentByDrag(draggedTournamentId, t.id);
                    setDraggedTournamentId(null);
                    setDragOverTournamentId(null);
                  }}
                >
                  <button
                    type="button"
                    className="moveLineBtn"
                    title="Segure e arraste para reorganizar"
                    aria-label={`Mover ${t.name}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedTournamentId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedTournamentId(null);
                      setDragOverTournamentId(null);
                    }}
                  >
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </button>

                  <div className="tournamentInfo">
                    <div className="tournamentTitleRow">
                      <strong>{t.name}</strong>
                      <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
                      <span className={`tournamentLifecycleBadge ${getTournamentLifecycleStatus(t)}`}>
                        {getTournamentLifecycleStatus(t) === "finished" ? "Encerrado" : getTournamentLifecycleStatus(t) === "upcoming" ? "Próximo" : "Em andamento"}
                      </span>
                    </div>

                    <div className="tournamentMeta">
                      {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                      {getTournamentClassificationLabels(details).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
                      {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                      {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                      {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
                    </div>
                  </div>

                  <div className="tournamentActions">
                    <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
                    <button type="button" className="actionOpenBtn" onClick={() => openTournament(t)}>Abrir</button>
                    <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
                    <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  )}
</section>
    </>
    )}


{activePanel === "circuitos" && (
  <div className={`circuitManagerPage ${openedOrganizerCircuit ? "circuitDetailPage" : ""}`}>
  {!openedOrganizerCircuit ? <section className="card eventManagerToolbar circuitManagerToolbar">
    <div>
      <span className="managerEyebrow">Temporadas e etapas</span>
      <h2>Meus circuitos</h2>
      <p>Organize torneios relacionados e acompanhe o ranking geral acumulado.</p>
    </div>
    <div className="circuitManagerToolbarActions">
      <button type="button" className="createCircuitButton" onClick={() => setCreateCircuitOpen(true)}>+ Criar circuito</button>
      <button type="button" className="combineCircuitsButton" onClick={() => setCombineCircuitsOpen(true)}><PlusCircle aria-hidden="true" /> Somar circuitos</button>
    </div>
  </section> : null}

  {!openedOrganizerCircuit && combineCircuitsOpen ? (
    <div className="eventEditorOverlay" role="dialog" aria-modal="true" aria-label="Somar circuitos">
      <section className="card circuitsCard eventEditorSheet combinedCircuitSheet">
        <div className="circuitsHeader">
          <div><span className="managerEyebrow">Ranking consolidado</span><h2>Somar circuitos</h2><p>Crie um ranking que acompanha automaticamente os totais dos circuitos escolhidos.</p></div>
          <button type="button" className="secondaryBtn" onClick={() => setCombineCircuitsOpen(false)}>Fechar</button>
        </div>
        <label className="formField"><span>Nome do novo circuito</span><input value={combinedCircuitForm.name} onChange={(event) => setCombinedCircuitForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Ex: Ranking geral da temporada" /></label>
        <div className="combinedCircuitNotice"><CircleHelp aria-hidden="true" /><span>Os circuitos originais permanecem independentes. Se uma etapa estiver repetida, ela entrará uma única vez pela regra do primeiro circuito selecionado e você receberá um aviso.</span></div>
        <div className="circuitTournamentPicker">
          <div className="circuitPickerTitle"><strong>Circuitos de origem</strong><span>{combinedCircuitForm.sourceCircuitIds.length} selecionado(s)</span></div>
          <div className="circuitTournamentList combinedCircuitList">
            {circuits.map((circuit) => {
              const checked = combinedCircuitForm.sourceCircuitIds.some((id) => String(id) === String(circuit.id));
              const settings = normalizeCircuitRankingSettings(circuit.rankingSettings);
              const lifecycleStatus = getCircuitLifecycleStatus(circuit);
              const lifecycleLabel = lifecycleStatus === "finished"
                ? "Encerrado"
                : lifecycleStatus === "upcoming" ? "Próximo" : "Em andamento";
              return <button type="button" className={`circuitTournamentOption ${checked ? "selected" : ""}`} key={circuit.id} onClick={() => toggleCombinedCircuitSource(circuit.id)}>
                <span className="circuitCheckVisual">{checked ? "✓" : ""}</span>
                <span className="circuitTournamentText"><strong>{circuit.name}</strong><small>{lifecycleLabel} · {settings.identity === "team" ? "Por dupla" : settings.rankingDivision === "gender" ? "Masculino e feminino" : "Individual"} · {(circuit.tournamentIds || []).length} etapa(s)</small></span>
              </button>;
            })}
          </div>
        </div>
        <div className="circuitFormActions"><button type="button" className="combineCircuitsButton" disabled={combinedCircuitSaving} aria-busy={combinedCircuitSaving} onClick={() => void saveCombinedCircuit()}>{combinedCircuitSaving ? "Somando circuitos..." : "Criar circuito somado"}</button></div>
      </section>
    </div>
  ) : null}

  {!openedOrganizerCircuit && createCircuitOpen ? (
  <div className="eventEditorOverlay" role="dialog" aria-modal="true" aria-label="Criar circuito">
  <section className="card circuitsCard eventEditorSheet">
    <div className="circuitsHeader">
      <div>
        <h2>Novo circuito</h2>
        <p>Crie períodos flexíveis e escolha manualmente quais torneios entram. Isso não altera os torneios já criados.</p>
      </div>
      <button type="button" className="secondaryBtn" onClick={() => setCreateCircuitOpen(false)}>Fechar</button>
    </div>

    <div className="circuitsFormGrid">
      <div className="formField">
        <label>Nome do circuito</label>
        <input value={circuitForm.name} onChange={(e) => setCircuitForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Circuito Verão" />
      </div>
      <div className="formField fullField tournamentCoverField">
        <div className="tournamentCoverIntro">
          <div>
            <strong><Camera aria-hidden="true" /> Foto do circuito</strong>
            <span>Padrão Stories: 1080 × 1920 px (9:16). Escolha qualquer foto e ajuste o enquadramento na tela seguinte.</span>
          </div>
          {circuitForm.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => setCircuitForm((prev) => ({ ...prev, coverImageUrl: "", coverImageThumbnailUrl: "" }))}>Remover foto</button> : null}
        </div>
        <label className={`tournamentCoverDropzone ${circuitForm.coverImageUrl ? "hasImage" : ""}`}>
          <input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void prepareTournamentCover(file, ({ imageUrl, thumbnailUrl }) => setCircuitForm((prev) => ({
              ...prev,
              coverImageUrl: imageUrl,
              coverImageThumbnailUrl: thumbnailUrl,
            })));
          }} />
          {circuitForm.coverImageUrl ? <img src={circuitForm.coverImageUrl} alt="Prévia da foto do circuito" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do circuito"}</span>}
        </label>
      </div>
      <div className="formField">
        <label>Data inicial</label>
        <input className="clickableDateInput" type="date" required value={circuitForm.startDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitForm((prev) => ({ ...prev, startDate: e.target.value }))} />
      </div>
      <div className="formField">
        <label>Data final</label>
        <input className="clickableDateInput" type="date" required value={circuitForm.endDate} min={circuitForm.startDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitForm((prev) => ({ ...prev, endDate: e.target.value }))} />
      </div>
      <div className="formField">
        <label>Situação automática</label>
        <div className="automaticStatusField">
          {circuitForm.endDate && getAutomaticEventStatus(circuitForm.endDate) === "finished" ? "Encerrado" : "Ativo"}
        </div>
      </div>
    </div>

    <div className="circuitTournamentPicker">
      <div className="circuitPickerTitle">
        <strong>Torneios do circuito</strong>
        <span>{getCircuitTournamentSelection(circuitForm).selectedTournaments.length} selecionado(s)</span>
      </div>
      {tournaments.length === 0 ? (
        <p>Nenhum torneio criado ainda.</p>
      ) : (
        <div className="circuitTournamentList">
          {tournaments.map((t) => {
            const details = t.data || {};
            const checked = normalizeCircuitTournamentIds(circuitForm.tournamentIds).includes(String(t.id));
            return (
              <label className={`circuitTournamentOption ${checked ? "selected" : ""}`} key={t.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleCircuitTournament(t.id)} />
                <span className="circuitCheckVisual">{checked ? "✓" : ""}</span>
                <span className="circuitTournamentText">
                  <strong>{details.eventName || t.name}</strong>
                  <small>{[t.name, getModalityDisplayName(t.type), details.eventDate ? formatDateBR(details.eventDate) : null].filter(Boolean).join(" · ")}</small>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>

    <CircuitGenderRegistryPanel
      candidates={getCircuitGenderCandidates(circuitForm)}
      value={circuitForm.rankingSettings?.genderRegistry}
      knownRegistry={getArenaParticipantGenderRegistry()}
      onChange={(genderRegistry) => setCircuitForm((prev) => ({
        ...prev,
        rankingSettings: { ...prev.rankingSettings, genderRegistry },
      }))}
    />

    <CircuitRankingSettingsEditor
      value={circuitForm.rankingSettings}
      onChange={(rankingSettings) => setCircuitForm((prev) => ({ ...prev, rankingSettings }))}
    />

    <div className="circuitFormActions">
      <button
        type="button"
        className="actionCreateBtn"
        disabled={circuitSaving || coverImageLoading}
        aria-busy={circuitSaving || coverImageLoading}
        onClick={() => saveCircuit()}
      >
        {coverImageLoading ? "Preparando foto..." : circuitSaving ? "Criando circuito..." : "Criar circuito"}
      </button>
    </div>
  </section>
  </div>
  ) : null}

  <section className="card circuitsOverviewCard">
    {openedOrganizerCircuit ? (
      <header className="circuitDetailNavigation">
        <button type="button" className="circuitDetailBackButton" onClick={closeOrganizerCircuit}>
          <ChevronLeft aria-hidden="true" /> Voltar aos circuitos
        </button>
        <div className="circuitDetailActions" aria-label={`Ações do circuito ${openedOrganizerCircuit.name}`}>
          <button type="button" className="editBtn" onClick={() => editCircuit(openedOrganizerCircuit)}>Editar circuito</button>
          <button type="button" className="deleteBtn" onClick={() => setCircuitDeleteTarget(openedOrganizerCircuit)}>Excluir circuito</button>
        </div>
      </header>
    ) : null}
    <div className="circuitsList">
      {!openedOrganizerCircuit ? <>
      <h2>Circuitos cadastrados</h2>
      <div className="tournamentStatusSummary circuitStatusSummary eventListToolbar" aria-label="Filtrar circuitos por situação">
        <button type="button" className={`active ${circuitStatusFilter === "active" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "active"} onClick={() => setCircuitStatusFilter("active")}>
          <strong>{circuitLifecycleCounts.active}</strong> Em andamento
        </button>
        <button type="button" className={`upcoming ${circuitStatusFilter === "upcoming" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "upcoming"} onClick={() => setCircuitStatusFilter("upcoming")}>
          <strong>{circuitLifecycleCounts.upcoming}</strong> Próximos
        </button>
        <button type="button" className={`finished ${circuitStatusFilter === "finished" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "finished"} onClick={() => setCircuitStatusFilter("finished")}>
          <strong>{circuitLifecycleCounts.finished}</strong> Encerrados
        </button>
        <button type="button" className={`combined ${circuitStatusFilter === "combined" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "combined"} onClick={() => setCircuitStatusFilter("combined")}>
          <strong>{combinedCircuitCount}</strong> <span aria-hidden="true">∑</span> Circuitos somados
        </button>
        <label className="eventListSearch platformUnifiedSearch">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={circuitSearch}
            onChange={(event) => setCircuitSearch(event.target.value)}
            aria-label="Pesquisar circuitos cadastrados"
            placeholder="Ex.: nome do circuito, torneio ou modalidade"
          />
          {circuitSearch ? <button type="button" aria-label="Limpar pesquisa de circuitos" onClick={() => setCircuitSearch("")}><X aria-hidden="true" /></button> : null}
        </label>
      </div>
      </> : null}
      {circuits.length === 0 ? (
        <p>Nenhum circuito criado ainda.</p>
      ) : !openedOrganizerCircuit && visibleOrganizerCircuits.length === 0 ? (
        <p className="eventStatusEmpty">{circuitSearch.trim() ? `Nenhum circuito encontrado para “${circuitSearch.trim()}”.` : circuitStatusFilter === "combined" ? "Nenhum circuito somado criado ainda." : `Nenhum circuito ${circuitStatusFilter === "active" ? "em andamento" : circuitStatusFilter === "upcoming" ? "próximo" : "encerrado"}.`}</p>
      ) : organizerCircuitsToRender.map((circuit) => {
        const isExpanded = String(expandedCircuitId || "") === String(circuit.id);
        const selectedNames = isExpanded ? getCircuitSelectedTournaments(circuit) : [];
        const circuitStatus = getCircuitLifecycleStatus(circuit);
        const circuitRankingSettings = normalizeCircuitRankingSettings(circuit.rankingSettings);
        const sourceCircuitIds = circuitRankingSettings.sourceCircuitIds;
        const combinedCircuit = sourceCircuitIds.length > 0;
        const selectedTournamentCount = normalizeCircuitTournamentIds([
          ...(circuit.tournamentIds || []),
          ...sourceCircuitIds.flatMap((sourceId) => (
            circuits.find((item) => String(item.id) === String(sourceId))?.tournamentIds || []
          )),
        ]).length;
        const sourceCircuits = isExpanded
          ? sourceCircuitIds
            .map((sourceId) => circuits.find((item) => String(item.id) === String(sourceId)))
            .filter(Boolean)
          : [];
        const circuitSummaryContent = (
          <div className="circuitSummaryIdentity">
            <span className="circuitMonogram">{combinedCircuit ? "∑" : "CIR"}</span>
            <div className="circuitItemMain">
              <div className="circuitTitleLine">
                <h3>{circuit.name}</h3>
                <span className={`circuitStatus circuitStatus-${circuitStatus}`}>
                  {circuitStatus === "finished" ? "Encerrado" : circuitStatus === "upcoming" ? "Próximo" : "Em andamento"}
                </span>
              </div>
              <p className="circuitDateRange">
                <CalendarDays aria-hidden="true" />
                <span>{circuit.startDate ? formatDateBR(circuit.startDate) : "Sem início"}</span>
                <span className="circuitDateSeparator">até</span>
                <span>{circuit.endDate ? formatDateBR(circuit.endDate) : "sem fim definido"}</span>
              </p>
              <small>
                {combinedCircuit
                  ? `${sourceCircuitIds.length} circuito(s) de origem · ${selectedTournamentCount} torneio(s) consolidados`
                  : `${selectedTournamentCount} torneio(s)`}
              </small>
            </div>
          </div>
        );
        return (
          <article className={`circuitItem ${combinedCircuit ? "combinedCircuitItem" : ""} ${isExpanded ? "expanded" : ""}`} key={circuit.id}>
            {isExpanded ? (
              <div className="circuitItemSummary circuitDetailSummary">{circuitSummaryContent}</div>
            ) : (
              <button type="button" className="circuitItemSummary circuitListOpenButton" onClick={() => openOrganizerCircuit(circuit)}>
                {circuitSummaryContent}
                <span className="circuitOpenAction">Abrir <ChevronRight aria-hidden="true" /></span>
              </button>
            )}

            {isExpanded ? (
              <section className="circuitStagesSummary">
                <div><span>{combinedCircuit ? "Consolidação" : "Etapas"}</span><h4>{combinedCircuit ? "Circuitos de origem" : "Torneios do circuito"}</h4></div>
                {combinedCircuit ? (
                  sourceCircuits.length ? (
                    <div className="combinedCircuitSourceList">
                      {sourceCircuits.map((sourceCircuit) => {
                        const sourceTournaments = sortTournamentsChronologically(getCircuitSelectedTournaments(sourceCircuit));
                        const sourceStatus = getCircuitLifecycleStatus(sourceCircuit);
                        return (
                          <details className="combinedCircuitSourceGroup" key={sourceCircuit.id}>
                            <summary>
                              <span className="combinedCircuitSourceIdentity">
                                <strong>{sourceCircuit.name}</strong>
                                <small>{sourceTournaments.length} torneio(s)</small>
                              </span>
                              <span className="combinedCircuitSourceMeta">
                                <span className={`circuitStatus circuitStatus-${sourceStatus}`}>
                                  {sourceStatus === "finished" ? "Encerrado" : sourceStatus === "upcoming" ? "Próximo" : "Em andamento"}
                                </span>
                                <span className="combinedCircuitSourceChevron" aria-hidden="true"><ChevronDown /></span>
                              </span>
                            </summary>
                            {sourceTournaments.length ? (
                              <div className="circuitStageList combinedCircuitStageList">
                                {sourceTournaments.map((tournament) => (
                                  <button type="button" key={tournament.id} onClick={() => openTournament(tournament)}>
                                    <span>{tournament.name}</span>
                                    <small>{getModalityDisplayName(tournament.type)} · {formatDateBR(tournament.data?.eventDate)}</small>
                                  </button>
                                ))}
                              </div>
                            ) : <p>Nenhum torneio vinculado a este circuito.</p>}
                          </details>
                        );
                      })}
                    </div>
                  ) : <p>Nenhum circuito de origem disponível.</p>
                ) : selectedNames.length ? (
                  <div className="circuitStageList">
                    {sortTournamentsChronologically(selectedNames).map((tournament) => (
                      <button type="button" key={tournament.id} onClick={() => openTournament(tournament)}>
                        <span>{tournament.name}</span>
                        <small>{getModalityDisplayName(tournament.type)} · {formatDateBR(tournament.data?.eventDate)}</small>
                      </button>
                    ))}
                  </div>
                ) : <p>Nenhum torneio vinculado.</p>}
              </section>
            ) : null}

            {isExpanded ? (() => {
              const normalizedCircuitId = String(circuit.id);
              const historyLoadStatus = circuitHistoryLoadState[normalizedCircuitId]
                || (circuitHistoryLoadedIdsRef.current.has(normalizedCircuitId) ? "loaded" : "loading");
              if (historyLoadStatus !== "loaded") {
                if (historyLoadStatus === "loading") {
                  return (
                    <div className="circuitRankingLoadingState" role="status" aria-live="polite">
                      <span className="circuitRankingSpinner" aria-hidden="true" />
                      <div className="circuitRankingLoadingCopy">
                        <strong>Carregando dados do circuito…</strong>
                        <span>Torneios e ranking consolidado estão sendo preparados.</span>
                      </div>
                      <span className="circuitRankingLoadingProgress" aria-hidden="true"><i /></span>
                    </div>
                  );
                }
                return (
                  <div className="circuitRankingLoadingState hasError" role="alert">
                    <div className="circuitRankingLoadingCopy">
                      <strong>Ranking indisponível no momento</strong>
                      <span>Os demais dados do circuito continuam disponíveis. Tente carregar o ranking novamente.</span>
                    </div>
                    <button type="button" onClick={() => void loadCircuitRankingHistory(circuit.id, { force: true })}>
                      Tentar novamente
                    </button>
                  </div>
                );
              }
              const effectiveCircuitCriteria = getCircuitEffectiveCriteria(circuit);
              const circuitRankingGroups = getPersistedCircuitRanking(circuit, effectiveCircuitCriteria);
              const rankingSettings = normalizeCircuitRankingSettings(circuit.rankingSettings);
              const toolsExpanded = String(expandedCircuitToolsId || "") === normalizedCircuitId;
              const placementMode = rankingSettings.mode === circuitRankingModes.placement;
              const placementColumns = placementMode ? getCircuitPlacementColumns(rankingSettings, { includeManual: true }) : null;
              const performanceColumns = placementMode ? null : getCircuitPerformanceColumns(rankingSettings);
              const circuitDisplayColumns = placementColumns || performanceColumns;
              const circuitExportColumns = getCircuitRankingExportColumns(rankingSettings);
              const circuitRankingTitle = placementMode ? "Ranking geral por pontos" : "Ranking geral acumulado";
              const unresolvedTieGroups = getUnresolvedCircuitTieGroups(circuitRankingGroups, rankingSettings);
              const circuitCriteriaLabel = getCircuitTieBreakLabel(rankingSettings, { compact: true });
              const getCircuitGroupShareConfig = (group) => ({
                title: circuit.name,
                subtitle: group.title,
                arenaName: organizerProfile.arenaName || organizerProfile.organizerName || "Arena Torneio360",
                arenaPhotoUrl: organizerProfile.photoUrl || "",
                rankingCriteria: effectiveCircuitCriteria,
                columns: circuitExportColumns,
                criteriaLabel: circuitCriteriaLabel,
                groups: [group],
                editableWorkbook: true,
                workbookTitle: `${circuit.name} - ${group.title}`,
                workbookGroups: [group],
                workbookColumns: circuitExportColumns,
                buttonLabel: group.key === "masculino"
                  ? "Compartilhar masculino"
                  : group.key === "feminino"
                    ? "Compartilhar feminino"
                    : "Compartilhar ranking",
              });
              return circuitRankingGroups.length ? (
                <div className="circuitRankingBox">
                  <div className="circuitRankingHeader">
                    <div className="circuitRankingIdentity">
                      <span>{circuit.name}</span>
                      <strong>{circuitRankingTitle}</strong>
                    </div>
                    <div className="circuitRankingRuleBadge">
                      <strong>{placementMode ? "Ranking com pontuação" : "Desempenho acumulado"}</strong>
                      <span>{circuitCriteriaLabel}</span>
                      <small>Disputas paralelas não pontuam nem entram nos critérios.</small>
                    </div>
                    {unresolvedTieGroups.length > 0 ? (
                      <button
                        type="button"
                        className="circuitTieDrawButton"
                        onClick={() => void drawCircuitRankingTies(circuit, circuitRankingGroups)}
                      >
                        <Dices aria-hidden="true" /> Sortear desempate
                      </button>
                    ) : null}
                  </div>
                  {/* Legacy card-style circuit ranking kept here only as a reference.
                  {circuitRankingGroups.map((group) => (
                    <div className="circuitRankingGroup" key={group.key}>
                      <h4>{group.title}</h4>
                      <div className="circuitRankingTable">
                        {group.rows.map((row, index) => (
                          <div className="circuitRankingRow" key={row.name}>
                            <span>{index + 1}º</span>
                            <b>{row.name}</b>
                            <em>Total de Games: {row.pts}</em>
                            <small>{row.w} vit. · saldo {row.bal} · {row.played} jogo(s)</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  */}
                  {circuitRankingGroups.length === 1 ? (
                    <RankingTable
                      title={circuitRankingGroups[0].title}
                      rows={circuitRankingGroups[0].rows}
                      rankingCriteria={effectiveCircuitCriteria}
                      columns={circuitDisplayColumns}
                      showGames={!placementMode}
                      shareConfig={rankingSettings.rankingDivision === "gender" && circuitRankingGroups[0].key === "geral"
                        ? null
                        : getCircuitGroupShareConfig(circuitRankingGroups[0])}
                      progressive
                      initialRowCount={30}
                    />
                  ) : (
                    <div className="twoCols circuitRankingTables">
                      {circuitRankingGroups.map((group) => (
                        <RankingTable
                          key={group.key}
                          title={group.title}
                          rows={group.rows}
                          rankingCriteria={effectiveCircuitCriteria}
                          columns={circuitDisplayColumns}
                          showGames={!placementMode}
                          shareConfig={rankingSettings.rankingDivision === "gender" && group.key === "geral"
                            ? null
                            : getCircuitGroupShareConfig(group)}
                          progressive
                          initialRowCount={30}
                        />
                      ))}
                    </div>
                  )}
                  <div className="circuitDeferredTools">
                    <button
                      type="button"
                      className="circuitDeferredToolsButton"
                      aria-expanded={toolsExpanded}
                      onClick={() => setExpandedCircuitToolsId((current) => (
                        String(current || "") === normalizedCircuitId ? null : circuit.id
                      ))}
                    >
                      {toolsExpanded ? "Fechar atletas e pontuações" : "Gerenciar atletas e pontuações"}
                    </button>
                    {toolsExpanded ? (
                      <CircuitExtraPointsPanel circuit={circuit} rankingGroups={circuitRankingGroups} onSave={(rankingSettings) => updateCircuitRankingSettings(circuit, rankingSettings)} />
                    ) : null}
                  </div>
                </div>
              ) : selectedNames.length ? (
                <div className="circuitRankingEmptyState">
                  <div className="circuitRankingEmpty">Ranking aparece quando houver placares lançados nos torneios selecionados.</div>
                  <div className="circuitDeferredTools">
                    <button
                      type="button"
                      className="circuitDeferredToolsButton"
                      aria-expanded={toolsExpanded}
                      onClick={() => setExpandedCircuitToolsId((current) => (
                        String(current || "") === normalizedCircuitId ? null : circuit.id
                      ))}
                    >
                      {toolsExpanded ? "Fechar atletas e pontuações" : "Gerenciar atletas e pontuações"}
                    </button>
                    {toolsExpanded ? (
                      <CircuitExtraPointsPanel circuit={circuit} rankingGroups={[]} onSave={(rankingSettings) => updateCircuitRankingSettings(circuit, rankingSettings)} />
                    ) : null}
                  </div>
                </div>
              ) : null;
            })() : null}

          </article>
        );
      })}
    </div>
  </section>
  </div>
)}

{activePanel === "modalidades" && (
<section className="card">
  <h2>Modalidades liberadas</h2>
  <div className="modalitiesGrid internalModalities">
    {allowedTypes.includes("Super 12 Mista (Dupla Fixa)") && (
      <Info
        title="Super 6 (dupla fixa)"
        text="Formato com 6 duplas já definidas antes do início do campeonato. Diferente das modalidades aleatórias, aqui os parceiros permanecem juntos do começo ao fim. O sistema gera automaticamente os confrontos entre as duplas, organiza a sequência de jogos e calcula a classificação geral pelos placares lançados. É indicado quando os atletas já se inscrevem em dupla e querem disputar como equipe fixa."
      />
    )}

    {allowedTypes.includes("Super 08") && (
      <Info
        title="Super 8"
        text="Formato individual com 8 participantes, ideal para torneios rápidos. Cada atleta joga com parceiros diferentes ao longo das rodadas, evitando que uma dupla fixa determine todo o resultado. O sistema monta os confrontos automaticamente, organiza as quadras, registra os placares e calcula o ranking individual. No final, vence quem tiver melhor desempenho geral conforme os critérios definidos, como vitórias, total de games e saldo de games."
      />
    )}

    {allowedTypes.includes("Super 16 Mista (Dupla Fixa)") && (
      <Info
        title="Super 8 (dupla fixa)"
        text="Formato com 8 duplas fixas, indicado para torneios maiores em que cada equipe permanece igual durante toda a competição. O sistema organiza os jogos entre as duplas, distribui as rodadas e registra os resultados. A classificação é por dupla, não individual. Conforme os placares são preenchidos, o ranking geral é atualizado com vitórias, total de games e saldo de games, ajudando o organizador a acompanhar quem está avançando melhor."
      />
    )}

    {allowedTypes.includes("Super 10 (Dupla Fixa)") && (
      <Info
        title="Super 10 (dupla fixa)"
        text="Formato com 10 duplas fixas. O sorteio distribui as duplas nos números de 1 a 10 e o chaveamento numérico permanece fixo. São 9 rodadas, 5 jogos por rodada e 45 partidas no total, com cada dupla enfrentando todas as demais exatamente uma vez."
      />
    )}

    {allowedTypes.includes("Super 12 (Dupla Fixa)") && (
      <Info
        title="Super 12 (dupla fixa)"
        text="Formato com 12 duplas fixas. O sorteio distribui as duplas nos números de 1 a 12 e o chaveamento numérico permanece fixo. São 11 rodadas, 6 jogos por rodada e 66 partidas no total, com cada dupla enfrentando todas as demais exatamente uma vez."
      />
    )}

    {allowedTypes.includes("Super 12") && (
      <Info
        title="Super 12"
        text="Formato individual com 12 participantes definidos livremente pelo organizador, sem exigência de gênero. São 11 rodadas em 3 quadras, sem descanso. Cada atleta joga uma vez com cada parceiro, enfrenta cada adversário duas vezes e participa de um único ranking geral."
      />
    )}

    {allowedTypes.includes("Super 10 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 10 mista"
        text="Formato misto com 10 participantes: 5 homens e 5 mulheres. São 5 rodadas, com 2 jogos por rodada, e em cada rodada descansam 1 homem e 1 mulher. Ao final, todos jogam 4 partidas e descansam 1 vez. O sistema monta automaticamente as duplas mistas, organiza as quadras, registra os placares e calcula rankings separados masculino e feminino. É ideal para torneios de hoje, eventos rápidos e grupos menores, mantendo equilíbrio de jogos entre todos os atletas."
      />
    )}

    {allowedTypes.includes("Super 12 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 12 mista"
        text="Formato misto com 12 participantes: 6 homens e 6 mulheres. Primeiro, os atletas são cadastrados e sorteados. Depois, o sistema combina os participantes para formar duplas mistas em diferentes rodadas, mantendo equilíbrio entre homens e mulheres. Cada jogador participa de jogos com combinações variadas, e o desempenho é calculado individualmente. É uma boa opção para eventos sociais e competitivos com rotação de parceiros."
      />
    )}

    {allowedTypes.includes("Super 16 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 16 mista"
        text="Formato misto com 16 participantes: 8 homens e 8 mulheres. Funciona como uma versão maior do Super 12 mista, com mais atletas, mais jogos e maior movimentação de quadras. O sistema monta as duplas mistas de forma organizada, distribui as partidas e permite preencher os placares rodada por rodada. O ranking é individual, ou seja, cada atleta pontua pelo próprio desempenho, mesmo jogando com parceiros diferentes durante o torneio."
      />
    )}

    {allowedTypes.includes("Super 20 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 20 mista"
        text="Formato misto com 20 participantes: 10 homens e 10 mulheres. São 10 rodadas em 5 quadras. Cada homem forma dupla exatamente uma vez com cada mulher, e vice-versa. A tabela é fixa, reduz a repetição de adversários e mantém rankings individuais masculino e feminino."
      />
    )}

    {allowedTypes.includes("Simples 8") && (
      <Info
        title="Simples (1 contra 1 por jogo)"
        text="Formato individual para 4, 6, 8, 10, 12 ou 14 jogadores. O organizador escolhe a quantidade e o sistema monta automaticamente todos contra todos: cada atleta enfrenta todos os demais exatamente uma vez, sem folgas nas rodadas. O ranking geral individual acompanha vitórias, total de games e saldo de games."
      />
    )}

    {allowedTypes.includes("Copa - 18 duplas") && (
      <Info
        title="Copa - 18 duplas"
        text="Formato de Copa com 18 duplas, dividido em 6 grupos de 3 duplas. Cada grupo joga sua fase classificatória, e o sistema calcula a classificação com base nos critérios definidos. Os melhores avançam para a chave principal; os 2 melhores gerais podem receber BYE, entrando em fase mais avançada. Também há disputa paralela para duplas específicas, como terceiros colocados, permitindo manter mais atletas em atividade. É um formato ideal para torneios grandes, com organização mais profissional e várias fases."
      />
    )}

    {allowedTypes.includes("Campeonato Cearense") && (
      <Info
        title="Torneio modelo Campeonato Cearense"
        text="Formato de 4 a 32 duplas. Os dois primeiros de cada grupo seguem para a Eliminatória Principal e os demais para a Disputa Paralela. Entre grupos, a ordem é equilibrada por percentual de vitórias, saldo médio e média de games por partida."
      />
    )}

    {allowedTypes.includes("Modelo Play Ranking") && (
      <Info
        title="Modelo Torneio 360"
        text="Na fase de grupos, classifica por vitórias, saldo de games, confronto direto, coeficiente e sorteio; o Total de Games fica apenas como estatística. As duplas derrotadas somente na primeira fase jogada da Eliminatória Principal também seguem para a Disputa Paralela, com prioridade e sem confronto direto entre elas na estreia sempre que houver uma dupla vinda dos grupos disponível."
      />
    )}
  </div>
</section>
)}

{activePanel === "lixeira" && (() => {
  const showingCircuits = trashCategory === "circuits";
  const sourceItems = showingCircuits ? trashCircuits : trashTournaments;
  const selectedIds = showingCircuits ? selectedTrashCircuitIds : selectedTrashTournamentIds;
  const normalizedTerm = normalizeModalitySearch(trashSearch);
  const visibleItems = sourceItems.filter((item) => {
    if (!normalizedTerm) return true;
    const details = item.data || {};
    const haystack = showingCircuits
      ? `${item.name} ${item.startDate} ${item.endDate}`
      : `${item.name} ${getModalityDisplayName(item.type)} ${getTournamentClassificationLabels(details).join(" ")} ${details.location || ""}`;
    return normalizeModalitySearch(haystack).includes(normalizedTerm);
  });

  return (
    <section className="card trashCard">
      <div className="trashHeader">
        <div>
          <span className="trashEyebrow">Itens excluídos</span>
          <h2>Lixeira</h2>
          <p>Torneios e circuitos ficam aqui por 30 dias antes da exclusão definitiva.</p>
        </div>
        <span>{trashTournaments.length + trashCircuits.length} item(ns)</span>
      </div>

      <div className="trashToolbar">
        <div className="trashCategoryTabs" role="tablist" aria-label="Tipos de itens na lixeira">
          <button type="button" role="tab" aria-selected={!showingCircuits} className={!showingCircuits ? "active" : ""} onClick={() => setTrashCategory("tournaments")}>
            <Trophy aria-hidden="true" /> Torneios <span>{trashTournaments.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={showingCircuits} className={showingCircuits ? "active" : ""} onClick={() => setTrashCategory("circuits")}>
            <GitBranch aria-hidden="true" /> Circuitos <span>{trashCircuits.length}</span>
          </button>
        </div>

        <label className="trashSearchField platformUnifiedSearch">
          <Search aria-hidden="true" />
          <input value={trashSearch} onChange={(event) => setTrashSearch(event.target.value)} placeholder={showingCircuits ? "Ex.: nome do circuito" : "Ex.: nome, modalidade ou categoria"} />
          {trashSearch ? <button type="button" aria-label="Limpar pesquisa" onClick={() => setTrashSearch("")}><X aria-hidden="true" /></button> : null}
        </label>

        <div className="trashBulkActions">
          {selectedIds.length ? (
            <button type="button" className="trashDeleteSelectedBtn" onClick={() => requestPermanentTrashDeletion(trashCategory, selectedIds)}>
              <Trash2 aria-hidden="true" /> Excluir selecionados ({selectedIds.length})
            </button>
          ) : null}
          <button type="button" className="trashEmptyBtn" disabled={!sourceItems.length} onClick={() => requestPermanentTrashDeletion(trashCategory, sourceItems.map((item) => item.id), true)}>
            <Trash2 aria-hidden="true" /> Excluir todos definitivamente
          </button>
        </div>
      </div>

      {!sourceItems.length ? (
        <div className="trashEmptyState">
          <Trash2 aria-hidden="true" />
          <strong>Nenhum {showingCircuits ? "circuito" : "torneio"} na lixeira</strong>
          <span>Os itens movidos para cá poderão ser recuperados durante 30 dias.</span>
        </div>
      ) : !visibleItems.length ? (
        <div className="trashEmptyState compact">
          <Search aria-hidden="true" />
          <strong>Nenhum resultado encontrado</strong>
          <span>Tente pesquisar com outro nome.</span>
        </div>
      ) : (
        <div className="trashList">
          {visibleItems.map((item) => {
            const details = item.data || {};
            const daysLeft = getTrashDaysLeft(item);
            const selectedItem = selectedIds.includes(String(item.id));
            return (
              <article
                className={`trashItem ${selectedItem ? "selected" : ""}`}
                key={`${trashCategory}-${item.id}`}
                role="checkbox"
                aria-checked={selectedItem}
                tabIndex={0}
                onClick={() => toggleTrashSelection(trashCategory, item.id)}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    toggleTrashSelection(trashCategory, item.id);
                  }
                }}
              >
                <span className="trashItemCheck" aria-hidden="true">{selectedItem ? "✓" : ""}</span>
                <div className="trashItemInfo">
                  <div className="trashItemTitleRow">
                    <strong>{item.name}</strong>
                    <span className="trashItemType">{showingCircuits ? "Circuito" : getModalityDisplayName(item.type)}</span>
                  </div>
                  <div className="trashItemMeta">
                    {showingCircuits ? (
                      <>
                        {(item.startDate || item.endDate) ? <span><CalendarDays aria-hidden="true" /> {[item.startDate && formatDateBR(item.startDate), item.endDate && formatDateBR(item.endDate)].filter(Boolean).join(" até ")}</span> : null}
                        <span><Trophy aria-hidden="true" /> {(item.tournamentIds || []).length} torneio(s) vinculado(s)</span>
                      </>
                    ) : (
                      <>
                        {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> Várias categorias</span> : null}
                        {getTournamentClassificationLabels(details).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
                        {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                        {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      </>
                    )}
                    <span className="trashExpiry"><Trash2 aria-hidden="true" /> Exclusão automática em {daysLeft} dia(s)</span>
                  </div>
                </div>
                <div className="trashItemActions">
                  <button type="button" className="actionRestoreBtn" onClick={(event) => { event.stopPropagation(); if (showingCircuits) void restoreCircuit(item); else void restoreTournament(item); }}>Recuperar</button>
                  <button type="button" className="trashPermanentBtn" onClick={(event) => { event.stopPropagation(); requestPermanentTrashDeletion(trashCategory, [item.id]); }}>Excluir definitivamente</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
})()}

{activePanel === "ajustes" && (
<>
  <section className="card instagramProfileCard socialOwnProfileCard">
    <label className={`unifiedProfilePublicCover editableProfileCover${memberProfile.coverUrl ? " hasCover" : ""}`} title="Alterar foto de capa">
      <input
        type="file"
        accept="image/*"
        disabled={memberProfileSaving}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) openMemberProfileImageEditor(file, "cover");
          event.target.value = "";
        }}
      />
      {memberProfile.coverUrl ? <img src={memberProfile.coverUrl} alt="" /> : null}
      <span className="profileMediaEditBadge"><Camera aria-hidden="true" /> Alterar capa</span>
    </label>
    <div className="instagramProfileHeader unifiedProfileHeader">
      <label className="instagramProfilePhoto editableProfileAvatar" title="Alterar foto do perfil">
        <input
          type="file"
          accept="image/*"
          disabled={memberProfileSaving}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) openMemberProfileImageEditor(file, "photo");
            event.target.value = "";
          }}
        />
        {memberProfile.photoUrl ? <img src={memberProfile.photoUrl} alt="Foto do perfil pessoal" /> : <span><UserRound aria-hidden="true" /></span>}
        <i className="profileAvatarEditBadge"><Camera aria-hidden="true" /></i>
      </label>
      <div className="instagramProfileInfo">
        <div className="instagramProfileTopline">
          <div className="organizationProfileName">
            <h2>{organizerProfile.arenaName || profileDisplayName}</h2>
            <span>Organização</span>
          </div>
          <button type="button" className="secondaryBtn profileEditShortcut" onClick={() => setMemberProfileEditorOpen(true)}>
            <Settings aria-hidden="true" />
            Editar perfil
          </button>
        </div>
        <p className="unifiedProfileHandle">{memberProfile.handle ? `@${memberProfile.handle}` : "Escolha seu nome de usuário"}</p>
        {memberProfile.bio ? <p className="unifiedProfileBio">{memberProfile.bio}</p> : null}
        {memberProfile.city || memberProfile.state ? (
          <p className="unifiedProfileLocation"><MapPin aria-hidden="true" /> {[memberProfile.city, memberProfile.state].filter(Boolean).join("/")}</p>
        ) : null}
        <div className="unifiedProfileStats" aria-label="Resumo do perfil">
          <span><strong>{memberProfile.galleryPhotos.length}</strong><small>Fotos</small></span>
          <span><strong>{tournaments.length}</strong><small>Torneios</small></span>
          <span><strong>{circuits.length}</strong><small>Circuitos</small></span>
          <span><strong>{memberProfile.followersCount || 0}</strong><small>Seguidores</small></span>
        </div>
      </div>
    </div>

    <div className="profileSubtabs" role="tablist" aria-label="Seções do perfil">
      <button
        type="button"
        role="tab"
        className={profileSubtab === "publicacoes" ? "active" : ""}
        onClick={() => openProfileSection("publicacoes")}
        aria-selected={profileSubtab === "publicacoes"}
      >
        <Grid3X3 aria-hidden="true" />
        Publicações
      </button>
      <button
        type="button"
        role="tab"
        className={profileSubtab === "fotos" ? "active" : ""}
        onClick={() => openProfileSection("fotos")}
        aria-selected={profileSubtab === "fotos"}
      >
        <Images aria-hidden="true" />
        Fotos
      </button>
      <button
        type="button"
        role="tab"
        className={profileSubtab === "contato" ? "active" : ""}
        onClick={() => openProfileSection("contato")}
        aria-selected={profileSubtab === "contato"}
      >
        <AtSign aria-hidden="true" />
        Sobre
      </button>
      <button
        type="button"
        role="tab"
        className={profileSubtab === "conquistas" ? "active" : ""}
        onClick={() => openProfileSection("conquistas")}
        aria-selected={profileSubtab === "conquistas"}
      >
        <Award aria-hidden="true" />
        Conquistas
      </button>
    </div>

    {profileSubtab === "publicacoes" ? (
      <div className="profileSubtabPanel">
    <div className="profilePublicationsHeader">
      <div><strong>Publicações</strong><span>{tournaments.length} campeonato(s) criado(s)</span></div>
      <div className="profilePublicationCreateActions">
        <button type="button" onClick={() => { goToPanel("criar"); setCreateTournamentOpen(true); }}><PlusCircle aria-hidden="true" /> Criar torneio</button>
        <button type="button" onClick={() => { goToPanel("circuitos"); setCreateCircuitOpen(true); }}><GitBranch aria-hidden="true" /> Criar circuito</button>
      </div>
    </div>

    <nav className="profilePublicationFilters" aria-label="Filtrar publicações" role="tablist">
      <button type="button" role="tab" aria-selected={profilePublicationFilter === "all"} className={profilePublicationFilter === "all" ? "active" : ""} onClick={() => setProfilePublicationFilter("all")}>Tudo <span>{tournaments.length + circuits.length}</span></button>
      <button type="button" role="tab" aria-selected={profilePublicationFilter === "tournaments"} className={profilePublicationFilter === "tournaments" ? "active" : ""} onClick={() => setProfilePublicationFilter("tournaments")}>Torneios <span>{tournaments.length}</span></button>
      <button type="button" role="tab" aria-selected={profilePublicationFilter === "circuits"} className={profilePublicationFilter === "circuits" ? "active" : ""} onClick={() => setProfilePublicationFilter("circuits")}>Circuitos <span>{circuits.length}</span></button>
    </nav>

    {profilePublicationFilter !== "circuits" ? <div className="profileTournamentGrid">
      {tournaments.length === 0 ? (
        <div className="profileEmptyPost">Nenhum campeonato criado ainda.</div>
      ) : tournaments.map((t) => {
        const details = t.data || {};
        return (
          <article className="profileTournamentPost tournamentItem" key={t.id}>
            {details.coverImageThumbnailUrl || details.coverImageUrl ? (
              <img className="profileTournamentCover" src={details.coverImageThumbnailUrl || details.coverImageUrl} alt={`Foto de ${t.name}`} />
            ) : null}
            <div className="tournamentInfo">
              <div className="tournamentTitleRow">
                <strong>{t.name}</strong>
                <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
              </div>
              <div className="tournamentMeta">
                {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                {getTournamentClassificationLabels(details).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
                {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
              </div>
            </div>
            <div className="tournamentActions">
              <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
              <button type="button" className="actionOpenBtn" onClick={() => openTournament(t)}>Abrir</button>
              <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
              <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
            </div>
          </article>
        );
      })}
    </div> : null}

    {profilePublicationFilter !== "tournaments" ? <>
    <div className="profilePublicationsHeader profileCircuitsHeading">
      <strong>Circuitos</strong>
      <span>{circuits.length} circuito(s) publicado(s)</span>
    </div>
    <div className="profileCircuitPublicationGrid">
      {circuits.length === 0 ? (
        <div className="profileEmptyPost">Nenhum circuito criado ainda.</div>
      ) : circuits.map((circuit) => (
        <article className="profileCircuitPublication" key={circuit.id}>
          <span className="profileCircuitPublicationIcon"><GitBranch aria-hidden="true" /></span>
          <div>
            <strong>{circuit.name}</strong>
            <small>
              {(circuit.tournamentIds || []).length} torneio(s)
              {circuit.startDate ? ` · ${formatDateBR(circuit.startDate)}` : ""}
            </small>
          </div>
          <button type="button" onClick={() => openOrganizerCircuit(circuit)}>Abrir</button>
        </article>
      ))}
    </div>
    </> : null}

      </div>
    ) : null}

    {profileSubtab === "fotos" ? (
      <div className="profileSubtabPanel profilePhotosPanel">
        <section className="unifiedMemberGalleryEditor" aria-labelledby="member-gallery-profile-title">
          <header>
            <div>
              <span><Images aria-hidden="true" /></span>
              <div>
                <h3 id="member-gallery-profile-title">Fotos do perfil</h3>
                <p>Até seis fotos. Elas aparecem somente no seu perfil, sem curtidas ou comentários.</p>
              </div>
            </div>
            <strong>{memberProfile.galleryPhotos.length}/{MAX_MEMBER_GALLERY_PHOTOS}</strong>
          </header>

          <div className="unifiedMemberGalleryGrid">
            {memberProfile.galleryPhotos.map((photoUrl, index) => (
              <figure key={`${photoUrl}-${index}`}>
                <img src={photoUrl} alt={`Foto ${index + 1} do perfil`} />
                <button type="button" onClick={() => removeMemberGalleryPhoto(index)} disabled={memberProfileSaving}>Remover</button>
              </figure>
            ))}
            {memberProfile.galleryPhotos.length < MAX_MEMBER_GALLERY_PHOTOS ? (
              <label className="unifiedMemberGalleryAdd">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={memberProfileSaving}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length) handleMemberGalleryFiles(files);
                    event.target.value = "";
                  }}
                />
                <PlusCircle aria-hidden="true" />
                <strong>Adicionar fotos</strong>
                <small>Restam {MAX_MEMBER_GALLERY_PHOTOS - memberProfile.galleryPhotos.length}</small>
              </label>
            ) : null}
          </div>
          {memberProfileErrors.galleryPhotos ? <small className="unifiedMemberFieldError">{memberProfileErrors.galleryPhotos}</small> : null}
          <div className="profilePhotosActions">
            <button type="button" className="saveProfileBtn actionConfirmBtn" onClick={saveMemberProfile} disabled={memberProfileSaving || memberProfileStatus === "unavailable"}>
              {memberProfileSaving ? "Salvando..." : "Salvar fotos"}
            </button>
          </div>
        </section>
      </div>
    ) : null}

    {profileSubtab === "conquistas" ? (
      <div className="profileSubtabPanel profileAchievementsPanel">
        <Award aria-hidden="true" />
        <strong>Conquistas</strong>
        <span>Os resultados e títulos reconhecidos pela plataforma aparecerão aqui.</span>
      </div>
    ) : null}
  </section>

  {profileSubtab === "contato" && !profileEditing ? (
  <section className="card organizationAboutOverview">
    <header>
      <div>
        <span>Sobre a organização</span>
        <h2>{organizerProfile.arenaName || "Minha organização"}</h2>
        <p>{memberProfile.bio || "Adicione uma apresentação para atletas e visitantes conhecerem sua organização."}</p>
      </div>
      <button type="button" className="secondaryBtn" onClick={() => setProfileEditing(true)}><Settings aria-hidden="true" /> Editar informações</button>
    </header>
    <div className="organizationAboutGrid">
      <article><UserRound aria-hidden="true" /><span><small>Responsável</small><strong>{organizerProfile.organizerName || "Não informado"}</strong></span></article>
      <article><MapPin aria-hidden="true" /><span><small>Localização</small><strong>{[organizerProfile.city, organizerProfile.state].filter(Boolean).join("/") || "Não informada"}</strong><em>{organizerProfile.address || "Endereço não informado"}</em></span></article>
      <article><MessageCircle aria-hidden="true" /><span><small>Contato público</small><strong>{organizerProfile.whatsapp || "WhatsApp não informado"}</strong></span></article>
      <article><AtSign aria-hidden="true" /><span><small>Instagram</small><strong>{organizerProfile.instagramHandle || "Não informado"}</strong></span></article>
    </div>
    <aside className="organizationPrivateDataNotice">
      <LockKeyhole aria-hidden="true" />
      <span><strong>Dados privados continuam separados</strong><small>Chave Pix, assinatura e informações da conta nunca aparecem para visitantes.</small></span>
    </aside>
  </section>
  ) : null}

  {profileSubtab === "contato" && profileEditing ? (
  <section className="card organizerProfileCard profileEditSubtab profileContactSubtab">
    <div className="profileEditSubtabHeader">
      <div>
        <span>Dados públicos</span>
        <h2>Editar informações da organização</h2>
      </div>
    </div>
    <p className="profileSectionHint">Mantenha atualizados os canais que atletas e outras organizações podem usar para falar com você.</p>

    <div className="profileFormSectionHeader">
      <span><UserRound aria-hidden="true" /></span>
      <div>
        <strong>Identidade</strong>
        <small>Foto e nomes exibidos no perfil da organização.</small>
      </div>
    </div>

    <div className="organizerPhotoArea">
      <label className="organizerPhotoDropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleOrganizerPhotoFile(e.dataTransfer.files?.[0]); }}>
        <input type="file" accept="image/*" onChange={(e) => handleOrganizerPhotoFile(e.target.files?.[0])} />
        <div className="organizerPhotoPreview">
          {organizerProfile.photoUrl ? (
            <img src={organizerProfile.photoUrl} alt="Foto de perfil" />
          ) : (
            <span><Camera aria-hidden="true" /></span>
          )}
        </div>
        <strong>Foto de perfil</strong>
        <small>Clique ou arraste uma imagem aqui</small>
      </label>
      {organizerProfile.photoUrl ? <button className="removePhotoBtn" type="button" onClick={removeOrganizerPhoto}>Remover foto</button> : null}
    </div>

    <section className="unifiedMemberGalleryEditor organizationGalleryEditor" aria-labelledby="organization-gallery-title">
      <header>
        <div>
          <span><Grid3X3 aria-hidden="true" /></span>
          <div>
            <h3 id="organization-gallery-title">Galeria da organização</h3>
            <p>Até seis fotos institucionais. Elas aparecem somente dentro deste perfil, nunca na Visão geral.</p>
          </div>
        </div>
        <strong>{organizationGallery.length}/6</strong>
      </header>
      <div className="unifiedMemberGalleryGrid">
        {organizationGallery.map((photoUrl, index) => (
          <figure key={`${photoUrl}-${index}`}>
            <img src={photoUrl} alt={`Foto ${index + 1} da organização`} />
            <button type="button" onClick={() => removeOrganizationGalleryPhoto(index)} disabled={organizationGallerySaving}>Remover</button>
          </figure>
        ))}
        {organizationGallery.length < 6 ? (
          <label className="unifiedMemberGalleryAdd">
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={organizationGallerySaving || organizationGalleryStatus !== "ready"}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length) handleOrganizationGalleryFiles(files);
                event.target.value = "";
              }}
            />
            <PlusCircle aria-hidden="true" />
            <strong>Adicionar fotos</strong>
            <small>Restam {6 - organizationGallery.length}</small>
          </label>
        ) : null}
      </div>
      <button
        type="button"
        className="saveProfileBtn actionConfirmBtn organizationGallerySaveBtn"
        onClick={saveOrganizationGallery}
        disabled={organizationGallerySaving || organizationGalleryStatus !== "ready"}
        aria-busy={organizationGallerySaving}
      >
        {organizationGallerySaving ? "Salvando galeria..." : "Salvar galeria da organização"}
      </button>
    </section>

    <div className="organizerProfileGrid">
      <div className="formField">
        <label>Organização</label>
        <input value={organizerProfile.arenaName} onChange={(e) => updateOrganizerProfile("arenaName", e.target.value)} placeholder="Nome da sua organização" />
      </div>

      <div className="formField">
        <label>Nome do organizador</label>
        <input value={organizerProfile.organizerName} onChange={(e) => updateOrganizerProfile("organizerName", e.target.value)} placeholder="Ex: Cristiano Sampaio" />
      </div>

      <div className="profileFormSectionHeader fullField">
        <span><MessageCircle aria-hidden="true" /></span>
        <div>
          <strong>Contato público</strong>
          <small>Dados usados pelos atletas para falar com a organização.</small>
        </div>
      </div>

      <div className="formField">
        <label>WhatsApp</label>
        <input value={organizerProfile.whatsapp} onChange={(e) => updateOrganizerProfile("whatsapp", e.target.value)} placeholder="(85) 99999-9999" />
      </div>

      <div className="formField">
        <label>@ do Instagram</label>
        <input value={organizerProfile.instagramHandle} onChange={(e) => updateOrganizerProfile("instagramHandle", e.target.value)} placeholder="@suaarena" />
      </div>

      <div className="formField">
        <label>Link do Instagram</label>
        <input value={organizerProfile.instagramLink} onChange={(e) => updateOrganizerProfile("instagramLink", e.target.value)} placeholder="https://instagram.com/suaarena" />
      </div>

      <div className="formField fullField">
        <label>Link do grupo de WhatsApp</label>
        <input value={organizerProfile.whatsappGroupLink} onChange={(e) => updateOrganizerProfile("whatsappGroupLink", e.target.value)} placeholder="https://chat.whatsapp.com/..." />
      </div>

      <div className="profileFormSectionHeader fullField">
        <span><MapPin aria-hidden="true" /></span>
        <div>
          <strong>Localização</strong>
          <small>Endereço e referência geográfica da organização.</small>
        </div>
      </div>

      <div className="formField fullField">
        <label>Endereço da organização</label>
        <input value={organizerProfile.address} onChange={(e) => updateOrganizerProfile("address", e.target.value)} placeholder="Rua, número, bairro" />
      </div>

      <div className="formField fullField">
        <label>Link do endereço da organização</label>
        <input value={organizerProfile.mapsLink || ""} onChange={(e) => updateOrganizerProfile("mapsLink", e.target.value)} placeholder="Link do Google Maps" />
      </div>

      <div className="formField">
        <label>Estado</label>
        <select
          value={normalizeBrazilianState(organizerProfile.state)}
          onChange={(e) => updateOrganizerState(e.target.value)}
          disabled={profileUsesForeignState}
        >
          <option value="">Selecione o estado</option>
          {BRAZILIAN_STATES.map((state) => (
            <option key={state.code} value={state.code}>{state.name} ({state.code})</option>
          ))}
        </select>
        <label className={`profileForeignStateToggle${normalizeBrazilianState(organizerProfile.state) ? " isDisabled" : ""}`}>
          <input
            type="checkbox"
            checked={profileUsesForeignState}
            disabled={Boolean(normalizeBrazilianState(organizerProfile.state))}
            onChange={(event) => updateForeignStatePreference(event.target.checked)}
          />
          <span>Estado estrangeiro</span>
        </label>
        {profileUsesForeignState ? (
          <input
            className="profileForeignStateInput"
            value={organizerProfile.state}
            onChange={(event) => updateOrganizerProfile("state", event.target.value)}
            placeholder="Digite o estado, província ou região"
            autoComplete="address-level1"
          />
        ) : null}
      </div>

      <div className="formField">
        <label>Cidade</label>
        {profileUsesForeignState ? (
          <input
            value={organizerProfile.city}
            onChange={(e) => updateOrganizerProfile("city", e.target.value)}
            placeholder="Digite a cidade"
            autoComplete="address-level2"
          />
        ) : profileCitiesError ? (
          <>
            <input
              value={organizerProfile.city}
              onChange={(e) => updateOrganizerProfile("city", e.target.value)}
              placeholder="Digite a cidade"
            />
            <small className="profileLocationFeedback error">{profileCitiesError} Você ainda pode digitar a cidade.</small>
          </>
        ) : (
          <select
            value={organizerProfile.city}
            onChange={(e) => updateOrganizerProfile("city", e.target.value)}
            disabled={!normalizeBrazilianState(organizerProfile.state) || profileCitiesLoading}
          >
            <option value="">
              {profileCitiesLoading ? "Carregando cidades..." : "Selecione a cidade"}
            </option>
            {organizerProfile.city && !profileCityOptions.includes(organizerProfile.city) ? (
              <option value={organizerProfile.city}>{organizerProfile.city}</option>
            ) : null}
            {profileCityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        )}
      </div>

      <div className="profileFormSectionHeader fullField">
        <span>🔒</span>
        <div>
          <strong>Dados privados de gestão</strong>
          <small>Não aparecem no perfil público. Nesta homologação ficam somente neste dispositivo.</small>
        </div>
      </div>

      <div className="formField fullField">
        <label>Chave Pix da organização</label>
        <input
          value={organizerProfile.pixKey || ""}
          onChange={(event) => updateOrganizerProfile("pixKey", event.target.value)}
          placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          autoComplete="off"
        />
        <small>Usada futuramente em cobranças e repasses. Nunca será exibida na página pública.</small>
      </div>

    </div>

    <div className="organizationProfileEditActions">
      <button className="secondaryBtn" type="button" onClick={() => setProfileEditing(false)} disabled={profileSaving}>Cancelar</button>
      <button className="saveProfileBtn actionConfirmBtn" type="button" onClick={saveOrganizerProfile} disabled={profileSaving} aria-busy={profileSaving}>{profileSaving ? "Salvando..." : "Salvar alterações"}</button>
    </div>
    {profileSaveSuccess ? (
      <div className="profileSaveMiniNotice" role="status" aria-live="polite">
        ✅ Alterado com sucesso
      </div>
    ) : null}
  </section>
  ) : null}

  {profileSubtab === "conta" ? (
    <div className="profileAccountGrid">
      <section className="card profileAccountCard">
        <div className="profileSectionHeading">
          <span>Conta</span>
          <h2>Acesso e assinatura</h2>
          <p>Informações privadas da sua conta na plataforma.</p>
        </div>

        <dl className="profileAccountDetails">
          <div>
            <dt>E-mail de acesso</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Plano</dt>
            <dd>{profile.plan}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatStatusBR(profile.status)}</dd>
          </div>
          <div>
            <dt>Vencimento</dt>
            <dd>{profile.expires_at ? formatDateBR(profile.expires_at) : "Não definido"}</dd>
          </div>
        </dl>
      </section>

      <section className="card profileSupportCard" id="suporte-torneio360">
        <div className="profileSectionHeading">
          <span>Atendimento</span>
          <h2>Fale com o Torneio360</h2>
          <p>Escolha o canal de sua preferência para receber suporte.</p>
        </div>

        <PlatformSupportLinks />
      </section>

      {HomologationLoadLab
        && HOMOLOGATION_LOAD_LAB_ENABLED
        && String(user.email || "").trim().toLowerCase() === "torneio360@gmail.com" ? (
        <React.Suspense fallback={<section className="card"><p>Carregando laboratório de homologação...</p></section>}>
          <HomologationLoadLab supabase={supabase} user={user} />
        </React.Suspense>
      ) : null}
    </div>
  ) : null}
</>
)}



        </main>
      </div>
    </div>
  );
}


function TournamentScreen({
  tournament,
  openTournaments = [],
  centralCourtNumbers = [],
  centralUnavailableCourtNumbers = [],
  venueCourtUsages = [],
  preferredCourtNumbers = [],
  userId,
  onBack,
  onSave,
  onNavigationStateChange,
  onRegisterNavigationGuard,
  onManageCircuits,
  circuitMembershipCount = 0,
  arenaGenderRegistry = {},
  onOpenCourtCenter,
  onRegisterCentralCourtNumber,
  onCourtUsagesChange,
}) {
  const config = modalityConfig[tournament.type];

  if (!config) {
    return (
      <div className="playAppShell">
        <main className="playMain">
          <section className="card">
            <h1>Modalidade não reconhecida</h1>
            <p>Este torneio usa uma modalidade que não existe mais na versão atual da plataforma.</p>
            <div className="actions">
              <button type="button" onClick={onBack}>Voltar aos torneios</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const initialTournamentState = useMemo(() => {
    const draft = readTournamentDraft(userId, tournament);
    const sourceData = draft?.data || tournament.data;
    const normalizedData = normalizeTournamentData(tournament.type, sourceData);
    const playRankingMigration = migratePlayRankingBracketForReferenceProfile(tournament, normalizedData);
    const effectiveData = playRankingMigration.data;
    const repairNeeded = Boolean(draft)
      || needsTournamentDataRepair(tournament.type, tournament.data)
      || playRankingMigration.applied;
    const repairIsSafe = playRankingMigration.applied
      || preservesTournamentCriticalData(sourceData || {}, effectiveData);
    return {
      data: effectiveData,
      recoveredDraft: Boolean(draft),
      baseUpdatedAt: draft?.baseUpdatedAt || tournament.updated_at || null,
      baseRevision: draft?.baseRevision ?? getCollaborationRevision(tournament),
      baseData: draft?.baseData || tournament.data || {},
      shouldPersistRepair: repairNeeded && repairIsSafe,
      unsafeRepairDetected: repairNeeded && !repairIsSafe,
      allowScoreRegression: draft?.allowScoreRegression === true || playRankingMigration.applied,
      playRankingMigration,
    };
  }, [tournament.id, tournament.type, userId]);
  const initialDataWasRepairedRef = useRef(
    initialTournamentState.shouldPersistRepair
  );

  const [data, setDataState] = useState(() => initialTournamentState.data);
  const currentCourtCount = getTournamentCourtCount(config, data);
  const normalizedCentralCourtNumbers = Array.from(new Set(
    (centralCourtNumbers || []).map(normalizeCourtNumberValue).filter(Boolean)
  ));
  const normalizedPreferredCourtNumbers = Array.from(new Set(
    (preferredCourtNumbers || [])
      .map(normalizeCourtNumberValue)
      .filter((number) => number && normalizedCentralCourtNumbers.includes(number))
  ));
  const operationalCourtNumbers = normalizedCentralCourtNumbers.length
    ? Array.from(new Set([...normalizedPreferredCourtNumbers, ...normalizedCentralCourtNumbers]))
    : normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
  const displayedCourtNumbers = normalizedPreferredCourtNumbers.length
    ? normalizeCourtNumbers(
        [...normalizedPreferredCourtNumbers, ...(data.courtNumbers || [])],
        currentCourtCount
      )
    : normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
  const unavailableCentralCourtNumbers = new Set(
    (centralUnavailableCourtNumbers || []).map(normalizeCourtNumberValue).filter(Boolean)
  );
  const participantAttendanceEntries = getParticipantAttendanceEntries(config, data);
  const pendingParticipantEntries = participantAttendanceEntries.filter((entry) => !entry.confirmed);

  const [savingStatus, setSavingStatus] = useState(initialTournamentState.recoveredDraft ? "Pendente de sincronização" : "Salvo na nuvem");
  const [shuffleOverlay, setShuffleOverlay] = useState(null);
  const [shuffleVideoSnapshot, setShuffleVideoSnapshot] = useState(null);
  const [tieBreakDraw, setTieBreakDraw] = useState(null);
  const [notice, setNotice] = useState(null);
  const [regenerationConfirm, setRegenerationConfirm] = useState(null);
  const [clearScoresOpen, setClearScoresOpen] = useState(false);
  const [clearTableOpen, setClearTableOpen] = useState(false);
  const [participantImportOpen, setParticipantImportOpen] = useState(false);
  const [participantImportBackup, setParticipantImportBackup] = useState(null);
  const [courtEditor, setCourtEditor] = useState(null);
  const [courtDuplicateConfirm, setCourtDuplicateConfirm] = useState(null);
  const [courtOccupancyConflict, setCourtOccupancyConflict] = useState(null);
  const [participantOccupancyConflict, setParticipantOccupancyConflict] = useState(null);
  const [courtConfigRevision, setCourtConfigRevision] = useState(0);
  const [shareLoading, setShareLoading] = useState(false);
  const [headerDetailsOpen, setHeaderDetailsOpen] = useState(false);

  const [shareInfo, setShareInfo] = useState({
    public_id: tournament.public_id || null,
    is_public: tournament.is_public || false,
  });

  const [voiceRepeat, setVoiceRepeat] = useState(1);
  const [activeTournamentTab, setActiveTournamentTabState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "participantes";
  });
  const [activeMatchesTab, setActiveMatchesTabState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("partidas") || "grupos";
  });
  const supportsTournamentFormatConfiguration = isCupType(config) || isFlexibleSimpleType(config) || isReizinhoType(config);
  const [activeOrganizationTab, setActiveOrganizationTab] = useState(() => (
    supportsTournamentFormatConfiguration ? "formato" : "participantes"
  ));

  useEffect(() => {
    if (!supportsTournamentFormatConfiguration && activeOrganizationTab === "formato") {
      setActiveOrganizationTab("participantes");
    }
  }, [supportsTournamentFormatConfiguration, activeOrganizationTab]);

  async function updateTournamentUrl(next = {}) {
    const params = new URLSearchParams(window.location.search);
    params.set("aba", "criar");
    params.set("torneio", tournament.id);
    params.set("tab", next.activeTournamentTab || activeTournamentTab);
    params.set("partidas", next.activeMatchesTab || activeMatchesTab);
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);

    if (onNavigationStateChange) {
      onNavigationStateChange({
        tournamentId: tournament.id,
        tournamentTab: params.get("tab"),
        matchesTab: params.get("partidas"),
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_app_state").upsert({
        user_id: tournament.user_id,
        last_url: nextUrl,
        last_panel: "criar",
        last_tournament_id: tournament.id,
        last_tournament_tab: params.get("tab"),
        last_matches_tab: params.get("partidas"),
        scroll_y: Math.max(0, Math.round(window.scrollY || 0)),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (error) console.error("Erro ao salvar posição do torneio", error);
    } catch (error) {
      console.error("Erro ao salvar posição do torneio", error);
    }
  }

  function setActiveTournamentTab(tab) {
    setActiveTournamentTabState(tab);
    updateTournamentUrl({ activeTournamentTab: tab });
  }

  function setActiveMatchesTab(tab) {
    setActiveMatchesTabState(tab);
    updateTournamentUrl({ activeMatchesTab: tab });
  }

  useEffect(() => {
    updateTournamentUrl();
  }, []);

  useEffect(() => {
    if (activeMatchesTab === "paralela" && !isCearenseSecondParallelEnabled(data)) {
      setActiveMatchesTab("chaves");
    } else if (activeMatchesTab === "paralela3" && !isCearenseThirdParallelEnabled(data)) {
      setActiveMatchesTab("chaves");
    }
  }, [
    activeMatchesTab,
    data.cupConfig?.secondRepechageEnabled,
    data.cupConfig?.thirdRepechageEnabled,
  ]);

  const saveTimerRef = useRef(null);
  const latestDataRef = useRef(data);
  const dataVersionRef = useRef(0);
  const unsafeRepairDetectedRef = useRef(initialTournamentState.unsafeRepairDetected);
  const hasUnsavedChangesRef = useRef(initialDataWasRepairedRef.current);
  const saveQueueRef = useRef(Promise.resolve(true));
  const serverUpdatedAtRef = useRef(initialTournamentState.baseUpdatedAt);
  const serverRevisionRef = useRef(initialTournamentState.baseRevision);
  const baseTournamentDataRef = useRef(initialTournamentState.baseData);
  const saveRetryTimerRef = useRef(null);
  const saveRetryAttemptRef = useRef(0);
  const submittedChangesRef = useRef(new Map());
  const lastConfirmedDataVersionRef = useRef(-1);
  const localBackupStateRef = useRef({ version: -1, saved: true });
  const allowScoreRegressionRef = useRef(initialTournamentState.allowScoreRegression);
  const offlineNoticeShownRef = useRef(false);
  const tournamentScreenMountedRef = useRef(true);
  const onSaveRef = useRef(onSave);
  const tournamentRef = useRef(tournament);
  const shuffleAnimationTimerRef = useRef(null);
  const shuffleCountdownTimerRef = useRef(null);
  const tieBreakDrawTimerRef = useRef(null);

  useEffect(() => {
    if (typeof onCourtUsagesChange !== "function") return;
    onCourtUsagesChange(
      tournament.id,
      getTournamentActiveCourtUsages({ ...tournament, data }, data)
    );
  }, [data, tournament.id]);

  useEffect(() => () => {
    if (typeof onCourtUsagesChange === "function") onCourtUsagesChange(tournament.id, null);
  }, [tournament.id]);

  function getOfflineBackupStatus() {
    const backupState = localBackupStateRef.current;
    if (backupState.version !== dataVersionRef.current || backupState.saved === null) {
      return "Guardando neste aparelho...";
    }
    return backupState.saved ? "Salvo neste aparelho" : "Falha no backup local";
  }

  function showOfflineNoticeOnce() {
    if (offlineNoticeShownRef.current) return;
    offlineNoticeShownRef.current = true;
    showNotice(
      "warning",
      "Você está sem internet",
      "As alterações ficam guardadas neste aparelho e serão sincronizadas automaticamente quando a conexão voltar."
    );
  }

  function setData(nextValue, { allowScoreRegression = false } = {}) {
    if (unsafeRepairDetectedRef.current) {
      setNotice({
        type: "warning",
        title: "Edição temporariamente protegida",
        message: "Nenhum dado foi sobrescrito. Entre em contato com o suporte para recuperar este formato antes de continuar editando.",
      });
      return;
    }

    const currentData = latestDataRef.current;
    const nextData = typeof nextValue === "function" ? nextValue(currentData) : nextValue;
    if (!nextData || Object.is(nextData, currentData)) return;

    latestDataRef.current = nextData;
    dataVersionRef.current += 1;
    const draftVersion = dataVersionRef.current;
    localBackupStateRef.current = { version: draftVersion, saved: null };
    hasUnsavedChangesRef.current = true;
    allowScoreRegressionRef.current = allowScoreRegressionRef.current || allowScoreRegression;
    const localBackup = saveTournamentDraft(
      userId,
      tournamentRef.current,
      nextData,
      serverUpdatedAtRef.current,
      baseTournamentDataRef.current,
      serverRevisionRef.current,
      { allowScoreRegression: allowScoreRegressionRef.current }
    );
    setDataState(nextData);
    if (typeof onCourtUsagesChange === "function") {
      onCourtUsagesChange(
        tournament.id,
        getTournamentActiveCourtUsages({ ...tournament, data: nextData }, nextData)
      );
    }
    setSavingStatus(isBrowserOffline() ? "Guardando neste aparelho..." : "Salvando...");
    if (isBrowserOffline()) showOfflineNoticeOnce();
    void localBackup.then((saved) => {
      if (!tournamentScreenMountedRef.current) return;
      if (localBackupStateRef.current.version !== draftVersion) return;
      localBackupStateRef.current = { version: draftVersion, saved };
      if (isBrowserOffline()) setSavingStatus(getOfflineBackupStatus());
      else if (!saved) setSavingStatus("Falha no backup local");
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current, {
        allowScoreRegression: allowScoreRegressionRef.current,
      });
    }, 500);
  }

  useEffect(() => {
    const remainingMilliseconds = getNextMatchTimerExpiryDelay(data);
    if (remainingMilliseconds === null) return undefined;

    const timeoutId = window.setTimeout(() => {
      const result = capExpiredTournamentMatchTimers(latestDataRef.current);
      if (result.cappedCount === 0) return;
      setData(result.data);
      showNotice(
        "warning",
        result.cappedCount === 1 ? "Cronômetro limitado a 59 minutos" : "Cronômetros limitados a 59 minutos",
        result.cappedCount === 1
          ? "O jogo deixou de ficar em andamento. O placar e o confronto foram preservados."
          : `${result.cappedCount} jogos deixaram de ficar em andamento. Placares e confrontos foram preservados.`
      );
    }, Math.max(0, Math.ceil(remainingMilliseconds)) + 25);

    return () => window.clearTimeout(timeoutId);
  }, [data]);

  function clearShuffleTimers() {
    if (shuffleAnimationTimerRef.current) clearInterval(shuffleAnimationTimerRef.current);
    if (shuffleCountdownTimerRef.current) clearInterval(shuffleCountdownTimerRef.current);
    shuffleAnimationTimerRef.current = null;
    shuffleCountdownTimerRef.current = null;
  }

  function clearTieBreakDrawTimer() {
    if (tieBreakDrawTimerRef.current) clearInterval(tieBreakDrawTimerRef.current);
    tieBreakDrawTimerRef.current = null;
  }

  function clearSaveRetryTimer() {
    if (saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current);
    saveRetryTimerRef.current = null;
  }

  function scheduleSaveRetry() {
    if (saveRetryTimerRef.current) return;
    if (isBrowserOffline()) {
      setSavingStatus(getOfflineBackupStatus());
      return;
    }

    const delays = [2000, 5000, 10000, 20000, 30000];
    const delay = delays[Math.min(saveRetryAttemptRef.current, delays.length - 1)];
    saveRetryAttemptRef.current += 1;
    saveRetryTimerRef.current = setTimeout(() => {
      saveRetryTimerRef.current = null;
      if (!hasUnsavedChangesRef.current) return;
      setSavingStatus("Tentando sincronizar...");
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current, {
        allowScoreRegression: allowScoreRegressionRef.current,
      });
    }, delay);
  }

  function queueTournamentSave(
    snapshot,
    version,
    { updateStatus = true, allowScoreRegression = allowScoreRegressionRef.current } = {}
  ) {
    const queuedBaseData = baseTournamentDataRef.current;
    const queuedBaseRevision = serverRevisionRef.current;
    const queuedBaseUpdatedAt = serverUpdatedAtRef.current;
    const changeId = generateCollaborationChangeId();

    const runSave = async () => {
      try {
        if (version <= lastConfirmedDataVersionRef.current) {
          return {
            ok: true,
            tournament: tournamentRef.current,
            savedData: baseTournamentDataRef.current,
            savedIsCurrent: true,
            superseded: true,
          };
        }

        let dataToPersist = snapshot;
        let attemptBaseData = queuedBaseData;
        let expectedRevision = queuedBaseRevision;
        let expectedUpdatedAt = queuedBaseUpdatedAt;
        const currentRevision = serverRevisionRef.current;
        const baseChangedWhileQueued = currentRevision !== null && queuedBaseRevision !== null
          ? currentRevision !== queuedBaseRevision
          : expectedUpdatedAt !== serverUpdatedAtRef.current;

        if (baseChangedWhileQueued) {
          dataToPersist = mergeConcurrentTournamentData(
            queuedBaseData || {},
            snapshot,
            baseTournamentDataRef.current || {}
          ).data;
          attemptBaseData = baseTournamentDataRef.current;
          expectedRevision = serverRevisionRef.current;
          expectedUpdatedAt = serverUpdatedAtRef.current;
        }

        submittedChangesRef.current.set(changeId, { version, data: dataToPersist });

        for (let attempt = 0; attempt < 5; attempt += 1) {
          let result = await onSaveRef.current({
            ...tournamentRef.current,
            data: dataToPersist,
            scoreSafetyBaseData: attemptBaseData,
            allowScoreRegression,
            revision: expectedRevision,
            updated_at: expectedUpdatedAt,
            changeId,
          });

          if (result?.ok && result.tournament) {
            lastConfirmedDataVersionRef.current = Math.max(lastConfirmedDataVersionRef.current, version);
            const currentServer = tournamentRef.current;
            const savedIsCurrent = !currentServer
              || compareCollaborationVersions(result.tournament, currentServer) >= 0;
            if (savedIsCurrent) {
              tournamentRef.current = result.tournament;
              serverRevisionRef.current = getCollaborationRevision(result.tournament);
              serverUpdatedAtRef.current = result.tournament.updated_at || serverUpdatedAtRef.current;
              baseTournamentDataRef.current = result.tournament.data || dataToPersist;
            }
            return { ...result, savedData: dataToPersist, savedIsCurrent };
          }

          if (!result?.conflict || !result.serverTournament?.data) return result;

          if (tournamentScreenMountedRef.current) {
            setSavingStatus("Sincronizando a alteração mais recente...");
          }
          const remoteTournament = compareCollaborationVersions(
            result.serverTournament,
            tournamentRef.current
          ) >= 0
            ? result.serverTournament
            : tournamentRef.current;
          dataToPersist = mergeConcurrentTournamentData(
            attemptBaseData || {},
            dataToPersist,
            remoteTournament.data || {}
          ).data;
          submittedChangesRef.current.set(changeId, { version, data: dataToPersist });
          attemptBaseData = remoteTournament.data || {};
          tournamentRef.current = remoteTournament;
          serverRevisionRef.current = getCollaborationRevision(remoteTournament);
          serverUpdatedAtRef.current = remoteTournament.updated_at || null;
          baseTournamentDataRef.current = attemptBaseData;
          expectedRevision = serverRevisionRef.current;
          expectedUpdatedAt = serverUpdatedAtRef.current;
        }

        return { ok: false, retryable: true, conflict: true };
      } catch (error) {
        console.error("Erro inesperado ao salvar o torneio:", error);
        return { ok: false, error, retryable: isRetryableConnectionError(error) };
      }
    };

    const queuedSave = saveQueueRef.current.then(runSave, runSave);
    saveQueueRef.current = queuedSave.then(() => true, () => false);

    return queuedSave.then(async (rawResult) => {
      const result = rawResult === true ? { ok: true } : (rawResult || { ok: false });
      let ok = result.ok === true;
      const isLatestVersion = version === dataVersionRef.current;
      let confirmedByRealtime = isLatestVersion && (
        lastConfirmedDataVersionRef.current >= version
        || !hasUnsavedChangesRef.current
      );

      // Em outro dispositivo/rede, o evento Realtime pode confirmar o UPDATE
      // imediatamente antes da resposta HTTP chegar. Mantemos o changeId por
      // tempo suficiente para reconhecer essa confirmação como nossa própria
      // gravação e evitamos o falso aviso de erro.
      if (!ok && isLatestVersion && !confirmedByRealtime) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        confirmedByRealtime = lastConfirmedDataVersionRef.current >= version
          || !hasUnsavedChangesRef.current;
      }
      if (confirmedByRealtime) ok = true;

      setTimeout(() => {
        const pendingChange = submittedChangesRef.current.get(changeId);
        if (pendingChange?.version === version) submittedChangesRef.current.delete(changeId);
      }, 15000);

      if (ok && isLatestVersion) {
        // Quando o Realtime já confirmou, ele também já aplicou os dados mais
        // recentes. Não voltamos a aplicar um snapshot antigo sobre a tela.
        if (result.ok === true) {
          const confirmedTournament = result.savedIsCurrent === false
            ? tournamentRef.current
            : result.tournament;
          const normalizedSavedData = normalizeTournamentData(
            confirmedTournament?.type || tournament.type,
            confirmedTournament?.data || result.savedData || snapshot
          );
          latestDataRef.current = normalizedSavedData;
          setDataState(normalizedSavedData);
          hasUnsavedChangesRef.current = false;
          allowScoreRegressionRef.current = false;
          clearTournamentDraft(userId, tournament.id);
          clearSaveRetryTimer();
          saveRetryAttemptRef.current = 0;
        }
      }

      if (!ok && (result.retryable || result.conflict) && isLatestVersion) {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current,
          { allowScoreRegression: allowScoreRegressionRef.current }
        );
        scheduleSaveRetry();
      }

      if (updateStatus && isLatestVersion && tournamentScreenMountedRef.current) {
        if (ok) setSavingStatus("Salvo na nuvem");
        else if (result.retryable || result.conflict || result.offline) setSavingStatus(isBrowserOffline() ? getOfflineBackupStatus() : "Sincronização pendente");
        else setSavingStatus("Erro ao salvar");
      }
      return ok;
    });
  }

  const ranking = useMemo(
    () => calculateRanking(data, tournament.type, data.rankingCriteria),
    [data, tournament.type]
  );

  const cupGroupRankings = useMemo(
    () => isCupType(config) && (data.groupsShuffled || data.schedule?.length > 0)
      ? calculateCupGroupRankings(data, data.rankingCriteria)
      : [],
    [data, config.type]
  );

  const copinhaGroupCampaignTies = useMemo(
    () => isCopinhaData(data) && data.schedule?.length > 0
      ? getCopinhaSeededGroups(data).unresolvedGroupTies
      : [],
    [data, config.type]
  );

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const submittedChange = tournament.last_change_id
      ? submittedChangesRef.current.get(tournament.last_change_id)
      : null;
    const ownSubmission = submittedChange
      && tournamentMutationDataEquals(submittedChange.data, tournament.data)
      ? submittedChange
      : null;
    if (submittedChange && !ownSubmission) {
      submittedChangesRef.current.delete(tournament.last_change_id);
    }
    const incomingIsNewer = compareCollaborationVersions(tournament, tournamentRef.current) > 0;

    if (ownSubmission) {
      submittedChangesRef.current.delete(tournament.last_change_id);
      if (incomingIsNewer) {
        serverRevisionRef.current = getCollaborationRevision(tournament);
        serverUpdatedAtRef.current = tournament.updated_at || null;
        baseTournamentDataRef.current = tournament.data || {};
        tournamentRef.current = tournament;
      }

      if (ownSubmission.version === dataVersionRef.current) {
        lastConfirmedDataVersionRef.current = Math.max(
          lastConfirmedDataVersionRef.current,
          ownSubmission.version
        );
        const confirmedData = normalizeTournamentData(tournament.type, tournament.data);
        latestDataRef.current = confirmedData;
        setDataState(confirmedData);
        hasUnsavedChangesRef.current = false;
        allowScoreRegressionRef.current = false;
        clearTournamentDraft(userId, tournament.id);
        clearSaveRetryTimer();
        saveRetryAttemptRef.current = 0;
        setSavingStatus("Salvo na nuvem");
      } else if (hasUnsavedChangesRef.current) {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current,
          { allowScoreRegression: allowScoreRegressionRef.current }
        );
      }
      return;
    }

    if (!incomingIsNewer) return;

    if (hasUnsavedChangesRef.current) {
      const merged = mergeConcurrentTournamentData(
        baseTournamentDataRef.current,
        latestDataRef.current,
        tournament.data || {}
      );
      serverRevisionRef.current = getCollaborationRevision(tournament);
      serverUpdatedAtRef.current = tournament.updated_at || null;
      baseTournamentDataRef.current = tournament.data || {};
      tournamentRef.current = tournament;
      const mergedData = normalizeTournamentData(tournament.type, merged.data);

      if (!tournamentDataEquals(mergedData, latestDataRef.current)) {
        setSavingStatus("Sincronizando a alteração mais recente...");
        setData(mergedData);
      } else {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current,
          { allowScoreRegression: allowScoreRegressionRef.current }
        );
      }
      return;
    }

    serverRevisionRef.current = getCollaborationRevision(tournament);
    serverUpdatedAtRef.current = tournament.updated_at || null;
    baseTournamentDataRef.current = tournament.data || {};
    tournamentRef.current = tournament;
    const incomingData = normalizeTournamentData(tournament.type, tournament.data);
    latestDataRef.current = incomingData;
    setDataState(incomingData);
    setSavingStatus("Atualizado de outro dispositivo");
  }, [tournament.revision, tournament.updated_at, tournament.last_change_id]);

  useEffect(() => {
    const handleOnline = () => {
      offlineNoticeShownRef.current = false;
      if (!hasUnsavedChangesRef.current) return;
      clearSaveRetryTimer();
      setSavingStatus("Sincronizando...");
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current, {
        allowScoreRegression: allowScoreRegressionRef.current,
      });
    };
    const handleOffline = () => {
      if (!hasUnsavedChangesRef.current) return;
      setSavingStatus(getOfflineBackupStatus());
      showOfflineNoticeOnce();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const cearenseCampaignTies = useMemo(() => {
    if (!isCearenseData(data) || !data.schedule?.length) return [];
    if (!data.schedule.flat().every((game) => isGameFinished(game, getWinningScore(data)))) return [];

    const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
    if (groupRankings.some((group) => group.unresolvedTieIds?.length > 1)) return [];

    return getCearenseQualified(data).unresolvedCampaignTies;
  }, [data, config.type]);

  useEffect(() => {
    if (initialTournamentState.recoveredDraft) return undefined;
    let cancelled = false;

    async function hydrateDurableDraft() {
      const pendingDrafts = await listPendingTournaments(userId);
      if (cancelled) return;
      const durableDraft = pendingDrafts.find((draft) => (
        String(draft.tournamentId) === String(tournament.id) && draft?.data
      ));
      if (!durableDraft) return;

      const normalizedDraft = normalizeTournamentData(tournament.type, durableDraft.data);
      if (!preservesTournamentCriticalData(durableDraft.data, normalizedDraft)) {
        unsafeRepairDetectedRef.current = true;
        setNotice({
          type: "warning",
          title: "Backup local protegido",
          message: "Há uma cópia local em formato inesperado. Nenhuma gravação automática será feita para evitar reduzir nomes, jogos ou placares.",
        });
        return;
      }

      if (tournamentMutationDataEquals(normalizedDraft, baseTournamentDataRef.current)) {
        clearTournamentDraft(userId, tournament.id);
        return;
      }

      const recoveredData = hasUnsavedChangesRef.current
        ? mergeConcurrentTournamentData(
            durableDraft.baseData || {},
            latestDataRef.current,
            normalizedDraft
          ).data
        : mergeConcurrentTournamentData(
            durableDraft.baseData || {},
            normalizedDraft,
            baseTournamentDataRef.current || {}
          ).data;
      unsafeRepairDetectedRef.current = false;
      setSavingStatus("Recuperando backup deste aparelho...");
      setData(normalizeTournamentData(tournament.type, recoveredData), {
        allowScoreRegression: durableDraft.allowScoreRegression === true,
      });
    }

    void hydrateDurableDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    tournamentScreenMountedRef.current = false;
    clearShuffleTimers();
    clearTieBreakDrawTimer();
    clearSaveRetryTimer();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (hasUnsavedChangesRef.current) {
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current, {
        updateStatus: false,
        allowScoreRegression: allowScoreRegressionRef.current,
      });
    }
  }, []);

  useEffect(() => {
    if (!initialTournamentState.unsafeRepairDetected) return;
    setNotice({
      type: "warning",
      title: "Dados antigos protegidos",
      message: "A plataforma encontrou um formato inesperado e bloqueou qualquer gravação automática que pudesse reduzir nomes, jogos ou placares.",
    });
  }, []);

  useEffect(() => {
    const migration = initialTournamentState.playRankingMigration;
    if (migration?.blocked) {
      setNotice({
        type: "warning",
        title: "Sorteio necessário antes da nova chave",
        message: "A chave antiga foi preservada. Resolva o desempate indicado na aba Grupos para aplicar a estrutura oficial do Modelo Torneio 360.",
      });
      return;
    }
    if (!migration?.applied || migration.pendingScores <= 0) return;
    setNotice({
      type: "success",
      title: "Estrutura oficial aplicada",
      message: `${migration.preservedScores} placar(es) de confrontos idênticos foram mantidos. Os outros ${migration.pendingScores} permanecem protegidos no backup da chave anterior.`,
    });
  }, []);

  useEffect(() => {
    if (!initialDataWasRepairedRef.current) return undefined;

    let cancelled = false;

    async function persistRecoveredData() {
      saveTournamentDraft(
        userId,
        tournamentRef.current,
        latestDataRef.current,
        serverUpdatedAtRef.current,
        baseTournamentDataRef.current,
        serverRevisionRef.current,
        { allowScoreRegression: allowScoreRegressionRef.current }
      );
      setSavingStatus("Recuperando dados...");
      const ok = await queueTournamentSave(data, dataVersionRef.current, {
        updateStatus: false,
        allowScoreRegression: allowScoreRegressionRef.current,
      });

      if (!cancelled) {
        setSavingStatus(ok ? "Dados recuperados" : "Erro ao recuperar dados");
      }
    }

    persistRecoveredData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function flushPendingTournamentSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;

    if (hasUnsavedChangesRef.current) {
      setSavingStatus("Salvando antes de sair...");
      const ok = await queueTournamentSave(
        latestDataRef.current,
        dataVersionRef.current,
        {
          updateStatus: false,
          allowScoreRegression: allowScoreRegressionRef.current,
        }
      );

      if (!ok) {
        const confirmedAfterQueue = lastConfirmedDataVersionRef.current >= dataVersionRef.current
          || !hasUnsavedChangesRef.current;
        if (confirmedAfterQueue) {
          setSavingStatus("Salvo na nuvem");
          return true;
        }
        setSavingStatus(isBrowserOffline() ? getOfflineBackupStatus() : "Sincronização pendente");
        if (isBrowserOffline()) showOfflineNoticeOnce();

        // A cópia local durável já foi criada por setData/queueTournamentSave.
        // Portanto, uma falha temporária ou uma edição feita em outro dispositivo
        // não deve prender o organizador nesta tela. A fila volta a sincronizar
        // automaticamente sem descartar placares, confrontos ou rankings.
        return true;
      }
    }

    return true;
  }

  useEffect(() => {
    if (typeof onRegisterNavigationGuard !== "function") return undefined;
    onRegisterNavigationGuard(flushPendingTournamentSave);
    return () => onRegisterNavigationGuard(null);
  }, []);

  async function handleBack() {
    const canLeave = await flushPendingTournamentSave();
    if (!canLeave) return;

    onBack();
  }

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  async function enablePublicShare() {
    if (isBrowserOffline()) {
      showNotice("warning", "Sem internet", "Reconecte-se para ativar e confirmar o link público na nuvem.");
      return;
    }
    setShareLoading(true);

    const publicId = shareInfo.public_id || generatePublicId();

    const { error } = await supabase
      .from("tournaments")
      .update({
        public_id: publicId,
        is_public: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", userId);

    setShareLoading(false);

    if (error) {
      console.error(error);
      showNotice("error", "Erro ao gerar link", "Não foi possível ativar o link público.");
      return;
    }

    const nextInfo = {
      public_id: publicId,
      is_public: true,
    };

    setShareInfo(nextInfo);

    const ok = await copyToClipboard(getPublicShareMessage(publicId));

    showNotice(
      "success",
      "Link público ativado",
      ok
        ? "A mensagem com o link foi ativada e copiada para a área de transferência."
        : "O link foi ativado. Copie o link na área de compartilhamento."
    );
  }

  async function disablePublicShare() {
    if (!shareInfo.public_id) return;
    if (isBrowserOffline()) {
      showNotice("warning", "Sem internet", "Reconecte-se para desativar o link público com segurança.");
      return;
    }

    setShareLoading(true);

    const { error } = await supabase
      .from("tournaments")
      .update({
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", userId);

    setShareLoading(false);

    if (error) {
      console.error(error);
      showNotice("error", "Erro ao desativar", "Não foi possível desativar o link público.");
      return;
    }

    setShareInfo((prev) => ({
      ...prev,
      is_public: false,
    }));

    showNotice("success", "Link desativado", "O link público foi desativado.");
  }

  async function sharePublicLink() {
    const url = getArenaPublicUrl(userId);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: tournament.name || "Torneio 360",
          text: "Acompanhe os torneios e circuitos desta arena no Torneio360.",
          url,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const ok = await copyToClipboard(url);
    showNotice(
      ok ? "success" : "error",
      ok ? "Link pronto para compartilhar" : "Erro ao compartilhar",
      ok ? "O navegador não abriu o compartilhamento, então copiamos o link para você." : "Não foi possível compartilhar o link."
    );
  }

  function updateRankingCriteria(value) {
    setData((prev) => {
      const copy = { ...prev, rankingCriteria: value };

      if (isCearenseData(copy)) {
        copy.brackets = [];
        resetCopinhaTieBreaks(copy);
      }

      return copy;
    }, { allowScoreRegression: true });
  }

  function updateCupConfig(field, value) {
    setParticipantImportBackup(null);
    setData((prev) => {
      const copy = structuredClone(prev);

      copy.cupConfig = {
        ...(copy.cupConfig || {}),
        [field]: value,
      };

      if (field === "teamCount") {
        const teamCount = Number(value);
        copy.cupConfig.teamCount = teamCount;
        if (isSunsetData(copy) && teamCount % 4 !== 0) {
          copy.cupConfig.groupFormation = "automatic";
        }
        const previousPlayers = structuredClone(copy.players);
        const nextTeams = Array.from({ length: teamCount }, (_, i) => {
          return copy.players.teams[i] || {
            a: isIndividualCupType(config) ? `Jogador ${i + 1}` : `Atleta 1 da dupla ${i + 1}`,
            b: isIndividualCupType(config) ? "" : `Atleta 2 da dupla ${i + 1}`,
          };
        });
        copy.players.teams = nextTeams;
        copy.participantAttendance = reconcileParticipantAttendance(
          config,
          previousPlayers,
          copy.players,
          copy.participantAttendance
        );

        copy.schedule = [];
        copy.brackets = [];
        copy.groupsShuffled = false;
        delete copy.lastShuffleVideo;
        resetCopinhaTieBreaks(copy);
      }

      if (field === "groupFormation") {
        copy.schedule = [];
        copy.brackets = [];
        copy.groupsShuffled = false;
        delete copy.lastShuffleVideo;
        resetCopinhaTieBreaks(copy);
      }

      return copy;
    }, { allowScoreRegression: true });
  }

  function applySimplePlayerCount(value) {
    const playerCount = Number(value);
    if (!isFlexibleSimpleType(config) || !config.allowedPlayerCounts.includes(playerCount)) return;

    setParticipantImportBackup(null);
    setData((prev) => {
      const copy = structuredClone(prev);
      const previousPlayers = structuredClone(copy.players);
      copy.simplePlayerCount = playerCount;
      copy.players = Array.from({ length: playerCount }, (_, index) => (
        copy.players?.[index] || `${config.label} ${index + 1}`
      ));
      copy.participantAttendance = reconcileParticipantAttendance(
        config,
        previousPlayers,
        copy.players,
        copy.participantAttendance
      );
      copy.schedule = [];
      copy.namesShuffled = false;
      delete copy.lastShuffleVideo;
      copy.courtNumbers = normalizeCourtNumbers(copy.courtNumbers, playerCount / 2);
      return copy;
    }, { allowScoreRegression: true });
    setCourtConfigRevision((revision) => revision + 1);
    showNotice(
      "success",
      "Quantidade atualizada",
      `${playerCount} jogadores selecionados. Cada atleta enfrentará os outros ${playerCount - 1} uma vez.`
    );
  }

  function requestSimplePlayerCount(value) {
    const playerCount = Number(value);
    if (playerCount === getSimplePlayerCount(config, data)) return;

    if (!data.schedule?.length) {
      applySimplePlayerCount(playerCount);
      return;
    }

    setRegenerationConfirm({
      action: "simple-player-count",
      playerCount,
      title: "Alterar a quantidade de jogadores?",
      message: `O torneio passará a ter ${playerCount} jogadores no formato todos contra todos.`,
      impacts: [
        "As rodadas, os jogos e os placares atuais serão apagados.",
        "Os nomes que ainda couberem nas novas vagas serão preservados.",
        "Será necessário criar novamente as rodadas e os jogos.",
      ],
      confirmLabel: "Alterar e recriar os jogos",
    });
  }

  function applyReizinhoPlayerCount(value) {
    const playerCount = Number(value);
    if (!isReizinhoType(config) || !config.allowedPlayerCounts.includes(playerCount)) return;

    setParticipantImportBackup(null);
    setData((prev) => {
      const copy = structuredClone(prev);
      const previousPlayers = structuredClone(copy.players);
      copy.reizinhoPlayerCount = playerCount;
      copy.players = Array.from({ length: playerCount }, (_, index) => (
        copy.players?.[index] || `${config.label} ${index + 1}`
      ));
      copy.participantAttendance = reconcileParticipantAttendance(
        config,
        previousPlayers,
        copy.players,
        copy.participantAttendance
      );
      copy.schedule = [];
      copy.namesShuffled = false;
      delete copy.lastShuffleVideo;
      copy.courtNumbers = normalizeCourtNumbers(copy.courtNumbers, 1);
      return copy;
    }, { allowScoreRegression: true });
    setCourtConfigRevision((revision) => revision + 1);
    showNotice(
      "success",
      "Formato atualizado",
      playerCount === 4
        ? "Reizinho tradicional com 4 atletas selecionado."
        : "Reizinho com 6 atletas selecionado conforme o modelo da planilha."
    );
  }

  function requestReizinhoPlayerCount(value) {
    const playerCount = Number(value);
    if (playerCount === getReizinhoPlayerCount(config, data)) return;
    const alreadyUsed = Boolean(data.schedule?.length || data.namesShuffled);
    if (!alreadyUsed) {
      applyReizinhoPlayerCount(playerCount);
      return;
    }
    setRegenerationConfirm({
      action: "reizinhoPlayerCount",
      playerCount,
      title: `Alterar para ${playerCount} atletas?`,
      message: "A quantidade de atletas define todo o formato do Reizinho.",
      impacts: [
        "As rodadas, os jogos e os placares atuais serão removidos.",
        "Os nomes compatíveis já preenchidos serão preservados.",
      ],
      confirmLabel: "Sim, alterar formato",
    });
  }

  function startTieBreakDraw({ kind, tieKey, ids, candidates, title }) {
    if (!Array.isArray(ids) || ids.length < 2 || tieBreakDrawTimerRef.current) return;

    const order = shuffleArray([...ids]);
    const providedCandidateNames = new Map(
      (candidates || []).map((candidate) => [String(candidate.id), candidate.name])
    );
    const candidateNames = new Map(
      ids.map((id) => [String(id), providedCandidateNames.get(String(id)) || "Participante"])
    );
    const orderNames = order.map((id) => candidateNames.get(String(id)) || "Participante");
    const endsAt = Date.now() + 5000;

    setTieBreakDraw({
      phase: "drawing",
      title,
      seconds: 5,
      spotlight: orderNames[0],
      candidates: [...candidateNames.values()],
    });

    tieBreakDrawTimerRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();

      if (remaining > 0) {
        const names = [...candidateNames.values()];
        setTieBreakDraw((current) => current ? {
          ...current,
          seconds: Math.max(1, Math.ceil(remaining / 1000)),
          spotlight: names[Math.floor(Math.random() * names.length)] || current.spotlight,
        } : current);
        return;
      }

      clearTieBreakDrawTimer();
      setData((prev) => {
        const copy = structuredClone(prev);
        const cupConfig = copy.cupConfig || {};

        if (kind === "group") {
          copy.cupConfig = {
            ...cupConfig,
            tieBreakOverrides: {
              ...(cupConfig.tieBreakOverrides || {}),
              [String(tieKey)]: order,
            },
            ...(isCearenseData(copy) ? { campaignTieBreakOverrides: {} } : {}),
          };
        } else if (kind === "groupCampaign") {
          copy.cupConfig = {
            ...cupConfig,
            groupTieBreakOverrides: {
              ...(cupConfig.groupTieBreakOverrides || {}),
              [tieKey]: order,
            },
          };
        } else {
          copy.cupConfig = {
            ...cupConfig,
            campaignTieBreakOverrides: {
              ...(cupConfig.campaignTieBreakOverrides || {}),
              [tieKey]: order,
            },
          };
        }

        copy.brackets = [];
        return copy;
      });
      setTieBreakDraw({
        phase: "result",
        title,
        winner: orderNames[0],
        orderNames,
      });
    }, 140);
  }

  function resolveCopinhaTie(groupId, teamIds) {
    const group = cupGroupRankings.find((item) => String(item.id) === String(groupId));
    const candidates = (group?.rows || []).filter((row) => (
      teamIds.some((id) => String(id) === String(row.id))
    ));

    startTieBreakDraw({
      kind: "group",
      tieKey: groupId,
      ids: teamIds,
      candidates,
      title: `Desempate do ${group?.name || "grupo"}`,
    });
  }

  function resolveCopinhaGroupTie(tieKey, groupIds) {
    const candidates = cupGroupRankings
      .filter((group) => groupIds.some((id) => String(id) === String(group.id)))
      .map((group) => ({ id: group.id, name: group.name }));

    startTieBreakDraw({
      kind: "groupCampaign",
      tieKey,
      ids: groupIds,
      candidates,
      title: "Sorteio da melhor campanha",
    });
  }

  function resolveCearenseCampaignTie(tieKey, teamIds) {
    const tie = cearenseCampaignTies.find((item) => item.tieKey === tieKey);

    startTieBreakDraw({
      kind: "campaign",
      tieKey,
      ids: teamIds,
      candidates: tie?.rows || teamIds.map((id) => ({ id, name: getCupTeamName(data, id) })),
      title: "Desempate entre grupos",
    });
  }

  function refreshGameParticipantNames(nextData) {
    function getTeamNames(ids = []) {
      if (!ids.length) return ["Aguardando"];

      if (isMixedType(config)) {
        const allPlayers = [...(nextData.players?.men || []), ...(nextData.players?.women || [])];
        return ids.map((id) => allPlayers[id] || "");
      }

      if (isFixedTeamType(config) || isCupType(config)) {
        return ids.map((id) => getTeamName(nextData.players?.teams?.[id]));
      }

      return ids.map((id) => nextData.players?.[id] || "");
    }

    function refreshGame(game) {
      return {
        ...game,
        team1: game.ids1?.length ? getTeamNames(game.ids1) : game.team1,
        team2: game.ids2?.length ? getTeamNames(game.ids2) : game.team2,
      };
    }

    nextData.schedule = (nextData.schedule || []).map((round) =>
      round.map((game) => refreshGame(game))
    );

    nextData.brackets = (nextData.brackets || []).map((game) => refreshGame(game));

    return nextData;
  }

  function updatePlayer(path, value) {
    const copy = structuredClone(data);
    const formattedValue = formatParticipantNameWhileTyping(value);
    copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);

    const previousName = path.kind === "normal"
      ? copy.players[path.index]
      : path.kind === "men"
        ? copy.players.men[path.index]
        : path.kind === "women"
          ? copy.players.women[path.index]
          : copy.players.teams[path.index]?.[path.field];
    const previousGender = getParticipantGender(copy.participantGenders, previousName, { confirmedOnly: true });

    if (path.kind === "normal") copy.players[path.index] = formattedValue;
    if (path.kind === "men") copy.players.men[path.index] = formattedValue;
    if (path.kind === "women") copy.players.women[path.index] = formattedValue;
    if (path.kind === "team") copy.players.teams[path.index][path.field] = formattedValue;
    if (previousGender !== participantGenderValues.unknown && previousName !== formattedValue) {
      copy.participantGenders = setParticipantGender(copy.participantGenders, previousName, participantGenderValues.unknown);
      copy.participantGenders = setParticipantGender(copy.participantGenders, formattedValue, previousGender);
    }
    setParticipantAttendanceValue(copy.participantAttendance, path, false);
    delete copy.lastShuffleVideo;

    setParticipantImportBackup(null);
    setData(refreshGameParticipantNames(copy));
  }

  function updateParticipantAttendance(path, confirmed) {
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);
      setParticipantAttendanceValue(copy.participantAttendance, path, confirmed);
      return copy;
    });
  }

  function setAllParticipantAttendance(confirmed) {
    setData((prev) => ({
      ...prev,
      participantAttendance: normalizeParticipantAttendance(
        config,
        prev.players,
        confirmed
          ? (() => {
              const attendance = normalizeParticipantAttendance(config, prev.players, null);
              getParticipantAttendanceEntries(config, { players: prev.players, participantAttendance: attendance })
                .forEach((entry) => setParticipantAttendanceValue(attendance, entry.path, true));
              return attendance;
            })()
          : null
      ),
    }));
    showNotice(
      "success",
      confirmed ? "Presenças confirmadas" : "Presenças redefinidas",
      confirmed ? "Todos os participantes foram marcados como confirmados." : "Todos os participantes foram marcados como pendentes."
    );
  }

  function ensureCearenseParallelChoices() {
    if (!isCampeonatoCearenseData(data)) return true;

    const cupConfig = data.cupConfig || {};
    const missingChoices = [];
    if (typeof cupConfig.secondRepechageEnabled !== "boolean") missingChoices.push("1ª disputa paralela");
    if (typeof cupConfig.thirdRepechageEnabled !== "boolean") missingChoices.push("2ª disputa paralela");

    if (missingChoices.length > 0) {
      showNotice(
        "warning",
        "Escolha obrigatória",
        `Defina Sim ou Não para ${missingChoices.join(" e ")} antes de continuar.`
      );
      setActiveTournamentTab("participantes");
      setActiveOrganizationTab("formato");
      return false;
    }

    const missingNames = [];
    if (cupConfig.secondRepechageEnabled && !String(cupConfig.repechageName || "").trim()) {
      missingNames.push("1ª disputa paralela");
    }
    if (cupConfig.thirdRepechageEnabled && !String(cupConfig.thirdRepechageName || "").trim()) {
      missingNames.push("2ª disputa paralela");
    }

    if (missingNames.length > 0) {
      showNotice(
        "warning",
        "Nome obrigatório",
        `Informe o nome da ${missingNames.join(" e da ")} antes de continuar.`
      );
      setActiveTournamentTab("participantes");
      setActiveOrganizationTab("formato");
      return false;
    }

    return true;
  }

  function commitDefaultCourtNumber(index, value) {
    const nextNumber = normalizeCourtNumberValue(value) || String(index + 1);
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.courtNumbers = normalizeCourtNumbers(copy.courtNumbers, Math.max(currentCourtCount, index + 1));
      copy.courtNumbers[index] = nextNumber;
      return copy;
    });
  }

  function requestDefaultCourtNumber(index, value) {
    const nextNumber = normalizeCourtNumberValue(value) || String(index + 1);
    const numbers = normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
    if (numbers[index] === nextNumber) return;

    const duplicateIndex = numbers.findIndex((number, currentIndex) => currentIndex !== index && number === nextNumber);

    if (duplicateIndex >= 0) {
      setCourtDuplicateConfirm({
        kind: "default",
        index,
        number: nextNumber,
        duplicatePosition: duplicateIndex + 1,
      });
      return;
    }

    commitDefaultCourtNumber(index, nextNumber);
  }

  function resetDefaultCourtNumbers() {
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.courtNumbers = createDefaultCourtNumbers(Math.max(currentCourtCount, prev.courtNumbers?.length || 0));
      copy.schedule = (copy.schedule || []).map((round) => round.map((game) => {
        const nextGame = { ...game };
        delete nextGame.courtLabelOverride;
        delete nextGame.courtNumberOverride;
        return nextGame;
      }));
      copy.brackets = (copy.brackets || []).map((game) => {
        const nextGame = { ...game };
        delete nextGame.courtLabelOverride;
        delete nextGame.courtNumberOverride;
        return nextGame;
      });
      return copy;
    });
    setCourtConfigRevision((value) => value + 1);
    showNotice("success", "Quadras restauradas", "Os números das quadras voltaram ao padrão desta modalidade.");
  }

  function getCourtAssignmentContext(source, editor) {
    if (!editor) return { game: null, peers: [] };

    if (editor.scope === "schedule") {
      const peers = source.schedule?.[editor.roundIndex] || [];
      return { game: peers[editor.gameIndex] || null, peers };
    }

    const game = (source.brackets || []).find((item) => item.matchKey === editor.matchKey) || null;
    const peers = game
      ? (source.brackets || []).filter((item) => item.phase === game.phase && item.roundName === game.roundName)
      : [];
    return { game, peers };
  }

  function getOpenCourtUsages(exclude = null) {
    const currentVenueKey = getTournamentVenueKey({ ...tournament, data: latestDataRef.current });
    const currentTournamentUsages = getTournamentActiveCourtUsages(
      { ...tournament, data: latestDataRef.current },
      latestDataRef.current
    );
    const externalLiveUsages = Array.isArray(venueCourtUsages)
      ? venueCourtUsages.filter((usage) => String(usage.tournamentId) !== String(tournament.id))
      : [];
    const fallbackExternalUsages = externalLiveUsages.length || !Array.isArray(openTournaments)
      ? []
      : openTournaments
          .filter((item) => (
            String(item.id) !== String(tournament.id)
            && getTournamentVenueKey(item) === currentVenueKey
          ))
          .flatMap((item) => getTournamentActiveCourtUsages(item, item.data));

    return [...externalLiveUsages, ...fallbackExternalUsages, ...currentTournamentUsages]
      .filter((usage) => !exclude || (
        String(usage.tournamentId) !== String(exclude.tournamentId)
        || usage.gameKey !== exclude.gameKey
      ));
  }

  function getAvailableCentralCourtNumbers(usages = getOpenCourtUsages()) {
    const occupied = new Set(usages.map((usage) => normalizeCourtNumberValue(usage.courtNumber)).filter(Boolean));
    return normalizedCentralCourtNumbers.filter((number) => (
      !occupied.has(number) && !unavailableCentralCourtNumbers.has(number)
    ));
  }

  function getNextFreeCourtNumber(usages = getOpenCourtUsages()) {
    return getAvailableCentralCourtNumbers(usages)[0] || null;
  }

  function setOperationalGameState(target, inProgress, courtNumber = null) {
    setData((prev) => {
      const copy = target.scope === "bracket" ? prepareEditableBracketData(prev) : structuredClone(prev);
      const courtNumbers = normalizeCourtNumbers(copy.courtNumbers, getTournamentCourtCount(config, copy));

      if (target.scope === "schedule") {
        const game = copy.schedule?.[target.roundIndex]?.[target.gameIndex];
        if (!game || isGameFinished(game, getWinningScore(copy))) return prev;
        if (courtNumber) applyCourtNumberToGame(game, courtNumber, courtNumbers);
        if (inProgress) startMatchTimer(game);
        else stopMatchTimer(game);
        game.inProgress = inProgress;
        return copy;
      }

      const resolvedGames = (copy.brackets || []).map((game) => resolveBracketGame(game, copy.brackets, copy));
      const resolvedTarget = resolvedGames.find((game) => game.matchKey === target.matchKey);
      if (!resolvedTarget || !hasPlayableGameSides(resolvedTarget) || isGameFinished(resolvedTarget, getWinningScore(copy))) return prev;

      copy.brackets = copy.brackets.map((game) => {
        if (game.matchKey !== target.matchKey) return game;
        const nextGame = { ...game };
        if (inProgress) startMatchTimer(nextGame);
        else stopMatchTimer(nextGame);
        nextGame.inProgress = inProgress;
        if (courtNumber) applyCourtNumberToGame(nextGame, courtNumber, courtNumbers);
        return nextGame;
      });
      return copy;
    });
  }

  function requestOperationalGameStart(target, game, { skipParticipantCheck = false } = {}) {
    if (!skipParticipantCheck) {
      const targetKey = target.scope === "schedule"
        ? `schedule:${target.roundIndex}:${target.gameIndex}`
        : `bracket:${target.matchKey}`;
      const conflicts = getInProgressParticipantConflicts(data, game, targetKey);

      if (conflicts.length > 0) {
        setParticipantOccupancyConflict({ target, game, conflicts });
        return;
      }
    }

    const courtNumbers = normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
    const preferredCourtNumber = normalizedPreferredCourtNumbers[Math.max(0, Number(game?.court || 1) - 1)] || null;
    const courtNumber = game?.courtNumberOverride
      ? getGameCourtNumber(game, courtNumbers)
      : preferredCourtNumber || getGameCourtNumber(game, courtNumbers);

    if (!normalizedCentralCourtNumbers.includes(courtNumber)) {
      if (typeof onRegisterCentralCourtNumber === "function") {
        onRegisterCentralCourtNumber(courtNumber);
      }
      setOperationalGameState(target, true, courtNumber);
      showNotice(
        "success",
        "Quadra adicionada à Central",
        `A Quadra ${courtNumber} ainda não estava prevista. Ela foi adicionada à Central e o jogo foi iniciado normalmente.`
      );
      return;
    }

    const usageScope = getOpenCourtUsages({
      tournamentId: tournament.id,
      gameKey: target.scope === "schedule"
        ? `schedule:${target.roundIndex}:${target.gameIndex}`
        : `bracket:${target.matchKey}`,
    });
    const freeCourtNumbers = getAvailableCentralCourtNumbers(usageScope);

    if (unavailableCentralCourtNumbers.has(courtNumber)) {
      setCourtOccupancyConflict({
        kind: "start",
        number: courtNumber,
        usage: null,
        markedUnavailable: true,
        target,
        freeCourtNumbers,
      });
      return;
    }
    const usage = usageScope.find((item) => item.courtNumber === courtNumber);

    if (!usage) {
      // Registra a quadra efetivamente mostrada no cartão antes de iniciar.
      // Assim a Central, os outros torneios e o próprio cartão usam a mesma fonte.
      setOperationalGameState(target, true, courtNumber);
      return;
    }

    setCourtOccupancyConflict({
      kind: "start",
      number: courtNumber,
      usage,
      target,
      freeCourtNumbers,
    });
  }

  function resolveParticipantOccupancyConflict(choice) {
    if (!participantOccupancyConflict) return;
    const conflict = participantOccupancyConflict;
    setParticipantOccupancyConflict(null);
    if (choice !== "continue") return;

    requestOperationalGameStart(conflict.target, conflict.game, { skipParticipantCheck: true });
  }

  function resolveCourtOccupancyConflict(choice) {
    if (!courtOccupancyConflict) return;
    const conflict = courtOccupancyConflict;
    setCourtOccupancyConflict(null);
    if (choice === "cancel") return;

    const selectedFreeCourtNumber = typeof choice === "string" && choice.startsWith("free:")
      ? normalizeCourtNumberValue(choice.slice(5))
      : "";
    const nextCourtNumber = selectedFreeCourtNumber
      || (choice === "next" ? getNextFreeCourtNumber() : conflict.number);

    if (!nextCourtNumber) {
      showNotice(
        "warning",
        "Nenhuma quadra livre",
        "Todas as quadras informadas na Central estão ocupadas ou indisponíveis."
      );
      return;
    }

    if (conflict.kind === "assign") {
      commitGameCourtNumber(conflict.editor, nextCourtNumber);
      return;
    }

    setOperationalGameState(conflict.target, true, nextCourtNumber);
    if (choice === "next" || selectedFreeCourtNumber) {
      showNotice("success", "Quadra livre selecionada", `O jogo foi iniciado na Quadra ${nextCourtNumber}.`);
    }
  }

  function commitGameCourtNumber(editor, value, noticeOverride = null) {
    const nextNumber = normalizeCourtNumberValue(value);
    if (!editor || !nextNumber) return;
    setData((prev) => {
      const copy = structuredClone(prev);
      const courtNumbers = normalizeCourtNumbers(copy.courtNumbers, getTournamentCourtCount(config, copy));
      const { game } = getCourtAssignmentContext(copy, editor);
      if (!game) return prev;
      applyCourtNumberToGame(game, nextNumber, courtNumbers);
      return copy;
    });

    setCourtEditor(null);
    setCourtDuplicateConfirm(null);
    showNotice(
      noticeOverride?.type || "success",
      noticeOverride?.title || "Quadra alterada",
      noticeOverride?.message || `O jogo agora aparece como Quadra ${nextNumber}.`
    );
  }

  function requestGameCourtNumber(value, { confirmed = false } = {}) {
    const nextNumber = normalizeCourtNumberValue(value);
    if (!courtEditor || !nextNumber) return;

    const sourceData = latestDataRef.current;
    const context = getCourtAssignmentContext(sourceData, courtEditor);
    if (context.game && getGameCourtNumber(context.game, displayedCourtNumbers) === nextNumber) {
      setCourtEditor(null);
      return;
    }

    const usageScope = getOpenCourtUsages({
      tournamentId: tournament.id,
      gameKey: courtEditor.scope === "schedule"
        ? `schedule:${courtEditor.roundIndex}:${courtEditor.gameIndex}`
        : `bracket:${courtEditor.matchKey}`,
    });
    const usage = usageScope.find((item) => item.courtNumber === nextNumber);
    const freeCourtNumbers = getAvailableCentralCourtNumbers(usageScope);

    if (unavailableCentralCourtNumbers.has(nextNumber) && !confirmed) {
      setCourtOccupancyConflict({
        kind: "assign",
        editor: courtEditor,
        number: nextNumber,
        usage: null,
        markedUnavailable: true,
        freeCourtNumbers,
      });
      setCourtEditor(null);
      return;
    }

    if (usage && !confirmed) {
      setCourtOccupancyConflict({
        kind: "assign",
        editor: courtEditor,
        number: nextNumber,
        usage,
        freeCourtNumbers,
      });
      setCourtEditor(null);
      return;
    }

    if (confirmed && (usage || unavailableCentralCourtNumbers.has(nextNumber))) {
      commitGameCourtNumber(courtEditor, nextNumber, {
        type: "success",
        title: usage ? "Uso repetido confirmado" : "Uso da quadra confirmado",
        message: usage
          ? `A Quadra ${nextNumber} foi aplicada mesmo já estando em uso.`
          : `A Quadra ${nextNumber} foi aplicada mesmo estando marcada como indisponível.`,
      });
      return;
    }

    if (!normalizedCentralCourtNumbers.includes(nextNumber)) {
      if (typeof onRegisterCentralCourtNumber === "function") {
        onRegisterCentralCourtNumber(nextNumber);
      }
      commitGameCourtNumber(courtEditor, nextNumber, {
        type: "success",
        title: "Quadra adicionada à Central",
        message: `A Quadra ${nextNumber} ainda não estava prevista e foi adicionada automaticamente à Central.`,
      });
      return;
    }

    commitGameCourtNumber(courtEditor, nextNumber);
  }

  function requestCourtAssignment(editor) {
    setCourtEditor(editor);
  }

  function confirmDuplicateCourtNumber() {
    if (!courtDuplicateConfirm) return;

    if (courtDuplicateConfirm.kind === "default") {
      commitDefaultCourtNumber(courtDuplicateConfirm.index, courtDuplicateConfirm.number);
      setCourtDuplicateConfirm(null);
      return;
    }

    commitGameCourtNumber(courtDuplicateConfirm.editor, courtDuplicateConfirm.number);
  }

  function cancelDuplicateCourtNumber() {
    if (courtDuplicateConfirm?.kind === "default") {
      setCourtConfigRevision((value) => value + 1);
    }
    setCourtDuplicateConfirm(null);
  }

  function importParticipants(nextPlayers, summary) {
    const copy = structuredClone(data);

    const importedGenderRegistry = mergeParticipantGenderRegistries(
      copy.participantGenders,
      summary.participantGenders
    );
    const shouldOrderFixedMixedTeams = inferTournamentGenderMode(copy) === tournamentGenderModes.mixed
      && !isMixedType(config)
      && !isIndividualCupType(config)
      && Array.isArray(nextPlayers?.teams);
    const orderedPlayers = shouldOrderFixedMixedTeams
      ? {
          ...nextPlayers,
          teams: orderConfirmedMixedTeams(nextPlayers.teams, importedGenderRegistry),
        }
      : nextPlayers;

    setParticipantImportBackup({
      players: structuredClone(data.players),
      participantAttendance: structuredClone(data.participantAttendance),
      participantGenders: structuredClone(data.participantGenders),
    });
    copy.participantAttendance = reconcileParticipantAttendance(
      config,
      copy.players,
      orderedPlayers,
      copy.participantAttendance
    );
    copy.players = structuredClone(orderedPlayers);
    copy.participantGenders = importedGenderRegistry;
    delete copy.lastShuffleVideo;
    setData(refreshGameParticipantNames(copy));
    setParticipantImportOpen(false);
    showNotice(
      "success",
      "Lista importada",
      `${summary.imported} nome${summary.imported === 1 ? "" : "s"} preenchido${summary.imported === 1 ? "" : "s"}. ${summary.preserved} nome${summary.preserved === 1 ? "" : "s"} já editado${summary.preserved === 1 ? " foi preservado" : "s foram preservados"}.`
    );
  }

  function undoParticipantImport() {
    if (!participantImportBackup) return;

    const copy = structuredClone(data);
    copy.players = structuredClone(participantImportBackup.players);
    copy.participantAttendance = structuredClone(participantImportBackup.participantAttendance);
    copy.participantGenders = structuredClone(participantImportBackup.participantGenders);
    setParticipantImportBackup(null);
    setData(refreshGameParticipantNames(copy));
    showNotice("success", "Importação desfeita", "A lista de participantes voltou ao estado anterior.");
  }

  async function finishShuffle() {
    const copy = structuredClone(data);
    copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);

    const shuffledIndexes = (length) => shuffleArray(Array.from({ length }, (_, index) => index));

    if (isMixedType(config)) {
      const menOrder = shuffledIndexes(copy.players.men.length);
      const womenOrder = shuffledIndexes(copy.players.women.length);
      copy.players.men = menOrder.map((index) => copy.players.men[index]);
      copy.participantAttendance.men = menOrder.map((index) => copy.participantAttendance.men[index]);
      copy.players.women = womenOrder.map((index) => copy.players.women[index]);
      copy.participantAttendance.women = womenOrder.map((index) => copy.participantAttendance.women[index]);
    } else if (isFixedTeamType(config) || isCupType(config)) {
      const teamOrder = shuffledIndexes(copy.players.teams.length);
      copy.players.teams = teamOrder.map((index) => copy.players.teams[index]);
      copy.participantAttendance.teams = teamOrder.map((index) => copy.participantAttendance.teams[index]);
    } else {
      const playerOrder = shuffledIndexes(copy.players.length);
      copy.players = playerOrder.map((index) => copy.players[index]);
      copy.participantAttendance = playerOrder.map((index) => copy.participantAttendance[index]);
    }

    copy.schedule = [];

    if (isCupType(config)) {
      copy.brackets = [];
      copy.groupsShuffled = true;
      resetCopinhaTieBreaks(copy);
    } else {
      copy.namesShuffled = true;
    }

    const { createShuffleVideoSnapshot } = await import("./features/media/shuffleVideoExport.mjs");
    const videoSnapshot = createShuffleVideoSnapshot(copy, config, tournament);
    copy.lastShuffleVideo = videoSnapshot;

    setData(copy, { allowScoreRegression: true });
    setShuffleOverlay(null);
    setShuffleVideoSnapshot(videoSnapshot);
  }

async function shuffleNames() {
  clearShuffleTimers();
  void import("./features/media/shuffleVideoExport.mjs");
  const {
    SHUFFLE_DURATION_SECONDS,
    SHUFFLE_MOVEMENT_INTERVAL_MS,
    createShuffleAnimationItems,
    getShuffleNames,
    moveShuffleAnimationItems,
  } = await import("./features/media/shuffleAnimation.mjs");
  const names = getShuffleNames(data, config);

  if (!names.length) {
    showNotice("warning", "Sem participantes", "Adicione os nomes antes do sorteio.");
    return;
  }

  let seconds = SHUFFLE_DURATION_SECONDS;

  setShuffleOverlay({
    seconds,
    items: createShuffleAnimationItems(names),
  });

  const interval = setInterval(() => {
    setShuffleOverlay((prev) => (prev ? {
      ...prev,
      items: moveShuffleAnimationItems(prev.items),
    } : null));
  }, SHUFFLE_MOVEMENT_INTERVAL_MS);
  shuffleAnimationTimerRef.current = interval;

  const countdown = setInterval(() => {
    seconds -= 1;
    setShuffleOverlay((prev) => (prev ? { ...prev, seconds } : null));

    if (seconds <= 0) {
      clearShuffleTimers();
      void finishShuffle();
    }
  }, 1000);
  shuffleCountdownTimerRef.current = countdown;
}

function showGeneratedGamesNotice(message) {
  const pendingCount = pendingParticipantEntries.length;

  if (pendingCount === 0) {
    showNotice("success", "Rodadas e jogos criados", message);
    return;
  }

  showNotice(
    "warning",
    "Jogos criados com participantes ausentes",
    `${message} ${pendingCount} participante${pendingCount === 1 ? " está marcado" : "s estão marcados"} como ausente${pendingCount === 1 ? "" : "s"}. A geração foi concluída normalmente e os placares continuam liberados.`
  );
}

async function generate() {
  if (isCupType(config)) {
    const schedule = generateCupGroupSchedule(data.players, data.cupConfig || {});

    setData((prev) => ({
      ...prev,
      schedule,
      brackets: [],
      groupsShuffled: prev.groupsShuffled || false,
    }), { allowScoreRegression: true });

    setActiveTournamentTab("partidas");
    setActiveMatchesTab("grupos");
    showGeneratedGamesNotice(
      isCearenseData(data)
        ? isSunsetData(data)
          ? "A fase de grupos da Copa Sunset foi montada com sucesso."
          : isPlayRankingData(data)
          ? "A fase de grupos do Modelo Torneio 360 foi montada com sucesso."
          : "A fase de grupos do Campeonato Cearense foi montada com sucesso."
        : "A fase de grupos da Copa foi montada com sucesso."
    );
    return;
  }

  const { generateSchedule } = await import("./domain/tournamentScheduleFactory.mjs");
  const schedule = generateSchedule(tournament.type, data.players);

  setData({
    ...data,
    schedule,
  }, { allowScoreRegression: true });

  setActiveTournamentTab("partidas");
  showGeneratedGamesNotice("As rodadas e os jogos foram criados com sucesso.");
}

function generateBrackets() {
  if (!isCupType(config)) return;

  const allGroupGames = (data.schedule || []).flat();
  const pendingGames = allGroupGames.some((game) => !isGameFinished(game, getWinningScore(data)));

  if (!data.schedule || data.schedule.length === 0) {
    showNotice(
      "warning",
      "Fase de grupos não gerada",
      "Gere a tabela da fase de grupos antes de montar as chaves."
    );
    return;
  }

  if (pendingGames) {
    showNotice(
      "warning",
      "Placares pendentes",
      "Preencha todos os placares da fase de grupos com um resultado válido antes de gerar as chaves."
    );
    return;
  }

  const bracketSource = isCampeonatoCearenseData(data)
    ? {
      ...structuredClone(data),
      cupConfig: { ...(data.cupConfig || {}), cearenseBracketVersion: 2 },
    }
    : isPlayRankingData(data)
    ? {
      ...structuredClone(data),
      cupConfig: {
        ...(data.cupConfig || {}),
        playRankingBracketVersion: PLAY_RANKING_BRACKET_VERSION,
      },
    }
    : data;

  if (isCopinhaData(data)) {
    const hasUnresolvedTie = calculateCupGroupRankings(data, data.rankingCriteria)
      .some((group) => group.unresolvedTieIds?.length > 1);
    const hasUnresolvedGroupTie = getCopinhaSeededGroups(data).unresolvedGroupTies.length > 0;

    if (hasUnresolvedTie || hasUnresolvedGroupTie) {
      showNotice(
        "warning",
        "Desempate pendente",
        "Realize o sorteio de desempate indicado na aba Grupos antes de gerar as chaves."
      );
      setActiveTournamentTab("grupos");
      return;
    }
  }

  if (isCearenseData(data)) {
    const hasUnresolvedGroupTie = calculateCupGroupRankings(bracketSource, bracketSource.rankingCriteria)
      .some((group) => group.unresolvedTieIds?.length > 1);
    const hasUnresolvedCampaignTie = getCearenseQualified(bracketSource).unresolvedCampaignTies.length > 0;

    if (hasUnresolvedGroupTie || hasUnresolvedCampaignTie) {
      showNotice(
        "warning",
        "Desempate pendente",
        "Registre os sorteios de desempate indicados na aba Grupos antes de gerar as chaves."
      );
      setActiveTournamentTab("grupos");
      return;
    }
  }

  const copy = syncCupBracketScores(bracketSource);
  setData(copy, { allowScoreRegression: true });

  showNotice(
    "success",
    "Chaves geradas",
    isPlayRankingData(copy)
      ? "A Eliminatória Principal foi montada. A Disputa Paralela será completada automaticamente após todos os placares da primeira fase da chave principal."
      : "As chaves finais foram montadas com sucesso."
  );
}

function requestShuffleNames() {
  if (!ensureCearenseParallelChoices()) return;

  const alreadyUsed = isCupType(config)
    ? Boolean(data.groupsShuffled || data.schedule?.length || data.brackets?.length)
    : Boolean(data.namesShuffled || data.schedule?.length);

  if (!alreadyUsed) {
    shuffleNames();
    return;
  }

  setRegenerationConfirm(isCupType(config) ? {
    action: "shuffle",
    title: "Sortear os grupos novamente?",
    message: "Um novo sorteio muda a posição das duplas e refaz a organização da fase de grupos.",
    impacts: [
      "As rodadas e os jogos atuais serão apagados.",
      "Placares e chaves finais já gerados serão removidos.",
      "Os participantes cadastrados serão mantidos.",
    ],
    confirmLabel: "Sim, sortear novamente",
  } : {
    action: "shuffle",
    title: "Sortear os nomes novamente?",
    message: "Um novo sorteio altera a ordem atual dos participantes.",
    impacts: [
      "As rodadas, os jogos e os placares atuais serão apagados.",
      "Os nomes cadastrados serão mantidos.",
      "Depois será necessário criar novamente as rodadas e os jogos.",
    ],
    confirmLabel: "Sim, sortear novamente",
  });
}

function requestGenerate() {
  if (!ensureCearenseParallelChoices()) return;

  if (!data.schedule?.length) {
    generate();
    return;
  }

  setRegenerationConfirm(isCupType(config) ? {
    action: "generate",
    title: "Gerar a fase de grupos novamente?",
    message: "A fase de grupos atual será substituída por uma nova tabela.",
    impacts: [
      "Rodadas, jogos e placares atuais serão recriados.",
      "As chaves finais já geradas serão removidas.",
      "Participantes e grupos sorteados serão mantidos.",
    ],
    confirmLabel: "Sim, gerar novamente",
  } : {
    action: "generate",
    title: "Criar rodadas e jogos novamente?",
    message: "A tabela atual será substituída pela mesma lógica de geração da modalidade.",
    impacts: [
      "Rodadas, jogos e placares atuais serão recriados.",
      "Os participantes cadastrados serão mantidos.",
      "A ação não poderá recuperar os placares substituídos.",
    ],
    confirmLabel: "Sim, criar novamente",
  });
}

function requestGenerateBrackets() {
  if (!ensureCearenseParallelChoices()) return;

  if (!data.brackets?.length) {
    generateBrackets();
    return;
  }

  setRegenerationConfirm({
    action: "brackets",
    title: "Gerar as chaves finais novamente?",
    message: "As chaves serão recalculadas a partir da classificação atual da fase de grupos.",
    impacts: [
      "Confrontos das eliminatórias podem mudar.",
      "Placares e resultados já preenchidos nas chaves podem ser removidos.",
      "A fase de grupos e seus placares serão mantidos.",
    ],
    confirmLabel: "Sim, gerar novamente",
  });
}

function confirmRegeneration() {
  const action = regenerationConfirm?.action;
  const scoreChange = regenerationConfirm?.scoreChange;
  const simplePlayerCount = regenerationConfirm?.playerCount;
  setRegenerationConfirm(null);

  if (action === "shuffle") shuffleNames();
  if (action === "generate") generate();
  if (action === "brackets") generateBrackets();
  if (action === "group-score" && scoreChange) applyScheduleScoreChange(scoreChange, true);
  if (action === "simple-player-count" && simplePlayerCount) applySimplePlayerCount(simplePlayerCount);
  if (action === "reizinhoPlayerCount" && simplePlayerCount) applyReizinhoPlayerCount(simplePlayerCount);
}

function applyScheduleScoreChange({ roundIndex, gameIndex, field, value }, clearCupBrackets = false) {
  setData((currentData) => {
    const copy = structuredClone(currentData);
    const winningScore = getWinningScore(copy);

    copy.schedule[roundIndex][gameIndex][field] = normalizeScoreInput(value, winningScore);
    if (getScoreWinnerSide(copy.schedule[roundIndex][gameIndex], winningScore) !== null) {
      stopMatchTimer(copy.schedule[roundIndex][gameIndex], { finished: true });
      copy.schedule[roundIndex][gameIndex].inProgress = false;
    }

    if (isCupType(config) && (clearCupBrackets || !copy.brackets?.some((game) => game.s1 !== "" || game.s2 !== ""))) {
      copy.brackets = [];
      resetCopinhaTieBreaks(copy);
    }

    return copy;
    // Este caminho só é chamado por uma edição direta do organizador. Inclusive
    // apagar um placar é uma alteração válida e deve prevalecer entre dispositivos.
    // Reduções automáticas continuam bloqueadas pelo guardião de dados críticos.
  }, { allowScoreRegression: true });
}

function updateScore(roundIndex, gameIndex, field, value) {
  const cupBracketHasScores = isCupType(config)
    && data.brackets?.some((game) => game.s1 !== "" || game.s2 !== "");

  if (cupBracketHasScores) {
    setRegenerationConfirm({
      action: "group-score",
      scoreChange: { roundIndex, gameIndex, field, value },
      title: "Alterar o placar da fase de grupos?",
      message: "As chaves finais já possuem resultados e dependem desta classificação.",
      impacts: [
        "O novo placar da fase de grupos será salvo.",
        "As chaves finais e seus placares serão removidos para evitar resultados incompatíveis.",
        "Os participantes e os demais placares da fase de grupos serão mantidos.",
      ],
      confirmLabel: "Alterar e recriar as chaves",
    });
    return false;
  }

  applyScheduleScoreChange({ roundIndex, gameIndex, field, value });
  return true;
}

function prepareEditableBracketData(currentData) {
  const copy = structuredClone(currentData);

  // A Copa Sunset pode precisar materializar a vaga automática da vice da
  // Principal em torneios criados antes desta regra. A sincronização reaproveita
  // os placares pelos matchKeys e apenas completa a estrutura ausente.
  if (isSunsetData(copy)) {
    return syncCupBracketScores(copy);
  }

  // Torneios cearenses antigos podem exibir a 3ª disputa gerada em memória,
  // embora os novos jogos ainda não existam no array salvo. Sincronizar antes
  // da edição torna esses jogos persistentes sem perder placares anteriores.
  if (isCampeonatoCearenseData(copy) && copy.cupConfig?.cearenseBracketVersion === 2) {
    return syncCupBracketScores(copy);
  }

  if (!copy.brackets || copy.brackets.length === 0) {
    copy.brackets = rebuildCupBracketGames(copy);
  }

  return copy;
}

function toggleScheduleGameStatus(roundIndex, gameIndex) {
  const game = data.schedule?.[roundIndex]?.[gameIndex];
  if (!game || isGameFinished(game, getWinningScore(data))) return;

  const target = { scope: "schedule", roundIndex, gameIndex };
  if (game.inProgress === true) setOperationalGameState(target, false);
  else requestOperationalGameStart(target, game);
}

function toggleBracketGameStatus(matchKey) {
  const preparedData = prepareEditableBracketData(data);
  const storedGame = preparedData.brackets?.find((game) => game.matchKey === matchKey);
  const targetGame = storedGame
    ? resolveBracketGame(storedGame, preparedData.brackets, preparedData)
    : null;
  if (!targetGame || !hasPlayableGameSides(targetGame) || isGameFinished(targetGame, getWinningScore(preparedData))) return;

  const target = { scope: "bracket", matchKey };
  if (storedGame.inProgress === true) setOperationalGameState(target, false);
  else requestOperationalGameStart(target, targetGame);
}

function updateBracketScore(matchKey, field, value) {
  setData((prev) => {
    const copy = prepareEditableBracketData(prev);

    const allResolved = copy.brackets.map((game) =>
      resolveBracketGame(game, copy.brackets, copy)
    );

    const targetGame = allResolved.find((game) => game.matchKey === matchKey);

    if (!targetGame?.ids1?.length || !targetGame?.ids2?.length) {
      return copy;
    }

  const winningScore = getWinningScore(copy);

    copy.brackets = copy.brackets.map((game) => {
      if (game.matchKey !== matchKey) return game;

      const updatedGame = { ...game, [field]: normalizeScoreInput(value, winningScore) };
      if (getScoreWinnerSide(updatedGame, winningScore) !== null) {
        stopMatchTimer(updatedGame, { finished: true });
        updatedGame.inProgress = false;
      }
      return updatedGame;
    });

    if (isCampeonatoCearenseData(copy) && copy.cupConfig?.cearenseBracketVersion !== 2) {
      const resolvedStoredGames = copy.brackets.map((game) => resolveBracketGame(game, copy.brackets, copy));
      copy.brackets = resolvedStoredGames.map((game) => resolveBracketGame(game, resolvedStoredGames, copy));
      return copy;
    }

    const existingScores = {};

    copy.brackets.forEach((game) => {
      existingScores[game.matchKey] = {
        s1: game.s1,
        s2: game.s2,
        ids1: game.ids1,
        ids2: game.ids2,
        inProgress: game.inProgress === true,
        ...getMatchTimerFields(game),
        courtNumberOverride: game.courtNumberOverride,
      };
    });

    copy.brackets = rebuildCupBracketGames(copy, existingScores);
    return copy;
  }, { allowScoreRegression: true });
}

function clearScores() {
  const copy = structuredClone(data);

  copy.schedule = (copy.schedule || []).map((round) =>
    round.map((game) => resetMatchTimer({ ...game, s1: "", s2: "", inProgress: false }))
  );

  if (isCupType(config)) {
    copy.brackets = [];
    resetCopinhaTieBreaks(copy);
  }

  setData(copy, { allowScoreRegression: true });
  setClearScoresOpen(false);
  showNotice("success", "Placares apagados", "Todos os placares foram removidos.");
}

function clearTable() {
  const copy = structuredClone(data);
  copy.schedule = [];

  if (isCupType(config)) {
    copy.brackets = [];
    resetCopinhaTieBreaks(copy);
  }

  setData(copy, { allowScoreRegression: true });
  setClearTableOpen(false);
  showNotice("success", "Jogos e placares apagados", "Todos os jogos e placares foram removidos. Os participantes foram mantidos.");
}

const { currentBrackets, parallelRanking, mainCupPodium, consolationCupPodium, secondParallelPodium, thirdParallelPodium, sunsetPodium } = getSafeCupPresentation(data, config);
const secondParallelVisible = isCearenseSecondParallelEnabled(data);
const sunsetSecondParallelVisible = isSunsetData(data);
const thirdParallelVisible = isCearenseThirdParallelEnabled(data);
const sunsetFinalVisible = isSunsetData(data);
const isOfficialCearenseCup = isCampeonatoCearenseData(data);
const firstParallelDisplayName = data.cupConfig?.repechageName
  || (isOfficialCearenseCup || isPlayRankingData(data) || sunsetFinalVisible ? "Consolation" : "Disputa paralela");
const sunsetSecondParallelDisplayName = data.cupConfig?.secondParallelName || "Caridade";
const laterParallelDisplayName = data.cupConfig?.thirdRepechageName
  || (isOfficialCearenseCup ? "Caridade" : sunsetFinalVisible ? "Também Ganhei" : "3ª Disputa Paralela");
const laterParallelOrdinal = isOfficialCearenseCup ? "2ª" : "3ª";
const sunsetFinalDisplayName = data.cupConfig?.sunsetBracketName || "Etapa Sunset";
const rankingOrganizer = data.publicInfo?.organizer || {};
const tournamentTimingSummary = getTournamentTimingSummary(data);
const tournamentRankingShareContext = {
  title: tournament.name,
  subtitle: getModalityDisplayName(tournament.type),
  arenaName: rankingOrganizer.arenaName || rankingOrganizer.organizerName || "Arena Torneio360",
  arenaPhotoUrl: rankingOrganizer.photoUrl || "",
  rankingCriteria: data.rankingCriteria || defaultRankingCriteria,
  tournamentDurationSeconds: tournamentTimingSummary.complete ? tournamentTimingSummary.durationSeconds : 0,
};
const tournamentCircuitAction = typeof onManageCircuits === "function"
  ? { onClick: onManageCircuits, managed: circuitMembershipCount > 0 }
  : null;
const courtEditorContext = getCourtAssignmentContext(data, courtEditor);
const courtEditorGame = courtEditorContext.game;
const courtEditorUsedNumbers = courtEditor
  ? getOpenCourtUsages({
      tournamentId: tournament.id,
      gameKey: courtEditor.scope === "schedule"
        ? `schedule:${courtEditor.roundIndex}:${courtEditor.gameIndex}`
        : `bracket:${courtEditor.matchKey}`,
    }).map((usage) => usage.courtNumber)
  : [];

  function SavingStatusBadge() {
    const normalizedStatus = savingStatus.toLowerCase();
    const statusClass = /erro|revisão/.test(normalizedStatus)
      ? "error"
      : /salvando|sincronizando|tentando|unindo|enviando|recuperando|pendente/.test(normalizedStatus)
        ? "saving"
        : /aparelho|offline/.test(normalizedStatus)
          ? "offline"
          : "saved";
    return (
      <span className={`savingBadge ${statusClass}`}>
        💾 {savingStatus}
      </span>
    );
  }

return (
  <>
    <NoticeModal notice={notice} onClose={() => setNotice(null)} />

    <ConfirmRegenerationModal
      confirmation={regenerationConfirm}
      onCancel={() => setRegenerationConfirm(null)}
      onConfirm={confirmRegeneration}
    />

    {participantImportOpen && createPortal(
      <ParticipantImportModal
        type={tournament.type}
        data={data}
        knownRegistry={arenaGenderRegistry}
        onClose={() => setParticipantImportOpen(false)}
        onApply={importParticipants}
      />,
      document.body
    )}

    {courtEditor && courtEditorGame && createPortal(
      <CourtAssignmentModal
        editor={{ ...courtEditor, game: courtEditorGame }}
        courtNumbers={operationalCourtNumbers}
        unavailableNumbers={[...unavailableCentralCourtNumbers]}
        currentNumber={getGameCourtNumber(courtEditorGame, displayedCourtNumbers)}
        usedNumbers={courtEditorUsedNumbers}
        onSelect={requestGameCourtNumber}
        onClose={() => setCourtEditor(null)}
      />,
      document.body
    )}

    {courtDuplicateConfirm && createPortal(
      <ConfirmDuplicateCourtModal
        kind={courtDuplicateConfirm.kind}
        number={courtDuplicateConfirm.number}
        onCancel={cancelDuplicateCourtNumber}
        onConfirm={confirmDuplicateCourtNumber}
      />,
      document.body
    )}

    {courtOccupancyConflict && createPortal(
      <CourtOccupancyModal
        conflict={courtOccupancyConflict}
        onChoose={resolveCourtOccupancyConflict}
      />,
      document.body
    )}

    {participantOccupancyConflict && createPortal(
      <ParticipantOccupancyModal
        conflict={participantOccupancyConflict}
        onChoose={resolveParticipantOccupancyConflict}
      />,
      document.body
    )}

    {tieBreakDraw && createPortal(
      <TieBreakDrawOverlay
        draw={tieBreakDraw}
        onClose={() => setTieBreakDraw(null)}
      />,
      document.body
    )}

    {shuffleVideoSnapshot && createPortal(
      <ShuffleVideoModal
        snapshot={shuffleVideoSnapshot}
        arenaName={data.publicInfo?.organizer?.arenaName || data.publicInfo?.organizer?.organizerName || "Arena Torneio360"}
        arenaPhotoUrl={data.publicInfo?.organizer?.photoUrl || ""}
        createVideoFile={createShuffleVideoFileOnDemand}
        downloadVideo={downloadShuffleVideoOnDemand}
        onClose={() => setShuffleVideoSnapshot(null)}
      />,
      document.body
    )}

    <ConfirmClearScoresModal
      open={clearScoresOpen}
      onCancel={() => setClearScoresOpen(false)}
      onConfirm={clearScores}
    />

    <ConfirmClearTableModal
      open={clearTableOpen}
      onCancel={() => setClearTableOpen(false)}
      onConfirm={clearTable}
    />

    {shuffleOverlay && createPortal(
      <div className="shuffleOverlay" role="dialog" aria-modal="true" aria-label="Sorteio dos participantes">
        <div className="shuffleBox">
          <div className="shuffleHeader">
            <div>
              <span className="shuffleEyebrow">Sorteio em andamento</span>
              <h2>{isCupType(config) ? "Sorteando grupos..." : "Sorteando nomes..."}</h2>
              <p>Os participantes estão trocando de posição até a formação final.</p>
            </div>

            <div className="shuffleTimer" aria-live="polite">{shuffleOverlay.seconds}s</div>
          </div>

          <div className="shuffleStage">
            {shuffleOverlay.items.map((item) => (
              <div
                className="floatingName"
                key={item.id}
                title={item.name}
                style={{
                  left: `${item.left}%`,
                  top: `${item.top}%`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
              >
                <span>{item.name}</span>
              </div>
            ))}
          </div>

          <div className="shuffleProgress">
            <div />
          </div>
        </div>
      </div>,
      document.body
    )}

    <div className="appPage">
      <header className={`tournamentWorkspaceHeader ${headerDetailsOpen ? "detailsOpen" : ""}`}>
        <div>
          <div className="tournamentHeaderTitleRow">
            <h1>{tournament.name}</h1>
          </div>
          <div className="tournamentHeaderMeta" id="tournament-header-details">
            <span><Trophy aria-hidden="true" /> {getModalityDisplayName(tournament.type)}</span>
            {data.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> Várias categorias</span> : null}
            {getTournamentClassificationLabels(data).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
            {data.eventPeriodLabel || data.eventDate ? <span><CalendarDays aria-hidden="true" /> {data.eventPeriodLabel || formatDateBR(data.eventDate)}</span> : null}
            {data.eventDay ? <span><CalendarDays aria-hidden="true" /> {data.eventDay}</span> : null}
            {data.registrationDeadline ? <span><CalendarDays aria-hidden="true" /> Inscrições até {formatDateBR(data.registrationDeadline)}</span> : null}
            {data.eventStartTime ? <span><Clock3 aria-hidden="true" /> Início {data.eventStartTime}</span> : null}
            {data.dailyStartTimes && Object.keys(data.dailyStartTimes).length > 0 ? (
              <span><Clock3 aria-hidden="true" /> Horários por dia definidos</span>
            ) : null}
            {data.location ? <span><MapPin aria-hidden="true" /> {data.location}</span> : null}
            {data.winningScore ? <span><Target aria-hidden="true" /> {data.winningScore} games</span> : null}
          </div>
        </div>

        <div className="actions tournamentHeaderActions">
          <button
            type="button"
            className="tournamentHeaderDetailsToggle"
            onClick={() => setHeaderDetailsOpen((open) => !open)}
            aria-controls="tournament-header-details"
            aria-expanded={headerDetailsOpen}
          >
            Informações <ChevronDown aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tournamentHeaderShareButton"
            onClick={sharePublicLink}
          >
            <Share2 aria-hidden="true" /> Compartilhar
          </button>
          <button type="button" onClick={handleBack}>Voltar</button>
        </div>
      </header>

        <nav className="tournamentTopTabs" aria-label="Organização do torneio">
          <button type="button" className={activeTournamentTab === "participantes" ? "active" : ""} onClick={() => setActiveTournamentTab("participantes")}><Users aria-hidden="true" /> Organização</button>
          {isCupType(config) && (
            <button type="button" className={activeTournamentTab === "grupos" ? "active" : ""} onClick={() => setActiveTournamentTab("grupos")}><Grid3X3 aria-hidden="true" /> Grupos</button>
          )}
          <button type="button" className={activeTournamentTab === "partidas" ? "active" : ""} onClick={() => setActiveTournamentTab("partidas")}><Flame aria-hidden="true" /> Partidas</button>
          <button type="button" className={activeTournamentTab === "ranking" ? "active" : ""} onClick={() => setActiveTournamentTab("ranking")}><Trophy aria-hidden="true" /> Ranking</button>
        </nav>

        <section className="card" style={{ display: activeTournamentTab === "participantes" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>Organização do torneio</h2>
            <SavingStatusBadge />
          </div>

          <nav className="organizationSubTabs" aria-label="Configuração do torneio">
            {supportsTournamentFormatConfiguration ? (
              <button type="button" className={activeOrganizationTab === "formato" ? "active" : ""} onClick={() => setActiveOrganizationTab("formato")}>Formato do torneio</button>
            ) : null}
            <button type="button" className={activeOrganizationTab === "participantes" ? "active" : ""} onClick={() => setActiveOrganizationTab("participantes")}>Participantes</button>
            <button type="button" className="organizationCourtCenterShortcut" onClick={onOpenCourtCenter}><Grid3X3 aria-hidden="true" /> Quadras</button>
          </nav>

          <div className="organizationPanel" style={{ display: activeOrganizationTab === "formato" ? undefined : "none" }}>
          {isCupType(config) && (
            <CupConfigPanel
              data={data}
              config={config}
              updateCupConfig={updateCupConfig}
            />
          )}

          {isFlexibleSimpleType(config) && (
            <SimpleConfigPanel
              data={data}
              config={config}
              onPlayerCountChange={requestSimplePlayerCount}
            />
          )}

          {isReizinhoType(config) && (
            <ReizinhoConfigPanel
              data={data}
              config={config}
              onPlayerCountChange={requestReizinhoPlayerCount}
            />
          )}
          </div>

          <div className="organizationPanel" style={{ display: activeOrganizationTab === "participantes" ? undefined : "none" }}>
          <div className="participantImportBar">
            <div>
              <strong><ClipboardPaste aria-hidden="true" /> Preencher vários participantes</strong>
              <p>Cole uma lista do WhatsApp ou de outro lugar, use nome e sobrenome e confira as vagas antes de aplicar.</p>
            </div>

            <div className="participantImportActions">
              {participantImportBackup && (
                <button type="button" className="secondaryBtn" onClick={undoParticipantImport}>
                  <Undo2 aria-hidden="true" /> Desfazer importação
                </button>
              )}
              <button type="button" onClick={() => setParticipantImportOpen(true)}>
                <ClipboardPaste aria-hidden="true" /> Colar lista
              </button>
            </div>
          </div>

          <div className="participantAttendanceToolbar">
            <div>
              <strong>Presença no local</strong>
              <span>{participantAttendanceEntries.length - pendingParticipantEntries.length} de {participantAttendanceEntries.length} confirmados</span>
            </div>
            <div className="participantAttendanceBulkActions">
              <button type="button" className="confirmAllParticipantsBtn" onClick={() => setAllParticipantAttendance(true)}>
                Confirmar todos
              </button>
              <button type="button" className="pendingAllParticipantsBtn" onClick={() => setAllParticipantAttendance(false)}>
                Marcar todos como pendentes
              </button>
            </div>
          </div>

          <PlayerInputs
            type={tournament.type}
            data={data}
            updatePlayer={updatePlayer}
            updateParticipantAttendance={updateParticipantAttendance}
          />

          {!isCupType(config) && (
            <div className="actions">
              <button type="button" className="actionShuffleBtn" onClick={requestShuffleNames}>Sortear nomes</button>
              <button type="button" className="actionGenerateBtn" onClick={requestGenerate}>Criar rodadas e jogos</button>
              {data.namesShuffled && data.lastShuffleVideo ? (
                <button type="button" className="shuffleVideoReopenButton" onClick={() => setShuffleVideoSnapshot(data.lastShuffleVideo)}>
                  <Share2 aria-hidden="true" /> Vídeo do último sorteio
                </button>
              ) : null}
            </div>
          )}
          </div>
        </section>

        {isCupType(config) && (
          <section className="card" style={{ display: activeTournamentTab === "grupos" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Grupos</h2>
              <SavingStatusBadge />
            </div>
            <p>Use o sorteio para embaralhar os participantes e depois gere a fase de grupos.</p>
            <div className="actions">
              <button type="button" className="actionShuffleBtn" onClick={requestShuffleNames}>Sortear grupos</button>
              <button type="button" className="actionGenerateBtn" onClick={requestGenerate}>Gerar fase de grupos</button>
              {data.groupsShuffled && data.lastShuffleVideo ? (
                <button type="button" className="shuffleVideoReopenButton" onClick={() => setShuffleVideoSnapshot(data.lastShuffleVideo)}>
                  <Share2 aria-hidden="true" /> Vídeo do último sorteio
                </button>
              ) : null}
            </div>
            {cupGroupRankings.length > 0 && (
              <div className="groupsPreviewBox">
                {(isCopinhaData(data) || isCearenseData(data)) && (
                  <CopinhaTieBreakPanel
                    groupRankings={cupGroupRankings}
                    onResolveTie={resolveCopinhaTie}
                    groupCampaignTies={copinhaGroupCampaignTies}
                    onResolveGroupTie={resolveCopinhaGroupTie}
                    campaignTies={cearenseCampaignTies}
                    onResolveCampaignTie={resolveCearenseCampaignTie}
                    isCearense={isCearenseData(data)}
                    isOfficialCearense={isCampeonatoCearenseData(data)}
                    drawInProgress={tieBreakDraw?.phase === "drawing"}
                  />
                )}
                <h3>Classificação dos grupos</h3>
                <CupGroupRankingView
                  groupRankings={cupGroupRankings}
                  rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
                />
              </div>
            )}
          </section>
        )}

        <section className="card tournamentMatchesSection" style={{ display: activeTournamentTab === "partidas" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>{isCupType(config) ? "Partidas" : "Rodadas"}</h2>
            <SavingStatusBadge />
          </div>
          {isCupType(config) && (
            <div className="matchesSubTabs">
              <button type="button" className={activeMatchesTab === "grupos" ? "active" : ""} onClick={() => setActiveMatchesTab("grupos")}>Fase de grupos</button>
              <button type="button" className={activeMatchesTab === "chaves" ? "active" : ""} onClick={() => setActiveMatchesTab("chaves")}>Chaves finais</button>
              {secondParallelVisible ? <button type="button" className={activeMatchesTab === "paralela" ? "active" : ""} onClick={() => setActiveMatchesTab("paralela")}>{firstParallelDisplayName}</button> : null}
              {sunsetSecondParallelVisible ? <button type="button" className={activeMatchesTab === "paralela2" ? "active" : ""} onClick={() => setActiveMatchesTab("paralela2")}>{sunsetSecondParallelDisplayName}</button> : null}
              {thirdParallelVisible ? (
                <button type="button" className={activeMatchesTab === "paralela3" ? "active" : ""} onClick={() => setActiveMatchesTab("paralela3")}>{laterParallelDisplayName}</button>
              ) : null}
              {sunsetFinalVisible ? <button type="button" className={activeMatchesTab === "sunset" ? "active" : ""} onClick={() => setActiveMatchesTab("sunset")}>{sunsetFinalDisplayName}</button> : null}
            </div>
          )}
          <div style={{ display: !isCupType(config) || activeMatchesTab === "grupos" ? undefined : "none" }}>

          {!data.schedule || data.schedule.length === 0 ? (
            <p>Clique em “Criar rodadas e jogos” para montar os jogos.</p>
          ) : (
            <>
             <ScheduleView
  key={`${tournament.id}:${activeTournamentTab}:${activeMatchesTab}`}
  schedule={data.schedule}
  statusData={data}
  updateScore={updateScore}
  onStatusToggle={toggleScheduleGameStatus}
  showGroupName={isCupType(config)}
  voiceRepeat={voiceRepeat}
  setVoiceRepeat={setVoiceRepeat}
  winningScore={getWinningScore(data)}
  courtNumbers={displayedCourtNumbers}
  onEditCourt={requestCourtAssignment}
/>

              <div className="actions">
                <button
                  type="button"
                  className="deleteBtn"
                  onClick={() => setClearScoresOpen(true)}
                >
                  Apagar somente os placares
                </button>

                <button
                  type="button"
                  className="deleteBtn"
                  onClick={() => setClearTableOpen(true)}
                >
                  Apagar todos os jogos e placares
                </button>
              </div>
            </>
          )}
          </div>
        </section>

        {isCupType(config) ? (
          <>
            <section className="card" style={{ display: "none" }}>
              <h2>Classificação dos grupos</h2>

              <CupGroupRankingView
                groupRankings={cupGroupRankings}
                rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
              />

              <div className="actions">
                <button type="button" className="actionGenerateBtn" onClick={requestGenerateBrackets}>
                  Gerar chaves finais
                </button>
              </div>
            </section>

            <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "chaves" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>Chaves finais</h2>
                <div className="cardTitleControls">
                  {currentBrackets && (
                    <button type="button" className="secondaryBtn compactRegenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves novamente
                    </button>
                  )}
                  <SavingStatusBadge />
                </div>
              </div>

              {!currentBrackets ? (
                <>
                  <p>
                    Após preencher todos os placares da fase de grupos, clique em
                    “Gerar chaves finais”.
                  </p>

                  <div className="actions">
                    <button type="button" className="actionGenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves finais
                    </button>
                  </div>
                </>
              ) : (
            <>
  <CupBracketView
    groupedBrackets={{ main: currentBrackets.main, repechage: [] }}
    data={data}
    updateBracketScore={updateBracketScore}
    toggleBracketGameStatus={toggleBracketGameStatus}
    voiceRepeat={voiceRepeat}
    setVoiceRepeat={setVoiceRepeat}
    winningScore={getWinningScore(data)}
    courtNumbers={displayedCourtNumbers}
    onEditCourt={requestCourtAssignment}
  />

</>
              )}
            </section>

            <section className="card" style={{ display: activeTournamentTab === "ranking" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>Ranking</h2>
                <div className="cardTitleControls">
                  {mainCupPodium.length === 0 ? <TournamentCircuitButton {...tournamentCircuitAction} /> : null}
                  <SavingStatusBadge />
                </div>
              </div>

              <TournamentTimingSummary data={data} />

              <div className="cupRankingSplit">
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.mainBracketName || "Chave Principal"}</h3>
                  {mainCupPodium.length > 0 ? (
                    <CupPodiumView podium={mainCupPodium} title={data.cupConfig?.mainBracketName || "Principal"} shareContext={tournamentRankingShareContext} circuitAction={tournamentCircuitAction} />
                  ) : (
                    <p>Finalize a chave principal para ver o ranking da chave principal.</p>
                  )}
                </div>

                {secondParallelVisible ? <div className="cupRankingPanel">
                  <h3>{firstParallelDisplayName}</h3>
                  {isCopinhaData(data) ? (
                    data.cupConfig?.teamCount === 6 ? (
                      <p>Com 2 grupos, não há consolação neste formato.</p>
                    ) : consolationCupPodium.length > 0 ? (
                      <CupPodiumView
                        podium={consolationCupPodium}
                        title={data.cupConfig?.repechageName || "Consolação"}
                        variant="parallel"
                        shareContext={tournamentRankingShareContext}
                      />
                    ) : (
                      <p>Finalize a consolação para ver o pódio.</p>
                    )
                  ) : parallelRanking.length > 0 ? (
                    <CupPodiumView
                      podium={parallelRanking.slice(0, 3).map((item, index) => ({
                        position: index === 0 ? "🏆 Campeão" : index === 1 ? "🥈 Vice" : "🥉 3º lugar",
                        name: item.name,
                        playTimeSeconds: item.playTimeSeconds,
                      }))}
                      title={firstParallelDisplayName}
                      variant="parallel"
                      shareContext={tournamentRankingShareContext}
                    />
                  ) : (
                    <p>Gere ou finalize a disputa paralela para ver o ranking separado.</p>
                  )}
                </div> : null}
                {sunsetSecondParallelVisible ? (
                  <div className="cupRankingPanel">
                    <h3>{sunsetSecondParallelDisplayName}</h3>
                    {secondParallelPodium.length > 0 ? (
                      <CupPodiumView podium={secondParallelPodium} title={sunsetSecondParallelDisplayName} variant="parallel" shareContext={tournamentRankingShareContext} />
                    ) : (
                      <p>Finalize a 2ª disputa paralela para ver o pódio.</p>
                    )}
                  </div>
                ) : null}
                {thirdParallelVisible ? (
                  <div className="cupRankingPanel">
                    <h3>{laterParallelDisplayName}</h3>
                    {thirdParallelPodium.length > 0 ? (
                      <CupPodiumView
                        podium={thirdParallelPodium}
                        title={laterParallelDisplayName}
                        variant="parallel"
                        shareContext={tournamentRankingShareContext}
                      />
                    ) : (
                      <p>Finalize a {laterParallelOrdinal} disputa paralela para ver o pódio.</p>
                    )}
                  </div>
                ) : null}
                {sunsetFinalVisible ? (
                  <div className="cupRankingPanel">
                    <h3>{sunsetFinalDisplayName}</h3>
                    {sunsetPodium.length > 0 ? (
                      <CupPodiumView podium={sunsetPodium} title={sunsetFinalDisplayName} shareContext={tournamentRankingShareContext} />
                    ) : (
                      <p>Finalize o encontro entre as campeãs para ver o pódio Sunset.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {secondParallelVisible ? <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "paralela" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>{firstParallelDisplayName}</h2>
                <div className="cardTitleControls">
                  {currentBrackets && (
                    <button type="button" className="secondaryBtn compactRegenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves novamente
                    </button>
                  )}
                  <SavingStatusBadge />
                </div>
              </div>
              {!currentBrackets ? (
                <>
                  <p>Gere as chaves finais para visualizar a disputa paralela.</p>

                  <div className="actions">
                    <button type="button" className="actionGenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves finais
                    </button>
                  </div>
                </>
              ) : currentBrackets.repechage?.length > 0 ? (
                <CupBracketView groupedBrackets={{ main: [], repechage: currentBrackets.repechage }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} courtNumbers={displayedCourtNumbers} onEditCourt={requestCourtAssignment} />
              ) : (
                <p>{isPlayRankingData(data)
                  ? "A Disputa Paralela será montada automaticamente quando todos os placares da primeira fase da Eliminatória Principal estiverem preenchidos."
                  : "Com 2 grupos, a Copinha segue o modelo da planilha e não possui chave de consolação."}</p>
              )}
            </section> : null}

            {sunsetSecondParallelVisible ? (
              <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "paralela2" ? undefined : "none" }}>
                <div className="cardTitleRow">
                  <h2>{sunsetSecondParallelDisplayName}</h2>
                  <SavingStatusBadge />
                </div>
                {!currentBrackets ? (
                  <p>Gere as chaves finais para visualizar a 2ª disputa paralela.</p>
                ) : currentBrackets.secondParallel?.length > 0 ? (
                  <CupBracketView groupedBrackets={{ main: [], repechage: [], secondParallel: currentBrackets.secondParallel }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} courtNumbers={displayedCourtNumbers} onEditCourt={requestCourtAssignment} />
                ) : (
                  <p>Sem eliminadas suficientes nas oitavas, a vice-campeã da Principal ocupará automaticamente esta vaga.</p>
                )}
              </section>
            ) : null}

            {thirdParallelVisible ? (
              <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "paralela3" ? undefined : "none" }}>
                <div className="cardTitleRow">
                  <h2>{laterParallelDisplayName}</h2>
                  <SavingStatusBadge />
                </div>
                {!currentBrackets ? (
                  <p>Gere as chaves finais para visualizar a {laterParallelOrdinal} disputa paralela.</p>
                ) : currentBrackets.thirdParallel?.length > 0 ? (
                  <CupBracketView groupedBrackets={{ main: [], repechage: [], thirdParallel: currentBrackets.thirdParallel }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} courtNumbers={displayedCourtNumbers} onEditCourt={requestCourtAssignment} />
                ) : (
                  <p>Nesta quantidade de grupos não há duplas elegíveis para a {laterParallelOrdinal} disputa paralela.</p>
                )}
              </section>
            ) : null}

            {sunsetFinalVisible ? (
              <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "sunset" ? undefined : "none" }}>
                <div className="cardTitleRow">
                  <h2>{sunsetFinalDisplayName}</h2>
                  <SavingStatusBadge />
                </div>
                {!currentBrackets ? (
                  <p>Gere as chaves finais para visualizar o encontro entre as campeãs.</p>
                ) : currentBrackets.sunsetFinal?.length > 0 ? (
                  <CupBracketView groupedBrackets={{ main: [], repechage: [], sunsetFinal: currentBrackets.sunsetFinal }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} courtNumbers={displayedCourtNumbers} onEditCourt={requestCourtAssignment} />
                ) : (
                  <p>A etapa Sunset aparecerá quando houver ao menos duas chaves capazes de produzir campeãs.</p>
                )}
              </section>
            ) : null}
          </>
        ) : (
          <section className="card" style={{ display: activeTournamentTab === "ranking" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Ranking do dia</h2>
              <SavingStatusBadge />
            </div>

            <TournamentTimingSummary data={data} />

            <RankingView
              ranking={ranking}
              type={tournament.type}
              rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
              shareContext={tournamentRankingShareContext}
              circuitAction={tournamentCircuitAction}
            />
          </section>
        )}
      </div>
    </>
  );
}

  return { Dashboard, TournamentScreen };
}

export default function OrganizerWorkspaceDashboard({ supabase, ...dashboardProps }) {
  const { Dashboard } = useMemo(() => createOrganizerWorkspace({ supabase }), [supabase]);
  return <Dashboard {...dashboardProps} />;
}
