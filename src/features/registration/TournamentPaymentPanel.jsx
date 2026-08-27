import React, { useEffect, useMemo, useState } from "react";
import { Copy, CreditCard, FileCheck2, FileUp, QrCode, ShieldCheck } from "lucide-react";
import {
  getSafePaymentLink,
  loadPublicOrganizationPaymentSettings,
} from "../../services/organizationPaymentApi.mjs";
import "../../styles/59-tournament-payment.css";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const ACCEPTED_RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function validateReceipt(file) {
  if (!file) return "Escolha uma foto ou PDF do comprovante.";
  if (!ACCEPTED_RECEIPT_TYPES.includes(String(file.type || "").toLowerCase())) return "Envie um arquivo PDF, JPG, PNG ou WebP.";
  if (Number(file.size || 0) > MAX_RECEIPT_SIZE) return "O comprovante deve ter no máximo 10 MB.";
  return "";
}

export default function TournamentPaymentPanel({
  tournament,
  organizer = {},
  viewer = null,
  supabase,
  registrationClosed = false,
  onRequireLogin,
}) {
  const organizationId = organizer.id || tournament?.user_id || null;
  const [settings, setSettings] = useState(() => ({
    pixKey: organizer.pixKey || organizer.pix_key || "",
    cardPaymentLink: organizer.cardPaymentLink || organizer.card_payment_link || "",
    schemaAvailable: false,
  }));
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    loadPublicOrganizationPaymentSettings({
      supabase,
      organizationId,
      fallback: settings,
    }).then((result) => {
      if (active) setSettings(result);
    }).catch((error) => console.warn("Meios públicos de pagamento indisponíveis:", error));
    return () => { active = false; };
  }, [organizationId, supabase]);

  const cardLink = useMemo(() => getSafePaymentLink(settings.cardPaymentLink), [settings.cardPaymentLink]);
  const hasPaymentMethod = Boolean(settings.pixKey || cardLink);

  function chooseReceipt(file) {
    const error = validateReceipt(file);
    setReceiptError(error);
    setReceipt(error ? null : file);
  }

  async function copyPix() {
    if (!settings.pixKey) return;
    try {
      await navigator.clipboard.writeText(settings.pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="tournamentPaymentPanel" aria-labelledby="tournament-payment-title">
      <header>
        <span className="tournamentPaymentIcon"><CreditCard aria-hidden="true" /></span>
        <div>
          <small>PAGAMENTO DA INSCRIÇÃO</small>
          <h3 id="tournament-payment-title">Pague diretamente à organização</h3>
          <p>Escolha Pix ou cartão e mantenha o comprovante vinculado a este torneio.</p>
        </div>
      </header>

      {hasPaymentMethod ? (
        <div className="tournamentPaymentMethods">
          {settings.pixKey ? (
            <article>
              <QrCode aria-hidden="true" />
              <span><small>Pix</small><strong>{settings.pixKey}</strong></span>
              <button type="button" onClick={copyPix}><Copy aria-hidden="true" /> {copied ? "Copiado" : "Copiar"}</button>
            </article>
          ) : null}
          {cardLink ? (
            <article>
              <CreditCard aria-hidden="true" />
              <span><small>Cartão de crédito</small><strong>Checkout da organização</strong></span>
              <a href={cardLink} target="_blank" rel="noreferrer">Abrir pagamento</a>
            </article>
          ) : null}
        </div>
      ) : (
        <p className="tournamentPaymentEmpty">A organização ainda não informou Pix ou link para cartão.</p>
      )}

      <div className="tournamentReceiptArea">
        <div className="tournamentReceiptHeading">
          <FileCheck2 aria-hidden="true" />
          <span><strong>Comprovante de pagamento</strong><small>PDF, JPG, PNG ou WebP · máximo de 10 MB</small></span>
        </div>
        {!viewer?.id ? (
          <button type="button" className="tournamentReceiptLogin" onClick={onRequireLogin} disabled={registrationClosed}>Entrar como atleta para anexar</button>
        ) : (
          <>
            <label className={`tournamentReceiptPicker${receipt ? " hasFile" : ""}`}>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={registrationClosed} onChange={(event) => { chooseReceipt(event.target.files?.[0]); event.target.value = ""; }} />
              <FileUp aria-hidden="true" />
              <span>{receipt ? <><strong>{receipt.name}</strong><small>Arquivo selecionado com segurança neste dispositivo</small></> : <><strong>Selecionar comprovante</strong><small>Foto ou PDF</small></>}</span>
            </label>
            {receiptError ? <p className="tournamentReceiptError" role="alert">{receiptError}</p> : null}
            <button type="button" className="tournamentReceiptSubmit" disabled title="O envio privado será habilitado após autorização do armazenamento de homologação">Enviar para conferência</button>
          </>
        )}
        <p className="tournamentReceiptPrivacy"><ShieldCheck aria-hidden="true" /> O arquivo permanece somente neste dispositivo nesta etapa. O envio privado ao organizador será habilitado após a autorização do armazenamento de homologação.</p>
      </div>
    </section>
  );
}

