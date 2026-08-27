import React from "react";
import {
  AtSign,
  Building2,
  Camera,
  Grid3X3,
  Images,
  MapPin,
  Settings,
  Users,
} from "lucide-react";

function OrganizationCover({
  profile,
  canEdit,
  coverBusy,
  onSelectCover,
}) {
  const className = `unifiedProfilePublicCover organizationProfileCoverShortcut${canEdit ? " editableProfileCover" : ""}${profile.coverUrl ? " hasCover" : ""}`;
  const content = (
    <>
      {profile.coverUrl ? <img src={profile.coverUrl} alt={`Capa de ${profile.arenaName || "organização"}`} /> : null}
      {canEdit ? (
        <span className="profileMediaEditBadge">
          <Camera aria-hidden="true" /> {coverBusy ? "Salvando capa..." : "Alterar capa da organização"}
        </span>
      ) : null}
    </>
  );

  if (!canEdit) {
    return <div className={className}>{content}</div>;
  }

  return (
    <label className={className} title="Escolher a capa da organização">
      <input
        type="file"
        accept="image/*"
        disabled={coverBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelectCover?.(file);
          event.target.value = "";
        }}
      />
      {content}
    </label>
  );
}

function OrganizationAvatar({ profile, canEdit, avatarBusy, onSelectAvatar }) {
  const className = `instagramProfilePhoto organizationProfileAvatarShortcut${canEdit ? " editableProfileAvatar" : ""}`;
  const content = profile.photoUrl
    ? <img src={profile.photoUrl} alt={`Foto de ${profile.arenaName || "organização"}`} />
    : <span><Building2 aria-hidden="true" /></span>;

  if (!canEdit) return <div className={className}>{content}</div>;

  return (
    <label className={className} title="Alterar foto da organização">
      <input
        type="file"
        accept="image/*"
        disabled={avatarBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelectAvatar?.(file);
          event.target.value = "";
        }}
      />
      {content}
    </label>
  );
}

/**
 * Fonte única da apresentação do perfil da organização.
 * O perfil próprio e o perfil visitado usam exatamente este componente;
 * `canEdit` controla somente as ações permitidas ao proprietário.
 */
export default function OrganizationProfilePresentation({
  profile,
  canEdit = false,
  canManageRegistrants = false,
  activeTab = "publicacoes",
  onTabChange,
  onEdit,
  onSelectCover,
  onSelectAvatar,
  coverBusy = false,
  avatarBusy = false,
  galleryCount = 0,
  tournamentCount = 0,
  circuitCount = 0,
  followersCount = 0,
}) {
  const location = [profile.city, profile.state].filter(Boolean).join("/");

  return (
    <>
      <OrganizationCover
        profile={profile}
        canEdit={canEdit}
        coverBusy={coverBusy}
        onSelectCover={onSelectCover}
      />

      <div className="instagramProfileHeader unifiedProfileHeader">
        <OrganizationAvatar
          profile={profile}
          canEdit={canEdit}
          avatarBusy={avatarBusy}
          onSelectAvatar={onSelectAvatar}
        />
        <div className="instagramProfileInfo">
          <div className="instagramProfileTopline">
            <div className="organizationProfileName">
              <h2>{profile.arenaName || "Minha organização"}</h2>
              <span className="organizationIdentityBadge">Organização</span>
            </div>
            {canEdit ? (
              <button type="button" className="secondaryBtn profileEditShortcut" onClick={onEdit}>
                <Settings aria-hidden="true" /> Editar organização
              </button>
            ) : null}
          </div>
          <p className="unifiedProfileHandle">{profile.instagramHandle || "Perfil oficial da organização"}</p>
          {profile.organizerName ? <p className="unifiedProfileBio">Responsável: {profile.organizerName}</p> : null}
          {location ? <p className="unifiedProfileLocation"><MapPin aria-hidden="true" /> {location}</p> : null}
          <div className="unifiedProfileStats" aria-label="Resumo do perfil">
            <span><strong>{galleryCount}</strong><small>Fotos</small></span>
            <span><strong>{tournamentCount}</strong><small>Torneios</small></span>
            <span><strong>{circuitCount}</strong><small>Circuitos</small></span>
            <span><strong>{followersCount}</strong><small>Seguidores</small></span>
          </div>
        </div>
      </div>

      <div className="profileSubtabs" role="tablist" aria-label="Seções do perfil da organização">
        <button type="button" role="tab" className={activeTab === "publicacoes" ? "active" : ""} onClick={() => onTabChange?.("publicacoes")} aria-selected={activeTab === "publicacoes"}>
          <Grid3X3 aria-hidden="true" /> Publicações
        </button>
        <button type="button" role="tab" className={activeTab === "fotos" ? "active" : ""} onClick={() => onTabChange?.("fotos")} aria-selected={activeTab === "fotos"}>
          <Images aria-hidden="true" /> Fotos
        </button>
        <button type="button" role="tab" className={activeTab === "contato" ? "active" : ""} onClick={() => onTabChange?.("contato")} aria-selected={activeTab === "contato"}>
          <AtSign aria-hidden="true" /> Sobre
        </button>
        {canManageRegistrants ? (
          <button type="button" role="tab" className={activeTab === "inscritos" ? "active" : ""} onClick={() => onTabChange?.("inscritos")} aria-selected={activeTab === "inscritos"}>
            <Users aria-hidden="true" /> Inscritos
          </button>
        ) : null}
      </div>
    </>
  );
}
