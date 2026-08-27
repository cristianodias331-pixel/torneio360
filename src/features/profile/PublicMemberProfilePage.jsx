import React, { useEffect, useState } from "react";
import {
  Award,
  ArrowLeft,
  AtSign,
  Images,
  Share2,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import { loadPublicMemberProfile } from "../../services/memberProfileApi.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import {
  MemberProfileIdentityCard,
  MemberProfileTabs,
} from "./MemberProfilePresentation.jsx";
import AthleteProfileActivity from "./AthleteProfileActivity.jsx";
import "../../styles/52-public-member-profile.css";

export default function PublicMemberProfilePage({ supabase, identifier, embedded = false }) {
  const [state, setState] = useState({ status: "loading", profile: null, organization: null });
  const [lightboxPhoto, setLightboxPhoto] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("atividades");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", profile: null, organization: null });

    loadPublicMemberProfile({ supabase, identifier })
      .then((result) => {
        if (!active) return;
        setState({
          status: result.schemaAvailable ? (result.profile ? "ready" : "not-found") : "unavailable",
          profile: result.profile,
          organization: result.organization,
        });
      })
      .catch((error) => {
        console.error("Erro ao carregar o perfil esportivo público:", error);
        if (active) setState({ status: "error", profile: null, organization: null });
      });

    return () => {
      active = false;
    };
  }, [identifier, supabase]);

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

  async function shareProfile() {
    const shareData = {
      title: state.profile?.displayName || "Perfil no Torneio 360",
      text: `Veja o perfil esportivo de ${state.profile?.displayName || "um atleta"} no Torneio 360.`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        setShareFeedback("Link copiado");
        window.setTimeout(() => setShareFeedback(""), 2200);
      }
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Não foi possível compartilhar o perfil:", error);
    }
  }

  if (state.status === "loading") {
    return (
      <main className="publicMemberStatePage" role="status">
        <div className="loadingSpinner" aria-hidden="true" />
        <strong>Carregando perfil esportivo...</strong>
      </main>
    );
  }

  if (state.status !== "ready") {
    const message = state.status === "not-found"
      ? "Este perfil não foi encontrado."
      : state.status === "unavailable"
        ? "A página pública de atletas ainda está sendo preparada no site teste."
        : "Não foi possível carregar este perfil agora.";
    if (embedded) {
      return (
        <div className="publicDirectoryState publicDirectoryError">
          <strong>Perfil indisponível</strong>
          <span>{message}</span>
        </div>
      );
    }
    return (
      <main className="publicMemberStatePage">
        <img src="/torneio360-logo.png" alt="Torneio 360" />
        <h1>Perfil indisponível</h1>
        <p>{message}</p>
        <button type="button" onClick={() => navigatePlatform()}>
          <ArrowLeft aria-hidden="true" /> Voltar ao Torneio 360
        </button>
      </main>
    );
  }

  const { profile } = state;
  const galleryPhotos = profile.galleryPhotos || [];
  const summaryItems = [
    { value: profile.sportsCategory || "A definir", label: "Categoria" },
    { value: profile.dominantHand || "Não informado", label: "Mão dominante" },
    { value: galleryPhotos.length, label: "Fotos" },
    { value: profile.followersCount || 0, label: "Seguidores" },
  ];

  return (
    <div className={`publicMemberPage${embedded ? " embeddedPublicMemberProfile" : ""}`}>
      {!embedded ? <header className="publicMemberTopbar">
        <button type="button" onClick={() => navigatePlatform()} aria-label="Voltar à visão geral">
          <ArrowLeft aria-hidden="true" />
        </button>
        <img src="/torneio360-logo.png" alt="Torneio 360" />
        <nav aria-label="Navegação pública">
          <a href="/#visao-geral">Visão geral</a>
          <a href="/#perfis">Atletas</a>
          <a href="/#organizacoes">Organizações</a>
        </nav>
        <button type="button" onClick={shareProfile} aria-label="Compartilhar perfil">
          <Share2 aria-hidden="true" />
        </button>
      </header> : null}

      <main className="publicMemberContent">
        <MemberProfileIdentityCard profile={profile} summaryItems={summaryItems} />

        <MemberProfileTabs activeTab={activeTab} onChange={setActiveTab} />

        {["atividades", "desafios"].includes(activeTab) ? (
          <AthleteProfileActivity supabase={supabase} profile={profile} activeTab={activeTab} />
        ) : null}

        {activeTab === "fotos" ? <section className="publicMemberSection publicMemberGallerySection">
          <header>
            <div><Images aria-hidden="true" /><h2>Fotos</h2></div>
            <span>{galleryPhotos.length}/6</span>
          </header>

          {galleryPhotos.length > 0 ? (
            <div className="publicMemberGallery">
              {galleryPhotos.map((photoUrl, index) => (
                <button
                  type="button"
                  key={`${photoUrl}-${index}`}
                  onClick={() => setLightboxPhoto(photoUrl)}
                  aria-label={`Ampliar foto ${index + 1}`}
                >
                  <img src={photoUrl} alt={`Foto ${index + 1} de ${profile.displayName}`} loading="lazy" decoding="async" />
                  <ZoomIn aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="publicMemberEmptyGallery">
              <UserRound aria-hidden="true" />
              <strong>Nenhuma foto publicada</strong>
              <span>O atleta ainda não adicionou imagens à galeria.</span>
            </div>
          )}

          <p className="publicMemberGalleryPrivacy">Esta galeria não possui curtidas, comentários nem contadores de interação.</p>
        </section> : null}

        {activeTab === "contato" ? (
          <section className="publicMemberSection publicMemberContactSection">
            <header><div><AtSign aria-hidden="true" /><h2>Sobre o atleta</h2></div></header>
            <div className="publicMemberAthleteDetails">
              <div><span aria-hidden="true">🎾</span><span><strong>Categoria</strong><small>{profile.sportsCategory || "Não informada"}</small></span></div>
              <div><span aria-hidden="true">✋</span><span><strong>Mão dominante</strong><small>{profile.dominantHand || "Não informada"}</small></span></div>
              <div><span aria-hidden="true">👕</span><span><strong>Tamanho da camiseta</strong><small>{profile.shirtSize || "Não informado"}</small></span></div>
              <p>Documento e contatos privados não aparecem no perfil público. Um contato liberado só fica disponível depois de uma combinação válida.</p>
            </div>
          </section>
        ) : null}

        {activeTab === "conquistas" ? (
          <section className="publicMemberSection publicMemberEmptyProfileSection">
            <Award aria-hidden="true" />
            <strong>Conquistas</strong>
            <span>Resultados e títulos reconhecidos pela plataforma aparecerão aqui.</span>
          </section>
        ) : null}
      </main>

      {shareFeedback ? <div className="publicMemberToast" role="status">{shareFeedback}</div> : null}

      {lightboxPhoto ? (
        <div className="publicMemberLightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLightboxPhoto("");
        }}>
          <button type="button" onClick={() => setLightboxPhoto("")} aria-label="Fechar foto"><X aria-hidden="true" /></button>
          <img src={lightboxPhoto} alt={`Foto ampliada de ${profile.displayName}`} />
        </div>
      ) : null}
    </div>
  );
}
