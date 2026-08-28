import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  AtSign,
  CalendarDays,
  Check,
  ExternalLink,
  Flame,
  GitBranch,
  Heart,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { requiresFixedDoubles } from "../../domain/modalityClassification.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import {
  loadMyAthleteActivity,
  loadPublicAthleteActivity,
  respondAthleteChallenge,
  sendAthleteChallenge,
  setMyPartnerSearch,
} from "../../services/athleteActivityApi.mjs";
import "../../styles/57-athlete-activity.css";

const activityFilters = [
  { id: "all", label: "Tudo" },
  { id: "participating", label: "Participando" },
  { id: "registered", label: "Inscrições" },
  { id: "past", label: "Já participei" },
];

const circuitFilters = [
  { id: "all", label: "Todos" },
  { id: "participating", label: "Em andamento" },
  { id: "past", label: "Concluídos" },
];

function getInitials(name) {
  return String(name || "T3").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "T3";
}

function getChallengeLabel(type) {
  return type === "match" ? "Desafio para uma partida" : "Desafio de frequência";
}

function getStatusLabel(status) {
  if (status === "accepted") return "Aceito";
  if (status === "declined") return "Recusado";
  if (status === "cancelled") return "Cancelado";
  return "Aguardando resposta";
}

function getRegistrationStatus(item) {
  if (item?.workflow_status === "approved") return { tone: "approved", label: "Inscrição aprovada" };
  if (item?.workflow_status === "submitted") return { tone: "submitted", label: "Comprovante em análise" };
  if (item?.workflow_status === "rejected") return { tone: "rejected", label: "Reenvio necessário" };
  return { tone: "draft", label: item?.bucket === "past" ? "Já participou" : item?.bucket === "participating" ? "Participando" : "Inscrição iniciada" };
}

