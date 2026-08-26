import React, { useEffect } from "react";
import { AtSign, MapPin, Save, X } from "lucide-react";

export default function MemberProfileDetailsModal({
  open,
  profile,
  errors = {},
  loading = false,
  saving = false,
  schemaAvailable = true,
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
            <div className="unifiedMemberHandleField">
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
                aria-invalid={Boolean(errors.handle)}
              />
            </div>
            {errors.handle ? <small className="unifiedMemberFieldError">{errors.handle}</small> : <small>Seu identificador único na plataforma.</small>}
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
            />
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
        </div>

        <footer>
          <button type="button" className="secondaryBtn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button"
            className="saveProfileBtn actionConfirmBtn"
            onClick={onSave}
            disabled={loading || saving || !schemaAvailable}
            aria-busy={saving}
          >
            <Save aria-hidden="true" /> {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </footer>
      </section>
    </div>
  );
}
