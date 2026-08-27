import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  Clock3,
  Hand,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { isCupType, isFixedTeamType, isIndividualCupType } from "../../domain/modalityClassification.mjs";
import {
  loadMyTournamentRegistrationCheckout,
  findTournamentPartnerByHandle,
  submitTournamentRegistrationWorkflow,
} from "../../services/tournamentRegistrationApi.mjs";
import TournamentPaymentPanel from "./TournamentPaymentPanel.jsx";
import "../../styles/60-tournament-registration.css";

function isPairCompetition(type) {
  const config = modalityConfig[type];
  return Boolean(config && !isIndividualCupType(config) && (isFixedTeamType(config) || isCupType(config)));
}

function getViewerName(viewer) {
  return String(
    viewer?.user_metadata?.full_name
      || viewer?.user_metadata?.name
      || viewer?.email?.split("@")[0]
      || ""
  ).trim();
}

function getWorkflowCopy(registration) {
  if (registration?.workflow_status === "approved") {
    return { tone: "approved", title: "Inscrição aprovada", text: "A organização validou seu comprovante e confirmou sua participação." };
  }
  if (registration?.workflow_status === "submitted") {
    return { tone: "submitted", title: "Comprovante em análise", text: "Sua inscrição chegou à organização. Você será atualizado no perfil do atleta." };
  }
  if (registration?.workflow_status === "rejected") {
    return { tone: "rejected", title: "Reenvio necessário", text: registration.payment_rejection_reason || "A organização recusou o comprovante. Confira o pagamento e envie outro arquivo." };
  }
  return null;
}

