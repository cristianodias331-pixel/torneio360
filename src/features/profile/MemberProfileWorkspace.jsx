import React, { useEffect, useMemo, useRef, useState } from "react";
import { Award, AtSign, ImagePlus, Images, MapPin } from "lucide-react";
import {
  MAX_MEMBER_GALLERY_PHOTOS,
  createMemberProfileFallback,
  normalizeMemberHandle,
  validateMemberProfile,
} from "../../domain/memberProfile.mjs";
import { prepareSocialPostImageFile } from "../media/imageResize.mjs";
import {
  uploadMemberProfileCover,
  uploadMemberProfileGalleryPhoto,
  uploadMemberProfilePhoto,
} from "../../services/mediaStorage.mjs";
import { loadMyMemberProfile, saveMyMemberProfile } from "../../services/memberProfileApi.mjs";
import MemberProfileDetailsModal from "./MemberProfileDetailsModal.jsx";
import {
  MemberProfileIdentityCard,
  MemberProfileTabs,
} from "./MemberProfilePresentation.jsx";
import ProfileImageEditor from "./ProfileImageEditor.jsx";
import AthleteProfileActivity from "./AthleteProfileActivity.jsx";
import UnifiedPlatformFrame from "../appShell/UnifiedPlatformFrame.jsx";
import NotificationCenter from "../notifications/NotificationCenter.jsx";
import useUnreadNotificationCount from "../notifications/useUnreadNotificationCount.js";
import { PublicExploreSection, PublicTournamentFeedSection } from "../publicArena/PublicPlatformHomeController.jsx";
import "../../styles/51-unified-profile.css";
import "../../styles/52-public-member-profile.css";

