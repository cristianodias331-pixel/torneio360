import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Filter,
  RefreshCw,
  ReceiptText,
  Search,
  Trash2,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { requiresFixedDoubles } from "../../domain/modalityClassification.mjs";
import { arePairingCategoriesCompatible } from "../../domain/pairingCategory.mjs";
import {
  getTournamentGenderLabel,
  inferTournamentGenderMode,
  normalizeParticipantGender,
  participantGenderValues,
  tournamentGenderModes,
} from "../../domain/participantGenderRegistry.mjs";
import {
  loadOrganizationRegistrants,
  openOrganizationRegistrationReceipt,
  pairApprovedOrganizationRegistrations,
  removeOrganizationRegistration,
  reviewOrganizationRegistration,
} from "../../services/organizationRegistrantsApi.mjs";
import "../../styles/58-organization-registrants.css";

const statusFilters = [
  { id: "all", label: "Todos" },
  { id: "approved", label: "Aprovados" },
  { id: "submitted", label: "Em análise" },
  { id: "rejected", label: "Recusados" },
  { id: "partner", label: "Procuram dupla" },
];

function getInitials(name) {
  return String(name || "AT").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "AT";
}

function normalizeOption(value, fallback) {
  return String(value || "").trim() || fallback;
}

function getRegistrationTime(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function formatRegistrationTimestamp(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "Horário não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp)).replace(",", " às");
}

function canOrganizerPairRegistration(registration) {
  const config = modalityConfig[registration.tournament?.type];
  const hasPartner = registration.partner?.user_id || registration.partner_user_id || registration.partner_handle || registration.partner_name;
  return Boolean(requiresFixedDoubles(config) && registration.workflowStatus === "approved" && registration.looking_for_partner && !hasPartner);
}

function getPairCompatibilityError(first, second) {
  if (!first || !second) return "";
  if (String(first.tournament?.id) !== String(second.tournament?.id) || !arePairingCategoriesCompatible(first.categoryLabel, second.categoryLabel)) {
    return "Para formar duplas, selecione atletas do mesmo torneio e com nível técnico compatível.";
  }
  const mode = inferTournamentGenderMode(first.tournament?.data || {});
  const firstGender = normalizeParticipantGender(first.athlete?.gender);
  const secondGender = normalizeParticipantGender(second.athlete?.gender);
  if (firstGender === participantGenderValues.unknown || secondGender === participantGenderValues.unknown) {
    return "Os dois atletas precisam ter a categoria esportiva preenchida no perfil antes de formar a dupla.";
  }
  if (mode === tournamentGenderModes.mixed && firstGender === secondGender) {
    return "Em torneio misto, selecione atletas de categorias esportivas diferentes.";
  }
  if (mode === tournamentGenderModes.masculine && (firstGender !== participantGenderValues.masculine || secondGender !== participantGenderValues.masculine)) {
    return "Este torneio aceita somente uma dupla masculina.";
  }
  if (mode === tournamentGenderModes.feminine && (firstGender !== participantGenderValues.feminine || secondGender !== participantGenderValues.feminine)) {
    return "Este torneio aceita somente uma dupla feminina.";
  }
  return "";
}

function canRegistrationLookForPartner(registration) {
  return requiresFixedDoubles(modalityConfig[registration.tournament?.type]);
}

function RegistrantPerson({ person, fallbackName, fallbackHandle = "", label, onOpen }) {
  const displayName = person?.display_name || fallbackName || "Atleta";
  const handle = person?.handle || fallbackHandle;
  return (
    <button type="button" className="organizationRegistrantPerson" onClick={onOpen} disabled={!onOpen} title={onOpen ? `Abrir perfil de ${displayName}` : undefined}>
      <span className="organizationRegistrantAvatar">
        {person?.photo_url ? <img src={person.photo_url} alt={`Foto de ${displayName}`} /> : getInitials(displayName)}
      </span>
      <span><small>{label}</small><strong>{displayName}</strong>{handle ? <em>@{handle}</em> : <em>Perfil não vinculado</em>}</span>
    </button>
  );
}

export default function OrganizationRegistrantsPanel({ supabase, tournaments = [] }) {
  const [state, setState] = useState({ status: "loading", registrations: [], schemaAvailable: true, error: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [pairSelection, setPairSelection] = useState([]);
  const [receiptPreview, setReceiptPreview] = useState(null);

  const loadRegistrants = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await loadOrganizationRegistrants({ supabase, tournaments });
      setState({ status: "ready", registrations: result.registrations, schemaAvailable: result.schemaAvailable, error: "" });
    } catch (error) {
      console.error("Erro ao carregar inscritos da organização:", error);
      setState({ status: "error", registrations: [], schemaAvailable: true, error: "Não foi possível carregar os inscritos agora." });
    }
  }, [supabase, tournaments]);

  useEffect(() => { void loadRegistrants(); }, [loadRegistrants]);

  const registrations = useMemo(() => state.registrations.map((registration) => {
    const tournament = registration.tournament || {};
    const details = tournament.data || {};
    const genderMode = inferTournamentGenderMode(details);
    return {
      ...registration,
      tournament,
      categoryLabel: normalizeOption(registration.category || details.category, "Sem categoria"),
      genderLabel: normalizeOption(getTournamentGenderLabel(genderMode, details.genderOther) || details.gender, "Participação livre"),
      modalityLabel: normalizeOption(getModalityDisplayName(tournament.type), "Modalidade não informada"),
      paymentStatus: registration.payment_status === "paid" ? "paid" : "pending",
      workflowStatus: ["submitted", "approved", "rejected"].includes(registration.workflow_status)
        ? registration.workflow_status
        : "draft",
    };
  }), [state.registrations]);

  const metrics = useMemo(() => ({
    total: registrations.length,
    approved: registrations.filter((item) => item.workflowStatus === "approved").length,
    submitted: registrations.filter((item) => item.workflowStatus === "submitted").length,
    rejected: registrations.filter((item) => item.workflowStatus === "rejected").length,
    partner: registrations.filter((item) => item.looking_for_partner && canRegistrationLookForPartner(item)).length,
  }), [registrations]);

  const registrationOrder = useMemo(() => {
    const byTournament = new Map();
    registrations.forEach((registration) => {
      const tournamentId = String(registration.tournament?.id || registration.tournament_id || "sem-torneio");
      if (!byTournament.has(tournamentId)) byTournament.set(tournamentId, []);
      byTournament.get(tournamentId).push(registration);
    });

    const order = new Map();
    byTournament.forEach((items) => {
      items
        .sort((first, second) => getRegistrationTime(first.created_at) - getRegistrationTime(second.created_at)
          || String(first.id).localeCompare(String(second.id)))
        .forEach((registration, index) => order.set(String(registration.id), index + 1));
    });
    return order;
  }, [registrations]);

  const options = useMemo(() => ({
    tournaments: [...new Map(registrations.map((item) => [String(item.tournament?.id), { value: String(item.tournament?.id), label: item.tournament?.name || "Torneio" }])).values()],
    categories: [...new Set(registrations.map((item) => item.categoryLabel))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    genders: [...new Set(registrations.map((item) => item.genderLabel))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    modalities: [...new Set(registrations.map((item) => item.modalityLabel))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  }), [registrations]);

  const visibleRegistrations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return registrations.filter((item) => {
      if (["approved", "submitted", "rejected"].includes(statusFilter) && item.workflowStatus !== statusFilter) return false;
      if (statusFilter === "partner" && (!item.looking_for_partner || !canRegistrationLookForPartner(item))) return false;
      if (tournamentFilter !== "all" && String(item.tournament?.id) !== tournamentFilter) return false;
      if (categoryFilter !== "all" && item.categoryLabel !== categoryFilter) return false;
      if (genderFilter !== "all" && item.genderLabel !== genderFilter) return false;
      if (modalityFilter !== "all" && item.modalityLabel !== modalityFilter) return false;
      if (!normalizedSearch) return true;
      return [item.athlete_name, item.partner_name, item.tournament?.name, item.categoryLabel]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [registrations, search, statusFilter, tournamentFilter, categoryFilter, genderFilter, modalityFilter]);

  const groups = useMemo(() => {
    const grouped = new Map();
    visibleRegistrations.forEach((registration) => {
      const key = String(registration.tournament?.id || "sem-torneio");
      if (!grouped.has(key)) grouped.set(key, { tournament: registration.tournament, divisions: new Map() });
      const divisionKey = [registration.categoryLabel, registration.genderLabel, registration.modalityLabel].join("|");
      const group = grouped.get(key);
      if (!group.divisions.has(divisionKey)) {
        group.divisions.set(divisionKey, {
          categoryLabel: registration.categoryLabel,
          genderLabel: registration.genderLabel,
          modalityLabel: registration.modalityLabel,
          registrations: [],
        });
      }
      group.divisions.get(divisionKey).registrations.push(registration);
    });
    return [...grouped.values()].map((group) => ({
      ...group,
      divisions: [...group.divisions.values()].map((division) => ({
        ...division,
        registrations: division.registrations.sort((first, second) => getRegistrationTime(first.created_at) - getRegistrationTime(second.created_at)
          || String(first.id).localeCompare(String(second.id))),
      })),
    }));
  }, [visibleRegistrations]);

  const pairSelectionError = useMemo(() => {
    for (let index = 0; index + 1 < pairSelection.length; index += 2) {
      const first = registrations.find((item) => item.id === pairSelection[index]);
      const second = registrations.find((item) => item.id === pairSelection[index + 1]);
      const compatibilityError = getPairCompatibilityError(first, second);
      if (compatibilityError) return compatibilityError;
    }
    return "";
  }, [pairSelection, registrations]);

  const pairSelectionReady = pairSelection.length >= 2
    && pairSelection.length % 2 === 0
    && !pairSelectionError;

  async function reviewRegistration(registration, decision) {
    if (!state.schemaAvailable || busyId) return;
    setBusyId(registration.id);
    setNotice("");
    try {
      await reviewOrganizationRegistration({
        supabase,
        registrationId: registration.id,
        decision,
      });
      setNotice(decision === "approved" ? "Inscrição e pagamento aprovados." : "Inscrição recusada. O atleta poderá reenviar o comprovante.");
      await loadRegistrants();
    } catch (error) {
      setNotice(error?.message || "Não foi possível atualizar o pagamento.");
    } finally {
      setBusyId("");
    }
  }

  function togglePairSelection(registration) {
    if (!canOrganizerPairRegistration(registration) || busyId) return;
    setNotice("");
    setPairSelection((current) => {
      if (current.includes(registration.id)) return current.filter((id) => id !== registration.id);
      const first = registrations.find((item) => item.id === current[0]);
      if (first && (String(first.tournament?.id) !== String(registration.tournament?.id) || !arePairingCategoriesCompatible(first.categoryLabel, registration.categoryLabel))) {
        setNotice("Para formar duplas, selecione atletas do mesmo torneio e com nível técnico compatível.");
        return current;
      }
      return current.length >= 32 ? current : [...current, registration.id];
    });
  }

  async function pairSelectedRegistrations() {
    if (busyId || pairSelection.length < 2 || pairSelection.length % 2 !== 0) return;
    if (pairSelectionError) {
      setNotice(pairSelectionError);
      return;
    }
    setBusyId("pairing");
    setNotice("");
    try {
      const result = await pairApprovedOrganizationRegistrations({ supabase, registrationIds: pairSelection });
      const pairedCount = Number(result?.paired_count || pairSelection.length / 2);
      setPairSelection([]);
      setNotice(`${pairedCount} ${pairedCount === 1 ? "dupla foi formada" : "duplas foram formadas"} com sucesso.`);
      await loadRegistrants();
    } catch (error) {
      setNotice(error?.message || "Não foi possível formar as duplas selecionadas.");
    } finally {
      setBusyId("");
    }
  }

  async function openReceipt(registration) {
    if (!registration.payment_proof_path || busyId) return;
    setBusyId(`receipt-${registration.id}`);
    setNotice("");
    try {
      const url = await openOrganizationRegistrationReceipt({ supabase, path: registration.payment_proof_path });
      setReceiptPreview({
        url,
        name: registration.payment_proof_name || "Comprovante de pagamento",
        mime: registration.payment_proof_mime || "",
        athleteName: registration.athlete?.display_name || registration.athlete_name,
      });
    } catch (error) {
      setNotice(error?.message || "Não foi possível abrir o comprovante.");
    } finally {
      setBusyId("");
    }
  }

  function openAthleteProfile(address) {
    if (address) navigatePlatform({ perfil: address });
  }

  async function removeRegistration(registration) {
    if (busyId) return;
    const athleteName = registration.athlete?.display_name || registration.athlete_name || "este participante";
    if (!window.confirm(`Remover ${athleteName} deste torneio? A pessoa será notificada.`)) return;
    setBusyId(`remove-${registration.id}`);
    setNotice("");
    try {
      await removeOrganizationRegistration({ supabase, registrationId: registration.id });
      setPairSelection((current) => current.filter((id) => id !== registration.id));
      setNotice("Participante removido. O atleta e a dupla, quando houver, foram notificados.");
      await loadRegistrants();
    } catch (error) {
      setNotice(error?.message || "Não foi possível remover o participante.");
    } finally {
      setBusyId("");
    }
  }

  if (state.status === "loading") {
    return <section className="organizationRegistrantsState"><RefreshCw className="spinning" aria-hidden="true" /><strong>Organizando os inscritos...</strong></section>;
  }
  if (state.status === "error") {
    return <section className="organizationRegistrantsState hasError"><X aria-hidden="true" /><strong>{state.error}</strong><button type="button" onClick={loadRegistrants}>Tentar novamente</button></section>;
  }

  return (
    <section className="organizationRegistrantsPanel">
      <header className="organizationRegistrantsHeader">
        <div><span><Users aria-hidden="true" /></span><div><small>Gestão da organização</small><h2>Inscritos</h2><p>Atletas organizados por torneio, nível, categoria esportiva e modalidade.</p></div></div>
      </header>

      {!state.schemaAvailable ? <p className="organizationRegistrantsNotice"><Clock3 aria-hidden="true" /> Os inscritos atuais já aparecem, mas pagamento e procura de dupla serão sincronizados quando a migração do banco teste for aplicada.</p> : null}
      {notice ? <p className="organizationRegistrantsNotice isSuccess"><Check aria-hidden="true" /> {notice}</p> : null}

      <div className={`organizationPairBuilder${pairSelection.length ? " active" : ""}`}>
        <span><Users aria-hidden="true" /></span>
        <div><strong>Formar duplas com inscritos individuais</strong><small>Selecione atletas aprovados, do mesmo torneio e categoria. A ordem da seleção define as duplas.</small></div>
        <div><b>{pairSelection.length} selecionado(s)</b>{pairSelectionError ? <small className="organizationPairError" role="alert">{pairSelectionError}</small> : null}<button type="button" disabled={Boolean(busyId) || !pairSelectionReady} onClick={pairSelectedRegistrations}>{pairSelection.length > 1 && pairSelection.length % 2 === 0 ? `Formar ${pairSelection.length / 2} dupla(s)` : "Selecione uma quantidade par"}</button></div>
      </div>

      {pairSelection.length ? <div className="organizationPairFloatingAction" role="status">
        <span><Users aria-hidden="true" /><strong>{pairSelection.length} selecionado(s)</strong>{pairSelectionError ? <small>{pairSelectionError}</small> : null}</span>
        <button type="button" disabled={Boolean(busyId) || !pairSelectionReady} onClick={pairSelectedRegistrations}>{pairSelection.length > 1 && pairSelection.length % 2 === 0 ? `Formar ${pairSelection.length / 2} dupla(s)` : "Selecione mais um atleta"}</button>
      </div> : null}

      <div className="organizationRegistrantMetrics">
        <article><Users aria-hidden="true" /><span><strong>{metrics.total}</strong><small>Inscritos</small></span></article>
        <article className="paid"><BadgeCheck aria-hidden="true" /><span><strong>{metrics.approved}</strong><small>Aprovados</small></span></article>
        <article className="pending"><CircleDollarSign aria-hidden="true" /><span><strong>{metrics.submitted}</strong><small>Em análise</small></span></article>
        <article className="partner"><UserRoundSearch aria-hidden="true" /><span><strong>{metrics.partner}</strong><small>Procuram dupla</small></span></article>
      </div>

      <div className="organizationRegistrantToolbar">
        <label className="organizationRegistrantSearch"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta, dupla ou torneio" /></label>
        <nav aria-label="Filtrar situação dos inscritos">
          {statusFilters.map((item) => <button type="button" key={item.id} aria-pressed={statusFilter === item.id} className={statusFilter === item.id ? "active" : ""} onClick={() => setStatusFilter(item.id)}><span>{item.label}</span><b>{metrics[item.id] ?? metrics.total}</b></button>)}
        </nav>
      </div>

      <div className="organizationRegistrantFilters">
        <header><span><Filter aria-hidden="true" /></span><div><strong>Organizar inscritos</strong><small>Refine a lista por torneio e divisão esportiva.</small></div></header>
        <label><small>Torneio</small><select value={tournamentFilter} onChange={(event) => setTournamentFilter(event.target.value)}><option value="all">Todos</option>{options.tournaments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><small>Categoria</small><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas</option>{options.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><small>Categoria esportiva</small><select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}><option value="all">Todas</option>{options.genders.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><small>Modalidade</small><select value={modalityFilter} onChange={(event) => setModalityFilter(event.target.value)}><option value="all">Todas</option>{options.modalities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>

      {groups.length ? <div className="organizationRegistrantGroups">{groups.map((group) => {
        const details = group.tournament?.data || {};
        const registrationCount = group.divisions.reduce((total, division) => total + division.registrations.length, 0);
        return (
          <article className="organizationRegistrantTournament" key={group.tournament?.id || "sem-torneio"}>
            <header>
              <div><small>Torneio</small><h3>{group.tournament?.name || "Torneio"}</h3><p>{details.eventDate ? <><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</> : "Data não informada"}</p></div>
              <strong>{registrationCount} inscrito(s)</strong>
            </header>
            {group.divisions.map((division) => <section className="organizationRegistrantDivision" key={[division.categoryLabel, division.genderLabel, division.modalityLabel].join("|")}>
            <div className="organizationRegistrantClassification"><span>{division.categoryLabel}</span><span>{division.genderLabel}</span><span>{division.modalityLabel}</span><strong>{division.registrations.length} {division.registrations.length === 1 ? "inscrito" : "inscritos"}</strong></div>
            <div className="organizationRegistrantList">{division.registrations.map((registration) => (
              <div className={`organizationRegistrantRow${pairSelection.includes(registration.id) ? " selectedForPair" : ""}`} key={registration.id}>
                <div className="organizationRegistrantPeople">
                  <RegistrantPerson
                    person={registration.athlete}
                    fallbackName={registration.athlete_name}
                    fallbackHandle={registration.athlete_handle}
                    label="Atleta inscrito"
                    onOpen={(registration.athlete?.handle || registration.athlete_user_id) ? () => openAthleteProfile(registration.athlete?.handle || registration.athlete_user_id) : null}
                  />
                  {(registration.partner || registration.partner_name || registration.partner_handle) ? <>
                    <span className="organizationRegistrantPairConnector" aria-hidden="true">+</span>
                    <RegistrantPerson
                      person={registration.partner}
                      fallbackName={registration.partner_name}
                      fallbackHandle={registration.partner_handle}
                      label={registration.partner_status === "accepted" ? "Dupla confirmada" : "Dupla convidada"}
                      onOpen={(registration.partner?.handle || registration.partner?.user_id) ? () => openAthleteProfile(registration.partner?.handle || registration.partner?.user_id) : null}
                    />
                  </> : <span className="organizationRegistrantSolo">Inscrição individual</span>}
                  <small className="organizationRegistrantChronology"><Clock3 aria-hidden="true" /> <strong>{registrationOrder.get(String(registration.id)) || "—"}º inscrito</strong> · {formatRegistrationTimestamp(registration.created_at)}</small>
                </div>
                <div className="organizationRegistrantControls">
                  <div className="organizationRegistrantBadges"><span className={registration.workflowStatus}>{registration.workflowStatus === "approved" ? "Aprovado" : registration.workflowStatus === "submitted" ? "Em análise" : registration.workflowStatus === "rejected" ? "Recusado" : "Sem comprovante"}</span>{registration.looking_for_partner && canRegistrationLookForPartner(registration) ? <span className="partner">Procura dupla</span> : null}<span>{registration.payment_method === "card" ? "Cartão" : registration.payment_method === "pix" ? "Pix" : "Pagamento não enviado"}</span></div>
                  <div className="organizationRegistrantActions">
                  {canOrganizerPairRegistration(registration) ? <button type="button" aria-pressed={pairSelection.includes(registration.id)} className={`pair${pairSelection.includes(registration.id) ? " selected" : ""}`} disabled={Boolean(busyId)} onClick={() => togglePairSelection(registration)}>{pairSelection.includes(registration.id) ? <Check aria-hidden="true" /> : <Users aria-hidden="true" />}{pairSelection.includes(registration.id) ? "Remover da seleção" : "Selecionar para dupla"}</button> : null}
                  {registration.payment_proof_path ? <button type="button" disabled={Boolean(busyId)} onClick={() => openReceipt(registration)}><ExternalLink aria-hidden="true" /> Ver comprovante</button> : null}
                  {registration.partner_registration?.payment_proof_path ? <button type="button" disabled={Boolean(busyId)} onClick={() => openReceipt({
                    ...registration.partner_registration,
                    athlete: registration.partner,
                    athlete_name: registration.partner?.display_name || registration.partner_name,
                  })}><ExternalLink aria-hidden="true" /> Comprovante da dupla</button> : null}
                  {registration.workflowStatus === "submitted" ? <><button type="button" className="approve" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "approved")}>Aprovar</button><button type="button" className="reject" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "rejected")}>Recusar</button></> : null}
                  <button type="button" className="remove" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => removeRegistration(registration)}><Trash2 aria-hidden="true" /> Remover</button>
                  </div>
                </div>
              </div>
            ))}</div>
            </section>)}
          </article>
        );
      })}</div> : <div className="organizationRegistrantsEmpty"><Users aria-hidden="true" /><strong>Nenhum inscrito encontrado</strong><span>Altere os filtros ou aguarde novas inscrições nos torneios da organização.</span></div>}
      {receiptPreview ? <div className="organizationReceiptBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceiptPreview(null); }}>
        <section className="organizationReceiptModal" role="dialog" aria-modal="true" aria-label={`Comprovante de ${receiptPreview.athleteName}`}>
          <header><span><ReceiptText aria-hidden="true" /><span><small>Comprovante de pagamento</small><strong>{receiptPreview.athleteName}</strong></span></span><button type="button" onClick={() => setReceiptPreview(null)} aria-label="Fechar comprovante"><X aria-hidden="true" /></button></header>
          <div className="organizationReceiptViewer">
            {receiptPreview.mime.startsWith("image/") || /\.(?:jpe?g|png|webp)$/iu.test(receiptPreview.name) ? <img src={receiptPreview.url} alt={receiptPreview.name} /> : <iframe src={receiptPreview.url} title={receiptPreview.name} />}
          </div>
          <footer><span>{receiptPreview.name}</span><a href={receiptPreview.url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Abrir em nova aba</a></footer>
        </section>
      </div> : null}
    </section>
  );
}
