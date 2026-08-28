import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Share2,
} from "lucide-react";
import { loadPublicMemberProfile } from "../../services/memberProfileApi.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import AthleteProfileExperience from "./AthleteProfileExperience.jsx";
import "../../styles/52-public-member-profile.css";

export default function PublicMemberProfilePage({ supabase, identifier, embedded = false }) {
  const [state, setState] = useState({ status: "loading", profile: null, organization: null });
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
        <AthleteProfileExperience
          supabase={supabase}
          profile={profile}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </main>

      {shareFeedback ? <div className="publicMemberToast" role="status">{shareFeedback}</div> : null}

    </div>
  );
}
