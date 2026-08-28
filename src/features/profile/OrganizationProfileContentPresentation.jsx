import React, { useMemo, useState } from "react";
import {
  AtSign,
  Building2,
  CalendarDays,
  Clock3,
  Copy,
  CreditCard,
  GitBranch,
  Grid3X3,
  Images,
  Link2,
  MapPin,
  MessageCircle,
  PlusCircle,
  Search,
  Tag,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { formatDateBR } from "../../domain/dateTime.mjs";
import {
  getModalityDisplayName,
  normalizeModalitySearch,
} from "../../domain/modalityCatalog.mjs";
import {
  getTournamentLifecycleStatus,
  getTournamentRegistrationDeadline,
  isRegistrationDeadlineOpen,
} from "../../domain/tournamentLifecycle.mjs";
import {
  getTournamentClassificationLabels,
  getTournamentListGenderFilter,
  matchesTournamentListGenderFilter,
  tournamentListGenderFilters,
} from "../../domain/tournamentGenderConfig.mjs";
import { getBrazilianWhatsAppUrl } from "../../domain/contactLinks.mjs";
import "../../styles/51-unified-profile.css";

function getSafeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeCircuitForProfile(circuit) {
  return {
    ...circuit,
    startDate: circuit?.startDate || circuit?.start_date || "",
    endDate: circuit?.endDate || circuit?.end_date || "",
    tournamentIds: circuit?.tournamentIds || circuit?.tournament_ids || [],
    rankingSettings: circuit?.rankingSettings || circuit?.ranking_settings || {},
  };
}

function getCircuitCover(circuit) {
  const normalized = normalizeCircuitForProfile(circuit);
  return normalized.rankingSettings?.coverImageThumbnailUrl
    || normalized.rankingSettings?.coverImageUrl
    || circuit?.coverImageThumbnailUrl
    || circuit?.coverImageUrl
    || "";
}

export default function OrganizationProfileContentPresentation({
  activeTab,
  profile,
  tournaments = [],
  circuits = [],
  gallery = [],
  canEdit = false,
  canManageEvents = false,
  galleryBusy = false,
  galleryReady = true,
  onCreateTournament,
  onCreateCircuit,
  onOpenTournament,
  onEditTournament,
  onShareTournament,
  onDeleteTournament,
  onRegisterTournament,
  onOpenCircuit,
  onEditCircuit,
  onDeleteCircuit,
  onAddGalleryPhotos,
  onRemoveGalleryPhoto,
  onSaveGallery,
  onEditAbout,
  onCopyPix,
  onPublicationFilterChange,
  onTournamentStatusChange,
}) {
  const [publicationFilter, setPublicationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [genderFilter, setGenderFilter] = useState(tournamentListGenderFilters.all);
  const [search, setSearch] = useState("");

  function selectPublicationFilter(nextFilter) {
    setPublicationFilter(nextFilter);
    onPublicationFilterChange?.(nextFilter);
  }

  function selectStatusFilter(nextFilter) {
    setStatusFilter(nextFilter);
    onTournamentStatusChange?.(nextFilter);
  }

  const lifecycleCounts = useMemo(() => tournaments.reduce((counts, item) => {
    const status = getTournamentLifecycleStatus(item);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 }), [tournaments]);

  const genderCounts = useMemo(() => tournaments.reduce((counts, item) => {
    if (getTournamentLifecycleStatus(item) !== statusFilter) return counts;
    counts[tournamentListGenderFilters.all] += 1;
    const itemGender = getTournamentListGenderFilter(item.type, item.data || {});
    if (itemGender) counts[itemGender] += 1;
    return counts;
  }, {
    [tournamentListGenderFilters.all]: 0,
    [tournamentListGenderFilters.masculine]: 0,
    [tournamentListGenderFilters.feminine]: 0,
    [tournamentListGenderFilters.mixed]: 0,
  }), [statusFilter, tournaments]);

  const visibleTournaments = useMemo(() => {
    const normalizedSearch = normalizeModalitySearch(search);
    return tournaments.filter((item) => {
      if (getTournamentLifecycleStatus(item) !== statusFilter) return false;
      if (!matchesTournamentListGenderFilter(item.type, item.data || {}, genderFilter)) return false;
      if (!normalizedSearch) return true;
      const details = item.data || {};
      return normalizeModalitySearch([
        item.name,
        getModalityDisplayName(item.type),
        details.eventName,
        ...getTournamentClassificationLabels(details),
        details.category,
        details.location,
        details.eventDate,
        details.eventStartTime,
      ].filter(Boolean).join(" ")).includes(normalizedSearch);
    });
  }, [genderFilter, search, statusFilter, tournaments]);

  const visibleCircuits = circuits;

  if (activeTab === "fotos") {
    return (
      <div className="profileSubtabPanel profilePhotosPanel organizationRealPhotosPanel">
        <section className="unifiedMemberGalleryEditor organizationGalleryEditor organizationProfilePhotos" aria-labelledby="organization-gallery-profile-title">
          <header>
            <div>
              <span><Building2 aria-hidden="true" /></span>
              <div>
                <h3 id="organization-gallery-profile-title">Fotos da organização</h3>
                <p>Até seis fotos institucionais escolhidas para esta galeria. A capa do perfil é separada.</p>
              </div>
            </div>
            <strong>{gallery.length}/6</strong>
          </header>

          {gallery.length > 0 ? (
            <div className="unifiedMemberGalleryGrid">
              {gallery.map((photoUrl, index) => (
                <figure key={`${photoUrl}-${index}`}>
                  <img src={photoUrl} alt={`Foto ${index + 1} da organização`} />
                  {canEdit ? <button type="button" className="removeOrganizationGalleryPhoto" onClick={() => onRemoveGalleryPhoto?.(index)} disabled={galleryBusy}>Remover</button> : null}
                </figure>
              ))}
              {canEdit && gallery.length < 6 ? (
                <label className="unifiedMemberGalleryAdd">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={galleryBusy || !galleryReady}
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      if (files.length) onAddGalleryPhotos?.(files);
                      event.target.value = "";
                    }}
                  />
                  <PlusCircle aria-hidden="true" />
                  <strong>Adicionar fotos</strong>
                  <small>Restam {6 - gallery.length}</small>
                </label>
              ) : null}
            </div>
          ) : (
            <div className="profileEmptyPost">Esta organização ainda não adicionou fotos à galeria.</div>
          )}

          {canEdit ? (
            <div className="profilePhotosActions">
              <button type="button" className="saveProfileBtn actionConfirmBtn" onClick={onSaveGallery} disabled={galleryBusy || !galleryReady} aria-busy={galleryBusy}>
                {galleryBusy ? "Salvando fotos..." : "Salvar fotos da organização"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (activeTab === "contato") {
    const mapsUrl = getSafeHttpUrl(profile.mapsLink);
    const instagramUrl = getSafeHttpUrl(profile.instagramLink);
    const whatsappGroupUrl = getSafeHttpUrl(profile.whatsappGroupLink);
    const cardPaymentUrl = getSafeHttpUrl(profile.cardPaymentLink);
    return (
      <section className="organizationAboutOverview organizationRealAboutPanel profileSubtabPanel">
        <header>
          <div>
            <span>Sobre a organização</span>
            <h2>{profile.arenaName || "Minha organização"}</h2>
            <p>Dados públicos usados por atletas e visitantes para conhecer e contatar a organização.</p>
          </div>
          {canEdit ? <button type="button" className="secondaryBtn" onClick={onEditAbout}><UserRound aria-hidden="true" /> Editar informações</button> : null}
        </header>
        <div className="organizationAboutGrid">
          <article><UserRound aria-hidden="true" /><span><small>Responsável</small><strong>{profile.organizerName || "Não informado"}</strong></span></article>
          <article><MapPin aria-hidden="true" /><span><small>Endereço</small><strong>{[profile.city, profile.state].filter(Boolean).join("/") || "Não informado"}</strong><em>{profile.address || "Endereço não informado"}</em>{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer"><Link2 aria-hidden="true" /> Abrir no mapa</a> : null}</span></article>
          <article><MessageCircle aria-hidden="true" /><span><small>WhatsApp</small>{profile.whatsapp ? <a href={getBrazilianWhatsAppUrl(profile.whatsapp)} target="_blank" rel="noreferrer"><strong>{profile.whatsapp}</strong></a> : <strong>Não informado</strong>}</span></article>
          <article><AtSign aria-hidden="true" /><span><small>Instagram</small>{instagramUrl ? <a href={instagramUrl} target="_blank" rel="noreferrer"><strong>{profile.instagramHandle || "Abrir Instagram"}</strong></a> : <strong>{profile.instagramHandle || "Não informado"}</strong>}</span></article>
          <article><Users aria-hidden="true" /><span><small>Grupo da organização</small>{whatsappGroupUrl ? <a href={whatsappGroupUrl} target="_blank" rel="noreferrer"><strong>Entrar no grupo do WhatsApp</strong></a> : <strong>Link não informado</strong>}</span></article>
          <article><Copy aria-hidden="true" /><span><small>Chave Pix pública</small><strong>{profile.pixKey || "Não informada"}</strong>{profile.pixKey ? <button type="button" className="organizationCopyValue" onClick={() => {
            if (onCopyPix) onCopyPix(profile.pixKey);
            else navigator.clipboard?.writeText(profile.pixKey);
          }}><Copy aria-hidden="true" /> Copiar chave</button> : null}</span></article>
          <article><CreditCard aria-hidden="true" /><span><small>Pagamento com cartão</small>{cardPaymentUrl ? <a href={cardPaymentUrl} target="_blank" rel="noreferrer"><strong>Abrir link seguro de pagamento</strong></a> : <strong>Link não informado</strong>}</span></article>
        </div>
        <aside className="organizationPublicPaymentNotice">
          <CreditCard aria-hidden="true" />
          <span><strong>Recebimentos visíveis no perfil</strong><small>Pix e link de cartão podem ser usados pelos atletas. Para evitar expor CPF ou telefone, prefira uma chave Pix aleatória ou empresarial.</small></span>
        </aside>
      </section>
    );
  }

  if (activeTab !== "publicacoes") return null;

  return (
    <div className="profileSubtabPanel organizationRealPublications">
      <div className="profilePublicationsHeader">
        <div><strong>Publicações</strong><span>{tournaments.length} campeonato(s) criado(s)</span></div>
        {canManageEvents ? (
          <div className="profilePublicationCreateActions">
            <button type="button" onClick={onCreateTournament}><PlusCircle aria-hidden="true" /> Criar torneio</button>
            <button type="button" onClick={onCreateCircuit}><GitBranch aria-hidden="true" /> Criar circuito</button>
          </div>
        ) : null}
      </div>

      <nav className="profilePublicationFilters" aria-label="Filtrar publicações" role="tablist">
        <button type="button" role="tab" aria-selected={publicationFilter === "all"} className={publicationFilter === "all" ? "active" : ""} onClick={() => selectPublicationFilter("all")}>Tudo <span>{tournaments.length + circuits.length}</span></button>
        <button type="button" role="tab" aria-selected={publicationFilter === "tournaments"} className={publicationFilter === "tournaments" ? "active" : ""} onClick={() => selectPublicationFilter("tournaments")}>Torneios <span>{tournaments.length}</span></button>
        <button type="button" role="tab" aria-selected={publicationFilter === "circuits"} className={publicationFilter === "circuits" ? "active" : ""} onClick={() => selectPublicationFilter("circuits")}>Circuitos <span>{circuits.length}</span></button>
      </nav>

      {publicationFilter !== "circuits" ? (
        <>
          <div className="tournamentStatusSummary eventListToolbar profileTournamentToolbar" aria-label="Filtrar torneios do perfil por situação">
            <button type="button" className={`active ${statusFilter === "active" ? "selected" : ""}`} aria-pressed={statusFilter === "active"} onClick={() => selectStatusFilter("active")}><strong>{lifecycleCounts.active}</strong> Em andamento</button>
            <button type="button" className={`upcoming ${statusFilter === "upcoming" ? "selected" : ""}`} aria-pressed={statusFilter === "upcoming"} onClick={() => selectStatusFilter("upcoming")}><strong>{lifecycleCounts.upcoming}</strong> Próximos</button>
            <button type="button" className={`finished ${statusFilter === "finished" ? "selected" : ""}`} aria-pressed={statusFilter === "finished"} onClick={() => selectStatusFilter("finished")}><strong>{lifecycleCounts.finished}</strong> Encerrados</button>
            <label className="eventListSearch platformUnifiedSearch">
              <Search aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Pesquisar torneios no perfil da organização" placeholder="Ex.: nome, modalidade, categoria ou local" />
              {search ? <button type="button" aria-label="Limpar pesquisa de torneios do perfil" onClick={() => setSearch("")}><X aria-hidden="true" /></button> : null}
            </label>
          </div>
          <div className="tournamentGenderSubtabs profileTournamentGenderFilters" aria-label="Filtrar torneios do perfil por gênero">
            <span className="tournamentGenderSubtabsLabel">Gênero</span>
            {[
              { value: tournamentListGenderFilters.all, label: "Todos" },
              { value: tournamentListGenderFilters.masculine, label: "Masculino" },
              { value: tournamentListGenderFilters.feminine, label: "Feminino" },
              { value: tournamentListGenderFilters.mixed, label: "Misto/Livre" },
            ].map((option) => (
              <button type="button" key={option.value} className={genderFilter === option.value ? "selected" : ""} aria-pressed={genderFilter === option.value} onClick={() => setGenderFilter(option.value)}>
                {option.label} <strong>{genderCounts[option.value]}</strong>
              </button>
            ))}
          </div>

          <div className="profileTournamentGrid">
            {visibleTournaments.length === 0 ? <div className="profileEmptyPost">Nenhum torneio corresponde aos filtros selecionados.</div> : visibleTournaments.map((tournament) => {
              const details = tournament.data || {};
              const registrationOpen = isRegistrationDeadlineOpen(getTournamentRegistrationDeadline(tournament));
              return (
                <article className="profileTournamentPost tournamentItem" key={tournament.id}>
                  {details.coverImageThumbnailUrl || details.coverImageUrl ? <img className="profileTournamentCover" src={details.coverImageThumbnailUrl || details.coverImageUrl} alt={`Foto de ${tournament.name}`} /> : null}
                  <div className="tournamentInfo">
                    <div className="tournamentTitleRow"><strong>{tournament.name}</strong><span className="tournamentTypeBadge">{getModalityDisplayName(tournament.type)}</span></div>
                    <div className="tournamentMeta">
                      {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                      {getTournamentClassificationLabels(details).map((label) => <span key={label}><Tag aria-hidden="true" /> {label}</span>)}
                      {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                      {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                      {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
                    </div>
                    {!canManageEvents ? <span className={`organizationProfileRegistrationBadge ${registrationOpen ? "open" : "closed"}`}>{registrationOpen ? "Inscrições abertas" : "Inscrições encerradas"}</span> : null}
                  </div>
                  <div className="tournamentActions">
                    {canManageEvents ? <button type="button" className="editBtn" onClick={() => onEditTournament?.(tournament)}>Editar</button> : null}
                    <button type="button" className="actionOpenBtn" onClick={() => onOpenTournament?.(tournament)}>{canManageEvents ? "Abrir" : "Ver torneio"}</button>
                    {canManageEvents ? <button type="button" className="shareTournamentBtn" onClick={() => onShareTournament?.(tournament)}>Compartilhar</button> : null}
                    {canManageEvents ? <button type="button" className="deleteBtn" onClick={() => onDeleteTournament?.(tournament)}>Excluir</button> : null}
                    {!canManageEvents && registrationOpen && onRegisterTournament ? <button type="button" className="organizationProfileRegisterBtn" onClick={() => onRegisterTournament(tournament)}>Inscrever-se</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {publicationFilter !== "tournaments" ? (
        <>
          <div className="profilePublicationsHeader profileCircuitsHeading"><strong>Circuitos</strong><span>{circuits.length} circuito(s) publicado(s)</span></div>
          <div className="profileCircuitPublicationGrid">
            {visibleCircuits.length === 0 ? <div className="profileEmptyPost">Nenhum circuito corresponde aos filtros selecionados.</div> : visibleCircuits.map((circuit) => {
              const normalized = normalizeCircuitForProfile(circuit);
              const cover = getCircuitCover(circuit);
              return (
                <article className="profileCircuitPublication" key={circuit.id}>
                  <span className={`profileCircuitPublicationIcon${cover ? " hasCover" : ""}`}>{cover ? <img src={cover} alt="" /> : <GitBranch aria-hidden="true" />}</span>
                  <div><strong>{circuit.name}</strong><small>{normalized.tournamentIds.length} torneio(s){normalized.startDate ? ` · ${formatDateBR(normalized.startDate)}` : ""}</small></div>
                  <div className="profileCircuitPublicationActions">
                    {canManageEvents && onEditCircuit ? <button type="button" onClick={() => onEditCircuit(circuit)}>Editar</button> : null}
                    <button type="button" onClick={() => onOpenCircuit?.(circuit)}>{canManageEvents ? "Abrir" : "Ver circuito"}</button>
                    {canManageEvents && onDeleteCircuit ? <button type="button" className="delete" onClick={() => onDeleteCircuit(circuit)}>Excluir</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
