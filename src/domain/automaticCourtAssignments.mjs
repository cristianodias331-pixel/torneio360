import {
  createDefaultCourtNumbers,
  normalizeCourtNumberValue,
} from "./courtNumbers.mjs";
import { getScoreWinnerSide } from "./scoreRules.mjs";

function uniqueCourtNumbers(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeCourtNumberValue)
      .filter(Boolean)
  ));
}

export function buildAutomaticCourtPool({
  configured = false,
  centralCourtNumbers = [],
  preferredCourtNumbers = [],
  unavailableCourtNumbers = [],
  fallbackCount = 1,
} = {}) {
  if (!configured) return createDefaultCourtNumbers(fallbackCount);

  const unavailable = new Set(uniqueCourtNumbers(unavailableCourtNumbers));
  const central = uniqueCourtNumbers(centralCourtNumbers)
    .filter((number) => !unavailable.has(number));
  const preferred = uniqueCourtNumbers(preferredCourtNumbers)
    .filter((number) => central.includes(number));

  return [...preferred, ...central.filter((number) => !preferred.includes(number))];
}

function isFinishedGame(game, winningScore) {
  return game?.isBye === true || getScoreWinnerSide(game, winningScore) !== null;
}

function getExplicitCourtNumber(game) {
  return normalizeCourtNumberValue(game?.courtNumberOverride || game?.courtLabelOverride);
}

function getPreferredGameCourtNumber(game, pool) {
  const explicit = getExplicitCourtNumber(game);
  if (explicit && pool.includes(explicit)) return explicit;
  return pool[Math.max(0, Number(game?.court || 1) - 1)] || "";
}

function applyAutomaticNumber(game, number) {
  const copy = { ...game };
  delete copy.courtLabelOverride;

  if (!number) {
    delete copy.courtNumberOverride;
    copy.courtAssignmentPending = true;
    return copy;
  }

  copy.courtNumberOverride = number;
  delete copy.courtAssignmentPending;
  return copy;
}

export function assignCourtNumbersToGames(games = [], courtNumbers = [], winningScore = 4) {
  const pool = uniqueCourtNumbers(courtNumbers);
  const copies = (Array.isArray(games) ? games : []).map((game) => ({ ...game }));
  const reserved = new Set();

  // Jogos em andamento têm prioridade e continuam na quadra em que começaram.
  copies.forEach((game, index) => {
    if (game?.inProgress !== true || isFinishedGame(game, winningScore)) return;
    const preferred = getPreferredGameCourtNumber(game, pool);
    const number = preferred && !reserved.has(preferred)
      ? preferred
      : pool.find((candidate) => !reserved.has(candidate)) || "";
    copies[index] = applyAutomaticNumber(game, number);
    if (number) reserved.add(number);
  });

  copies.forEach((game, index) => {
    if (game?.inProgress === true && !isFinishedGame(game, winningScore)) return;

    if (isFinishedGame(game, winningScore)) {
      const explicit = getExplicitCourtNumber(game);
      const structural = pool[Math.max(0, Number(game?.court || 1) - 1)] || "";
      copies[index] = applyAutomaticNumber(game, explicit || structural);
      return;
    }

    const preferred = getPreferredGameCourtNumber(game, pool);
    const number = preferred && !reserved.has(preferred)
      ? preferred
      : pool.find((candidate) => !reserved.has(candidate)) || "";
    copies[index] = applyAutomaticNumber(game, number);
    if (number) reserved.add(number);
  });

  return copies;
}

export function assignScheduleCourtNumbers(schedule = [], courtNumbers = [], winningScore = 4) {
  return (Array.isArray(schedule) ? schedule : []).map((round) => (
    assignCourtNumbersToGames(round, courtNumbers, winningScore)
  ));
}

export function assignBracketCourtNumbers(games = [], courtNumbers = [], winningScore = 4) {
  const source = Array.isArray(games) ? games : [];
  const groupedIndexes = new Map();

  source.forEach((game, index) => {
    const key = `${game?.phase || "fase"}:${game?.roundName || game?.round || "rodada"}`;
    if (!groupedIndexes.has(key)) groupedIndexes.set(key, []);
    groupedIndexes.get(key).push(index);
  });

  const result = source.map((game) => ({ ...game }));
  groupedIndexes.forEach((indexes) => {
    const assigned = assignCourtNumbersToGames(
      indexes.map((index) => source[index]),
      courtNumbers,
      winningScore
    );
    indexes.forEach((sourceIndex, groupIndex) => {
      result[sourceIndex] = assigned[groupIndex];
    });
  });

  return result;
}

export function assignGroupedBracketCourtNumbers(groupedBrackets, courtNumbers = [], winningScore = 4) {
  if (!groupedBrackets || typeof groupedBrackets !== "object") return groupedBrackets;
  return Object.fromEntries(
    Object.entries(groupedBrackets).map(([key, roundsOrGames]) => {
      if (!Array.isArray(roundsOrGames)) return [key, roundsOrGames];
      if (roundsOrGames.some((item) => Array.isArray(item?.games))) {
        return [key, roundsOrGames.map((round) => ({
          ...round,
          games: assignCourtNumbersToGames(round?.games || [], courtNumbers, winningScore),
        }))];
      }
      return [key, assignBracketCourtNumbers(roundsOrGames, courtNumbers, winningScore)];
    })
  );
}
