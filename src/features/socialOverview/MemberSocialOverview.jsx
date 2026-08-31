import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
  MapPin,
  Search,
  Share2,
  Trophy,
  X,
} from "lucide-react";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import { loadMyAthleteActivity } from "../../services/athleteActivityApi.mjs";
import { copyToClipboard } from "../../services/clipboard.mjs";
import "../../styles/67-member-social-overview.css";

function getInitials(name) {
  return String(name || "T360")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("") || "T3";
}

function getTournamentDetails(item) {
  return item?.data || {};
}

function getTournamentCover(item) {
  const details = getTournamentDetails(item);
  return details.eventCoverImageThumbnailUrl
    || details.coverImageThumbnailUrl
    || details.eventCoverImageUrl
    || details.coverImageUrl
    || "";
}

function getEventName(item) {
  const details = getTournamentDetails(item);
  return details.eventName || item?.name || "Torneio";
}

function getEventDate(item) {
  const details = getTournamentDetails(item);
  return details.eventDate || details.eventStartDate || "";
}

function getEventLocation(item) {
  const details = getTournamentDetails(item);
  return details.location || [item?.organization?.city, item?.organization?.state].filter(Boolean).join("/") || "Local a confirmar";
}

function getOrganizationKey(organization) {
  return String(organization?.id || organization?.public_id || organization?.name || "");
}

function buildTournamentUrl(item) {
  const url = new URL(window.location.origin);
  if (item?.public_id) url.searchParams.set("public", item.public_id);
  return url.toString();
}

export function MemberSocialOverviewSearch({ value, onChange }) {
  return (
    <label className="memberSocialTopSearch">
      <Search aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar torneios, eventos ou organizadores"
        aria-label="Buscar torneios, eventos ou organizadores"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Limpar busca"><X aria-hidden="true" /></button>
      ) : null}
    </label>
  );
}

function OrganizerIdentity({ organization, compact = false }) {
  const name = organization?.name || "Organização Torneio 360";
  return (
    <span className={`memberSocialOrganizerIdentity ${compact ? "compact" : ""}`.trim()}>
      <span className="memberSocialOrganizerAvatar">
        {organization?.photo_url ? <img src={organization.photo_url} alt="" loading="lazy" decoding="async" /> : getInitials(name)}
      </span>
      <span>
        <strong>{name}</strong>
        <small>{[organization?.city, organization?.state].filter(Boolean).join("/") || "Organização Torneio 360"}</small>
      </span>
    </span>
  );
}

