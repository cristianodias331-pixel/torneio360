import React from "react";
import { Camera, Check, MapPin, ShieldCheck, UserRound } from "lucide-react";

export default function UnifiedMemberProfilePanel({
  profile,
  organizationName,
  errors = {},
  loading = false,
  saving = false,
  schemaAvailable = true,
  onChange,
  onPhotoFile,
  onRemovePhoto,
  onCoverFile,
  onRemoveCover,
  onSave,
}) {
  return (
    <section className="card unifiedMemberProfilePanel">
      <header className="unifiedMemberProfileHeading">
        <div>
          <span>Identidade única</span>
          <h2>Perfil pessoal</h2>
          <p>Este perfil representa você como atleta e organizador. Os dados da arena continuam separados.</p>
        </div>
        <div className="unifiedMemberOrganizationBadge">
          <ShieldCheck aria-hidden="true" />
          <span><small>Organização vinculada</small><strong>{organizationName || "Minha organização"}</strong></span>
        </div>
      </header>

      {!schemaAvailable ? (
        <div className="unifiedMemberSchemaNotice" role="status">
          A nova estrutura do perfil ainda não foi aplicada ao banco de homologação. Seus dados atuais permanecem intactos.
        </div>
      ) : null}

      <div className={`unifiedMemberCoverPicker${profile.coverUrl ? " hasCover" : ""}`}>
        {profile.coverUrl ? <img src={profile.coverUrl} alt="Foto de capa do perfil pessoal" /> : null}
        <label>
          <input
            type="file"
            accept="image/*"
            disabled={loading || saving}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onCoverFile(file);
              event.target.value = "";
            }}
          />
          <Camera aria-hidden="true" />
          <span>{profile.coverUrl ? "Alterar capa" : "Adicionar foto de capa"}</span>
        </label>
        {profile.coverUrl ? <button type="button" onClick={onRemoveCover} disabled={loading || saving}>Remover</button> : null}
      </div>

      <div className="unifiedMemberProfileBody" aria-busy={loading || saving}>
        <div className="unifiedMemberPhotoColumn">
          <label className="unifiedMemberPhotoPicker">
            <input
              type="file"
              accept="image/*"
              disabled={loading || saving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onPhotoFile(file);
                event.target.value = "";
              }}
            />
            <span className="unifiedMemberPhotoPreview">
              {profile.photoUrl ? <img src={profile.photoUrl} alt="Foto do perfil pessoal" /> : <UserRound aria-hidden="true" />}
              <i><Camera aria-hidden="true" /></i>
            </span>
            <strong>Foto pessoal</strong>
            <small>Clique para escolher uma imagem</small>
          </label>
          {profile.photoUrl ? (
            <button type="button" className="unifiedMemberRemovePhoto" onClick={onRemovePhoto} disabled={loading || saving}>
              Remover foto
            </button>
          ) : null}
        </div>

        <div className="unifiedMemberFields">
          <div className="formField">
            <label htmlFor="member-display-name">Nome de exibição</label>
            <input
              id="member-display-name"
              value={profile.displayName}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => onChange("displayName", event.target.value)}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName ? <small className="unifiedMemberFieldError">{errors.displayName}</small> : null}
          </div>

          <div className="formField">
            <label htmlFor="member-handle">Nome de usuário</label>
            <div className="unifiedMemberHandleField">
              <span>@</span>
              <input
                id="member-handle"
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
            {errors.handle ? <small className="unifiedMemberFieldError">{errors.handle}</small> : <small>Será o seu identificador único na plataforma.</small>}
          </div>

          <div className="formField fullField">
            <label htmlFor="member-bio">Apresentação</label>
            <textarea
              id="member-bio"
              value={profile.bio}
              maxLength={240}
              rows={4}
              placeholder="Conte um pouco sobre você, suas modalidades ou sua atuação no esporte."
              onChange={(event) => onChange("bio", event.target.value)}
            />
            <small className="unifiedMemberCharacterCount">{profile.bio.length}/240</small>
          </div>

          <div className="formField">
            <label htmlFor="member-city"><MapPin aria-hidden="true" /> Cidade</label>
            <input id="member-city" value={profile.city} maxLength={80} autoComplete="address-level2" onChange={(event) => onChange("city", event.target.value)} />
          </div>

          <div className="formField">
            <label htmlFor="member-state">Estado</label>
            <input id="member-state" value={profile.state} maxLength={80} autoComplete="address-level1" onChange={(event) => onChange("state", event.target.value)} />
          </div>

          <label className="unifiedMemberPrivacy fullField">
            <input type="checkbox" checked={profile.isPublic} onChange={(event) => onChange("isPublic", event.target.checked)} />
            <span><strong>Perfil pessoal público</strong><small>Permite que outros usuários encontrem seu perfil. E-mail, assinatura e dados privados nunca aparecem.</small></span>
          </label>
        </div>
      </div>

      <footer className="unifiedMemberProfileFooter">
        <span><Check aria-hidden="true" /> Torneios, circuitos e a assinatura não são alterados por este formulário.</span>
        <button type="button" className="saveProfileBtn actionConfirmBtn" onClick={onSave} disabled={loading || saving || !schemaAvailable} aria-busy={saving}>
          {saving ? "Salvando..." : "Salvar perfil pessoal"}
        </button>
      </footer>
    </section>
  );
}
