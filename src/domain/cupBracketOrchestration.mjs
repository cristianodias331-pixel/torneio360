import { getMatchTimerFields } from "./matchTimer.mjs";
import {
  generateParallelRoundRobin,
  seedBracket,
} from "./bracketBasics.mjs";
import {
  buildNextRound,
  buildThirdPlaceGame,
  resolveBracketGame,
} from "./bracketProgression.mjs";
import { buildCearenseEliminationRounds } from "./bracketConstruction.mjs";
import {
  buildCopinhaBracketFromPlan,
  buildCopinhaEliminationRounds,
  expandBracketPlanWithVisualByes,
} from "./cupBracketConstruction.mjs";
import {
  cearenseMainBracketPlans,
  copinhaBracketPlans,
  playRankingMainBracketPlans,
} from "./cupBracketPlans.mjs";
import {
  buildPlayRankingParallelRounds,
  getPlayRankingOpeningLosses,
} from "./playRankingBracket.mjs";
import { buildCearenseThirdParallelRounds } from "./cearenseThirdParallel.mjs";
import {
  buildSunsetChampionsRounds,
  buildSunsetMainRunnerUpFallback,
  buildSunsetParallelFromMainRound,
} from "./sunsetBracket.mjs";
import { createCearenseGroups } from "./cupGroups.mjs";
import {
  isCampeonatoCearenseData,
  isCopinhaData,
  isPlayRankingData,
  isSunsetData,
} from "./cupFormat.mjs";
import { getCearenseQualified } from "./cearenseQualification.mjs";
import {
  getCopinhaQualified,
  getCupQualified,
} from "./cupQualification.mjs";

export function generatePlayRankingBrackets(data) {
  const qualified = getCearenseQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Eliminatória Principal";
  const repechageName = cupConfig.repechageName || "Disputa Paralela";
  const groupCount = createCearenseGroups(cupConfig.teamCount || 4).length;
  const mainPlan = cupConfig.playRankingBracketVersion === 2
    ? playRankingMainBracketPlans[groupCount]
    : null;
  const mainRounds = mainPlan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, expandBracketPlanWithVisualByes(mainPlan))
    : buildCearenseEliminationRounds(qualified.main, "main", mainName, true);
  const openingLosses = getPlayRankingOpeningLosses(data, mainRounds, qualified.main);
  const repechageRounds = openingLosses.ready
    ? buildPlayRankingParallelRounds(openingLosses.losses, qualified.repechage, repechageName)
    : [];
  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

export function generateCearenseBrackets(data) {
  const qualified = getCearenseQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Eliminatória Principal";
  const repechageName = cupConfig.repechageName || "2ª Disputa Paralela";
  const thirdRepechageName = cupConfig.thirdRepechageName || "3ª Disputa Paralela";
  const groupCount = createCearenseGroups(cupConfig.teamCount || 4).length;
  const mainPlan = cearenseMainBracketPlans[groupCount];
  const mainRounds = mainPlan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, expandBracketPlanWithVisualByes(mainPlan))
    : buildCearenseEliminationRounds(qualified.main, "main", mainName, true);
  const repechageRounds = buildCearenseEliminationRounds(qualified.repechage, "repechage", repechageName);
  const thirdParallelRounds = buildCearenseThirdParallelRounds(mainRounds, thirdRepechageName);
  const allGames = [...mainRounds, ...repechageRounds, ...thirdParallelRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    thirdParallel: thirdParallelRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

export function generateSunsetBrackets(data) {
  const qualified = getCearenseQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Eliminatória Principal";
  const firstParallelName = cupConfig.repechageName || "1ª Disputa Paralela";
  const secondParallelName = cupConfig.secondParallelName || "2ª Disputa Paralela";
  const thirdParallelName = cupConfig.thirdRepechageName || "3ª Disputa Paralela";
  const sunsetBracketName = cupConfig.sunsetBracketName || "Etapa Sunset";
  const groupCount = createCearenseGroups(
    cupConfig.teamCount || 4,
    cupConfig.groupFormation
  ).length;
  const mainPlan = cearenseMainBracketPlans[groupCount];
  const mainRounds = mainPlan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, expandBracketPlanWithVisualByes(mainPlan))
    : buildCearenseEliminationRounds(qualified.main, "main", mainName, true);
  const repechageRounds = buildCearenseEliminationRounds(
    qualified.repechage,
    "repechage",
    firstParallelName
  );
  const secondParallelFromRoundOf16 = buildSunsetParallelFromMainRound(
    mainRounds,
    8,
    "secondParallel",
    secondParallelName
  );
  const secondParallelRounds = secondParallelFromRoundOf16.length > 0
    ? secondParallelFromRoundOf16
    : buildSunsetMainRunnerUpFallback(mainRounds, secondParallelName);
  const thirdParallelRounds = buildSunsetParallelFromMainRound(
    mainRounds,
    4,
    "thirdParallel",
    thirdParallelName
  );
  const sunsetFinalRounds = buildSunsetChampionsRounds({
    main: mainRounds,
    repechage: repechageRounds,
    secondParallel: secondParallelRounds,
    thirdParallel: thirdParallelRounds,
  }, sunsetBracketName);
  const allGames = [
    ...mainRounds,
    ...repechageRounds,
    ...secondParallelRounds,
    ...thirdParallelRounds,
    ...sunsetFinalRounds,
  ].flatMap((round) => round.games);
  const resolveRounds = (rounds) => rounds.map((round) => ({
    ...round,
    games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
  }));

  return {
    main: resolveRounds(mainRounds),
    repechage: resolveRounds(repechageRounds),
    secondParallel: resolveRounds(secondParallelRounds),
    thirdParallel: resolveRounds(thirdParallelRounds),
    sunsetFinal: resolveRounds(sunsetFinalRounds),
  };
}

