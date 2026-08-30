import React, { useEffect } from "react";
import { AtSign, CheckCircle2, Eye, LoaderCircle, MapPin, MessageCircle, Save, Send, X, XCircle } from "lucide-react";
import "../../styles/63-global-search-and-live-handle.css";

export default function MemberProfileDetailsModal({
  open,
  profile,
  errors = {},
  loading = false,
  saving = false,
  schemaAvailable = true,
  profileKind = "athlete",
  handleAvailability = null,
  onChange,
  onClose,
  onSave,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, saving]);

  if (!open) return null;

  return (
    <div
      className="memberProfileEditOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-profile-edit-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <section className="memberProfileEditModal" aria-busy={loading || saving}>
        <header>
          <div>
            <span>Seu perfil público</span>
            <h2 id="member-profile-edit-title">Editar perfil</h2>
            <p>Atualize as informações que aparecem para atletas e organizações.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar edição do perfil">
            <X aria-hidden="true" />
          </button>
        </header>

        {!schemaAvailable ? (
          <div className="unifiedMemberSchemaNotice" role="status">
            A estrutura do perfil ainda não está disponível no banco de homologação.
          </div>
        ) : null}

        <div className="memberProfileEditFields">
          <div className="formField">
            <label htmlFor="member-modal-display-name">Nome de exibição</label>
            <input
              id="member-modal-display-name"
              value={profile.displayName}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => onChange("displayName", event.target.value)}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName ? <small className="unifiedMemberFieldError">{errors.displayName}</small> : null}
          </div>

          <div className="formField">
            <label htmlFor="member-modal-handle"><AtSign aria-hidden="true" /> Nome de usuário</label>
            <div className={`unifiedMemberHandleField handleAvailabilityField ${handleAvailability?.status || "idle"}`}>
              <span>@</span>
              <input
                id="member-modal-handle"
                value={profile.handle}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="seunome"
                onChange={(event) => onChange("handle", event.target.value)}
                aria-invalid={Boolean(errors.handle) || ["invalid", "unavailable"].includes(handleAvailability?.status)}
              />
              {handleAvailability?.status === "checking" ? <LoaderCircle className="handleAvailabilitySpinner" aria-hidden="true" /> : null}
              {handleAvailability?.status === "available" ? <CheckCircle2 className="handleAvailabilityIcon" aria-hidden="true" /> : null}
              {["invalid", "unavailable"].includes(handleAvailability?.status) ? <XCircle className="handleAvailabilityIcon" aria-hidden="true" /> : null}
            </div>
            {errors.handle
              ? <small className="unifiedMemberFieldError">{errors.handle}</small>
              : <small className={`memberHandleAvailability ${handleAvailability?.status || "idle"}`} role="status" aria-live="polite">{handleAvailability?.message || "Seu identificador único na plataforma."}</small>}
          </div>

          <div className="formField fullField">
            <label htmlFor="member-modal-bio">Apresentação</label>
            <textarea
              id="member-modal-bio"
              value={profile.bio}
              maxLength={240}
              rows={4}
              placeholder="Conte um pouco sobre você e sua atuação no esporte."
              onChange={(event) => onChange("bio", event.target.value)}
              aria-invalid={Boolean(errors.bio)}
            />
            {errors.bio ? <small className="unifiedMemberFieldError">{errors.bio}</small> : null}
            <small className="unifiedMemberCharacterCount">{profile.bio.length}/240</small>
          </div>

          <div className="formField">
            <label htmlFor="member-modal-city"><MapPin aria-hidden="true" /> Cidade</label>
            <input
              id="member-modal-city"
              value={profile.city}
              maxLength={80}
              autoComplete="address-level2"
              onChange={(event) => onChange("city", event.target.value)}
            />
          </div>

          <div className="formField">
            <label htmlFor="member-modal-state">Estado</label>
            <input
              id="member-modal-state"
              value={profile.state}
              maxLength={80}
              autoComplete="address-level1"
              onChange={(event) => onChange("state", event.target.value)}
            />
          </div>

          {profileKind === "athlete" ? <>
          <div className="profileFormSectionHeader fullField">
            <span>🎾</span>
            <div><strong>Dados esportivos do atleta</strong><small>Informe seu nível técnico e sua categoria esportiva para validar as inscrições.</small></div>
          </div>

          <div className="formField">
            <label htmlFor="member-modal-category">Nível técnico</label>
            <input
              id="member-modal-category"
              value={profile.sportsCategory || ""}
              maxLength={40}
              placeholder="Ex.: B, C ou Open"
              onChange={(event) => onChange("sportsCategory", event.target.value)}
              aria-invalid={Boolean(errors.sportsCategory)}
            />
            {errors.sportsCategory ? <small className="unifiedMemberFieldError">{errors.sportsCategory}</small> : null}
          </div>

          <div className="formField">
            <label htmlFor="member-modal-gender">Categoria esportiva</label>
            <select
              id="member-modal-gender"
              value={profile.gender || ""}
              onChange={(event) => onChange("gender", event.target.value)}
              aria-invalid={Boolean(errors.gender)}
            >
              <option value="">Selecione</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
            {errors.gender ? <small className="unifiedMemberFieldError">{errors.gender}</small> : <small>Utilizada para validar inscrições e formação de duplas conforme o regulamento da competição. Esta informação não será exibida publicamente.</small>}
          </div>

          <div className="formField">
            <label htmlFor="member-modal-dominant-hand">Mão dominante</label>
            <select id="member-modal-dominant-hand" value={profile.dominantHand || "Não informado"} onChange={(event) => onChange("dominantHand", event.target.value)}>
              <option>Não informado</option><option>Destro</option><option>Canhoto</option><option>Ambidestro</option>
            </select>
          </div>

          <div className="formField">
            <label htmlFor="member-modal-shirt-size">Tamanho da camiseta</label>
            <select id="member-modal-shirt-size" value={profile.shirtSize || "Não informado"} onChange={(event) => onChange("shirtSize", event.target.value)}>
              <option>Não informado</option><option>PP</option><option>P</option><option>M</option><option>G</option><option>GG</option><option>XGG</option>
            </select>
          </div>

          <div className="profileFormSectionHeader fullField">
            <span><MessageCircle aria-hidden="true" /></span>
            <div><strong>Contato para dupla e desafios</strong><small>Você escolhe se esses meios poderão aparecer após uma combinação esportiva.</small></div>
          </div>

          <div className="formField">
            <label htmlFor="member-modal-whatsapp"><MessageCircle aria-hidden="true" /> WhatsApp</label>
            <input
              id="member-modal-whatsapp"
              value={profile.whatsapp || ""}
              maxLength={20}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Ex.: 85999999999"
              onChange={(event) => onChange("whatsapp", event.target.value)}
              aria-invalid={Boolean(errors.whatsapp)}
            />
            {errors.whatsapp ? <small className="unifiedMemberFieldError">{errors.whatsapp}</small> : null}
          </div>

          <div className="formField">
            <label htmlFor="member-modal-telegram"><Send aria-hidden="true" /> Telegram</label>
            <input
              id="member-modal-telegram"
              value={profile.telegram || ""}
              maxLength={64}
              autoCapitalize="none"
              placeholder="seuusuario"
              onChange={(event) => onChange("telegram", event.target.value)}
              aria-invalid={Boolean(errors.telegram)}
            />
            {errors.telegram ? <small className="unifiedMemberFieldError">{errors.telegram}</small> : null}
          </div>

          <div className="formField">
            <label htmlFor="member-modal-instagram"><AtSign aria-hidden="true" /> Instagram</label>
            <input
              id="member-modal-instagram"
              value={profile.instagram || ""}
              maxLength={64}
              autoCapitalize="none"
              placeholder="seuusuario"
              onChange={(event) => onChange("instagram", event.target.value)}
              aria-invalid={Boolean(errors.instagram)}
            />
            {errors.instagram ? <small className="unifiedMemberFieldError">{errors.instagram}</small> : null}
          </div>

          <label className="memberContactVisibility fullField">
            <input
              type="checkbox"
              checked={Boolean(profile.showContacts)}
              onChange={(event) => onChange("showContacts", event.target.checked)}
            />
            <Eye aria-hidden="true" />
            <span><strong>Permitir contato após uma combinação</strong><small>WhatsApp, Telegram ou Instagram serão mostrados somente quando você habilitar esta opção.</small></span>
          </label>
          </> : null}
        </div>

        <footer>
          <button type="button" className="secondaryBtn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button"
            className="saveProfileBtn actionConfirmBtn"
            onClick={onSave}
            disabled={loading || saving || !schemaAvailable || ["checking", "invalid", "unavailable"].includes(handleAvailability?.status)}
            aria-busy={saving}
          >
            <Save aria-hidden="true" /> {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </footer>
      </section>
    </div>
  );
}
