import {
  getBrazilDateTimeKey,
  getBrazilTodayISO,
} from "./dateTime.mjs";
import { modalityConfig } from "./modalityConfig.mjs";
import { isCupType } from "./modalityClassification.mjs";
import {
  isCampeonatoCearenseData,
  isCearenseSecondParallelEnabled,
  isCearenseThirdParallelEnabled,
} from "./cupFormat.mjs";
import { normalizeCircuitStatus } from "./statusFormatting.mjs";
import { normalizeTournamentData } from "./tournamentDataNormalization.mjs";
import { resolveBracketGame } from "./bracketProgression.mjs";
import {
  getScoreWinnerSide,
  getWinningScore,
} from "./scoreRules.mjs";

export function getAutomaticEventStatus(endDate) {
  if (!endDate) return "active";
  return String(endDate) < getBrazilTodayISO() ? "finished" : "active";
}

export function hasTournamentGameSide(game, side) {
  const ids = Array.isArray(game?.[`ids${side}`]) ? game[`ids${side}`] : [];
  const names = Array.isArray(game?.[`team${side}`]) ? game[`team${side}`].filter(Boolean) : [];
  const entry = game?.[`entry${side}`];
  return ids.length > 0 || names.length > 0 || Boolean(entry && !entry.isBye && !entry.bye);
}

export function isTournamentByeGame(game) {
  if (game?.isBye || game?.bye) return true;
  const firstSide = hasTournamentGameSide(game, 1);
  const secondSide = hasTournamentGameSide(game, 2);
  return firstSide !== secondSide;
}

export function isTournamentGameFinished(game, winningScore) {
  if (!game || game.s1 === "" || game.s2 === "" || game.s1 === null || game.s2 === null) return false;
  return Boolean(getScoreWinnerSide(game, winningScore));
}

export function getTournamentCompletionState(tournament) {
  const config = modalityConfig[tournament?.type];
  const data = normalizeTournamentData(tournament?.type, tournament?.data);
  const winningScore = getWinningScore(data);
  const scheduleGames = (data.schedule || []).flat().filter((game) => (
    hasTournamentGameSide(game, 1) && hasTournamentGameSide(game, 2)
  ));
  const bracketGames = (data.brackets || [])
    .filter((game) => game.phase === "main")
    .map((game) => resolveBracketGame(game, data.brackets || [], data));
  const requiredBracketGames = bracketGames.filter((game) => {
    if (isTournamentByeGame(game)) return false;
    if (!isCampeonatoCearenseData(data)) return true;
    const matchKey = String(game.matchKey || "");
    const phase = game.phase
      || (matchKey.startsWith("thirdParallel_") ? "thirdParallel" : "")
      || (matchKey.startsWith("repechage_") ? "repechage" : "");
    if (phase === "repechage" && !isCearenseSecondParallelEnabled(data)) return false;
    if (phase === "thirdParallel" && !isCearenseThirdParallelEnabled(data)) return false;
    return true;
  });
  const requiredGames = [...scheduleGames, ...requiredBracketGames];
  const needsEliminationBracket = isCupType(config);
  const bracketReady = !needsEliminationBracket || requiredBracketGames.length > 0;

  return {
    hasRequiredGames: requiredGames.length > 0 && bracketReady,
    completed: requiredGames.length > 0
      && bracketReady
      && requiredGames.every((game) => isTournamentGameFinished(game, winningScore)),
    requiredGames: requiredGames.length,
    completedGames: requiredGames.filter((game) => isTournamentGameFinished(game, winningScore)).length,
  };
}

export function getTournamentLifecycleStatus(tournament, now = new Date()) {
  const details = tournament?.data || {};
  const eventKey = getTournamentEventSortKey(tournament);
  const nowKey = getBrazilDateTimeKey(now);
  const today = getBrazilTodayISO(now);
  const eventStartDate = String(details.eventStartDate || details.eventDate || "").slice(0, 10);
  const eventStartTime = String(details.eventStartTime || "").trim();
  const eventEndDate = String(details.eventEndDate || details.eventDate || "").slice(0, 10);

  if (details.lifecycleStatus === "finished" && (tournament?.directoryEntry || tournament?.__summary)) return "finished";
  if (getTournamentCompletionState(tournament).completed) return "finished";
  if (eventEndDate && eventEndDate < today) return "finished";
  if (eventStartDate && eventStartDate > today) return "upcoming";
  if (eventStartDate === today && eventStartTime && eventKey > nowKey) return "upcoming";

  return "active";
}

