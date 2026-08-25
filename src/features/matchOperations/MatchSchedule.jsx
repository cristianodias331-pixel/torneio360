import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import "../../styles/31-matches-and-brackets.css";
import { getGameCourtLabel } from "../../domain/courtNumbers.mjs";
import {
  formatMatchDuration,
  getMatchElapsedSeconds,
} from "../../domain/matchTimer.mjs";
import {
  getMaxScore,
  getScoreWinnerSide,
} from "../../domain/scoreRules.mjs";
import { getGameSideAttendanceParticipants } from "../../domain/participantAttendance.mjs";
import { CourtBadge, VoiceRepeatSelector } from "./MatchControls.jsx";

const SCHEDULE_STATUS_FILTERS = [
  { value: "all", label: "Todos", summaryKey: "total" },
  { value: "in-progress", label: "Em jogo", summaryKey: "inProgress" },
  { value: "finished", label: "Finalizados", summaryKey: "finished" },
  { value: "waiting", label: "A chamar", summaryKey: "waiting" },
];

function normalizeScheduleSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function getScheduleGameStatus(game, winningScore) {
  if (getScoreWinnerSide(game, winningScore) !== null) return "finished";
  if (game?.inProgress === true) return "in-progress";
  return "waiting";
}

function getScheduleGameSearchText(game, roundIndex, courtNumbers, winningScore) {
  const gameStatus = getScheduleGameStatus(game, winningScore);
  const statusLabel = gameStatus === "finished"
    ? "Finalizado Finalizados"
    : gameStatus === "in-progress"
      ? "Em jogo"
      : "A chamar Aguardando chamada";
  const teamNames = [...(Array.isArray(game?.team1) ? game.team1 : [game?.team1]),
    ...(Array.isArray(game?.team2) ? game.team2 : [game?.team2])]
    .filter(Boolean)
    .join(" ");

  return normalizeScheduleSearch([
    `Rodada ${roundIndex + 1}`,
    game?.groupName,
    getGameCourtLabel(game, courtNumbers),
    teamNames,
    statusLabel,
  ].filter(Boolean).join(" "));
}

function ScheduleStatusFilters({ summary, value, onChange }) {
  return (
    <div className="scheduleStatusFilters" role="group" aria-label="Filtrar jogos por situação">
      {SCHEDULE_STATUS_FILTERS.map((filter) => (
        <button
          type="button"
          className={`scheduleStatusFilter is-${filter.value} ${value === filter.value ? "active" : ""}`}
          key={filter.value}
          onClick={() => onChange(filter.value)}
          aria-pressed={value === filter.value}
        >
          {filter.value !== "all" ? <i aria-hidden="true" /> : null}
          <span>{filter.label}</span>
          <strong>{summary[filter.summaryKey]}</strong>
        </button>
      ))}
    </div>
  );
}

function useLiveMatchElapsedSeconds(game, shouldTick) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!shouldTick || !game?.matchTimerStartedAt) return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [shouldTick, game?.matchTimerStartedAt]);

  return getMatchElapsedSeconds(game, now);
}

