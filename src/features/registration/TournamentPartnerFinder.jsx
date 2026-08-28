import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Hand,
  MapPin,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { requiresFixedDoubles } from "../../domain/modalityClassification.mjs";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { validatePublicTextFields } from "../../domain/contentModeration.mjs";
import "../../styles/55-partner-finder.css";

function isPairCompetition(type) {
  return requiresFixedDoubles(modalityConfig[type]);
}

function getStorageKey(tournament, viewer) {
  const tournamentId = tournament?.public_id || tournament?.id || "torneio";
  const viewerId = viewer?.id || "visitante";
  return `torneio360:partner-search:${tournamentId}:${viewerId}`;
}

function loadStoredSearch(tournament, viewer) {
  if (!viewer?.id) return null;
  try {
    const value = JSON.parse(localStorage.getItem(getStorageKey(tournament, viewer)) || "null");
    return value?.status === "searching" ? value : null;
  } catch {
    return null;
  }
}

function getViewerName(viewer) {
  return String(
    viewer?.user_metadata?.full_name
      || viewer?.user_metadata?.name
      || viewer?.email?.split("@")[0]
      || "Atleta"
  ).trim();
}

function getViewerInitials(viewer) {
  return getViewerName(viewer)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("") || "T3";
}

function PartnerSearchCard({ entry, viewer, own = false, onWithdraw }) {
  return (
    <article className={`partnerSearchCard${own ? " isOwn" : ""}`}>
      <div className="partnerSearchAvatar" aria-hidden="true">
        {viewer?.user_metadata?.avatar_url
          ? <img src={viewer.user_metadata.avatar_url} alt="" />
          : <span>{getViewerInitials(viewer)}</span>}
      </div>
      <div className="partnerSearchIdentity">
        <div>
          <strong>{entry.displayName}</strong>
          {own ? <span className="partnerOwnBadge"><Check aria-hidden="true" /> Seu anúncio</span> : null}
        </div>
        <p>{[entry.category, entry.dominantHand].filter(Boolean).join(" · ")}</p>
        <div className="partnerSearchTags">
          {entry.courtSide ? <span><MapPin aria-hidden="true" /> Lado {entry.courtSide}</span> : null}
          {entry.availability ? <span><Users aria-hidden="true" /> {entry.availability}</span> : null}
        </div>
        {entry.message ? <blockquote>“{entry.message}”</blockquote> : null}
      </div>
      <div className="partnerSearchActions">
        {own ? (
          <button type="button" className="partnerWithdrawButton" onClick={onWithdraw}>Sair da busca</button>
        ) : (
          <button type="button"><Send aria-hidden="true" /> Convidar para dupla</button>
        )}
      </div>
    </article>
  );
}

