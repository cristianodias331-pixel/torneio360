import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Bell, Check, Clock3, RefreshCw, Trophy, UserRoundCheck, X } from "lucide-react";
import { loadMyNotifications, markMyNotificationsRead, respondToPartnerInvitation } from "../../services/notificationApi.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import { broadcastUnreadNotificationCount } from "./useUnreadNotificationCount.js";
import "../../styles/61-notifications-and-athlete-identity.css";

function formatNotificationDate(value) {
  if (!value) return "Agora";
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
  catch { return "Agora"; }
}

function getNotificationIcon(type) {
  if (["partner_invitation", "partner_accepted", "partner_rejected"].includes(type)) return UserRoundCheck;
  if (type === "registration_approved") return BadgeCheck;
  if (["registration_submitted", "registration_rejected"].includes(type)) return Trophy;
  return Bell;
}

export default function NotificationCenter({ supabase, onOpenTournament = null }) {
  const [state, setState] = useState({ status: "loading", notifications: [], schemaAvailable: true, error: "" });
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const automaticViewRef = useRef(false);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await loadMyNotifications({ supabase });
      const nextUnreadCount = result.notifications.filter((item) => !item.read_at).length;
      setState({ status: "ready", notifications: result.notifications, schemaAvailable: result.schemaAvailable, error: "" });
      broadcastUnreadNotificationCount(nextUnreadCount);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      setState({ status: "error", notifications: [], schemaAvailable: true, error: "Não foi possível carregar as notificações agora." });
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);
  const unreadCount = useMemo(() => state.notifications.filter((item) => !item.read_at).length, [state.notifications]);

  useEffect(() => {
    if (state.status !== "ready" || !unreadCount || automaticViewRef.current) return undefined;
    automaticViewRef.current = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        await markMyNotificationsRead({ supabase });
        const viewedAt = new Date().toISOString();
        setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at || viewedAt })) }));
        broadcastUnreadNotificationCount(0);
      } catch (error) {
        automaticViewRef.current = false;
        setNotice(error?.message || "Não foi possível registrar a visualização das notificações.");
      }
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [state.status, supabase, unreadCount]);

  async function markAllRead() {
    if (busyId || !unreadCount) return;
    setBusyId("all");
    try {
      await markMyNotificationsRead({ supabase });
      setState((current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })) }));
      broadcastUnreadNotificationCount(0);
    } catch (error) { setNotice(error?.message || "Não foi possível marcar as notificações."); }
    finally { setBusyId(""); }
  }

  async function respond(item, decision) {
    if (!item.registration_id || busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      await respondToPartnerInvitation({ supabase, registrationId: item.registration_id, decision });
      setNotice(decision === "accepted" ? "Dupla confirmada. O atleta que convidou você já foi avisado." : "Convite recusado. O atleta já foi avisado.");
      await load();
    } catch (error) { setNotice(error?.message || "Não foi possível responder ao convite."); }
    finally { setBusyId(""); }
  }

  function openTournament(item) {
    if (!item.tournament) return;
    if (onOpenTournament) onOpenTournament(item.tournament);
    else if (item.tournament.public_id) navigatePlatform({ public: item.tournament.public_id });
  }

  if (state.status === "loading") return <section className="notificationCenterState"><RefreshCw className="spinning" aria-hidden="true" /><strong>Buscando novidades...</strong></section>;
  if (state.status === "error") return <section className="notificationCenterState hasError"><X aria-hidden="true" /><strong>{state.error}</strong><button type="button" onClick={load}>Tentar novamente</button></section>;

  return (
    <section className="notificationCenter">
      <header className="notificationCenterHeader">
        <div><span><Bell aria-hidden="true" /></span><div><small>CENTRAL DA PLATAFORMA</small><h2>Notificações</h2><p>Inscrições, pagamentos, convites de dupla e decisões importantes em um só lugar.</p></div></div>
        <button type="button" onClick={markAllRead} disabled={!unreadCount || Boolean(busyId)}><Check aria-hidden="true" /> Marcar todas como lidas</button>
      </header>
      {!state.schemaAvailable ? <p className="notificationCenterNotice"><Clock3 aria-hidden="true" /> A central será ativada após a nova migração da homologação.</p> : null}
      {notice ? <p className="notificationCenterNotice success" role="status">{notice}</p> : null}
      <div className="notificationCenterSummary"><strong>{unreadCount}</strong><span>{unreadCount === 1 ? "notificação nova" : "notificações novas"}</span></div>
      {state.notifications.length ? <div className="notificationList">{state.notifications.map((item) => {
        const Icon = getNotificationIcon(item.type);
        return (
          <article className={`notificationItem${item.read_at ? "" : " unread"}`} key={item.id}>
            <span className="notificationIcon"><Icon aria-hidden="true" /></span>
            <div className="notificationCopy"><div><strong>{item.title}</strong>{!item.read_at ? <i>NOVA</i> : null}</div><p>{item.message}</p><small>{formatNotificationDate(item.created_at)}</small></div>
            <div className="notificationActions">
              {item.type === "partner_invitation" && item.data?.partner_status === "pending" ? <><button type="button" className="accept" disabled={Boolean(busyId)} onClick={() => respond(item, "accepted")}><Check aria-hidden="true" /> Aceitar dupla</button><button type="button" className="reject" disabled={Boolean(busyId)} onClick={() => respond(item, "rejected")}><X aria-hidden="true" /> Recusar</button></> : null}
              {item.tournament ? <button type="button" onClick={() => openTournament(item)}>Ver torneio</button> : null}
            </div>
          </article>
        );
      })}</div> : <div className="notificationEmpty"><Bell aria-hidden="true" /><strong>Nenhuma notificação por enquanto</strong><span>As próximas inscrições, aprovações e combinações de dupla aparecerão aqui.</span></div>}
    </section>
  );
}
