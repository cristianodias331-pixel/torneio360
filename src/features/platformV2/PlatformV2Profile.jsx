import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Camera,
  Check,
  CircleUserRound,
  ImagePlus,
  Images,
  MapPin,
  Plus,
  Settings,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  MAX_MEMBER_GALLERY_PHOTOS,
  createMemberProfileFallback,
  normalizeMemberHandle,
} from "../../domain/memberProfile.mjs";
import { prepareSocialPostImageFile } from "../media/imageResize.mjs";
import {
  uploadMemberProfileCover,
  uploadMemberProfileGalleryPhoto,
  uploadMemberProfilePhoto,
  uploadOrganizationProfileCover,
  uploadOrganizationProfileGalleryPhoto,
  uploadProfilePhoto,
} from "../../services/mediaStorage.mjs";
import { loadMyMemberProfile, saveMyMemberProfile } from "../../services/memberProfileApi.mjs";
import {
  loadMyOrganizationGallery,
  saveMyOrganizationGallery,
} from "../../services/publicSocialApi.mjs";
import {
  loadMyOrganizationCover,
  saveMyOrganizationCover,
} from "../../services/organizationCoverApi.mjs";
import ProfileImageEditor from "../profile/ProfileImageEditor.jsx";
import styles from "./PlatformV2App.module.css";

