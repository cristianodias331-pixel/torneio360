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
  Search,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { isCupType, isFixedTeamType, isIndividualCupType } from "../../domain/modalityClassification.mjs";
import {
  getTournamentGenderLabel,
  inferTournamentGenderMode,
} from "../../domain/participantGenderRegistry.mjs";
import {
  loadOrganizationRegistrants,
  openOrganizationRegistrationReceipt,
  pairApprovedOrganizationRegistrations,
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
  const doublesCompetition = config && !isIndividualCupType(config) && (isFixedTeamType(config) || isCupType(config));
  const hasPartner = registration.partner?.user_id || registration.partner_user_id || registration.partner_handle || registration.partner_name;
  return Boolean(doublesCompetition && registration.workflowStatus === "approved" && !hasPartner);
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
      genderLabel: normalizeOption(getTournamentGenderLabel(genderMode, details.genderOther) || details.gender, "Gênero livre"),
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
    partner: registrations.filter((item) => item.looking_for_partner).length,
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
      if (statusFilter === "partner" && !item.looking_for_partner) return false;
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
      const compatible = !first || (
        String(first.tournament?.id) === String(registration.tournament?.id)
        && first.categoryLabel === registration.categoryLabel
      );
      if (!compatible) {
        setNotice("Para formar duplas, selecione atletas do mesmo torneio e da mesma categoria.");
        return current;
      }
      return current.length >= 32 ? current : [...current, registration.id];
    });
  }

  async function pairSelectedRegistrations() {
    if (busyId || pairSelection.length < 2 || pairSelection.length % 2 !== 0) return;
    setBusyId("pairing");
    setNotice("");
    try {
      const result = await pairApprovedOrganizationRegistrations({ supabase, registrationIds: pairSelection });
      const pairedCount = Number(result?.paired_count || pairSelection.length / 2);
      setPairSelection([]);
      setNotice(`${pairedCount} ${pairedCount === 1 ? "dupla foi formada" : "duplas foram formadas"}. Os atletas receberam uma notificação.`);
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
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNotice(error?.message || "Não foi possível abrir o comprovante.");
    } finally {
      setBusyId("");
    }
  }

  function openAthleteProfile(registration) {
    const athleteAddress = registration.athlete?.handle || registration.athlete_user_id;
    if (athleteAddress) navigatePlatform({ perfil: athleteAddress });
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
        <div><span><Users aria-hidden="true" /></span><div><small>Gestão da organização</small><h2>Inscritos</h2><p>Atletas organizados por torneio, categoria, gênero e modalidade.</p></div></div>
      </header>

      {!state.schemaAvailable ? <p className="organizationRegistrantsNotice"><Clock3 aria-hidden="true" /> Os inscritos atuais já aparecem, mas pagamento e procura de dupla serão sincronizados quando a migração do banco teste for aplicada.</p> : null}
      {notice ? <p className="organizationRegistrantsNotice isSuccess"><Check aria-hidden="true" /> {notice}</p> : null}

      <div className={`organizationPairBuilder${pairSelection.length ? " active" : ""}`}>
        <span><Users aria-hidden="true" /></span>
        <div><strong>Formar duplas com inscritos individuais</strong><small>Selecione atletas aprovados, do mesmo torneio e categoria. A ordem da seleção define as duplas.</small></div>
        <div><b>{pairSelection.length} selecionado(s)</b><button type="button" disabled={Boolean(busyId) || pairSelection.length < 2 || pairSelection.length % 2 !== 0} onClick={pairSelectedRegistrations}>{pairSelection.length > 1 && pairSelection.length % 2 === 0 ? `Formar ${pairSelection.length / 2} dupla(s)` : "Selecione uma quantidade par"}</button></div>
      </div>

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
        <label><small>Gênero</small><select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}><option value="all">Todos</option>{options.genders.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
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
                <button type="button" className="organizationRegistrantAvatar" onClick={() => openAthleteProfile(registration)} title="Abrir perfil do atleta">{registration.athlete?.photo_url ? <img src={registration.athlete.photo_url} alt={`Foto de ${registration.athlete?.display_name || registration.athlete_name}`} /> : getInitials(registration.athlete_name)}</button>
                <div className="organizationRegistrantIdentity"><button type="button" onClick={() => openAthleteProfile(registration)} title="Abrir perfil do atleta"><strong>{registration.athlete?.display_name || registration.athlete_name}</strong>{registration.athlete?.handle ? <em>@{registration.athlete.handle}</em> : null}</button><small>{registration.partner_handle ? `Dupla convidada: @${registration.partner_handle}` : registration.partner_name ? `Dupla: ${registration.partner_name}` : "Inscrição individual"}</small><small className="organizationRegistrantChronology"><Clock3 aria-hidden="true" /> <strong>{registrationOrder.get(String(registration.id)) || "—"}º inscrito</strong> · {formatRegistrationTimestamp(registration.created_at)}</small></div>
                <div className="organizationRegistrantControls">
                  <div className="organizationRegistrantBadges"><span className={registration.workflowStatus}>{registration.workflowStatus === "approved" ? "Aprovado" : registration.workflowStatus === "submitted" ? "Em análise" : registration.workflowStatus === "rejected" ? "Recusado" : "Sem comprovante"}</span>{registration.looking_for_partner ? <span className="partner">Procura dupla</span> : null}<span>{registration.payment_method === "card" ? "Cartão" : registration.payment_method === "pix" ? "Pix" : "Pagamento não enviado"}</span></div>
                  <div className="organizationRegistrantActions">
                  {canOrganizerPairRegistration(registration) ? <button type="button" aria-pressed={pairSelection.includes(registration.id)} className={`pair${pairSelection.includes(registration.id) ? " selected" : ""}`} disabled={Boolean(busyId)} onClick={() => togglePairSelection(registration)}>{pairSelection.includes(registration.id) ? <Check aria-hidden="true" /> : <Users aria-hidden="true" />}{pairSelection.includes(registration.id) ? "Remover da seleção" : "Selecionar para dupla"}</button> : null}
                  {registration.payment_proof_path ? <button type="button" disabled={Boolean(busyId)} onClick={() => openReceipt(registration)}><ExternalLink aria-hidden="true" /> Ver comprovante</button> : null}
                  {registration.workflowStatus === "submitted" ? <><button type="button" className="approve" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "approved")}>Aprovar</button><button type="button" className="reject" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "rejected")}>Recusar</button></> : null}
                  </div>
                </div>
              </div>
            ))}</div>
            </section>)}
          </article>
        );
      })}</div> : <div className="organizationRegistrantsEmpty"><Users aria-hidden="true" /><strong>Nenhum inscrito encontrado</strong><span>Altere os filtros ou aguarde novas inscrições nos torneios da organização.</span></div>}
    </section>
  );
}
