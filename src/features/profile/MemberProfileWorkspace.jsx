import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import {
  MAX_MEMBER_GALLERY_PHOTOS,
  createMemberProfileFallback,
  normalizeMemberHandle,
  validateMemberProfile,
} from "../../domain/memberProfile.mjs";
import { prepareSocialPostImageFile, resizeImageFile } from "../media/imageResize.mjs";
import {
  uploadMemberProfileCover,
  uploadMemberProfileGalleryPhoto,
  uploadMemberProfilePhoto,
} from "../../services/mediaStorage.mjs";
import { loadMyMemberProfile, saveMyMemberProfile } from "../../services/memberProfileApi.mjs";
import UnifiedMemberProfilePanel from "./UnifiedMemberProfilePanel.jsx";
import "../../styles/51-unified-profile.css";

export default function MemberProfileWorkspace({ supabase, user, accessProfile, onLogout }) {
  const fallback = useMemo(() => createMemberProfileFallback({ user, accessProfile }), [accessProfile?.name, user?.email, user?.id]);
  const [profile, setProfile] = useState(fallback);
  const baseProfileRef = useRef(fallback);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);

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

  async function selectProfilePhoto(file) {
    if (!file || saving) return;
    try {
      updateProfile("photoUrl", await resizeImageFile(file, {
        maxWidth: 900,
        maxHeight: 900,
        quality: 0.86,
        outputType: "image/webp",
      }));
    } catch (error) {
      setNotice({ tone: "warning", message: error?.message || "Escolha outra imagem." });
    }
  }

  async function selectCover(file) {
    if (!file || saving) return;
    try {
      updateProfile("coverUrl", await resizeImageFile(file, {
        maxWidth: 1640,
        maxHeight: 624,
        quality: 0.86,
        outputType: "image/webp",
      }));
    } catch (error) {
      setNotice({ tone: "warning", message: error?.message || "Escolha outra imagem." });
    }
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
    url.searchParams.set("membro", profile.handle || user.id);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function saveProfile() {
    if (!user?.id || saving) return;
    const validation = validateMemberProfile(profile);
    setErrors(validation.errors);
    if (!validation.valid) {
      setNotice({ tone: "warning", message: "Corrija os campos indicados antes de salvar." });
      return;
    }
    if (status === "unavailable") {
      setNotice({ tone: "warning", message: "A estrutura do perfil ainda não foi aplicada ao banco de teste." });
      return;
    }
    if (JSON.stringify(validation.profile) === JSON.stringify(baseProfileRef.current)) {
      setNotice({ tone: "info", message: "Seu perfil já está atualizado." });
      return;
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
        return;
      }
      baseProfileRef.current = result.profile;
      setProfile(result.profile);
      setStatus("ready");
      setNotice({ tone: "success", message: "Perfil esportivo atualizado com sucesso." });
    } catch (error) {
      console.error("Erro ao salvar o perfil esportivo:", error);
      const duplicateHandle = String(error?.code || "") === "23505"
        || String(error?.message || "").toLocaleLowerCase("pt-BR").includes("nome de usuário já está em uso");
      if (duplicateHandle) setErrors((current) => ({ ...current, handle: "Este nome de usuário já está em uso." }));
      setNotice({
        tone: "error",
        message: duplicateHandle ? "Escolha outro nome de usuário." : "Não foi possível salvar o perfil agora.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="memberProfileWorkspace">
      <header className="memberProfileWorkspaceHeader">
        <img src="/torneio360-logo.png" alt="Torneio 360" />
        <div><span>Conta de atleta</span><strong>Meu perfil esportivo</strong></div>
        <nav>
          <button type="button" onClick={() => window.location.assign(`${window.location.origin}/?publico=1`)}>
            <ArrowLeft aria-hidden="true" /> Explorar torneios
          </button>
          <button type="button" onClick={onLogout}><LogOut aria-hidden="true" /> Sair</button>
        </nav>
      </header>

      <main>
        {notice ? <div className={`memberProfileWorkspaceNotice ${notice.tone}`} role="status">{notice.message}</div> : null}
        <UnifiedMemberProfilePanel
          profile={profile}
          organizationName=""
          errors={errors}
          loading={status === "loading"}
          saving={saving}
          schemaAvailable={status !== "unavailable"}
          onChange={updateProfile}
          onPhotoFile={selectProfilePhoto}
          onRemovePhoto={() => updateProfile("photoUrl", "")}
          onCoverFile={selectCover}
          onRemoveCover={() => updateProfile("coverUrl", "")}
          onGalleryFiles={selectGalleryPhotos}
          onRemoveGalleryPhoto={removeGalleryPhoto}
          onOpenPublicProfile={openPublicProfile}
          onSave={saveProfile}
        />
      </main>
    </div>
  );
}
