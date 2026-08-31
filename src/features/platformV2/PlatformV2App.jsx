import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Clock3,
  Flame,
  FileText,
  GitBranch,
  Home,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Save,
  Share2,
  Sparkles,
  Pencil,
  Tag,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { loadMyAthleteActivity } from "../../services/athleteActivityApi.mjs";
import { copyToClipboard } from "../../services/clipboard.mjs";
import { createMemberProfileFallback } from "../../domain/memberProfile.mjs";
import { loadMyMemberProfile } from "../../services/memberProfileApi.mjs";
import { loadMySocialGraph, setProfileFollow } from "../../services/socialGraphApi.mjs";
import { getTournamentLifecycleStatus } from "../../domain/tournamentLifecycle.mjs";
import { normalizeTournamentSummaryRow, tournamentSummarySelect } from "../../domain/tournamentSummary.mjs";
import PlatformV2Profile from "./PlatformV2Profile.jsx";
import styles from "./PlatformV2App.module.css";

const NAVIGATION = [
  { id: "overview", label: "Visão geral", Icon: Home, ready: true },
  { id: "profile", label: "Meu perfil", Icon: UserRound, ready: true },
  { id: "tournaments", label: "Torneios", Icon: Trophy, ready: true },
  { id: "circuits", label: "Circuitos", Icon: GitBranch },
  { id: "registrations", label: "Inscrições", Icon: ClipboardCheck },
  { id: "partners", label: "Duplas e desafios", Icon: UsersRound },
  { id: "ranking", label: "Ranking", Icon: Award },
  { id: "notifications", label: "Notificações", Icon: Bell },
  { id: "organization", label: "Organizar", Icon: Building2, ready: true },
];

const QUICK_FILTERS = [
  ["all", "Para você"],
  ["nearby", "Perto de você"],
  ["open", "Inscrições abertas"],
  ["beach", "Beach Tennis"],
];

const V2_TAB_PARAM = "v2_tab";
const V2_IDENTITY_PARAM = "v2_identity";
const RESTORABLE_V2_TABS = new Set(NAVIGATION.map(({ id }) => id).filter((id) => id !== "organization"));

function getInitialV2Tab() {
  const tab = new URLSearchParams(window.location.search).get(V2_TAB_PARAM);
  return RESTORABLE_V2_TABS.has(tab) ? tab : "overview";
}

function getInitialV2Identity(profile) {
  const identity = new URLSearchParams(window.location.search).get(V2_IDENTITY_PARAM);
  const hasOrganization = Boolean(profile?.arena_name || profile?.organization_name);
  return identity === "organization" && hasOrganization ? "organization" : "athlete";
}