function getActivityDate(item) {
  const rawDate = item?.tournament?.event_date || item?.created_at || item?.registered_at || "";
  if (!rawDate) return null;
  const date = new Date(String(rawDate).includes("T") ? rawDate : `${rawDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildSixMonthActivity(registrations) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      count: 0,
    };
  });
  registrations.forEach((registration) => {
    const date = getActivityDate(registration);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = months.find((item) => item.key === key);
    if (month) month.count += 1;
  });
  const maximum = Math.max(1, ...months.map((month) => month.count));
  return months.map((month) => ({
    ...month,
    height: month.count ? Math.max(18, Math.round((month.count / maximum) * 100)) : 4,
  }));
}

function AthletePerformance({ activity, profile, schemaNotice }) {
  const registrations = activity.registrations || [];
  const circuits = activity.circuits || [];
  const achievements = activity.achievements || [];
  const participating = registrations.filter((item) => item.bucket === "participating").length;
  const registered = registrations.filter((item) => item.bucket === "registered").length;
  const past = registrations.filter((item) => item.bucket === "past").length;
  const total = registrations.length;
  const maximumType = Math.max(1, total, circuits.length);
  const monthActivity = buildSixMonthActivity(registrations);
  const statusRows = [
    { label: "Participando", value: participating, tone: "current" },
    { label: "Inscrições", value: registered, tone: "registered" },
    { label: "Histórico", value: past, tone: "past" },
  ];
  const podiumCounts = [1, 2, 3].map((placement) => achievements.filter((item) => Number(item.placement) === placement).length);
  const selfAthlete = {
    user_id: profile?.userId,
    handle: profile?.handle,
    display_name: profile?.displayName,
    photo_url: profile?.photoUrl,
  };

  return (
    <section className="publicMemberSection athletePerformancePanel">
      <header className="athleteActivityHeader">
        <div><Award aria-hidden="true" /><span><h2>Desempenho e conquistas</h2><small>Indicadores gerados com as participações registradas na plataforma.</small></span></div>
      </header>
      {schemaNotice}

      <div className="athletePodiumSummary" aria-label="Resumo das conquistas oficiais">
        <article className="total"><Trophy aria-hidden="true" /><span><strong>{achievements.length}</strong><small>Pódios oficiais</small></span></article>
        <article className="gold"><strong>{podiumCounts[0]}</strong><span>1º lugar</span></article>
        <article className="silver"><strong>{podiumCounts[1]}</strong><span>2º lugar</span></article>
        <article className="bronze"><strong>{podiumCounts[2]}</strong><span>3º lugar</span></article>
      </div>

      {achievements.length ? (
        <div className="athleteAchievementList">
          {achievements.map((achievement) => (
            <article className={`athleteAchievementCard place${achievement.placement}`} key={achievement.id}>
              <span className="athleteAchievementPlacement"><strong>{achievement.placement}º</strong><small>lugar</small></span>
              <div className="athleteAchievementMain">
                <header>
                  <div><small>{achievement.bracket_name || "Principal"}</small><h3>{achievement.tournament?.name || "Torneio"}</h3></div>
                  <span><ShieldCheck aria-hidden="true" /> Confirmada por {achievement.organization?.name || "organização"}</span>
                </header>
                <p>{[
                  achievement.category,
                  achievement.event_date ? formatDateBR(achievement.event_date) : "",
                ].filter(Boolean).join(" · ")}</p>
                <div className={`athleteAchievementTeam${achievement.partner ? " isPair" : ""}`}>
                  <AchievementAthleteLink athlete={selfAthlete} label={achievement.partner ? "Atleta da dupla" : "Atleta"} />
                  {achievement.partner ? <AchievementAthleteLink athlete={achievement.partner} label="Dupla fixa" /> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="athleteAchievementEmpty">
          <Award aria-hidden="true" />
          <strong>Nenhuma conquista oficial confirmada</strong>
          <span>Quando a organização confirmar um 1º, 2º ou 3º lugar no pódio do torneio, ele aparecerá aqui com a data e a dupla vinculada.</span>
        </div>
      )}

      <div className="athletePerformanceSummary" aria-label="Resumo do desempenho esportivo">
        <article><strong>{total}</strong><span>Torneios registrados</span></article>
        <article><strong>{participating}</strong><span>Participações atuais</span></article>
        <article><strong>{past}</strong><span>Histórico concluído</span></article>
        <article><strong>{circuits.length}</strong><span>Circuitos vinculados</span></article>
      </div>

      <div className="athletePerformanceCharts">
        <article className="athletePerformanceCard">
          <header><strong>Situação dos torneios</strong><small>{total} registro(s)</small></header>
          <div className="athleteStatusChart">
            {statusRows.map((item) => (
              <div key={item.label}>
                <span><small>{item.label}</small><strong>{item.value}</strong></span>
                <i><b className={item.tone} style={{ width: `${total ? Math.round((item.value / total) * 100) : 0}%` }} /></i>
              </div>
            ))}
          </div>
        </article>

        <article className="athletePerformanceCard">
          <header><strong>Atividade por tipo</strong><small>Torneios e circuitos</small></header>
          <div className="athleteTypeChart">
            <div><span><Trophy aria-hidden="true" /> Torneios</span><i><b style={{ width: `${Math.round((total / maximumType) * 100)}%` }} /></i><strong>{total}</strong></div>
            <div><span><GitBranch aria-hidden="true" /> Circuitos</span><i><b style={{ width: `${Math.round((circuits.length / maximumType) * 100)}%` }} /></i><strong>{circuits.length}</strong></div>
          </div>
        </article>

        <article className="athletePerformanceCard athletePerformanceTimeline">
          <header><strong>Eventos por mês</strong><small>Últimos seis meses</small></header>
          <div className="athleteMonthChart" aria-label="Eventos registrados por mês">
            {monthActivity.map((month) => (
              <div key={month.key} title={`${month.label}: ${month.count}`}>
                <strong>{month.count}</strong>
                <i><b style={{ height: `${month.height}%` }} /></i>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      {!total && !circuits.length ? (
        <p className="athletePerformanceFootnote">Os gráficos serão preenchidos automaticamente após a primeira inscrição ou participação confirmada.</p>
      ) : (
        <p className="athletePerformanceFootnote">Somente pódios confirmados pela organização entram nas conquistas. Resultados provisórios não alteram estas estatísticas.</p>
      )}
    </section>
  );
}

function ContactActions({ athlete }) {
  const whatsapp = String(athlete?.whatsapp || "").replace(/\D/g, "");
  const telegram = String(athlete?.telegram || "").replace(/^@+/, "");
  const instagram = String(athlete?.instagram || "").replace(/^@+/, "");
  if (!whatsapp && !telegram && !instagram) {
    return <small className="athleteContactUnavailable">O atleta ainda não liberou um meio de contato.</small>;
  }
  return (
    <div className="athleteActivityContacts">
      {whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
      {telegram ? <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer"><Send aria-hidden="true" /> Telegram</a> : null}
      {instagram ? <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> Instagram</a> : null}
    </div>
  );
}

function AthleteAvatar({ athlete }) {
  return (
    <span className="athleteActivityAvatar" aria-hidden="true">
      {athlete?.photo_url ? <img src={athlete.photo_url} alt="" /> : getInitials(athlete?.display_name)}
    </span>
  );
}

function AchievementAthleteLink({ athlete, label }) {
  if (!athlete) return null;
  const address = athlete.handle || athlete.user_id;
  return (
    <button
      type="button"
      className="athleteAchievementPerson"
      disabled={!address}
      onClick={() => { if (address) navigatePlatform({ perfil: address }); }}
    >
      <AthleteAvatar athlete={athlete} />
      <span><small>{label}</small><strong>{athlete.display_name || "Atleta"}</strong>{athlete.handle ? <em>@{athlete.handle}</em> : null}</span>
    </button>
  );
}

export default function AthleteProfileActivity({
  supabase,
  profile,
  activeTab,
  owner = false,
  onOpenTournament = null,
}) {
  const [state, setState] = useState({ status: "loading", activity: null, schemaAvailable: true, error: "" });
  const [filter, setFilter] = useState("all");
  const [activitySection, setActivitySection] = useState("tournaments");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const loadActivity = useCallback(async () => {
    if (!supabase || !profile?.userId) return;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = owner
        ? await loadMyAthleteActivity({ supabase })
        : await loadPublicAthleteActivity({ supabase, userId: profile.userId });
      setState({ status: "ready", activity: result.activity, schemaAvailable: result.schemaAvailable, error: "" });
    } catch (error) {
      console.error("Erro ao carregar a atividade do atleta:", error);
      setState({ status: "error", activity: null, schemaAvailable: true, error: "Não foi possível carregar esta área agora." });
    }
  }, [owner, profile?.userId, supabase]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const activity = state.activity || { registrations: [], circuits: [], myPartnerSearches: [], partnerMatches: [], challenges: [], achievements: [] };
  const visibleRegistrations = useMemo(() => activity.registrations.filter((item) => filter === "all" || item.bucket === filter), [activity.registrations, filter]);
  const visibleCircuits = useMemo(() => activity.circuits.filter((item) => filter === "all" || item.bucket === filter), [activity.circuits, filter]);
  const fixedDoublesRegistrations = useMemo(() => activity.registrations.filter((item) => (
    requiresFixedDoubles(modalityConfig[item.tournament?.type])
  )), [activity.registrations]);
  const fixedDoublesTournamentIds = useMemo(() => new Set(
    fixedDoublesRegistrations.map((item) => String(item.tournament?.id || "")).filter(Boolean)
  ), [fixedDoublesRegistrations]);
  const activeSearchTournamentIds = useMemo(() => new Set(
    activity.myPartnerSearches
      .map((item) => String(item.tournament_id || ""))
      .filter((id) => id && fixedDoublesTournamentIds.has(id))
  ), [activity.myPartnerSearches, fixedDoublesTournamentIds]);
  const eligiblePartnerRegistrations = fixedDoublesRegistrations.filter((item) => item.bucket !== "past" && !item.partner_name);
  const fixedDoublesPartnerMatches = useMemo(() => activity.partnerMatches.filter((item) => (
    fixedDoublesTournamentIds.has(String(item.tournament?.id || ""))
  )), [activity.partnerMatches, fixedDoublesTournamentIds]);
  const showPartnerSearch = owner && (
    eligiblePartnerRegistrations.length > 0
    || activeSearchTournamentIds.size > 0
    || fixedDoublesPartnerMatches.length > 0
  );

  useEffect(() => {
    if (activitySection === "partners" && !showPartnerSearch) setActivitySection("tournaments");
  }, [activitySection, showPartnerSearch]);

  async function togglePartnerSearch(registration) {
    const tournamentId = registration.tournament?.id;
    if (!tournamentId || busyId) return;
    const active = !activeSearchTournamentIds.has(String(tournamentId));
    setBusyId(`partner-${tournamentId}`);
    setNotice("");
    try {
      await setMyPartnerSearch({ supabase, tournamentId, category: registration.category, active });
      setNotice(active ? "Seu sinal de procura por dupla está ativo." : "Você saiu da busca por dupla deste torneio.");
      await loadActivity();
    } catch (error) {
      setNotice(error?.message || "Não foi possível atualizar a busca por dupla.");
    } finally {
      setBusyId("");
    }
  }

  async function sendChallenge(type) {
    if (busyId) return;
    setBusyId(`challenge-${type}`);
    setNotice("");
    try {
      await sendAthleteChallenge({ supabase, challengedUserId: profile.userId, challengeType: type });
      setNotice("Desafio enviado. Nenhuma mensagem foi enviada; o atleta recebeu apenas o seu sinal.");
    } catch (error) {
      setNotice(error?.message || "Entre na plataforma para enviar este desafio.");
    } finally {
      setBusyId("");
    }
  }

  async function respond(challenge, status) {
    if (busyId) return;
    setBusyId(`response-${challenge.id}`);
    setNotice("");
    try {
      await respondAthleteChallenge({ supabase, challengeId: challenge.id, status });
      setNotice(status === "accepted" ? "Desafio aceito. Os contatos liberados já podem ser usados para combinar os detalhes." : "Desafio atualizado.");
      await loadActivity();
    } catch (error) {
      setNotice(error?.message || "Não foi possível responder ao desafio.");
    } finally {
      setBusyId("");
    }
  }

  function openTournament(item) {
    if (onOpenTournament) {
      onOpenTournament(item.tournament);
      return;
    }
    if (item.tournament?.public_id) navigatePlatform({ public: item.tournament.public_id });
  }

  function selectActivitySection(section) {
    setActivitySection(section);
    setFilter("all");
    setNotice("");
  }

  function renderPartnerContent() {
    return (
      <div className="athletePartnerHubContent">
        {notice ? <p className="athleteActivityNotice">{notice}</p> : null}
        <div className="athletePartnerSearches">
          <h3>Meus torneios sem dupla</h3>
          {eligiblePartnerRegistrations.length ? eligiblePartnerRegistrations.map((registration) => {
            const active = activeSearchTournamentIds.has(String(registration.tournament?.id || ""));
            return <article key={registration.id}><span><Trophy aria-hidden="true" /></span><div><strong>{registration.tournament?.name}</strong><small>{registration.category || "Categoria do torneio"}</small></div><button type="button" className={active ? "active" : ""} disabled={Boolean(busyId)} onClick={() => togglePartnerSearch(registration)}>{active ? <><Check aria-hidden="true" /> Procurando dupla</> : <><Heart aria-hidden="true" /> Avisar que procuro dupla</>}</button></article>;
          }) : <div className="athleteActivityEmpty compact"><Users aria-hidden="true" /><strong>Nenhuma inscrição sem dupla</strong><span>Quando você se inscrever individualmente em um torneio de duplas, ele aparecerá aqui.</span></div>}
        </div>

        <div className="athletePartnerMatches">
          <h3>Atletas compatíveis</h3>
          {fixedDoublesPartnerMatches.length ? fixedDoublesPartnerMatches.map((match) => (
            <article key={match.id}>
              <AthleteAvatar athlete={match.athlete} />
              <div><strong>{match.athlete?.display_name}</strong><small>{match.tournament?.name} · {match.category}</small><p>{[match.athlete?.sports_category, match.athlete?.dominant_hand, [match.athlete?.city, match.athlete?.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</p><ContactActions athlete={match.athlete} /></div>
            </article>
          )) : <div className="athleteActivityEmpty compact"><UserRound aria-hidden="true" /><strong>Ninguém compatível por enquanto</strong><span>Você será notificado aqui quando outro atleta da mesma categoria também procurar dupla.</span></div>}
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return <section className="publicMemberSection athleteActivityState"><RefreshCw className="spinning" aria-hidden="true" /><strong>Carregando sua atividade esportiva...</strong></section>;
  }
  if (state.error) {
    return <section className="publicMemberSection athleteActivityState hasError"><X aria-hidden="true" /><strong>{state.error}</strong><button type="button" onClick={loadActivity}>Tentar novamente</button></section>;
  }
  const schemaNotice = !state.schemaAvailable ? (
    <p className="athleteActivityNotice"><ShieldCheck aria-hidden="true" /> A estrutura compartilhada desta área ainda precisa ser aplicada ao banco da homologação. A organização visual já está disponível e nenhum dado atual foi alterado.</p>
  ) : null;

  if (activeTab === "conquistas") {
    return <AthletePerformance activity={activity} profile={profile} schemaNotice={schemaNotice} />;
  }

  if (activeTab === "atividades") {
    return (
      <section className="publicMemberSection athleteActivityPanel">
        <header className="athleteActivityHeader">
          <div><Trophy aria-hidden="true" /><span><h2>Torneios e circuitos</h2><small>Acompanhe inscrições, participações atuais e histórico.</small></span></div>
        </header>
        {schemaNotice}
        <nav className={`athleteActivityKinds${showPartnerSearch ? " hasPartnerSearch" : ""}`} role="tablist" aria-label="Tipo de atividade esportiva">
          <button type="button" role="tab" aria-selected={activitySection === "tournaments"} className={activitySection === "tournaments" ? "active" : ""} onClick={() => selectActivitySection("tournaments")}><Trophy aria-hidden="true" /><span><strong>Torneios</strong><small>{activity.registrations.length}</small></span></button>
          <button type="button" role="tab" aria-selected={activitySection === "circuits"} className={activitySection === "circuits" ? "active" : ""} onClick={() => selectActivitySection("circuits")}><GitBranch aria-hidden="true" /><span><strong>Circuitos</strong><small>{activity.circuits.length}</small></span></button>
          {showPartnerSearch ? <button type="button" role="tab" aria-selected={activitySection === "partners"} className={activitySection === "partners" ? "active" : ""} onClick={() => selectActivitySection("partners")}><Users aria-hidden="true" /><span><strong>Procurando dupla</strong><small>{fixedDoublesPartnerMatches.length}</small></span></button> : null}
        </nav>

        {activitySection !== "partners" ? <nav className="athleteActivityFilters" aria-label={activitySection === "circuits" ? "Filtrar circuitos" : "Filtrar torneios"}>
          {(activitySection === "circuits" ? circuitFilters : activityFilters).map((item) => {
            const source = activitySection === "circuits" ? activity.circuits : activity.registrations;
            const count = item.id === "all" ? source.length : source.filter((entry) => entry.bucket === item.id).length;
            return <button type="button" key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}<span>{count}</span></button>;
          })}
        </nav> : null}

        {activitySection === "tournaments" && visibleRegistrations.length ? <div className="athleteTournamentList">
          {visibleRegistrations.map((item) => (
            <article key={item.id}>
              {item.tournament?.cover_url ? <img src={item.tournament.cover_url} alt="" /> : <span className="athleteTournamentFallback"><Trophy aria-hidden="true" /></span>}
              <div>
                <small className={`athleteRegistrationStatus ${getRegistrationStatus(item).tone}`}>{getRegistrationStatus(item).label}</small>
                <strong>{item.tournament?.name || "Torneio"}</strong>
                <p>{[item.category, item.tournament?.location].filter(Boolean).join(" · ") || "Detalhes do torneio"}</p>
                {item.workflow_status === "rejected" && item.payment_rejection_reason ? <em>{item.payment_rejection_reason}</em> : null}
                <span>{item.tournament?.event_date ? <><CalendarDays aria-hidden="true" /> {formatDateBR(item.tournament.event_date)}</> : null}</span>
              </div>
              {item.tournament?.public_id ? <button type="button" onClick={() => openTournament(item)}>Abrir <ExternalLink aria-hidden="true" /></button> : null}
            </article>
          ))}
        </div> : null}

        {activitySection === "circuits" && visibleCircuits.length ? <div className="athleteCircuitList">
          {visibleCircuits.map((item) => <article key={item.id}><GitBranch aria-hidden="true" /><span><small>{item.bucket === "past" ? "Circuito concluído" : "Circuito em andamento"}</small><strong>{item.name}</strong><p>{item.tournament_count || 0} torneio(s)</p></span></article>)}
        </div> : null}

        {activitySection === "tournaments" && !visibleRegistrations.length ? (
          <div className="athleteActivityEmpty"><Trophy aria-hidden="true" /><strong>Nenhuma participação nesta situação</strong><span>As inscrições realizadas pela plataforma aparecerão aqui automaticamente.</span></div>
        ) : null}
        {activitySection === "circuits" && !visibleCircuits.length ? (
          <div className="athleteActivityEmpty"><GitBranch aria-hidden="true" /><strong>Nenhum circuito nesta situação</strong><span>Os circuitos vinculados às suas participações aparecerão aqui automaticamente.</span></div>
        ) : null}
        {activitySection === "partners" && showPartnerSearch ? renderPartnerContent() : null}
      </section>
    );
  }

  if (activeTab === "duplas" && owner) {
    return (
      <section className="publicMemberSection athletePartnerHub">
        <header className="athleteActivityHeader">
          <div><Users aria-hidden="true" /><span><h2>Procurando dupla</h2><small>Somente atletas do mesmo torneio e categoria aparecem uns para os outros.</small></span></div>
          <strong>{fixedDoublesPartnerMatches.length}</strong>
        </header>
        {schemaNotice}
        {renderPartnerContent()}
      </section>
    );
  }

  if (activeTab === "desafios") {
    if (!owner) {
      return (
        <section className="publicMemberSection athleteChallengeCall">
          <header className="athleteActivityHeader"><div><Swords aria-hidden="true" /><span><h2>Desafiar atleta</h2><small>Envie apenas um sinal esportivo. Não há campo de mensagem.</small></span></div></header>
          {notice ? <p className="athleteActivityNotice">{notice}</p> : null}
          {schemaNotice}
          <div className="athleteChallengeOptions">
            <button type="button" disabled={Boolean(busyId)} onClick={() => sendChallenge("practice")}><Flame aria-hidden="true" /><span><strong>Quem pratica mais?</strong><small>Um desafio de frequência no Beach Tennis</small></span><Heart aria-hidden="true" /></button>
            <button type="button" disabled={Boolean(busyId)} onClick={() => sendChallenge("match")}><Swords aria-hidden="true" /><span><strong>Disputar uma partida</strong><small>Um convite simples para combinar um jogo</small></span><Heart aria-hidden="true" /></button>
          </div>
          <p className="athleteChallengePrivacy"><ShieldCheck aria-hidden="true" /> Horário, arena e demais combinações ficam por conta dos atletas pelos contatos liberados no perfil.</p>
        </section>
      );
    }

    return (
      <section className="publicMemberSection athleteChallengeInbox">
        <header className="athleteActivityHeader"><div><Swords aria-hidden="true" /><span><h2>Desafios</h2><small>Sinais esportivos recebidos e enviados, sem troca de mensagens.</small></span></div><strong>{activity.challenges.filter((item) => item.direction === "incoming" && item.status === "pending").length}</strong></header>
        {schemaNotice}
        {notice ? <p className="athleteActivityNotice">{notice}</p> : null}
        {activity.challenges.length ? <div className="athleteChallengeList">{activity.challenges.map((challenge) => (
          <article key={challenge.id}>
            <AthleteAvatar athlete={challenge.athlete} />
            <div><small>{challenge.direction === "incoming" ? "Você recebeu" : "Você enviou"}</small><strong>{getChallengeLabel(challenge.challenge_type)}</strong><p>{challenge.athlete?.display_name} · {getStatusLabel(challenge.status)}</p>{challenge.status === "accepted" ? <ContactActions athlete={challenge.athlete} /> : null}</div>
            {challenge.direction === "incoming" && challenge.status === "pending" ? <div className="athleteChallengeActions"><button type="button" disabled={Boolean(busyId)} onClick={() => respond(challenge, "accepted")}><Check aria-hidden="true" /> Aceitar</button><button type="button" disabled={Boolean(busyId)} onClick={() => respond(challenge, "declined")}><X aria-hidden="true" /> Recusar</button></div> : null}
            {challenge.direction === "outgoing" && challenge.status === "pending" ? <button type="button" className="athleteChallengeCancel" disabled={Boolean(busyId)} onClick={() => respond(challenge, "cancelled")}>Cancelar</button> : null}
          </article>
        ))}</div> : <div className="athleteActivityEmpty"><Swords aria-hidden="true" /><strong>Nenhum desafio ainda</strong><span>Quando outro atleta tocar em um dos desafios do seu perfil, o sinal aparecerá aqui.</span></div>}
      </section>
    );
  }

  return null;
}
