import React, { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Award,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  CreditCard,
  Flag,
  GitBranch,
  History,
  ImagePlus,
  Images,
  MapPin,
  Medal,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  Trash2,
  UserRound,
  Users,
  UsersRound,
  X,
  ZoomIn,
} from "lucide-react";
import {
  MAX_MEMBER_GALLERY_PHOTOS,
  MEMBER_SPORT_OPTIONS,
  createMemberProfileFallback,
  normalizeMemberHandle,
  validateMemberProfile,
} from "../../domain/memberProfile.mjs";
import {
  BRAZILIAN_STATES,
  loadBrazilianCities,
  normalizeBrazilianState,
} from "../../domain/brazilLocations.mjs";
import { excludeOrganizationCoverFromGallery } from "../media/organizationGalleryCover.mjs";
import {
  uploadMemberProfileCover,
  uploadMemberProfileGalleryPhoto,
  uploadMemberProfilePhoto,
  uploadOrganizationProfileCover,
  uploadOrganizationProfileGalleryPhoto,
  uploadProfilePhoto,
} from "../../services/mediaStorage.mjs";
import { loadMyMemberProfile, saveMyMemberProfile } from "../../services/memberProfileApi.mjs";
import {
  loadMyOrganizationGallery,
  saveMyOrganizationGallery,
  searchPublicPlatform,
} from "../../services/publicSocialApi.mjs";
import {
  loadMyOrganizationCover,
  saveMyOrganizationCover,
} from "../../services/organizationCoverApi.mjs";
import {
  getSafePaymentLink,
  loadMyOrganizationPaymentSettings,
  saveMyOrganizationPaymentSettings,
} from "../../services/organizationPaymentApi.mjs";
import { createAthleteChallenge, respondAthleteChallenge } from "../../services/athleteActivityApi.mjs";
import ProfileImageEditor from "../profile/ProfileImageEditor.jsx";
import styles from "./PlatformV2App.module.css";

function getInitials(value, fallback = "T3") {
  const initials = String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("");
  return initials || fallback;
}

function normalizeOrganization(profile) {
  return {
    name: profile?.arena_name || profile?.name || "Minha organização",
    organizerName: profile?.name || "",
    photoUrl: profile?.photo_url || profile?.avatar_url || "",
    coverUrl: profile?.cover_url || "",
    city: profile?.city || "",
    state: profile?.state || "",
    bio: profile?.description || profile?.bio || "Organização esportiva no Torneio 360.",
    handle: profile?.instagram_handle || profile?.instagram || "",
    whatsapp: profile?.phone || "",
    instagramLink: profile?.instagram_link || "",
    whatsappGroupLink: profile?.whatsapp_group_link || "",
    address: profile?.address || "",
    mapsLink: profile?.maps_link || "",
    pixKey: profile?.pix_key || "",
    cardPaymentLink: profile?.card_payment_link || "",
  };
}

function normalizeOptionalWebLink(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  return getSafePaymentLink(source);
}

function isForeignLocation(state) {
  return Boolean(String(state || "").trim() && !normalizeBrazilianState(state));
}

function EditorSection({ Icon, title, description, children }) {
  return (
    <section className={styles.profileEditorSection}>
      <header>
        <span><Icon aria-hidden="true" /></span>
        <div><h3>{title}</h3><p>{description}</p></div>
      </header>
      <div className={styles.profileFormGrid}>{children}</div>
    </section>
  );
}

function FieldError({ message }) {
  return message ? <small className={styles.profileFieldError}>{message}</small> : null;
}

function LocationEditor({ draft, errors = {}, cityOptions, citiesLoading, citiesError, onChange }) {
  const foreignLocation = Boolean(draft.foreignLocation);
  const stateCode = normalizeBrazilianState(draft.state);
  const availableCities = draft.city && !cityOptions.includes(draft.city)
    ? [draft.city, ...cityOptions]
    : cityOptions;

  return (
    <>
      <label className={foreignLocation ? styles.profileLocationDisabled : ""}>
        <span>Estado</span>
        <select disabled={foreignLocation} value={foreignLocation ? "" : stateCode} onChange={(event) => { onChange("state", event.target.value); onChange("city", ""); }}>
          <option value="">{foreignLocation ? "Desativado para local no exterior" : "Selecione o estado"}</option>
          {BRAZILIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}
        </select>
        {!foreignLocation ? <FieldError message={errors.state} /> : null}
      </label>
      <label className={foreignLocation ? styles.profileLocationDisabled : ""}>
        <span>Município</span>
        <select value={foreignLocation ? "" : (draft.city || "")} disabled={foreignLocation || !stateCode || citiesLoading} onChange={(event) => onChange("city", event.target.value)}>
          <option value="">{foreignLocation ? "Desativado para local no exterior" : citiesLoading ? "Carregando municípios..." : stateCode ? "Selecione o município" : "Selecione primeiro o estado"}</option>
          {!foreignLocation ? availableCities.map((city) => <option key={city} value={city}>{city}</option>) : null}
        </select>
        {!foreignLocation && citiesError ? <small className={styles.profileFieldError}>{citiesError}</small> : null}
        {!foreignLocation ? <FieldError message={errors.city} /> : null}
      </label>
      <label className={styles.profileForeignToggle}>
        <input
          type="checkbox"
          checked={foreignLocation}
          onChange={(event) => {
            onChange("state", "");
            onChange("city", "");
            onChange("foreignLocation", event.target.checked);
          }}
        />
        <span><strong>Local no exterior</strong><small>Desativa Estado e Município do Brasil e libera o preenchimento manual.</small></span>
      </label>
      {foreignLocation ? <>
        <label><span>Estado, província ou região</span><input value={draft.state || ""} maxLength={80} placeholder="Ex.: Flórida" onChange={(event) => onChange("state", event.target.value)} /><FieldError message={errors.state} /></label>
        <label><span>Cidade ou localidade</span><input value={draft.city || ""} maxLength={80} placeholder="Ex.: Miami" onChange={(event) => onChange("city", event.target.value)} /><FieldError message={errors.city} /></label>
      </> : null}
    </>
  );
}

function IdentityAvatar({ name, photoUrl, Icon = UserRound, className = "" }) {
  return (
    <span className={`${styles.profileAvatar} ${className}`.trim()}>
      {photoUrl ? <img src={photoUrl} alt={`Foto de ${name}`} /> : <span>{getInitials(name)}<Icon aria-hidden="true" /></span>}
    </span>
  );
}

function SportBadges({ sports = [], editable = false, onToggle }) {
  const entries = editable ? MEMBER_SPORT_OPTIONS : MEMBER_SPORT_OPTIONS.filter((sport) => sports.includes(sport.value));
  if (!entries.length && !editable) return null;
  return (
    <div className={`${styles.profileSportBadges} ${editable ? styles.editableSportBadges : ""}`.trim()}>
      {entries.map((sport) => {
        const selected = sports.includes(sport.value);
        return editable ? (
          <button
            key={sport.value}
            type="button"
            className={selected ? styles.selectedSportBadge : ""}
            style={{ "--sport-color": sport.color }}
            aria-pressed={selected}
            onClick={() => onToggle?.(sport.value)}
          >
            {selected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{sport.value}
          </button>
        ) : <span key={sport.value} style={{ "--sport-color": sport.color }}>{sport.value}</span>;
      })}
    </div>
  );
}

export function PhotoLightbox({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose?.(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, photo]);

  if (!photo?.src) return null;
  return (
    <div className={styles.profilePhotoLightbox} role="dialog" aria-modal="true" aria-label="Foto ampliada" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section>
        <button type="button" onClick={onClose} aria-label="Fechar foto ampliada"><X /></button>
        <img src={photo.src} alt={photo.alt || "Foto ampliada do perfil"} />
        <footer><span>{photo.title}</span><small>Pressione Esc ou toque fora da foto para fechar</small></footer>
      </section>
    </div>
  );
}

export function PhotoGallery({ title, photos, busy, onAdd, onRemove, onPreview }) {
  const remaining = MAX_MEMBER_GALLERY_PHOTOS - photos.length;
  return (
    <section className={styles.profilePanel} aria-labelledby={`${title.replace(/\s+/g, "-")}-title`}>
      <header className={styles.profilePanelHeader}>
        <div><Images aria-hidden="true" /><span><h2 id={`${title.replace(/\s+/g, "-")}-title`}>{title}</h2><p>Publicações em 4:5 ou 1:1. Ajuste cada foto antes de salvar.</p></span></div>
        <strong>{photos.length}/{MAX_MEMBER_GALLERY_PHOTOS}</strong>
      </header>
      <div className={styles.profileGalleryGrid}>
        {photos.map((photoUrl, index) => (
          <figure key={`${photoUrl}-${index}`}>
            <button type="button" className={styles.profileGalleryPreview} onClick={() => onPreview?.({ src: photoUrl, alt: `Foto ${index + 1} de ${title.toLocaleLowerCase("pt-BR")}`, title: `${title} · foto ${index + 1}` })} aria-label={`Ampliar foto ${index + 1}`}>
              <img src={photoUrl} alt={`Foto ${index + 1} de ${title.toLocaleLowerCase("pt-BR")}`} />
              <span><ZoomIn /></span>
            </button>
            <button type="button" className={styles.profileGalleryRemove} onClick={() => onRemove(index)} disabled={busy} aria-label={`Remover foto ${index + 1}`}><X /></button>
          </figure>
        ))}
        {remaining > 0 ? (
          <label className={styles.profileGalleryAdd}>
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => { onAdd(Array.from(event.target.files || [])); event.target.value = ""; }} />
            <ImagePlus aria-hidden="true" />
            <strong>{photos.length ? "Adicionar foto" : "Criar galeria"}</strong>
            <small>{remaining === 1 ? "Resta 1 foto" : `Restam ${remaining} fotos`}</small>
          </label>
        ) : null}
      </div>
      {!photos.length ? <p className={styles.galleryHint}>Cada foto será enquadrada antes da publicação. O limite total é de 10.</p> : null}
    </section>
  );
}