function getInitials(value, fallback = "T3") {
  const initials = String(value || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("");
  return initials || fallback;
}

function normalizeOrganization(profile) {
  return {
    name: profile?.arena_name || profile?.name || "Minha organização",
    photoUrl: profile?.photo_url || profile?.avatar_url || "",
    coverUrl: profile?.cover_url || "",
    city: profile?.city || "",
    state: profile?.state || "",
    bio: profile?.description || profile?.bio || "Organização esportiva no Torneio 360.",
    handle: profile?.instagram_handle || profile?.instagram || "",
  };
}

function IdentityAvatar({ name, photoUrl, Icon = UserRound, className = "" }) {
  return (
    <span className={`${styles.profileAvatar} ${className}`.trim()}>
      {photoUrl ? <img src={photoUrl} alt={`Foto de ${name}`} /> : <span>{getInitials(name)}<Icon aria-hidden="true" /></span>}
    </span>
  );
}

function PhotoGallery({ title, photos, busy, onAdd, onRemove }) {
  const remaining = MAX_MEMBER_GALLERY_PHOTOS - photos.length;
  return (
    <section className={styles.profilePanel} aria-labelledby={`${title.replace(/\s+/g, "-")}-title`}>
      <header className={styles.profilePanelHeader}>
        <div><Images aria-hidden="true" /><span><h2 id={`${title.replace(/\s+/g, "-")}-title`}>{title}</h2><p>Momentos, jogos e bastidores escolhidos para o perfil.</p></span></div>
        <strong>{photos.length}/{MAX_MEMBER_GALLERY_PHOTOS}</strong>
      </header>
      <div className={styles.profileGalleryGrid}>
        {photos.map((photoUrl, index) => (
          <figure key={`${photoUrl}-${index}`}>
            <img src={photoUrl} alt={`Foto ${index + 1} de ${title.toLocaleLowerCase("pt-BR")}`} />
            <button type="button" onClick={() => onRemove(index)} disabled={busy} aria-label={`Remover foto ${index + 1}`}><X /></button>
          </figure>
        ))}
        {remaining > 0 ? (
          <label className={styles.profileGalleryAdd}>
            <input type="file" accept="image/*" multiple disabled={busy} onChange={(event) => { onAdd(Array.from(event.target.files || [])); event.target.value = ""; }} />
            <ImagePlus aria-hidden="true" />
            <strong>{photos.length ? "Adicionar fotos" : "Criar galeria"}</strong>
            <small>{remaining === 1 ? "Resta 1 foto" : `Restam ${remaining} fotos`}</small>
          </label>
        ) : null}
      </div>
      {!photos.length ? <p className={styles.galleryHint}>Você pode selecionar várias imagens de uma vez. O limite total é de 10.</p> : null}
    </section>
  );
}

function ActivityPanel({ activity, events, identityMode }) {
  const entries = identityMode === "athlete"
    ? (activity?.registrations || []).slice(0, 4).map((entry) => ({
        id: entry.id,
        name: entry.tournament?.name || "Torneio",
        meta: entry.category || "Categoria a confirmar",
        image: entry.tournament?.cover_url || "",
      }))
    : events.slice(0, 4).map((entry) => ({
        id: entry.id || entry.public_id,
        name: entry?.data?.eventName || entry?.data?.name || entry?.name || "Torneio",
        meta: entry?.data?.location || "Publicado no Torneio 360",
        image: entry?.data?.coverImageThumbnailUrl || entry?.data?.coverImageUrl || entry?.cover_url || "",
      }));

  return (
    <section className={styles.profilePanel}>
      <header className={styles.profilePanelHeader}>
        <div><Trophy aria-hidden="true" /><span><h2>{identityMode === "athlete" ? "Atividades e resultados" : "Eventos publicados"}</h2><p>{identityMode === "athlete" ? "Histórico esportivo vinculado ao atleta." : "Torneios vinculados exclusivamente à organização."}</p></span></div>
      </header>
      {entries.length ? <div className={styles.profileActivityGrid}>{entries.map((entry) => (
        <article key={entry.id}>
          <span>{entry.image ? <img src={entry.image} alt="" /> : <Trophy />}</span>
          <div><strong>{entry.name}</strong><small>{entry.meta}</small></div>
          <Check aria-hidden="true" />
        </article>
      ))}</div> : <div className={styles.profileEmpty}><Trophy /><strong>Nenhuma atividade publicada ainda.</strong><small>Os próximos registros aparecerão aqui automaticamente.</small></div>}
    </section>
  );
}

export default function PlatformV2Profile({
  supabase,
  user,
  accessProfile,
  identityMode,
  activity,
  feedItems = [],
  onIdentitySummaryChange,
  onNotice,
}) {
  const fallback = useMemo(() => createMemberProfileFallback({
    user,
    accessProfile: accessProfile?.arena_name ? null : accessProfile,
  }), [accessProfile, user]);
  const [athlete, setAthlete] = useState(fallback);
  const [organization, setOrganization] = useState(() => normalizeOrganization(accessProfile));
  const [athleteStatus, setAthleteStatus] = useState("loading");
  const [athleteGallery, setAthleteGallery] = useState([]);
  const [organizationGallery, setOrganizationGallery] = useState([]);
  const [activeSection, setActiveSection] = useState("activity");
  const [busy, setBusy] = useState(false);
  const [imageEditor, setImageEditor] = useState(null);
  const [detailsDraft, setDetailsDraft] = useState(null);
  const hasOrganization = Boolean(accessProfile?.arena_name || accessProfile?.organization_name);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    setAthleteStatus("loading");
    loadMyMemberProfile({ supabase, fallback }).then((result) => {
      if (!active) return;
      setAthlete(result.profile);
      setAthleteGallery(result.profile.galleryPhotos || []);
      setAthleteStatus(result.schemaAvailable ? "ready" : "unavailable");
    }).catch(() => {
      if (!active) return;
      setAthlete(fallback);
      setAthleteGallery([]);
      setAthleteStatus("error");
    });
    return () => { active = false; };
  }, [fallback, supabase, user?.id]);

  useEffect(() => {
    setOrganization((current) => ({ ...normalizeOrganization(accessProfile), coverUrl: current.coverUrl || accessProfile?.cover_url || "" }));
  }, [accessProfile]);

  useEffect(() => {
    if (!user?.id || !hasOrganization) return undefined;
    let active = true;
    Promise.all([
      loadMyOrganizationGallery({ supabase }),
      loadMyOrganizationCover({ supabase, fallback: accessProfile?.cover_url || "" }),
    ]).then(([photos, cover]) => {
      if (!active) return;
      setOrganizationGallery(photos || []);
      setOrganization((current) => ({ ...current, coverUrl: cover.coverUrl || current.coverUrl }));
    }).catch(() => {
      if (active) onNotice?.("Não foi possível carregar todas as fotos da organização agora.");
    });
    return () => { active = false; };
  }, [accessProfile?.cover_url, hasOrganization, onNotice, supabase, user?.id]);

  useEffect(() => {
    onIdentitySummaryChange?.("athlete", { name: athlete.displayName, photoUrl: athlete.photoUrl, label: "Perfil do atleta" });
  }, [athlete.displayName, athlete.photoUrl, onIdentitySummaryChange]);

  useEffect(() => {
    if (!hasOrganization) return;
    onIdentitySummaryChange?.("organization", { name: organization.name, photoUrl: organization.photoUrl, label: "Perfil da organização" });
  }, [hasOrganization, onIdentitySummaryChange, organization.name, organization.photoUrl]);

  useEffect(() => { setActiveSection("activity"); }, [identityMode]);

  const current = identityMode === "organization" && hasOrganization ? organization : athlete;
  const currentGallery = identityMode === "organization" && hasOrganization ? organizationGallery : athleteGallery;
  const name = current.name || current.displayName || "Perfil Torneio 360";
  const photoUrl = current.photoUrl || "";
  const coverUrl = current.coverUrl || "";
  const location = [current.city, current.state].filter(Boolean).join(" · ");
  const organizationEvents = feedItems.filter((item) => String(item?.organization?.id || "") === String(accessProfile?.id || user?.id || ""));

  function openEditor(file, kind) {
    if (!file || busy) return;
    if (!String(file.type || "").startsWith("image/")) {
      onNotice?.("Escolha uma foto em JPG, PNG ou WebP.");
      return;
    }
    setImageEditor({ identity: identityMode, kind, sourceUrl: URL.createObjectURL(file), fileName: file.name || "imagem" });
  }

  function openDetailsEditor() {
    setDetailsDraft(identityMode === "organization" ? {
      name: organization.name,
      handle: organization.handle,
      city: organization.city,
      state: organization.state,
    } : {
      name: athlete.displayName,
      handle: athlete.handle,
      city: athlete.city,
      state: athlete.state,
      category: athlete.sportsCategory,
      bio: athlete.bio,
    });
  }

  function updateDetailsDraft(field, value) {
    setDetailsDraft((currentValue) => ({ ...currentValue, [field]: value }));
  }

  async function saveDetails() {
    if (!detailsDraft || busy) return;
    if (String(detailsDraft.name || "").trim().length < 2) {
      onNotice?.("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (identityMode === "organization") {
        const payload = {
          arena_name: String(detailsDraft.name || "").trim(),
          instagram_handle: String(detailsDraft.handle || "").trim().replace(/^@+/, ""),
          city: String(detailsDraft.city || "").trim(),
          state: String(detailsDraft.state || "").trim().toLocaleUpperCase("pt-BR").slice(0, 2),
        };
        const { data, error } = await supabase.from("profiles").update(payload).eq("id", user.id).select("*").maybeSingle();
        if (error) throw error;
        setOrganization((currentValue) => ({
          ...currentValue,
          name: data?.arena_name || payload.arena_name,
          handle: data?.instagram_handle || payload.instagram_handle,
          city: data?.city || payload.city,
          state: data?.state || payload.state,
        }));
      } else {
        await saveAthlete({
          ...athlete,
          displayName: String(detailsDraft.name || "").trim(),
          handle: normalizeMemberHandle(detailsDraft.handle),
          city: String(detailsDraft.city || "").trim(),
          state: String(detailsDraft.state || "").trim().toLocaleUpperCase("pt-BR").slice(0, 2),
          sportsCategory: String(detailsDraft.category || "").trim(),
          bio: String(detailsDraft.bio || "").trim(),
          galleryPhotos: athleteGallery,
        });
      }
      setDetailsDraft(null);
      onNotice?.("Informações do perfil atualizadas com sucesso.");
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível salvar as informações agora.");
    } finally {
      setBusy(false);
    }
  }

  function closeEditor() {
    setImageEditor(null);
  }

  async function saveAthlete(nextProfile) {
    const result = await saveMyMemberProfile({ supabase, profile: nextProfile, fallback });
    if (!result.schemaAvailable) throw new Error("A estrutura do perfil ainda não está disponível na homologação.");
    setAthlete(result.profile);
    setAthleteGallery(result.profile.galleryPhotos || []);
  }

  async function applyEditedImage({ imageUrl }) {
    if (!user?.id || busy) return false;
    setBusy(true);
    try {
      if (imageEditor.identity === "athlete") {
        const field = imageEditor.kind === "cover" ? "coverUrl" : "photoUrl";
        const uploaded = imageEditor.kind === "cover"
          ? await uploadMemberProfileCover({ supabase, userId: user.id, coverUrl: imageUrl })
          : await uploadMemberProfilePhoto({ supabase, userId: user.id, photoUrl: imageUrl });
        await saveAthlete({ ...athlete, [field]: uploaded, galleryPhotos: athleteGallery });
      } else if (imageEditor.kind === "cover") {
        const uploaded = await uploadOrganizationProfileCover({ supabase, userId: user.id, coverUrl: imageUrl });
        const saved = await saveMyOrganizationCover({ supabase, coverUrl: uploaded });
        setOrganization((currentValue) => ({ ...currentValue, coverUrl: saved.coverUrl || uploaded }));
      } else {
        const uploaded = await uploadProfilePhoto({ supabase, userId: user.id, photoUrl: imageUrl });
        const { error } = await supabase.from("profiles").update({ photo_url: uploaded }).eq("id", user.id);
        if (error) throw error;
        setOrganization((currentValue) => ({ ...currentValue, photoUrl: uploaded }));
      }
      onNotice?.(imageEditor.kind === "cover" ? "Capa atualizada com sucesso." : "Foto do perfil atualizada com sucesso.");
      closeEditor();
      return true;
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível salvar a imagem agora.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addGalleryPhotos(files) {
    if (!files?.length || busy) return;
    const available = MAX_MEMBER_GALLERY_PHOTOS - currentGallery.length;
    const selected = files.slice(0, available);
    if (!selected.length) {
      onNotice?.("A galeria já atingiu o limite de 10 fotos.");
      return;
    }
    setBusy(true);
    try {
      const prepared = await Promise.all(selected.map((file) => prepareSocialPostImageFile(file)));
      if (identityMode === "organization") {
        const uploaded = await Promise.all(prepared.map((entry, index) => uploadOrganizationProfileGalleryPhoto({ supabase, userId: user.id, photoUrl: entry.imageUrl, position: organizationGallery.length + index + 1 })));
        const saved = await saveMyOrganizationGallery({ supabase, photoUrls: [...organizationGallery, ...uploaded].slice(0, MAX_MEMBER_GALLERY_PHOTOS) });
        setOrganizationGallery(saved);
      } else {
        const uploaded = await Promise.all(prepared.map((entry, index) => uploadMemberProfileGalleryPhoto({ supabase, userId: user.id, photoUrl: entry.imageUrl, position: athleteGallery.length + index + 1 })));
        await saveAthlete({ ...athlete, galleryPhotos: [...athleteGallery, ...uploaded].slice(0, MAX_MEMBER_GALLERY_PHOTOS) });
      }
      onNotice?.(`${selected.length} ${selected.length === 1 ? "foto adicionada" : "fotos adicionadas"} à galeria.`);
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível salvar as fotos agora.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGalleryPhoto(index) {
    if (busy) return;
    setBusy(true);
    try {
      if (identityMode === "organization") {
        const saved = await saveMyOrganizationGallery({ supabase, photoUrls: organizationGallery.filter((_, photoIndex) => photoIndex !== index) });
        setOrganizationGallery(saved);
      } else {
        await saveAthlete({ ...athlete, galleryPhotos: athleteGallery.filter((_, photoIndex) => photoIndex !== index) });
      }
      onNotice?.("Foto removida da galeria.");
    } catch (error) {
      onNotice?.(error?.message || "Não foi possível remover a foto agora.");
    } finally {
      setBusy(false);
    }
  }

  if (!user?.id) {
    return <section className={styles.profileEmptyPage}><CircleUserRound /><h1>Entre para criar seu perfil</h1><p>O acesso reúne um perfil de atleta e, quando ativada, uma única organização.</p></section>;
  }

  if (identityMode === "organization" && !hasOrganization) {
    return <section className={styles.profileEmptyPage}><Building2 /><span>1 organização por acesso</span><h1>Crie o perfil da sua organização</h1><p>O atleta continua separado. A ativação da organização será liberada aqui sem criar um segundo login.</p></section>;
  }

  return (
    <div className={styles.profilePage}>
      <section className={styles.profileHero}>
        <div className={`${styles.profileCover} ${coverUrl ? styles.hasProfileCover : ""}`.trim()}>
          {coverUrl ? <img src={coverUrl} alt={`Capa de ${name}`} /> : <span><span /><small>Proporção de capa 851:315</small></span>}
          <label className={styles.coverEdit}><input type="file" accept="image/*" disabled={busy} onChange={(event) => { openEditor(event.target.files?.[0], "cover"); event.target.value = ""; }} /><Camera /> <span>{coverUrl ? "Alterar capa" : "Adicionar capa"}</span></label>
        </div>
        <div className={styles.profileIdentity}>
          <label className={styles.avatarEdit} title={`Alterar foto ${identityMode === "organization" ? "da arena" : "do atleta"}`}>
            <input type="file" accept="image/*" disabled={busy} onChange={(event) => { openEditor(event.target.files?.[0], "photo"); event.target.value = ""; }} />
            <IdentityAvatar name={name} photoUrl={photoUrl} Icon={identityMode === "organization" ? Building2 : UserRound} />
            <span><Camera /></span>
          </label>
          <div className={styles.profileHeading}>
            <span className={styles.profileType}>{identityMode === "organization" ? <><Building2 /> Perfil da organização</> : <><UserRound /> Perfil do atleta</>}</span>
            <h1>{name}</h1>
            <p>{current.handle ? `@${String(current.handle).replace(/^@/, "")}` : location || (identityMode === "organization" ? "Organização esportiva" : "Atleta Torneio 360")}</p>
          </div>
          <div className={styles.profileStats}>
            <span><strong>{currentGallery.length}</strong><small>Fotos</small></span>
            <span><strong>{identityMode === "athlete" ? athlete.followersCount || 0 : 0}</strong><small>Seguidores</small></span>
            <span><strong>0</strong><small>Seguindo</small></span>
          </div>
          <button type="button" className={styles.profileEditButton} onClick={openDetailsEditor}><Settings /> Editar informações</button>
        </div>
      </section>

      <nav className={styles.profileTabs} aria-label="Seções do perfil">
        <button type="button" className={activeSection === "activity" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("activity")}><Trophy /> {identityMode === "organization" ? "Eventos" : "Atividades"}</button>
        <button type="button" className={activeSection === "photos" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("photos")}><Images /> Fotos <span>{currentGallery.length}/{MAX_MEMBER_GALLERY_PHOTOS}</span></button>
        <button type="button" className={activeSection === "about" ? styles.activeProfileTab : ""} onClick={() => setActiveSection("about")}><CircleUserRound /> Sobre</button>
      </nav>

      {activeSection === "photos" ? <PhotoGallery title={identityMode === "organization" ? "Galeria da organização" : "Galeria do atleta"} photos={currentGallery} busy={busy} onAdd={addGalleryPhotos} onRemove={removeGalleryPhoto} /> : null}
      {activeSection === "activity" ? <ActivityPanel activity={activity} events={organizationEvents} identityMode={identityMode} /> : null}
      {activeSection === "about" ? (
        <section className={styles.profileAboutGrid}>
          <article className={styles.profilePanel}><header className={styles.profilePanelHeader}><div><CircleUserRound /><span><h2>Sobre</h2><p>Informações públicas desta identidade.</p></span></div></header><p className={styles.profileBio}>{current.bio || (identityMode === "organization" ? "Conte a história da sua organização." : "Conte um pouco sobre sua trajetória esportiva.")}</p></article>
          <article className={styles.profilePanel}><header className={styles.profilePanelHeader}><div><MapPin /><span><h2>Informações principais</h2><p>Dados separados por perfil.</p></span></div></header><dl className={styles.profileFacts}><div><dt><MapPin /></dt><dd><strong>Localização</strong><span>{location || "Não informada"}</span></dd></div><div><dt>{identityMode === "organization" ? <Building2 /> : <UsersRound />}</dt><dd><strong>{identityMode === "organization" ? "Tipo" : "Categoria"}</strong><span>{identityMode === "organization" ? "Organização" : athlete.sportsCategory || "Não informada"}</span></dd></div><div><dt><CalendarDays /></dt><dd><strong>Identidade</strong><span>{identityMode === "organization" ? "1 organização neste acesso" : "1 atleta neste acesso"}</span></dd></div></dl></article>
        </section>
      ) : null}

      {athleteStatus === "unavailable" ? <p className={styles.profileSchemaWarning}>A galeria do atleta aguarda a atualização do banco de homologação.</p> : null}
      {busy ? <div className={styles.profileBusy} role="status"><span /><strong>Salvando alterações...</strong></div> : null}
      {detailsDraft ? <div className={styles.profileModalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDetailsDraft(null); }}>
        <section className={styles.profileDetailsModal} role="dialog" aria-modal="true" aria-labelledby="v2-profile-editor-title">
          <header><div><span>{identityMode === "organization" ? "Perfil da organização" : "Perfil do atleta"}</span><h2 id="v2-profile-editor-title">Editar informações</h2><p>Os dados permanecem separados entre as duas identidades.</p></div><button type="button" onClick={() => setDetailsDraft(null)} disabled={busy} aria-label="Fechar edição"><X /></button></header>
          <div className={styles.profileFormGrid}>
            <label className={styles.profileFormWide}><span>{identityMode === "organization" ? "Nome da organização" : "Nome do atleta"}</span><input value={detailsDraft.name || ""} maxLength={80} onChange={(event) => updateDetailsDraft("name", event.target.value)} /></label>
            <label><span>{identityMode === "organization" ? "Instagram" : "Nome de usuário"}</span><input value={detailsDraft.handle || ""} maxLength={64} placeholder="@nome" onChange={(event) => updateDetailsDraft("handle", event.target.value)} /></label>
            <label><span>Estado</span><input value={detailsDraft.state || ""} maxLength={2} placeholder="CE" onChange={(event) => updateDetailsDraft("state", event.target.value)} /></label>
            <label className={styles.profileFormWide}><span>Cidade</span><input value={detailsDraft.city || ""} maxLength={80} onChange={(event) => updateDetailsDraft("city", event.target.value)} /></label>
            {identityMode === "athlete" ? <><label className={styles.profileFormWide}><span>Categoria esportiva</span><input value={detailsDraft.category || ""} maxLength={40} placeholder="Ex.: Categoria B" onChange={(event) => updateDetailsDraft("category", event.target.value)} /></label><label className={styles.profileFormWide}><span>Apresentação</span><textarea value={detailsDraft.bio || ""} maxLength={240} rows={4} onChange={(event) => updateDetailsDraft("bio", event.target.value)} /></label></> : null}
          </div>
          <footer><button type="button" onClick={() => setDetailsDraft(null)} disabled={busy}>Cancelar</button><button type="button" onClick={saveDetails} disabled={busy}><Check /> {busy ? "Salvando..." : "Salvar alterações"}</button></footer>
        </section>
      </div> : null}
      {imageEditor ? <ProfileImageEditor kind={imageEditor.kind} sourceUrl={imageEditor.sourceUrl} fileName={imageEditor.fileName} onCancel={closeEditor} onApply={applyEditedImage} /> : null}
    </div>
  );
}
