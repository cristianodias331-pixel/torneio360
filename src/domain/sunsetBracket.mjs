import {
  buildCearenseEliminationRounds,
  createCopinhaBracketGame,
} from "./bracketConstruction.mjs";

export function getSunsetMainSourceGames(mainRounds, openingGameCount) {
  const sourceRound = (mainRounds || []).find((round) => {
    const normalizedTitle = String(round?.title || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
    const isPlacement = normalizedTitle.includes("3º")
      || normalizedTitle.includes("3°")
      || normalizedTitle.includes("terceiro");
    return !isPlacement && (round.games || []).length === openingGameCount;
  });

  return (sourceRound?.games || []).filter((game) => !game.isBye);
}

export function buildSunsetParallelFromMainRound(mainRounds, openingGameCount, phase, bracketTitle) {
  const sourceGames = getSunsetMainSourceGames(mainRounds, openingGameCount);
  if (sourceGames.length < 2) return [];

  return buildCearenseEliminationRounds(
    sourceGames.map((game) => ({
      sourceMatchKey: game.matchKey,
      sourceMode: "loser",
    })),
    phase,
    bracketTitle
  );
}

export function getBracketChampionSource(rounds) {
  const finalRound = (rounds || []).find((round) => (
    String(round?.title || "").trim().toLocaleLowerCase("pt-BR") === "final"
  ));
  const finalGame = finalRound?.games?.[0];
  return finalGame
    ? { sourceMatchKey: finalGame.matchKey, sourceMode: "winner" }
    : null;
}

export function buildSunsetChampionsRounds(brackets, bracketTitle) {
  const principal = getBracketChampionSource(brackets.main);
  const firstParallel = getBracketChampionSource(brackets.repechage);
  const secondParallel = getBracketChampionSource(brackets.secondParallel);
  const thirdParallel = getBracketChampionSource(brackets.thirdParallel);
  const champions = [principal, firstParallel, secondParallel, thirdParallel].filter(Boolean);

  if (!principal || champions.length < 2) return [];

  if (champions.length === 2) {
    return [{
      title: "Final",
      bracketTitle,
      games: [createCopinhaBracketGame({
        bracketType: "sunsetFinal",
        roundName: "Final",
        matchKey: "sunsetFinal_final_1",
        entry1: champions[0],
        entry2: champions[1],
        court: 1,
      })],
    }];
  }

  if (champions.length === 3) {
    const semifinal = createCopinhaBracketGame({
      bracketType: "sunsetFinal",
      roundName: "Semifinal",
      matchKey: "sunsetFinal_sf_1",
      entry1: champions[1],
      entry2: champions[2],
      court: 1,
    });
    const final = createCopinhaBracketGame({
      bracketType: "sunsetFinal",
      roundName: "Final",
      matchKey: "sunsetFinal_final_1",
      entry1: principal,
      entry2: { sourceMatchKey: semifinal.matchKey, sourceMode: "winner" },
      court: 1,
    });

    return [
      { title: "Semifinal", bracketTitle, games: [semifinal] },
      { title: "Final", bracketTitle, games: [final] },
    ];
  }

  const semifinals = [
    createCopinhaBracketGame({
      bracketType: "sunsetFinal",
      roundName: "Semifinal",
      matchKey: "sunsetFinal_sf_1",
      entry1: principal,
      entry2: firstParallel,
      court: 1,
    }),
    createCopinhaBracketGame({
      bracketType: "sunsetFinal",
      roundName: "Semifinal",
      matchKey: "sunsetFinal_sf_2",
      entry1: secondParallel,
      entry2: thirdParallel,
      court: 2,
    }),
  ];
  const final = createCopinhaBracketGame({
    bracketType: "sunsetFinal",
    roundName: "Final",
    matchKey: "sunsetFinal_final_1",
    entry1: { sourceMatchKey: semifinals[0].matchKey, sourceMode: "winner" },
    entry2: { sourceMatchKey: semifinals[1].matchKey, sourceMode: "winner" },
    court: 1,
  });

  return [
    { title: "Semifinal", bracketTitle, games: semifinals },
    { title: "Final", bracketTitle, games: [final] },
  ];
}
