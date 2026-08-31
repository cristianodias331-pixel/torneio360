import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Flame,
  GitBranch,
  Home,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Search,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { loadMyAthleteActivity } from "../../services/athleteActivityApi.mjs";
import { copyToClipboard } from "../../services/clipboard.mjs";
import styles from "./PlatformV2App.module.css";

const NAVIGATION = [
  { id: "overview", label: "Visão geral", Icon: Home, ready: true },
  { id: "profile", label: "Meu perfil", Icon: UserRound },
  { id: "tournaments", label: "Torneios", Icon: Trophy },
  { id: "circuits", label: "Circuitos", Icon: GitBranch },
  { id: "registrations", label: "Inscrições", Icon: ClipboardCheck },
  { id: "partners", label: "Duplas e desafios", Icon: UsersRound },
  { id: "ranking", label: "Ranking", Icon: Award },
  { id: "notifications", label: "Notificações", Icon: Bell },
  { id: "organization", label: "Organizar", Icon: Building2 },
];

const QUICK_FILTERS = [
  ["all", "Para você"],
  ["nearby", "Perto de você"],
  ["open", "Inscrições abertas"],
  ["beach", "Beach Tennis"],
];

function getInitials(value, fallback = "T3") {
  const initials = String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("");
  return initials || fallback;
}

function getDetails(item) {
  return item?.data || {};
}

function getOrganization(item) {
  return item?.organization || {};
}

function getOrganizationName(item) {
  const organization = getOrganization(item);
  return organization.name || organization.arena_name || "Organização Torneio 360";
}

function getOrganizationPhoto(item) {
  const organization = getOrganization(item);
  return organization.photo_url || organization.photoUrl || "";
}

function getOrganizationId(item) {
  const organization = getOrganization(item);
  return String(organization.id || organization.public_id || organization.name || "");
}

function getEventName(item) {
  const details = getDetails(item);
  return details.eventName || details.name || item?.name || "Torneio";
}

function getCover(item) {
  const details = getDetails(item);
  return details.eventCoverImageThumbnailUrl
    || details.coverImageThumbnailUrl
    || details.eventCoverImageUrl
    || details.coverImageUrl
    || item?.cover_url
    || "";
}

function getEventDate(item) {
  const details = getDetails(item);
  return details.eventDate || details.eventStartDate || details.startDate || "";
}

function getLocation(item) {
  const details = getDetails(item);
  const organization = getOrganization(item);
  return details.location
    || details.address
    || [organization.city, organization.state].filter(Boolean).join(" · ")
    || "Local a confirmar";
}

function getProfileName(user, profile) {
  return profile?.name
    || profile?.arena_name
    || user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Visitante";
}

function getProfilePhoto(user, profile) {
  return profile?.photo_url
    || profile?.avatar_url
    || user?.user_metadata?.avatar_url
    || "";
}

function buildShareUrl(item) {
  const url = new URL(window.location.origin);
  url.searchParams.set("app", "v2");
  if (item?.public_id) url.searchParams.set("torneio", item.public_id);
  return url.toString();
}

function Brand() {
  return (
    <span className={styles.brand}>
      <img src="/marketing/torneio360-logo-clean-v1.png" alt="Torneio 360" />
    </span>
  );
}

function OrganizerAvatar({ item, size = "regular" }) {
  const photo = getOrganizationPhoto(item);
  const name = getOrganizationName(item);
  return (
    <span className={`${styles.organizerAvatar} ${styles[size] || ""}`.trim()}>
      {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : getInitials(name)}
    </span>
  );
}

function EmptyPoster({ name }) {
  return (
    <span className={styles.emptyPoster}>
      <span><Flame aria-hidden="true" /></span>
      <strong>{name}</strong>
      <small>Publicado no Torneio 360</small>
    </span>
  );
}

