import {
  removePendingTournament,
  savePendingTournament,
} from "../offlineDataStore.mjs";
import { normalizeCourtNumberValue } from "./courtNumbers.mjs";
import { getCollaborationRevision } from "./realtimeTournamentMerge.mjs";

export const USER_APP_STATE_STORAGE_PREFIX = "torneio360:user-app-state:v2:";
export const OPEN_TOURNAMENTS_STORAGE_PREFIX = "torneio360:open-tournaments:v1:";
export const OPEN_TOURNAMENT_NAV_STORAGE_PREFIX = "torneio360:open-tournament-navigation:v1:";
export const COURT_CENTERS_STORAGE_PREFIX = "torneio360:court-centers:v1:";
export const PROFILE_CACHE_STORAGE_PREFIX = "torneio360:profile-cache:v1:";
export const TOURNAMENT_DRAFT_STORAGE_PREFIX = "torneio360:tournament-draft:";
export const TOURNAMENT_DRAFT_CHANGED_EVENT = "torneio360:tournament-draft-changed";
export const DEFAULT_TOURNAMENT_NAVIGATION = Object.freeze({
  tournamentTab: "participantes",
  matchesTab: "grupos",
  scrollY: 0,
});

export function readPublicViewStorage(key, fallbackValue) {
  try {
    return sessionStorage.getItem(key) || fallbackValue;
  } catch (error) {
    // Links públicos também precisam funcionar quando o navegador bloqueia
    // o armazenamento da sessão, como em algumas visualizações dentro de apps.
    return fallbackValue;
  }
}

export function savePublicViewStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    // A aba continua navegável mesmo sem persistir a última subaba aberta.
  }
}

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isRetryableConnectionError(error) {
  if (isBrowserOffline()) return true;
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return /failed to fetch|fetch failed|network|offline|connection|timeout|timed out|load failed|gateway|temporarily unavailable/.test(text);
}

export function getProfileCacheKey(userId) {
  return `${PROFILE_CACHE_STORAGE_PREFIX}${userId}`;
}

export function readCachedProfile(userId) {
  if (!userId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(getProfileCacheKey(userId)) || "null");
    return cached?.profile && typeof cached.profile === "object" ? cached.profile : null;
  } catch {
    return null;
  }
}

export function saveCachedProfile(userId, profile) {
  if (!userId || !profile) return;
  try {
    localStorage.setItem(getProfileCacheKey(userId), JSON.stringify({
      profile,
      savedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Não foi possível atualizar a cópia offline do perfil.", error);
  }
}

export function getOpenTournamentsStorageKey(userId) {
  return `${OPEN_TOURNAMENTS_STORAGE_PREFIX}${userId || "anonymous"}`;
}

export function getOpenTournamentNavigationStorageKey(userId) {
  return `${OPEN_TOURNAMENT_NAV_STORAGE_PREFIX}${userId || "anonymous"}`;
}

export function getCourtCentersStorageKey(userId) {
  return `${COURT_CENTERS_STORAGE_PREFIX}${userId || "anonymous"}`;
}

export function getTournamentVenueLabel(tournament) {
  return String(tournament?.data?.location || "Local não informado").trim() || "Local não informado";
}

export function getTournamentVenueKey(tournament) {
  return getTournamentVenueLabel(tournament)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "local-nao-informado";
}

export function normalizeCourtCenterEntry(entry, fallbackLabel = "Local não informado") {
  const numbers = Array.from(new Set(
    (Array.isArray(entry?.numbers) ? entry.numbers : [])
      .map(normalizeCourtNumberValue)
      .filter(Boolean)
  )).sort((left, right) => Number(left) - Number(right));
  const unavailableNumbers = Array.from(new Set(
    (Array.isArray(entry?.unavailableNumbers) ? entry.unavailableNumbers : [])
      .map(normalizeCourtNumberValue)
      .filter((number) => number && numbers.includes(number))
  ));
  const tournamentPreferences = Object.fromEntries(
    Object.entries(entry?.tournamentPreferences || {}).map(([tournamentId, preferredNumbers]) => [
      tournamentId,
      Array.from(new Set(
        (Array.isArray(preferredNumbers) ? preferredNumbers : [])
          .map(normalizeCourtNumberValue)
          .filter((number) => number && numbers.includes(number))
      )),
    ])
  );
  return {
    label: String(entry?.label || fallbackLabel).trim() || fallbackLabel,
    numbers,
    unavailableNumbers,
    tournamentPreferences,
    configured: entry?.configured === true,
  };
}

export function readCourtCenters(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getCourtCentersStorageKey(userId)) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [key, normalizeCourtCenterEntry(entry)])
    );
  } catch {
    return {};
  }
}

export function saveCourtCenters(userId, centers) {
  try {
    localStorage.setItem(getCourtCentersStorageKey(userId), JSON.stringify(centers || {}));
  } catch {
    // A central continua disponível durante a sessão mesmo sem armazenamento local.
  }
}

export function readOpenTournamentIds(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getOpenTournamentsStorageKey(userId)) || "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id) => typeof id === "string" && id.trim()))].slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

export function saveOpenTournamentIds(userId, ids) {
  try {
    const normalized = [...new Set((ids || []).filter(Boolean))].slice(0, 50);
    localStorage.setItem(getOpenTournamentsStorageKey(userId), JSON.stringify(normalized));
  } catch {
    // A central continua funcionando durante a sessao mesmo sem armazenamento local.
  }
}