function replaceV2Location(tab, identity) {
  const url = new URL(window.location.href);
  url.searchParams.set("app", "v2");
  url.searchParams.set(V2_TAB_PARAM, RESTORABLE_V2_TABS.has(tab) ? tab : "overview");
  url.searchParams.set(V2_IDENTITY_PARAM, identity === "organization" ? "organization" : "athlete");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const EMPTY_SOCIAL_GRAPH = {
  identityKind: "athlete",
  followersCount: 0,
  followingCount: 0,
  followers: [],
  following: [],
  schemaAvailable: true,
};

const TOURNAMENT_CREATION_STEPS = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Formato" },
  { id: 3, label: "Agenda" },
  { id: 4, label: "Divulgação" },
  { id: 5, label: "Revisão" },
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

function getTournamentGenderLabel(item) {
  const details = getDetails(item);
  const value = String(
    details.genderOther
    || details.gender
    || details.participantGenderMode
    || details.genderMode
    || ""
  ).trim();
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (["male", "masculino", "masculina"].includes(normalized)) return "Masculino";
  if (["female", "feminino", "feminina"].includes(normalized)) return "Feminino";
  if (["mixed", "misto", "mista"].includes(normalized)) return "Misto";
  return value;
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

function Poster({ item, alt, onMediaReady }) {
  const cover = getCover(item);
  if (!cover) return <EmptyPoster name={getEventName(item)} />;
  return (
    <span className={styles.posterStage}>
      <img className={styles.posterBackdrop} src={cover} alt="" aria-hidden="true" />
      <img
        className={styles.posterImage}
        src={cover}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) onMediaReady?.(naturalWidth / naturalHeight);
        }}
      />
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

function CreateTournamentWizard({ profile, runtime, onClose, onNotice }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [validationError, setValidationError] = useState("");
  const [saved, setSaved] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [regulationsFile, setRegulationsFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [draft, setDraft] = useState(() => ({
    name: "",
    structure: "single",
    modality: "beach_tennis",
    category: "",
    groupedCategories: [""],
    composition: "mixed",
    winningScore: "6",
    rankingRule: "wins_balance_games",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    startTime: "",
    location: [profile?.arena_name || profile?.organization_name, profile?.city, profile?.state].filter(Boolean).join(" · "),
    partnerMode: "ready",
    regulationsText: "",
  }));

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return undefined;
    }
    const preview = URL.createObjectURL(coverFile);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [coverFile]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationError("");
    setSaved(false);
  }

  function updateGroupedCategory(index, value) {
    setDraft((current) => ({
      ...current,
      groupedCategories: current.groupedCategories.map((category, categoryIndex) => categoryIndex === index ? value : category),
    }));
    setValidationError("");
    setSaved(false);
  }

  function addGroupedCategory() {
    setDraft((current) => ({ ...current, groupedCategories: [...current.groupedCategories, ""] }));
    setSaved(false);
  }

  function removeGroupedCategory(index) {
    setDraft((current) => ({ ...current, groupedCategories: current.groupedCategories.filter((_, categoryIndex) => categoryIndex !== index) }));
    setValidationError("");
    setSaved(false);
  }

  function validateStep(step) {
    if (step === 1 && draft.name.trim().length < 3) return "Informe o nome do evento para continuar.";
    if (step === 2) {
      const categoriesReady = draft.structure === "grouped"
        ? draft.groupedCategories.length > 0 && draft.groupedCategories.every((category) => category.trim())
        : draft.category.trim();
      if (!draft.modality || !categoriesReady || !draft.composition) return "Defina modalidade, todas as categorias e a composição.";
    }
    if (step === 3) {
      if (!draft.startDate || !draft.registrationDeadline || !draft.startTime || !draft.location.trim()) return "Preencha data, prazo de inscrição, horário e local.";
      if (draft.endDate && draft.endDate < draft.startDate) return "A data final não pode ser anterior ao início.";
      if (draft.registrationDeadline > draft.startDate) return "O prazo de inscrição deve terminar até a data de início.";
    }
    return "";
  }

  function openStep(step) {
    const available = step === currentStep || step < currentStep || completedSteps.includes(step);
    if (!available) return;
    setCurrentStep(step);
    setValidationError("");
  }

  function advance() {
    const error = validateStep(currentStep);
    if (error) {
      setValidationError(error);
      return;
    }
    setCompletedSteps((current) => current.includes(currentStep) ? current : [...current, currentStep]);
    setValidationError("");
    if (currentStep < TOURNAMENT_CREATION_STEPS.length) {
      setCurrentStep((step) => step + 1);
      return;
    }
    setSaved(true);
    onNotice?.("Rascunho do torneio salvo no fluxo V2.");
  }

  function goBack() {
    if (currentStep === 1) {
      onClose?.();
      return;
    }
    setCurrentStep((step) => step - 1);
    setValidationError("");
  }

  const formatDate = (value) => value ? runtime.formatDate(value) : "Não informado";
  const compositionLabel = { male: "Masculino", female: "Feminino", mixed: "Misto", free: "Livre" }[draft.composition] || "Não informado";
  const modalityLabel = { beach_tennis: "Beach Tennis", tennis: "Tênis", volleyball: "Vôlei", footvolley: "Futevôlei", pickleball: "Pickleball" }[draft.modality] || draft.modality;
  const categoryLabel = draft.structure === "grouped"
    ? draft.groupedCategories.filter((category) => category.trim()).join(" · ") || "Sem categorias"
    : draft.category || "Sem categoria";

  return (
    <section className={styles.createTournamentPage} aria-labelledby="create-tournament-title">
      <header className={styles.createTournamentHeader}>
        <div><span className={styles.kicker}>Novo evento</span><h1 id="create-tournament-title">Criar torneio</h1><p>Preencha por etapas. As informações permanecem salvas ao avançar ou voltar.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar criação"><X /></button>
      </header>

      <nav className={styles.createTournamentSteps} aria-label="Etapas da criação do torneio">
        {TOURNAMENT_CREATION_STEPS.map((step) => {
          const completed = completedSteps.includes(step.id);
          const active = currentStep === step.id;
          const available = active || step.id < currentStep || completed;
          return (
            <button
              type="button"
              key={step.id}
              className={`${active ? styles.activeCreateStep : ""} ${completed ? styles.completedCreateStep : ""}`.trim()}
              onClick={() => openStep(step.id)}
              disabled={!available}
              aria-current={active ? "step" : undefined}
              aria-label={`${step.label}${completed ? ", concluída" : active ? ", etapa atual" : ""}`}
            >
              <span>{step.id}</span>
              <strong>{step.label}</strong>
            </button>
          );
        })}
      </nav>

      <div className={styles.createTournamentBody}>
        {currentStep === 1 ? (
          <section className={styles.createTournamentPanel} aria-labelledby="create-step-information">
            <header><span><FileText /></span><div><h2 id="create-step-information">Informações principais</h2><p>Comece pelo nome e escolha como o evento será organizado.</p></div></header>
            <div className={styles.createTournamentFields}>
              <label className={styles.createTournamentWideField}><span>Nome do evento/torneio</span><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Ex.: Mistão Arena 500" autoFocus /></label>
              <fieldset className={styles.createTournamentWideField}>
                <legend>Estrutura do evento</legend>
                <div className={styles.createTournamentChoiceGrid}>
                  <button type="button" className={draft.structure === "single" ? styles.selectedCreateChoice : ""} onClick={() => updateDraft("structure", "single")}><span><Trophy /></span><div><strong>Torneio único</strong><small>Uma categoria e uma programação.</small></div></button>
                  <button type="button" className={draft.structure === "grouped" ? styles.selectedCreateChoice : ""} onClick={() => updateDraft("structure", "grouped")}><span><LayoutGrid /></span><div><strong>Torneios agrupados</strong><small>Várias categorias dentro do mesmo evento e da mesma publicação.</small></div></button>
                </div>
              </fieldset>
              <div className={styles.createTournamentPhotoRule}><ImagePlus /><span><strong>Uma única foto para o evento</strong><small>A mesma capa será usada no torneio único ou em todas as categorias agrupadas.</small></span></div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <section className={styles.createTournamentPanel} aria-labelledby="create-step-format">
            <header><span><Trophy /></span><div><h2 id="create-step-format">Formato da competição</h2><p>Defina modalidade, categoria e composição dos participantes.</p></div></header>
            <div className={styles.createTournamentFields}>
              <label><span>Modalidade</span><select value={draft.modality} onChange={(event) => updateDraft("modality", event.target.value)}><option value="beach_tennis">Beach Tennis</option><option value="tennis">Tênis</option><option value="volleyball">Vôlei</option><option value="footvolley">Futevôlei</option><option value="pickleball">Pickleball</option></select></label>
              {draft.structure === "single" ? <label><span>Categoria</span><input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} placeholder="Ex.: Categoria C" /></label> : <div className={styles.createTournamentCategoryList}><span>Categorias agrupadas</span>{draft.groupedCategories.map((category, index) => <div key={`category-${index}`}><input value={category} onChange={(event) => updateGroupedCategory(index, event.target.value)} placeholder={`Categoria ${index + 1}`} />{draft.groupedCategories.length > 1 ? <button type="button" onClick={() => removeGroupedCategory(index)} aria-label={`Remover categoria ${index + 1}`}><Trash2 /></button> : null}</div>)}<button type="button" onClick={addGroupedCategory}><Plus /> Adicionar categoria</button></div>}
              <fieldset className={styles.createTournamentWideField}><legend>Composição</legend><div className={styles.createTournamentPills}>{[["male", "Masculino"], ["female", "Feminino"], ["mixed", "Misto"], ["free", "Livre"]].map(([value, label]) => <button type="button" key={value} className={draft.composition === value ? styles.selectedCreatePill : ""} onClick={() => updateDraft("composition", value)}>{label}</button>)}</div></fieldset>
              <label><span>Games para vencer</span><select value={draft.winningScore} onChange={(event) => updateDraft("winningScore", event.target.value)}><option value="4">4 games</option><option value="6">6 games</option><option value="8">8 games</option></select></label>
              <label><span>Critério do ranking</span><select value={draft.rankingRule} onChange={(event) => updateDraft("rankingRule", event.target.value)}><option value="wins_balance_games">Vitórias → saldo → games</option><option value="wins_games_head_to_head">Vitórias → games → confronto direto</option></select></label>
              {draft.structure === "grouped" ? <div className={styles.createTournamentInfo}><ImagePlus /><span><strong>Uma capa compartilhada</strong><small>Todas as categorias acima usarão a mesma foto geral do evento.</small></span></div> : null}
            </div>
          </section>
        ) : null}

        {currentStep === 3 ? (
          <section className={styles.createTournamentPanel} aria-labelledby="create-step-agenda">
            <header><span><CalendarDays /></span><div><h2 id="create-step-agenda">Agenda e local</h2><p>Organize o período, as inscrições e o início dos jogos.</p></div></header>
            <div className={styles.createTournamentFields}>
              <label><span>Início do torneio</span><input type="date" value={draft.startDate} onChange={(event) => updateDraft("startDate", event.target.value)} /></label>
              <label><span>Fim do torneio</span><input type="date" value={draft.endDate} onChange={(event) => updateDraft("endDate", event.target.value)} /></label>
              <label><span>Inscrições até</span><input type="date" value={draft.registrationDeadline} onChange={(event) => updateDraft("registrationDeadline", event.target.value)} /></label>
              <label><span>Horário de início</span><input type="time" value={draft.startTime} onChange={(event) => updateDraft("startTime", event.target.value)} /></label>
              <label className={styles.createTournamentWideField}><span>Local</span><input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} placeholder="Arena e quadra" /></label>
              <fieldset className={styles.createTournamentWideField}><legend>Inscrição em dupla</legend><div className={styles.createTournamentChoiceGrid}><button type="button" className={draft.partnerMode === "ready" ? styles.selectedCreateChoice : ""} onClick={() => updateDraft("partnerMode", "ready")}><span><UsersRound /></span><div><strong>Somente dupla pronta</strong><small>A inscrição exigirá os dois atletas.</small></div></button><button type="button" className={draft.partnerMode === "finder" ? styles.selectedCreateChoice : ""} onClick={() => updateDraft("partnerMode", "finder")}><span><Search /></span><div><strong>Encontre sua dupla</strong><small>O atleta poderá entrar sozinho e procurar um parceiro.</small></div></button></div></fieldset>
            </div>
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section className={styles.createTournamentPanel} aria-labelledby="create-step-publication">
            <header><span><ImagePlus /></span><div><h2 id="create-step-publication">Divulgação e regulamento</h2><p>Escolha a única foto que representará todo o evento.</p></div></header>
            <div className={styles.createTournamentPublication}>
              <label className={styles.createTournamentUpload}>
                {coverPreview ? <img src={coverPreview} alt="Prévia da foto única do evento" /> : <span><ImagePlus /><strong>Escolher foto do evento</strong><small>Uma capa para o torneio único ou para todas as categorias agrupadas.</small></span>}
                <input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
              </label>
              <div className={styles.createTournamentFields}>
                <label><span>Regulamento em PDF</span><input type="file" accept="application/pdf" onChange={(event) => setRegulationsFile(event.target.files?.[0] || null)} /></label>
                {regulationsFile ? <small className={styles.createTournamentFileName}>{regulationsFile.name}</small> : null}
                <label><span>Resumo do regulamento</span><textarea value={draft.regulationsText} onChange={(event) => updateDraft("regulationsText", event.target.value)} placeholder="Categorias, formato, conduta e premiação." /></label>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 5 ? (
          <section className={styles.createTournamentPanel} aria-labelledby="create-step-review">
            <header><span><Check /></span><div><h2 id="create-step-review">Revisar e salvar</h2><p>Confira como as informações principais serão publicadas.</p></div></header>
            <div className={styles.createTournamentReview}>
              <div className={styles.createTournamentReviewPoster}>{coverPreview ? <img src={coverPreview} alt="Foto do evento" /> : <span><ImagePlus /><strong>Foto única do evento</strong><small>{coverFile?.name || "Ainda não escolhida"}</small></span>}</div>
              <dl>
                <div><dt>Evento</dt><dd>{draft.name || "Não informado"}</dd></div>
                <div><dt>Estrutura</dt><dd>{draft.structure === "grouped" ? "Torneios agrupados" : "Torneio único"}</dd></div>
                <div><dt>Formato</dt><dd>{modalityLabel} · {categoryLabel} · {compositionLabel}</dd></div>
                <div><dt>Data e horário</dt><dd>{formatDate(draft.startDate)} · {draft.startTime || "Não informado"}</dd></div>
                <div><dt>Local</dt><dd>{draft.location || "Não informado"}</dd></div>
                <div><dt>Inscrição</dt><dd>{draft.partnerMode === "finder" ? "Encontre sua dupla ativado" : "Somente dupla pronta"}</dd></div>
              </dl>
            </div>
          </section>
        ) : null}
      </div>

      <footer className={styles.createTournamentFooter}>
        <span className={validationError ? styles.createTournamentError : saved ? styles.createTournamentSaved : ""} role={validationError ? "alert" : "status"}>{validationError || (saved ? "Rascunho salvo. Seus dados continuam disponíveis para revisão." : `Etapa ${currentStep} de ${TOURNAMENT_CREATION_STEPS.length}`)}</span>
        <div><button type="button" onClick={goBack}>{currentStep === 1 ? "Cancelar" : "Voltar"}</button><button type="button" className={styles.createTournamentPrimaryAction} onClick={advance}>{currentStep === 5 ? <><Save /> Salvar rascunho</> : <>Continuar <ChevronRight /></>}</button></div>
      </footer>
    </section>
  );
}

