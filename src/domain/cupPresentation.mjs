import {
  getGameLoserId,
  getGameWinnerId,
  resolveBracketGame,
} from "./bracketProgression.mjs";
import {
  isCampeonatoCearenseData,
  isCopinhaData,
  isOfficialCearenseData,
  isSunsetData,
} from "./cupFormat.mjs";
import { getCupTeamName } from "./cupGroups.mjs";
import { getCupQualified } from "./cupQualification.mjs";
import { defaultRankingCriteria, getRankingCriteria } from "./rankingCriteria.mjs";
import { getScoreWinnerSide, getWinningScore } from "./scoreRules.mjs";
import { isCupType } from "./modalityClassification.mjs";
import { syncCupBracketScores } from "./cupBracketOrchestration.mjs";

export function createCupPresentation({ getCupPlayTimeById }) {
  function calculateParallelRanking(data, rankingCriteriaValue = defaultRankingCriteria) {
    const allRepechageGames = (data.brackets || []).filter((game) => game.phase === "repechage");
    const games = allRepechageGames.map((game) =>
      resolveBracketGame(game, data.brackets || [], data)
    );

    const winningScore = getWinningScore(data);

    const qualified = getCupQualified(data);
    const baseIds = (qualified.repechage || []).map((item) => item.id);
    const ids = Array.from(
      new Set([
        ...baseIds,
        ...games.flatMap((game) => [
          ...(game.ids1 || []),
          ...(game.ids2 || []),
        ]),
      ])
    );
    const playTimeById = getCupPlayTimeById(data);

    const rows = ids.map((id) => ({
      id,
      name: getCupTeamName(data, id),
      pts: 0,
      w: 0,
      bal: 0,
      played: 0,
      playTimeSeconds: Number(playTimeById.get(id) || 0),
    }));

    const tableById = {};
    rows.forEach((row) => {
      tableById[row.id] = row;
    });

    games.forEach((game) => {
      const s1 = Number(game.s1);
      const s2 = Number(game.s2);

      if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

      const id1 = game.ids1?.[0];
      const id2 = game.ids2?.[0];

      if (id1 === undefined || id2 === undefined) return;

      if (!tableById[id1]) return;
      if (!tableById[id2]) return;

      const winnerSide = getScoreWinnerSide(game, winningScore);
      if (!winnerSide) return;

      const win1 = winnerSide === "team1";
      const win2 = winnerSide === "team2";

      tableById[id1].pts += s1;
      tableById[id1].bal += s1 - s2;
      tableById[id1].played += 1;
      if (win1) tableById[id1].w += 1;

      tableById[id2].pts += s2;
      tableById[id2].bal += s2 - s1;
      tableById[id2].played += 1;
      if (win2) tableById[id2].w += 1;
    });

    const finalGame = games.find((game) => game.roundName === "Final");
    const finalWinnerId = finalGame ? getGameWinnerId(finalGame, data) : null;
    const finalLoserId = finalGame ? getGameLoserId(finalGame, data) : null;

    if (finalWinnerId !== null && tableById[finalWinnerId]) tableById[finalWinnerId].parallelPosition = 1;
    if (finalLoserId !== null && tableById[finalLoserId]) tableById[finalLoserId].parallelPosition = 2;

    const criteria = getRankingCriteria(rankingCriteriaValue);

    return rows.sort((a, b) => {
      if (a.parallelPosition && b.parallelPosition) return a.parallelPosition - b.parallelPosition;
      if (a.parallelPosition) return -1;
      if (b.parallelPosition) return 1;

      for (const key of criteria.order) {
        const diff = b[key] - a[key];
        if (diff !== 0) return diff;
      }

      return a.name.localeCompare(b.name);
    });
  }

  function calculateMainCupPodium(data) {
    const games = data.brackets || [];
    const playTimeById = getCupPlayTimeById(data);

    const finalGame = games.find(
      (game) => game.phase === "main" && game.roundName === "Final"
    );

    const thirdPlaceGame = games.find(
      (game) => game.phase === "main" && game.roundName === "3º lugar"
    );

    if (!finalGame) return [];

    const resolvedFinal = resolveBracketGame(finalGame, games, data);
    const championId = getGameWinnerId(resolvedFinal, data);
    const runnerUpId = getGameLoserId(resolvedFinal, data);

    if (championId === null || runnerUpId === null) return [];

    const podium = [
      { position: "🏆 Campeão", name: getCupTeamName(data, championId), playTimeSeconds: Number(playTimeById.get(championId) || 0) },
      { position: "🥈 Vice", name: getCupTeamName(data, runnerUpId), playTimeSeconds: Number(playTimeById.get(runnerUpId) || 0) },
    ];

    if (thirdPlaceGame) {
      const resolvedThirdPlace = resolveBracketGame(thirdPlaceGame, games, data);
      const thirdId = getGameWinnerId(resolvedThirdPlace, data);

      if (thirdId !== null) {
        podium.push({ position: "🥉 3º lugar", name: getCupTeamName(data, thirdId), playTimeSeconds: Number(playTimeById.get(thirdId) || 0) });
      }
    }

    return podium;
  }

  function calculateCupBracketPodium(data, phase) {
    const games = data.brackets || [];
    const playTimeById = getCupPlayTimeById(data);
    const finalGame = games.find(
      (game) => game.phase === phase && game.roundName === "Final"
    );
    const thirdPlaceGame = games.find((game) => (
      game.phase === phase && String(game.roundName || "").includes("3")
    ));

    if (!finalGame) return [];

    const resolvedFinal = resolveBracketGame(finalGame, games, data);
    const championId = getGameWinnerId(resolvedFinal, data);
    const runnerUpId = getGameLoserId(resolvedFinal, data);

    const isSunsetRunnerUpFallback = isSunsetData(data)
      && phase === "secondParallel"
      && finalGame.automaticQualification === "mainRunnerUp";
    if (championId === null || (runnerUpId === null && !isSunsetRunnerUpFallback)) return [];

    const podium = [
      { position: "🏆 Campeão", name: getCupTeamName(data, championId), playTimeSeconds: Number(playTimeById.get(championId) || 0) },
    ];

    if (runnerUpId !== null) {
      podium.push({ position: "🥈 Vice", name: getCupTeamName(data, runnerUpId), playTimeSeconds: Number(playTimeById.get(runnerUpId) || 0) });
    }

    if (thirdPlaceGame) {
      const resolvedThirdPlace = resolveBracketGame(thirdPlaceGame, games, data);
      const thirdId = getGameWinnerId(resolvedThirdPlace, data);

      if (thirdId !== null) {
        podium.push({ position: "🥉 3º lugar", name: getCupTeamName(data, thirdId), playTimeSeconds: Number(playTimeById.get(thirdId) || 0) });
      }
    }

    return podium;
  }

  function calculateCopinhaConsolationPodium(data) {
    return calculateCupBracketPodium(data, "repechage");
  }

  function groupStoredBracketGames(data) {
    const cupConfig = data.cupConfig || {};
    const mainName = cupConfig.mainBracketName || "Principal";
    const repechageName = cupConfig.repechageName || "Repescagem";
    const secondParallelName = cupConfig.secondParallelName || "2ª Disputa Paralela";
    const thirdRepechageName = cupConfig.thirdRepechageName || "3ª Disputa Paralela";
    const sunsetBracketName = cupConfig.sunsetBracketName || "Etapa Sunset";

    const mainGames = (data.brackets || []).filter((game) => game.phase === "main");
    const repechageGames = (data.brackets || []).filter((game) => game.phase === "repechage");
    const secondParallelGames = (data.brackets || []).filter((game) => game.phase === "secondParallel");
    const thirdParallelGames = (data.brackets || []).filter((game) => game.phase === "thirdParallel");
    const sunsetFinalGames = (data.brackets || []).filter((game) => game.phase === "sunsetFinal");

    function groupByRound(games, bracketTitle) {
      const map = {};

      games.forEach((game) => {
        if (!map[game.roundName]) {
          map[game.roundName] = [];
        }

        map[game.roundName].push(resolveBracketGame(game, data.brackets || [], data));
      });

      return Object.entries(map).map(([title, gamesList]) => ({
        title,
        bracketTitle,
        games: gamesList,
      }));
    }

    return {
      main: groupByRound(mainGames, mainName),
      repechage: groupByRound(repechageGames, repechageName),
      secondParallel: groupByRound(secondParallelGames, secondParallelName),
      thirdParallel: groupByRound(thirdParallelGames, thirdRepechageName),
      sunsetFinal: groupByRound(sunsetFinalGames, sunsetBracketName),
    };
  }

  function getSafeCupPresentation(data, config) {
    if (!isCupType(config) || !data?.brackets?.length) {
      return { currentBrackets: null, parallelRanking: [], mainCupPodium: [], consolationCupPodium: [], secondParallelPodium: [], thirdParallelPodium: [], sunsetPodium: [] };
    }

    try {
      const presentationData = isSunsetData(data)
        || (isCampeonatoCearenseData(data) && data.cupConfig?.cearenseBracketVersion === 2)
        ? syncCupBracketScores(data)
        : data;
      return {
        currentBrackets: groupStoredBracketGames(presentationData),
        parallelRanking: calculateParallelRanking(presentationData, data.rankingCriteria || defaultRankingCriteria),
        mainCupPodium: calculateMainCupPodium(presentationData),
        consolationCupPodium: isCopinhaData(data) ? calculateCopinhaConsolationPodium(presentationData) : [],
        secondParallelPodium: isSunsetData(data) ? calculateCupBracketPodium(presentationData, "secondParallel") : [],
        thirdParallelPodium: isOfficialCearenseData(data) ? calculateCupBracketPodium(presentationData, "thirdParallel") : [],
        sunsetPodium: isSunsetData(data) ? calculateCupBracketPodium(presentationData, "sunsetFinal") : [],
      };
    } catch (error) {
      console.error("Chaves salvas inválidas; exibindo a Copa sem as chaves", error);
      return { currentBrackets: null, parallelRanking: [], mainCupPodium: [], consolationCupPodium: [], secondParallelPodium: [], thirdParallelPodium: [], sunsetPodium: [] };
    }
  }

  return {
    calculateParallelRanking,
    calculateMainCupPodium,
    calculateCupBracketPodium,
    calculateCopinhaConsolationPodium,
    groupStoredBracketGames,
    getSafeCupPresentation,
  };
}
