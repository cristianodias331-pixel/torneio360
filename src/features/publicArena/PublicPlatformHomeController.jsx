import React, { useEffect, useRef, useState } from "react";
import {
  PublicArenaDirectoryView,
  PublicMemberDirectoryView,
  PublicPlatformHomeView,
  PublicTournamentFeedView,
} from "./PublicArenaPresentation.jsx";
import LazyArenaPhoto from "./LazyArenaPhoto.jsx";
import {
  getMemberPublicUrl,
  getOrganizationPublicUrl,
} from "../../domain/publicIdentifiers.mjs";
import "../../styles/53-public-social-platform.css";
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

function openSignup(accountType) {
  const url = new URL(window.location.origin);
  url.searchParams.set("cadastro", accountType);
  url.hash = "acesso";
  window.location.assign(url.toString());
}

function PublicArenaDirectorySection({ title = "Organizações", description = "Conheça organizadores, clubes e projetos que publicam competições no Torneio360.", runtime }) {
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
        if (arenas.length === 0 || normalizedSearch) setError("Não foi possível carregar as organizações agora.");
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
      setError("Não foi possível carregar mais organizações agora.");
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
      onOpenArena={(arena) => window.location.assign(getOrganizationPublicUrl(arena.id))}
      ArenaPhoto={(props) => <LazyArenaPhoto {...props} fetchPublicArenaPhoto={fetchPublicArenaPhoto} />}
    />
  );
}

function PublicMemberDirectorySection({ runtime }) {
  const { fetchPublicMemberDirectory } = runtime;
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await fetchPublicMemberDirectory({ search, limit: 24 });
      if (!active || requestId !== requestIdRef.current) return;
      setMembers(result.items || []);
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError(result.error ? "Não foi possível carregar os perfis agora." : "");
      setLoading(false);
    }, search.trim() ? 280 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [fetchPublicMemberDirectory, search]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPublicMemberDirectory({ search, limit: 24, cursor: nextCursor });
    if (result.error) setError("Não foi possível carregar mais perfis agora.");
    else {
      setMembers((current) => Array.from(new Map(
        [...current, ...(result.items || [])].map((member) => [String(member.user_id), member])
      ).values()));
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError("");
    }
    setLoadingMore(false);
  }

  return (
    <PublicMemberDirectoryView
      members={members}
      search={search}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      hasMore={hasMore}
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      onOpenMember={(member) => window.location.assign(getMemberPublicUrl(member.handle || member.user_id))}
    />
  );
}

function PublicTournamentFeedSection({ runtime, hasSession = false }) {
  const {
    fetchPublicTournamentFeed,
    formatDate,
    getModalityName,
    getRegistrationDeadline,
    isRegistrationOpen,
    getWhatsAppUrl,
  } = runtime;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPublicTournamentFeed({ limit: 12 }).then((result) => {
      if (!active) return;
      setItems(result.items || []);
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError(result.error ? "Não foi possível carregar as publicações agora." : "");
      setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPublicTournamentFeed]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPublicTournamentFeed({ limit: 12, cursor: nextCursor });
    if (result.error) setError("Não foi possível carregar mais publicações agora.");
    else {
      setItems((current) => Array.from(new Map(
        [...current, ...(result.items || [])].map((item) => [String(item.id), item])
      ).values()));
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError("");
    }
    setLoadingMore(false);
  }

  return (
    <PublicTournamentFeedView
      items={items}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      hasMore={hasMore}
      formatDate={formatDate}
      getModalityName={getModalityName}
      getRegistrationDeadline={getRegistrationDeadline}
      isRegistrationOpen={isRegistrationOpen}
      getWhatsAppUrl={getWhatsAppUrl}
      onLoadMore={loadMore}
      onOpenTournament={(item) => window.location.assign(`${window.location.origin}/?public=${encodeURIComponent(item.public_id)}`)}
      onOpenOrganization={(organization) => window.location.assign(getOrganizationPublicUrl(organization.id))}
      onRegister={(registrationUrl, item) => {
        if (!hasSession) {
          openSignup("atleta");
          return;
        }
        if (registrationUrl) window.open(registrationUrl, "_blank", "noopener,noreferrer");
        else window.location.assign(`${window.location.origin}/?public=${encodeURIComponent(item.public_id)}`);
      }}
    />
  );
}

export default function PublicPlatformHomeController({ session = null, runtime }) {
  return (
    <PublicPlatformHomeView
      hasSession={Boolean(session)}
      onOrganizerAction={session ? openOrganizerPanel : openOrganizerAccess}
      onAthleteSignup={() => openSignup("atleta")}
      onOrganizerSignup={() => openSignup("organizador")}
      TournamentFeed={() => <PublicTournamentFeedSection runtime={runtime} hasSession={Boolean(session)} />}
      MemberDirectory={() => <PublicMemberDirectorySection runtime={runtime} />}
      ArenaDirectory={(props) => <PublicArenaDirectorySection {...props} runtime={runtime} />}
      tagline={runtime.tagline}
    />
  );
}