function Poster({ item, alt }) {
  const cover = getCover(item);
  if (!cover) return <EmptyPoster name={getEventName(item)} />;
  return (
    <span className={styles.posterStage}>
      <img className={styles.posterBackdrop} src={cover} alt="" aria-hidden="true" />
      <img className={styles.posterImage} src={cover} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
}

function PlatformV2Detail({ item, runtime, registrationIntent, onClose, onLogin, hasSession, onNotice }) {
  if (!item) return null;
  const name = getEventName(item);
  const open = runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item));

  function requestRegistration() {
    if (!hasSession) {
      onLogin?.();
      return;
    }
    onNotice("A inscrição completa será conectada na etapa Torneios da V2, sem abrir a tela antiga.");
    onClose();
  }

  return (
    <div className={styles.detailBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.detailPanel} role="dialog" aria-modal="true" aria-labelledby="v2-tournament-title">
        <button type="button" className={styles.detailClose} onClick={onClose} aria-label="Fechar detalhes"><X /></button>
        <div className={styles.detailPoster}><Poster item={item} alt={`Arte de ${name}`} /></div>
        <div className={styles.detailContent}>
          <span className={styles.detailEyebrow}>{runtime.getModalityName(item.type)} · Prévia V2</span>
          <h2 id="v2-tournament-title">{name}</h2>
          <div className={styles.detailOrganizer}><OrganizerAvatar item={item} /><span><strong>{getOrganizationName(item)}</strong><small>Organizador responsável</small></span></div>
          <dl className={styles.detailFacts}>
            <div><dt><CalendarDays /></dt><dd><strong>Data</strong><span>{getEventDate(item) ? runtime.formatDate(getEventDate(item)) : "A confirmar"}</span></dd></div>
            <div><dt><MapPin /></dt><dd><strong>Local</strong><span>{getLocation(item)}</span></dd></div>
            <div><dt><ClipboardCheck /></dt><dd><strong>Inscrições</strong><span>{open ? "Abertas" : "Encerradas"}</span></dd></div>
          </dl>
          {open ? <button type="button" className={styles.detailPrimary} autoFocus={registrationIntent} onClick={requestRegistration}><ClipboardCheck /> Inscrever-se</button> : null}
          <small className={styles.detailFootnote}>Esta é a nova visualização. Nenhuma tela antiga será aberta dentro dela.</small>
        </div>
      </section>
    </div>
  );
}

function ComingSoon({ tab }) {
  const item = NAVIGATION.find((entry) => entry.id === tab) || NAVIGATION[0];
  const Icon = item.Icon;
  return (
    <section className={styles.comingSoon}>
      <span className={styles.comingSoonIcon}><Icon /></span>
      <span className={styles.kicker}>Próxima etapa da V2</span>
      <h1>{item.label}</h1>
      <p>Esta aba será construída dentro deste mesmo padrão, sem importar o visual anterior.</p>
      <div><Sparkles /><span><strong>Estrutura isolada</strong><small>Dados e funções serão conectados depois da aprovação visual.</small></span></div>
    </section>
  );
}