export function UniversalMatchCard({
  game,
  phaseLabel,
  courtNumbers = [],
  winningScore = 4,
  readOnly = false,
  blocked = false,
  isBye = false,
  onEditCourt = null,
  onScoreChange = null,
  onCallGame = null,
  onStatusToggle = null,
  attendanceData = null,
}) {
  const firstScoreInputRef = useRef(null);
  const secondScoreInputRef = useRef(null);
  const winnerSide = isBye ? null : getScoreWinnerSide(game, winningScore);
  const isFinished = winnerSide !== null;
  const isInProgress = !isBye && !isFinished && !blocked && game?.inProgress === true;
  const elapsedSeconds = useLiveMatchElapsedSeconds(game, isInProgress);
  const hasScore = game?.s1 !== "" && game?.s1 != null && game?.s2 !== "" && game?.s2 != null;
  const qualifiedTeam = game?.ids1?.length
    ? game?.team1
    : game?.ids2?.length
      ? game?.team2
      : null;
  const team1 = isBye
    ? qualifiedTeam
    : game?.team1;
  const team2 = isBye
    ? ["BYE"]
    : game?.team2;
  const teamName = (team, fallback = "Aguardando") => {
    if (Array.isArray(team)) {
      const names = team.filter(Boolean);
      return names.length > 0 ? names.join(" + ") : fallback;
    }
    return team ? String(team) : fallback;
  };
  const statusLabel = isBye
    ? "BYE"
    : isFinished
      ? "Finalizado"
      : blocked
        ? "Aguardando definição"
        : isInProgress
          ? "Em jogo"
          : "A chamar";
  const statusClassName = `matchCardStatus ${
    isBye
      ? "is-bye"
      : isFinished
        ? "is-finished"
        : blocked
          ? "is-blocked"
          : isInProgress
            ? "is-in-progress"
            : "is-waiting"
  }`;
  const canToggleStatus = !readOnly && !isBye && !isFinished && !blocked && Boolean(onStatusToggle);
  const showMatchTimer = !isBye && !blocked;
  const team1AttendanceParticipants = getGameSideAttendanceParticipants(attendanceData, game, "team1");
  const team2AttendanceParticipants = getGameSideAttendanceParticipants(attendanceData, game, "team2");

  const renderTeamName = (team, participants) => {
    if (!participants.length) return teamName(team);

    return participants.map((participant, index) => (
      <React.Fragment key={`${participant.name}-${index}`}>
        {index > 0 ? <span className="matchTeamSeparator" aria-hidden="true"> + </span> : null}
        <span className="matchTeamParticipant">
          {participant.name}
          {participant.pending ? (
            <span
              className="matchAttendancePending"
              title="Ausente — presença pendente"
              aria-label="Ausente: presença pendente"
            >
              <span aria-hidden="true">×</span>
            </span>
          ) : null}
        </span>
      </React.Fragment>
    ));
  };

  const advanceScoreFocus = (side, currentInput) => {
    const otherScore = side === "team1" ? game?.s2 : game?.s1;
    const otherInput = side === "team1"
      ? secondScoreInputRef.current
      : firstScoreInputRef.current;

    if (otherScore === "" || otherScore == null) {
      otherInput?.focus();
      otherInput?.select();
      return;
    }

    currentInput?.blur();
  };

  const renderScore = (field, value, side) => {
    if (isBye) {
      return side === "team2"
        ? <span className="matchByeScore">BYE</span>
        : <span className="matchScorePlaceholder" aria-hidden="true">—</span>;
    }

    if (readOnly) {
      return hasScore
        ? <output className="matchScoreOutput">{value}</output>
        : <span className="matchScorePlaceholder" aria-label="Placar ainda não informado">—</span>;
    }

    return (
      <input
        ref={side === "team1" ? firstScoreInputRef : secondScoreInputRef}
        className="matchScoreInput"
        type="text"
        min="0"
        max={getMaxScore(winningScore)}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          const currentInput = event.currentTarget;
          const accepted = onScoreChange?.(field, nextValue);
          if (!nextValue || accepted === false) return;

          window.requestAnimationFrame(() => {
            advanceScoreFocus(side, currentInput);
          });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          advanceScoreFocus(side, event.currentTarget);
        }}
        disabled={blocked}
        aria-label={`Placar de ${teamName(side === "team1" ? team1 : team2)}`}
      />
    );
  };

  return (
    <article
      className={`gameCard universalMatchCard ${isBye ? "byeGameCard universalMatchCard--bye" : ""} ${isFinished || isBye ? "gameFinished universalMatchCard--finished" : "gameWaiting"} ${readOnly ? "publicReadOnlyGame universalMatchCard--readonly" : ""}`}
      aria-label={`${phaseLabel}: ${teamName(team1)} versus ${teamName(team2)}`}
    >
      <div className="matchCardMeta">
        <span className="matchCardPhase" title={phaseLabel}>{phaseLabel}</span>
        {canToggleStatus ? (
          <button
            type="button"
            className={statusClassName}
            onClick={onStatusToggle}
            aria-pressed={isInProgress}
            title={isInProgress ? "Clique para marcar como A chamar" : "Clique para informar que o jogo começou"}
          >
            <span className="matchStatusIndicator" aria-hidden="true">{isInProgress ? "●" : "▷"}</span>
            <span>{statusLabel}</span>
            {showMatchTimer ? <time className="matchStatusTimer" dateTime={`PT${elapsedSeconds}S`}>{formatMatchDuration(elapsedSeconds)}</time> : null}
          </button>
        ) : (
          <span className={statusClassName}>
            <span>{statusLabel}</span>
            {showMatchTimer ? <time className="matchStatusTimer" dateTime={`PT${elapsedSeconds}S`}>{formatMatchDuration(elapsedSeconds)}</time> : null}
          </span>
        )}
      </div>

      {!isBye ? (
        <div className="matchCardControls">
          <CourtBadge
            label={getGameCourtLabel(game, courtNumbers)}
            editable={!readOnly && Boolean(onEditCourt)}
            onClick={onEditCourt || undefined}
          />
          {!readOnly && onCallGame ? (
            <button type="button" className="voiceBtn matchCallButton" onClick={onCallGame} disabled={blocked}>
              🔊 Chamar jogo
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="matchTeamStack">
        <div className={`matchTeamRow ${winnerSide === "team1" ? "is-winner" : winnerSide === "team2" ? "is-loser" : ""}`}>
          <span className="matchTeamName">{renderTeamName(team1, team1AttendanceParticipants)}</span>
          <span className="matchScoreCell">{renderScore("s1", game?.s1, "team1")}</span>
        </div>

        <div className="matchVsDivider" aria-hidden="true"><span>VS</span></div>

        <div className={`matchTeamRow ${isBye ? "is-bye" : winnerSide === "team2" ? "is-winner" : winnerSide === "team1" ? "is-loser" : ""}`}>
          <span className="matchTeamName">{renderTeamName(team2, team2AttendanceParticipants)}</span>
          <span className="matchScoreCell">{renderScore("s2", game?.s2, "team2")}</span>
        </div>
      </div>
    </article>
  );
}
export default function ScheduleView({
  schedule,
  statusData = null,
  updateScore = () => {},
  onStatusToggle = null,
  showGroupName = false,
  voiceRepeat = 1,
  setVoiceRepeat = () => {},
  winningScore = 4,
  readOnly = false,
  courtNumbers = [],
  onEditCourt = null,
  speakGame,
  speakRound,
  stopSpeech,
}) {
  const [scheduleSearchValue, setScheduleSearchValue] = useState("");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState("all");
  const [scheduleFilterSnapshot, setScheduleFilterSnapshot] = useState(null);
  const normalizedScheduleSearch = normalizeScheduleSearch(scheduleSearchValue);
  const scheduleSummary = useMemo(() => schedule.reduce((summary, round) => {
    round.forEach((game) => {
      const status = getScheduleGameStatus(game, winningScore);
      summary.total += 1;
      if (status === "in-progress") summary.inProgress += 1;
      else if (status === "finished") summary.finished += 1;
      else summary.waiting += 1;
    });
    return summary;
  }, { total: 0, inProgress: 0, finished: 0, waiting: 0 }), [schedule, winningScore]);
  const frozenFilterGameKeys = useMemo(
    () => new Set(scheduleFilterSnapshot?.gameKeys || []),
    [scheduleFilterSnapshot]
  );
  const displayedScheduleSummary = scheduleStatusFilter !== "all"
    && scheduleFilterSnapshot?.filter === scheduleStatusFilter
    ? scheduleFilterSnapshot.summary
    : scheduleSummary;
  const visibleSchedule = useMemo(() => schedule
    .map((round, roundIndex) => ({
      roundIndex,
      games: round
        .map((game, gameIndex) => ({ game, gameIndex }))
        .filter(({ game, gameIndex }) => (
          (scheduleStatusFilter === "all"
            || (scheduleFilterSnapshot?.filter === scheduleStatusFilter
              ? frozenFilterGameKeys.has(`${roundIndex}:${gameIndex}`)
              : getScheduleGameStatus(game, winningScore) === scheduleStatusFilter))
          && (!normalizedScheduleSearch
            || getScheduleGameSearchText(game, roundIndex, courtNumbers, winningScore)
              .includes(normalizedScheduleSearch))
        )),
    }))
    .filter(({ games }) => games.length > 0), [
      courtNumbers,
      frozenFilterGameKeys,
      normalizedScheduleSearch,
      schedule,
      scheduleFilterSnapshot?.filter,
      scheduleStatusFilter,
      winningScore,
    ]);
  const visibleGameCount = visibleSchedule.reduce((total, round) => total + round.games.length, 0);
  const groupedSchedule = useMemo(() => {
    if (!showGroupName) return [];

    const groups = [];
    const groupsByName = new Map();

    visibleSchedule.forEach(({ roundIndex, games }) => {
      games.forEach(({ game, gameIndex }) => {
        const groupName = String(game?.groupName || "Grupo").trim();
        const groupKey = game?.groupId ?? groupName;

        if (!groupsByName.has(groupKey)) {
          const group = { key: groupKey, name: groupName, games: [] };
          groupsByName.set(groupKey, group);
          groups.push(group);
        }

        groupsByName.get(groupKey).games.push({ game, roundIndex, gameIndex });
      });
    });

    return groups;
  }, [showGroupName, visibleSchedule]);
  const selectScheduleStatusFilter = (nextFilter) => {
    setScheduleStatusFilter(nextFilter);
    if (nextFilter === "all") {
      setScheduleFilterSnapshot(null);
      setScheduleSearchValue("");
      return;
    }

    const gameKeys = [];
    schedule.forEach((round, roundIndex) => {
      round.forEach((game, gameIndex) => {
        if (getScheduleGameStatus(game, winningScore) === nextFilter) {
          gameKeys.push(`${roundIndex}:${gameIndex}`);
        }
      });
    });
    setScheduleFilterSnapshot({
      filter: nextFilter,
      gameKeys,
      summary: { ...scheduleSummary },
    });
  };

  const renderGame = (game, roundIndex, gameIndex, key = gameIndex) => (
    <UniversalMatchCard
      key={key}
      game={game}
      phaseLabel={`Rodada ${roundIndex + 1}`}
      courtNumbers={courtNumbers}
      winningScore={winningScore}
      readOnly={readOnly}
      onEditCourt={!readOnly && onEditCourt ? () => onEditCourt({ scope: "schedule", roundIndex, gameIndex, game }) : null}
      onScoreChange={!readOnly ? (field, value) => updateScore(roundIndex, gameIndex, field, value) : null}
      onStatusToggle={!readOnly && onStatusToggle ? () => onStatusToggle(roundIndex, gameIndex) : null}
      onCallGame={!readOnly ? () => speakGame(game, {
        roundLabel: `Rodada ${roundIndex + 1}`,
        includeGroup: showGroupName,
        repeat: voiceRepeat,
        courtNumbers,
      }) : null}
      attendanceData={!readOnly ? statusData : null}
    />
  );

  return (
    <div className={`schedule ${readOnly ? "readOnlySchedule publicSchedule" : ""}`}>
      {!readOnly ? (
        <div className="scheduleOverviewToolbar" aria-label="Controles e resumo dos jogos">
          <div className="scheduleOverviewPrimary">
            <ScheduleStatusFilters
              summary={displayedScheduleSummary}
              value={scheduleStatusFilter}
              onChange={selectScheduleStatusFilter}
            />
            <label className="scheduleSearch">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={scheduleSearchValue}
                onChange={(event) => setScheduleSearchValue(event.target.value)}
                placeholder="Nome, rodada ou quadra"
                aria-label="Pesquisar jogos por nome, rodada, grupo, quadra ou estado"
              />
            </label>
          </div>
          <VoiceRepeatSelector
            voiceRepeat={voiceRepeat}
            setVoiceRepeat={setVoiceRepeat}
          />
        </div>
      ) : null}

      {!readOnly && (normalizedScheduleSearch || scheduleStatusFilter !== "all") && visibleGameCount === 0 ? (
        <div className="scheduleSearchEmpty" role="status">
          {normalizedScheduleSearch
            ? `Nenhum jogo encontrado para “${scheduleSearchValue.trim()}”.`
            : "Nenhum jogo encontrado neste filtro."}
        </div>
      ) : null}

      {showGroupName ? (
        <>
          {!readOnly ? (
            <div className="scheduleRoundCalls" aria-label="Chamadas das rodadas da fase de grupos">
              <span className="scheduleRoundCallsLabel">Chamar rodada</span>
              <div className="scheduleRoundCallsActions">
                {schedule.map((round, roundIndex) => (
                  <button
                    type="button"
                    className="voiceBtn scheduleRoundCallButton"
                    key={`round-call-${roundIndex}`}
                    onClick={() =>
                      speakRound(round, roundIndex, {
                        includeGroup: true,
                        repeat: voiceRepeat,
                        courtNumbers,
                      })
                    }
                  >
                    🔊 Rodada {roundIndex + 1}
                  </button>
                ))}
                <button type="button" className="secondaryBtn stopBtn scheduleRoundStopButton" onClick={stopSpeech}>
                  ⏹️ Parar
                </button>
              </div>
            </div>
          ) : null}

          {groupedSchedule.map((group) => {
            const groupNameMatch = /^grupo\s+(.+)$/i.exec(group.name);

            return (
              <section
                className={`roundCard scheduleGroupSection ${readOnly ? "readOnlyRoundCard publicReadOnlyRound" : ""}`}
                key={group.key}
              >
                <div className="roundHeader scheduleGroupHeader">
                  <h3>
                    {groupNameMatch ? (
                      <>
                        <span>Grupo</span>
                        <strong>{groupNameMatch[1]}</strong>
                      </>
                    ) : (
                      <strong>{group.name}</strong>
                    )}
                  </h3>
                </div>

                {group.games.map(({ game, roundIndex, gameIndex }) =>
                  renderGame(game, roundIndex, gameIndex, `${roundIndex}-${gameIndex}`)
                )}
              </section>
            );
          })}
        </>
      ) : visibleSchedule.map(({ roundIndex, games }) => (
        <div className={`roundCard ${readOnly ? "readOnlyRoundCard publicReadOnlyRound" : ""}`} key={roundIndex}>
          <div className="roundHeader">
            <h3>Rodada {roundIndex + 1}</h3>

            {!readOnly ? (
              <div className="voiceActions">
                <button
                  type="button"
                  className="voiceBtn"
                  onClick={() =>
                    speakRound(schedule[roundIndex], roundIndex, {
                      includeGroup: showGroupName,
                      repeat: voiceRepeat,
                      courtNumbers,
                    })
                  }
                >
                  Chamar rodada
                </button>

                <button
                  type="button"
                  className="secondaryBtn stopBtn"
                  onClick={stopSpeech}
                >
                  ⏹️ Parar
                </button>
              </div>
            ) : null}
          </div>

          {games.map(({ game, gameIndex }) => {
            return renderGame(game, roundIndex, gameIndex);
          })}
        </div>
      ))}
    </div>
  );
}
