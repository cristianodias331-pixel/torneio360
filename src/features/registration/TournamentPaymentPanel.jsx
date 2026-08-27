import React, { useEffect, useMemo, useState } from "react";
import { Copy, CreditCard, FileCheck2, FileUp, QrCode, ShieldCheck } from "lucide-react";
import {
  getSafePaymentLink,
  loadPublicOrganizationPaymentSettings,
} from "../../services/organizationPaymentApi.mjs";
import { validateRegistrationReceipt } from "../../services/tournamentRegistrationApi.mjs";
import "../../styles/59-tournament-payment.css";

export default function TournamentPaymentPanel({
  tournament,
  organizer = {},
  viewer = null,
  supabase,
  registrationClosed = false,
  onRequireLogin,
  onSubmit = null,
  busy = false,
  submissionNotice = "",
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
  const [paymentMethod, setPaymentMethod] = useState("");

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

  useEffect(() => {
    if (paymentMethod) return;
    if (settings.pixKey) setPaymentMethod("pix");
    else if (cardLink) setPaymentMethod("card");
  }, [cardLink, paymentMethod, settings.pixKey]);

  function chooseReceipt(file) {
    const error = validateRegistrationReceipt(file);
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

  async function submitReceipt() {
    const error = validateRegistrationReceipt(receipt);
    if (error) {
      setReceiptError(error);
      return;
    }
    if (!paymentMethod) {
      setReceiptError("Escolha Pix ou cartão.");
      return;
    }
    await onSubmit?.({ receipt, paymentMethod });
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
            <article className={paymentMethod === "pix" ? "selected" : ""}>
              <QrCode aria-hidden="true" />
              <span><small>Pix</small><strong>{settings.pixKey}</strong></span>
              <button type="button" onClick={copyPix}><Copy aria-hidden="true" /> {copied ? "Copiado" : "Copiar"}</button>
              <button type="button" className="tournamentPaymentChoice" aria-pressed={paymentMethod === "pix"} onClick={() => setPaymentMethod("pix")}>{paymentMethod === "pix" ? "Pix selecionado" : "Usar Pix"}</button>
            </article>
          ) : null}
          {cardLink ? (
            <article className={paymentMethod === "card" ? "selected" : ""}>
              <CreditCard aria-hidden="true" />
              <span><small>Cartão de crédito</small><strong>Checkout da organização</strong></span>
              <a href={cardLink} target="_blank" rel="noreferrer">Abrir pagamento</a>
              <button type="button" className="tournamentPaymentChoice" aria-pressed={paymentMethod === "card"} onClick={() => setPaymentMethod("card")}>{paymentMethod === "card" ? "Cartão selecionado" : "Usar cartão"}</button>
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
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={registrationClosed || busy} onChange={(event) => { chooseReceipt(event.target.files?.[0]); event.target.value = ""; }} />
              <FileUp aria-hidden="true" />
              <span>{receipt ? <><strong>{receipt.name}</strong><small>Arquivo selecionado com segurança neste dispositivo</small></> : <><strong>Selecionar comprovante</strong><small>Foto ou PDF</small></>}</span>
            </label>
            {receiptError ? <p className="tournamentReceiptError" role="alert">{receiptError}</p> : null}
            <div className="tournamentReceiptSubmitRow">
              {submissionNotice ? <p className="tournamentReceiptInlineNotice" role="status">{submissionNotice}</p> : <span />}
              <button type="button" className="tournamentReceiptSubmit" disabled={registrationClosed || busy || !receipt || !paymentMethod || !onSubmit} onClick={submitReceipt}>{busy ? "Finalizando com segurança..." : "Finalizar inscrição"}</button>
            </div>
          </>
        )}
        <p className="tournamentReceiptPrivacy"><ShieldCheck aria-hidden="true" /> O comprovante fica em armazenamento privado. Somente você e a organização responsável por este torneio podem acessá-lo.</p>
      </div>
    </section>
  );
}