export default function PlatformV2App({ runtime, supabase, user = null, profile = null, onLogin, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia?.("(min-width: 1000px)").matches ?? true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [feed, setFeed] = useState({ status: "loading", items: [], error: "", hasMore: false, nextCursor: null });
  const [activity, setActivity] = useState({ registrations: [], circuits: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");
  const hasSession = Boolean(user?.id);
  const profileName = getProfileName(user, profile);
  const profilePhoto = getProfilePhoto(user, profile);

  useEffect(() => {
    const previous = document.documentElement.dataset.platformV2;
    document.documentElement.dataset.platformV2 = "true";
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.platformV2;
      else document.documentElement.dataset.platformV2 = previous;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setFeed((current) => ({ ...current, status: "loading", error: "" }));
    runtime.fetchPublicTournamentFeed({ limit: 24 }).then((result) => {
      if (!active) return;
      setFeed({
        status: "ready",
        items: result.items || [],
        error: result.error ? "Não foi possível carregar as publicações agora." : "",
        hasMore: result.hasMore === true,
        nextCursor: result.nextCursor || null,
      });
    }).catch(() => {
      if (active) setFeed({ status: "error", items: [], error: "Não foi possível carregar as publicações agora.", hasMore: false, nextCursor: null });
    });
    return () => { active = false; };
  }, [runtime]);

  useEffect(() => {
    if (!hasSession) {
      setActivity({ registrations: [], circuits: [] });
      return undefined;
    }
    let active = true;
    loadMyAthleteActivity({ supabase }).then((result) => {
      if (active) setActivity(result.activity || { registrations: [], circuits: [] });
    }).catch(() => {
      if (active) setActivity({ registrations: [], circuits: [] });
    });
    return () => { active = false; };
  }, [hasSession, supabase, user?.id]);

  useEffect(() => {
    const mobile = window.matchMedia?.("(max-width: 999px)").matches;
    if (!mobile || !sidebarOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sidebarOpen]);

  const organizers = useMemo(() => {
    const values = new Map();
    feed.items.forEach((item) => {
      const id = getOrganizationId(item);
      if (id && !values.has(id)) values.set(id, item);
    });
    return Array.from(values.values());
  }, [feed.items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const profileLocation = [profile?.city, profile?.state].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return feed.items.filter((item) => {
      const organization = getOrganization(item);
      const details = getDetails(item);
      if (organizationFilter && getOrganizationId(item) !== organizationFilter) return false;
      if (quickFilter === "open" && !runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item))) return false;
      if (quickFilter === "beach" && !`${runtime.getModalityName(item.type)} ${item.type || ""}`.toLocaleLowerCase("pt-BR").includes("beach")) return false;
      if (quickFilter === "nearby" && profileLocation) {
        const location = `${getLocation(item)} ${organization.city || ""} ${organization.state || ""}`.toLocaleLowerCase("pt-BR");
        if (!profileLocation.split(/\s+/).some((part) => part.length > 1 && location.includes(part))) return false;
      }
      if (!normalizedQuery) return true;
      return [
        getEventName(item),
        getLocation(item),
        getOrganizationName(item),
        details.category,
        runtime.getModalityName(item.type),
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    }).sort((first, second) => Number(Boolean(getCover(second))) - Number(Boolean(getCover(first))));
  }, [feed.items, organizationFilter, profile?.city, profile?.state, query, quickFilter, runtime]);

  const upcoming = feed.items.slice(0, 3);
  const registrations = (activity.registrations || []).filter((entry) => entry.bucket !== "past").slice(0, 2);

  function selectTab(tab) {
    setActiveTab(tab);
    setAccountOpen(false);
    if (window.matchMedia?.("(max-width: 999px)").matches) setSidebarOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function openDetails(item, registrationIntent = false) {
    setDetail({ item, registrationIntent });
  }

  async function share(item) {
    const data = { title: getEventName(item), text: `Veja ${getEventName(item)} no Torneio 360.`, url: buildShareUrl(item) };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      const copied = await copyToClipboard(data.url);
      setNotice(copied ? "Link copiado para compartilhar." : "Não foi possível copiar o link agora.");
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    }
  }

  async function loadMore() {
    if (!feed.hasMore || !feed.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await runtime.fetchPublicTournamentFeed({ limit: 12, cursor: feed.nextCursor });
    setFeed((current) => ({
      status: "ready",
      items: result.error ? current.items : Array.from(new Map([...current.items, ...(result.items || [])].map((item) => [String(item.id || item.public_id), item])).values()),
      error: result.error ? "Não foi possível carregar mais torneios." : "",
      hasMore: result.error ? current.hasMore : result.hasMore === true,
      nextCursor: result.error ? current.nextCursor : result.nextCursor || null,
    }));
    setLoadingMore(false);
  }

  return (
    <div className={`${styles.app} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          <button type="button" className={styles.menuButton} onClick={() => setSidebarOpen((current) => !current)} aria-label={sidebarOpen ? "Recolher menu" : "Abrir menu"} aria-expanded={sidebarOpen}><Menu /></button>
          <Brand />
        </div>

        {activeTab === "overview" ? (
          <label className={styles.topSearch}>
            <Search />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar torneios, eventos ou organizadores" aria-label="Buscar torneios, eventos ou organizadores" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X /></button> : null}
          </label>
        ) : <strong className={styles.topbarPageName}>{NAVIGATION.find((entry) => entry.id === activeTab)?.label}</strong>}

        <div className={styles.topActions}>
          <button type="button" className={styles.notificationButton} onClick={() => selectTab("notifications")} aria-label="Abrir notificações"><Bell /></button>
          {hasSession ? (
            <div className={styles.accountWrap}>
              <button type="button" className={styles.accountButton} onClick={() => setAccountOpen((current) => !current)} aria-expanded={accountOpen}>
                <span className={styles.accountAvatar}>{profilePhoto ? <img src={profilePhoto} alt="" /> : getInitials(profileName)}</span>
                <span><strong>{profileName}</strong><small>{profile?.arena_name ? "Perfil da organização" : "Conta Torneio 360"}</small></span>
                <ChevronDown />
              </button>
              {accountOpen ? <div className={styles.accountMenu}><button type="button" onClick={() => selectTab("profile")}><CircleUserRound /> Meu perfil</button><button type="button" onClick={onLogout}><LogOut /> Sair</button></div> : null}
            </div>
          ) : <button type="button" className={styles.loginButton} onClick={onLogin} aria-label="Entrar"><LogIn /><span>Entrar</span></button>}
        </div>
      </header>

      <button type="button" className={styles.mobileBackdrop} onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />
      <aside className={styles.sidebar} aria-label="Navegação da plataforma V2">
        <nav>
          {NAVIGATION.map(({ id, label, Icon, ready }) => (
            <button type="button" key={id} className={activeTab === id ? styles.activeNav : ""} onClick={() => selectTab(id)} aria-current={activeTab === id ? "page" : undefined} title={label}>
              <span><Icon />{id === "notifications" ? <i /> : null}</span>
              <strong>{label}</strong>
              {!ready && sidebarOpen ? <small>Em construção</small> : null}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFoot}><Flame /><span><strong>Plataforma V2</strong><small>Prévia de homologação</small></span></div>
      </aside>

      <main className={styles.main}>
        {notice ? <div className={styles.notice} role="status"><Check /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X /></button></div> : null}
        {activeTab !== "overview" ? <ComingSoon tab={activeTab} /> : (
          <div className={styles.overview}>
            <header className={styles.overviewHeader}>
              <div><span className={styles.kicker}>Para você</span><h1>Visão geral</h1><p>Descubra torneios, acompanhe eventos e encontre sua próxima disputa.</p></div>
              <span className={styles.synced}><i /><span>Atualizado com dados da plataforma</span></span>
            </header>

            <label className={styles.mobileSearch}>
              <Search />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na plataforma" aria-label="Buscar na plataforma" />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X /></button> : null}
            </label>

            <nav className={styles.filters} aria-label="Filtros da visão geral">
              {QUICK_FILTERS.map(([id, label]) => <button type="button" key={id} className={quickFilter === id ? styles.activeFilter : ""} onClick={() => setQuickFilter(id)}>{label}</button>)}
            </nav>

            {organizers.length ? (
              <section className={styles.stories} aria-label="Organizações em destaque">
                {organizers.slice(0, 8).map((item) => {
                  const id = getOrganizationId(item);
                  return <button type="button" key={id} className={organizationFilter === id ? styles.activeStory : ""} onClick={() => setOrganizationFilter((current) => current === id ? "" : id)}><OrganizerAvatar item={item} size="story" /><strong>{getOrganizationName(item)}</strong><small>{organizationFilter === id ? "Selecionado" : "Ver eventos"}</small></button>;
                })}
              </section>
            ) : null}

            <div className={styles.contentGrid}>
              <section className={styles.feed} aria-label="Publicações de torneios">
                {feed.status === "loading" ? <div className={styles.feedState}><span className={styles.fireLoader}><i /></span><strong>Preparando publicações...</strong></div> : null}
                {feed.error && !feed.items.length ? <div className={styles.feedState}><X /><strong>{feed.error}</strong></div> : null}
                {feed.status !== "loading" && !visibleItems.length ? <div className={styles.feedState}><Search /><strong>Nenhum evento encontrado.</strong><button type="button" onClick={() => { setQuickFilter("all"); setOrganizationFilter(""); setQuery(""); }}>Limpar filtros</button></div> : null}

                {visibleItems.map((item) => {
                  const name = getEventName(item);
                  const registrationOpen = runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item));
                  return (
                    <article className={styles.post} key={item.id || item.public_id}>
                      <header className={styles.postHeader}>
                        <button type="button" className={styles.organizerIdentity} onClick={() => setOrganizationFilter(getOrganizationId(item))}><OrganizerAvatar item={item} /><span><strong>{getOrganizationName(item)}</strong><small>{getLocation(item)}</small></span></button>
                        <span className={registrationOpen ? styles.openBadge : styles.closedBadge}>{registrationOpen ? "Inscrições abertas" : "Encerrado"}</span>
                      </header>
                      <button type="button" className={styles.posterButton} onClick={() => openDetails(item)} aria-label={`Ver detalhes de ${name}`}><Poster item={item} alt={`Arte de ${name}`} /></button>
                      <div className={styles.postBody}>
                        <span className={styles.postModality}>{runtime.getModalityName(item.type)}</span>
                        <h2>{name}</h2>
                        <p>{getEventDate(item) ? <span><CalendarDays /> {runtime.formatDate(getEventDate(item))}</span> : null}<span><MapPin /> {getLocation(item)}</span></p>
                      </div>
                      <footer className={styles.postActions}>
                        <button type="button" onClick={() => share(item)}><Share2 /> Compartilhar</button>
                        <button type="button" onClick={() => openDetails(item)}><ChevronRight /> Ver detalhes</button>
                        {registrationOpen ? <button type="button" className={styles.primaryAction} onClick={() => openDetails(item, true)}><ClipboardCheck /> Inscrever-se</button> : null}
                      </footer>
                    </article>
                  );
                })}

                {feed.hasMore ? <button type="button" className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>{loadingMore ? <><LoaderCircle /> Carregando</> : "Mostrar mais torneios"}</button> : null}
              </section>

              <aside className={styles.rail}>
                <section className={styles.railCard}>
                  <header><span><MapPin /> Próximos eventos</span><button type="button" onClick={() => setQuickFilter("nearby")}>Ver todos</button></header>
                  {upcoming.length ? upcoming.map((item) => <button type="button" className={styles.railEvent} key={item.id || item.public_id} onClick={() => openDetails(item)}><span>{getCover(item) ? <img src={getCover(item)} alt="" /> : <Trophy />}</span><span><strong>{getEventName(item)}</strong><small>{getEventDate(item) ? runtime.formatDate(getEventDate(item)) : getLocation(item)}</small></span><ChevronRight /></button>) : <p>Nenhum evento publicado por enquanto.</p>}
                </section>

                <section className={styles.railCard}>
                  <header><span><ClipboardCheck /> Minhas inscrições</span>{hasSession ? <button type="button" onClick={() => selectTab("registrations")}>Ver todas</button> : null}</header>
                  {!hasSession ? <div className={styles.railSignIn}><LogIn /><span><strong>Acompanhe suas inscrições</strong><small>Entre para visualizar seus próximos eventos.</small></span><button type="button" onClick={onLogin}>Entrar</button></div> : registrations.length ? registrations.map((entry) => <button type="button" className={styles.railEvent} key={entry.id} onClick={() => entry.tournament && openDetails(entry.tournament)}><span>{entry.tournament?.cover_url ? <img src={entry.tournament.cover_url} alt="" /> : <Trophy />}</span><span><strong>{entry.tournament?.name || "Torneio"}</strong><small>{entry.category || "Categoria a confirmar"}</small></span><Check className={styles.confirmed} /></button>) : <p>Suas próximas inscrições aparecerão aqui.</p>}
                </section>

                <section className={styles.railCard}>
                  <header><span><Building2 /> Organizadores</span></header>
                  {organizers.slice(0, 3).map((item) => <button type="button" className={styles.railOrganizer} key={getOrganizationId(item)} onClick={() => setOrganizationFilter(getOrganizationId(item))}><OrganizerAvatar item={item} /><span><strong>{getOrganizationName(item)}</strong><small>Ver eventos</small></span><ChevronRight /></button>)}
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>

      <PlatformV2Detail item={detail?.item} runtime={runtime} registrationIntent={detail?.registrationIntent} onClose={() => setDetail(null)} onLogin={onLogin} hasSession={hasSession} onNotice={setNotice} />
    </div>
  );
}
