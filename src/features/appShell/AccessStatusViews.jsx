import React, { useEffect, useState } from "react";
import { Gift, MessageCircle } from "lucide-react";
import {
  BeachLogo,
  PLATFORM_SUPPORT,
  PlatformSupportLinks,
} from "./EntryPresentation.jsx";

export function ProfileUnavailable({ onRetry, onLogout }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="authStatusPage">
      <section className="authStatusCard" aria-labelledby="profile-unavailable-title">
        <div className="authStatusIcon" aria-hidden="true">⏳</div>
        <span className="authStatusEyebrow">Conta em preparação</span>
        <h1 id="profile-unavailable-title">Estamos preparando seu acesso</h1>
        <p>
          Sua conta foi identificada, mas o perfil ainda não ficou disponível. Isso costuma levar apenas alguns segundos.
        </p>

        <div className="authStatusActions">
          <button type="button" onClick={handleRetry} disabled={retrying} aria-busy={retrying}>
            {retrying ? "Conferindo..." : "Tentar novamente"}
          </button>
        </div>

        <button type="button" className="linkBtn authStatusSignOut" onClick={onLogout}>
          Sair da conta
        </button>
      </section>
    </div>
  );
}

export function AccessPreparing({ onRetry, onLogout }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void handleRetry();
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="accessPreparingPage">
      <div className="accessPreparingCard">
        <div className="accessPreparingSpinner" aria-hidden="true" />
        <h1>Estamos finalizando seu acesso</h1>
        <p>Estamos concluindo a criação do seu perfil. Tentamos atualizar automaticamente; se necessário, você também pode conferir o status abaixo.</p>
        <div className="accessPreparingActions">
          <button type="button" onClick={handleRetry} disabled={retrying} aria-busy={retrying}>
            {retrying ? "Conferindo..." : "Atualizar status"}
          </button>
          <button type="button" className="linkBtn" onClick={onLogout}>Sair</button>
        </div>
      </div>
    </div>
  );
}

export function Blocked({
  plan,
  status,
  expiresAt,
  regularizationUrl,
  autoRedirect = false,
  onBrowse,
  onLogout,
}) {
  useEffect(() => {
    if (!autoRedirect) return undefined;

    const timer = window.setTimeout(() => {
      window.location.assign(regularizationUrl);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [autoRedirect, regularizationUrl]);

  return (
    <div className="blockedAccessPage">
      <main className="blockedAccessCard" aria-labelledby="blocked-access-title">
        <BeachLogo variant="blue" />

        <div className="blockedAccessIcon" aria-hidden="true"><MessageCircle /></div>
        <span className="blockedAccessEyebrow">Acesso e assinatura</span>
        <h1 id="blocked-access-title">Seu período gratuito terminou</h1>
        <p>Para continuar organizando seus torneios, fale com o Torneio360 e regularize o pagamento do seu plano.</p>

        <dl className="blockedAccessSummary">
          <div><dt>Plano</dt><dd>{plan}</dd></div>
          <div><dt>Status</dt><dd>{status}</dd></div>
          <div><dt>Vencimento</dt><dd>{expiresAt}</dd></div>
        </dl>

        {autoRedirect ? (
          <div className="blockedRedirectNotice" role="status" aria-live="polite">
            <span aria-hidden="true" />
            Abrindo o atendimento no WhatsApp...
          </div>
        ) : null}

        <a className="blockedWhatsappButton" href={regularizationUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          Regularizar pelo WhatsApp
        </a>

        <button
          type="button"
          className="secondaryBtn blockedBrowseButton"
          onClick={onBrowse}
        >
          Explorar arenas sem administrar
        </button>

        <p className="blockedAccessFallback">Se o WhatsApp não abrir automaticamente, toque no botão acima.</p>

        <PlatformSupportLinks
          contacts={PLATFORM_SUPPORT.filter(({ id }) => id !== "whatsapp")}
          className="blockedAlternativeContacts"
        />

        <button type="button" className="blockedSignOutButton" onClick={onLogout}>Sair da conta</button>
      </main>
    </div>
  );
}

export function FreeTrialNotice({ details, formatDate }) {
  const isLastDay = details.daysRemaining === 1;
  const dayLabel = details.daysRemaining === 1 ? "dia" : "dias";

  return (
    <section
      className={`freeTrialNotice ${isLastDay ? "freeTrialNoticeLastDay" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Período gratuito"
    >
      <div className="freeTrialNoticeIcon" aria-hidden="true"><Gift /></div>

      <div className="freeTrialNoticeCopy">
        <span>Seu período gratuito está ativo</span>
        <strong>
          {isLastDay
            ? "Hoje é o seu último dia grátis"
            : `Você ainda tem ${details.daysRemaining} dias grátis`}
        </strong>
        <p>Plano Premium liberado até {formatDate(details.expiresAt)}.</p>
      </div>

      <div className="freeTrialNoticeDays" aria-hidden="true">
        <strong>{details.daysRemaining}</strong>
        <span>{dayLabel}</span>
      </div>
    </section>
  );
}
