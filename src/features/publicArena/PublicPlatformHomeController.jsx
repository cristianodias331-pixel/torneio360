import React, { useEffect, useState } from "react";
import {
  PublicPlatformHomeView,
  PublicTournamentFeedView,
} from "./PublicArenaPresentation.jsx";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";

function openLogin() {
  navigatePlatform({ entrar: "1" });
}

function openAccount() {
  navigatePlatform();
}

function openSignup() {
  navigatePlatform({ cadastro: "conta" });
}

export function PublicTournamentFeedSection({ runtime, hasSession = false, embedded = false }) {
  const {
    fetchPublicTournamentFeed,
    formatDate,
    getModalityName,
    getRegistrationDeadline,
    isRegistrationOpen,
    getWhatsAppUrl,
  } = runtime;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPublicTournamentFeed({ limit: 12 }).then((result) => {
      if (!active) return;
      setItems(result.items || []);
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError(result.error ? "Não foi possível carregar as publicações agora." : "");
      setLoading(false);
    });
    return () => { active = false; };
  }, [fetchPublicTournamentFeed]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await fetchPublicTournamentFeed({ limit: 12, cursor: nextCursor });
    if (result.error) setError("Não foi possível carregar mais publicações agora.");
    else {
      setItems((current) => Array.from(new Map(
        [...current, ...(result.items || [])].map((item) => [String(item.id), item])
      ).values()));
      setHasMore(result.hasMore === true);
      setNextCursor(result.nextCursor || null);
      setError("");
    }
    setLoadingMore(false);
  }

  return (
    <PublicTournamentFeedView
      embedded={embedded}
      items={items}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      hasMore={hasMore}
      formatDate={formatDate}
      getModalityName={getModalityName}
      getRegistrationDeadline={getRegistrationDeadline}
      isRegistrationOpen={isRegistrationOpen}
      getWhatsAppUrl={getWhatsAppUrl}
      onLoadMore={loadMore}
      onOpenTournament={(item) => navigatePlatform({ public: item.public_id })}
      onOpenOrganization={(organization) => {
        if (!organization?.id) return;
        navigatePlatform({ organizacao: organization.id });
      }}
      onRegister={(registrationUrl, item) => {
        if (!hasSession) {
          openSignup();
          return;
        }
        if (registrationUrl) window.open(registrationUrl, "_blank", "noopener,noreferrer");
        else navigatePlatform({ public: item.public_id });
      }}
    />
  );
}

export default function PublicPlatformHomeController({ session = null, runtime, embedded = false }) {
  if (embedded) {
    return (
      <PublicTournamentFeedSection
        runtime={runtime}
        hasSession={Boolean(session)}
        embedded
      />
    );
  }

  return (
    <PublicPlatformHomeView
      hasSession={Boolean(session)}
      onAccountAction={session ? openAccount : openLogin}
      onAthleteSignup={openSignup}
      onNavigate={(panel) => {
        if (panel === "overview") {
          navigatePlatform();
          return;
        }
        if (session) {
          openAccount();
          return;
        }
        if (panel === "profile") openSignup();
        else openLogin();
      }}
      TournamentFeed={() => (
        <PublicTournamentFeedSection runtime={runtime} hasSession={Boolean(session)} />
      )}
      tagline={runtime.tagline}
    />
  );
}
