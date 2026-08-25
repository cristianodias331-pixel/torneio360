import {
  ARENA_DIRECTORY_PAGE_SIZE,
  ARENA_DIRECTORY_CACHE_KEY,
  ARENA_DIRECTORY_RETRY_DELAY_MS,
  PUBLIC_ARENA_EVENT_PAGE_SIZE,
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
  let arenaOverviewRpcAvailable = null;
  let arenaEventPaginationRpcAvailable = null;
  let arenaInitialViewRpcAvailable = null;
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
        let result = await supabase.rpc(
          arenaOverviewRpcAvailable === false ? "get_public_arena_bundle" : "get_public_arena_overview",
          {
            p_organizer_id: arenaId || null,
            p_public_id: publicId || null,
          }
        ).abortSignal(controller.signal);

        const overviewFunctionMissing = result.error && /get_public_arena_overview|function.*does not exist|schema cache/i.test(
          `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
        );
        if (overviewFunctionMissing) {
          arenaOverviewRpcAvailable = false;
          result = await supabase.rpc("get_public_arena_bundle", {
            p_organizer_id: arenaId || null,
            p_public_id: publicId || null,
          }).abortSignal(controller.signal);
        } else if (!result.error) {
          arenaOverviewRpcAvailable = true;
        }

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

  async function fetchPublicArenaEventsPage({
    arenaId = null,
    publicId = null,
    kind = "tournaments",
    status = "active",
    limit = PUBLIC_ARENA_EVENT_PAGE_SIZE,
    offset = 0,
  } = {}) {
    const normalizedKind = kind === "circuits" ? "circuits" : "tournaments";
    const normalizedStatus = status === "finished" ? "finished" : "active";
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || PUBLIC_ARENA_EVENT_PAGE_SIZE, 24));
    const normalizedOffset = Math.max(0, Number(offset) || 0);

    if (arenaEventPaginationRpcAvailable === false) {
      return { data: null, error: new Error("Paginação pública ainda não instalada."), available: false };
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PUBLIC_ARENA_REQUEST_TIMEOUT_MS);
    try {
      const result = await supabase.rpc("list_public_arena_events_page", {
        p_organizer_id: arenaId || null,
        p_public_id: publicId || null,
        p_kind: normalizedKind,
        p_status: normalizedStatus,
        p_limit: normalizedLimit,
        p_offset: normalizedOffset,
      }).abortSignal(controller.signal);
      const pageFunctionMissing = result.error && /list_public_arena_events_page|function.*does not exist|schema cache/i.test(
        `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
      );
      if (pageFunctionMissing) {
        arenaEventPaginationRpcAvailable = false;
        return { data: null, error: result.error, available: false };
      }
      if (result.error) return { data: null, error: result.error, available: true };

      arenaEventPaginationRpcAvailable = true;
      const page = result.data || {};
      return {
        data: {
          items: Array.isArray(page.items) ? page.items.filter((item) => item?.id) : [],
          total: Math.max(0, Number(page.total) || 0),
          hasMore: page.has_more === true,
          nextOffset: Math.max(0, Number(page.next_offset) || 0),
        },
        error: null,
        available: true,
      };
    } catch (error) {
      return { data: null, error, available: true };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchPublicArenaInitialView({ arenaId = null, publicId = null } = {}) {
    if (arenaInitialViewRpcAvailable !== false) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PUBLIC_ARENA_REQUEST_TIMEOUT_MS);
      try {
        const result = await supabase.rpc("get_public_arena_initial_view", {
          p_organizer_id: arenaId || null,
          p_public_id: publicId || null,
          p_limit: PUBLIC_ARENA_EVENT_PAGE_SIZE,
        }).abortSignal(controller.signal);
        const functionMissing = result.error && /get_public_arena_initial_view|function.*does not exist|schema cache/i.test(
          `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
        );

        if (functionMissing) {
          arenaInitialViewRpcAvailable = false;
        } else if (!result.error && result.data?.bundle) {
          arenaInitialViewRpcAvailable = true;
          arenaOverviewRpcAvailable = true;
          arenaEventPaginationRpcAvailable = true;
          const bundleData = result.data.bundle;
          const page = result.data.active_tournaments || {};
          if (bundleData?.profile) writePublicArenaBundleCache({ arenaId, publicId }, bundleData);
          return {
            bundle: { data: bundleData, error: null, fromCache: false },
            activeTournaments: {
              data: {
                items: Array.isArray(page.items) ? page.items.filter((item) => item?.id) : [],
                total: Math.max(0, Number(page.total) || 0),
                hasMore: page.has_more === true,
                nextOffset: Math.max(0, Number(page.next_offset) || 0),
              },
              error: null,
              available: true,
            },
          };
        }
      } catch (error) {
        // A leitura antiga abaixo mantém o perfil disponível durante falhas transitórias.
      } finally {
        window.clearTimeout(timeout);
      }
    }

    const bundle = await fetchPublicArenaBundle({ arenaId, publicId });
    const activeTournaments = bundle.error || !bundle.data?.profile
      ? { data: null, error: bundle.error, available: arenaEventPaginationRpcAvailable !== false }
      : await fetchPublicArenaEventsPage({
        arenaId,
        publicId,
        kind: "tournaments",
        status: "active",
        limit: PUBLIC_ARENA_EVENT_PAGE_SIZE,
        offset: 0,
      });

    return { bundle, activeTournaments };
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
        let result = await supabase
          .rpc("get_public_circuit_with_tournaments", { p_circuit_id: normalizedCircuitId })
          .abortSignal(controller.signal);
        const expandedFunctionMissing = result.error && /get_public_circuit_with_tournaments|function.*does not exist|schema cache/i.test(
          `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
        );
        if (expandedFunctionMissing) {
          result = await supabase
            .rpc("get_public_circuit", { p_circuit_id: normalizedCircuitId })
            .abortSignal(controller.signal);
        }

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

  async function fetchPublicCircuitRankingPage({
    circuitId,
    groupKey = "geral",
    limit = 30,
    offset = 0,
    search = "",
  } = {}) {
    const normalizedCircuitId = String(circuitId || "").trim();
    const normalizedGroupKey = ["masculino", "feminino"].includes(String(groupKey || "").toLowerCase())
      ? String(groupKey).toLowerCase()
      : "geral";
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 30, 250));
    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const normalizedSearch = String(search || "").trim();
    if (!normalizedCircuitId) {
      return { data: null, error: new Error("Identificador público do circuito não informado.") };
    }

    try {
      const result = await supabase.rpc("list_public_circuit_ranking_page", {
        p_circuit_id: normalizedCircuitId,
        p_group_key: normalizedGroupKey,
        p_limit: normalizedLimit,
        p_offset: normalizedOffset,
        p_search: normalizedSearch || null,
      });
      if (!result.error) return { data: result.data, error: null };

      const functionMissing = /list_public_circuit_ranking_page|function.*does not exist|schema cache/i.test(
        `${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`
      );
      if (!functionMissing) return { data: null, error: result.error };

      const detail = await fetchPublicCircuitDetail(normalizedCircuitId);
      if (detail.error || !detail.data) return { data: null, error: detail.error };
      const group = (detail.data.ranking_groups || []).find((item) => (
        String(item?.key || "geral") === normalizedGroupKey
      ));
      const allRows = Array.isArray(group?.rows) ? group.rows : [];
      const filteredRows = normalizedSearch
        ? allRows.filter((row) => String(row?.name || "").toLocaleLowerCase("pt-BR").includes(
          normalizedSearch.toLocaleLowerCase("pt-BR")
        ))
        : allRows;
      const items = filteredRows.slice(normalizedOffset, normalizedOffset + normalizedLimit);
      return {
        data: {
          group_key: normalizedGroupKey,
          title: group?.title || "Ranking geral acumulado",
          items,
          total: filteredRows.length,
          all_total: allRows.length,
          has_more: normalizedOffset + items.length < filteredRows.length,
          next_offset: normalizedOffset + items.length,
          limit: normalizedLimit,
          offset: normalizedOffset,
          search: normalizedSearch,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async function fetchPublicCircuitRankingAll({ circuitId, groupKey = "geral" } = {}) {
    const rows = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    let title = "Ranking geral acumulado";

    while (hasMore && pageCount < 40) {
      const result = await fetchPublicCircuitRankingPage({
        circuitId,
        groupKey,
        limit: 250,
        offset,
        search: "",
      });
      if (result.error || !result.data) return { data: null, error: result.error };
      title = result.data.title || title;
      const pageRows = Array.isArray(result.data.items) ? result.data.items : [];
      rows.push(...pageRows);
      hasMore = result.data.has_more === true;
      offset = Number(result.data.next_offset) || (offset + pageRows.length);
      pageCount += 1;
      if (pageRows.length === 0) hasMore = false;
    }

    return {
      data: {
        key: String(groupKey || "geral"),
        title,
        rows: Array.from(new Map(rows.map((row) => [String(row?.id || row?.name || ""), row])).values()),
      },
      error: hasMore ? new Error("O ranking completo excedeu o limite seguro de páginas.") : null,
    };
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
    fetchPublicArenaEventsPage,
    fetchPublicArenaInitialView,
    fetchPublicArenaPhoto,
    fetchPublicCircuitCover,
    fetchPublicCircuitDetail,
    fetchPublicCircuitRankingAll,
    fetchPublicCircuitRankingPage,
    fetchPublicTournamentCover,
    fetchPublicTournamentDetail,
    refreshPublicTournamentDetail,
  };
}