function readLocalAthleteDetails(userId) {
  if (!userId) return {};
  try {
    const value = JSON.parse(localStorage.getItem(`torneio360:athlete-details:${userId}`) || "null");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveLocalAthleteDetails(userId, profile) {
  if (!userId) return;
  try {
    localStorage.setItem(`torneio360:athlete-details:${userId}`, JSON.stringify({
      sportsCategory: profile.sportsCategory || "",
      dominantHand: profile.dominantHand || "Não informado",
      shirtSize: profile.shirtSize || "Não informado",
    }));
  } catch {
    // O perfil público continua funcional mesmo sem armazenamento local.
  }
}

export default function MemberProfileWorkspace({ supabase, user, accessProfile, onLogout, publicPlatformHomeRuntime }) {
  const { unreadCount: unreadNotificationCount } = useUnreadNotificationCount({ supabase, enabled: Boolean(user?.id) });
  const fallback = useMemo(() => ({
    ...createMemberProfileFallback({ user, accessProfile }),
    ...readLocalAthleteDetails(user?.id),
  }), [accessProfile?.name, user?.email, user?.id]);
  const [profile, setProfile] = useState(fallback);
  const baseProfileRef = useRef(fallback);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [activePanel, setActivePanel] = useState(() => {
    const panel = new URLSearchParams(window.location.search).get("aba");
    return panel === "notificacoes" ? "notifications" : panel === "explorar" ? "explore" : panel === "ajustes" ? "profile" : "overview";
  });
  const [activeProfileTab, setActiveProfileTab] = useState("atividades");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageEditor, setImageEditor] = useState(null);
  const [browsingTournament, setBrowsingTournament] = useState(null);
  const [browsingTournamentLoading, setBrowsingTournamentLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    loadMyMemberProfile({ supabase, fallback })
      .then((result) => {
        if (!active) return;
        baseProfileRef.current = result.profile;
        setProfile(result.profile);
        setStatus(result.schemaAvailable ? "ready" : "unavailable");
      })
      .catch((error) => {
        console.error("Erro ao carregar o perfil esportivo:", error);
        if (!active) return;
        setProfile(fallback);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [fallback, supabase]);

  function updateProfile(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: field === "handle" ? normalizeMemberHandle(value) : value,
    }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function closeImageEditor() {
    setImageEditor((current) => {
      if (current?.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(current.sourceUrl);
      return null;
    });
  }

  function openImageEditor(file, kind) {
    if (!file || saving) return;
    if (!String(file.type || "").startsWith("image/")) {
      setNotice({ tone: "warning", message: "Escolha uma foto em JPG, PNG ou WebP." });
      return;
    }
    setImageEditor((current) => {
      if (current?.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(current.sourceUrl);
      return { kind, sourceUrl: URL.createObjectURL(file), fileName: file.name || "imagem" };
    });
  }

  async function applyImageEditor({ imageUrl }) {
    const field = imageEditor?.kind === "cover" ? "coverUrl" : "photoUrl";
    const nextProfile = { ...profile, [field]: imageUrl };
    setProfile(nextProfile);
    const saved = await saveProfile(nextProfile);
    if (saved) closeImageEditor();
    return saved;
  }

  async function selectGalleryPhotos(files) {
    if (!files?.length || saving) return;
    const availableSlots = Math.max(0, MAX_MEMBER_GALLERY_PHOTOS - profile.galleryPhotos.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (!selectedFiles.length) {
      setNotice({ tone: "info", message: "A galeria já possui as seis fotos permitidas." });
      return;
    }
    try {
      const prepared = await Promise.all(selectedFiles.map((file) => prepareSocialPostImageFile(file)));
      setProfile((current) => ({
        ...current,
        galleryPhotos: [...current.galleryPhotos, ...prepared.map((entry) => entry.imageUrl)]
          .slice(0, MAX_MEMBER_GALLERY_PHOTOS),
      }));
    } catch (error) {
      setNotice({ tone: "warning", message: error?.message || "Escolha outras imagens." });
    }
  }

  function removeGalleryPhoto(index) {
    setProfile((current) => ({
      ...current,
      galleryPhotos: current.galleryPhotos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  function openPublicProfile() {
    const url = new URL(window.location.origin);
    url.searchParams.set("perfil", profile.handle || user.id);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function saveProfile(profileOverride = null) {
    if (!user?.id || saving) return;
    const requestedProfile = profileOverride?.userId ? profileOverride : profile;
    const validation = validateMemberProfile(requestedProfile);
    setErrors(validation.errors);
    if (!validation.valid) {
      setNotice({ tone: "warning", message: "Corrija os campos indicados antes de salvar." });
      return false;
    }
    if (status === "unavailable") {
      setNotice({ tone: "warning", message: "A estrutura do perfil ainda não foi aplicada ao banco de teste." });
      return false;
    }
    if (JSON.stringify(validation.profile) === JSON.stringify(baseProfileRef.current)) {
      setNotice({ tone: "info", message: "Seu perfil já está atualizado." });
      return true;
    }

    setSaving(true);
    setNotice(null);
    let nextProfile = validation.profile;
    try {
      if (/^data:image\//i.test(nextProfile.photoUrl)) {
        nextProfile = {
          ...nextProfile,
          photoUrl: await uploadMemberProfilePhoto({ supabase, userId: user.id, photoUrl: nextProfile.photoUrl }),
        };
      }
      if (/^data:image\//i.test(nextProfile.coverUrl)) {
        nextProfile = {
          ...nextProfile,
          coverUrl: await uploadMemberProfileCover({ supabase, userId: user.id, coverUrl: nextProfile.coverUrl }),
        };
      }
      nextProfile = {
        ...nextProfile,
        galleryPhotos: await Promise.all(nextProfile.galleryPhotos.map((photoUrl, index) => (
          /^data:image\//i.test(photoUrl)
            ? uploadMemberProfileGalleryPhoto({ supabase, userId: user.id, photoUrl, position: index + 1 })
            : photoUrl
        ))),
      };

      const result = await saveMyMemberProfile({ supabase, profile: nextProfile, fallback });
      if (!result.schemaAvailable) {
        setStatus("unavailable");
        setNotice({ tone: "warning", message: "A estrutura do perfil ainda não foi aplicada ao banco de teste." });
        return false;
      }
      baseProfileRef.current = result.profile;
      saveLocalAthleteDetails(user.id, result.profile);
      setProfile(result.profile);
      setStatus("ready");
      setNotice({ tone: "success", message: "Perfil esportivo atualizado com sucesso." });
      return true;
    } catch (error) {
      console.error("Erro ao salvar o perfil esportivo:", error);
      const duplicateHandle = String(error?.code || "") === "23505"
        || String(error?.message || "").toLocaleLowerCase("pt-BR").includes("nome de usuário já está em uso");
      if (duplicateHandle) setErrors((current) => ({ ...current, handle: "Este nome de usuário já está em uso." }));
      setNotice({
        tone: "error",
        message: duplicateHandle ? "Escolha outro nome de usuário." : "Não foi possível salvar o perfil agora.",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDetailsAndClose() {
    const saved = await saveProfile();
    if (saved) setDetailsOpen(false);
  }

  function navigate(panel) {
    if (panel === "overview" || panel === "explore" || panel === "profile" || panel === "notifications") {
      setNotice(null);
      setBrowsingTournament(null);
      setActivePanel(panel);
      return;
    }
    setNotice({
      tone: "info",
      message: "A criação de torneios e circuitos pertence a uma identidade de organização. Seu perfil de atleta continua no mesmo ambiente, apenas sem permissão de gestão.",
    });
  }

  async function openPublishedTournament(item, initialTab = "") {
    const publicId = String(item?.public_id || "").trim();
    if (!publicId || browsingTournamentLoading) return;
    setBrowsingTournamentLoading(true);
    try {
      const result = await publicPlatformHomeRuntime.fetchPublicTournamentDetail(publicId);
      if (result?.error || !result?.data) {
        setNotice({ tone: "error", message: "Não foi possível abrir este torneio agora." });
        return;
      }
      setBrowsingTournament({ ...result.data, _initialPublicTab: initialTab });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } finally {
      setBrowsingTournamentLoading(false);
    }
  }

  return (
    <UnifiedPlatformFrame
      activePanel={activePanel}
      hasSession
      title={activePanel === "profile" ? "Meu perfil" : activePanel === "notifications" ? "Notificações" : activePanel === "explore" ? "Explorar" : "Início"}
      eyebrow={activePanel === "profile" ? "Perfil de atleta" : activePanel === "notifications" ? "Central da plataforma" : activePanel === "explore" ? "Descobrir" : "Publicações"}
      description={activePanel === "profile"
        ? "Seu perfil pessoal como ele aparece para a comunidade. Somente você pode editar."
        : activePanel === "notifications"
          ? "Acompanhe convites de dupla, inscrições e decisões importantes."
        : activePanel === "explore"
          ? "Encontre torneios, organizações e outros atletas."
          : "Acompanhe as publicações de torneios das organizações."}
      accountLabel="Sair"
      unreadNotificationCount={unreadNotificationCount}
      onAccountAction={onLogout}
      onNavigate={navigate}
    >
      {notice ? <div className={`memberProfileWorkspaceNotice ${notice.tone}`} role="status">{notice.message}</div> : null}
      {imageEditor ? (
        <ProfileImageEditor
          kind={imageEditor.kind}
          sourceUrl={imageEditor.sourceUrl}
          fileName={imageEditor.fileName}
          onCancel={closeImageEditor}
          onApply={applyImageEditor}
        />
      ) : null}
      <MemberProfileDetailsModal
        open={detailsOpen}
        profile={profile}
        errors={errors}
        loading={status === "loading"}
        saving={saving}
        schemaAvailable={status !== "unavailable"}
        onChange={updateProfile}
        onClose={() => { if (!saving) setDetailsOpen(false); }}
        onSave={saveDetailsAndClose}
      />
      {activePanel === "notifications" ? <NotificationCenter supabase={supabase} onOpenTournament={(item) => openPublishedTournament(item)} /> : null}
      {activePanel !== "profile" && activePanel !== "notifications" && browsingTournament
          ? publicPlatformHomeRuntime.renderPublicTournament({
            tournament: browsingTournament,
            embedded: true,
              initialTab: browsingTournament._initialPublicTab || "",
              viewer: {
                ...user,
                user_metadata: {
                  ...user.user_metadata,
                  category: profile.sportsCategory,
                  dominant_hand: profile.dominantHand,
                },
              },
              onBackToArena: () => setBrowsingTournament(null),
            })
          : activePanel !== "profile" && activePanel !== "notifications" && browsingTournamentLoading
            ? <section className="publicMemberSection"><p>Carregando o torneio no mesmo ambiente...</p></section>
            : activePanel === "overview" && publicPlatformHomeRuntime
              ? <PublicTournamentFeedSection runtime={publicPlatformHomeRuntime} hasSession embedded onOpenTournament={openPublishedTournament} onRegister={(_, item) => openPublishedTournament(item, "inscricao")} />
              : activePanel === "explore" && publicPlatformHomeRuntime
                ? <PublicExploreSection runtime={publicPlatformHomeRuntime} hasSession onOpenTournament={openPublishedTournament} />
                : activePanel === "profile" ? (
        <div className="memberProfileOwnExperience">
          {!status || status === "loading" ? <div className="memberProfileOwnLoading" role="status">Carregando seu perfil...</div> : null}
          {status === "unavailable" ? (
            <div className="unifiedMemberSchemaNotice" role="status">
              A nova estrutura do perfil ainda não foi aplicada ao banco de homologação. Seus dados atuais permanecem intactos.
            </div>
          ) : null}

          <MemberProfileIdentityCard
            profile={profile}
            editable
            busy={saving || status === "loading"}
            summaryItems={[
              { value: profile.sportsCategory || "A definir", label: "Categoria" },
              { value: profile.galleryPhotos.length, label: "Fotos" },
              { value: profile.dominantHand || "Não informado", label: "Mão dominante" },
              { value: profile.followersCount || 0, label: "Seguidores" },
            ]}
            onCoverFile={(file) => openImageEditor(file, "cover")}
            onPhotoFile={(file) => openImageEditor(file, "photo")}
            onEdit={() => setDetailsOpen(true)}
            onView={openPublicProfile}
          />

          <MemberProfileTabs activeTab={activeProfileTab} onChange={setActiveProfileTab} owner />

          {["atividades", "duplas", "desafios"].includes(activeProfileTab) ? (
            <AthleteProfileActivity
              supabase={supabase}
              profile={profile}
              activeTab={activeProfileTab}
              owner
              onOpenTournament={openPublishedTournament}
            />
          ) : null}

          {activeProfileTab === "fotos" ? (
            <section className="publicMemberSection unifiedMemberGalleryEditor" aria-labelledby="athlete-profile-gallery-title">
              <header>
                <div>
                  <span><Images aria-hidden="true" /></span>
                  <div>
                    <h3 id="athlete-profile-gallery-title">Fotos do perfil</h3>
                    <p>Até seis fotos. Elas aparecem no seu perfil sem curtidas nem comentários.</p>
                  </div>
                </div>
                <strong>{profile.galleryPhotos.length}/{MAX_MEMBER_GALLERY_PHOTOS}</strong>
              </header>

              <div className="unifiedMemberGalleryGrid">
                {profile.galleryPhotos.map((photoUrl, index) => (
                  <figure key={`${photoUrl}-${index}`}>
                    <img src={photoUrl} alt={`Foto ${index + 1} do perfil`} />
                    <button type="button" onClick={() => removeGalleryPhoto(index)} disabled={saving}>Remover</button>
                  </figure>
                ))}
                {profile.galleryPhotos.length < MAX_MEMBER_GALLERY_PHOTOS ? (
                  <label className="unifiedMemberGalleryAdd">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={saving}
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        if (files.length) selectGalleryPhotos(files);
                        event.target.value = "";
                      }}
                    />
                    <ImagePlus aria-hidden="true" />
                    <strong>Adicionar fotos</strong>
                    <small>Restam {MAX_MEMBER_GALLERY_PHOTOS - profile.galleryPhotos.length}</small>
                  </label>
                ) : null}
              </div>
              {errors.galleryPhotos ? <small className="unifiedMemberFieldError">{errors.galleryPhotos}</small> : null}
              <div className="profilePhotosActions">
                <button type="button" className="saveProfileBtn actionConfirmBtn" onClick={() => saveProfile()} disabled={saving || status === "unavailable"}>
                  {saving ? "Salvando..." : "Salvar fotos"}
                </button>
              </div>
            </section>
          ) : null}

          {activeProfileTab === "contato" ? (
            <section className="publicMemberSection memberProfileOwnContact">
              <header><div><AtSign aria-hidden="true" /><h2>Sobre</h2></div></header>
              <div>
                <MapPin aria-hidden="true" />
                <span><strong>Localização pública</strong><small>{[profile.city, profile.state].filter(Boolean).join("/") || "Não informada"}</small></span>
              </div>
              <div>
                <span aria-hidden="true">🎾</span>
                <span><strong>Categoria</strong><small>{profile.sportsCategory || "Não informada"}</small></span>
              </div>
              <div>
                <span aria-hidden="true">✋</span>
                <span><strong>Mão dominante</strong><small>{profile.dominantHand || "Não informada"}</small></span>
              </div>
              <div>
                <span aria-hidden="true">👕</span>
                <span><strong>Tamanho da camiseta</strong><small>{profile.shirtSize || "Não informado"}</small></span>
              </div>
              <p>{profile.showContacts
                ? "Seus contatos continuam privados e só aparecem após uma combinação de dupla ou um desafio aceito."
                : "Seus contatos permanecem privados até você autorizar o uso em combinações esportivas."}</p>
              <button type="button" className="secondaryBtn" onClick={() => setDetailsOpen(true)}>Editar informações do perfil</button>
            </section>
          ) : null}

          {activeProfileTab === "conquistas" ? (
            <section className="publicMemberSection publicMemberEmptyProfileSection">
              <Award aria-hidden="true" />
              <strong>Conquistas</strong>
              <span>Resultados e títulos reconhecidos pela plataforma aparecerão aqui.</span>
            </section>
          ) : null}
        </div>
      ) : null}
    </UnifiedPlatformFrame>
  );
}
