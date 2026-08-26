import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Images,
  MapPin,
  Share2,
  ShieldCheck,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import { loadPublicMemberProfile } from "../../services/memberProfileApi.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import "../../styles/52-public-member-profile.css";

function getInitials(name) {
  return String(name || "T3")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("") || "T3";
}

export default function PublicMemberProfilePage({ supabase, identifier, embedded = false }) {
  const [state, setState] = useState({ status: "loading", profile: null, organization: null });
  const [lightboxPhoto, setLightboxPhoto] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");

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

  const location = useMemo(() => (
    [state.profile?.city, state.profile?.state].filter(Boolean).join("/")
  ), [state.profile?.city, state.profile?.state]);

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

  const { profile, organization } = state;
  const galleryPhotos = profile.galleryPhotos || [];

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
        <article className="publicMemberIdentityCard">
          <div className={`publicMemberCover${profile.coverUrl ? " hasImage" : ""}`}>
            {profile.coverUrl ? <img src={profile.coverUrl} alt={`Capa do perfil de ${profile.displayName}`} /> : null}
          </div>

          <div className="publicMemberIdentity">
            <div className="publicMemberAvatar">
              {profile.photoUrl
                ? <img src={profile.photoUrl} alt={`Foto de ${profile.displayName}`} />
                : <span>{getInitials(profile.displayName)}</span>}
            </div>

            <div className="publicMemberCopy">
              <div className="publicMemberNameRow">
                <div>
                  <h1>{profile.displayName}</h1>
                  <p>{profile.handle ? `@${profile.handle}` : "Perfil Torneio 360"}</p>
                </div>
                <span className="publicMemberPublicBadge"><ShieldCheck aria-hidden="true" /> Público</span>
              </div>
            </div>

            {profile.bio ? <p className="publicMemberBio">{profile.bio}</p> : null}
            {location ? <p className="publicMemberLocation"><MapPin aria-hidden="true" /> {location}</p> : null}

            <div className="publicMemberSummary">
              <span><strong>{galleryPhotos.length}</strong><small>Fotos</small></span>
              <span><strong>Atleta</strong><small>Perfil esportivo</small></span>
              {organization ? <span><strong>1</strong><small>Organização</small></span> : null}
            </div>
          </div>
        </article>

        <section className="publicMemberSection publicMemberGallerySection">
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
        </section>

        {organization ? (
          <section className="publicMemberSection publicMemberOrganization">
            <header>
              <div><Building2 aria-hidden="true" /><h2>Organização</h2></div>
            </header>
            <div className="publicMemberOrganizationCard">
              <span className="publicMemberOrganizationLogo">
                {organization.photo_url
                  ? <img src={organization.photo_url} alt={`Foto de ${organization.name}`} />
                  : <Building2 aria-hidden="true" />}
              </span>
              <div>
                <strong>{organization.name}</strong>
                {[organization.city, organization.state].filter(Boolean).length > 0
                  ? <small>{[organization.city, organization.state].filter(Boolean).join("/")}</small>
                  : <small>Torneios e circuitos publicados</small>}
              </div>
              <button type="button" onClick={() => navigatePlatform({ organizacao: organization.id })}>
                Ver torneios e circuitos <ExternalLink aria-hidden="true" />
              </button>
            </div>
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
