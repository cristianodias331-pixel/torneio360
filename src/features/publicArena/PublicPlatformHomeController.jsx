import React, { useEffect, useState } from "react";
import { Building2, CalendarDays, MapPin, Search, Trophy, UserRound, Users, X } from "lucide-react";
import {
  PublicArenaDirectoryView,
  PublicMemberDirectoryView,
  PublicPlatformHomeView,
  PublicTournamentFeedView,
} from "./PublicArenaPresentation.jsx";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import "../../styles/63-global-search-and-live-handle.css";

function openLogin() {
  navigatePlatform({ entrar: "1" });
}

function openAccount() {
  navigatePlatform();
}

function openSignup() {
  navigatePlatform({ cadastro: "conta" });
}

function normalizeGlobalSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function getTournamentSearchText(item) {
  return normalizeGlobalSearch([
    item?.name,
    item?.title,
    item?.modality_name,
    item?.modality,
    item?.category,
    item?.location,
    item?.address,
    item?.organization?.arena_name,
    item?.organization?.name,
    item?.organizer?.arena_name,
    item?.organizer_name,
  ].filter(Boolean).join(" "));
}

export function PlatformGlobalSearch({ runtime, onOpenTournament = null }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading: false, error: "", athletes: [], organizations: [], tournaments: [] });
  const normalizedQuery = normalizeGlobalSearch(query);
  const hasQuery = normalizedQuery.length >= 2;

  useEffect(() => {
    if (!hasQuery) {
      setState({ loading: false, error: "", athletes: [], organizations: [], tournaments: [] });
      return undefined;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    const timer = window.setTimeout(async () => {
      try {
        const [athleteResult, organizationResult, tournamentResult] = await Promise.all([
          runtime.fetchPublicMemberDirectory?.({ search: query, limit: 6 }) || Promise.resolve({ items: [] }),
          runtime.fetchPublicArenaDirectory?.({ search: query, limit: 6 }) || Promise.resolve({ data: [] }),
          runtime.fetchPublicTournamentFeed?.({ limit: 30 }) || Promise.resolve({ items: [] }),
        ]);
        if (!active) return;
        const tournaments = (tournamentResult.items || []).filter((item) => getTournamentSearchText(item).includes(normalizedQuery)).slice(0, 6);
        setState({
          loading: false,
          error: athleteResult.error || organizationResult.error || tournamentResult.error ? "Alguns resultados não puderam ser carregados." : "",
          athletes: athleteResult.items || [],
          organizations: organizationResult.data || [],
          tournaments,
        });
      } catch (error) {
        console.warn("Busca geral indisponível:", error);
        if (active) setState({ loading: false, error: "Não foi possível pesquisar agora.", athletes: [], organizations: [], tournaments: [] });
      }
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [hasQuery, normalizedQuery, query, runtime]);

  const total = state.athletes.length + state.organizations.length + state.tournaments.length;
  const openTournament = (item) => {
    if (onOpenTournament) onOpenTournament(item);
    else navigatePlatform({ public: item.public_id });
  };

  return (
    <section className={`platformGlobalSearch${hasQuery ? " hasQuery" : ""}`} aria-label="Pesquisa geral da plataforma">
      <div className="platformGlobalSearchField">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar atletas, organizações, locais e eventos"
          aria-label="Pesquisar em toda a plataforma"
          autoComplete="off"
        />
        {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar pesquisa"><X aria-hidden="true" /></button> : null}
      </div>
      {hasQuery ? (
        <div className="platformGlobalSearchResults" role="region" aria-live="polite" aria-label="Resultados da pesquisa">
          {state.loading ? <div className="platformGlobalSearchState">Pesquisando em toda a plataforma...</div> : null}
          {!state.loading && state.tournaments.length ? <div className="platformGlobalSearchGroup"><h3><Trophy aria-hidden="true" /> Eventos</h3>{state.tournaments.map((item) => <button type="button" key={`event-${item.id}`} onClick={() => openTournament(item)}><span className="platformGlobalSearchThumb"><Trophy aria-hidden="true" /></span><span><strong>{item.name || item.title}</strong><small><CalendarDays aria-hidden="true" /> {item.location || item.address || item.modality_name || "Torneio publicado"}</small></span></button>)}</div> : null}
          {!state.loading && state.organizations.length ? <div className="platformGlobalSearchGroup"><h3><Building2 aria-hidden="true" /> Organizações e locais</h3>{state.organizations.map((item) => <button type="button" key={`organization-${item.id}`} onClick={() => navigatePlatform({ organizacao: item.id })}><span className="platformGlobalSearchThumb">{item.photo_url ? <img src={item.photo_url} alt="" /> : <Building2 aria-hidden="true" />}</span><span><strong>{item.arena_name || item.name || "Organização"}</strong><small><MapPin aria-hidden="true" /> {[item.city, item.state].filter(Boolean).join("/") || item.organizer_name || "Perfil da organização"}</small></span></button>)}</div> : null}
          {!state.loading && state.athletes.length ? <div className="platformGlobalSearchGroup"><h3><Users aria-hidden="true" /> Atletas</h3>{state.athletes.map((item) => <button type="button" key={`athlete-${item.user_id}`} onClick={() => navigatePlatform({ perfil: item.handle || item.user_id })}><span className="platformGlobalSearchThumb">{item.photo_url ? <img src={item.photo_url} alt="" /> : <UserRound aria-hidden="true" />}</span><span><strong>{item.display_name || "Atleta"}</strong><small>@{item.handle || "perfil"} · {[item.city, item.state].filter(Boolean).join("/") || "Torneio360"}</small></span></button>)}</div> : null}
          {!state.loading && !total ? <div className="platformGlobalSearchState">Nenhum resultado encontrado para “{query.trim()}”.</div> : null}
          {state.error ? <div className="platformGlobalSearchWarning">{state.error}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

export function PublicTournamentFeedSection({
  runtime,
  hasSession = false,
  embedded = false,
  variant = "feed",
  onOpenTournament = null,
  onOpenOrganization = null,
  onRegister = null,
}) {
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
      embedded={embedded}
      variant={variant}
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
      onOpenTournament={(item) => {
        if (onOpenTournament) onOpenTournament(item);
        else navigatePlatform({ public: item.public_id });
      }}
      onOpenOrganization={(organization) => {
        if (!organization?.id) return;
        if (onOpenOrganization) onOpenOrganization(organization);
        else navigatePlatform({ organizacao: organization.id });
      }}
      onRegister={(registrationUrl, item) => {
        if (onRegister) {
          onRegister(registrationUrl, item);
          return;
        }
        navigatePlatform({ public: item.public_id, inscricao: "1" });
      }}
    />
  );
}

export function PublicExploreSection({
  runtime,
  hasSession = false,
  onOpenTournament = null,
}) {
  const [activeKind, setActiveKind] = useState("tournaments");
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizations, setOrganizations] = useState([]);
  const [organizationState, setOrganizationState] = useState({ loading: false, loadingMore: false, error: "", hasMore: false, nextCursor: null });
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletes, setAthletes] = useState([]);
  const [athleteState, setAthleteState] = useState({ loading: false, loadingMore: false, error: "", hasMore: false, nextCursor: null });

  useEffect(() => {
    if (activeKind !== "organizations" || !runtime.fetchPublicArenaDirectory) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setOrganizationState((current) => ({ ...current, loading: true, error: "" }));
      const result = await runtime.fetchPublicArenaDirectory({ search: organizationSearch, limit: 18 });
      if (!active) return;
      setOrganizations(result.data || []);
      setOrganizationState({
        loading: false,
        loadingMore: false,
        error: result.error ? "Não foi possível carregar as organizações agora." : "",
        hasMore: result.hasMore === true,
        nextCursor: result.nextCursor || null,
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeKind, organizationSearch, runtime]);

  useEffect(() => {
    if (activeKind !== "athletes" || !runtime.fetchPublicMemberDirectory) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setAthleteState((current) => ({ ...current, loading: true, error: "" }));
      const result = await runtime.fetchPublicMemberDirectory({ search: athleteSearch, limit: 24 });
      if (!active) return;
      setAthletes(result.items || []);
      setAthleteState({
        loading: false,
        loadingMore: false,
        error: result.error ? "Não foi possível carregar os atletas agora." : "",
        hasMore: result.hasMore === true,
        nextCursor: result.nextCursor || null,
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeKind, athleteSearch, runtime]);

  async function loadMoreOrganizations() {
    if (!organizationState.hasMore || !organizationState.nextCursor || organizationState.loadingMore) return;
    setOrganizationState((current) => ({ ...current, loadingMore: true }));
    const result = await runtime.fetchPublicArenaDirectory({ search: organizationSearch, limit: 18, cursor: organizationState.nextCursor });
    setOrganizations((current) => Array.from(new Map(
      [...current, ...(result.data || [])].map((item) => [String(item.id), item])
    ).values()));
    setOrganizationState((current) => ({
      ...current,
      loadingMore: false,
      error: result.error ? "Não foi possível carregar mais organizações agora." : "",
      hasMore: result.hasMore === true,
      nextCursor: result.nextCursor || null,
    }));
  }

  async function loadMoreAthletes() {
    if (!athleteState.hasMore || !athleteState.nextCursor || athleteState.loadingMore) return;
    setAthleteState((current) => ({ ...current, loadingMore: true }));
    const result = await runtime.fetchPublicMemberDirectory({ search: athleteSearch, limit: 24, cursor: athleteState.nextCursor });
    setAthletes((current) => Array.from(new Map(
      [...current, ...(result.items || [])].map((item) => [String(item.user_id), item])
    ).values()));
    setAthleteState((current) => ({
      ...current,
      loadingMore: false,
      error: result.error ? "Não foi possível carregar mais atletas agora." : "",
      hasMore: result.hasMore === true,
      nextCursor: result.nextCursor || null,
    }));
  }

  return (
    <section className="platformExploreHub" aria-labelledby="platform-explore-title">
      <header className="platformExploreHeader">
        <span>Descobrir</span>
        <h2 id="platform-explore-title">Explore a comunidade</h2>
        <p>Encontre torneios, organizações e atletas sem sair do mesmo ambiente.</p>
      </header>
      <nav className="platformExploreTabs" aria-label="Tipos de conteúdo" role="tablist">
        <button type="button" role="tab" aria-selected={activeKind === "tournaments"} className={activeKind === "tournaments" ? "active" : ""} onClick={() => setActiveKind("tournaments")}><Trophy aria-hidden="true" /> Torneios</button>
        <button type="button" role="tab" aria-selected={activeKind === "organizations"} className={activeKind === "organizations" ? "active" : ""} onClick={() => setActiveKind("organizations")}><Building2 aria-hidden="true" /> Organizações</button>
        <button type="button" role="tab" aria-selected={activeKind === "athletes"} className={activeKind === "athletes" ? "active" : ""} onClick={() => setActiveKind("athletes")}><Users aria-hidden="true" /> Atletas</button>
      </nav>

      {activeKind === "tournaments" ? (
        <PublicTournamentFeedSection runtime={runtime} hasSession={hasSession} embedded variant="discovery" onOpenTournament={onOpenTournament} />
      ) : null}
      {activeKind === "organizations" ? (
        <PublicArenaDirectoryView
          title="Organizações"
          description="Encontre perfis de organizações, seus torneios e circuitos publicados."
          search={organizationSearch}
          onSearchChange={setOrganizationSearch}
          loading={organizationState.loading}
          loadingMore={organizationState.loadingMore}
          error={organizationState.error}
          arenas={organizations}
          hasMore={organizationState.hasMore}
          onLoadMore={loadMoreOrganizations}
          onOpenArena={(arena) => navigatePlatform({ organizacao: arena.id })}
          ArenaPhoto={runtime.ArenaPhoto}
        />
      ) : null}
      {activeKind === "athletes" ? (
        <PublicMemberDirectoryView
          members={athletes}
          search={athleteSearch}
          loading={athleteState.loading}
          loadingMore={athleteState.loadingMore}
          error={athleteState.error}
          hasMore={athleteState.hasMore}
          onSearchChange={setAthleteSearch}
          onLoadMore={loadMoreAthletes}
          onOpenMember={(member) => navigatePlatform({ perfil: member.handle || member.user_id })}
        />
      ) : null}
    </section>
  );
}

export default function PublicPlatformHomeController({
  session = null,
  runtime,
  embedded = false,
  onOpenTournament = null,
  onOpenOrganization = null,
  onRegister = null,
}) {
  const [activePanel, setActivePanel] = useState(() => (
    new URLSearchParams(window.location.search).has("explorar") ? "explore" : "overview"
  ));

  if (embedded) {
    return (
      <>
        <PlatformGlobalSearch runtime={runtime} onOpenTournament={onOpenTournament} />
        <PublicTournamentFeedSection
          runtime={runtime}
          hasSession={Boolean(session)}
          embedded
          onOpenTournament={onOpenTournament}
          onOpenOrganization={onOpenOrganization}
          onRegister={onRegister}
        />
      </>
    );
  }

  return (
    <PublicPlatformHomeView
      activePanel={activePanel}
      hasSession={Boolean(session)}
      onAccountAction={session ? openAccount : openLogin}
      onAthleteSignup={openSignup}
      onNavigate={(panel) => {
        if (panel === "overview" || panel === "explore") {
          setActivePanel(panel);
          return;
        }
        if (session) {
          openAccount();
          return;
        }
        if (panel === "profile") openSignup();
        else openLogin();
      }}
      TournamentFeed={() => (
        <PublicTournamentFeedSection runtime={runtime} hasSession={Boolean(session)} />
      )}
      Explore={() => (
        <PublicExploreSection runtime={runtime} hasSession={Boolean(session)} />
      )}
      GlobalSearch={() => <PlatformGlobalSearch runtime={runtime} />}
      tagline={runtime.tagline}
    />
  );
}
