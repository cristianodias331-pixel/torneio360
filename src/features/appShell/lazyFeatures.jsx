import React from "react";

function lazyNamed(importer, exportName) {
  return React.lazy(() => importer().then((module) => ({ default: module[exportName] })));
}

export const CupBracketViewComponent = React.lazy(() => import("../brackets/CupBracketView.jsx"));
export const PublicCupBracketView = lazyNamed(
  () => import("../brackets/PublicBracketView.jsx"),
  "PublicCupBracketView"
);
export const PublicScheduleView = lazyNamed(
  () => import("../brackets/PublicBracketView.jsx"),
  "PublicScheduleView"
);
export const PublicArenaPageController = React.lazy(
  () => import("../publicArena/PublicArenaPageController.jsx")
);
export const PublicTournamentPageController = React.lazy(
  () => import("../publicArena/PublicTournamentPageController.jsx")
);
export const PublicCircuitScreenView = React.lazy(
  () => import("../publicArena/PublicCircuitScreen.jsx")
);
export const PublicTournamentScreenView = React.lazy(
  () => import("../publicArena/PublicTournamentScreen.jsx")
);
export const PublicPlatformHomeController = React.lazy(
  () => import("../publicArena/PublicPlatformHomeController.jsx")
);
export const PublicExploreSection = lazyNamed(
  () => import("../publicArena/PublicPlatformHomeController.jsx"),
  "PublicExploreSection"
);
export const PublicMemberProfilePageView = React.lazy(
  () => import("../profile/PublicMemberProfilePage.jsx")
);
export const MemberProfileWorkspaceView = React.lazy(
  () => import("../profile/MemberProfileWorkspace.jsx")
);
export const OrganizerWorkspaceDashboard = React.lazy(
  () => import("../../OrganizerWorkspace.jsx")
);
export const LoginScreen = React.lazy(() => import("../auth/LoginScreen.jsx"));
export const EmailConfirmationPendingScreen = lazyNamed(
  () => import("../auth/LoginScreen.jsx"),
  "EmailConfirmationPendingScreen"
);
export const CourtCenterModalView = React.lazy(() => import("../courtCenter/CourtCenterModal.jsx"));
export const ModalityPicker = React.lazy(() => import("../modalityPicker/ModalityPicker.jsx"));
export const ConfirmDuplicateCourtModal = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "ConfirmDuplicateCourtModal"
);
export const CourtAssignmentModal = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "CourtAssignmentModal"
);
export const CourtBadge = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "CourtBadge"
);
export const CourtConfigPanel = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "CourtConfigPanel"
);
export const CourtOccupancyModal = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "CourtOccupancyModal"
);
export const ParticipantOccupancyModal = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "ParticipantOccupancyModal"
);
export const VoiceRepeatSelector = lazyNamed(
  () => import("../matchOperations/MatchControls.jsx"),
  "VoiceRepeatSelector"
);
export const ScheduleViewView = React.lazy(() => import("../matchOperations/MatchSchedule.jsx"));
export const ParticipantImportModalView = React.lazy(
  () => import("../participantManagement/ParticipantManagement.jsx")
);
export const PlayerInputsView = lazyNamed(
  () => import("../participantManagement/ParticipantManagement.jsx"),
  "PlayerInputs"
);
export const RankingViewView = React.lazy(() => import("../ranking/RankingTables.jsx"));
export const RankingTableView = lazyNamed(
  () => import("../ranking/RankingTables.jsx"),
  "RankingTable"
);
export const CupPodiumView = React.lazy(() => import("../ranking/CupPodiumView.jsx"));
export const CopinhaTieBreakPanel = lazyNamed(
  () => import("../ranking/TieBreakPanels.jsx"),
  "CopinhaTieBreakPanel"
);
export const CupGroupRankingView = lazyNamed(
  () => import("../ranking/TieBreakPanels.jsx"),
  "CupGroupRankingView"
);
export const TieBreakDrawOverlay = lazyNamed(
  () => import("../ranking/TieBreakPanels.jsx"),
  "TieBreakDrawOverlay"
);
export const RankingShareButton = React.lazy(() => import("../rankingShare/RankingShareButton.jsx"));
export const TournamentWorkspaceTabsView = React.lazy(
  () => import("../tournamentWorkspace/TournamentWorkspaceTabs.jsx")
);
export const CupConfigPanelView = React.lazy(
  () => import("../tournamentConfig/TournamentFormatPanels.jsx")
);
export const ReizinhoConfigPanel = lazyNamed(
  () => import("../tournamentConfig/TournamentFormatPanels.jsx"),
  "ReizinhoConfigPanel"
);
export const SimpleConfigPanelView = lazyNamed(
  () => import("../tournamentConfig/TournamentFormatPanels.jsx"),
  "SimpleConfigPanel"
);
export const TournamentFormatInfoButtonView = React.lazy(
  () => import("../tournamentConfig/TournamentFormatHelp.jsx")
);
export const ParallelDisputeChoiceView = lazyNamed(
  () => import("../tournamentConfig/TournamentFormatHelp.jsx"),
  "ParallelDisputeChoice"
);
export const FormatExplanationButton = React.lazy(
  () => import("../tournamentConfig/FormatExplanationButton.jsx")
);
export const SimpleFormatInfoButton = lazyNamed(
  () => import("../tournamentConfig/FormatExplanationButton.jsx"),
  "SimpleFormatInfoButton"
);
export const TournamentGenderSelector = React.lazy(
  () => import("../tournamentConfig/TournamentGenderSelector.jsx")
);
export const CircuitExtraPointsPanel = React.lazy(
  () => import("../circuitManagement/CircuitExtraPointsPanel.jsx")
);
export const CircuitGenderRegistryPanel = lazyNamed(
  () => import("../circuitManagement/CircuitRankingSettings.jsx"),
  "CircuitGenderRegistryPanel"
);
export const CircuitRankingSettingsEditor = lazyNamed(
  () => import("../circuitManagement/CircuitRankingSettings.jsx"),
  "CircuitRankingSettingsEditor"
);
export const TournamentCircuitButton = lazyNamed(
  () => import("../circuitManagement/TournamentCircuitManager.jsx"),
  "TournamentCircuitButton"
);
export const TournamentCircuitManagerModal = lazyNamed(
  () => import("../circuitManagement/TournamentCircuitManager.jsx"),
  "TournamentCircuitManagerModal"
);
export const ConfirmCircuitDeleteModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmCircuitDeleteModal"
);
export const ConfirmClearScoresModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmClearScoresModal"
);
export const ConfirmClearTableModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmClearTableModal"
);
export const ConfirmEventGroupModalityChangeModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmEventGroupModalityChangeModal"
);
export const ConfirmModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmModal"
);
export const ConfirmModalityChangeModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmModalityChangeModal"
);
export const ConfirmRegenerationModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmRegenerationModal"
);
export const ConfirmTrashPermanentDeleteModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "ConfirmTrashPermanentDeleteModal"
);
export const NoticeModal = lazyNamed(
  () => import("../dialogs/ConfirmationDialogs.jsx"),
  "NoticeModal"
);
export const ShuffleVideoModal = React.lazy(() => import("../media/ShuffleVideoModal.jsx"));
export const StoryCoverEditor = React.lazy(() => import("../media/StoryCoverEditor.jsx"));

export async function createShuffleVideoFileOnDemand(options) {
  const module = await import("../media/shuffleVideoExport.mjs");
  return module.createShuffleVideoFile(options);
}

export async function downloadShuffleVideoOnDemand(file) {
  const module = await import("../media/shuffleVideoExport.mjs");
  return module.downloadShuffleVideo(file);
}

export async function speakBracketRound(...args) {
  const module = await import("../matchOperations/speechAnnouncements.mjs");
  return module.speakBracketRound(...args);
}

export async function speakGame(...args) {
  const module = await import("../matchOperations/speechAnnouncements.mjs");
  return module.speakGame(...args);
}

export async function speakRound(...args) {
  const module = await import("../matchOperations/speechAnnouncements.mjs");
  return module.speakRound(...args);
}

export async function stopSpeech(...args) {
  const module = await import("../matchOperations/speechAnnouncements.mjs");
  return module.stopSpeech(...args);
}
