import {
  ARENA_DIRECTORY_PAGE_SIZE,
  ARENA_DIRECTORY_CACHE_KEY,
  ARENA_DIRECTORY_RETRY_DELAY_MS,
  PUBLIC_ARENA_REQUEST_TIMEOUT_MS,
  readPublicArenaBundleCache,
  readPublicArenaPhotoCache,
  readPublicCircuitDetailCache,
  readPublicTournamentDetailCache,
  writePublicArenaBundleCache,
  writePublicArenaCache,
  writePublicArenaPhotoCache,
  writePublicCircuitDetailCache,
  writePublicTournamentDetailCache,
} from "../domain/publicArenaCache.mjs";

export function createPublicArenaApi({ supabase }) {
  let directoryRequestInFlight = null;
  let pagedDirectoryRpcAvailable = null;
  const legacyDirectorySnapshots = new Map();
  const publicCoverCache = new Map();
  const publicCoverRequests = new Map();

  async function fetchPublicCover({ kind, id, rpcName, parameter, fallback }) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return "";
    const cacheKey = `${kind}:${normalizedId}`;
    if (publicCoverCache.has(cacheKey)) return publicCoverCache.get(cacheKey);
    if (publicCoverRequests.has(cacheKey)) return publicCoverRequests.get(cacheKey);

    const request = (async () => {
      let coverImageUrl = "";
      try {
        const result = await supabase.rpc(rpcName, { [parameter]: normalizedId });
        if (!result.error) coverImageUrl = String(result.data || "");
      } catch (error) {
        coverImageUrl = "";
      }

      if (!coverImageUrl) {
        const fallbackResult = await fallback(normalizedId);
        coverImageUrl = String(fallbackResult || "");
      }

      publicCoverCache.set(cacheKey, coverImageUrl);
      return coverImageUrl;
    })();

    publicCoverRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      publicCoverRequests.delete(cacheKey);
    }
  }

  async function fetchPublicArenaDirectory({ search = null, limit = ARENA_DIRECTORY_PAGE_SIZE, cursor = null } = {}) {
    const normalizedSearch = String(search || "").trim() || null;
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || ARENA_DIRECTORY_PAGE_SIZE, 60));
    const normalizedCursor = cursor?.id && cursor?.sortName
      ? { id: String(cursor.id), sortName: String(cursor.sortName) }
      : null;
    const canShareRequest = !normalizedSearch && !normalizedCursor;
    if (canShareRequest && directoryRequestInFlight) {
      return directoryRequestInFlight;
    }

    const request = (async () => {
      let lastError = null;
      const legacySnapshotKey = normalizedSearch || "__all__";

      const getLegacyPage = (snapshot) => {
        const rows = Array.isArray(snapshot) ? snapshot.filter((arena) => arena?.id) : [];
        let startIndex = 0;
        if (normalizedCursor) {
          const cursorIndex = rows.findIndex((arena) => String(arena.id) === normalizedCursor.id);
          startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
        }
        const data = rows.slice(startIndex, startIndex + normalizedLimit);
        const lastArena = data[data.length - 1];
        return {
          data,
          error: null,
          hasMore: startIndex + data.length < rows.length,
          nextCursor: lastArena ? {
            id: lastArena.id,
            sortName: lastArena.sort_name
              || String(lastArena.arena_name || lastArena.name || "arena").trim().toLocaleLowerCase("pt-BR"),
          } : null,
        };
      };

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (pagedDirectoryRpcAvailable === false && legacyDirectorySnapshots.has(legacySnapshotKey)) {
            return getLegacyPage(legacyDirectorySnapshots.get(legacySnapshotKey));
          }

          let result = pagedDirectoryRpcAvailable === false
            ? { data: null, error: new Error("Paginação do diretório ainda não instalada.") }
            : await supabase.rpc("list_public_arenas_page", {
              p_search: normalizedSearch,
              p_limit: normalizedLimit,
              p_after_sort_name: normalizedCursor?.sortName || null,
              p_after_id: normalizedCursor?.id || null,
            });

          const pageFunctionMissing = result.error && /list_public_arenas_page|function.*does not exist|schema cache/i.test(
            `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
          );
          if (pageFunctionMissing || pagedDirectoryRpcAvailable === false) {
            pagedDirectoryRpcAvailable = false;
            result = await supabase.rpc("list_public_arenas", {
              p_search: normalizedSearch,
              p_limit: 250,
            });
            if (!result.error) {
              const snapshot = Array.isArray(result.data) ? result.data.filter((arena) => arena?.id) : [];
              legacyDirectorySnapshots.set(legacySnapshotKey, snapshot);
              const legacyPage = getLegacyPage(snapshot);
              if (canShareRequest) writePublicArenaCache(ARENA_DIRECTORY_CACHE_KEY, legacyPage.data);
              return legacyPage;
            }
          }

          if (!result.error) {
            pagedDirectoryRpcAvailable = true;
            const data = Array.isArray(result.data) ? result.data.filter((arena) => arena?.id) : [];
            if (canShareRequest) writePublicArenaCache(ARENA_DIRECTORY_CACHE_KEY, data);
            const lastArena = data[data.length - 1];
            return {
              data,
              error: null,
              hasMore: data.length === normalizedLimit,
              nextCursor: lastArena ? {
                id: lastArena.id,
                sortName: lastArena.sort_name
                  || String(lastArena.arena_name || lastArena.name || "arena").trim().toLocaleLowerCase("pt-BR"),
              } : null,
            };
          }

          lastError = result.error;
        } catch (error) {
          lastError = error;
        }

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
        }
      }

      return { data: [], error: lastError, hasMore: false, nextCursor: null };
    })();

    if (canShareRequest) directoryRequestInFlight = request;

    try {
      return await request;
    } finally {
      if (canShareRequest && directoryRequestInFlight === request) {
        directoryRequestInFlight = null;
      }
    }
  }

  async function fetchPublicArenaBundle({ arenaId = null, publicId = null } = {}) {
    let lastError = null;
    let lastData = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PUBLIC_ARENA_REQUEST_TIMEOUT_MS);

      try {
        const result = await supabase.rpc("get_public_arena_bundle", {
          p_organizer_id: arenaId || null,
          p_public_id: publicId || null,
        }).abortSignal(controller.signal);

        lastData = result.data;
        if (!result.error && result.data?.profile) {
          writePublicArenaBundleCache({ arenaId, publicId }, result.data);
          return { data: result.data, error: null, fromCache: false };
        }

        lastError = result.error || new Error("Perfil público da arena não encontrado.");
      } catch (error) {
        lastError = error;
      } finally {
        window.clearTimeout(timeout);
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
      }
    }

    const cached = readPublicArenaBundleCache({ arenaId, publicId });
    if (cached?.profile) return { data: cached, error: null, fromCache: true };

    return { data: lastData, error: lastError, fromCache: false };
  }

  async function fetchPublicTournamentDetail(publicId) {
    const normalizedPublicId = String(publicId || "").trim();
    if (!normalizedPublicId) {
      return { data: null, error: new Error("Identificador público do torneio não informado.") };
    }

    const cached = readPublicTournamentDetailCache(normalizedPublicId);
    if (cached) {
      return { data: cached, error: null, fromCache: true };
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PUBLIC_ARENA_REQUEST_TIMEOUT_MS);

      try {
        const result = await supabase
          .rpc("get_public_tournament", { p_public_id: normalizedPublicId })
          .maybeSingle()
          .abortSignal(controller.signal);

        if (!result.error && result.data) {
          writePublicTournamentDetailCache(normalizedPublicId, result.data);
          return { data: result.data, error: null, fromCache: false };
        }

        lastError = result.error || new Error("Torneio público não encontrado.");
      } catch (error) {
        lastError = error;
      } finally {
        window.clearTimeout(timeout);
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
      }
    }

    return { data: null, error: lastError, fromCache: false };
  }

  async function refreshPublicTournamentDetail(publicId, knownUpdatedAt = null) {
    const normalizedPublicId = String(publicId || "").trim();
    if (!normalizedPublicId) {
      return { data: null, error: new Error("Identificador público do torneio não informado."), changed: false };
    }

    try {
      let result = await supabase
        .rpc("get_public_tournament_if_changed", {
          p_public_id: normalizedPublicId,
          p_known_updated_at: knownUpdatedAt || null,
        })
        .maybeSingle();

      const conditionalFunctionMissing = result.error && /get_public_tournament_if_changed|function.*does not exist|schema cache/i.test(
        `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
      );
      if (conditionalFunctionMissing) {
        result = await supabase
          .rpc("get_public_tournament", { p_public_id: normalizedPublicId })
          .maybeSingle();
      }

      if (result.error) return { data: null, error: result.error, changed: false };
      if (!result.data) return { data: null, error: null, changed: false };

      const changed = !knownUpdatedAt || result.data.updated_at !== knownUpdatedAt;
      if (changed) writePublicTournamentDetailCache(normalizedPublicId, result.data);
      return { data: changed ? result.data : null, error: null, changed };
    } catch (error) {
      return { data: null, error, changed: false };
    }
  }

  async function fetchPublicCircuitDetail(circuitId) {
    const normalizedCircuitId = String(circuitId || "").trim();
    if (!normalizedCircuitId) {
      return { data: null, error: new Error("Identificador público do circuito não informado.") };
    }

    const cached = readPublicCircuitDetailCache(normalizedCircuitId);
    if (cached) {
      return { data: cached, error: null, fromCache: true };
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PUBLIC_ARENA_REQUEST_TIMEOUT_MS);

      try {
        const result = await supabase
          .rpc("get_public_circuit", { p_circuit_id: normalizedCircuitId })
          .abortSignal(controller.signal);

        if (!result.error && result.data?.id) {
          writePublicCircuitDetailCache(normalizedCircuitId, result.data);
          return { data: result.data, error: null, fromCache: false };
        }

        lastError = result.error || new Error("Circuito público não encontrado.");
      } catch (error) {
        lastError = error;
      } finally {
        window.clearTimeout(timeout);
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
      }
    }

    return { data: null, error: lastError, fromCache: false };
  }

  async function fetchPublicArenaPhoto(arenaId) {
    const normalizedArenaId = String(arenaId || "").trim();
    if (!normalizedArenaId) return "";
    const cachedPhoto = readPublicArenaPhotoCache(normalizedArenaId);
    if (cachedPhoto.found) return cachedPhoto.data;

    try {
      const result = await supabase.rpc("get_public_arena_photo", {
        p_organizer_id: normalizedArenaId,
      });
      const photoUrl = result.error ? "" : String(result.data || "");
      writePublicArenaPhotoCache(normalizedArenaId, photoUrl);
      return photoUrl;
    } catch (error) {
      return "";
    }
  }

  function fetchPublicTournamentCover(publicId) {
    return fetchPublicCover({
      kind: "tournament",
      id: publicId,
      rpcName: "get_public_tournament_cover",
      parameter: "p_public_id",
      fallback: async (normalizedPublicId) => {
        const detail = await fetchPublicTournamentDetail(normalizedPublicId);
        const tournamentData = detail.data?.data || {};
        return tournamentData.multiCategoryEvent === true
          ? tournamentData.eventCoverImageUrl || ""
          : tournamentData.coverImageUrl || "";
      },
    });
  }

  function fetchPublicCircuitCover(circuitId) {
    return fetchPublicCover({
      kind: "circuit",
      id: circuitId,
      rpcName: "get_public_circuit_cover",
      parameter: "p_circuit_id",
      fallback: async (normalizedCircuitId) => {
        const detail = await fetchPublicCircuitDetail(normalizedCircuitId);
        return detail.data?.ranking_settings?.coverImageUrl || detail.data?.rankingSettings?.coverImageUrl || "";
      },
    });
  }

  return {
    fetchPublicArenaBundle,
    fetchPublicArenaDirectory,
    fetchPublicArenaPhoto,
    fetchPublicCircuitCover,
    fetchPublicCircuitDetail,
    fetchPublicTournamentCover,
    fetchPublicTournamentDetail,
    refreshPublicTournamentDetail,
  };
}