export function generateCopinhaBrackets(data) {
  const qualified = getCopinhaQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Chave Principal";
  const repechageName = cupConfig.repechageName || "Consolação";
  const groupCount = Math.floor((cupConfig.teamCount || 0) / 3);
  const plan = copinhaBracketPlans[groupCount];
  const mainRounds = plan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, plan.main)
    : buildCopinhaEliminationRounds(qualified.main, "main", mainName, true);
  const repechageRounds = plan
    ? buildCopinhaBracketFromPlan(qualified.repechage, "repechage", repechageName, plan.repechage)
    : buildCopinhaEliminationRounds(qualified.repechage, "repechage", repechageName, false);
  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

export function generateCupBrackets(data) {
  if (isSunsetData(data)) {
    return generateSunsetBrackets(data);
  }

  if (isPlayRankingData(data)) {
    return generatePlayRankingBrackets(data);
  }

  if (isCampeonatoCearenseData(data)) {
    return generateCearenseBrackets(data);
  }

  if (isCopinhaData(data)) {
    return generateCopinhaBrackets(data);
  }

  const qualified = getCupQualified(data);
  const cupConfig = data.cupConfig || {};
  const teamCount = cupConfig.teamCount || 12;
  const mainName = cupConfig.mainBracketName || "Principal";
  const repechageName = cupConfig.repechageName || "Repescagem";

  const mainIds = qualified.main.map((item) => item.id);
  const repechageIds = qualified.repechage.map((item) => item.id);

  const mainRounds = [];
  const repechageRounds = [];

  if ((teamCount === 18 || teamCount === 21) && mainIds.length === 14) {
    const preliminary = seedBracket(mainIds, "main");

    const quarterfinals = [
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_1",
        source1: null,
        source2: preliminary[0].matchKey,
        ids1: [mainIds[0]],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_2",
        source1: null,
        source2: preliminary[1].matchKey,
        ids1: [mainIds[1]],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 2,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_3",
        source1: preliminary[2].matchKey,
        source2: preliminary[3].matchKey,
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 3,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_4",
        source1: preliminary[4].matchKey,
        source2: preliminary[5].matchKey,
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 4,
      },
    ];

    const semifinals = [
      {
        phase: "main",
        roundName: "Semifinal",
        matchKey: "main_sf_1",
        source1: "main_qf_1",
        source2: "main_qf_4",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
      {
        phase: "main",
        roundName: "Semifinal",
        matchKey: "main_sf_2",
        source1: "main_qf_2",
        source2: "main_qf_3",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 2,
      },
    ];

    const final = [
      {
        phase: "main",
        roundName: "Final",
        matchKey: "main_final_1",
        source1: "main_sf_1",
        source2: "main_sf_2",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
    ];

    mainRounds.push({
      title: "Preliminar",
      bracketTitle: mainName,
      games: preliminary,
    });

    mainRounds.push({
      title: "Quartas de final",
      bracketTitle: mainName,
      games: quarterfinals,
    });

    mainRounds.push({
      title: "Semifinal",
      bracketTitle: mainName,
      games: semifinals,
    });

    mainRounds.push({
      title: "3º lugar",
      bracketTitle: mainName,
      games: buildThirdPlaceGame(semifinals),
    });

    mainRounds.push({
      title: "Final",
      bracketTitle: mainName,
      games: final,
    });
  } else {
    const mainFirstRound = seedBracket(mainIds, "main");

    if (mainFirstRound.length) {
      mainRounds.push({
        title: mainFirstRound[0].roundName,
        bracketTitle: mainName,
        games: mainFirstRound,
      });

      if (mainIds.length === 8) {
        const semifinals = buildNextRound(mainFirstRound, "main", "Semifinal", "sf");
        const thirdPlace = buildThirdPlaceGame(semifinals);
        const final = buildNextRound(semifinals, "main", "Final", "final");

        mainRounds.push({ title: "Semifinal", bracketTitle: mainName, games: semifinals });
        mainRounds.push({ title: "3º lugar", bracketTitle: mainName, games: thirdPlace });
        mainRounds.push({ title: "Final", bracketTitle: mainName, games: final });
      }

      if (mainIds.length === 16) {
        const quarterfinals = buildNextRound(mainFirstRound, "main", "Quartas de final", "qf");
        const semifinals = buildNextRound(quarterfinals, "main", "Semifinal", "sf");
        const thirdPlace = buildThirdPlaceGame(semifinals);
        const final = buildNextRound(semifinals, "main", "Final", "final");

        mainRounds.push({ title: "Quartas de final", bracketTitle: mainName, games: quarterfinals });
        mainRounds.push({ title: "Semifinal", bracketTitle: mainName, games: semifinals });
        mainRounds.push({ title: "3º lugar", bracketTitle: mainName, games: thirdPlace });
        mainRounds.push({ title: "Final", bracketTitle: mainName, games: final });
      }
    }
  }

  const repechageFirstRound =
    repechageIds.length === 4
      ? generateParallelRoundRobin(repechageIds)
      : seedBracket(repechageIds, "repechage");

  if (repechageFirstRound.length) {
    repechageRounds.push({
      title: repechageFirstRound[0].roundName,
      bracketTitle: repechageName,
      games: repechageFirstRound,
    });

    if (repechageIds.length === 4) {
      // Disputa Paralela: todos contra todos. Não gera final.
    } else if (repechageIds.length === 7) {
      const semifinals = [
        {
          phase: "repechage",
          roundName: "Semifinal",
          matchKey: "repechage_sf_1",
          source1: null,
          source2: repechageFirstRound[0].matchKey,
          ids1: [repechageIds[0]],
          ids2: [],
          team1: null,
          team2: null,
          s1: "",
          s2: "",
          court: 1,
        },
        {
          phase: "repechage",
          roundName: "Semifinal",
          matchKey: "repechage_sf_2",
          source1: repechageFirstRound[1].matchKey,
          source2: repechageFirstRound[2].matchKey,
          ids1: [],
          ids2: [],
          team1: null,
          team2: null,
          s1: "",
          s2: "",
          court: 2,
        },
      ];
      const final = buildNextRound(semifinals, "repechage", "Final", "final");

      repechageRounds.push({ title: "Semifinal", bracketTitle: repechageName, games: semifinals });
      repechageRounds.push({ title: "Final", bracketTitle: repechageName, games: final });
    } else if (repechageIds.length === 8) {
      const semifinals = buildNextRound(repechageFirstRound, "repechage", "Semifinal", "sf");
      const final = buildNextRound(semifinals, "repechage", "Final", "final");

      repechageRounds.push({ title: "Semifinal", bracketTitle: repechageName, games: semifinals });
      repechageRounds.push({ title: "Final", bracketTitle: repechageName, games: final });
    }
  }

  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  const resolvedMainRounds = mainRounds.map((round) => ({
    ...round,
    games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
  }));

  const resolvedRepechageRounds = repechageRounds.map((round) => ({
    ...round,
    games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
  }));

  return {
    main: resolvedMainRounds,
    repechage: resolvedRepechageRounds,
  };
}

export function getCupAllBracketGames(data) {
  const brackets = generateCupBrackets(data);
  return [
    ...brackets.main,
    ...brackets.repechage,
    ...(brackets.secondParallel || []),
    ...(brackets.thirdParallel || []),
    ...(brackets.sunsetFinal || []),
  ].flatMap((round) => round.games);
}

export function rebuildCupBracketGames(currentData, existingScores = {}) {
  const baseGames = getCupAllBracketGames(currentData).map((game) => ({
    ...game,
    s1: existingScores[game.matchKey]?.s1 ?? game.s1 ?? "",
    s2: existingScores[game.matchKey]?.s2 ?? game.s2 ?? "",
    inProgress: existingScores[game.matchKey]?.inProgress === true,
    ...getMatchTimerFields(existingScores[game.matchKey] || game),
    ...(existingScores[game.matchKey]?.courtNumberOverride
      ? { courtNumberOverride: existingScores[game.matchKey].courtNumberOverride }
      : {}),
  }));

  // Resolve novamente depois de reaplicar os placares. Assim, o vencedor de
  // uma fase anterior aparece imediatamente na fase seguinte.
  const resolvedGames = baseGames.map((game) => resolveBracketGame(game, baseGames, currentData));
  const safeGames = isPlayRankingData(currentData)
    ? resolvedGames.map((game) => {
        const stored = existingScores[game.matchKey];
        const sameParticipants = stored
          && JSON.stringify(stored.ids1 || []) === JSON.stringify(game.ids1 || [])
          && JSON.stringify(stored.ids2 || []) === JSON.stringify(game.ids2 || []);

        if (game.phase !== "repechage" || !stored || sameParticipants) return game;

        return { ...game, s1: "", s2: "" };
      })
    : resolvedGames;

  return safeGames.map((game) => resolveBracketGame(game, safeGames, currentData));
}

export function syncCupBracketScores(currentData) {
  const copy = structuredClone(currentData);
  const existingScores = {};

  (copy.brackets || []).forEach((game) => {
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
}
