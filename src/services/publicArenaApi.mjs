import {
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

  async function fetchPublicArenaDirectory({ search = null, limit = 250 } = {}) {
    const normalizedSearch = String(search || "").trim() || null;
    const canShareRequest = !normalizedSearch && Number(limit) >= 250;
    if (canShareRequest && directoryRequestInFlight) {
      return directoryRequestInFlight;
    }

    const request = (async () => {
      let lastError = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await supabase.rpc("list_public_arenas", {
            p_search: normalizedSearch,
            p_limit: limit,
          });

          if (!result.error) {
            const data = Array.isArray(result.data) ? result.data.filter((arena) => arena?.id) : [];
            if (canShareRequest) writePublicArenaCache(ARENA_DIRECTORY_CACHE_KEY, data);
            return { data, error: null };
          }

          lastError = result.error;
        } catch (error) {
          lastError = error;
        }

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
        }
      }

      return { data: [], error: lastError };
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

  return {
    fetchPublicArenaBundle,
    fetchPublicArenaDirectory,
    fetchPublicArenaPhoto,
    fetchPublicCircuitDetail,
    fetchPublicTournamentDetail,
  };
}
