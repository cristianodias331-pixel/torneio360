import React, { useEffect, useRef, useState } from "react";
import { Building2, CalendarDays, GitBranch, LoaderCircle, Map, MapPin, Search, Trophy, UserRound, Users, X } from "lucide-react";
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

const emptyGlobalSearchState = Object.freeze({
  loading: false,
  error: "",
  tournaments: [],
  accounts: [],
  circuits: [],
  locations: [],
  cities: [],
});

const globalSearchTabs = [
  { key: "all", label: "Principais" },
  { key: "tournaments", label: "Torneios" },
  { key: "accounts", label: "Contas" },
  { key: "circuits", label: "Circuitos" },
  { key: "locations", label: "Locais" },
  { key: "cities", label: "Cidades" },
];

function getSearchLocation(item) {
  return [item?.city, item?.state].filter(Boolean).join("/");
}

function PlatformSearchResultItem({ kind, item, onOpen }) {
  const accountIsOrganization = kind === "accounts" && item.account_kind === "organization";
  const imageUrl = item.photo_url || item.organization_photo_url || "";
  const title = item.name || item.city || "Resultado";
  let subtitle = "";
  let description = "";
  let Icon = Search;

  if (kind === "tournaments") {
    Icon = Trophy;
    subtitle = item.organization_name || "Torneio360";
    description = item.location || getSearchLocation(item) || "Torneio publicado";
  } else if (kind === "accounts") {
    Icon = accountIsOrganization ? Building2 : UserRound;
    subtitle = accountIsOrganization ? "Organização" : (item.handle ? `@${item.handle}` : "Atleta");
    description = getSearchLocation(item) || item.description || "Perfil no Torneio360";
  } else if (kind === "circuits") {
    Icon = GitBranch;
    subtitle = item.organization_name || "Circuito";
    description = [getSearchLocation(item), `${Number(item.tournament_count) || 0} torneio(s)`].filter(Boolean).join(" · ");
  } else if (kind === "locations") {
    Icon = MapPin;
    subtitle = getSearchLocation(item) || "Local esportivo";
    description = item.address || "Ver perfil e eventos deste local";
  } else if (kind === "cities") {
    Icon = Map;
    subtitle = item.state || "Cidade";
    description = `${Number(item.organization_count) || 0} organização(ões) · ${Number(item.athlete_count) || 0} atleta(s)`;
  }

  return (
    <button type="button" className="platformSearchResultItem" onClick={onOpen}>
      <span className="platformGlobalSearchThumb">
        {imageUrl ? <img src={imageUrl} alt="" /> : <Icon aria-hidden="true" />}
      </span>
      <span className="platformSearchResultIdentity">
        <span><strong>{title}</strong><em>{subtitle}</em></span>
        <small>{description}</small>
      </span>
    </button>
  );
}

