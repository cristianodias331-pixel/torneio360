import { getScoreWinnerSide } from "./scoreRules.mjs";

export function getCopinhaHeadToHeadWinnerId(firstId, secondId, groupGames, winningScore) {
  const game = groupGames.find((item) => {
    const id1 = item.ids1?.[0];
    const id2 = item.ids2?.[0];
    return (id1 === firstId && id2 === secondId) || (id1 === secondId && id2 === firstId);
  });

  if (!game) return null;

  const winnerSide = getScoreWinnerSide(game, winningScore);
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids1?.[0] ?? null : game.ids2?.[0] ?? null;
}

export function getCopinhaManualTieOrder(tiedRows, storedOrder) {
  const tiedIds = tiedRows.map((row) => row.id);
  const order = Array.isArray(storedOrder)
    ? storedOrder.map((id) => Number(id)).filter((id) => tiedIds.includes(id))
    : [];
  const uniqueOrder = Array.from(new Set(order));

  return uniqueOrder.length === tiedRows.length ? uniqueOrder : null;
}

export function rankCopinhaGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => {
    const winsDiff = b.w - a.w;
    if (winsDiff !== 0) return winsDiff;

    const balanceDiff = b.bal - a.bal;
    if (balanceDiff !== 0) return balanceDiff;

    return a.name.localeCompare(b.name);
  });

  const allGroupGamesFinished = groupGames.length === 3 && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) {
    return { rows: baseRows, unresolvedTieIds: [] };
  }

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;

    while (
      end < baseRows.length &&
      baseRows[end].w === baseRows[start].w &&
      baseRows[end].bal === baseRows[start].bal
    ) {
      end += 1;
    }

    const tiedRows = baseRows.slice(start, end);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else {
      const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

      if (manualOrder) {
        rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else if (tiedRows.length === 2) {
        const winnerId = getCopinhaHeadToHeadWinnerId(
          tiedRows[0].id,
          tiedRows[1].id,
          groupGames,
          winningScore
        );

        if (winnerId !== null) {
          rankedRows.push(...[...tiedRows].sort((a, b) => (a.id === winnerId ? -1 : 1)));
        } else {
          unresolvedTieIds.push(...tiedRows.map((row) => row.id));
          rankedRows.push(...tiedRows);
        }
      } else {
        unresolvedTieIds.push(...tiedRows.map((row) => row.id));
        rankedRows.push(...tiedRows);
      }
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

export function rankCearenseGroupRows(rows, groupGames, winningScore, criteria, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => {
    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  });
  const expectedGameCount = (rows.length * (rows.length - 1)) / 2;
  const allGroupGamesFinished = groupGames.length === expectedGameCount && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) {
    return { rows: baseRows, unresolvedTieIds: [] };
  }

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;

    while (
      end < baseRows.length &&
      baseRows[end].w === baseRows[start].w &&
      baseRows[end].bal === baseRows[start].bal &&
      baseRows[end].pts === baseRows[start].pts
    ) {
      end += 1;
    }

    const tiedRows = baseRows.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else if (manualOrder) {
      rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else {
      unresolvedTieIds.push(...tiedRows.map((row) => row.id));
      rankedRows.push(...tiedRows);
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

function rankWinsBalanceHeadToHeadGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => (
    b.w - a.w || b.bal - a.bal || a.name.localeCompare(b.name)
  ));
  const expectedGameCount = (rows.length * (rows.length - 1)) / 2;
  const allGroupGamesFinished = groupGames.length === expectedGameCount && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) return { rows: baseRows, unresolvedTieIds: [] };

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;
    while (
      end < baseRows.length
      && baseRows[end].w === baseRows[start].w
      && baseRows[end].bal === baseRows[start].bal
    ) end += 1;

    const tiedRows = baseRows.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else if (manualOrder) {
      rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else if (tiedRows.length === 2) {
      const winnerId = getCopinhaHeadToHeadWinnerId(
        tiedRows[0].id,
        tiedRows[1].id,
        groupGames,
        winningScore
      );

      if (winnerId !== null) {
        rankedRows.push(...[...tiedRows].sort((a, b) => (
          a.id === winnerId ? -1 : b.id === winnerId ? 1 : 0
        )));
      } else {
        unresolvedTieIds.push(...tiedRows.map((row) => row.id));
        rankedRows.push(...tiedRows);
      }
    } else {
      unresolvedTieIds.push(...tiedRows.map((row) => row.id));
      rankedRows.push(...tiedRows);
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

export function rankOfficialCearenseGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  return rankWinsBalanceHeadToHeadGroupRows(rows, groupGames, winningScore, storedTieOrder);
}

function getTiedHeadToHeadWins(tiedRows, groupGames, winningScore) {
  const tiedIds = new Set(tiedRows.map((row) => row.id));
  const winsById = new Map(tiedRows.map((row) => [row.id, 0]));

  groupGames.forEach((game) => {
    const firstId = game.ids1?.[0];
    const secondId = game.ids2?.[0];
    if (!tiedIds.has(firstId) || !tiedIds.has(secondId)) return;

    const winnerSide = getScoreWinnerSide(game, winningScore);
    const winnerId = winnerSide === "team1"
      ? firstId
      : winnerSide === "team2"
      ? secondId
      : null;
    if (winnerId !== null) winsById.set(winnerId, winsById.get(winnerId) + 1);
  });

  return winsById;
}

function haveSameGroupCoefficient(first, second) {
  return Math.abs(Number(first.coefficient || 0) - Number(second.coefficient || 0)) < 1e-12;
}

export function rankPlayRankingGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => (
    b.w - a.w || b.bal - a.bal || a.name.localeCompare(b.name)
  ));
  const expectedGameCount = (rows.length * (rows.length - 1)) / 2;
  const allGroupGamesFinished = groupGames.length === expectedGameCount && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) return { rows: baseRows, unresolvedTieIds: [] };

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;
    while (
      end < baseRows.length
      && baseRows[end].w === baseRows[start].w
      && baseRows[end].bal === baseRows[start].bal
    ) end += 1;

    const tiedRows = baseRows.slice(start, end);
    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
      start = end;
      continue;
    }

    const headToHeadWins = getTiedHeadToHeadWins(tiedRows, groupGames, winningScore);
    const headToHeadSeparates = new Set(headToHeadWins.values()).size > 1;
    const headToHeadRows = [...tiedRows].sort((a, b) => (
      (headToHeadSeparates ? headToHeadWins.get(b.id) - headToHeadWins.get(a.id) : 0)
      || a.name.localeCompare(b.name)
    ));

    for (let directStart = 0; directStart < headToHeadRows.length;) {
      let directEnd = directStart + 1;
      while (
        directEnd < headToHeadRows.length
        && (!headToHeadSeparates || headToHeadWins.get(headToHeadRows[directEnd].id) === headToHeadWins.get(headToHeadRows[directStart].id))
      ) directEnd += 1;

      const coefficientRows = headToHeadRows.slice(directStart, directEnd).sort((a, b) => (
        Number(b.coefficient || 0) - Number(a.coefficient || 0)
        || a.name.localeCompare(b.name)
      ));

      for (let coefficientStart = 0; coefficientStart < coefficientRows.length;) {
        let coefficientEnd = coefficientStart + 1;
        while (
          coefficientEnd < coefficientRows.length
          && haveSameGroupCoefficient(coefficientRows[coefficientStart], coefficientRows[coefficientEnd])
        ) coefficientEnd += 1;

        const coefficientTiedRows = coefficientRows.slice(coefficientStart, coefficientEnd);
        const manualOrder = getCopinhaManualTieOrder(coefficientTiedRows, storedTieOrder);

        if (coefficientTiedRows.length === 1) {
          rankedRows.push(coefficientTiedRows[0]);
        } else if (manualOrder) {
          rankedRows.push(...[...coefficientTiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
        } else {
          unresolvedTieIds.push(...coefficientTiedRows.map((row) => row.id));
          rankedRows.push(...coefficientTiedRows);
        }

        coefficientStart = coefficientEnd;
      }

      directStart = directEnd;
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}
