import React from "react";
import {
  Award,
  AtSign,
  Camera,
  Eye,
  Images,
  MapPin,
  Settings,
  Share2,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { getMemberProfileInitials } from "../../domain/memberProfile.mjs";

export const MEMBER_PROFILE_TABS = [
  { id: "atividades", label: "Torneios/Circuitos", Icon: Trophy },
  { id: "desafios", label: "Desafios", Icon: Swords },
  { id: "fotos", label: "Fotos", Icon: Images },
  { id: "contato", label: "Sobre", Icon: AtSign },
  { id: "conquistas", label: "Conquistas", Icon: Award },
];

export const OWNER_MEMBER_PROFILE_TABS = [
  MEMBER_PROFILE_TABS[0],
  { id: "duplas", label: "Procurando dupla", Icon: Users },
  ...MEMBER_PROFILE_TABS.slice(1),
];

function MediaInput({ disabled, onFile }) {
  return (
    <input
      type="file"
      accept="image/*"
      disabled={disabled}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile?.(file);
        event.target.value = "";
      }}
    />
  );
}

export function MemberProfileIdentityCard({
  profile,
  editable = false,
  busy = false,
  summaryItems = [],
  onCoverFile,
  onPhotoFile,
  onEdit,
  onView,
  onShare,
}) {
  const location = [profile?.city, profile?.state].filter(Boolean).join("/");
  const coverContent = profile?.coverUrl
    ? <img src={profile.coverUrl} alt={`Capa do perfil de ${profile.displayName}`} />
    : null;
  const avatarContent = profile?.photoUrl
    ? <img src={profile.photoUrl} alt={`Foto de ${profile.displayName}`} />
    : editable
      ? <UserRound aria-hidden="true" />
      : <span>{getMemberProfileInitials(profile)}</span>;

  return (
    <article className={`publicMemberIdentityCard memberProfileIdentityCard${editable ? " isEditable" : ""}`}>
      {editable ? (
        <label className="publicMemberCover memberProfileEditableMedia" title="Alterar foto de capa">
          <MediaInput disabled={busy} onFile={onCoverFile} />
          {coverContent}
          <span className="memberProfileCoverEditBadge"><Camera aria-hidden="true" /> Alterar capa</span>
        </label>
      ) : (
        <div className={`publicMemberCover${profile?.coverUrl ? " hasImage" : ""}`}>{coverContent}</div>
      )}

      <div className="publicMemberIdentity">
        {editable ? (
          <label className="publicMemberAvatar memberProfileEditableMedia memberProfileEditableAvatar" title="Alterar foto do perfil">
            <MediaInput disabled={busy} onFile={onPhotoFile} />
            {avatarContent}
            <i><Camera aria-hidden="true" /></i>
          </label>
        ) : (
          <div className="publicMemberAvatar">{avatarContent}</div>
        )}

        <div className="publicMemberCopy">
          <div className="publicMemberNameRow">
            <div>
              <h1>{profile?.displayName || "Perfil Torneio 360"}</h1>
              <span className="publicMemberAthleteIdentityBadge">Atleta</span>
              <p>{profile?.handle ? `@${profile.handle}` : "Perfil Torneio 360"}</p>
            </div>
            <div className="memberProfileIdentityActions">
              {editable ? (
                <button type="button" onClick={onEdit} disabled={busy}>
                  <Settings aria-hidden="true" /> Editar perfil
                </button>
              ) : null}
              {onView ? (
                <button type="button" onClick={onView}>
                  <Eye aria-hidden="true" /> Ver como visitante
                </button>
              ) : null}
              {onShare ? (
                <button type="button" onClick={onShare} aria-label="Compartilhar perfil">
                  <Share2 aria-hidden="true" /> Compartilhar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {profile?.bio ? <p className="publicMemberBio">{profile.bio}</p> : null}
        {location ? <p className="publicMemberLocation"><MapPin aria-hidden="true" /> {location}</p> : null}

        <div className="publicMemberSummary" aria-label="Resumo do perfil">
          {summaryItems.map((item) => (
            <span key={item.label}>
              <small>{item.label}:</small>
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function MemberProfileTabs({ activeTab, onChange, owner = false }) {
  const tabs = owner ? OWNER_MEMBER_PROFILE_TABS : MEMBER_PROFILE_TABS;
  return (
    <nav className="publicMemberProfileTabs" aria-label="Seções do perfil" role="tablist">
      {tabs.map(({ id, label, Icon }) => (
        <button
          type="button"
          role="tab"
          key={id}
          className={activeTab === id ? "active" : ""}
          onClick={() => onChange(id)}
          aria-selected={activeTab === id}
        >
          <Icon aria-hidden="true" /> {label}
        </button>
      ))}
    </nav>
  );
}
