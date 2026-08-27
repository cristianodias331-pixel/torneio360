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
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import {
  getTournamentGenderLabel,
  inferTournamentGenderMode,
} from "../../domain/participantGenderRegistry.mjs";
import {
  loadOrganizationRegistrants,
  openOrganizationRegistrationReceipt,
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
    return [...grouped.values()].map((group) => ({ ...group, divisions: [...group.divisions.values()] }));
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

      <div className="organizationRegistrantMetrics">
        <article><Users aria-hidden="true" /><span><strong>{metrics.total}</strong><small>Inscritos</small></span></article>
        <article className="paid"><BadgeCheck aria-hidden="true" /><span><strong>{metrics.approved}</strong><small>Aprovados</small></span></article>
        <article className="pending"><CircleDollarSign aria-hidden="true" /><span><strong>{metrics.submitted}</strong><small>Em análise</small></span></article>
        <article className="partner"><UserRoundSearch aria-hidden="true" /><span><strong>{metrics.partner}</strong><small>Procuram dupla</small></span></article>
      </div>

      <div className="organizationRegistrantToolbar">
        <label className="organizationRegistrantSearch"><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar atleta, dupla ou torneio" /></label>
        <nav aria-label="Filtrar situação dos inscritos">
          {statusFilters.map((item) => <button type="button" key={item.id} className={statusFilter === item.id ? "active" : ""} onClick={() => setStatusFilter(item.id)}>{item.label}<span>{metrics[item.id] ?? metrics.total}</span></button>)}
        </nav>
      </div>

      <div className="organizationRegistrantFilters">
        <span><Filter aria-hidden="true" /> Dividir por</span>
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
            <div className="organizationRegistrantClassification"><span>{division.categoryLabel}</span><span>{division.genderLabel}</span><span>{division.modalityLabel}</span><strong>{division.registrations.length}</strong></div>
            <div className="organizationRegistrantList">{division.registrations.map((registration) => (
              <div className="organizationRegistrantRow" key={registration.id}>
                <span className="organizationRegistrantAvatar">{registration.athlete?.photo_url ? <img src={registration.athlete.photo_url} alt="" /> : getInitials(registration.athlete_name)}</span>
                <div className="organizationRegistrantIdentity"><strong>{registration.athlete?.display_name || registration.athlete_name}</strong><small>{registration.partner_name ? `Dupla: ${registration.partner_name}` : "Inscrição individual"}</small></div>
                <div className="organizationRegistrantBadges"><span className={registration.workflowStatus}>{registration.workflowStatus === "approved" ? "Aprovado" : registration.workflowStatus === "submitted" ? "Em análise" : registration.workflowStatus === "rejected" ? "Recusado" : "Sem comprovante"}</span>{registration.looking_for_partner ? <span className="partner">Procura dupla</span> : null}<span>{registration.payment_method === "card" ? "Cartão" : registration.payment_method === "pix" ? "Pix" : "Pagamento não enviado"}</span></div>
                <div className="organizationRegistrantActions">
                  {registration.payment_proof_path ? <button type="button" disabled={Boolean(busyId)} onClick={() => openReceipt(registration)}><ExternalLink aria-hidden="true" /> Comprovante</button> : null}
                  {registration.workflowStatus === "submitted" ? <><button type="button" className="approve" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "approved")}>Aprovar</button><button type="button" className="reject" disabled={!state.schemaAvailable || Boolean(busyId)} onClick={() => reviewRegistration(registration, "rejected")}>Recusar</button></> : null}
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
