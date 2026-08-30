import React from "react";
import { createPortal } from "react-dom";
import {
  AtSign,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
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
import { BeachLogo } from "../appShell/EntryPresentation.jsx";
import UnifiedPlatformFrame from "../appShell/UnifiedPlatformFrame.jsx";
import OrganizationProfilePresentation from "../profile/OrganizationProfilePresentation.jsx";
import OrganizationProfileContentPresentation from "../profile/OrganizationProfileContentPresentation.jsx";

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

  return createPortal((
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
  ), document.body);
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

export function PublicRegistrationStatusView({ open, whatsapp, eventName, getWhatsAppUrl, hasSession = false, onRequireLogin }) {
  if (!open) {
    return <span className="publicRegistrationStatus closed">Inscrições encerradas</span>;
  }

  const message = `Olá! Quero me inscrever em ${eventName || "um evento"} pelo Torneio360.`;
  const whatsappUrl = getWhatsAppUrl(whatsapp, message);

  if (!hasSession) {
    return (
      <button type="button" className="publicRegistrationStatus open" onClick={onRequireLogin}>
        <MessageCircle aria-hidden="true" /> Inscreva-se
      </button>
    );
  }

  if (!whatsappUrl) {
    return <span className="publicRegistrationStatus open unavailable" title="WhatsApp não cadastrado pela organização">Inscreva-se</span>;
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
  label = "Perfil oficial da organização",
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
        <button type="button" className="publicBackToPlatform" onClick={onBack}>← Voltar à visão geral</button>
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
  hasSession = false,
  onRequireLogin,
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
      : organizer.arenaName || "Perfil da organização";
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
              alt={coverVariant === "event-cover" ? `Foto de ${imageTitle}` : `Foto do perfil de ${organizer.arenaName || "organização"}`}
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
          <RegistrationStatus open={registrationOpen} whatsapp={organizer.whatsapp} eventName={tournament.name} hasSession={hasSession} onRequireLogin={onRequireLogin} />
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
  organizationGallery = [],
  tournaments = [],
  circuits = [],
  profileCounts = { tournaments: 0, circuits: 0 },
  profilePagination = null,
  hasSession = false,
  onRequireLogin,
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
  embedded = false,
}) {
  const initialVisibleItems = 8;
  const [visibleLimit, setVisibleLimit] = React.useState(initialVisibleItems);
  const [previewImage, setPreviewImage] = React.useState(null);
  const [activeProfileTab, setActiveProfileTab] = React.useState("publicacoes");

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
    <div className={`publicPage publicArenaPage ${pageClassName} ${embedded ? "embeddedPublicOrganizationProfile" : ""}`.trim()}>
      <main className="publicContent publicArenaContent">
        <section className="card instagramProfileCard socialOwnProfileCard publicOrganizationRealProfile">
          <OrganizationProfilePresentation
            profile={organizer}
            canEdit={false}
            canManageRegistrants={false}
            activeTab={activeProfileTab}
            onTabChange={setActiveProfileTab}
            galleryCount={organizationGallery.length}
            tournamentCount={profileCounts.tournaments}
            circuitCount={profileCounts.circuits}
          />

          <OrganizationProfileContentPresentation
            activeTab={activeProfileTab}
            profile={organizer}
            tournaments={tournaments}
            circuits={circuits}
            gallery={organizationGallery}
            publicationCounts={profileCounts}
            lifecycleCountsOverride={profilePagination ? { active: profilePagination.activeTournamentTotal, finished: profilePagination.finishedTournamentTotal } : null}
            circuitLifecycleCountsOverride={profilePagination ? { active: profilePagination.activeCircuitTotal, finished: profilePagination.finishedCircuitTotal } : null}
            combineActiveAndUpcoming={Boolean(profilePagination)}
            tournamentPageLoading={profilePagination?.tournamentLoading === true}
            tournamentHasMore={profilePagination?.tournamentHasMore === true}
            circuitPageLoading={profilePagination?.circuitLoading === true}
            circuitHasMore={profilePagination?.circuitHasMore === true}
            onOpenTournament={onOpenTournament}
            onRegisterTournament={(tournament) => onOpenTournament?.(tournament, { initialTab: "inscricao" })}
            onOpenCircuit={onOpenCircuit}
            onPublicationFilterChange={(filter) => {
              onArenaTabChange?.(filter === "circuits" ? "circuits" : "tournaments");
              onStatusTabChange?.("active");
            }}
            onTournamentStatusChange={(status) => {
              onArenaTabChange?.("tournaments");
              onStatusTabChange?.(status === "finished" ? "finished" : "active");
            }}
            onCircuitStatusChange={(status) => {
              onArenaTabChange?.("circuits");
              onStatusTabChange?.(status === "finished" ? "finished" : "active");
            }}
            onLoadMoreTournaments={profilePagination?.onLoadMoreTournaments}
            onLoadMoreCircuits={profilePagination?.onLoadMoreCircuits}
          />

        {/* Legacy simplified public profile retained temporarily while the canonical shared view is validated.
        {activeProfileTab === "contato" ? (
        <section className="publicArenaContacts organizationAboutOverview publicOrganizationAboutOverview">
          <header>
            <div>
              <span>Sobre a organização</span>
              <h2>{arenaName}</h2>
              <p>{contactDescription}</p>
            </div>
          </header>
          <div className="organizationAboutGrid">
            <article><UserRound aria-hidden="true" /><span><small>Responsável</small><strong>{organizer.organizerName || "Não informado"}</strong></span></article>
            <article><MapPin aria-hidden="true" /><span><small>Endereço</small><strong>{[organizer.city, organizer.state].filter(Boolean).join("/") || "Não informado"}</strong><em>{organizer.address || "Endereço não informado"}</em>{organizer.mapsLink ? <a href={organizer.mapsLink} target="_blank" rel="noreferrer">Abrir no mapa</a> : null}</span></article>
            <article><MessageCircle aria-hidden="true" /><span><small>WhatsApp</small>{organizer.whatsapp ? <a href={getWhatsAppUrl(organizer.whatsapp)} target="_blank" rel="noreferrer"><strong>{organizer.whatsapp}</strong></a> : <strong>Não informado</strong>}</span></article>
            <article><AtSign aria-hidden="true" /><span><small>Instagram</small>{organizer.instagramLink ? <a href={organizer.instagramLink} target="_blank" rel="noreferrer"><strong>{organizer.instagramHandle || "Abrir Instagram"}</strong></a> : <strong>{organizer.instagramHandle || "Não informado"}</strong>}</span></article>
            <article><Users aria-hidden="true" /><span><small>Grupo da organização</small>{organizer.whatsappGroupLink ? <a href={organizer.whatsappGroupLink} target="_blank" rel="noreferrer"><strong>Entrar no grupo do WhatsApp</strong></a> : <strong>Link não informado</strong>}</span></article>
            <article><CreditCard aria-hidden="true" /><span><small>Chave Pix pública</small><strong>{organizer.pixKey || "Não informada"}</strong></span></article>
            <article><CreditCard aria-hidden="true" /><span><small>Pagamento com cartão</small>{organizer.cardPaymentLink ? <a href={organizer.cardPaymentLink} target="_blank" rel="noreferrer"><strong>Abrir link seguro de pagamento</strong></a> : <strong>Link não informado</strong>}</span></article>
          </div>
        </section>
        ) : null}

        {activeProfileTab === "fotos" ? (
          <section className="publicOrganizationGallerySection profileSubtabPanel profilePhotosPanel">
            <header><div><h2>Fotos da organização</h2><p>Galeria institucional do perfil.</p></div><span>{organizationGallery.length}/6</span></header>
            {organizationGallery.length > 0 ? <div className="publicOrganizationGalleryGrid">
              {organizationGallery.map((photoUrl, index) => (
                <button
                  type="button"
                  key={`${photoUrl}-${index}`}
                  onClick={() => setPreviewImage({ src: photoUrl, alt: `Foto ${index + 1} de ${arenaName}`, title: arenaName })}
                  aria-label={`Ampliar foto ${index + 1} da organização`}
                >
                  <img src={photoUrl} alt={`Foto ${index + 1} de ${arenaName}`} loading="lazy" decoding="async" />
                  <span><ZoomIn aria-hidden="true" /></span>
                </button>
              ))}
            </div> : <div className="profileEmptyPost">Esta organização ainda não adicionou fotos à galeria.</div>}
          </section>
        ) : null}

        {activeProfileTab === "publicacoes" ? <>
        <div className="profilePublicationsHeader publicProfilePublicationsHeader">
          <div><strong>Publicações</strong><span>Torneios e circuitos publicados pela organização</span></div>
        </div>
        <nav className="publicArenaTabs" aria-label="Conteúdo público da organização">
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
            <TournamentCards items={displayedItems} organizer={organizer} onOpen={onOpenTournament} openingPublicId={openingPublicId} onPreviewImage={setPreviewImage} onRequestCover={onRequestTournamentCover} hasSession={hasSession} onRequireLogin={onRequireLogin} />
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
                      alt={circuitImageVariant === "event-cover" ? `Foto de ${item.name}` : `Foto do perfil de ${organizer.arenaName || "organização"}`}
                      title={circuitImageVariant === "event-cover" ? item.name : organizer.arenaName || "Perfil da organização"}
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
        </> : null} */}
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
    <section id="organizacoes" className="publicArenaDirectorySection publicOrganizationDirectorySection">
      <div className="publicDirectoryHeading">
        <span>Aberto para todos</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <label className="publicArenaSearch platformUnifiedSearch">
        <span className="srOnly">Pesquisar organizações</span>
        <Search aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ex.: organização, responsável ou cidade"
        />
      </label>

      {loading ? (
        <div className="publicDirectoryState">Carregando organizações...</div>
      ) : error ? (
        <div className="publicDirectoryState publicDirectoryError">{error}</div>
      ) : arenas.length === 0 ? (
        <div className="publicDirectoryState">Nenhuma organização encontrada.</div>
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
                  <small>Perfil da organização</small>
                  <h3>{arenaName}</h3>
                  <p className="publicArenaDirectoryOrganizer"><UserRound aria-hidden="true" /> Responsável: {arena.name || "Não informado"}</p>
                  <p className="publicArenaDirectoryLocation"><MapPin aria-hidden="true" /> {[arena.city, arena.state].filter(Boolean).join("/") || "Local não informado"}</p>
                </div>
                <button type="button" onClick={() => onOpenArena(arena)}>
                  Ver organização e eventos
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
              {loadingMore ? "Carregando mais organizações..." : "Mostrar mais organizações"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function getDirectoryInitials(name) {
  return String(name || "T3")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("") || "T3";
}

export function PublicMemberDirectoryView({
  members,
  search,
  loading,
  loadingMore,
  error,
  hasMore,
  onSearchChange,
  onLoadMore,
  onOpenMember,
}) {
  return (
    <section id="perfis" className="publicMemberDirectorySection">
      <div className="publicDirectoryHeading">
        <span>Comunidade esportiva</span>
        <h2>Atletas</h2>
        <p>Encontre perfis esportivos públicos. As fotos pessoais aparecem somente dentro de cada perfil.</p>
      </div>

      <label className="publicArenaSearch platformUnifiedSearch">
        <span className="srOnly">Pesquisar atletas</span>
        <Search aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ex.: nome, usuário, cidade ou estado"
        />
      </label>

      {loading ? <div className="publicDirectoryState">Carregando atletas...</div>
        : error ? <div className="publicDirectoryState publicDirectoryError">{error}</div>
          : members.length === 0 ? <div className="publicDirectoryState">Nenhum atleta encontrado.</div>
            : (
              <div className="publicMemberDirectoryGrid">
                {members.map((member) => (
                  <button
                    type="button"
                    className="publicMemberDirectoryCard"
                    key={member.user_id}
                    onClick={() => onOpenMember(member)}
                  >
                    <span className="publicMemberDirectoryAvatar">
                      {member.photo_url
                        ? <img src={member.photo_url} alt="" loading="lazy" decoding="async" />
                        : getDirectoryInitials(member.display_name)}
                    </span>
                    <span className="publicMemberDirectoryCopy">
                      <strong>{member.display_name}</strong>
                      <small>{member.handle ? `@${member.handle}` : "Perfil Torneio360"}</small>
                      {[member.city, member.state].filter(Boolean).length > 0
                        ? <span><MapPin aria-hidden="true" /> {[member.city, member.state].filter(Boolean).join("/")}</span>
                        : null}
                    </span>
                    <span className="publicMemberDirectoryMeta">{Number(member.gallery_count) || 0} fotos</span>
                  </button>
                ))}
                {hasMore ? (
                  <button type="button" className="publicArenaLoadMore" onClick={onLoadMore} disabled={loadingMore} aria-busy={loadingMore}>
                    {loadingMore ? "Carregando mais atletas..." : "Mostrar mais atletas"}
                  </button>
                ) : null}
              </div>
            )}
    </section>
  );
}

export function PublicTournamentFeedView({
  embedded = false,
  variant = "feed",
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  formatDate,
  getModalityName,
  getRegistrationDeadline,
  isRegistrationOpen,
  getWhatsAppUrl,
  onLoadMore,
  onOpenTournament,
  onOpenOrganization,
  onRegister,
}) {
  const [previewImage, setPreviewImage] = React.useState(null);
  const [discoverySearch, setDiscoverySearch] = React.useState("");
  const discoveryMode = variant === "discovery";
  const normalizedDiscoverySearch = discoverySearch.trim().toLocaleLowerCase("pt-BR");
  const visibleItems = discoveryMode && normalizedDiscoverySearch
    ? items.filter((item) => {
      const details = item.data || {};
      const organization = item.organization || {};
      return [
        item.name,
        details.eventName,
        details.location,
        details.category,
        organization.name,
        organization.city,
        organization.state,
        getModalityName(item.type),
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalizedDiscoverySearch);
    })
    : items;

  return (
    <section id="visao-geral" className={`publicTournamentFeedSection ${embedded ? "embeddedTournamentFeed" : ""} ${discoveryMode ? "publicTournamentDiscovery" : ""}`.trim()}>
      <div className="publicDirectoryHeading publicFeedHeading">
        <span>{discoveryMode ? "Catálogo" : embedded ? "Publicações" : "Visão geral"}</span>
        <h2>{discoveryMode ? "Encontre um torneio" : "Torneios publicados"}</h2>
        <p>{discoveryMode
          ? "Pesquise por nome, modalidade, categoria, local ou organização."
          : "Acompanhe as publicações das organizações e abra cada evento para ver informações, jogos, ranking e inscrição."}</p>
      </div>

      {discoveryMode ? (
        <label className="publicTournamentDiscoverySearch platformUnifiedSearch">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={discoverySearch}
            onChange={(event) => setDiscoverySearch(event.target.value)}
            placeholder="Buscar torneio, organização, modalidade ou cidade"
            aria-label="Buscar torneios"
          />
        </label>
      ) : null}

      {loading ? <div className="publicDirectoryState">Carregando publicações...</div>
        : error && items.length === 0 ? <div className="publicDirectoryState publicDirectoryError">{error}</div>
          : items.length === 0 ? <div className="publicDirectoryState">Ainda não há torneios publicados.</div>
            : (
              <div className="publicTournamentFeed">
                {visibleItems.length === 0 ? <div className="publicDirectoryState">Nenhum torneio corresponde à sua busca.</div> : null}
                {visibleItems.map((item) => {
                  const details = item.data || {};
                  const organization = item.organization || {};
                  const eventName = details.eventName || item.name;
                  const coverImage = details.eventCoverImageThumbnailUrl
                    || details.coverImageThumbnailUrl
                    || details.coverImageUrl
                    || "";
                  const registrationOpen = isRegistrationOpen(getRegistrationDeadline(item));
                  const registrationDeadline = getRegistrationDeadline(item);
                  const registrationUrl = registrationOpen
                    ? getWhatsAppUrl(organization.phone, `Olá! Quero me inscrever em ${eventName} pelo Torneio360.`)
                    : "";
                  return (
                    <article className="publicTournamentPost" key={item.id}>
                      <header>
                        <button type="button" className="publicTournamentPostOrganization" onClick={() => onOpenOrganization?.(organization)}>
                          <span>{organization.photo_url
                            ? <img src={organization.photo_url} alt="" loading="lazy" decoding="async" />
                            : getDirectoryInitials(organization.name)}</span>
                          <span><strong>{organization.name}</strong><small>{[organization.city, organization.state].filter(Boolean).join("/") || "Organização Torneio360"}</small></span>
                        </button>
                      </header>

                      {coverImage ? (
                        <button
                          type="button"
                          className="publicTournamentPostImage"
                          onClick={() => setPreviewImage({ src: details.coverImageUrl || coverImage, alt: `Foto de ${eventName}`, title: eventName })}
                          aria-label={`Ampliar foto de ${eventName}`}
                        >
                          <img src={coverImage} alt={`Foto de ${eventName}`} loading="lazy" decoding="async" />
                          <span><ZoomIn aria-hidden="true" /></span>
                        </button>
                      ) : (
                        <div className="publicTournamentPostFallback"><Trophy aria-hidden="true" /><span>Evento publicado</span></div>
                      )}

                      <div className="publicTournamentPostBody">
                        <small>{getModalityName(item.type)}</small>
                        <h3>{eventName}</h3>
                        <p>
                          {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDate(details.eventDate)}</span> : null}
                          {details.eventStartTime ? <span>Início {details.eventStartTime}</span> : null}
                          {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                          {details.category ? <span>{details.category}</span> : null}
                        </p>
                        <div className="publicTournamentPostStatusRow">
                          <span className={registrationOpen ? "open" : "closed"}>{registrationOpen ? "Inscrições abertas" : "Inscrições encerradas"}</span>
                          {registrationOpen && registrationDeadline ? <small>Até {formatDate(registrationDeadline)}</small> : null}
                        </div>
                        <div className="publicTournamentPostActions">
                          <button type="button" onClick={() => onOpenTournament(item)}>Ver torneio</button>
                          {registrationOpen
                            ? <button type="button" className="publicTournamentRegisterButton" onClick={() => onRegister(registrationUrl, item)}><ClipboardCheck aria-hidden="true" /> Inscrever-se</button>
                            : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {error ? <div className="publicDirectoryState publicDirectoryError">{error}</div> : null}
                {hasMore ? (
                  <button type="button" className="publicArenaLoadMore" onClick={onLoadMore} disabled={loadingMore} aria-busy={loadingMore}>
                    {loadingMore ? "Carregando mais publicações..." : "Mostrar mais torneios"}
                  </button>
                ) : null}
              </div>
            )}
      <PublicImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </section>
  );
}

export function PublicPlatformHomeView({
  activePanel = "overview",
  hasSession,
  onAccountAction,
  onAthleteSignup,
  onNavigate,
  TournamentFeed,
  Explore,
  GlobalSearch,
  tagline,
}) {
  const exploring = activePanel === "explore";
  return (
    <UnifiedPlatformFrame
      activePanel={activePanel}
      hasSession={hasSession}
      tagline={tagline}
      eyebrow="Conteúdo público"
      title={exploring ? "Explorar" : "Início"}
      description={exploring
        ? "Descubra torneios, organizações e atletas dentro da mesma plataforma."
        : "Veja as publicações mais recentes. Para se inscrever ou criar um perfil, entre na plataforma."}
      onNavigate={onNavigate}
      onSignup={onAthleteSignup}
      onAccountAction={onAccountAction}
    >
      {exploring ? <Explore /> : <><GlobalSearch /> <TournamentFeed /></>}
    </UnifiedPlatformFrame>
  );
}
