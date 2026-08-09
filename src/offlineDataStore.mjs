const DATABASE_NAME = "torneio360-offline-data";
const DATABASE_VERSION = 1;
const DASHBOARD_STORE = "dashboard_cache";
const PENDING_TOURNAMENT_STORE = "pending_tournaments";

let databasePromise = null;

function isPlainRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valuesEqual(first, second) {
  if (Object.is(first, second)) return true;
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return false;
  }
}

function getGameIdentity(value) {
  if (!isPlainRecord(value)) return null;
  const identity = {};
  const matchKey = typeof value.matchKey === "string" ? value.matchKey.trim() : "";
  const hasIdArrays = Array.isArray(value.ids1) || Array.isArray(value.ids2);
  const firstSideIds = Array.isArray(value.ids1) ? value.ids1.map(String).sort() : [];
  const secondSideIds = Array.isArray(value.ids2) ? value.ids2.map(String).sort() : [];
  const hasParticipantIds = firstSideIds.length > 0 || secondSideIds.length > 0;

  if (matchKey) identity.matchKey = matchKey;
  if (hasIdArrays) {
    identity.ids1 = firstSideIds;
    identity.ids2 = secondSideIds;
  }

  if (!hasParticipantIds) {
    const firstSideNames = Array.isArray(value.team1) ? value.team1.map(String).sort() : [];
    const secondSideNames = Array.isArray(value.team2) ? value.team2.map(String).sort() : [];
    if (firstSideNames.length > 0 || secondSideNames.length > 0) {
      identity.team1 = firstSideNames;
      identity.team2 = secondSideNames;
    }
    if (value.entry1 !== undefined || value.entry2 !== undefined) {
      identity.entry1 = value.entry1 ?? null;
      identity.entry2 = value.entry2 ?? null;
    }
  }

  if (value.source1 !== undefined || value.source2 !== undefined) {
    identity.source1 = value.source1 ?? null;
    identity.source2 = value.source2 ?? null;
  }
  if (value.source1Mode !== undefined || value.source2Mode !== undefined) {
    identity.source1Mode = value.source1Mode ?? null;
    identity.source2Mode = value.source2Mode ?? null;
  }
  if (value.isBye !== undefined) identity.isBye = Boolean(value.isBye);

  return Object.keys(identity).length > 0 ? JSON.stringify(identity) : null;
}

function getGameArrayStructure(values) {
  if (values.every(Array.isArray)) {
    const rounds = values.map((round) => (
      round.every((game) => getGameIdentity(game))
        ? round.map(getGameIdentity)
        : null
    ));
    return rounds.every((round) => round !== null) ? rounds : null;
  }
  if (values.every((value) => getGameIdentity(value))) return values.map(getGameIdentity);
  return null;
}

function mergeConcurrentValue(baseValue, localValue, remoteValue, path, conflicts) {
  if (valuesEqual(localValue, remoteValue)) return localValue;
  if (valuesEqual(localValue, baseValue)) return remoteValue;
  if (valuesEqual(remoteValue, baseValue)) return localValue;

  if (Array.isArray(baseValue) && Array.isArray(localValue) && Array.isArray(remoteValue)) {
    if (baseValue.length !== localValue.length || baseValue.length !== remoteValue.length) {
      conflicts.push(path || "dados");
      return localValue;
    }

    const baseStructure = getGameArrayStructure(baseValue);
    const localStructure = getGameArrayStructure(localValue);
    const remoteStructure = getGameArrayStructure(remoteValue);
    if (baseStructure && localStructure && remoteStructure) {
      if (!valuesEqual(baseStructure, localStructure) || !valuesEqual(baseStructure, remoteStructure)) {
        conflicts.push(path || "jogos");
        return localValue;
      }
    }

    return baseValue.map((baseItem, index) => mergeConcurrentValue(
      baseItem,
      localValue[index],
      remoteValue[index],
      `${path}[${index}]`,
      conflicts
    ));
  }

  if (isPlainRecord(baseValue) && isPlainRecord(localValue) && isPlainRecord(remoteValue)) {
    const merged = {};
    const keys = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(localValue),
      ...Object.keys(remoteValue),
    ]);

    keys.forEach((key) => {
      merged[key] = mergeConcurrentValue(
        baseValue[key],
        localValue[key],
        remoteValue[key],
        path ? `${path}.${key}` : key,
        conflicts
      );
    });
    return merged;
  }

  conflicts.push(path || "dados");
  return localValue;
}

export function mergeConcurrentTournamentData(baseData, localData, remoteData) {
  const conflicts = [];
  const data = mergeConcurrentValue(
    baseData && typeof baseData === "object" ? baseData : {},
    localData && typeof localData === "object" ? localData : {},
    remoteData && typeof remoteData === "object" ? remoteData : {},
    "",
    conflicts
  );

  return { data, conflicts: [...new Set(conflicts)] };
}

function listValidScheduleGames(data, field = "schedule") {
  if (!Array.isArray(data?.[field])) return [];
  if (field === "schedule" && data[field].every(isPlainRecord)) return data[field];
  const rounds = field === "schedule" ? data[field].filter(Array.isArray) : [data[field]];
  return rounds.flat().filter(isPlainRecord);
}

function getCriticalGameStructure(game) {
  return {
    matchKey: game?.matchKey ?? null,
    ids1: Array.isArray(game?.ids1) ? game.ids1 : [],
    ids2: Array.isArray(game?.ids2) ? game.ids2 : [],
    team1: Array.isArray(game?.team1) ? game.team1 : [],
    team2: Array.isArray(game?.team2) ? game.team2 : [],
    source1: game?.source1 ?? null,
    source2: game?.source2 ?? null,
    source1Mode: game?.source1Mode ?? null,
    source2Mode: game?.source2Mode ?? null,
    entry1: game?.entry1 ?? null,
    entry2: game?.entry2 ?? null,
    isBye: game?.isBye ?? false,
  };
}