function ActivityPanel({ activity, events, identityMode }) {
  const entries = identityMode === "athlete"
    ? (activity?.registrations || []).slice(0, 4).map((entry) => ({
        id: entry.id,
        name: entry.tournament?.name || "Torneio",
        meta: entry.category || "Categoria a confirmar",
        image: entry.tournament?.cover_url || "",
      }))
    : events.slice(0, 4).map((entry) => ({
        id: entry.id || entry.public_id,
        name: entry?.data?.eventName || entry?.data?.name || entry?.name || "Torneio",
        meta: entry?.data?.location || "Publicado no Torneio 360",
        image: entry?.data?.coverImageThumbnailUrl || entry?.data?.coverImageUrl || entry?.cover_url || "",
      }));

  return (
    <section className={styles.profilePanel}>
      <header className={styles.profilePanelHeader}>
        <div><Trophy aria-hidden="true" /><span><h2>{identityMode === "athlete" ? "Atividades e resultados" : "Eventos publicados"}</h2><p>{identityMode === "athlete" ? "Histórico esportivo vinculado ao atleta." : "Torneios vinculados exclusivamente à organização."}</p></span></div>
      </header>
      {entries.length ? <div className={styles.profileActivityGrid}>{entries.map((entry) => (
        <article key={entry.id}>
          <span>{entry.image ? <img src={entry.image} alt="" /> : <Trophy />}</span>
          <div><strong>{entry.name}</strong><small>{entry.meta}</small></div>
          <Check aria-hidden="true" />
        </article>
      ))}</div> : <div className={styles.profileEmpty}><Trophy /><strong>Nenhuma atividade publicada ainda.</strong><small>Os próximos registros aparecerão aqui automaticamente.</small></div>}
    </section>
  );
}

function formatProfileDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getChallengeLabel(value) {
  return ({
    match: "Partida simples",
    practice: "Meta esportiva anterior",
    doubles: "Partida em dupla",
    podium_goal: "Meta de pódios",
    open: "Desafio aberto",
  })[value] || "Desafio esportivo";
}

function getChallengeStatusLabel(value) {
  return ({ pending: "Aguardando resposta", accepted: "Aceito", declined: "Recusado", cancelled: "Cancelado" })[value] || "Atualizado";
}

function getAchievementKind(achievement) {
  const source = String(achievement?.source_type || achievement?.kind || achievement?.achievement_type || "").toLocaleLowerCase("pt-BR");
  if (source.includes("circuit") || achievement?.circuit || achievement?.circuit_id) return "circuit";
  return "tournament";
}

function getAchievementDate(achievement) {
  return achievement?.event_date || achievement?.finished_at || achievement?.circuit?.end_date || achievement?.approved_at || "";
}

function getAchievementName(achievement) {
  return getAchievementKind(achievement) === "circuit"
    ? achievement?.circuit?.name || achievement?.circuit_name || "Circuito"
    : achievement?.tournament?.name || achievement?.tournament_name || "Torneio";
}

function getAchievementYear(achievement) {
  const value = String(getAchievementDate(achievement) || "");
  return /^\d{4}/.test(value) ? value.slice(0, 4) : "Sem data";
}