function OrganizationTournaments({
  supabase,
  user,
  profile,
  runtime,
  onManageOrganization,
  onShare,
  onNotice,
}) {
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const organizationName = getProfileName(user, profile);
  const organizationPhoto = getProfilePhoto(user, profile);
  const organizationLocation = [profile?.city, profile?.state].filter(Boolean).join(" · ") || "Local não informado";

  useEffect(() => {
    if (!user?.id) {
      setState({ status: "ready", items: [], error: "" });
      return undefined;
    }

    let active = true;
    setState((current) => ({ ...current, status: "loading", error: "" }));

    (async () => {
      let { data, error } = await supabase
        .from("tournaments")
        .select(tournamentSummarySelect)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      let summarized = !error;

      if (error) {
        ({ data, error } = await supabase
          .from("tournaments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }));
        summarized = false;
      }

      if (!active) return;
      if (error) {
        setState({ status: "error", items: [], error: "Não foi possível carregar os torneios da organização." });
        return;
      }

      const items = (data || [])
        .map((item) => summarized ? normalizeTournamentSummaryRow(item) : item)
        .filter((item) => !item.data?.deletedAt);
      setState({ status: "ready", items, error: "" });
    })();

    return () => { active = false; };
  }, [supabase, user?.id]);

  const lifecycleCounts = useMemo(() => state.items.reduce((counts, item) => {
    const status = getTournamentLifecycleStatus(item);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 }), [state.items]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return state.items.filter((item) => {
      if (getTournamentLifecycleStatus(item) !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const details = getDetails(item);
      return [
        getEventName(item),
        runtime.getModalityName(item.type),
        details.category,
        getTournamentGenderLabel(item),
        getLocation(item),
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    });
  }, [runtime, search, state.items, statusFilter]);

  function manage(params) {
    onManageOrganization?.(params);
  }

  if (creating) {
    return <CreateTournamentWizard profile={profile} runtime={runtime} onClose={() => setCreating(false)} onNotice={onNotice} />;
  }

  return (
    <section className={styles.organizationTournamentsPage} aria-labelledby="organization-tournaments-title">
      <header className={styles.organizationTournamentsHeader}>
        <div><span className={styles.kicker}>Gestão da organização</span><h1 id="organization-tournaments-title">Torneios</h1><p>Edite, abra e acompanhe os torneios publicados pela organização.</p></div>
        <button type="button" onClick={() => setCreating(true)}><Plus /> Criar torneio</button>
      </header>

      <div className={styles.organizationTournamentToolbar}>
        <nav aria-label="Filtrar torneios por situação">
          <button type="button" className={statusFilter === "active" ? styles.selectedTournamentFilter : ""} onClick={() => setStatusFilter("active")}><strong>{lifecycleCounts.active}</strong><span>Em andamento</span></button>
          <button type="button" className={statusFilter === "upcoming" ? styles.selectedTournamentFilter : ""} onClick={() => setStatusFilter("upcoming")}><strong>{lifecycleCounts.upcoming}</strong><span>Próximos</span></button>
          <button type="button" className={statusFilter === "finished" ? styles.selectedTournamentFilter : ""} onClick={() => setStatusFilter("finished")}><strong>{lifecycleCounts.finished}</strong><span>Encerrados</span></button>
        </nav>
        <label><Search /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, modalidade, categoria ou local" aria-label="Pesquisar torneios da organização" />{search ? <button type="button" onClick={() => setSearch("")} aria-label="Limpar pesquisa"><X /></button> : null}</label>
      </div>

      <div className={styles.organizationTournamentList}>
        {state.status === "loading" ? <div className={styles.feedState}><LoaderCircle /><strong>Carregando torneios...</strong></div> : null}
        {state.error ? <div className={styles.feedState}><X /><strong>{state.error}</strong></div> : null}
        {state.status === "ready" && !visibleItems.length ? <div className={styles.feedState}><Trophy /><strong>Nenhum torneio corresponde a este filtro.</strong></div> : null}

        {visibleItems.map((item) => {
          const details = getDetails(item);
          const name = getEventName(item);
          const category = String(details.category || "").trim();
          const gender = getTournamentGenderLabel(item);
          const startTime = String(details.eventStartTime || details.startTime || "").trim();
          const registrationOpen = runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item));
          return (
            <article className={styles.organizationTournamentCard} key={item.id || item.public_id}>
              <header>
                <span className={styles.organizationTournamentIdentity}>
                  <span className={styles.organizerAvatar}>{organizationPhoto ? <img src={organizationPhoto} alt="" /> : getInitials(organizationName)}</span>
                  <span><strong>{organizationName}</strong><small>{organizationLocation}</small></span>
                </span>
                <span className={registrationOpen ? styles.openBadge : styles.closedBadge}>{registrationOpen ? "Inscrições abertas" : "Inscrições encerradas"}</span>
              </header>

              <div className={styles.organizationTournamentContent}>
                <button type="button" className={styles.organizationTournamentPoster} onClick={() => manage({ aba: "criar", torneio: item.id })} aria-label={`Abrir ${name}`}>
                  <Poster item={item} alt={`Arte de ${name}`} />
                </button>
                <div className={styles.organizationTournamentSummary}>
                  <div className={styles.organizationTournamentInfo}>
                    <span>{runtime.getModalityName(item.type)}</span>
                    <h2>{name}</h2>
                    <small>Informações principais do torneio</small>
                    <div>
                      {category ? <span><Tag /><strong>{category}</strong></span> : null}
                      {gender ? <span><UsersRound /><strong>{gender}</strong></span> : null}
                      {getEventDate(item) ? <span><CalendarDays /><strong>{runtime.formatDate(getEventDate(item))}</strong></span> : null}
                      {startTime ? <span><Clock3 /><strong>{startTime}</strong></span> : null}
                      <span><MapPin /><strong>{getLocation(item)}</strong></span>
                    </div>
                  </div>
                  <footer className={styles.organizationTournamentActions}>
                    <button type="button" onClick={() => manage({ aba: "ajustes", perfil: "publicacoes", identidade: "organizacao", editar_torneio: item.id })}><Pencil /> Editar</button>
                    <button type="button" onClick={() => manage({ aba: "criar", torneio: item.id })}><ChevronRight /> Abrir</button>
                    <button type="button" className={styles.organizationTournamentDelete} onClick={() => manage({ aba: "ajustes", perfil: "publicacoes", identidade: "organizacao", excluir_torneio: item.id })}><Trash2 /> Excluir</button>
                    <button type="button" onClick={() => onShare(item)}><Share2 /> Compartilhar</button>
                  </footer>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function PlatformV2App({
  runtime,
  supabase,
  user = null,
  profile = null,
  onLogin,
  onLogout,
  onOrganizationSubscription,
  onManageOrganization,
}) {
  const [activeTab, setActiveTab] = useState(getInitialV2Tab);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [feed, setFeed] = useState({ status: "loading", items: [], error: "", hasMore: false, nextCursor: null });
  const [activity, setActivity] = useState({ registrations: [], circuits: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");
  const [posterRatios, setPosterRatios] = useState({});
  const [identityMode, setIdentityMode] = useState(() => getInitialV2Identity(profile));
  const [identitySummaries, setIdentitySummaries] = useState({});
  const [socialGraph, setSocialGraph] = useState(EMPTY_SOCIAL_GRAPH);
  const [socialBusy, setSocialBusy] = useState("");
  const sidebarHoverTimer = useRef(null);
  const sidebarOpen = sidebarPinned || sidebarHovered;
  const hasSession = Boolean(user?.id);
  const hasOrganization = Boolean(profile?.arena_name || profile?.organization_name);
  const athleteProfileFallback = useMemo(() => createMemberProfileFallback({
    user,
    accessProfile: hasOrganization ? null : profile,
  }), [hasOrganization, profile, user]);
  const fallbackAthleteSummary = {
    name: hasSession && hasOrganization ? "Carregando atleta..." : athleteProfileFallback.displayName || "Atleta",
    photoUrl: user?.user_metadata?.avatar_url || "",
    label: "Perfil do atleta",
  };
  const fallbackOrganizationSummary = {
    name: getProfileName(user, profile),
    photoUrl: getProfilePhoto(user, profile),
    label: "Perfil da organização",
  };
  const currentSummary = identitySummaries[identityMode]
    || (identityMode === "organization" ? fallbackOrganizationSummary : fallbackAthleteSummary);

  const updateIdentitySummary = useCallback((mode, summary) => {
    setIdentitySummaries((current) => {
      if (current[mode]?.name === summary?.name && current[mode]?.photoUrl === summary?.photoUrl) return current;
      return { ...current, [mode]: summary };
    });
  }, []);

  useEffect(() => {
    if (!hasOrganization) return;
    updateIdentitySummary("organization", fallbackOrganizationSummary);
  }, [
    fallbackOrganizationSummary.name,
    fallbackOrganizationSummary.photoUrl,
    hasOrganization,
    updateIdentitySummary,
  ]);

  useEffect(() => {
    if (!hasSession) return undefined;

    let active = true;
    loadMyMemberProfile({ supabase, fallback: athleteProfileFallback }).then(({ profile: memberProfile }) => {
      if (!active) return;
      updateIdentitySummary("athlete", {
        name: memberProfile.displayName || "Atleta",
        photoUrl: memberProfile.photoUrl || "",
        label: "Perfil do atleta",
      });
    }).catch(() => {
      if (!active) return;
      updateIdentitySummary("athlete", {
        name: athleteProfileFallback.displayName || "Atleta",
        photoUrl: athleteProfileFallback.photoUrl || "",
        label: "Perfil do atleta",
      });
    });

    return () => { active = false; };
  }, [athleteProfileFallback, hasSession, supabase, updateIdentitySummary, user?.id]);

  useEffect(() => {
    const previous = document.documentElement.dataset.platformV2;
    document.documentElement.dataset.platformV2 = "true";
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.platformV2;
      else document.documentElement.dataset.platformV2 = previous;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const noticeTimer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(noticeTimer);
  }, [notice]);

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
    if (!hasSession) {
      setSocialGraph({ ...EMPTY_SOCIAL_GRAPH, identityKind: identityMode });
      return undefined;
    }
    let active = true;
    loadMySocialGraph({ supabase, identityKind: identityMode }).then((result) => {
      if (active) setSocialGraph(result);
    }).catch(() => {
      if (active) setSocialGraph({ ...EMPTY_SOCIAL_GRAPH, identityKind: identityMode, schemaAvailable: false });
    });
    return () => { active = false; };
  }, [hasSession, identityMode, supabase, user?.id]);

  useEffect(() => {
    const mobile = window.matchMedia?.("(max-width: 1080px)").matches;
    if (!mobile || !sidebarOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [sidebarOpen]);

  useEffect(() => () => {
    if (sidebarHoverTimer.current) window.clearTimeout(sidebarHoverTimer.current);
  }, []);

  const organizers = useMemo(() => {
    const values = new Map();
    feed.items.forEach((item) => {
      const id = getOrganizationId(item);
      if (id && !values.has(id)) values.set(id, item);
    });
    return Array.from(values.values());
  }, [feed.items]);

  const followedOrganizationIds = useMemo(() => new Set(
    (socialGraph.following || [])
      .filter((entry) => entry.kind === "organization")
      .map((entry) => String(entry.user_id))
  ), [socialGraph.following]);

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
    }).sort((first, second) => {
      const score = (item) => (
        Number(followedOrganizationIds.has(String(getOrganizationId(item)))) * 100
        + Number(Boolean(getCover(item))) * 2
        + Number(runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item)))
      );
      return score(second) - score(first);
    });
  }, [feed.items, followedOrganizationIds, organizationFilter, profile?.city, profile?.state, query, quickFilter, runtime]);

  const upcoming = useMemo(
    () => [...feed.items]
      .sort((first, second) => {
        const score = (item) => (
          Number(Boolean(getCover(item))) * 2
          + Number(runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item)))
        );
        return score(second) - score(first);
      })
      .slice(0, 3),
    [feed.items, runtime]
  );
  const registrations = (activity.registrations || []).filter((entry) => entry.bucket !== "past").slice(0, 2);

  function selectTab(tab, { identity = identityMode } = {}) {
    setActiveTab(tab);
    replaceV2Location(tab, identity);
    setAccountOpen(false);
    if (window.matchMedia?.("(max-width: 1080px)").matches) {
      setSidebarPinned(false);
      setSidebarHovered(false);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function selectIdentity(mode) {
    setIdentityMode(mode);
    selectTab("profile", { identity: mode });
  }

  function selectNavigationItem(id) {
    if (id === "organization") {
      if (!hasSession) {
        onLogin?.();
        return;
      }
      if (identityMode === "organization") {
        onManageOrganization?.();
        return;
      }
      onOrganizationSubscription?.();
      return;
    }
    selectTab(id);
  }

  function openSidebarOnHover() {
    if (!window.matchMedia?.("(min-width: 1081px)").matches) return;
    if (sidebarHoverTimer.current) window.clearTimeout(sidebarHoverTimer.current);
    setSidebarHovered(true);
  }

  function closeSidebarOnHover() {
    if (!window.matchMedia?.("(min-width: 1081px)").matches) return;
    if (sidebarHoverTimer.current) window.clearTimeout(sidebarHoverTimer.current);
    sidebarHoverTimer.current = window.setTimeout(() => setSidebarHovered(false), 140);
  }

  function closeSidebar() {
    if (sidebarHoverTimer.current) window.clearTimeout(sidebarHoverTimer.current);
    setSidebarPinned(false);
    setSidebarHovered(false);
  }

  function toggleSidebarPin() {
    if (sidebarHoverTimer.current) window.clearTimeout(sidebarHoverTimer.current);
    if (sidebarPinned) {
      setSidebarPinned(false);
      setSidebarHovered(false);
      return;
    }
    setSidebarPinned(true);
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

  async function changeFollow(target, follow) {
    if (!hasSession) {
      onLogin?.();
      return false;
    }
    const targetKey = `${target.kind}:${target.userId}`;
    setSocialBusy(targetKey);
    try {
      const nextGraph = await setProfileFollow({
        supabase,
        followerKind: identityMode,
        followedUserId: target.userId,
        followedKind: target.kind,
        follow,
      });
      setSocialGraph(nextGraph);
      setNotice(follow ? `Agora você segue ${target.name || "este perfil"}.` : `Você deixou de seguir ${target.name || "este perfil"}.`);
      return true;
    } catch (error) {
      setNotice(error?.message || "Não foi possível atualizar este perfil agora.");
      return false;
    } finally {
      setSocialBusy("");
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
          <button type="button" className={styles.menuButton} onClick={toggleSidebarPin} onMouseEnter={openSidebarOnHover} onMouseLeave={closeSidebarOnHover} aria-label={sidebarPinned ? "Recolher menu" : sidebarHovered ? "Fixar menu aberto" : "Abrir menu"} aria-expanded={sidebarOpen}><Menu /></button>
          <Brand />
        </div>

        {activeTab === "overview" ? (
          <label className={styles.topSearch}>
            <Search />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar torneios, eventos ou organizadores" aria-label="Buscar torneios, eventos ou organizadores" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X /></button> : null}
          </label>
        ) : <strong className={styles.topbarPageName}>{activeTab === "profile" ? (identityMode === "organization" ? "Perfil da organização" : "Perfil do atleta") : NAVIGATION.find((entry) => entry.id === activeTab)?.label}</strong>}

        <div className={styles.topActions} role="toolbar" aria-label="Ações fixas da plataforma">
          <button type="button" className={styles.notificationButton} onClick={() => window.location.reload()} aria-label="Recarregar página" title="Recarregar página"><RefreshCw /></button>
          <button type="button" className={styles.notificationButton} onClick={() => selectTab("notifications")} aria-label="Abrir notificações"><Bell /></button>
          {hasSession ? (
            <div className={styles.accountWrap}>
              <button type="button" className={styles.accountButton} onClick={() => setAccountOpen((current) => !current)} aria-expanded={accountOpen}>
                <span className={styles.accountAvatar}>{currentSummary.photoUrl ? <img src={currentSummary.photoUrl} alt="" /> : getInitials(currentSummary.name)}</span>
                <span><strong>{currentSummary.name}</strong><small>{currentSummary.label}</small></span>
                <ChevronDown />
              </button>
              {accountOpen ? <div className={styles.accountMenu}>
                <span className={styles.accountMenuLabel}>Usar o Torneio 360 como</span>
                <button type="button" className={identityMode === "athlete" ? styles.activeIdentity : ""} onClick={() => selectIdentity("athlete")}><UserRound /><span><strong>{identitySummaries.athlete?.name || fallbackAthleteSummary.name}</strong><small>Perfil do atleta</small></span>{identityMode === "athlete" ? <Check /> : null}</button>
                {hasOrganization ? <button type="button" className={identityMode === "organization" ? styles.activeIdentity : ""} onClick={() => selectIdentity("organization")}><Building2 /><span><strong>{identitySummaries.organization?.name || fallbackOrganizationSummary.name}</strong><small>Perfil da organização</small></span>{identityMode === "organization" ? <Check /> : null}</button> : null}
                <span className={styles.identityLimit}>1 atleta + 1 organização por acesso</span>
                <i />
                <button type="button" onClick={() => selectTab("profile")}><CircleUserRound /><span><strong>Meu perfil</strong><small>Fotos e informações</small></span></button>
                <button type="button" onClick={onLogout}><LogOut /><span><strong>Sair</strong><small>Encerrar sessão</small></span></button>
              </div> : null}
            </div>
          ) : <button type="button" className={styles.loginButton} onClick={onLogin} aria-label="Entrar"><LogIn /><span>Entrar</span></button>}
        </div>
      </header>

      <button type="button" className={styles.mobileBackdrop} onClick={closeSidebar} aria-label="Fechar menu" />
      <aside className={styles.sidebar} aria-label="Navegação da plataforma V2" onMouseEnter={openSidebarOnHover} onMouseLeave={closeSidebarOnHover}>
        <nav>
          {NAVIGATION.filter(({ id }) => id !== "notifications").map(({ id, label, Icon, ready }) => {
            const organizationCta = id === "organization" && identityMode === "athlete";
            const visibleLabel = id === "organization" ? (organizationCta ? "Seja organizador" : "Gestão da organização") : label;
            const helperText = id === "organization"
              ? organizationCta
                ? "Assine e crie campeonatos"
                : "Administrar eventos e assinatura"
              : !ready ? "Em construção" : "";
            return <button type="button" key={id} className={`${activeTab === id ? styles.activeNav : ""} ${organizationCta ? styles.organizerCta : ""}`.trim()} onClick={() => selectNavigationItem(id)} aria-current={activeTab === id ? "page" : undefined} title={visibleLabel}>
              <span><Icon /></span>
              <strong>{visibleLabel}</strong>
              {helperText && sidebarOpen ? <small>{helperText}</small> : null}
            </button>;
          })}
        </nav>
        <div className={styles.sidebarFoot}><Flame /><span><strong>Plataforma V2</strong><small>Prévia de homologação</small></span></div>
      </aside>

      <main className={styles.main}>
        {notice ? <div className={styles.notice} role="status"><Check /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X /></button></div> : null}
        {activeTab === "profile" ? (
          <PlatformV2Profile
            supabase={supabase}
            user={user}
            accessProfile={profile}
            identityMode={identityMode}
            activity={activity}
            feedItems={feed.items}
            socialGraph={socialGraph}
            socialBusy={socialBusy}
            onToggleFollow={changeFollow}
            onIdentitySummaryChange={updateIdentitySummary}
            onNotice={setNotice}
          />
        ) : activeTab === "tournaments" && identityMode === "organization" ? (
          <OrganizationTournaments
            supabase={supabase}
            user={user}
            profile={profile}
            runtime={runtime}
            onManageOrganization={onManageOrganization}
            onShare={share}
            onNotice={setNotice}
          />
        ) : activeTab !== "overview" ? <ComingSoon tab={activeTab} /> : (
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
                  const itemKey = String(item.id || item.public_id);
                  const name = getEventName(item);
                  const details = getDetails(item);
                  const category = String(details.category || "").trim();
                  const gender = getTournamentGenderLabel(item);
                  const startTime = String(details.eventStartTime || details.startTime || "").trim();
                  const registrationOpen = runtime.isRegistrationOpen(runtime.getRegistrationDeadline(item));
                  const organizationId = String(getOrganizationId(item));
                  const isFollowingOrganization = (socialGraph.following || []).some((entry) => entry.kind === "organization" && String(entry.user_id) === organizationId);
                  const posterRatio = posterRatios[itemKey];
                  const posterColumn = posterRatio ? Math.min(382, Math.max(250, Math.round(466 * posterRatio))) : null;
                  const posterHeight = posterRatio ? Math.round(posterColumn / posterRatio) : null;
                  const posterLayout = posterRatio ? {
                    "--v2-poster-ratio": String(posterRatio),
                    "--v2-poster-column": `${posterColumn}px`,
                    "--v2-poster-height": `${posterHeight}px`,
                  } : undefined;
                  return (
                    <article className={styles.post} key={itemKey}>
                      <header className={styles.postHeader}>
                        <button type="button" className={styles.organizerIdentity} onClick={() => setOrganizationFilter(getOrganizationId(item))}><OrganizerAvatar item={item} /><span><strong>{getOrganizationName(item)}</strong><small>{getLocation(item)}</small></span></button>
                        <span className={styles.postHeaderActions}>
                          {organizationId && organizationId !== String(user?.id || "") ? <button type="button" className={`${styles.postFollowButton} ${isFollowingOrganization ? styles.following : ""}`.trim()} disabled={socialBusy === `organization:${organizationId}`} onClick={() => changeFollow({ userId: organizationId, kind: "organization", name: getOrganizationName(item) }, !isFollowingOrganization)}>{isFollowingOrganization ? <><Check /> Seguindo</> : <><Plus /> Seguir</>}</button> : null}
                          <span className={registrationOpen ? styles.openBadge : styles.closedBadge}>{registrationOpen ? "Inscrições abertas" : "Encerrado"}</span>
                        </span>
                      </header>
                      <div className={styles.postContent} style={posterLayout} data-poster-shape={posterRatio >= 0.92 ? "square" : "portrait"}>
                        <button type="button" className={styles.posterButton} onClick={() => openDetails(item)} aria-label={`Ver detalhes de ${name}`}>
                          <Poster
                            item={item}
                            alt={`Arte de ${name}`}
                            onMediaReady={(ratio) => setPosterRatios((current) => current[itemKey] === ratio ? current : { ...current, [itemKey]: ratio })}
                          />
                        </button>
                        <div className={styles.postSummary}>
                          <div className={styles.postBody}>
                            <span className={styles.postModality}>{runtime.getModalityName(item.type)}</span>
                            <h2>{name}</h2>
                            <small>Informações principais do torneio</small>
                          </div>
                          <div className={styles.postFacts} aria-label={`Informações de ${name}`}>
                            {category ? <span><Tag /> <strong>{category}</strong></span> : null}
                            {gender ? <span><UsersRound /> <strong>{gender}</strong></span> : null}
                            {getEventDate(item) ? <span><CalendarDays /> <strong>{runtime.formatDate(getEventDate(item))}</strong></span> : null}
                            {startTime ? <span><Clock3 /> <strong>{startTime}</strong></span> : null}
                            <span><MapPin /> <strong>{getLocation(item)}</strong></span>
                          </div>
                          <footer className={styles.postActions}>
                            <button type="button" onClick={() => openDetails(item)}><ChevronRight /> Ver detalhes</button>
                            <button type="button" onClick={() => share(item)}><Share2 /> Compartilhar</button>
                            {registrationOpen ? <button type="button" className={styles.primaryAction} onClick={() => openDetails(item, true)}><ClipboardCheck /> Inscrever-se</button> : null}
                          </footer>
                        </div>
                      </div>
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