export default function MemberSocialOverview({
  runtime,
  supabase,
  user,
  profile,
  query = "",
  onQueryChange,
  onNavigate,
  onOpenTournament,
}) {
  const [feedState, setFeedState] = useState({ status: "loading", items: [], error: "", hasMore: false, nextCursor: null });
  const [activity, setActivity] = useState({ registrations: [], circuits: [] });
  const [quickFilter, setQuickFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setFeedState((current) => ({ ...current, status: "loading", error: "" }));
    runtime.fetchPublicTournamentFeed({ limit: 12 }).then((result) => {
      if (!active) return;
      setFeedState({
        status: "ready",
        items: result.items || [],
        error: result.error ? "Não foi possível carregar as publicações agora." : "",
        hasMore: result.hasMore === true,
        nextCursor: result.nextCursor || null,
      });
    }).catch(() => {
      if (active) setFeedState({ status: "error", items: [], error: "Não foi possível carregar as publicações agora.", hasMore: false, nextCursor: null });
    });
    return () => { active = false; };
  }, [runtime]);

  useEffect(() => {
    let active = true;
    loadMyAthleteActivity({ supabase }).then((result) => {
      if (active) setActivity(result.activity || { registrations: [], circuits: [] });
    }).catch(() => {
      if (active) setActivity({ registrations: [], circuits: [] });
    });
    return () => { active = false; };
  }, [supabase, user?.id]);

  const organizers = useMemo(() => {
    const map = new Map();
    feedState.items.forEach((item) => {
      const organization = item.organization || {};
      const key = getOrganizationKey(organization);
      if (key && !map.has(key)) map.set(key, organization);
    });
    return Array.from(map.values());
  }, [feedState.items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const profileLocation = [profile?.city, profile?.state].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return feedState.items.filter((item) => {
      const details = getTournamentDetails(item);
      const organization = item.organization || {};
      if (organizationFilter && getOrganizationKey(organization) !== organizationFilter) return false;
      if (quickFilter === "open" && !runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item))) return false;
      if (quickFilter === "nearby" && profileLocation) {
        const itemLocation = [details.location, organization.city, organization.state].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
        if (!profileLocation.split(/\s+/).some((part) => part.length > 1 && itemLocation.includes(part))) return false;
      }
      if (quickFilter === "beach") {
        const modality = String(runtime.getModalityName(item.type) || "").toLocaleLowerCase("pt-BR");
        if (!modality.includes("beach") && !String(item.type || "").toLocaleLowerCase("pt-BR").includes("beach")) return false;
      }
      if (!normalizedQuery) return true;
      return [
        getEventName(item),
        details.location,
        details.category,
        organization.name,
        organization.city,
        organization.state,
        runtime.getModalityName(item.type),
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });
  }, [feedState.items, organizationFilter, profile?.city, profile?.state, query, quickFilter, runtime]);

  async function loadMore() {
    if (!feedState.hasMore || !feedState.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await runtime.fetchPublicTournamentFeed({ limit: 12, cursor: feedState.nextCursor });
    setFeedState((current) => ({
      status: "ready",
      items: result.error ? current.items : Array.from(new Map(
        [...current.items, ...(result.items || [])].map((item) => [String(item.id), item])
      ).values()),
      error: result.error ? "Não foi possível carregar mais torneios agora." : "",
      hasMore: result.error ? current.hasMore : result.hasMore === true,
      nextCursor: result.error ? current.nextCursor : result.nextCursor || null,
    }));
    setLoadingMore(false);
  }

  function openOrganization(organization) {
    if (organization?.id) navigatePlatform({ organizacao: organization.id });
  }

  async function shareTournament(item) {
    const shareData = { title: getEventName(item), text: `Veja ${getEventName(item)} no Torneio 360.`, url: buildTournamentUrl(item) };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      const copied = await copyToClipboard(shareData.url);
      setNotice(copied ? "Link do torneio copiado." : "Não foi possível copiar o link agora.");
    } catch (error) {
      if (error?.name !== "AbortError") setNotice("Não foi possível compartilhar agora.");
    }
  }

  const upcomingItems = feedState.items.slice(0, 3);
  const registrations = (activity.registrations || []).filter((item) => item.bucket !== "past").slice(0, 2);

  return (
    <section className="memberSocialOverview" aria-labelledby="member-social-overview-title">
      <header className="memberSocialOverviewHeading">
        <div>
          <span>Para você</span>
          <h1 id="member-social-overview-title">Visão geral</h1>
          <p>Descubra torneios e eventos e acompanhe suas inscrições.</p>
        </div>
        <small><CheckCircle2 aria-hidden="true" /> Sincronizado com a plataforma</small>
      </header>

      <div className="memberSocialMobileSearch">
        <MemberSocialOverviewSearch value={query} onChange={onQueryChange} />
      </div>

      <nav className="memberSocialQuickFilters" aria-label="Filtrar publicações">
        {[
          ["all", "Para você"],
          ["nearby", "Perto de você"],
          ["open", "Inscrições abertas"],
          ["beach", "Beach Tennis"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={quickFilter === id ? "active" : ""} onClick={() => setQuickFilter(id)}>{label}</button>
        ))}
      </nav>

      {organizers.length ? (
        <div className="memberSocialStories" aria-label="Organizações em destaque">
          {organizers.slice(0, 7).map((organization) => {
            const key = getOrganizationKey(organization);
            return (
              <button key={key} type="button" className={organizationFilter === key ? "active" : ""} onClick={() => setOrganizationFilter((current) => current === key ? "" : key)}>
                <span>{organization.photo_url ? <img src={organization.photo_url} alt="" loading="lazy" decoding="async" /> : getInitials(organization.name)}</span>
                <small>{organization.name || "Organização"}</small>
              </button>
            );
          })}
        </div>
      ) : null}

      {notice ? <div className="memberSocialNotice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X /></button></div> : null}

      <div className="memberSocialOverviewGrid">
        <div className="memberSocialFeedColumn">
          {feedState.status === "loading" ? <div className="memberSocialState"><LoaderCircle className="spinning" /><strong>Carregando publicações...</strong></div> : null}
          {feedState.error && !feedState.items.length ? <div className="memberSocialState error"><strong>{feedState.error}</strong></div> : null}
          {feedState.status !== "loading" && !visibleItems.length ? <div className="memberSocialState"><Search /><strong>Nenhum torneio encontrado com estes filtros.</strong><button type="button" onClick={() => { setQuickFilter("all"); setOrganizationFilter(""); onQueryChange?.(""); }}>Limpar filtros</button></div> : null}

          {visibleItems.map((item) => {
            const organization = item.organization || {};
            const cover = getTournamentCover(item);
            const eventName = getEventName(item);
            const eventDate = getEventDate(item);
            const registrationOpen = runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item));
            return (
              <article className="memberSocialPost" key={item.id}>
                <header>
                  <button type="button" onClick={() => openOrganization(organization)}><OrganizerIdentity organization={organization} /></button>
                  <span className={registrationOpen ? "open" : "closed"}>{registrationOpen ? "Inscrições abertas" : "Inscrições encerradas"}</span>
                </header>
                <button type="button" className="memberSocialPostPoster" onClick={() => onOpenTournament(item)} aria-label={`Abrir ${eventName}`}>
                  {cover ? <img src={cover} alt={`Arte de ${eventName}`} loading="lazy" decoding="async" /> : <span><Trophy aria-hidden="true" /><strong>{eventName}</strong><small>Evento publicado no Torneio 360</small></span>}
                </button>
                <div className="memberSocialPostInfo">
                  <div>
                    <small>{runtime.getModalityName(item.type)}</small>
                    <h2>{eventName}</h2>
                    <p>{eventDate ? <span><CalendarDays /> {runtime.formatDate(eventDate)}</span> : null}<span><MapPin /> {getEventLocation(item)}</span></p>
                  </div>
                  <button type="button" onClick={() => onOpenTournament(item)}>Ver torneio</button>
                </div>
                <footer>
                  <button type="button" onClick={() => shareTournament(item)}><Share2 /> Compartilhar</button>
                  {registrationOpen ? <button type="button" className="primary" onClick={() => onOpenTournament(item, "inscricao")}><ClipboardCheck /> Inscrever-se</button> : null}
                </footer>
              </article>
            );
          })}

          {feedState.hasMore ? <button type="button" className="memberSocialLoadMore" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <><LoaderCircle className="spinning" /> Carregando...</> : "Mostrar mais torneios"}</button> : null}
        </div>

        <aside className="memberSocialRail">
          <section>
            <header><strong><MapPin /> Próximos da sua região</strong><button type="button" onClick={() => setQuickFilter("nearby")}>Ver todos</button></header>
            {upcomingItems.length ? upcomingItems.map((item) => (
              <button type="button" className="memberSocialRailEvent" key={item.id} onClick={() => onOpenTournament(item)}>
                <span>{getTournamentCover(item) ? <img src={getTournamentCover(item)} alt="" loading="lazy" decoding="async" /> : <Trophy />}</span>
                <span><strong>{getEventName(item)}</strong><small>{getEventLocation(item)}</small></span>
                <ChevronRight />
              </button>
            )) : <p>Nenhum evento publicado por enquanto.</p>}
          </section>

          <section>
            <header><strong><ClipboardCheck /> Minhas inscrições</strong><button type="button" onClick={() => onNavigate?.("registrations")}>Ver todas</button></header>
            {registrations.length ? registrations.map((registration) => (
              <button type="button" className="memberSocialRailEvent" key={registration.id} onClick={() => registration.tournament?.public_id && onOpenTournament(registration.tournament)}>
                <span>{registration.tournament?.cover_url ? <img src={registration.tournament.cover_url} alt="" loading="lazy" decoding="async" /> : <Trophy />}</span>
                <span><strong>{registration.tournament?.name || "Torneio"}</strong><small>{registration.category || "Categoria a confirmar"}</small></span>
                <CheckCircle2 className="confirmed" />
              </button>
            )) : <p>Suas próximas inscrições aparecerão aqui.</p>}
          </section>

          <section>
            <header><strong><Building2 /> Organizadores em destaque</strong></header>
            {organizers.slice(0, 3).map((organization) => (
              <button type="button" className="memberSocialRailOrganizer" key={getOrganizationKey(organization)} onClick={() => openOrganization(organization)}>
                <OrganizerIdentity organization={organization} compact /><span>Ver perfil</span>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