export function readOpenTournamentNavigation(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getOpenTournamentNavigationStorageKey(userId)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOpenTournamentNavigation(userId, navigation) {
  try {
    localStorage.setItem(
      getOpenTournamentNavigationStorageKey(userId),
      JSON.stringify(navigation && typeof navigation === "object" ? navigation : {})
    );
  } catch {
    // A troca de torneios continua disponivel mesmo sem armazenamento local.
  }
}

export function getUserAppStateStorageKey(userId) {
  return `${USER_APP_STATE_STORAGE_PREFIX}${userId}`;
}

export function getAppStateTimestamp(state) {
  const time = Date.parse(state?.updated_at || "");
  return Number.isFinite(time) ? time : 0;
}

export function readLocalUserAppState(userId) {
  if (!userId) return null;

  const key = getUserAppStateStorageKey(userId);
  const states = [];

  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) states.push(JSON.parse(sessionValue));
  } catch (error) {
    console.warn("Não foi possível ler a posição salva nesta aba", error);
  }

  try {
    const localValue = localStorage.getItem(key);
    if (localValue) states.push(JSON.parse(localValue));
  } catch (error) {
    console.warn("Não foi possível ler a posição salva neste dispositivo", error);
  }

  return states
    .filter((state) => state && typeof state === "object")
    .sort((first, second) => getAppStateTimestamp(second) - getAppStateTimestamp(first))[0] || null;
}

export function saveLocalUserAppState(userId, state) {
  if (!userId || !state) return;

  const serialized = JSON.stringify(state);
  const key = getUserAppStateStorageKey(userId);

  try {
    // sessionStorage recupera a posição imediatamente ao voltar para esta aba.
    sessionStorage.setItem(key, serialized);
  } catch (error) {
    console.warn("Não foi possível salvar a posição nesta aba", error);
  }

  try {
    // localStorage é o backup caso o navegador descarregue a aba antes do upsert.
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.warn("Não foi possível salvar a posição neste dispositivo", error);
  }
}

export function getTournamentDraftStorageKey(userId, tournamentId) {
  return `${TOURNAMENT_DRAFT_STORAGE_PREFIX}${userId || "anonymous"}:${tournamentId}`;
}

export function notifyTournamentDraftChanged(userId, tournamentId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOURNAMENT_DRAFT_CHANGED_EVENT, {
    detail: { userId, tournamentId },
  }));
}

export function listLocalTournamentDrafts(userId) {
  if (!userId) return [];
  const prefix = `${TOURNAMENT_DRAFT_STORAGE_PREFIX}${userId}:`;

  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => {
        try {
          const draft = JSON.parse(localStorage.getItem(key) || "null");
          const tournamentId = key.slice(prefix.length);
          return draft?.data && tournamentId ? { ...draft, userId, tournamentId } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readTournamentDraft(userId, tournament) {
  if (!tournament?.id) return null;

  try {
    const rawDraft = localStorage.getItem(getTournamentDraftStorageKey(userId, tournament.id));
    if (!rawDraft) return null;
    const draft = JSON.parse(rawDraft);
    if (draft?.pending === true && draft?.data) return draft;

    const draftUpdatedAt = Number(draft?.updatedAt || 0);
    const serverUpdatedAt = Date.parse(tournament.updated_at || tournament.created_at || "") || 0;

    if (!draft?.data || draftUpdatedAt <= serverUpdatedAt) return null;
    return draft;
  } catch (error) {
    console.warn("Não foi possível recuperar o rascunho local do torneio", error);
    return null;
  }
}

export function saveTournamentDraft(
  userId,
  tournament,
  data,
  baseUpdatedAt = null,
  baseData = null,
  baseRevision = null,
  options = {}
) {
  const tournamentId = typeof tournament === "string" ? tournament : tournament?.id;
  if (!userId || !tournamentId || !data) return Promise.resolve(false);
  const draft = {
    data,
    name: typeof tournament === "object" ? tournament.name : "",
    type: typeof tournament === "object" ? tournament.type : "",
    status: typeof tournament === "object" ? tournament.status : "active",
    public_id: typeof tournament === "object" ? tournament.public_id : null,
    is_public: typeof tournament === "object" ? tournament.is_public : true,
    created_at: typeof tournament === "object" ? tournament.created_at : null,
    baseUpdatedAt: baseUpdatedAt || (typeof tournament === "object" ? tournament.updated_at : null),
    baseRevision: baseRevision ?? (typeof tournament === "object" ? getCollaborationRevision(tournament) : null),
    baseData: baseData || (typeof tournament === "object" ? tournament.data : null),
    allowScoreRegression: options.allowScoreRegression === true,
    updatedAt: Date.now(),
    pending: true,
  };

  let localStorageSaved = false;
  try {
    localStorage.setItem(
      getTournamentDraftStorageKey(userId, tournamentId),
      JSON.stringify(draft)
    );
    localStorageSaved = true;
  } catch (error) {
    console.warn("Não foi possível criar o backup local do torneio", error);
  }

  notifyTournamentDraftChanged(userId, tournamentId);
  return savePendingTournament(userId, tournamentId, draft).then((indexedDbSaved) => {
    const saved = localStorageSaved || indexedDbSaved;
    if (!saved) console.error("Nenhum armazenamento local aceitou o backup do torneio.");
    return saved;
  }).finally(() => {
    notifyTournamentDraftChanged(userId, tournamentId);
  });
}

export function clearTournamentDraft(userId, tournamentId) {
  try {
    localStorage.removeItem(getTournamentDraftStorageKey(userId, tournamentId));
  } catch (error) {
    console.warn("Não foi possível remover o rascunho local já salvo", error);
  }
  void removePendingTournament(userId, tournamentId).finally(() => {
    notifyTournamentDraftChanged(userId, tournamentId);
  });
}
