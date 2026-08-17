import {
  buildCearenseEliminationRounds,
  createCopinhaBracketGame,
} from "./bracketConstruction.mjs";

export function getCearenseThirdParallelSources(mainRounds) {
  const rounds = Array.isArray(mainRounds) ? mainRounds : [];
  const realGames = (round) => (round?.games || []).filter((game) => (
    Array.isArray(game)
      ? Boolean(game[1]) && Boolean(game[2])
      : !game.isBye
  ));
  const normalizedTitle = (round) => String(round?.title || "").toLocaleLowerCase("pt-BR");
  const quarterfinalIndex = rounds.findIndex((round) => normalizedTitle(round).includes("quartas"));

  if (quarterfinalIndex >= 0) {
    const quarterfinal = rounds[quarterfinalIndex];
    const quarterfinalGames = realGames(quarterfinal);
    const previousRound = rounds
      .slice(0, quarterfinalIndex)
      .reverse()
      .find((round) => realGames(round).length > 0);
    const previousRoundGames = realGames(previousRound);

    return {
      sections: [
        ...(quarterfinalGames.length > 0 ? [{ round: quarterfinal, games: quarterfinalGames }] : []),
        ...(previousRoundGames.length > 0 ? [{ round: previousRound, games: previousRoundGames }] : []),
      ],
      games: [...quarterfinalGames, ...previousRoundGames],
    };
  }

  const semifinal = rounds.find((round) => normalizedTitle(round).includes("semifinal"));
  const semifinalGames = realGames(semifinal);

  return {
    sections: semifinalGames.length > 0 ? [{ round: semifinal, games: semifinalGames }] : [],
    games: semifinalGames,
  };
}

export function buildCearenseThirdParallelRounds(mainRounds, bracketTitle) {
  const { sections, games: sourceGames } = getCearenseThirdParallelSources(mainRounds);

  if (sourceGames.length < 2) return [];

  const sourceEntries = sourceGames.map((game) => ({
    sourceMatchKey: game.matchKey,
    sourceMode: "loser",
  }));

  if (sourceEntries.length === 2) {
    return [{
      title: "Final",
      bracketTitle,
      games: [createCopinhaBracketGame({
        bracketType: "thirdParallel",
        roundName: "Final",
        matchKey: "thirdParallel_final_1",
        entry1: sourceEntries[0],
        entry2: sourceEntries[1],
        court: 1,
      })],
    }];
  }

  if (sourceEntries.length === 4) {
    const semifinalPairs = sections.length > 1
      ? [[sourceEntries[0], sourceEntries[3]], [sourceEntries[1], sourceEntries[2]]]
      : [[sourceEntries[0], sourceEntries[1]], [sourceEntries[2], sourceEntries[3]]];
    const semifinals = semifinalPairs.map(([entry1, entry2], index) => createCopinhaBracketGame({
      bracketType: "thirdParallel",
      roundName: "Semifinal",
      matchKey: `thirdParallel_sf_${index + 1}`,
      entry1,
      entry2,
      court: index + 1,
    }));
    const final = createCopinhaBracketGame({
      bracketType: "thirdParallel",
      roundName: "Final",
      matchKey: "thirdParallel_final_1",
      entry1: { sourceMatchKey: semifinals[0].matchKey, sourceMode: "winner" },
      entry2: { sourceMatchKey: semifinals[1].matchKey, sourceMode: "winner" },
      court: 1,
    });

    return [
      { title: "Semifinal", bracketTitle, games: semifinals },
      { title: "Final", bracketTitle, games: [final] },
    ];
  }

  return buildCearenseEliminationRounds(
    sourceEntries,
    "thirdParallel",
    bracketTitle
  );
}
