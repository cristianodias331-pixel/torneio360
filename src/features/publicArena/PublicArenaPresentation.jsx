import React from "react";
import {
  AtSign,
  CalendarDays,
  GitBranch,
  MapPin,
  MessageCircle,
  Search,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  BeachLogo,
  PlatformSupportLinks,
} from "../appShell/EntryPresentation.jsx";

export function PublicRegistrationStatusView({ open, whatsapp, eventName, getWhatsAppUrl }) {
  if (!open) {
    return <span className="publicRegistrationStatus closed">Inscrições encerradas</span>;
  }

  const message = `Olá! Quero me inscrever em ${eventName || "um evento"} pelo Torneio360.`;
  const whatsappUrl = getWhatsAppUrl(whatsapp, message);

  if (!whatsappUrl) {
    return <span className="publicRegistrationStatus open unavailable" title="WhatsApp não cadastrado pela arena">Inscreva-se</span>;
  }

  return (
    <a className="publicRegistrationStatus open" href={whatsappUrl} target="_blank" rel="noreferrer">
      <MessageCircle aria-hidden="true" /> Inscreva-se
    </a>
  );
}

export function PublicArenaHeroHeaderView({
  arenaName,
  organizer,
  label = "Perfil oficial da arena",
  tagline,
  onBack,
  onOrganizerAccess,
}) {
  const location = [organizer?.city, organizer?.state].filter(Boolean).join("/");
  const hasMetadata = Boolean(organizer?.organizerName || location);

  return (
    <header className="publicHeader publicHeaderWithLogo publicArenaStandardHeader">
      <div className="publicBrandRow">
        <BeachLogo />
        <div className="brandTaglineOnly"><span>{tagline}</span></div>
      </div>

      <div className="publicTitleBlock publicArenaTitleBlock">
        <span>{label}</span>
        <div className="publicArenaTitleMain">
          {organizer?.photoUrl ? (
            <img src={organizer.photoUrl} alt={`Foto de ${arenaName}`} />
          ) : (
            <span className="publicArenaInitials">{arenaName.slice(0, 2).toUpperCase()}</span>
          )}
          <div className="publicArenaTitleCopy">
            <h1>{arenaName}</h1>
            {hasMetadata ? (
              <p className="publicArenaTitleMeta">
                {organizer?.organizerName ? <span>Organização: {organizer.organizerName}</span> : null}
                {location ? <span><MapPin aria-hidden="true" /> {location}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="publicTournamentHeaderActions publicArenaHeaderActions">
        <button type="button" className="publicBackToPlatform" onClick={onBack}>← Voltar às arenas</button>
        <button type="button" className="publicOrganizerAccess" onClick={onOrganizerAccess}>Área do organizador</button>
      </div>
    </header>
  );
}

export function PublicArenaTournamentCardsView({
  items,
  organizer,
  onOpen,
  openingPublicId = null,
  getRegistrationDeadline,
  isRegistrationOpen,
  getModalityName,
  formatDate,
  sortTournaments,
  RegistrationStatus,
}) {
  const groups = (items || []).reduce((result, tournament) => {
    const details = tournament.data || {};
    const key = details.multiCategoryEvent === true && details.eventGroupKey
      ? details.eventGroupKey
      : tournament.id;
    const existing = result.find((group) => String(group.key) === String(key));
    if (existing) existing.items.push(tournament);
    else result.push({ key, items: [tournament] });
    return result;
  }, []);

  return groups.map((group) => {
    const first = group.items[0];
    const firstDetails = first.data || {};
    const isGroup = group.items.length > 1 || firstDetails.multiCategoryEvent === true;
    const title = isGroup ? firstDetails.eventName || first.name : first.name;
    const coverImage = firstDetails.coverImageUrl || "";
    const profileFallbackImage = !coverImage ? organizer.photoUrl : "";
    const registrationOpen = group.items.some((item) => isRegistrationOpen(getRegistrationDeadline(item)));

    return (
      <article className={`card publicArenaEventCard publicArenaEventCardWithCover ${isGroup ? "publicArenaGroupedEvent" : ""}`} key={group.key}>
        <div className={`publicArenaEventCover ${profileFallbackImage ? "isProfileFallback" : ""}`}>
          {coverImage ? <img src={coverImage} alt={`Capa de ${title}`} loading="lazy" decoding="async" /> : null}
          {profileFallbackImage ? <img className="publicArenaProfileFallback" src={profileFallbackImage} alt={`Foto da arena ${organizer.arenaName || "organizadora"}`} loading="lazy" decoding="async" /> : null}
          {!coverImage && !profileFallbackImage ? <span><Trophy aria-hidden="true" /></span> : null}
        </div>
        <div className="publicArenaEventBody">
          <small>{isGroup ? `${group.items.length} ${group.items.length === 1 ? "categoria" : "categorias"}` : getModalityName(first.type)}</small>
          <h2>{title}</h2>
          <p>
            {firstDetails.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDate(firstDetails.eventDate)}</span> : null}
            {firstDetails.location ? <span><MapPin aria-hidden="true" /> {firstDetails.location}</span> : null}
          </p>
          <RegistrationStatus open={registrationOpen} whatsapp={organizer.whatsapp} eventName={title} />
          {isGroup ? (
            <div className="publicGroupedCategoryList">
              {sortTournaments(group.items).map((item) => (
                <button type="button" key={item.id} onClick={() => onOpen(item)} disabled={openingPublicId === item.public_id}>
                  <span>{item.name}</span><small>{getModalityName(item.type)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!isGroup ? (
          <button type="button" onClick={() => onOpen(first)} disabled={openingPublicId === first.public_id}>
            {openingPublicId === first.public_id ? "Abrindo..." : "Ver torneio"}
          </button>
        ) : null}
      </article>
    );
  });
}

export function PublicArenaPageView({
  arenaName,
  organizer,
  pageClassName = "publicArenaRealPage",
  heroLabel,
  contactDescription = "Torneios e circuitos aparecem aqui automaticamente desde a criação.",
  activeArenaTab,
  activeStatusTab,
  activeItems,
  finishedItems,
  visibleItems,
  onArenaTabChange,
  onStatusTabChange,
  onOpenTournament,
  onOpenCircuit,
  openingPublicId = null,
  openingCircuitId = null,
  getWhatsAppUrl,
  getCircuitStatus,
  getCircuitDateLabel,
  getCircuitTournamentCount,
  HeroHeader,
  TournamentCards,
}) {
  const initialVisibleItems = 8;
  const [visibleLimit, setVisibleLimit] = React.useState(initialVisibleItems);

  React.useEffect(() => {
    setVisibleLimit(initialVisibleItems);
  }, [activeArenaTab, activeStatusTab]);

  const displayedItems = visibleItems.slice(0, visibleLimit);
  const remainingItems = Math.max(0, visibleItems.length - displayedItems.length);

  return (
    <div className={`publicPage publicArenaPage ${pageClassName}`.trim()}>
      <HeroHeader arenaName={arenaName} organizer={organizer} label={heroLabel} />

      <main className="publicContent publicArenaContent">
        <section className="card publicArenaContacts">
          <div><h2>Eventos da arena</h2><p>{contactDescription}</p></div>
          <div className="publicOrganizerLinks">
            {organizer.whatsapp ? <a href={getWhatsAppUrl(organizer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
            {organizer.whatsappGroupLink ? <a href={organizer.whatsappGroupLink} target="_blank" rel="noreferrer"><Users aria-hidden="true" /> Grupo do WhatsApp</a> : null}
            {organizer.instagramLink ? <a href={organizer.instagramLink} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> Instagram</a> : null}
            {organizer.mapsLink ? <a href={organizer.mapsLink} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Google Maps</a> : null}
          </div>
        </section>

        <nav className="publicArenaTabs" aria-label="Conteúdo público da arena">
          <button type="button" className={activeArenaTab === "tournaments" ? "active" : ""} onClick={() => onArenaTabChange("tournaments")}><Trophy aria-hidden="true" /> Torneios</button>
          <button type="button" className={activeArenaTab === "circuits" ? "active" : ""} onClick={() => onArenaTabChange("circuits")}><GitBranch aria-hidden="true" /> Circuitos</button>
        </nav>

        <nav className="publicArenaStatusTabs" aria-label="Situação dos eventos">
          <button type="button" className={activeStatusTab === "active" ? "active" : ""} onClick={() => onStatusTabChange("active")}>Ativos <span>{activeItems.length}</span></button>
          <button type="button" className={activeStatusTab === "finished" ? "active" : ""} onClick={() => onStatusTabChange("finished")}>Encerrados <span>{finishedItems.length}</span></button>
        </nav>

        <section className="publicArenaEventGrid" aria-live="polite">
          {visibleItems.length === 0 ? (
            <div className="card publicArenaEmpty">Nenhum {activeArenaTab === "tournaments" ? "torneio" : "circuito"} {activeStatusTab === "finished" ? "encerrado" : "ativo"} neste perfil.</div>
          ) : activeArenaTab === "tournaments" ? (
            <TournamentCards items={displayedItems} organizer={organizer} onOpen={onOpenTournament} openingPublicId={openingPublicId} />
          ) : displayedItems.map((item) => {
            const circuitStatus = getCircuitStatus(item);
            return (
              <article className="card publicArenaEventCard publicArenaCircuitCard" key={item.id}>
                <div className="publicArenaEventIcon"><GitBranch aria-hidden="true" /></div>
                <div>
                  <small>Circuito</small><h2>{item.name}</h2>
                  <span className={`publicCircuitStatus ${circuitStatus}`}>{circuitStatus === "closed" ? "Encerrado" : "Em andamento"}</span>
                  <p>{getCircuitDateLabel(item) ? <span><CalendarDays aria-hidden="true" /> {getCircuitDateLabel(item)}</span> : null}<span>{getCircuitTournamentCount(item)} torneio(s)</span></p>
                </div>
                <button type="button" onClick={() => onOpenCircuit(item)} disabled={openingCircuitId === item.id}>
                  {openingCircuitId === item.id ? "Abrindo..." : "Ver circuito"}
                </button>
              </article>
            );
          })}
          {remainingItems > 0 ? (
            <button
              type="button"
              className="publicArenaLoadMore"
              onClick={() => setVisibleLimit((current) => Math.min(current + initialVisibleItems, visibleItems.length))}
            >
              Mostrar mais eventos <span>{remainingItems}</span>
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export function PublicArenaDirectoryView({
  title,
  description,
  search,
  onSearchChange,
  loading,
  error,
  arenas,
  onOpenArena,
  ArenaPhoto,
}) {
  const initialVisibleArenas = 18;
  const [visibleLimit, setVisibleLimit] = React.useState(initialVisibleArenas);

  React.useEffect(() => {
    setVisibleLimit(initialVisibleArenas);
  }, [search]);

  const displayedArenas = arenas.slice(0, visibleLimit);
  const remainingArenas = Math.max(0, arenas.length - displayedArenas.length);

  return (
    <section id="arenas" className="publicArenaDirectorySection">
      <div className="publicDirectoryHeading">
        <span>Aberto para todos</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <label className="publicArenaSearch platformUnifiedSearch">
        <span className="srOnly">Pesquisar arenas</span>
        <Search aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ex.: nome da arena, organizador ou cidade"
        />
      </label>

      {loading ? (
        <div className="publicDirectoryState">Carregando arenas...</div>
      ) : error ? (
        <div className="publicDirectoryState publicDirectoryError">{error}</div>
      ) : arenas.length === 0 ? (
        <div className="publicDirectoryState">Nenhuma arena encontrada.</div>
      ) : (
        <div className="publicArenaDirectoryGrid">
          {displayedArenas.map((arena) => {
            const arenaName = arena.arena_name || arena.name || "Arena Torneio360";
            return (
              <article className="publicArenaDirectoryCard" key={arena.id}>
                <div className="publicArenaDirectoryPhoto">
                  <ArenaPhoto arena={arena} alt={`Foto de ${arenaName}`} />
                </div>
                <div className="publicArenaDirectoryInfo">
                  <small>Perfil da arena</small>
                  <h3>{arenaName}</h3>
                  <p className="publicArenaDirectoryOrganizer"><UserRound aria-hidden="true" /> Organizador: {arena.name || "Não informado"}</p>
                  <p className="publicArenaDirectoryLocation"><MapPin aria-hidden="true" /> {[arena.city, arena.state].filter(Boolean).join("/") || "Local não informado"}</p>
                </div>
                <button type="button" onClick={() => onOpenArena(arena)}>
                  Ver perfil e eventos
                </button>
              </article>
            );
          })}
          {remainingArenas > 0 ? (
            <button
              type="button"
              className="publicArenaLoadMore"
              onClick={() => setVisibleLimit((current) => Math.min(current + initialVisibleArenas, arenas.length))}
            >
              Mostrar mais arenas <span>{remainingArenas}</span>
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function PublicPlatformHomeView({
  hasSession,
  onOrganizerAction,
  ArenaDirectory,
  tagline,
}) {
  return (
    <div className="publicPlatformHome">
      <header className="publicPlatformTopbar">
        <div className="landingBrand">
          <BeachLogo />
          <div className="brandTaglineOnly"><span>{tagline}</span></div>
        </div>
        <div className="publicPlatformActions">
          <a href="#arenas">Explorar arenas</a>
          <button type="button" onClick={onOrganizerAction}>
            {hasSession ? "Painel do organizador" : "Entrar ou criar conta"}
          </button>
        </div>
      </header>

      <main className="publicPlatformMain">
        <section className="publicPlatformHero">
          <div>
            <span className="publicPlatformEyebrow">Torneios ao vivo, sem barreiras</span>
            <h1>Acompanhe sua arena sem fazer login</h1>
            <p>Consulte eventos ativos e encerrados, rodadas, resultados, chaves e rankings diretamente no Torneio360.</p>
            <a href="#arenas" className="publicPlatformHeroButton">Encontrar uma arena</a>
          </div>
          <div className="publicPlatformHeroMark" aria-hidden="true">
            <Trophy />
            <strong>360°</strong>
            <span>Toda a competição em um só lugar</span>
          </div>
        </section>

        <ArenaDirectory />

        <section className="publicOrganizerCallout">
          <div>
            <span>Para organizadores</span>
            <h2>Crie torneios e circuitos com 7 dias grátis</h2>
            <p>A visualização é aberta para todos. A criação e a administração dos eventos ficam disponíveis para assinantes.</p>
          </div>
          <button type="button" onClick={onOrganizerAction}>
            {hasSession ? "Ir para o painel" : "Começar agora"}
          </button>
        </section>

        <section className="publicPlatformSupport">
          <div><span>Atendimento</span><h2>Fale com o Torneio360</h2></div>
          <PlatformSupportLinks />
        </section>
      </main>
    </div>
  );
}
