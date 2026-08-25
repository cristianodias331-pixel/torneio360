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
  X,
  ZoomIn,
} from "lucide-react";
import {
  BeachLogo,
  PlatformSupportLinks,
} from "../appShell/EntryPresentation.jsx";

export function PublicImageLightbox({ image, onClose }) {
  React.useEffect(() => {
    if (!image) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, onClose]);

  if (!image?.src) return null;

  return (
    <div
      className="publicImageLightbox"
      role="dialog"
      aria-modal="true"
      aria-label={image.title || "Visualização ampliada da imagem"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="publicImageLightboxPanel">
        <button type="button" className="publicImageLightboxClose" onClick={onClose} aria-label="Fechar imagem ampliada">
          <X aria-hidden="true" />
        </button>
        <img src={image.src} alt={image.alt || image.title || "Imagem ampliada"} />
        {image.title ? <strong>{image.title}</strong> : null}
      </div>
    </div>
  );
}

function PublicImagePreviewButton({ src, previewSrc, alt, title, variant, onPreview }) {
  if (!src) return null;
  return (
    <button
      type="button"
      className={`publicImagePreviewButton ${variant || "event-cover"}`}
      onClick={() => onPreview?.({ src: previewSrc || src, alt, title })}
      aria-label={`Ampliar ${title || alt || "imagem"}`}
      title="Clique para ampliar"
    >
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      <span className="publicImageZoomBadge" aria-hidden="true"><ZoomIn /></span>
    </button>
  );
}

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
  onPreviewImage,
  onRequestCover,
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

  React.useEffect(() => {
    if (!onRequestCover) return;
    const requestedGroups = new Set();
    (items || []).forEach((tournament) => {
      const details = tournament.data || {};
      const grouped = details.multiCategoryEvent === true && details.eventGroupKey;
      const publicCoverImage = grouped ? details.eventCoverImageUrl : details.coverImageUrl;
      if (publicCoverImage || !tournament.public_id) return;
      const groupKey = grouped
        ? `group:${details.eventGroupKey}`
        : `tournament:${tournament.id}`;
      if (requestedGroups.has(groupKey)) return;
      requestedGroups.add(groupKey);
      onRequestCover(tournament);
    });
  }, [items, onRequestCover]);

  function renderTournamentCard(tournament, {
    grouped = false,
    groupDetails = null,
    groupTitle = "",
  } = {}) {
    const details = tournament.data || {};
    const effectiveGroupDetails = groupDetails || details;
    const eventCoverImage = grouped
      ? effectiveGroupDetails.eventCoverImageUrl || ""
      : details.coverImageUrl || "";
    const eventCoverThumbnail = grouped
      ? effectiveGroupDetails.eventCoverImageThumbnailUrl || ""
      : details.coverImageThumbnailUrl || "";
    const profileCoverImage = organizer.photoUrl || "/torneio360-profile.png";
    const coverImage = eventCoverThumbnail || eventCoverImage || profileCoverImage;
    const coverVariant = eventCoverImage || eventCoverThumbnail ? "event-cover" : "profile-photo";
    const imageTitle = coverVariant === "event-cover"
      ? grouped ? groupTitle : tournament.name
      : organizer.arenaName || "Perfil da arena";
    const registrationOpen = isRegistrationOpen(getRegistrationDeadline(tournament));

    return (
      <article
        className={`card publicArenaEventCard publicArenaEventCardWithCover ${grouped ? "publicArenaGroupedCategoryCard" : ""}`}
        key={tournament.id}
      >
        <div className={`publicArenaEventCover ${coverVariant}`}>
          {coverImage ? (
            <PublicImagePreviewButton
              src={coverImage}
              previewSrc={eventCoverImage || eventCoverThumbnail || profileCoverImage}
              alt={coverVariant === "event-cover" ? `Foto de ${imageTitle}` : `Foto do perfil de ${organizer.arenaName || "arena"}`}
              title={imageTitle}
              variant={coverVariant}
              onPreview={onPreviewImage}
            />
          ) : <span><Trophy aria-hidden="true" /></span>}
        </div>

        <div className="publicArenaEventBody">
          <small>{getModalityName(tournament.type)}</small>
          <h2>{tournament.name}</h2>
          <p>
            {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDate(details.eventDate)}</span> : null}
            {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
          </p>
          <RegistrationStatus open={registrationOpen} whatsapp={organizer.whatsapp} eventName={tournament.name} />
        </div>

        <button type="button" onClick={() => onOpen(tournament)} disabled={openingPublicId === tournament.public_id} aria-busy={openingPublicId === tournament.public_id}>
          {openingPublicId === tournament.public_id ? "Abrindo..." : "Ver torneio"}
        </button>
      </article>
    );
  }

  return groups.map((group) => {
    const first = group.items[0];
    const firstDetails = first.data || {};
    const isGroup = group.items.length > 1 || firstDetails.multiCategoryEvent === true;
    const title = isGroup ? firstDetails.eventName || first.name : first.name;

    if (!isGroup) return renderTournamentCard(first);

    return (
      <section className="publicArenaGroupedEventFrame" key={group.key}>
        <header className="publicArenaGroupedEventHeader">
          <div>
            <small>Evento com categorias agrupadas</small>
            <h2>{title}</h2>
          </div>
          <span>{group.items.length} {group.items.length === 1 ? "categoria" : "categorias"}</span>
        </header>

        <div className="publicArenaGroupedEventItems">
          {sortTournaments(group.items).map((tournament) => renderTournamentCard(tournament, {
            grouped: true,
            groupDetails: firstDetails,
            groupTitle: title,
          }))}
        </div>
      </section>
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
  onRequestTournamentCover,
  onRequestCircuitCover,
  serverPagination = null,
}) {
  const initialVisibleItems = 8;
  const [visibleLimit, setVisibleLimit] = React.useState(initialVisibleItems);
  const [previewImage, setPreviewImage] = React.useState(null);

  React.useEffect(() => {
    setVisibleLimit(initialVisibleItems);
  }, [activeArenaTab, activeStatusTab]);

  const usesServerPagination = Boolean(serverPagination);
  const displayedItems = usesServerPagination ? visibleItems : visibleItems.slice(0, visibleLimit);
  const visibleTotal = activeStatusTab === "finished"
    ? serverPagination?.finishedTotal ?? finishedItems.length
    : serverPagination?.activeTotal ?? activeItems.length;
  const remainingItems = Math.max(0, visibleTotal - displayedItems.length);

  React.useEffect(() => {
    if (activeArenaTab !== "circuits" || !onRequestCircuitCover) return;
    displayedItems.forEach((item) => {
      const coverImage = item.ranking_settings?.coverImageUrl || item.rankingSettings?.coverImageUrl || item.coverImageUrl;
      if (!coverImage) onRequestCircuitCover(item);
    });
  }, [activeArenaTab, displayedItems, onRequestCircuitCover]);

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
          <button type="button" className={activeStatusTab === "active" ? "active" : ""} onClick={() => onStatusTabChange("active")}>Ativos <span>{serverPagination?.activeTotal ?? activeItems.length}</span></button>
          <button type="button" className={activeStatusTab === "finished" ? "active" : ""} onClick={() => onStatusTabChange("finished")}>Encerrados <span>{serverPagination?.finishedTotal ?? finishedItems.length}</span></button>
        </nav>

        <section className="publicArenaEventGrid" aria-live="polite">
          {serverPagination?.loading && displayedItems.length === 0 ? (
            <div className="card publicArenaEmpty">Carregando eventos...</div>
          ) : serverPagination?.error && displayedItems.length === 0 ? (
            <div className="card publicArenaEmpty">{serverPagination.error}</div>
          ) : visibleItems.length === 0 ? (
            <div className="card publicArenaEmpty">Nenhum {activeArenaTab === "tournaments" ? "torneio" : "circuito"} {activeStatusTab === "finished" ? "encerrado" : "ativo"} neste perfil.</div>
          ) : activeArenaTab === "tournaments" ? (
            <TournamentCards items={displayedItems} organizer={organizer} onOpen={onOpenTournament} openingPublicId={openingPublicId} onPreviewImage={setPreviewImage} onRequestCover={onRequestTournamentCover} />
          ) : displayedItems.map((item) => {
            const circuitStatus = getCircuitStatus(item);
            const circuitCoverImage = item.ranking_settings?.coverImageUrl || item.rankingSettings?.coverImageUrl || item.coverImageUrl || "";
            const circuitCoverThumbnail = item.ranking_settings?.coverImageThumbnailUrl
              || item.rankingSettings?.coverImageThumbnailUrl
              || item.coverImageThumbnailUrl
              || "";
            const circuitImage = circuitCoverThumbnail || circuitCoverImage || organizer.photoUrl || "";
            const circuitImageVariant = circuitCoverImage || circuitCoverThumbnail ? "event-cover" : "profile-photo";
            return (
              <article className={`card publicArenaEventCard publicArenaCircuitCard ${circuitImage ? "publicArenaEventCardWithCover" : ""}`} key={item.id}>
                {circuitImage ? (
                  <div className={`publicArenaEventCover ${circuitImageVariant}`}>
                    <PublicImagePreviewButton
                      src={circuitImage}
                      previewSrc={circuitCoverImage || circuitCoverThumbnail || organizer.photoUrl}
                      alt={circuitImageVariant === "event-cover" ? `Foto de ${item.name}` : `Foto do perfil de ${organizer.arenaName || "arena"}`}
                      title={circuitImageVariant === "event-cover" ? item.name : organizer.arenaName || "Perfil da arena"}
                      variant={circuitImageVariant}
                      onPreview={setPreviewImage}
                    />
                  </div>
                ) : <div className="publicArenaEventIcon"><GitBranch aria-hidden="true" /></div>}
                <div>
                  <small>Circuito</small><h2>{item.name}</h2>
                  <span className={`publicCircuitStatus ${circuitStatus}`}>{circuitStatus === "closed" ? "Encerrado" : "Em andamento"}</span>
                  <p>{getCircuitDateLabel(item) ? <span><CalendarDays aria-hidden="true" /> {getCircuitDateLabel(item)}</span> : null}<span>{getCircuitTournamentCount(item)} torneio(s)</span></p>
                </div>
                <button type="button" onClick={() => onOpenCircuit(item)} disabled={openingCircuitId === item.id} aria-busy={openingCircuitId === item.id}>
                  {openingCircuitId === item.id ? "Abrindo..." : "Ver circuito"}
                </button>
              </article>
            );
          })}
          {remainingItems > 0 && (!usesServerPagination || serverPagination.hasMore) ? (
            <button
              type="button"
              className="publicArenaLoadMore"
              onClick={usesServerPagination
                ? serverPagination.onLoadMore
                : () => setVisibleLimit((current) => Math.min(current + initialVisibleItems, visibleItems.length))}
              disabled={serverPagination?.loading === true}
              aria-busy={serverPagination?.loading === true}
            >
              {serverPagination?.loading ? "Carregando mais eventos..." : "Mostrar mais eventos"} <span>{remainingItems}</span>
            </button>
          ) : null}
        </section>
      </main>
      <PublicImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
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
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onOpenArena,
  ArenaPhoto,
}) {
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
          {arenas.map((arena) => {
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
          {hasMore && typeof onLoadMore === "function" ? (
            <button
              type="button"
              className="publicArenaLoadMore"
              onClick={onLoadMore}
              disabled={loadingMore}
              aria-busy={loadingMore}
            >
              {loadingMore ? "Carregando mais arenas..." : "Mostrar mais arenas"}
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