export default function TournamentRegistrationPanel({
  tournament,
  data,
  organizer,
  viewer,
  supabase,
  registrationClosed = false,
  onRequireLogin,
}) {
  const [state, setState] = useState({ status: viewer?.id ? "loading" : "guest", checkout: null, schemaAvailable: true, error: "" });
  const [form, setForm] = useState(() => ({
    athleteName: getViewerName(viewer),
    athleteHandle: "",
    category: String(viewer?.user_metadata?.category || data?.category || "").trim(),
    dominantHand: String(viewer?.user_metadata?.dominant_hand || "Não informado").trim(),
    partnerHandle: "",
    lookingForPartner: false,
  }));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [partnerLookup, setPartnerLookup] = useState({ status: "idle", partner: null, error: "" });
  const pairCompetition = isPairCompetition(tournament?.type);

  async function loadCheckout() {
    if (!viewer?.id || !tournament?.id) return;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await loadMyTournamentRegistrationCheckout({ supabase, tournamentId: tournament.id });
      const checkout = result.checkout || null;
      setState({ status: "ready", checkout, schemaAvailable: result.schemaAvailable, error: "" });
      setForm((current) => ({
        ...current,
        athleteName: checkout?.athlete?.display_name || checkout?.registration?.athlete_name || current.athleteName,
        athleteHandle: checkout?.athlete?.handle || checkout?.registration?.athlete_handle || current.athleteHandle,
        category: checkout?.registration?.category || checkout?.athlete?.sports_category || current.category,
        dominantHand: checkout?.athlete?.dominant_hand || current.dominantHand,
        partnerHandle: checkout?.registration?.partner_handle || current.partnerHandle,
      }));
    } catch (error) {
      setState({ status: "error", checkout: null, schemaAvailable: true, error: error?.message || "Não foi possível abrir a inscrição." });
    }
  }

  useEffect(() => { void loadCheckout(); }, [tournament?.id, viewer?.id]);

  const registration = state.checkout?.registration || null;
  const workflowCopy = useMemo(() => getWorkflowCopy(registration), [registration]);
  const locked = ["submitted", "approved"].includes(registration?.workflow_status);

  useEffect(() => {
    if (!pairCompetition || !form.partnerHandle.trim() || locked) {
      setPartnerLookup({ status: "idle", partner: null, error: "" });
      return undefined;
    }
    let active = true;
    setPartnerLookup({ status: "loading", partner: null, error: "" });
    const timer = window.setTimeout(async () => {
      try {
        const result = await findTournamentPartnerByHandle({ supabase, tournamentId: tournament.id, handle: form.partnerHandle });
        if (!active) return;
        setPartnerLookup(result.partner?.is_self
          ? { status: "self", partner: null, error: "Esse é o seu próprio perfil. Informe o @ de outro atleta para formar a dupla." }
          : result.partner
          ? { status: "found", partner: result.partner, error: "" }
          : { status: "not-found", partner: null, error: "Nenhum atleta encontrado com esse endereço único." });
      } catch (error) {
        if (active) setPartnerLookup({ status: "error", partner: null, error: error?.message || "Não foi possível verificar este atleta." });
      }
    }, 380);
    return () => { active = false; window.clearTimeout(timer); };
  }, [form.partnerHandle, locked, pairCompetition, supabase, tournament.id]);

  async function submitPayment({ receipt, paymentMethod }) {
    if (busy) return;
    if (!form.athleteHandle.trim()) {
      setNotice("Cadastre primeiro o endereço único (@) no seu perfil de atleta.");
      return;
    }
    if (pairCompetition && form.partnerHandle.trim() && partnerLookup.status !== "found") {
      setNotice(partnerLookup.error || "Confirme o endereço único do atleta antes de finalizar a inscrição.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await submitTournamentRegistrationWorkflow({
        supabase,
        tournamentId: tournament.id,
        athleteName: form.athleteName,
        partnerName: "",
        partnerHandle: pairCompetition ? form.partnerHandle : "",
        category: form.category,
        paymentMethod,
        receipt,
        lookingForPartner: pairCompetition && !form.partnerHandle && form.lookingForPartner,
      });
      setNotice("Inscrição finalizada. A organização recebeu o comprovante para validação.");
      await loadCheckout();
    } catch (error) {
      setNotice(error?.message || "Não foi possível enviar a inscrição.");
    } finally {
      setBusy(false);
    }
  }

  if (!viewer?.id) {
    return (
      <section className="registrationJourney registrationJourneyGuest">
        <ShieldCheck aria-hidden="true" />
        <div><small>INSCRIÇÃO PROTEGIDA</small><h2>Entre como atleta para continuar</h2><p>O cadastro reaproveita seus dados esportivos e não expõe CPF, telefone ou comprovante ao público.</p></div>
        <button type="button" onClick={onRequireLogin} disabled={registrationClosed}>{registrationClosed ? "Inscrições encerradas" : "Entrar ou criar conta"}</button>
      </section>
    );
  }

  if (state.status === "loading") {
    return <section className="registrationJourneyState"><RefreshCw className="spinning" aria-hidden="true" /><strong>Preparando sua inscrição...</strong></section>;
  }
  if (state.status === "error") {
    return <section className="registrationJourneyState hasError"><CircleAlert aria-hidden="true" /><strong>{state.error}</strong><button type="button" onClick={loadCheckout}>Tentar novamente</button></section>;
  }
  if (!state.schemaAvailable) {
    return <section className="registrationJourneyState hasError"><CircleAlert aria-hidden="true" /><strong>A estrutura segura da inscrição ainda não foi aplicada ao banco de homologação.</strong></section>;
  }

  return (
    <section className="registrationJourney">
      <header className="registrationJourneyHeader">
        <div><small>INSCRIÇÃO DO ATLETA</small><h2>Finalize sua participação</h2><p>Seus dados, pagamento e confirmação ficam conectados ao torneio e aos dois perfis.</p></div>
        <ol aria-label="Etapas da inscrição"><li className="active">1 Dados</li><li className={registration ? "active" : ""}>2 Pagamento</li><li className={locked || registration?.workflow_status === "rejected" ? "active" : ""}>3 Validação</li></ol>
      </header>

      <div className="registrationTournamentSummary">
        <strong>{tournament.name}</strong>
        <span>{data?.eventDate ? <><CalendarDays aria-hidden="true" /> {formatDateBR(data.eventDate)}</> : null}</span>
        <span>{data?.eventStartTime ? <><Clock3 aria-hidden="true" /> {data.eventStartTime}</> : null}</span>
        <span>{data?.location ? <><MapPin aria-hidden="true" /> {data.location}</> : null}</span>
      </div>

      {workflowCopy ? (
        <div className={`registrationWorkflowStatus ${workflowCopy.tone}`}>
          {workflowCopy.tone === "approved" ? <BadgeCheck aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          <div><strong>{workflowCopy.title}</strong><p>{workflowCopy.text}</p>{registration?.payment_proof_name ? <small>Comprovante: {registration.payment_proof_name}</small> : null}</div>
        </div>
      ) : null}
      {notice ? <p className="registrationJourneyNotice" role="status">{notice}</p> : null}

      {!locked ? (
        <>
          <section className="registrationAthleteData">
            <header><UserRound aria-hidden="true" /><div><strong>Dados aproveitados do seu perfil</strong><small>Você pode ajustar apenas o necessário para este torneio.</small></div></header>
            <div className="registrationAthleteFields">
              <label className="registrationOwnIdentityField"><span>Atleta que está se inscrevendo</span><div className="registrationHandleInput"><b>@</b><input value={form.athleteHandle} readOnly placeholder="Cadastre seu endereço único" /></div><small>{form.athleteHandle ? `${form.athleteName} · perfil de atleta identificado` : "Abra Meu perfil de atleta e escolha seu endereço único antes de se inscrever."}</small></label>
              <label><span>Categoria</span><input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: Iniciante, C ou Open" /></label>
              <label><span><Hand aria-hidden="true" /> Mão dominante</span><input value={form.dominantHand} readOnly /></label>
              {pairCompetition ? <label className="registrationPartnerHandleField"><span>Endereço único do outro atleta da dupla</span><div className="registrationHandleInput"><b>@</b><input value={form.partnerHandle} onChange={(event) => setForm((current) => ({ ...current, partnerHandle: event.target.value.replace(/^@/, ""), lookingForPartner: event.target.value ? false : current.lookingForPartner }))} placeholder="outro.atleta" /></div><small>Não use o seu próprio @. O outro atleta receberá uma notificação para aceitar ou recusar.</small></label> : null}
            </div>
            {pairCompetition && form.partnerHandle ? <div className={`registrationPartnerLookup ${partnerLookup.status}`}>
              {partnerLookup.status === "loading" ? <><RefreshCw className="spinning" aria-hidden="true" /><span>Verificando o perfil...</span></> : null}
              {partnerLookup.partner ? <><span>{partnerLookup.partner.photo_url ? <img src={partnerLookup.partner.photo_url} alt="" /> : <UserRound aria-hidden="true" />}</span><div><strong>{partnerLookup.partner.display_name}</strong><small>@{partnerLookup.partner.handle} · perfil identificado</small></div><BadgeCheck aria-label="Perfil localizado" /></> : null}
              {partnerLookup.error ? <><CircleAlert aria-hidden="true" /><span>{partnerLookup.error}</span></> : null}
            </div> : null}
            {pairCompetition && !form.partnerHandle ? (
              <label className={`registrationPartnerChoice${form.lookingForPartner ? " selected" : ""}`}>
                <input type="checkbox" checked={form.lookingForPartner} onChange={(event) => setForm((current) => ({ ...current, lookingForPartner: event.target.checked }))} />
                <Users aria-hidden="true" />
                <span><strong>Quero encontrar uma dupla</strong><small>Após enviar a inscrição, atletas do mesmo torneio e categoria poderão encontrar seu perfil.</small></span>
              </label>
            ) : null}
          </section>

          <TournamentPaymentPanel
            tournament={tournament}
            organizer={organizer}
            viewer={viewer}
            supabase={supabase}
            registrationClosed={registrationClosed}
            onRequireLogin={onRequireLogin}
            onSubmit={submitPayment}
            busy={busy}
            submissionNotice={notice}
          />
        </>
      ) : null}
    </section>
  );
}
