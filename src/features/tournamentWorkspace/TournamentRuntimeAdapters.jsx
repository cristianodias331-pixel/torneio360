import React, { useEffect, useState } from "react";
import {
  CourtCenterModalView,
  CupBracketViewComponent,
  CupConfigPanelView,
  FormatExplanationButton,
  ParallelDisputeChoiceView,
  ParticipantImportModalView,
  PlayerInputsView,
  RankingTableView,
  RankingViewView,
  ScheduleViewView,
  SimpleConfigPanelView,
  SimpleFormatInfoButton,
  TournamentCircuitButton,
  TournamentFormatInfoButtonView,
  TournamentWorkspaceTabsView,
  speakBracketRound,
  speakGame,
  speakRound,
  stopSpeech,
} from "../appShell/lazyFeatures.jsx";
import {
  TournamentMatchStatusSummaryView,
  TournamentTimingSummaryView,
} from "../matchOperations/TournamentSummaryViews.jsx";
import { buildCircuitRankingGroups } from "../../domain/circuitRankingAggregation.mjs";
import { getCearenseFormatSummary } from "../../domain/cupFormatSummary.mjs";
import {
  getTournamentVenueKey,
  getTournamentVenueLabel,
  normalizeCourtCenterEntry,
} from "../../domain/localAppStorage.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import {
  defaultRankingCriteria,
} from "../../domain/rankingCriteria.mjs";
import { formatMatchTotalDuration } from "../../domain/matchTimer.mjs";
import { getWinningScore, isGameFinished } from "../../domain/scoreRules.mjs";
import {
  calculateCircuitTournamentRankingRows,
  calculateTournamentRanking,
} from "../../domain/tournamentRanking.mjs";

export function createTournamentRuntimeAdapters({
  getTournamentMatchStatusSummary,
  getTournamentOperationalGames,
  getTournamentTimingSummary,
}) {
  function TournamentTimingSummary({ data, compact = false }) {
    const winningScore = getWinningScore(data);
    const hasActiveTimer = getTournamentOperationalGames(data).some((item) => {
      const game = item.storedGame || item.game;
      return !isGameFinished(item.game, winningScore)
        && !game?.matchTimerFinishedAt
        && game?.inProgress === true
        && Boolean(game?.matchTimerStartedAt);
    });
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
      setNow(Date.now());
      if (!hasActiveTimer) return undefined;
      const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(intervalId);
    }, [hasActiveTimer, data]);

    const summary = getTournamentTimingSummary(data, now);
    return (
      <TournamentTimingSummaryView
        summary={summary}
        compact={compact}
        formatDuration={formatMatchTotalDuration}
      />
    );
  }

  function TournamentMatchStatusSummary({
    data,
    compact = false,
    vertical = false,
    scope = "all",
    bracketMatchKeys = null,
  }) {
    const summary = getTournamentMatchStatusSummary(data, { scope, bracketMatchKeys });
    return (
      <TournamentMatchStatusSummaryView
        summary={summary}
        compact={compact}
        vertical={vertical}
      />
    );
  }

  function TournamentWorkspaceTabs(props) {
    return <TournamentWorkspaceTabsView {...props} MatchStatusSummary={TournamentMatchStatusSummary} />;
  }

  function CourtCenterModal(props) {
    return (
      <CourtCenterModalView
        {...props}
        modalityConfig={modalityConfig}
        getTournamentVenueKey={getTournamentVenueKey}
        getTournamentVenueLabel={getTournamentVenueLabel}
        normalizeCourtCenterEntry={normalizeCourtCenterEntry}
      />
    );
  }

  function ParallelDisputeChoice(props) {
    return (
      <ParallelDisputeChoiceView
        {...props}
        getCearenseFormatSummary={getCearenseFormatSummary}
        FormatExplanationButton={FormatExplanationButton}
      />
    );
  }

  function TournamentFormatInfoButton(props) {
    return (
      <TournamentFormatInfoButtonView
        {...props}
        getCearenseFormatSummary={getCearenseFormatSummary}
      />
    );
  }

  function SimpleConfigPanel(props) {
    return <SimpleConfigPanelView {...props} SimpleFormatInfoButton={SimpleFormatInfoButton} />;
  }

  function CupConfigPanel(props) {
    return (
      <CupConfigPanelView
        {...props}
        TournamentFormatInfoButton={TournamentFormatInfoButton}
        ParallelDisputeChoice={ParallelDisputeChoice}
      />
    );
  }

  function ParticipantImportModal(props) {
    return <ParticipantImportModalView {...props} modalityConfig={modalityConfig} />;
  }

  function PlayerInputs(props) {
    return <PlayerInputsView {...props} modalityConfig={modalityConfig} />;
  }

  function ScheduleView(props) {
    void import("../matchOperations/speechAnnouncements.mjs");
    return (
      <ScheduleViewView
        {...props}
        speakGame={speakGame}
        speakRound={speakRound}
        stopSpeech={stopSpeech}
        MatchStatusSummary={TournamentMatchStatusSummary}
      />
    );
  }

  function calculateRanking(data, type, rankingCriteriaValue = defaultRankingCriteria) {
    const config = modalityConfig[type];
    return calculateTournamentRanking({
      data,
      config,
      rankingCriteriaValue,
      timingComplete: getTournamentTimingSummary(data).complete,
    });
  }

  function calculateCircuitTournamentRanking(data, type, rankingCriteriaValue = defaultRankingCriteria) {
    const config = modalityConfig[type];
    return calculateCircuitTournamentRankingRows({
      data,
      config,
      rankingCriteriaValue,
      timingComplete: getTournamentTimingSummary(data).complete,
    });
  }

  function buildPublicCircuitRankingGroups(circuit, tournaments = []) {
    return buildCircuitRankingGroups({
      circuit,
      tournaments,
      modalityConfigs: modalityConfig,
      getTimingComplete: (tournament) => getTournamentTimingSummary(tournament?.data || {}).complete,
    });
  }

  function RankingView(props) {
    return <RankingViewView {...props} modalityConfig={modalityConfig} CircuitButton={TournamentCircuitButton} />;
  }

  function RankingTable(props) {
    return <RankingTableView {...props} CircuitButton={TournamentCircuitButton} />;
  }

  function CupBracketView(props) {
    // A voz precisa estar carregada antes do toque. Em celulares, aguardar o
    // import depois do clique pode perder a ativação exigida pelo navegador.
    void import("../matchOperations/speechAnnouncements.mjs");
    return (
      <CupBracketViewComponent
        {...props}
        speakGame={speakGame}
        speakBracketRound={speakBracketRound}
        stopSpeech={stopSpeech}
        MatchStatusSummary={TournamentMatchStatusSummary}
      />
    );
  }

  return {
    CupBracketView,
    CupConfigPanel,
    CourtCenterModal,
    ParticipantImportModal,
    PlayerInputs,
    RankingTable,
    RankingView,
    ScheduleView,
    SimpleConfigPanel,
    TournamentFormatInfoButton,
    TournamentMatchStatusSummary,
    TournamentTimingSummary,
    TournamentWorkspaceTabs,
    buildPublicCircuitRankingGroups,
    calculateCircuitTournamentRanking,
    calculateRanking,
  };
}