function getAchievementDetail(achievement) {
  if (getAchievementKind(achievement) === "circuit") {
    const points = Number(achievement?.circuit_points ?? achievement?.points);
    const stages = Number(achievement?.stage_count ?? achievement?.circuit?.tournament_count);
    return [
      `${achievement.placement}º lugar geral`,
      Number.isFinite(points) && points > 0 ? `${new Intl.NumberFormat("pt-BR").format(points)} pts` : "",
      Number.isFinite(stages) && stages > 0 ? `${stages} etapa${stages === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(" · ");
  }
  return [achievement?.category, formatProfileDate(getAchievementDate(achievement))].filter(Boolean).join(" · ");
}

function AchievementSummary({ title, kind, achievements }) {
  const counts = [1, 2, 3].map((placement) => achievements.filter((entry) => Number(entry.placement) === placement).length);
  const Icon = kind === "circuit" ? Flag : Trophy;
  return (
    <article className={styles.profileAchievementSummary} data-kind={kind}>
      <div><Icon aria-hidden="true" /><span><small>{title}</small><strong>{achievements.length}</strong></span></div>
      <dl>{counts.map((count, index) => <div key={index + 1} data-place={index + 1}><dt>{count}</dt><dd>{index + 1}º lugar</dd></div>)}</dl>
    </article>
  );
}

function AchievementHighlight({ achievement, kind }) {
  const Icon = kind === "circuit" ? Flag : Trophy;
  if (!achievement) {
    return <article className={styles.profileAchievementHighlightEmpty}><Icon /><strong>Nenhum pódio em {kind === "circuit" ? "circuitos" : "torneios"} ainda.</strong><small>Os resultados oficiais aparecerão aqui após a confirmação da organização.</small></article>;
  }
  return (
    <article className={styles.profileAchievementHighlight} data-place={achievement.placement}>
      <span><Icon aria-hidden="true" /><b>{achievement.placement}º</b></span>
      <div><small>{kind === "circuit" ? "Circuito" : "Torneio"}</small><h3>{getAchievementName(achievement)}</h3><p>{getAchievementDetail(achievement)}</p><em><ShieldCheck /> {achievement.organization?.name || achievement.organization_name || "Organização verificada"}</em></div>
      <ChevronRight aria-hidden="true" />
    </article>
  );
}

function AchievementHistory({ achievements, kindFilter, yearFilter, onKindFilter, onYearFilter, limit = 0 }) {
  const years = [...new Set(achievements.map(getAchievementYear).filter((year) => year !== "Sem data"))].sort((a, b) => b.localeCompare(a));
  const filtered = achievements
    .filter((entry) => kindFilter === "all" || getAchievementKind(entry) === kindFilter)
    .filter((entry) => yearFilter === "all" || getAchievementYear(entry) === yearFilter)
    .sort((a, b) => String(getAchievementDate(b)).localeCompare(String(getAchievementDate(a))));
  const visible = limit ? filtered.slice(0, limit) : filtered;
  return (
    <section className={styles.profileAchievementHistory}>
      <header><div><History /><span><h3>Histórico oficial</h3><small>Resultados encerrados e confirmados pelas organizações.</small></span></div><div className={styles.profileAchievementFilters}><select aria-label="Filtrar tipo de conquista" value={kindFilter} onChange={(event) => onKindFilter(event.target.value)}><option value="all">Todos</option><option value="tournament">Torneios</option><option value="circuit">Circuitos</option></select><select aria-label="Filtrar ano das conquistas" value={yearFilter} onChange={(event) => onYearFilter(event.target.value)}><option value="all">Todos os anos</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></header>
      {visible.length ? <div className={styles.profileAchievementHistoryList}>{visible.map((achievement) => {
        const kind = getAchievementKind(achievement);
        return <article key={achievement.id} data-place={achievement.placement}>
          <span><Medal /><strong>{achievement.placement}º</strong></span>
          <small data-kind={kind}>{kind === "circuit" ? "Circuito" : "Torneio"}</small>
          <div><strong>{getAchievementName(achievement)}</strong><p>{kind === "circuit" ? getAchievementDetail(achievement) : [achievement.category, achievement.bracket_name || "Principal"].filter(Boolean).join(" · ")}</p></div>
          <time><CalendarDays /> {formatProfileDate(getAchievementDate(achievement))}</time>
          <em><ShieldCheck /> {achievement.organization?.name || achievement.organization_name || "Organização"}</em>
        </article>;
      })}</div> : <div className={`${styles.profileEmpty} ${styles.profileAchievementEmpty}`.trim()}><Award /><strong>Nenhuma conquista neste filtro.</strong><small>Altere o tipo ou o ano para consultar outros resultados.</small></div>}
    </section>
  );
}

function AchievementsPanel({ achievements = [] }) {
  const [view, setView] = useState("overview");
  const [kindFilter, setKindFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const tournamentAchievements = achievements.filter((entry) => getAchievementKind(entry) === "tournament");
  const circuitAchievements = achievements.filter((entry) => getAchievementKind(entry) === "circuit");
  const recentTournament = [...tournamentAchievements].sort((a, b) => String(getAchievementDate(b)).localeCompare(String(getAchievementDate(a))))[0];
  const recentCircuit = [...circuitAchievements].sort((a, b) => String(getAchievementDate(b)).localeCompare(String(getAchievementDate(a))))[0];

  function selectView(nextView) {
    setView(nextView);
    setKindFilter(nextView === "tournaments" ? "tournament" : nextView === "circuits" ? "circuit" : "all");
    setYearFilter("all");
  }

  return (
    <section className={`${styles.profilePanel} ${styles.profileAchievementsPanel}`.trim()}>
      <header className={styles.profilePanelHeader}>
        <div><Award aria-hidden="true" /><span><h2>Conquistas</h2><p>Pódios oficiais em torneios e circuitos.</p></span></div>
        <strong>{achievements.length}</strong>
      </header>
      <nav className={styles.profileAchievementNav} aria-label="Seções das conquistas">{[
        ["overview", "Visão geral"],
        ["tournaments", "Torneios"],
        ["circuits", "Circuitos"],
        ["history", "Histórico"],
      ].map(([id, label]) => <button type="button" key={id} className={view === id ? styles.activeAchievementNav : ""} onClick={() => selectView(id)}>{label}</button>)}</nav>
      <div className={styles.profileAchievementSummaryGrid}>
        {view !== "circuits" ? <AchievementSummary title="Pódios em torneios" kind="tournament" achievements={tournamentAchievements} /> : null}
        {view !== "tournaments" ? <AchievementSummary title="Pódios em circuitos" kind="circuit" achievements={circuitAchievements} /> : null}
      </div>
      {view === "overview" ? <section className={styles.profileAchievementHighlights}><h3><Target /> Destaques recentes</h3><div><AchievementHighlight achievement={recentTournament} kind="tournament" /><AchievementHighlight achievement={recentCircuit} kind="circuit" /></div></section> : null}
      <AchievementHistory achievements={achievements} kindFilter={kindFilter} yearFilter={yearFilter} onKindFilter={setKindFilter} onYearFilter={setYearFilter} limit={view === "overview" ? 3 : 0} />
    </section>
  );
}

const CHALLENGE_CREATE_OPTIONS = [
  { id: "match", label: "Partida simples", description: "Um contra um: escolha o atleta que deseja enfrentar e envie o convite para combinar a partida.", Icon: Trophy },
  { id: "doubles", label: "Partida em dupla", description: "Minha dupla contra a sua: escolha os quatro atletas e indique se a disputa será mista ou da mesma categoria esportiva.", Icon: Users },
  { id: "podium_goal", label: "Meta de pódios", description: "Compare quem conquista mais pódios oficiais durante 30 dias, 3 meses, 6 meses ou 1 ano.", Icon: Target },
];

const DOUBLES_CATEGORY_OPTIONS = [
  { id: "mixed", label: "Partida mista", description: "Cada dupla terá atletas de categorias esportivas diferentes." },
  { id: "same_category", label: "Mesma categoria esportiva", description: "Os quatro atletas devem disputar dentro da mesma categoria." },
];

const PODIUM_GOAL_PERIODS = [
  { id: "30_days", label: "Próximos 30 dias" },
  { id: "3_months", label: "Próximos 3 meses" },
  { id: "6_months", label: "Próximos 6 meses" },
  { id: "1_year", label: "Próximo 1 ano" },
];

function getPodiumPeriodLabel(value) {
  return PODIUM_GOAL_PERIODS.find((entry) => entry.id === value)?.label || "Período a confirmar";
}

function getDoublesCategoryLabel(value) {
  return DOUBLES_CATEGORY_OPTIONS.find((entry) => entry.id === value)?.label || "Categoria a confirmar";
}

function ChallengesPanel({ supabase, userId, challenges = [], busy, onRespond, onSend }) {
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [challengeType, setChallengeType] = useState("match");
  const [query, setQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [doublesCategoryMode, setDoublesCategoryMode] = useState("same_category");
  const [goalPeriod, setGoalPeriod] = useState("30_days");
  const [candidateState, setCandidateState] = useState({ loading: false, items: [], error: "" });
  const waitingCount = challenges.filter((entry) => entry.status === "pending").length;
  const acceptedCount = challenges.filter((entry) => entry.status === "accepted").length;
  const completedCount = challenges.filter((entry) => ["declined", "cancelled"].includes(entry.status)).length;
  const visibleChallenges = challenges.filter((entry) => {
    if (filter === "received") return entry.direction === "incoming" || entry.direction === "open";
    if (filter === "sent") return entry.direction === "outgoing";
    if (filter === "completed") return entry.status !== "pending";
    return true;
  });

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!creating || normalizedQuery.length < 2) {
      setCandidateState({ loading: false, items: [], error: "" });
      return undefined;
    }
    let active = true;
    setCandidateState((current) => ({ ...current, loading: true, error: "" }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchPublicPlatform({ supabase, query: normalizedQuery, limit: 8 });
        if (!active) return;
        setCandidateState({
          loading: false,
          items: (result.accounts || []).filter((item) => item.account_kind === "athlete" && String(item.id) !== String(userId) && !selectedMembers.some((selected) => String(selected.id) === String(item.id))),
          error: result.error ? "Não foi possível pesquisar agora." : "",
        });
      } catch {
        if (active) setCandidateState({ loading: false, items: [], error: "Não foi possível pesquisar agora." });
      }
    }, 280);
    return () => { active = false; window.clearTimeout(timer); };
  }, [challengeType, creating, query, selectedMembers, supabase, userId]);

  function chooseChallengeType(type) {
    setChallengeType(type);
    setCreating(true);
    setQuery("");
    setSelectedMembers([]);
    setCandidateState({ loading: false, items: [], error: "" });
  }

  function closeCreation() {
    setQuery("");
    setSelectedMembers([]);
    setCandidateState({ loading: false, items: [], error: "" });
    setCreating(false);
  }

  function finishCreation() {
    closeCreation();
    setFilter("sent");
  }

  async function sendTo(candidate) {
    if (challengeType === "doubles") {
      setSelectedMembers((current) => current.length < 3 ? [...current, candidate] : current);
      setQuery("");
      setCandidateState({ loading: false, items: [], error: "" });
      return;
    }
    const sent = await onSend(candidate, challengeType, challengeType === "podium_goal" ? { goalPeriod } : {});
    if (sent) finishCreation();
  }

  async function publishDoubles() {
    if (selectedMembers.length !== 3) return;
    const sent = await onSend(selectedMembers[1], "doubles", {
      challengerPartner: selectedMembers[0],
      challengedPartner: selectedMembers[2],
      doublesCategoryMode,
    });
    if (sent) finishCreation();
  }

  return (
    <section className={`${styles.profilePanel} ${styles.profileChallengesPanel}`.trim()}>
      <header className={styles.profileChallengeHeader}><div><Swords /><span><h2>Desafios</h2><p>Convide atletas, combine partidas e acompanhe suas disputas.</p></span></div><button type="button" onClick={() => { if (creating) closeCreation(); else setCreating(true); }}><Plus /> {creating ? "Fechar criação" : "Novo desafio"}</button></header>
      <div className={styles.profileChallengeStats}><article><strong>{waitingCount}</strong><small>Aguardando resposta</small></article><article><strong>{acceptedCount}</strong><small>Aceitos</small></article><article><strong>{completedCount}</strong><small>Concluídos</small></article></div>
      <div className={styles.profileChallengeLayout}>
        <div className={styles.profileChallengeMain}>
          <nav className={styles.profileChallengeFilters} aria-label="Filtrar desafios">{[["all", "Todos"], ["received", "Recebidos"], ["sent", "Enviados"], ["completed", "Concluídos"]].map(([id, label]) => <button type="button" key={id} className={filter === id ? styles.activeChallengeFilter : ""} onClick={() => setFilter(id)}>{label}</button>)}</nav>
          {visibleChallenges.length ? <div className={styles.profileChallengeList}>{visibleChallenges.map((challenge) => {
            const athleteName = challenge.athlete?.display_name || challenge.athlete?.name || (challenge.challenge_type === "open" ? "Aberto para atletas da plataforma" : "Atleta");
            const location = [challenge.athlete?.city, challenge.athlete?.state].filter(Boolean).join("/");
            const teammate = challenge.direction === "outgoing" ? challenge.challenger_partner : challenge.challenged_partner;
            const rivalPartner = challenge.direction === "outgoing" ? challenge.challenged_partner : challenge.challenger_partner;
            const doublesSummary = challenge.challenge_type === "doubles"
              ? `${teammate?.display_name || "Sua dupla"} × ${athleteName}${rivalPartner?.display_name ? ` / ${rivalPartner.display_name}` : ""}`
              : "";
            const eyebrow = challenge.direction === "outgoing" ? "Você enviou" : challenge.direction === "open" ? "Desafio público" : "Você recebeu";
            const statusLabel = challenge.challenge_type === "open" && challenge.status === "pending" ? "Aberto" : getChallengeStatusLabel(challenge.status);
            const ownPodiumScore = challenge.direction === "outgoing" ? Number(challenge.challenger_score || 0) : Number(challenge.challenged_score || 0);
            const rivalPodiumScore = challenge.direction === "outgoing" ? Number(challenge.challenged_score || 0) : Number(challenge.challenger_score || 0);
            const podiumSummary = challenge.challenge_type === "podium_goal"
              ? challenge.status === "pending"
                ? `${getPodiumPeriodLabel(challenge.goal_period)} · a contagem começa após o aceite`
                : `${getPodiumPeriodLabel(challenge.goal_period)} · Você ${ownPodiumScore} × ${rivalPodiumScore} ${athleteName}`
              : "";
            return <article key={challenge.id} data-status={challenge.status}>
              <IdentityAvatar name={athleteName} photoUrl={challenge.athlete?.photo_url || ""} />
              <div><small>{eyebrow}</small><strong>{athleteName}</strong><h3>{getChallengeLabel(challenge.challenge_type)}</h3>{doublesSummary ? <p className={styles.profileChallengePair}><Users /> {doublesSummary} · {getDoublesCategoryLabel(challenge.doubles_category_mode)}</p> : null}{podiumSummary ? <p className={styles.profileChallengePair}><Target /> {podiumSummary}</p> : null}<p><Clock3 /> {formatProfileDate(challenge.created_at)}{challenge.goal_ends_at ? <> · encerra em {formatProfileDate(challenge.goal_ends_at)}</> : null}{location ? <><MapPin /> {location}</> : null}</p></div>
              <span className={styles.profileChallengeStatus}>{statusLabel}</span>
              {(challenge.direction === "incoming" || challenge.direction === "open") && challenge.status === "pending" ? <span className={styles.profileChallengeActions}><button type="button" disabled={busy} onClick={() => onRespond(challenge, "accepted")}><Check /> Aceitar</button>{challenge.direction !== "open" ? <button type="button" disabled={busy} onClick={() => onRespond(challenge, "declined")}><X /> Recusar</button> : null}</span> : null}
              {challenge.direction === "outgoing" && challenge.status === "pending" ? <span className={styles.profileChallengeActions}><button type="button" disabled={busy} onClick={() => onRespond(challenge, "cancelled")}><X /> Cancelar</button></span> : null}
            </article>;
          })}</div> : <div className={styles.profileEmpty}><Swords /><strong>Nenhum desafio neste filtro.</strong><small>Crie um convite ou consulte outra situação.</small></div>}
        </div>
        <aside className={styles.profileChallengeCreate}>
          <header><h3>Criar um desafio</h3><small>Escolha uma das três disputas e confira como cada uma funciona.</small></header>
          <div>{CHALLENGE_CREATE_OPTIONS.map(({ id, label, description, Icon }) => <button type="button" key={id} className={challengeType === id && creating ? styles.selectedChallengeType : ""} onClick={() => chooseChallengeType(id)}><Icon /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight /></button>)}</div>
          {creating ? <section className={styles.profileChallengeSearch}>
            {challengeType === "podium_goal" ? <label className={styles.profileChallengeChoice}><span>Período da disputa</span><select value={goalPeriod} onChange={(event) => setGoalPeriod(event.target.value)}>{PODIUM_GOAL_PERIODS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small>Serão contados somente pódios oficiais confirmados durante o período. A contagem começa quando o atleta aceitar.</small></label> : null}
            {challengeType === "doubles" ? <label className={styles.profileChallengeChoice}><span>Formação da partida</span><select value={doublesCategoryMode} onChange={(event) => setDoublesCategoryMode(event.target.value)}>{DOUBLES_CATEGORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small>{DOUBLES_CATEGORY_OPTIONS.find((option) => option.id === doublesCategoryMode)?.description}</small></label> : null}
            {challengeType === "doubles" && selectedMembers.length ? <div className={styles.profileChallengeSelected}>{selectedMembers.map((member, index) => <span key={member.id}><small>{["Seu parceiro", "Adversário 1", "Adversário 2"][index]}</small><strong>{member.display_name || member.name || member.handle || "Atleta"}</strong><button type="button" onClick={() => setSelectedMembers((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${member.display_name || "atleta"}`}><X /></button></span>)}</div> : null}
            {challengeType !== "doubles" || selectedMembers.length < 3 ? <label><span>{challengeType === "doubles" ? ["Encontrar seu parceiro", "Encontrar o primeiro adversário", "Encontrar o segundo adversário"][selectedMembers.length] : "Encontrar atleta"}</span><div><Search /><input value={query} placeholder="Nome ou @usuário" onChange={(event) => setQuery(event.target.value)} /></div></label> : null}
            {candidateState.loading ? <small>Pesquisando atletas...</small> : null}{candidateState.error ? <small className={styles.profileFieldError}>{candidateState.error}</small> : null}{query.trim().length >= 2 && !candidateState.loading && !candidateState.items.length && !candidateState.error ? <small>Nenhum atleta encontrado.</small> : null}
            {candidateState.items.length ? <div>{candidateState.items.map((candidate) => { const name = candidate.display_name || candidate.name || candidate.handle || "Atleta"; return <article key={candidate.id}><IdentityAvatar name={name} photoUrl={candidate.photo_url || ""} /><span><strong>{name}</strong><small>{candidate.handle ? `@${candidate.handle}` : [candidate.city, candidate.state].filter(Boolean).join("/") || "Perfil de atleta"}</small></span><button type="button" disabled={busy} onClick={() => sendTo(candidate)}>{challengeType === "doubles" ? "Selecionar" : "Desafiar"}</button></article>; })}</div> : null}
            {challengeType === "doubles" ? <button type="button" className={styles.profileChallengePublish} disabled={busy || selectedMembers.length !== 3} onClick={publishDoubles}>Enviar desafio para a dupla</button> : null}
          </section> : null}
          <p><ShieldCheck /> O contato só é liberado após o aceite.</p>
        </aside>
      </div>
    </section>
  );
}

