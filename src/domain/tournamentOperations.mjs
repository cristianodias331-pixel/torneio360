import {
  getGameCourtLabel,
  getGameCourtNumber,
} from "./courtNumbers.mjs";
import {
  isCampeonatoCearenseData,
  isCearenseSecondParallelEnabled,
  isCearenseThirdParallelEnabled,
} from "./cupFormat.mjs";
import { getSharedGameParticipants } from "./gameParticipants.mjs";
import {
  capExpiredMatchTimer,
  getMatchElapsedSeconds,
  getMatchTimerRemainingMilliseconds,
} from "./matchTimer.mjs";
import {
  getWinningScore,
  isGameFinished,
} from "./scoreRules.mjs";
import { resolveBracketGame } from "./bracketProgression.mjs";

export function createTournamentOperations({ syncCupBracketScores = (data) => data } = {}) {
  function isBracketPhaseEnabled(data, game) {
    if (!isCampeonatoCearenseData(data)) return true;

    const matchKey = String(game?.matchKey || "");
    const phase = game?.phase
      || (matchKey.startsWith("thirdParallel_") ? "thirdParallel" : "")
      || (matchKey.startsWith("repechage_") ? "repechage" : "");

    if (phase === "repechage") return isCearenseSecondParallelEnabled(data);
    if (phase === "thirdParallel") return isCearenseThirdParallelEnabled(data);
    return true;
  }

  function getStoredTournamentGames(data = {}) {
    return [
      ...(Array.isArray(data.schedule) ? data.schedule.flatMap((round) => (
        Array.isArray(round) ? round : []
      )) : []),
      ...(Array.isArray(data.brackets)
        ? data.brackets.filter((game) => isBracketPhaseEnabled(data, game))
        : []),
    ];
  }

  function getNextMatchTimerExpiryDelay(data = {}, now = Date.now()) {
    const remainingTimes = getStoredTournamentGames(data)
      .map((game) => getMatchTimerRemainingMilliseconds(game, now))
      .filter((remaining) => remaining !== null);
    return remainingTimes.length ? Math.min(...remainingTimes) : null;
  }

  function capExpiredTournamentMatchTimers(data = {}, now = Date.now()) {
    const hasExpiredTimer = getStoredTournamentGames(data).some((game) => (
      getMatchTimerRemainingMilliseconds(game, now) === 0
    ));
    if (!hasExpiredTimer) return { data, cappedCount: 0 };

    const nextData = structuredClone(data);
    let cappedCount = 0;
    getStoredTournamentGames(nextData).forEach((game) => {
      if (capExpiredMatchTimer(game, now)) cappedCount += 1;
    });
    return { data: nextData, cappedCount };
  }

  function hasPlayableGameSides(game) {
    if (!game || game.isBye) return false;

    const hasFirstSide = Array.isArray(game.ids1)
      ? game.ids1.length > 0
      : Array.isArray(game.team1)
        ? game.team1.some((name) => name && name !== "Aguardando" && name !== "BYE")
        : Boolean(game.team1);
    const hasSecondSide = Array.isArray(game.ids2)
      ? game.ids2.length > 0
      : Array.isArray(game.team2)
        ? game.team2.some((name) => name && name !== "Aguardando" && name !== "BYE")
        : Boolean(game.team2);

    return hasFirstSide && hasSecondSide;
  }

  function getTournamentOperationalGames(data = {}) {
    let operationalData = data;
    try {
      if (isCampeonatoCearenseData(data) && data.cupConfig?.cearenseBracketVersion === 2) {
        operationalData = syncCupBracketScores(data);
      }
    } catch {
      // Mantém compatibilidade com chaves antigas enquanto elas são reparadas.
    }
    const games = [];

    (Array.isArray(operationalData.schedule) ? operationalData.schedule : []).forEach((round, roundIndex) => {
      (Array.isArray(round) ? round : []).forEach((game, gameIndex) => {
        if (!hasPlayableGameSides(game)) return;
        games.push({
          game,
          scope: "schedule",
          key: `schedule:${roundIndex}:${gameIndex}`,
          label: game.groupName
            ? `${game.groupName} · Rodada ${roundIndex + 1}`
            : `Rodada ${roundIndex + 1}`,
        });
      });
    });

    const storedBrackets = Array.isArray(operationalData.brackets) ? operationalData.brackets : [];
    storedBrackets.forEach((storedGame) => {
      if (!isBracketPhaseEnabled(operationalData, storedGame)) return;

      let game = storedGame;
      try {
        game = resolveBracketGame(storedGame, storedBrackets, operationalData);
      } catch {
        // Se uma chave antiga estiver incompleta, preservamos os jogos válidos já salvos.
      }
      if (!hasPlayableGameSides(game)) return;
      games.push({
        game,
        storedGame,
        scope: "bracket",
        key: `bracket:${storedGame.matchKey || games.length}`,
        label: storedGame.roundName || storedGame.phase || "Chave eliminatória",
      });
    });

    return games;
  }

  function getTournamentTimingSummary(data = {}, now = Date.now()) {
    const operationalGames = getTournamentOperationalGames(data);
    const winningScore = getWinningScore(data);
    const timedGames = operationalGames
      .map((item) => item.storedGame || item.game)
      .filter((game) => (
        Boolean(game?.matchTimerFirstStartedAt)
        || Boolean(game?.matchTimerStartedAt)
        || Number(game?.matchTimerElapsedSeconds || 0) > 0
      ));

    return {
      timedGames: timedGames.length,
      // O tempo geral representa trabalho efetivo de quadra. Intervalos entre
      // partidas (inclusive de um dia para o outro) nunca entram na soma.
      durationSeconds: timedGames.reduce(
        (total, game) => total + getMatchElapsedSeconds(game, now),
        0
      ),
      complete: operationalGames.length > 0 && operationalGames.every((item) => {
        const storedGame = item.storedGame || item.game;
        return isGameFinished(item.game, winningScore)
          && Boolean(storedGame?.matchTimerFirstStartedAt)
          && Boolean(storedGame?.matchTimerFinishedAt);
      }),
    };
  }

  function getCupPlayTimeById(data = {}) {
    const playTimeById = new Map();
    if (!getTournamentTimingSummary(data).complete) return playTimeById;
    const winningScore = getWinningScore(data);
    getTournamentOperationalGames(data).forEach((item) => {
      if (!isGameFinished(item.game, winningScore)) return;
      const seconds = getMatchElapsedSeconds(item.storedGame || item.game);
      if (seconds <= 0) return;
      [...(item.game.ids1 || []), ...(item.game.ids2 || [])].forEach((id) => {
        playTimeById.set(id, Number(playTimeById.get(id) || 0) + seconds);
      });
    });
    return playTimeById;
  }

  function getInProgressParticipantConflicts(data = {}, targetGame = {}, targetKey = "") {
    const winningScore = getWinningScore(data);
    const courtNumbers = Array.isArray(data.courtNumbers) ? data.courtNumbers : [];

    return getTournamentOperationalGames(data)
      .filter((item) => (
        item.key !== targetKey
        && !isGameFinished(item.game, winningScore)
        && (item.storedGame?.inProgress === true || item.game?.inProgress === true)
      ))
      .map((item) => ({
        participants: getSharedGameParticipants(targetGame, item.game),
        gameLabel: item.label,
        courtLabel: getGameCourtLabel(item.storedGame || item.game, courtNumbers),
      }))
      .filter((conflict) => conflict.participants.length > 0);
  }

  function getTournamentMatchStatusSummary(data = {}, { scope = "all", bracketMatchKeys = null } = {}) {
    const winningScore = getWinningScore(data);
    const allowedBracketMatchKeys = Array.isArray(bracketMatchKeys)
      ? new Set(bracketMatchKeys.filter(Boolean))
      : null;
    const operationalGames = getTournamentOperationalGames(data).filter((item) => {
      if (scope !== "all" && item.scope !== scope) return false;
      if (item.scope === "bracket" && allowedBracketMatchKeys) {
        return allowedBracketMatchKeys.has(item.storedGame?.matchKey);
      }
      return true;
    });

    return operationalGames.reduce((summary, item) => {
      if (isGameFinished(item.game, winningScore)) summary.finished += 1;
      else if (item.storedGame?.inProgress === true || item.game?.inProgress === true) summary.inProgress += 1;
      else summary.waiting += 1;
      summary.total += 1;
      return summary;
    }, { waiting: 0, inProgress: 0, finished: 0, total: 0 });
  }

  function getTournamentActiveCourtUsages(tournament, data = tournament?.data || {}) {
    const courtNumbers = Array.isArray(data.courtNumbers) ? data.courtNumbers : [];
    const winningScore = getWinningScore(data);

    return getTournamentOperationalGames(data)
      .filter((item) => (
        !isGameFinished(item.game, winningScore)
        && (item.storedGame?.inProgress === true || item.game?.inProgress === true)
      ))
      .map((item) => ({
        tournamentId: tournament?.id,
        tournamentName: tournament?.name || "Torneio",
        gameKey: item.key,
        gameLabel: item.label,
        courtNumber: getGameCourtNumber(item.storedGame || item.game, courtNumbers),
      }));
  }

  return {
    capExpiredTournamentMatchTimers,
    getCupPlayTimeById,
    getInProgressParticipantConflicts,
    getNextMatchTimerExpiryDelay,
    getTournamentActiveCourtUsages,
    getTournamentMatchStatusSummary,
    getTournamentOperationalGames,
    getTournamentTimingSummary,
    hasPlayableGameSides,
  };
}