export function isPublicItemFinished(item, kind = "tournament") {
  if (kind === "tournament") return getTournamentLifecycleStatus(item) === "finished";

  const endDate = item?.end_date || item?.endDate;
  if (!endDate) return normalizeCircuitStatus(item?.status) === "closed";
  return getAutomaticEventStatus(endDate) === "finished";
}

export function getCircuitLifecycleStatus(circuit) {
  const today = getBrazilTodayISO();
  const startDate = String(circuit?.start_date || circuit?.startDate || "").slice(0, 10);

  if (isPublicItemFinished(circuit, "circuit")) return "finished";
  if (startDate && startDate > today) return "upcoming";
  return "active";
}

export function getTournamentEventSortKey(tournament) {
  const details = tournament?.data || {};
  const eventDate = String(details.eventDate || details.eventStartDate || "").slice(0, 10);
  const rawTime = String(details.eventStartTime || "").trim();
  const eventTime = /^\d{2}:\d{2}/.test(rawTime) ? rawTime.slice(0, 5) : "23:59";
  return eventDate ? `${eventDate}T${eventTime}` : "9999-12-31T23:59";
}

export function compareTournamentsByEventSchedule(first, second) {
  const statusOrder = { active: 0, upcoming: 1, finished: 2 };
  const firstStatus = getTournamentLifecycleStatus(first);
  const secondStatus = getTournamentLifecycleStatus(second);
  const statusComparison = (statusOrder[firstStatus] ?? 1) - (statusOrder[secondStatus] ?? 1);
  if (statusComparison !== 0) return statusComparison;

  const scheduleComparison = getTournamentEventSortKey(first).localeCompare(getTournamentEventSortKey(second));
  if (scheduleComparison !== 0) return firstStatus === "finished" ? -scheduleComparison : scheduleComparison;

  const createdComparison = String(first?.created_at || "").localeCompare(String(second?.created_at || ""));
  if (createdComparison !== 0) return createdComparison;

  return String(first?.name || "").localeCompare(String(second?.name || ""), "pt-BR");
}

export function sortTournamentsByEventSchedule(items) {
  return [...(items || [])].sort(compareTournamentsByEventSchedule);
}

export function sortTournamentsChronologically(items) {
  return [...(items || [])].sort((first, second) => (
    getTournamentEventSortKey(first).localeCompare(getTournamentEventSortKey(second))
  ));
}

export function sortTournamentsByDisplayOrder(items) {
  return (items || [])
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((first, second) => {
      const firstOrder = Number(first.item.data?.displayOrder);
      const secondOrder = Number(second.item.data?.displayOrder);
      const firstHasOrder = Number.isFinite(firstOrder);
      const secondHasOrder = Number.isFinite(secondOrder);

      if (firstHasOrder && secondHasOrder && firstOrder !== secondOrder) return firstOrder - secondOrder;
      if (firstHasOrder !== secondHasOrder) return firstHasOrder ? -1 : 1;
      return first.originalIndex - second.originalIndex;
    })
    .map(({ item }) => item);
}

export function hasSavedManualTournamentOrder(items) {
  if (!items?.length) return false;
  if (!items.every((item) => item.data?.displayOrderMode === "manual")) return false;
  const orders = items
    .map((item) => Number(item.data?.displayOrder))
    .filter((order) => Number.isInteger(order))
    .sort((first, second) => first - second);

  return orders.length === items.length && orders.every((order, index) => order === index);
}

export function sortTournamentsForDisplay(items) {
  return hasSavedManualTournamentOrder(items)
    ? sortTournamentsByDisplayOrder(items)
    : sortTournamentsByEventSchedule(items);
}

export function insertTournamentsByEventSchedule(currentItems, incomingItems) {
  const incomingIds = new Set((incomingItems || []).map((item) => item.id));
  const ordered = (currentItems || []).filter((item) => !incomingIds.has(item.id));

  sortTournamentsByEventSchedule(incomingItems).forEach((incoming) => {
    const insertionIndex = ordered.findIndex((item) => compareTournamentsByEventSchedule(incoming, item) < 0);
    if (insertionIndex < 0) ordered.push(incoming);
    else ordered.splice(insertionIndex, 0, incoming);
  });

  return ordered;
}

export function getTournamentRegistrationDeadline(tournament) {
  return tournament?.data?.registrationDeadline
    || tournament?.registrationDeadline
    || tournament?.registration_deadline
    || "";
}

export function isRegistrationDeadlineOpen(deadline) {
  return Boolean(deadline) && String(deadline) >= getBrazilTodayISO();
}