export default function PlatformV2Profile({
  supabase,
  user,
  accessProfile,
  identityMode,
  activity,
  feedItems = [],
  socialGraph = { followersCount: 0, followingCount: 0, followers: [], following: [] },
  socialBusy = "",
  onToggleFollow,
  onIdentitySummaryChange,
  onNotice,
}) {
  const fallback = useMemo(() => createMemberProfileFallback({
    user,
    accessProfile: accessProfile?.arena_name ? null : accessProfile,
  }), [accessProfile, user]);
  const [athlete, setAthlete] = useState(fallback);
  const [organization, setOrganization] = useState(() => normalizeOrganization(accessProfile));
  const [athleteStatus, setAthleteStatus] = useState("loading");
  const [athleteGallery, setAthleteGallery] = useState([]);
  const [organizationGallery, setOrganizationGallery] = useState([]);
  const [activeSection, setActiveSection] = useState("activity");
  const [busy, setBusy] = useState(false);
  const [imageEditor, setImageEditor] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [pendingGalleryRemoval, setPendingGalleryRemoval] = useState(null);
  const [detailsDraft, setDetailsDraft] = useState(null);
  const [detailsErrors, setDetailsErrors] = useState({});
  const [profileCityOptions, setProfileCityOptions] = useState([]);
  const [profileCitiesLoading, setProfileCitiesLoading] = useState(false);
  const [profileCitiesError, setProfileCitiesError] = useState("");
  const [profileActivity, setProfileActivity] = useState(activity || { registrations: [], circuits: [], challenges: [], achievements: [], circuitAchievements: [] });
  const [connectionsView, setConnectionsView] = useState("");
  const hasOrganization = Boolean(accessProfile?.arena_name || accessProfile?.organization_name);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    setAthleteStatus("loading");
    loadMyMemberProfile({ supabase, fallback }).then(async (result) => {
      if (!active) return;
      const storedGallery = result.profile.galleryPhotos || [];
      const cleanGallery = await excludeOrganizationCoverFromGallery(storedGallery, result.profile.coverUrl || "");
      if (!active) return;
      const cleanProfile = { ...result.profile, galleryPhotos: cleanGallery };
      setAthlete(cleanProfile);
      setAthleteGallery(cleanGallery);
      setAthleteStatus(result.schemaAvailable ? "ready" : "unavailable");
      if (result.schemaAvailable && cleanGallery.length !== storedGallery.length) {
        void saveMyMemberProfile({ supabase, profile: cleanProfile, fallback })
          .then(() => onNotice?.("A foto de capa foi separada da galeria do atleta."))
          .catch(() => undefined);
      }
    }).catch(() => {
      if (!active) return;
      setAthlete(fallback);
      setAthleteGallery([]);
      setAthleteStatus("error");
    });
    return () => { active = false; };
  }, [fallback, supabase, user?.id]);

  useEffect(() => {
    setOrganization((current) => ({ ...normalizeOrganization(accessProfile), coverUrl: current.coverUrl || accessProfile?.cover_url || "" }));
  }, [accessProfile]);

  useEffect(() => {
    if (!user?.id || !hasOrganization) return undefined;
    let active = true;
    Promise.all([
      loadMyOrganizationGallery({ supabase }),
      loadMyOrganizationCover({ supabase, fallback: accessProfile?.cover_url || "" }),
      loadMyOrganizationPaymentSettings({
        supabase,
        fallback: {
          pixKey: accessProfile?.pix_key || "",
          cardPaymentLink: accessProfile?.card_payment_link || "",
        },
      }),
    ]).then(async ([photos, cover, paymentSettings]) => {
      if (!active) return;
      const cleanGallery = await excludeOrganizationCoverFromGallery(photos || [], cover.coverUrl || accessProfile?.cover_url || "");
      if (!active) return;
      setOrganizationGallery(cleanGallery);
      setOrganization((current) => ({
        ...current,
        coverUrl: cover.coverUrl || current.coverUrl,
        pixKey: paymentSettings.pixKey || "",
        cardPaymentLink: paymentSettings.cardPaymentLink || "",
      }));
      if (cleanGallery.length !== (photos || []).length) {
        void saveMyOrganizationGallery({ supabase, photoUrls: cleanGallery })
          .then(() => onNotice?.("A foto de capa foi separada da galeria da organização."))
          .catch(() => undefined);
      }
    }).catch(() => {
      if (active) onNotice?.("Não foi possível carregar todas as fotos da organização agora.");
    });
    return () => { active = false; };
  }, [accessProfile?.cover_url, hasOrganization, onNotice, supabase, user?.id]);

  useEffect(() => {
    onIdentitySummaryChange?.("athlete", { name: athlete.displayName, photoUrl: athlete.photoUrl, label: "Perfil do atleta" });
  }, [athlete.displayName, athlete.photoUrl, onIdentitySummaryChange]);

  useEffect(() => {
    if (!hasOrganization) return;
    onIdentitySummaryChange?.("organization", { name: organization.name, photoUrl: organization.photoUrl, label: "Perfil da organização" });
  }, [hasOrganization, onIdentitySummaryChange, organization.name, organization.photoUrl]);

  useEffect(() => { setActiveSection("activity"); setConnectionsView(""); }, [identityMode]);
  useEffect(() => { setProfileActivity(activity || { registrations: [], circuits: [], challenges: [], achievements: [], circuitAchievements: [] }); }, [activity]);

  useEffect(() => {
    if (!detailsDraft || detailsDraft.foreignLocation) {
      setProfileCityOptions([]);
      setProfileCitiesLoading(false);
      setProfileCitiesError("");
      return undefined;
    }
    const stateCode = normalizeBrazilianState(detailsDraft.state);
    if (!stateCode) {
      setProfileCityOptions([]);
      setProfileCitiesLoading(false);
      setProfileCitiesError("");
      return undefined;
    }

    const controller = new AbortController();
    setProfileCitiesLoading(true);
    setProfileCitiesError("");
    loadBrazilianCities(stateCode, { signal: controller.signal })
      .then((cities) => setProfileCityOptions(cities))
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setProfileCityOptions([]);
        setProfileCitiesError(error?.message || "Não foi possível carregar os municípios deste estado.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setProfileCitiesLoading(false);
      });
    return () => controller.abort();
  }, [detailsDraft?.foreignLocation, detailsDraft?.state]);

  const current = identityMode === "organization" && hasOrganization ? organization : athlete;
  const currentGallery = identityMode === "organization" && hasOrganization ? organizationGallery : athleteGallery;
  const name = current.name || current.displayName || "Perfil Torneio 360";
  const photoUrl = current.photoUrl || "";
  const coverUrl = current.coverUrl || "";
  const location = [current.city, current.state].filter(Boolean).join(" · ");
  const organizationEvents = feedItems.filter((item) => String(item?.organization?.id || "") === String(accessProfile?.id || user?.id || ""));

  function openEditor(file, kind) {
    if (!file || busy) return;
    if (!String(file.type || "").startsWith("image/")) {
      onNotice?.("Escolha uma foto em JPG, PNG ou WebP.");
      return;
    }
    setImageEditor({ identity: identityMode, kind, sourceUrl: URL.createObjectURL(file), fileName: file.name || "imagem" });
  }

  function openDetailsEditor() {
    setDetailsErrors({});
    setDetailsDraft(identityMode === "organization" ? {
      arenaName: organization.name,
      organizerName: organization.organizerName,
      whatsapp: organization.whatsapp,
      instagramHandle: organization.handle,
      instagramLink: organization.instagramLink,
      whatsappGroupLink: organization.whatsappGroupLink,
      address: organization.address,
      mapsLink: organization.mapsLink,
      city: organization.city,
      state: organization.state,
      foreignLocation: isForeignLocation(organization.state),
      pixKey: organization.pixKey,
      cardPaymentLink: organization.cardPaymentLink,
    } : {
      name: athlete.displayName,
      handle: athlete.handle,
      city: athlete.city,
      state: athlete.state,
      foreignLocation: isForeignLocation(athlete.state),
      sportsCategory: athlete.sportsCategory,
      sports: athlete.sports || [],
      gender: athlete.gender,
      dominantHand: athlete.dominantHand,
      shirtSize: athlete.shirtSize,
      bio: athlete.bio,
      whatsapp: athlete.whatsapp,
      telegram: athlete.telegram,
      instagram: athlete.instagram,
      showContacts: athlete.showContacts,
    });
  }

  function updateDetailsDraft(field, value) {
    setDetailsDraft((currentValue) => ({ ...currentValue, [field]: value }));
    setDetailsErrors((currentValue) => {
      if (!currentValue[field]) return currentValue;
      const nextValue = { ...currentValue };
      delete nextValue[field];
      return nextValue;
    });
  }

  function toggleDraftSport(sport) {
    setDetailsDraft((currentValue) => {
      const selected = currentValue?.sports || [];
      return {
        ...currentValue,
        sports: selected.includes(sport)
          ? selected.filter((entry) => entry !== sport)
          : [...selected, sport],
      };
    });
    setDetailsErrors((currentValue) => {
      if (!currentValue.sports) return currentValue;
      const nextValue = { ...currentValue };
      delete nextValue.sports;
      return nextValue;
    });
  }

  async function saveDetails() {
    if (!detailsDraft || busy) return;
    const normalizedState = detailsDraft.foreignLocation
      ? String(detailsDraft.state || "").trim()
      : normalizeBrazilianState(detailsDraft.state);
    const normalizedCity = String(detailsDraft.city || "").trim();

    let athleteValidation = null;
    const nextErrors = {};
    if (identityMode === "organization") {
      if (String(detailsDraft.arenaName || "").trim().length < 2) nextErrors.arenaName = "Informe o nome da organização.";
      if (String(detailsDraft.organizerName || "").trim().length < 2) nextErrors.organizerName = "Informe o nome do organizador.";
      if (!normalizedState) nextErrors.state = detailsDraft.foreignLocation ? "Informe o estado, a província ou a região." : "Selecione o estado.";
      if (!normalizedCity) nextErrors.city = detailsDraft.foreignLocation ? "Informe a cidade ou localidade." : "Selecione o município.";
      const normalizedWhatsapp = String(detailsDraft.whatsapp || "").replace(/[^0-9+]/g, "");
      if (normalizedWhatsapp && !/^\+?[0-9]{10,15}$/.test(normalizedWhatsapp)) nextErrors.whatsapp = "Informe o WhatsApp com DDD e apenas números.";
      [
        ["instagramLink", "Link do Instagram"],
        ["whatsappGroupLink", "Link do grupo de WhatsApp"],
        ["mapsLink", "Link do endereço"],
        ["cardPaymentLink", "Link de pagamento"],
      ].forEach(([field, label]) => {
        if (String(detailsDraft[field] || "").trim() && !normalizeOptionalWebLink(detailsDraft[field])) nextErrors[field] = `${label} deve começar com http:// ou https://.`;
      });
    } else {
      athleteValidation = validateMemberProfile({
        ...athlete,
        displayName: String(detailsDraft.name || "").trim(),
        handle: normalizeMemberHandle(detailsDraft.handle),
        city: normalizedCity,
        state: normalizedState,
        sportsCategory: String(detailsDraft.sportsCategory || "").trim(),
        sports: detailsDraft.sports || [],
        gender: detailsDraft.gender,
        dominantHand: detailsDraft.dominantHand,
        shirtSize: detailsDraft.shirtSize,
        bio: String(detailsDraft.bio || "").trim(),
        whatsapp: detailsDraft.whatsapp,
        telegram: detailsDraft.telegram,
        instagram: detailsDraft.instagram,
        showContacts: Boolean(detailsDraft.showContacts),
        galleryPhotos: athleteGallery,
      });
      Object.assign(nextErrors, athleteValidation.errors);
      if (!normalizedState) nextErrors.state = detailsDraft.foreignLocation ? "Informe o estado, a província ou a região." : "Selecione o estado.";
      if (!normalizedCity) nextErrors.city = detailsDraft.foreignLocation ? "Informe a cidade ou localidade." : "Selecione o município.";
    }

    if (Object.keys(nextErrors).length) {
      setDetailsErrors(nextErrors);
      onNotice?.(Object.values(nextErrors)[0]);
      return;
    }

    setBusy(true);
    try {
      if (identityMode === "organization") {
        const payload = {
          arena_name: String(detailsDraft.arenaName || "").trim(),
          name: String(detailsDraft.organizerName || "").trim(),
          phone: String(detailsDraft.whatsapp || "").replace(/[^0-9+]/g, ""),
          instagram_handle: String(detailsDraft.instagramHandle || "").trim().replace(/^@+/, ""),
          instagram_link: normalizeOptionalWebLink(detailsDraft.instagramLink),
          whatsapp_group_link: normalizeOptionalWebLink(detailsDraft.whatsappGroupLink),
          address: String(detailsDraft.address || "").trim(),
          maps_link: normalizeOptionalWebLink(detailsDraft.mapsLink),
          city: normalizedCity,
          state: normalizedState,
          is_public: true,
        };
        const { data, error } = await supabase.from("profiles").update(payload).eq("id", user.id).select("*").maybeSingle();
        if (error) throw error;
        const paymentSettings = await saveMyOrganizationPaymentSettings({
          supabase,
          pixKey: String(detailsDraft.pixKey || "").trim(),
          cardPaymentLink: normalizeOptionalWebLink(detailsDraft.cardPaymentLink),
        });
        setOrganization((currentValue) => ({
          ...currentValue,
          name: data?.arena_name || payload.arena_name,
          organizerName: data?.name || payload.name,
          whatsapp: data?.phone || payload.phone,
          handle: data?.instagram_handle ?? payload.instagram_handle,
          instagramLink: data?.instagram_link ?? payload.instagram_link,
          whatsappGroupLink: data?.whatsapp_group_link ?? payload.whatsapp_group_link,
          address: data?.address ?? payload.address,
          mapsLink: data?.maps_link ?? payload.maps_link,
          city: data?.city || payload.city,
          state: data?.state || payload.state,
          pixKey: paymentSettings.pixKey,
          cardPaymentLink: paymentSettings.cardPaymentLink,
        }));
      } else {
        await saveAthlete(athleteValidation.profile);
      }
      setDetailsDraft(null);
      onNotice?.("Informações do perfil atualizadas com sucesso.");
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível salvar as informações agora.");
    } finally {
      setBusy(false);
    }
  }

  async function respondToChallenge(challenge, status) {
    if (!challenge?.id || busy) return;
    setBusy(true);
    try {
      const updated = await respondAthleteChallenge({ supabase, challengeId: challenge.id, status });
      setProfileActivity((currentValue) => ({
        ...currentValue,
        challenges: (currentValue.challenges || []).map((entry) => entry.id === challenge.id ? { ...entry, ...updated, status: updated?.status || status } : entry),
      }));
      onNotice?.(status === "accepted" ? "Desafio aceito." : status === "declined" ? "Desafio recusado." : "Desafio cancelado.");
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível atualizar o desafio agora.");
    } finally {
      setBusy(false);
    }
  }

  async function sendNewChallenge(candidate, challengeType, options = {}) {
    if (!candidate?.id || busy) return false;
    setBusy(true);
    try {
      const created = await createAthleteChallenge({
        supabase,
        challengedUserId: candidate?.id || null,
        challengeType,
        challengerPartnerUserId: options.challengerPartner?.id || null,
        challengedPartnerUserId: options.challengedPartner?.id || null,
        doublesCategoryMode: options.doublesCategoryMode || null,
        goalPeriod: options.goalPeriod || null,
      });
      const athleteName = candidate?.display_name || candidate?.name || candidate?.handle || "Atletas da plataforma";
      const nextChallenge = {
        ...created,
        direction: "outgoing",
        challenge_type: created?.challenge_type || challengeType,
        status: created?.status || "pending",
        created_at: created?.created_at || new Date().toISOString(),
        doubles_category_mode: created?.doubles_category_mode || options.doublesCategoryMode || null,
        goal_period: created?.goal_period || options.goalPeriod || null,
        athlete: candidate ? {
          user_id: candidate.id,
          handle: candidate.handle || "",
          display_name: athleteName,
          photo_url: candidate.photo_url || "",
          city: candidate.city || "",
          state: candidate.state || "",
        } : null,
        challenger_partner: options.challengerPartner ? {
          user_id: options.challengerPartner.id,
          display_name: options.challengerPartner.display_name || options.challengerPartner.name || options.challengerPartner.handle || "Parceiro",
          photo_url: options.challengerPartner.photo_url || "",
        } : null,
        challenged_partner: options.challengedPartner ? {
          user_id: options.challengedPartner.id,
          display_name: options.challengedPartner.display_name || options.challengedPartner.name || options.challengedPartner.handle || "Parceiro adversário",
          photo_url: options.challengedPartner.photo_url || "",
        } : null,
      };
      setProfileActivity((currentValue) => {
        const currentChallenges = currentValue.challenges || [];
        const existingIndex = currentChallenges.findIndex((entry) => String(entry.id) === String(nextChallenge.id));
        return {
          ...currentValue,
          challenges: existingIndex >= 0
            ? currentChallenges.map((entry, index) => index === existingIndex ? { ...entry, ...nextChallenge } : entry)
            : [nextChallenge, ...currentChallenges],
        };
      });
      onNotice?.(challengeType === "doubles" ? "Convite enviado para a dupla adversária." : challengeType === "podium_goal" ? `Meta de pódios enviada para ${athleteName}.` : `Convite de partida simples enviado para ${athleteName}.`);
      return true;
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível enviar o desafio agora.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function closeEditor() {
    setImageEditor(null);
  }

  async function saveAthlete(nextProfile) {
    const result = await saveMyMemberProfile({ supabase, profile: nextProfile, fallback });
    if (!result.schemaAvailable) throw new Error("A estrutura do perfil ainda não está disponível na homologação.");
    setAthlete(result.profile);
    setAthleteGallery(result.profile.galleryPhotos || []);
  }

  async function applyEditedImage({ imageUrl }) {
    if (!user?.id || busy) return false;
    setBusy(true);
    try {
      if (imageEditor.kind === "gallery") {
        if (imageEditor.identity === "organization") {
          const uploaded = await uploadOrganizationProfileGalleryPhoto({ supabase, userId: user.id, photoUrl: imageUrl, position: organizationGallery.length + 1 });
          const saved = await saveMyOrganizationGallery({ supabase, photoUrls: [...organizationGallery, uploaded].slice(0, MAX_MEMBER_GALLERY_PHOTOS) });
          setOrganizationGallery(saved);
        } else {
          const uploaded = await uploadMemberProfileGalleryPhoto({ supabase, userId: user.id, photoUrl: imageUrl, position: athleteGallery.length + 1 });
          await saveAthlete({ ...athlete, galleryPhotos: [...athleteGallery, uploaded].slice(0, MAX_MEMBER_GALLERY_PHOTOS) });
        }
        onNotice?.("Foto ajustada e publicada na galeria.");
      } else if (imageEditor.identity === "athlete") {
        const field = imageEditor.kind === "cover" ? "coverUrl" : "photoUrl";
        const uploaded = imageEditor.kind === "cover"
          ? await uploadMemberProfileCover({ supabase, userId: user.id, coverUrl: imageUrl })
          : await uploadMemberProfilePhoto({ supabase, userId: user.id, photoUrl: imageUrl });
        await saveAthlete({ ...athlete, [field]: uploaded, galleryPhotos: athleteGallery });
      } else if (imageEditor.kind === "cover") {
        const uploaded = await uploadOrganizationProfileCover({ supabase, userId: user.id, coverUrl: imageUrl });
        const saved = await saveMyOrganizationCover({ supabase, coverUrl: uploaded });
        setOrganization((currentValue) => ({ ...currentValue, coverUrl: saved.coverUrl || uploaded }));
        const cleanGallery = await excludeOrganizationCoverFromGallery(organizationGallery, saved.coverUrl || uploaded);
        if (cleanGallery.length !== organizationGallery.length) {
          const savedGallery = await saveMyOrganizationGallery({ supabase, photoUrls: cleanGallery });
          setOrganizationGallery(savedGallery);
        }
      } else {
        const uploaded = await uploadProfilePhoto({ supabase, userId: user.id, photoUrl: imageUrl });
        const { error } = await supabase.from("profiles").update({ photo_url: uploaded }).eq("id", user.id);
        if (error) throw error;
        setOrganization((currentValue) => ({ ...currentValue, photoUrl: uploaded }));
      }
      if (imageEditor.kind !== "gallery") onNotice?.(imageEditor.kind === "cover" ? "Capa atualizada com sucesso." : "Foto do perfil atualizada com sucesso.");
      closeEditor();
      return true;
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível salvar a imagem agora.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function addGalleryPhotos(files) {
    if (!files?.length || busy) return;
    if (currentGallery.length >= MAX_MEMBER_GALLERY_PHOTOS) {
      onNotice?.("A galeria já atingiu o limite de 10 fotos.");
      return;
    }
    openEditor(files[0], "gallery");
  }

  function removeGalleryPhoto(index) {
    if (busy) return;
    setPendingGalleryRemoval({ index, identity: identityMode });
  }

  async function confirmGalleryPhotoRemoval() {
    if (busy || !pendingGalleryRemoval) return;
    const { index, identity } = pendingGalleryRemoval;
    setBusy(true);
    try {
      if (identity === "organization") {
        const saved = await saveMyOrganizationGallery({ supabase, photoUrls: organizationGallery.filter((_, photoIndex) => photoIndex !== index) });
        setOrganizationGallery(saved);
      } else {
        await saveAthlete({ ...athlete, galleryPhotos: athleteGallery.filter((_, photoIndex) => photoIndex !== index) });
      }
      setPendingGalleryRemoval(null);
      onNotice?.("Foto removida da galeria.");
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível remover a foto agora.");
    } finally {
      setBusy(false);
    }
  }

  if (!user?.id) {
    return <section className={styles.profileEmptyPage}><CircleUserRound /><h1>Entre para criar seu perfil</h1><p>O acesso reúne um perfil de atleta e, quando ativada, uma única organização.</p></section>;
  }

  if (identityMode === "organization" && !hasOrganization) {
    return <section className={styles.profileEmptyPage}><Building2 /><span>1 organização por acesso</span><h1>Crie o perfil da sua organização</h1><p>O atleta continua separado. A ativação da organização será liberada aqui sem criar um segundo login.</p></section>;
  }

  return (
    <div className={styles.profilePage}>
      <section className={styles.profileHero}>
        <div className={`${styles.profileCover} ${coverUrl ? styles.hasProfileCover : ""}`.trim()}>
          {coverUrl ? <img src={coverUrl} alt={`Capa de ${name}`} /> : <span><span /><small>Proporção de capa 851:315</small></span>}
          <label className={styles.coverEdit}><input type="file" accept="image/*" disabled={busy} onChange={(event) => { openEditor(event.target.files?.[0], "cover"); event.target.value = ""; }} /><Camera /> <span>{coverUrl ? "Alterar capa" : "Adicionar capa"}</span></label>
        </div>
        <div className={styles.profileIdentity}>
          <label className={styles.avatarEdit} title={`Alterar foto ${identityMode === "organization" ? "da arena" : "do atleta"}`}>
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => { openEditor(event.target.files?.[0], "photo"); event.target.value = ""; }} />
            <IdentityAvatar name={name} photoUrl={photoUrl} Icon={identityMode === "organization" ? Building2 : UserRound} />
            <span><Camera /></span>
          </label>
          <div className={styles.profileHeading}>
            <span className={styles.profileType}>{identityMode === "organization" ? <><Building2 /> Perfil da organização</> : <><UserRound /> Perfil do atleta</>}</span>
            <h1>{name}</h1>
            <p>{current.handle ? `@${String(current.handle).replace(/^@/, "")}` : location || (identityMode === "organization" ? "Organização esportiva" : "Atleta Torneio 360")}</p>
            {identityMode === "athlete" ? <SportBadges sports={athlete.sports || []} /> : null}
          </div>
          <div className={styles.profileStats}>
            <span><strong>{currentGallery.length}</strong><small>Fotos</small></span>
            <button type="button" onClick={() => setConnectionsView("followers")}><strong>{socialGraph.followersCount || 0}</strong><small>Seguidores</small></button>
            <button type="button" onClick={() => setConnectionsView("following")}><strong>{socialGraph.followingCount || 0}</strong><small>Seguindo</small></button>
          </div>
          <button type="button" className={styles.profileEditButton} onClick={openDetailsEditor}><Settings /> Editar informações</button>
        </div>
      </section>

      <nav className={styles.profileTabs} aria-label="Seções do perfil">
        <button type="button" className={activeSection === "activity" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("activity")}><Trophy /> {identityMode === "organization" ? "Eventos" : "Atividades"}</button>
        <button type="button" className={activeSection === "photos" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("photos")}><Images /> Fotos <span>{currentGallery.length}/{MAX_MEMBER_GALLERY_PHOTOS}</span></button>
        <button type="button" className={activeSection === "about" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("about")}><CircleUserRound /> Sobre</button>
        {identityMode === "athlete" ? <>
          <button type="button" className={activeSection === "challenges" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("challenges")}><Swords /> Desafios <span>{(profileActivity.challenges || []).filter((entry) => entry.direction === "incoming" && entry.status === "pending").length}</span></button>
          <button type="button" className={activeSection === "achievements" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("achievements")}><Award /> Conquistas <span>{(profileActivity.achievements || []).length + (profileActivity.circuitAchievements || []).length}</span></button>
        </> : null}
      </nav>

      {activeSection === "photos" ? <PhotoGallery title={identityMode === "organization" ? "Galeria da organização" : "Galeria do atleta"} photos={currentGallery} busy={busy} onAdd={addGalleryPhotos} onRemove={removeGalleryPhoto} onPreview={setPreviewPhoto} /> : null}
      {activeSection === "activity" ? <ActivityPanel activity={profileActivity} events={organizationEvents} identityMode={identityMode} /> : null}
      {identityMode === "athlete" && activeSection === "challenges" ? <ChallengesPanel supabase={supabase} userId={user?.id} challenges={profileActivity.challenges || []} busy={busy} onRespond={respondToChallenge} onSend={sendNewChallenge} /> : null}
      {identityMode === "athlete" && activeSection === "achievements" ? <AchievementsPanel achievements={[...(profileActivity.achievements || []), ...(profileActivity.circuitAchievements || [])]} /> : null}
      {activeSection === "about" ? (
        <section className={styles.profileAboutGrid}>
          <article className={styles.profilePanel}><header className={styles.profilePanelHeader}><div><CircleUserRound /><span><h2>Sobre</h2><p>Informações públicas desta identidade.</p></span></div></header><p className={styles.profileBio}>{current.bio || (identityMode === "organization" ? "Conte a história da sua organização." : "Conte um pouco sobre sua trajetória esportiva.")}</p></article>
          <article className={styles.profilePanel}><header className={styles.profilePanelHeader}><div><MapPin /><span><h2>Informações principais</h2><p>Dados separados por perfil.</p></span></div></header><dl className={styles.profileFacts}><div><dt><MapPin /></dt><dd><strong>Localização</strong><span>{location || "Não informada"}</span></dd></div><div><dt>{identityMode === "organization" ? <Building2 /> : <UsersRound />}</dt><dd><strong>{identityMode === "organization" ? "Tipo" : "Categoria"}</strong><span>{identityMode === "organization" ? "Organização" : athlete.sportsCategory || "Não informada"}</span></dd></div><div><dt><CalendarDays /></dt><dd><strong>Identidade</strong><span>{identityMode === "organization" ? "1 organização neste acesso" : "1 atleta neste acesso"}</span></dd></div></dl></article>
          {identityMode === "athlete" ? <>
            <article className={`${styles.profilePanel} ${styles.profileAboutWide}`.trim()}>
              <header className={styles.profilePanelHeader}><div><Trophy /><span><h2>Dados esportivos do atleta</h2><p>Modalidades e informações usadas nas inscrições e formação de duplas.</p></span></div></header>
              <div className={styles.profileSportSummary}><div><small>Modalidades praticadas</small><SportBadges sports={athlete.sports || []} /></div><dl><div><dt>Nível técnico</dt><dd>{athlete.sportsCategory || "Não informado"}</dd></div><div><dt>Categoria esportiva</dt><dd>{athlete.gender || "Não informada"}</dd></div><div><dt>Mão dominante</dt><dd>{athlete.dominantHand || "Não informada"}</dd></div><div><dt>Tamanho da camiseta</dt><dd>{athlete.shirtSize || "Não informado"}</dd></div></dl></div>
            </article>
            <article className={`${styles.profilePanel} ${styles.profileAboutWide}`.trim()}>
              <header className={styles.profilePanelHeader}><div><UsersRound /><span><h2>Contato para dupla e desafios</h2><p>Canais esportivos cadastrados pelo atleta.</p></span></div></header>
              <div className={styles.profileContactSummary}><div><Phone /><span><small>WhatsApp</small><strong>{athlete.whatsapp || "Não informado"}</strong></span></div><div><MessageCircle /><span><small>Telegram</small><strong>{athlete.telegram ? `@${athlete.telegram}` : "Não informado"}</strong></span></div><div><AtSign /><span><small>Instagram</small><strong>{athlete.instagram ? `@${athlete.instagram}` : "Não informado"}</strong></span></div></div>
              <p className={`${styles.profileContactPermission} ${athlete.showContacts ? styles.contactAllowed : ""}`.trim()}><ShieldCheck /> <span><strong>{athlete.showContacts ? "Contato permitido após uma combinação" : "Contato protegido"}</strong><small>{athlete.showContacts ? "Os canais poderão ser revelados apenas no fluxo esportivo autorizado." : "Os canais não serão revelados a outros atletas."}</small></span></p>
            </article>
          </> : <article className={`${styles.profilePanel} ${styles.profileAboutWide}`.trim()}><header className={styles.profilePanelHeader}><div><MessageCircle /><span><h2>Contato da organização</h2><p>Canais públicos da arena.</p></span></div></header><div className={styles.profileContactSummary}><div><Phone /><span><small>WhatsApp</small><strong>{organization.whatsapp || "Não informado"}</strong></span></div><div><AtSign /><span><small>Instagram</small><strong>{organization.handle ? `@${organization.handle}` : "Não informado"}</strong></span></div><div><MapPin /><span><small>Endereço</small><strong>{organization.address || location || "Não informado"}</strong></span></div></div></article>}
        </section>
      ) : null}

      {athleteStatus === "unavailable" ? <p className={styles.profileSchemaWarning}>A galeria do atleta aguarda a atualização do banco de homologação.</p> : null}
      {busy ? <div className={styles.profileBusy} role="status"><span /><strong>Salvando alterações...</strong></div> : null}
      {connectionsView ? <div className={styles.profileConnectionsBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConnectionsView(""); }}>
        <section className={styles.profileConnectionsModal} role="dialog" aria-modal="true" aria-labelledby="v2-connections-title">
          <header><div><span>Rede de {identityMode === "organization" ? "organização" : "atleta"}</span><h2 id="v2-connections-title">{connectionsView === "followers" ? "Seguidores" : "Seguindo"}</h2><p>As conexões pertencem ao perfil que está ativo agora.</p></div><button type="button" onClick={() => setConnectionsView("")} aria-label="Fechar"><X /></button></header>
          <div className={styles.profileConnectionsList}>
            {(socialGraph[connectionsView] || []).length ? (socialGraph[connectionsView] || []).map((connection) => {
              const targetKey = `${connection.kind}:${connection.user_id}`;
              return <article key={targetKey}>
                <IdentityAvatar name={connection.name} photoUrl={connection.photo_url} Icon={connection.kind === "organization" ? Building2 : UserRound} />
                <span><strong>{connection.name || (connection.kind === "organization" ? "Organização" : "Atleta")}</strong><small>{connection.kind === "organization" ? "Organização" : "Atleta"}{connection.handle ? ` · @${connection.handle}` : ""}</small><small>{[connection.city, connection.state].filter(Boolean).join(" · ") || "Local não informado"}</small></span>
                <button type="button" className={connection.is_following ? styles.connectionFollowing : ""} disabled={socialBusy === targetKey} onClick={() => onToggleFollow?.({ userId: connection.user_id, kind: connection.kind, name: connection.name }, !connection.is_following)}>{connection.is_following ? <><Check /> Seguindo</> : <><Plus /> Seguir</>}</button>
              </article>;
            }) : <div className={styles.profileConnectionsEmpty}><UsersRound /><strong>{connectionsView === "followers" ? "Ainda não há seguidores" : "Você ainda não segue nenhum perfil"}</strong><small>Quando houver conexões, elas aparecerão separadas nesta identidade.</small></div>}
          </div>
        </section>
      </div> : null}
      {detailsDraft ? <div className={styles.profileModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDetailsDraft(null); }}>
        <section className={styles.profileDetailsModal} role="dialog" aria-modal="true" aria-labelledby="v2-profile-editor-title">
          <header><div><span>{identityMode === "organization" ? "Perfil da organização" : "Perfil do atleta"}</span><h2 id="v2-profile-editor-title">Editar informações</h2><p>Os dados permanecem separados entre as duas identidades.</p></div><button type="button" onClick={() => setDetailsDraft(null)} disabled={busy} aria-label="Fechar edição"><X /></button></header>
          <div className={styles.profileEditorBody}>
            {identityMode === "organization" ? (
              <>
                <EditorSection Icon={Building2} title="Identidade da organização" description="Dados que identificam a arena e a pessoa responsável.">
                  <label><span>Organização</span><input value={detailsDraft.arenaName || ""} maxLength={80} placeholder="Nome da arena" onChange={(event) => updateDetailsDraft("arenaName", event.target.value)} /><FieldError message={detailsErrors.arenaName} /></label>
                  <label><span>Nome do organizador</span><input value={detailsDraft.organizerName || ""} maxLength={80} placeholder="Pessoa responsável" onChange={(event) => updateDetailsDraft("organizerName", event.target.value)} /><FieldError message={detailsErrors.organizerName} /></label>
                </EditorSection>
                <EditorSection Icon={MessageCircle} title="Contato público" description="Canais usados pelos atletas para falar com a organização.">
                  <label><span>WhatsApp</span><input inputMode="tel" value={detailsDraft.whatsapp || ""} maxLength={20} placeholder="DDD + número" onChange={(event) => updateDetailsDraft("whatsapp", event.target.value)} /><FieldError message={detailsErrors.whatsapp} /></label>
                  <label><span>@ do Instagram</span><input value={detailsDraft.instagramHandle || ""} maxLength={64} placeholder="@suaarena" onChange={(event) => updateDetailsDraft("instagramHandle", event.target.value)} /></label>
                  <label><span>Link do Instagram</span><input type="url" value={detailsDraft.instagramLink || ""} placeholder="https://instagram.com/suaarena" onChange={(event) => updateDetailsDraft("instagramLink", event.target.value)} /><FieldError message={detailsErrors.instagramLink} /></label>
                  <label><span>Link do grupo de WhatsApp</span><input type="url" value={detailsDraft.whatsappGroupLink || ""} placeholder="https://chat.whatsapp.com/..." onChange={(event) => updateDetailsDraft("whatsappGroupLink", event.target.value)} /><FieldError message={detailsErrors.whatsappGroupLink} /></label>
                </EditorSection>
                <EditorSection Icon={MapPin} title="Localização" description="No Brasil, o município aparece depois da escolha do estado.">
                  <label className={styles.profileFormWide}><span>Endereço da organização</span><input value={detailsDraft.address || ""} maxLength={180} placeholder="Rua, número e bairro" onChange={(event) => updateDetailsDraft("address", event.target.value)} /></label>
                  <label className={styles.profileFormWide}><span>Link do endereço</span><input type="url" value={detailsDraft.mapsLink || ""} placeholder="Link do Google Maps" onChange={(event) => updateDetailsDraft("mapsLink", event.target.value)} /><FieldError message={detailsErrors.mapsLink} /></label>
                  <LocationEditor draft={detailsDraft} errors={detailsErrors} cityOptions={profileCityOptions} citiesLoading={profileCitiesLoading} citiesError={profileCitiesError} onChange={updateDetailsDraft} />
                </EditorSection>
                <EditorSection Icon={CreditCard} title="Recebimentos públicos" description="Esses meios de pagamento poderão aparecer na inscrição e no perfil público.">
                  <label><span>Chave Pix da organização</span><input value={detailsDraft.pixKey || ""} maxLength={180} placeholder="Chave aleatória ou empresarial" onChange={(event) => updateDetailsDraft("pixKey", event.target.value)} /></label>
                  <label><span>Link para pagamento com cartão</span><input type="url" value={detailsDraft.cardPaymentLink || ""} placeholder="https://..." onChange={(event) => updateDetailsDraft("cardPaymentLink", event.target.value)} /><FieldError message={detailsErrors.cardPaymentLink} /></label>
                </EditorSection>
              </>
            ) : (
              <>
                <EditorSection Icon={CircleUserRound} title="Seu perfil público" description="Informações que aparecem para atletas e organizações.">
                  <label><span>Nome de exibição</span><input value={detailsDraft.name || ""} maxLength={80} onChange={(event) => updateDetailsDraft("name", event.target.value)} /><FieldError message={detailsErrors.displayName} /></label>
                  <label><span>Nome de usuário</span><span className={styles.profileInputPrefix}><AtSign aria-hidden="true" /><input value={detailsDraft.handle || ""} maxLength={30} placeholder="seunome" onChange={(event) => updateDetailsDraft("handle", event.target.value)} /></span><FieldError message={detailsErrors.handle} /></label>
                  <label className={styles.profileFormWide}><span>Apresentação</span><textarea value={detailsDraft.bio || ""} maxLength={240} rows={4} onChange={(event) => updateDetailsDraft("bio", event.target.value)} /><small className={styles.profileCharCount}>{String(detailsDraft.bio || "").length}/240</small><FieldError message={detailsErrors.bio} /></label>
                  <LocationEditor draft={detailsDraft} errors={detailsErrors} cityOptions={profileCityOptions} citiesLoading={profileCitiesLoading} citiesError={profileCitiesError} onChange={updateDetailsDraft} />
                </EditorSection>
                <EditorSection Icon={Trophy} title="Dados esportivos do atleta" description="Modalidades, nível e categoria usados para inscrições e formação de duplas.">
                  <div className={styles.profileSportPicker}><span>Modalidades praticadas</span><SportBadges sports={detailsDraft.sports || []} editable onToggle={toggleDraftSport} /><FieldError message={detailsErrors.sports} /></div>
                  <label><span>Nível técnico</span><input value={detailsDraft.sportsCategory || ""} maxLength={40} placeholder="Ex.: Iniciante ou Categoria B" onChange={(event) => updateDetailsDraft("sportsCategory", event.target.value)} /><FieldError message={detailsErrors.sportsCategory} /></label>
                  <label><span>Categoria esportiva</span><select value={detailsDraft.gender || ""} onChange={(event) => updateDetailsDraft("gender", event.target.value)}><option value="">Selecione</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select><FieldError message={detailsErrors.gender} /></label>
                  <label><span>Mão dominante</span><select value={detailsDraft.dominantHand || "Não informado"} onChange={(event) => updateDetailsDraft("dominantHand", event.target.value)}><option>Destro</option><option>Canhoto</option><option>Ambidestro</option><option>Não informado</option></select></label>
                  <label><span>Tamanho da camiseta</span><select value={detailsDraft.shirtSize || "Não informado"} onChange={(event) => updateDetailsDraft("shirtSize", event.target.value)}>{["PP", "P", "M", "G", "GG", "XGG", "Não informado"].map((size) => <option key={size}>{size}</option>)}</select></label>
                </EditorSection>
                <EditorSection Icon={UsersRound} title="Contato para dupla e desafios" description="Você controla se esses canais podem aparecer após uma combinação esportiva.">
                  <label><span>WhatsApp</span><input inputMode="tel" value={detailsDraft.whatsapp || ""} maxLength={20} placeholder="DDD + número" onChange={(event) => updateDetailsDraft("whatsapp", event.target.value)} /><FieldError message={detailsErrors.whatsapp} /></label>
                  <label><span>Telegram</span><input value={detailsDraft.telegram || ""} maxLength={64} placeholder="seuusuario" onChange={(event) => updateDetailsDraft("telegram", event.target.value)} /><FieldError message={detailsErrors.telegram} /></label>
                  <label><span>Instagram</span><input value={detailsDraft.instagram || ""} maxLength={64} placeholder="seuusuario" onChange={(event) => updateDetailsDraft("instagram", event.target.value)} /><FieldError message={detailsErrors.instagram} /></label>
                  <label className={styles.profileContactToggle}><input type="checkbox" checked={Boolean(detailsDraft.showContacts)} onChange={(event) => updateDetailsDraft("showContacts", event.target.checked)} /><span><strong>Permitir contato após uma combinação</strong><small>WhatsApp, Telegram ou Instagram só aparecem quando você habilitar.</small></span></label>
                </EditorSection>
              </>
            )}
          </div>
          <footer><button type="button" onClick={() => setDetailsDraft(null)} disabled={busy}>Cancelar</button><button type="button" onClick={saveDetails} disabled={busy}><Check /> {busy ? "Salvando..." : "Salvar alterações"}</button></footer>
        </section>
      </div> : null}
      {pendingGalleryRemoval ? <div className={styles.profileConfirmBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setPendingGalleryRemoval(null); }}>
        <section className={styles.profileConfirmModal} role="alertdialog" aria-modal="true" aria-labelledby="v2-remove-photo-title" aria-describedby="v2-remove-photo-description">
          <span className={styles.profileConfirmIcon}><Trash2 /></span>
          <div><small>Excluir da galeria</small><h2 id="v2-remove-photo-title">Apagar esta foto?</h2><p id="v2-remove-photo-description">A foto será removida da galeria do {pendingGalleryRemoval.identity === "organization" ? "perfil da organização" : "perfil do atleta"}. Esta ação não poderá ser desfeita.</p></div>
          <footer><button type="button" autoFocus onClick={() => setPendingGalleryRemoval(null)} disabled={busy}>Cancelar</button><button type="button" className={styles.profileConfirmDelete} onClick={() => void confirmGalleryPhotoRemoval()} disabled={busy}><Trash2 /> {busy ? "Apagando..." : "Apagar foto"}</button></footer>
        </section>
      </div> : null}
      {imageEditor ? <ProfileImageEditor variant="platform-v2" kind={imageEditor.kind} sourceUrl={imageEditor.sourceUrl} fileName={imageEditor.fileName} onCancel={closeEditor} onApply={applyEditedImage} /> : null}
      <PhotoLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}