export function PlatformGlobalSearch({ runtime, onOpenTournament = null }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [state, setState] = useState(emptyGlobalSearchState);
  const requestIdRef = useRef(0);

  const openTournament = (item) => {
    if (onOpenTournament) onOpenTournament(item);
    else navigatePlatform({ public: item.public_id });
  };

  async function runSearch(nextQuery = query, nextTab = "all") {
    const normalizedQuery = String(nextQuery || "").trim();
    setQuery(normalizedQuery);
    setActiveTab(nextTab);
    if (normalizeGlobalSearch(normalizedQuery).length < 2) {
      setSubmittedQuery("");
      setState({ ...emptyGlobalSearchState, error: normalizedQuery ? "Digite pelo menos 2 caracteres para pesquisar." : "" });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSubmittedQuery(normalizedQuery);
    setState({ ...emptyGlobalSearchState, loading: true });

    try {
      const result = await runtime.searchPublicPlatform({ query: normalizedQuery, limit: 12 });
      if (requestIdRef.current !== requestId) return;
      setState({
        loading: false,
        error: result.error ? "Não foi possível concluir a pesquisa agora." : "",
        tournaments: result.tournaments || [],
        accounts: result.accounts || [],
        circuits: result.circuits || [],
        locations: result.locations || [],
        cities: result.cities || [],
      });
    } catch (error) {
      console.warn("Busca geral indisponível:", error);
      if (requestIdRef.current === requestId) {
        setState({ ...emptyGlobalSearchState, error: "Não foi possível pesquisar agora." });
      }
    }
  }

  function clearSearch() {
    requestIdRef.current += 1;
    setQuery("");
    setSubmittedQuery("");
    setActiveTab("all");
    setState(emptyGlobalSearchState);
  }

  const groups = [
    { key: "tournaments", label: "Torneios", Icon: Trophy, items: state.tournaments },
    { key: "accounts", label: "Contas", Icon: Users, items: state.accounts },
    { key: "circuits", label: "Circuitos", Icon: GitBranch, items: state.circuits },
    { key: "locations", label: "Locais", Icon: MapPin, items: state.locations },
    { key: "cities", label: "Cidades", Icon: Map, items: state.cities },
  ];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleGroups = activeTab === "all" ? groups.filter((group) => group.items.length) : groups.filter((group) => group.key === activeTab);

  function openResult(kind, item) {
    if (kind === "tournaments") openTournament(item);
    else if (kind === "accounts") {
      if (item.account_kind === "organization") navigatePlatform({ organizacao: item.id });
      else navigatePlatform({ perfil: item.handle || item.id });
    } else if (kind === "circuits") navigatePlatform({ organizacao: item.organization_id, circuito: item.id });
    else if (kind === "locations") navigatePlatform({ organizacao: item.id });
    else if (kind === "cities") void runSearch([item.city, item.state].filter(Boolean).join(" "), "all");
  }

  return (
    <section className={`platformGlobalSearch${submittedQuery ? " hasResults" : ""}`} aria-label="Pesquisa geral da plataforma">
      <form className="platformGlobalSearchForm" role="search" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
        <div className="platformGlobalSearchField">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value) clearSearch();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void runSearch(event.currentTarget.value);
            }}
            placeholder="Pesquisar no Torneio360"
            aria-label="Pesquisar em toda a plataforma"
            autoComplete="off"
          />
          {query ? <button className="platformGlobalSearchClear" type="button" onClick={clearSearch} aria-label="Limpar pesquisa"><X aria-hidden="true" /></button> : <span />}
          <button className="platformGlobalSearchSubmit" type="submit"><Search aria-hidden="true" /><span>Buscar</span></button>
        </div>
        {!submittedQuery ? <p>Digite um nome, evento, local ou cidade e pressione <strong>Enter</strong>.</p> : null}
      </form>

      {submittedQuery ? (
        <div className="platformGlobalSearchResults" role="region" aria-live="polite" aria-label={`Resultados para ${submittedQuery}`}>
          <header className="platformGlobalSearchResultsHeader">
            <span>Resultados para</span>
            <strong>“{submittedQuery}”</strong>
          </header>
          <nav className="platformGlobalSearchTabs" role="tablist" aria-label="Categorias da pesquisa">
            {globalSearchTabs.map((tab) => {
              const count = tab.key === "all" ? total : state[tab.key]?.length || 0;
              return (
                <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>
                  {tab.label}<span>{count}</span>
                </button>
              );
            })}
          </nav>

          <div className="platformGlobalSearchContent">
            {state.loading ? <div className="platformGlobalSearchState"><LoaderCircle className="platformSearchSpinner" aria-hidden="true" /> Pesquisando em toda a plataforma...</div> : null}
            {!state.loading ? visibleGroups.map((group) => (
              <section className="platformGlobalSearchGroup" key={group.key} aria-labelledby={`platform-search-${group.key}`}>
                <h3 id={`platform-search-${group.key}`}><group.Icon aria-hidden="true" /> {group.label}<span>{group.items.length}</span></h3>
                {group.items.length ? (
                  <div className="platformSearchResultList">
                    {group.items.slice(0, activeTab === "all" ? 4 : 12).map((item) => (
                      <PlatformSearchResultItem key={`${group.key}-${item.id || `${item.city}-${item.state}`}`} kind={group.key} item={item} onOpen={() => openResult(group.key, item)} />
                    ))}
                  </div>
                ) : <div className="platformGlobalSearchState compact">Nenhum resultado nesta categoria.</div>}
              </section>
            )) : null}
            {!state.loading && !total && !state.error ? <div className="platformGlobalSearchState">Nenhum resultado encontrado para “{submittedQuery}”.</div> : null}
            {state.error ? <div className="platformGlobalSearchWarning">{state.error}</div> : null}
          </div>
        </div>
      ) : state.error ? <div className="platformGlobalSearchWarning">{state.error}</div> : null}
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