export default function TournamentPartnerFinder({
  tournament,
  data,
  viewer = null,
  registrationClosed = false,
  onRequireLogin,
}) {
  const partnerConfig = data?.partnerFinder || {};
  const enabled = isPairCompetition(tournament?.type) && partnerConfig.enabled !== false;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [searchEntry, setSearchEntry] = useState(() => loadStoredSearch(tournament, viewer));
  const [form, setForm] = useState(() => ({
    category: String(data?.category || viewer?.user_metadata?.category || "").trim(),
    dominantHand: String(viewer?.user_metadata?.dominant_hand || "Destro"),
    courtSide: String(viewer?.user_metadata?.court_side || "Indiferente"),
    availability: "A combinar",
    message: "",
  }));

  const pairingDeadline = partnerConfig.deadline || data?.registrationDeadline || "";
  const statusText = useMemo(() => {
    if (registrationClosed) return "As inscrições deste torneio já foram encerradas.";
    if (pairingDeadline) return `Forme sua dupla até ${formatDateBR(pairingDeadline)}.`;
    return "A vaga é confirmada depois que os dois atletas aceitarem a formação da dupla.";
  }, [pairingDeadline, registrationClosed]);

  useEffect(() => {
    setSearchEntry(loadStoredSearch(tournament, viewer));
  }, [tournament?.id, tournament?.public_id, viewer?.id]);

  if (!enabled) return null;

  function openSearchDialog() {
    if (!viewer?.id) {
      onRequireLogin?.();
      return;
    }
    setDialogOpen(true);
  }

  function publishSearch(event) {
    event.preventDefault();
    const moderation = validatePublicTextFields({
      category: form.category,
      availability: form.availability,
      message: form.message,
    });
    if (!moderation.allowed) {
      setFormError(moderation.message);
      return;
    }
    const entry = {
      status: "searching",
      displayName: getViewerName(viewer),
      category: form.category.trim() || data?.category || "Categoria do torneio",
      dominantHand: form.dominantHand,
      courtSide: form.courtSide,
      availability: form.availability.trim(),
      message: form.message.trim().slice(0, 180),
      createdAt: new Date().toISOString(),
    };
    try { localStorage.setItem(getStorageKey(tournament, viewer), JSON.stringify(entry)); } catch { /* sessão continua funcional */ }
    setSearchEntry(entry);
    setFormError("");
    setDialogOpen(false);
  }

  function withdrawSearch() {
    try { localStorage.removeItem(getStorageKey(tournament, viewer)); } catch { /* sessão continua funcional */ }
    setSearchEntry(null);
  }

  return (
    <section className="partnerFinder" aria-labelledby="partner-finder-title">
      <header className="partnerFinderHero">
        <div className="partnerFinderIcon"><Search aria-hidden="true" /></div>
        <div>
          <span>INSCRIÇÃO INDIVIDUAL EM TORNEIO DE DUPLAS</span>
          <h3 id="partner-finder-title">Encontre sua dupla</h3>
          <p>Entre na lista de atletas disponíveis, receba convites e confirme a parceria sem expor telefone ou CPF.</p>
        </div>
        <div className="partnerFinderCount">
          <strong>{searchEntry ? 1 : 0}</strong>
          <small>{searchEntry ? "atleta disponível" : "atletas disponíveis"}</small>
        </div>
      </header>

      <div className="partnerFinderStatus">
        <ShieldCheck aria-hidden="true" />
        <span><strong>Contato protegido pela plataforma.</strong> {statusText}</span>
      </div>

      {searchEntry ? (
        <div className="partnerSearchList">
          <PartnerSearchCard entry={searchEntry} viewer={viewer} own onWithdraw={withdrawSearch} />
          <div className="partnerInvitationEmpty">
            <MessageCircle aria-hidden="true" />
            <span><strong>Convites aparecerão aqui</strong><small>Você poderá conhecer o perfil e aceitar ou recusar antes de formar a dupla.</small></span>
          </div>
        </div>
      ) : (
        <div className="partnerFinderEmpty">
          <div>
            <UserPlus aria-hidden="true" />
            <span><strong>Ainda não tem parceiro?</strong><small>Publique sua disponibilidade para esta categoria.</small></span>
          </div>
          <button type="button" onClick={openSearchDialog} disabled={registrationClosed}>
            <Search aria-hidden="true" /> Quero encontrar uma dupla
          </button>
        </div>
      )}

      {dialogOpen ? (
        <div className="partnerFinderOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogOpen(false);
        }}>
          <form className="partnerFinderDialog" onSubmit={publishSearch} aria-labelledby="partner-dialog-title">
            <header>
              <div><span>Seu anúncio</span><h3 id="partner-dialog-title">Procurar uma dupla</h3></div>
              <button type="button" onClick={() => setDialogOpen(false)} aria-label="Fechar"><X aria-hidden="true" /></button>
            </header>

            <div className="partnerFinderFields">
              {formError ? <div className="partnerFinderFormError" role="alert">{formError}</div> : null}
              <label>
                <span>Categoria</span>
                <input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex.: B, C ou Open" />
              </label>
              <label>
                <span><Hand aria-hidden="true" /> Mão dominante</span>
                <select value={form.dominantHand} onChange={(event) => setForm((current) => ({ ...current, dominantHand: event.target.value }))}>
                  <option>Destro</option><option>Canhoto</option><option>Ambidestro</option>
                </select>
              </label>
              <label>
                <span>Lado preferido</span>
                <select value={form.courtSide} onChange={(event) => setForm((current) => ({ ...current, courtSide: event.target.value }))}>
                  <option>Indiferente</option><option>Direito</option><option>Esquerdo</option>
                </select>
              </label>
              <label>
                <span>Disponibilidade</span>
                <input value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value }))} placeholder="Ex.: sábado à tarde" />
              </label>
              <label className="partnerFinderFullField">
                <span>Apresentação opcional</span>
                <textarea maxLength={180} rows={3} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Conte como você gosta de jogar ou o que procura em uma dupla." />
                <small>{form.message.length}/180</small>
              </label>
            </div>

            <footer>
              <button type="button" className="secondaryBtn" onClick={() => setDialogOpen(false)}>Cancelar</button>
              <button type="submit"><Search aria-hidden="true" /> Publicar disponibilidade</button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
