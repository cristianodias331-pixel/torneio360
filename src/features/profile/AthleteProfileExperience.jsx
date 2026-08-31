import React, { useEffect, useState } from "react";
import { AtSign, Hand, ImagePlus, Images, MapPin, Shirt, Trophy, UserRound, X, ZoomIn } from "lucide-react";
import { MAX_MEMBER_GALLERY_PHOTOS } from "../../domain/memberProfile.mjs";
import AthleteProfileActivity from "./AthleteProfileActivity.jsx";
import {
  MemberProfileIdentityCard,
  MemberProfileTabs,
} from "./MemberProfilePresentation.jsx";

export default function AthleteProfileExperience({
  supabase,
  profile,
  owner = false,
  activeTab,
  onTabChange,
  busy = false,
  schemaAvailable = true,
  errors = {},
  onCoverFile,
  onPhotoFile,
  onEdit,
  onView,
  onOpenTournament,
  onRemoveGalleryPhoto,
  onSelectGalleryPhotos,
  onSavePhotos,
}) {
  const [lightboxPhoto, setLightboxPhoto] = useState("");
  const galleryPhotos = Array.isArray(profile?.galleryPhotos) ? profile.galleryPhotos : [];

  useEffect(() => {
    if (!lightboxPhoto) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLightboxPhoto("");
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxPhoto]);

  return (
    <div className={`memberProfileOwnExperience athleteProfileRealExperience${owner ? " isOwner" : " isVisitor"}`}>
      <MemberProfileIdentityCard
        profile={profile}
        editable={owner}
        busy={busy}
        summaryItems={[
          { value: profile?.sportsCategory || "A definir", label: "Categoria" },
          { value: galleryPhotos.length, label: "Fotos" },
          { value: profile?.dominantHand || "Não informado", label: "Mão dominante" },
          { value: profile?.followersCount || 0, label: "Seguidores" },
        ]}
        onCoverFile={onCoverFile}
        onPhotoFile={onPhotoFile}
        onEdit={owner ? onEdit : undefined}
        onView={owner ? onView : undefined}
      />

      <MemberProfileTabs activeTab={activeTab} onChange={onTabChange} owner={owner} />

      {(["atividades", "duplas", "desafios", "conquistas"].includes(activeTab)) ? (
        <AthleteProfileActivity
          supabase={supabase}
          profile={profile}
          activeTab={activeTab}
          owner={owner}
          onOpenTournament={onOpenTournament}
        />
      ) : null}

      {activeTab === "fotos" ? (
        <section className="publicMemberSection unifiedMemberGalleryEditor athleteProfileSharedGallery" aria-labelledby="athlete-profile-gallery-title">
          <header>
            <div>
              <span><Images aria-hidden="true" /></span>
              <div>
                <h3 id="athlete-profile-gallery-title">Fotos do perfil</h3>
                <p>Até dez fotos. Elas aparecem no perfil sem curtidas nem comentários.</p>
              </div>
            </div>
            <strong>{galleryPhotos.length}/{MAX_MEMBER_GALLERY_PHOTOS}</strong>
          </header>

          {galleryPhotos.length || owner ? (
            <div className="unifiedMemberGalleryGrid">
              {galleryPhotos.map((photoUrl, index) => (
                <figure key={`${photoUrl}-${index}`}>
                  <img
                    src={photoUrl}
                    alt={`Foto ${index + 1} de ${profile?.displayName || "atleta"}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setLightboxPhoto(photoUrl)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setLightboxPhoto(photoUrl);
                    }}
                  />
                  <ZoomIn className="athleteProfileGalleryZoom" aria-hidden="true" />
                  {owner ? <button type="button" onClick={() => onRemoveGalleryPhoto?.(index)} disabled={busy}>Remover</button> : null}
                </figure>
              ))}
              {owner && galleryPhotos.length < MAX_MEMBER_GALLERY_PHOTOS ? (
                <label className="unifiedMemberGalleryAdd">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={busy}
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      if (files.length) onSelectGalleryPhotos?.(files);
                      event.target.value = "";
                    }}
                  />
                  <ImagePlus aria-hidden="true" />
                  <strong>Adicionar fotos</strong>
                  <small>Restam {MAX_MEMBER_GALLERY_PHOTOS - galleryPhotos.length}</small>
                </label>
              ) : null}
            </div>
          ) : (
            <div className="publicMemberEmptyGallery">
              <UserRound aria-hidden="true" />
              <strong>Nenhuma foto publicada</strong>
              <span>O atleta ainda não adicionou imagens à galeria.</span>
            </div>
          )}
          {errors.galleryPhotos ? <small className="unifiedMemberFieldError">{errors.galleryPhotos}</small> : null}
          {owner ? (
            <div className="profilePhotosActions">
              <button type="button" className="saveProfileBtn actionConfirmBtn" onClick={onSavePhotos} disabled={busy || !schemaAvailable}>
                {busy ? "Salvando..." : "Salvar fotos"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "contato" ? (
        <section className="publicMemberSection memberProfileOwnContact">
          <header><div><AtSign aria-hidden="true" /><h2>Sobre</h2></div></header>
          <div>
            <MapPin aria-hidden="true" />
            <span><strong>Localização pública</strong><small>{[profile?.city, profile?.state].filter(Boolean).join("/") || "Não informada"}</small></span>
          </div>
          <div><Trophy aria-hidden="true" /><span><strong>Categoria</strong><small>{profile?.sportsCategory || "Não informada"}</small></span></div>
          <div><Hand aria-hidden="true" /><span><strong>Mão dominante</strong><small>{profile?.dominantHand || "Não informada"}</small></span></div>
          <div><Shirt aria-hidden="true" /><span><strong>Tamanho da camiseta</strong><small>{profile?.shirtSize || "Não informado"}</small></span></div>
          <p>{profile?.showContacts
            ? "Os contatos permanecem protegidos e só são liberados depois de uma combinação esportiva válida."
            : "Os contatos permanecem privados até a autorização para uma combinação esportiva."}</p>
          {owner ? <button type="button" className="secondaryBtn" onClick={onEdit}>Editar informações do perfil</button> : null}
        </section>
      ) : null}

      {lightboxPhoto ? (
        <div className="publicMemberLightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLightboxPhoto("");
        }}>
          <button type="button" onClick={() => setLightboxPhoto("")} aria-label="Fechar foto"><X aria-hidden="true" /></button>
          <img src={lightboxPhoto} alt={`Foto ampliada de ${profile?.displayName || "atleta"}`} />
        </div>
      ) : null}
    </div>
  );
}
