import React, { useEffect, useRef, useState } from "react";
import {
  PublicArenaDirectoryView,
  PublicPlatformHomeView,
} from "./PublicArenaPresentation.jsx";
import LazyArenaPhoto from "./LazyArenaPhoto.jsx";
import { getArenaPublicUrl } from "../../domain/publicIdentifiers.mjs";
import {
  ARENA_DIRECTORY_FOCUS_MIN_AGE_MS,
  ARENA_DIRECTORY_PAGE_SIZE,
  ARENA_DIRECTORY_REFRESH_INTERVAL_MS,
  readPublicArenaDirectoryCache,
} from "../../domain/publicArenaCache.mjs";

function openOrganizerAccess() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "acesso";
  url.searchParams.set("entrar", "1");
  window.location.assign(url.toString());
}

function openOrganizerPanel() {
  const url = new URL(window.location.origin);
  window.location.assign(url.toString());
}

function PublicArenaDirectorySection({ title = "Encontre uma arena", description = "Acompanhe torneios, circuitos, jogos e rankings sem precisar fazer login.", runtime }) {
  const { fetchPublicArenaDirectory, fetchPublicArenaPhoto } = runtime;
  const [initialDirectoryCache] = useState(() => readPublicArenaDirectoryCache());
  const [arenas, setArenas] = useState(() => initialDirectoryCache || []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(() => !initialDirectoryCache);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => (initialDirectoryCache || []).length >= ARENA_DIRECTORY_PAGE_SIZE);
  const [nextCursor, setNextCursor] = useState(() => {
    const lastArena = initialDirectoryCache?.[initialDirectoryCache.length - 1];
    return lastArena ? {
      id: lastArena.id,
      sortName: lastArena.sort_name
        || String(lastArena.arena_name || lastArena.name || "arena").trim().toLocaleLowerCase("pt-BR"),
    } : null;
  });
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const lastSuccessfulLoadAtRef = useRef(initialDirectoryCache ? Date.now() : 0);
  const directoryRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = directoryRequestIdRef.current + 1;
    directoryRequestIdRef.current = requestId;
    const normalizedSearch = search.trim();
    const waitMs = normalizedSearch ? 320 : 0;
    const timer = window.setTimeout(async () => {
      if (!initialDirectoryCache || normalizedSearch || refreshToken > 0) setLoading(true);
      const result = await fetchPublicArenaDirectory({
        search: normalizedSearch || null,
        limit: ARENA_DIRECTORY_PAGE_SIZE,
      });
      if (!active || requestId !== directoryRequestIdRef.current) return;

      if (result.error) {
        if (arenas.length === 0 || normalizedSearch) setError("Não foi possível carregar as arenas agora.");
      } else {
        setArenas((result.data || []).filter((arena) => arena?.id));
        setNextCursor(result.nextCursor || null);
        setHasMore(result.hasMore === true);
        setError("");
        lastSuccessfulLoadAtRef.current = Date.now();
      }
      setLoading(false);
    }, waitMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, refreshToken]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSuccessfulLoadAtRef.current < ARENA_DIRECTORY_FOCUS_MIN_AGE_MS) return;
      setRefreshToken((current) => current + 1);
    };
    const refreshTimer = window.setInterval(
      () => document.visibilityState === "visible" && setRefreshToken((current) => current + 1),
      ARENA_DIRECTORY_REFRESH_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, []);

  async function loadMoreArenas() {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    const result = await fetchPublicArenaDirectory({
      search: search.trim() || null,
      limit: ARENA_DIRECTORY_PAGE_SIZE,
      cursor: nextCursor,
    });
    if (result.error) {
      setError("Não foi possível carregar mais arenas agora.");
    } else {
      setArenas((current) => Array.from(
        new Map([...current, ...(result.data || [])].map((arena) => [String(arena.id), arena])).values()
      ));
      setNextCursor(result.nextCursor || null);
      setHasMore(result.hasMore === true);
      setError("");
      lastSuccessfulLoadAtRef.current = Date.now();
    }
    setLoadingMore(false);
  }


  return (
    <PublicArenaDirectoryView
      title={title}
      description={description}
      search={search}
      onSearchChange={setSearch}
      loading={loading}
      error={error}
      arenas={arenas}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMoreArenas}
      onOpenArena={(arena) => window.location.assign(getArenaPublicUrl(arena.id))}
      ArenaPhoto={(props) => <LazyArenaPhoto {...props} fetchPublicArenaPhoto={fetchPublicArenaPhoto} />}
    />
  );
}
export default function PublicPlatformHomeController({ session = null, runtime }) {
  return (
    <PublicPlatformHomeView
      hasSession={Boolean(session)}
      onOrganizerAction={session ? openOrganizerPanel : openOrganizerAccess}
      ArenaDirectory={(props) => <PublicArenaDirectorySection {...props} runtime={runtime} />}
      tagline={runtime.tagline}
    />
  );
}
