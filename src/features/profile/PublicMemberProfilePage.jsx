import React, { useEffect, useState } from "react";
import {
  Award,
  ArrowLeft,
  AtSign,
  Building2,
  ExternalLink,
  Grid3X3,
  Images,
  Share2,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import {
  loadPublicMemberProfile,
  loadPublicMemberPublications,
} from "../../services/memberProfileApi.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import {
  MemberProfileIdentityCard,
  MemberProfileTabs,
} from "./MemberProfilePresentation.jsx";
import "../../styles/52-public-member-profile.css";

export default function PublicMemberProfilePage({ supabase, identifier, embedded = false }) {
  const [state, setState] = useState({ status: "loading", profile: null, organization: null });
  const [lightboxPhoto, setLightboxPhoto] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("publicacoes");
  const [publications, setPublications] = useState({
    status: "idle",
    tournaments: [],
    circuits: [],
    error: "",
  });

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
    const organizationId = state.organization?.id;
    if (!organizationId) {
      setPublications({ status: "ready", tournaments: [], circuits: [], error: "" });
      return undefined;
    }

    let active = true;
    setPublications({ status: "loading", tournaments: [], circuits: [], error: "" });
    loadPublicMemberPublications({ supabase, organizationId })
      .then((result) => {
        if (!active) return;
        setPublications({
          status: "ready",
          tournaments: result.tournaments,
          circuits: result.circuits,
          error: result.error ? "Algumas publicações não puderam ser carregadas." : "",
        });
      })
      .catch((error) => {
        console.warn("Não foi possível carregar as publicações do perfil:", error);
        if (active) setPublications({ status: "ready", tournaments: [], circuits: [], error: "Não foi possível carregar as publicações agora." });
      });
    return () => { active = false; };
  }, [state.organization?.id, supabase]);

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

  const { profile, organization } = state;
  const galleryPhotos = profile.galleryPhotos || [];
  const summaryItems = [
    { value: galleryPhotos.length, label: "Fotos" },
    ...(organization ? [
      { value: publications.tournaments.length, label: "Torneios" },
      { value: publications.circuits.length, label: "Circuitos" },
    ] : [
      { value: profile.sportsCategory || "A definir", label: "Categoria" },
      { value: profile.dominantHand || "Não informado", label: "Mão dominante" },
    ]),
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

        {activeTab === "publicacoes" && organization ? (
          <section className="publicMemberSection publicMemberPublicationsSection">
            <header>
              <div><Grid3X3 aria-hidden="true" /><h2>Publicações</h2></div>
              <span>{publications.tournaments.length} torneio(s) · {publications.circuits.length} circuito(s)</span>
            </header>

            {publications.status === "loading" ? (
              <div className="publicMemberPublicationsState" role="status">Carregando torneios e circuitos...</div>
            ) : null}

            {publications.status === "ready" && (publications.tournaments.length > 0 || publications.circuits.length > 0) ? (
              <div className="publicMemberPublicationGrid">
                {publications.tournaments.map((item) => {
                  const details = item.data || {};
                  const cover = details.coverImageThumbnailUrl || details.coverImageUrl || details.eventCoverImageThumbnailUrl || details.eventCoverImageUrl;
                  return (
                    <article className="publicMemberPublicationCard" key={`tournament-${item.id}`}>
                      {cover ? <img src={cover} alt={`Foto de ${item.name}`} /> : <span><Grid3X3 aria-hidden="true" /></span>}
                      <div><small>Torneio</small><strong>{item.name}</strong><p>{details.location || "Publicação da organização"}</p></div>
                      <button type="button" onClick={() => navigatePlatform({ public: item.public_id })}>Abrir <ExternalLink aria-hidden="true" /></button>
                    </article>
                  );
                })}
                {publications.circuits.map((item) => {
                  const settings = item.ranking_settings || item.rankingSettings || {};
                  const cover = settings.coverImageThumbnailUrl || settings.coverImageUrl;
                  return (
                    <article className="publicMemberPublicationCard" key={`circuit-${item.id}`}>
                      {cover ? <img src={cover} alt={`Foto de ${item.name}`} /> : <span><Award aria-hidden="true" /></span>}
                      <div><small>Circuito</small><strong>{item.name}</strong><p>{(item.tournament_ids || item.tournamentIds || []).length} torneio(s)</p></div>
                      <button type="button" onClick={() => navigatePlatform({ organizacao: organization.id })}>Abrir <ExternalLink aria-hidden="true" /></button>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {publications.status === "ready" && publications.tournaments.length === 0 && publications.circuits.length === 0 ? (
              <div className="publicMemberEmptyProfileSection"><Grid3X3 aria-hidden="true" /><strong>Nenhuma publicação disponível</strong><span>Os torneios e circuitos publicados aparecerão aqui.</span></div>
            ) : null}

            {publications.error ? <p className="publicMemberPublicationsError">{publications.error}</p> : null}

            <div className="publicMemberOrganizationCard publicMemberPublicationOrganization">
              <span className="publicMemberOrganizationLogo">
                {organization.photo_url
                  ? <img src={organization.photo_url} alt={`Foto de ${organization.name}`} />
                  : <Building2 aria-hidden="true" />}
              </span>
              <div>
                <strong>{organization.name}</strong>
                <small>{[organization.city, organization.state].filter(Boolean).join("/") || "Organização vinculada"}</small>
              </div>
              <button type="button" onClick={() => navigatePlatform({ organizacao: organization.id })}>
                Ver organização <ExternalLink aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : activeTab === "publicacoes" ? (
          <section className="publicMemberSection publicMemberEmptyProfileSection">
            <Grid3X3 aria-hidden="true" />
            <strong>Nenhuma publicação disponível</strong>
            <span>Os torneios e circuitos publicados aparecerão aqui.</span>
          </section>
        ) : null}

        {activeTab === "contato" ? (
          <section className="publicMemberSection publicMemberContactSection">
            <header><div><AtSign aria-hidden="true" /><h2>Informações de contato</h2></div></header>
            {organization ? (
              <div className="publicMemberOrganizationCard">
                <span className="publicMemberOrganizationLogo">
                  {organization.photo_url ? <img src={organization.photo_url} alt={`Foto de ${organization.name}`} /> : <Building2 aria-hidden="true" />}
                </span>
                <div>
                  <strong>{organization.name}</strong>
                  <small>{[organization.city, organization.state].filter(Boolean).join("/") || "Organização vinculada"}</small>
                </div>
                <button type="button" onClick={() => navigatePlatform({ organizacao: organization.id })}>
                  Abrir organização <ExternalLink aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="publicMemberAthleteDetails">
                <div><span aria-hidden="true">🎾</span><span><strong>Categoria</strong><small>{profile.sportsCategory || "Não informada"}</small></span></div>
                <div><span aria-hidden="true">✋</span><span><strong>Mão dominante</strong><small>{profile.dominantHand || "Não informada"}</small></span></div>
                <div><span aria-hidden="true">👕</span><span><strong>Tamanho da camiseta</strong><small>{profile.shirtSize || "Não informado"}</small></span></div>
                <p>Telefone, documento e demais dados privados não são exibidos no perfil público.</p>
              </div>
            )}
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