function listParticipantNames(data) {
  const players = data?.players;
  if (Array.isArray(players)) return players.filter((item) => typeof item === "string");
  if (!isPlainRecord(players)) return [];

  return Object.values(players).flatMap((group) => {
    if (!Array.isArray(group)) return [];
    return group.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!isPlainRecord(item)) return [];
      return [item.a, item.b].filter((name) => typeof name === "string");
    });
  });
}

export function preservesTournamentCriticalData(beforeData, afterData) {
  if (!isPlainRecord(beforeData) || !isPlainRecord(afterData)) return false;

  const beforeSchedule = listValidScheduleGames(beforeData, "schedule");
  const afterSchedule = listValidScheduleGames(afterData, "schedule");
  const beforeBrackets = listValidScheduleGames(beforeData, "brackets");
  const afterBrackets = listValidScheduleGames(afterData, "brackets");
  if (beforeSchedule.length !== afterSchedule.length || beforeBrackets.length !== afterBrackets.length) {
    return false;
  }

  const scoresArePreserved = (beforeGames, afterGames) => beforeGames.every((game, index) => (
    valuesEqual(game.s1 ?? "", afterGames[index]?.s1 ?? "")
    && valuesEqual(game.s2 ?? "", afterGames[index]?.s2 ?? "")
    && valuesEqual(getCriticalGameStructure(game), getCriticalGameStructure(afterGames[index]))
  ));
  if (!scoresArePreserved(beforeSchedule, afterSchedule) || !scoresArePreserved(beforeBrackets, afterBrackets)) {
    return false;
  }

  const beforeNames = listParticipantNames(beforeData);
  const afterNames = listParticipantNames(afterData);
  return beforeNames.every((name, index) => name === afterNames[index]);
}

function getIndexedDb() {
  return typeof globalThis !== "undefined" ? globalThis.indexedDB : null;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento offline."));
  });
}

function transactionFinished(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Falha na transação offline."));
    transaction.onabort = () => reject(transaction.error || new Error("A transação offline foi cancelada."));
  });
}

function openDatabase() {
  const indexedDb = getIndexedDb();
  if (!indexedDb) return Promise.reject(new Error("IndexedDB indisponível."));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DASHBOARD_STORE)) {
        database.createObjectStore(DASHBOARD_STORE, { keyPath: "userId" });
      }

      if (!database.objectStoreNames.contains(PENDING_TOURNAMENT_STORE)) {
        const pendingStore = database.createObjectStore(PENDING_TOURNAMENT_STORE, { keyPath: "key" });
        pendingStore.createIndex("userId", "userId", { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Não foi possível abrir o armazenamento offline."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("O armazenamento offline está bloqueado por outra aba."));
    };
  });

  return databasePromise;
}

async function putRecord(storeName, record) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await transactionFinished(transaction);
}

async function deleteRecord(storeName, key) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionFinished(transaction);
}

export async function requestDurableOfflineStorage() {
  try {
    if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") return false;
    if (typeof navigator.storage.persisted === "function" && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function saveDashboardCache(userId, payload) {
  if (!userId || !payload) return false;

  try {
    await putRecord(DASHBOARD_STORE, {
      userId,
      tournaments: Array.isArray(payload.tournaments) ? payload.tournaments : [],
      trashTournaments: Array.isArray(payload.trashTournaments) ? payload.trashTournaments : [],
      circuits: Array.isArray(payload.circuits) ? payload.circuits : [],
      savedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.warn("Não foi possível atualizar a cópia offline do painel.", error);
    return false;
  }
}

export async function readDashboardCache(userId) {
  if (!userId) return null;

  try {
    const database = await openDatabase();
    const transaction = database.transaction(DASHBOARD_STORE, "readonly");
    const result = await requestResult(transaction.objectStore(DASHBOARD_STORE).get(userId));
    await transactionFinished(transaction);
    return result || null;
  } catch (error) {
    console.warn("Não foi possível ler a cópia offline do painel.", error);
    return null;
  }
}

export async function savePendingTournament(userId, tournamentId, draft) {
  if (!userId || !tournamentId || !draft?.data) return false;

  try {
    await putRecord(PENDING_TOURNAMENT_STORE, {
      key: `${userId}:${tournamentId}`,
      userId,
      tournamentId,
      ...draft,
      pending: true,
    });
    return true;
  } catch (error) {
    console.warn("Não foi possível reforçar o backup offline do torneio.", error);
    return false;
  }
}

export async function removePendingTournament(userId, tournamentId) {
  if (!userId || !tournamentId) return false;

  try {
    await deleteRecord(PENDING_TOURNAMENT_STORE, `${userId}:${tournamentId}`);
    return true;
  } catch (error) {
    console.warn("Não foi possível remover o backup offline já sincronizado.", error);
    return false;
  }
}

export async function listPendingTournaments(userId) {
  if (!userId) return [];

  try {
    const database = await openDatabase();
    const transaction = database.transaction(PENDING_TOURNAMENT_STORE, "readonly");
    const store = transaction.objectStore(PENDING_TOURNAMENT_STORE);
    const index = store.index("userId");
    const results = await requestResult(index.getAll(userId));
    await transactionFinished(transaction);
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.warn("Não foi possível consultar as alterações offline pendentes.", error);
    return [];
  }
}
