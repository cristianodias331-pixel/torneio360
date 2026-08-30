import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createRoot,
} from "react-dom/client";
import {
  createClient,
} from "@supabase/supabase-js";
import InstallAppBanner from "./InstallAppBanner.jsx";
import AppUpdateNotice from "./features/appShell/AppUpdateNotice.jsx";
import {
  CupGroupRankingView,
  CupPodiumView,
  EmailConfirmationPendingScreen,
  LoginScreen,
  MemberProfileWorkspaceView,
  OrganizerWorkspaceDashboard,
  PublicArenaPageController,
  PublicCircuitScreenView,
  PublicCupBracketView,
  PublicMemberProfilePageView,
  PublicPlatformHomeController,
  PublicTournamentPageController,
  PublicTournamentScreenView,
  SimpleFormatInfoButton,
} from "./features/appShell/lazyFeatures.jsx";
import {
  AccessPreparing,
  ProfileUnavailable,
} from "./features/appShell/AccessStatusViews.jsx";
import {
  createTournamentRuntimeAdapters,
} from "./features/tournamentWorkspace/TournamentRuntimeAdapters.jsx";
import {
  PublicArenaHeroHeaderView,
  PublicRegistrationStatusView,
  PublicArenaTournamentCardsView,
} from "./features/publicArena/PublicArenaPresentation.jsx";
import LazyArenaPhotoView from "./features/publicArena/LazyArenaPhoto.jsx";
import UnifiedPlatformFrame from "./features/appShell/UnifiedPlatformFrame.jsx";
import MarketingLandingV2 from "./features/marketing/MarketingLandingV2.jsx";
import {
  formatDateBR,
  getBrazilTodayISO,
} from "./domain/dateTime.mjs";
import {
  isProfilePendingEmailConfirmation,
} from "./domain/authValidation.mjs";
import {
  clearAuthCallbackUrl,
  getAuthCallbackError,
  getAuthFlowFromLocation,
} from "./domain/authNavigation.mjs";
import {
  getBrazilianWhatsAppUrl,
  getPlanRegularizationWhatsAppUrl,
} from "./domain/contactLinks.mjs";
import {
  getTournamentRegistrationDeadline,
  isRegistrationDeadlineOpen,
  sortTournamentsByEventSchedule,
} from "./domain/tournamentLifecycle.mjs";
import {
  createTournamentOperations,
} from "./domain/tournamentOperations.mjs";
import {
  createPublicArenaApi,
} from "./services/publicArenaApi.mjs";
import {
  fetchPublicMemberDirectory,
} from "./services/memberProfileApi.mjs";
import {
  fetchPublicTournamentFeed,
  loadPublicOrganizationGallery,
  searchPublicPlatform,
} from "./services/publicSocialApi.mjs";
import {
  isRetryableConnectionError,
  readCachedProfile,
  saveCachedProfile,
} from "./domain/localAppStorage.mjs";
import {
  getModalityDisplayName,
} from "./domain/modalityCatalog.mjs";
import {
  syncCupBracketScores,
} from "./domain/cupBracketOrchestration.mjs";
import {
  navigatePlatform,
  subscribePlatformNavigation,
} from "./domain/platformNavigation.mjs";
import {
  createCupPresentation,
} from "./domain/cupPresentation.mjs";
import "./style.css";

function PlatformLoadingScreen({ message = "Carregando área do Torneio 360..." }) {
  return (
    <div className="loadingPage" role="status" aria-live="polite" aria-label={message}>
      <div className="loadingCard">
        <img className="loadingBrand" src="/marketing/torneio360-logo-clean-v1.png" alt="Torneio 360" />
        <div className="loadingTrack" aria-hidden="true">
          <div className="loadingBallRunner">
            <span className="loadingFireball" />
          </div>
        </div>
        <div className="loadingCopy">
          <strong>Preparando sua experiência</strong>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || "https://dttutybojealkvuywszt.supabase.co";
const MARKETING_LANDING_V2_ENABLED = (() => {
  const configured = String(import.meta.env.VITE_MARKETING_LANDING_V2 || "").toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;

  const configuredSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "");
  const hostname = String(globalThis.location?.hostname || "").toLowerCase();
  return configuredSupabaseUrl.includes("vcixhzvytkrautotinpi")
    || hostname.startsWith("torneio360-homologacao");
})();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || "sb_publishable_Tr5qiUea-p42UknVoWwPKg_6K_b1EX_";
const supabase = globalThis.__torneio360Supabase || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
if (import.meta.env.DEV) globalThis.__torneio360Supabase = supabase;

const {
  fetchPublicArenaBundle,
  fetchPublicArenaDirectory,
  fetchPublicArenaEventsPage,
  fetchPublicArenaInitialView,
  fetchPublicArenaPhoto,
  fetchPublicCircuitCover,
  fetchPublicCircuitDetail,
  fetchPublicCircuitRankingAll,
  fetchPublicCircuitRankingPage,
  fetchPublicTournamentCover,
  fetchPublicTournamentDetail,
  refreshPublicTournamentDetail,
} = createPublicArenaApi({ supabase });

function navigateFromPublicProfile(panel, hasSession) {
  if (panel === "overview") {
    navigatePlatform();
    return;
  }
  if (panel === "explore") {
    navigatePlatform(hasSession ? { aba: "explorar" } : { explorar: "1" });
    return;
  }
  if (!hasSession) {
    navigatePlatform(panel === "profile" ? { cadastro: "conta" } : { entrar: "1" });
    return;
  }
  navigatePlatform({ aba: panel === "profile" ? "ajustes" : "criar" });
}

const {
  getCupPlayTimeById,
  getTournamentMatchStatusSummary,
  getTournamentOperationalGames,
  getTournamentTimingSummary,
} = createTournamentOperations({ syncCupBracketScores });

const {
  getSafeCupPresentation,
} = createCupPresentation({ getCupPlayTimeById });

const {
  RankingTable,
  RankingView,
  ScheduleView,
  TournamentFormatInfoButton,
  TournamentTimingSummary,
  buildPublicCircuitRankingGroups,
  calculateRanking,
} = createTournamentRuntimeAdapters({
  getTournamentMatchStatusSummary,
  getTournamentOperationalGames,
  getTournamentTimingSummary,
});

const TORNEIO360_TAGLINE = "Gestão inteligente de torneios";
const publicPlatformHomeRuntime = Object.freeze({
  fetchPublicArenaDirectory,
  fetchPublicMemberDirectory: (options) => fetchPublicMemberDirectory({ supabase, ...options }),
  fetchPublicTournamentFeed: (options) => fetchPublicTournamentFeed({ supabase, ...options }),
  searchPublicPlatform: (options) => searchPublicPlatform({ supabase, ...options }),
  fetchPublicTournamentDetail,
  renderPublicTournament: (props) => <PublicTournamentScreen {...props} />,
  formatDate: formatDateBR,
  getModalityName: getModalityDisplayName,
  getRegistrationDeadline: getTournamentRegistrationDeadline,
  isRegistrationOpen: isRegistrationDeadlineOpen,
  getWhatsAppUrl: getBrazilianWhatsAppUrl,
  ArenaPhoto: LazyArenaPhoto,
  tagline: TORNEIO360_TAGLINE,
});

async function logout() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (e) {
    console.error(e);
  }

  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes("supabase") || key.includes("sb-") || key.includes("auth")) {
        localStorage.removeItem(key);
      }
    });

    sessionStorage.clear();
  } catch (e) {
    console.error(e);
  }

  window.location.replace("/");
}


function PublicRegistrationStatus(props) {
  return <PublicRegistrationStatusView {...props} getWhatsAppUrl={getBrazilianWhatsAppUrl} />;
}

// Mapas de chaveamento da Copinha. C = campeão do grupo, R = segundo e T =
// terceiro; o número é a posição da campanha do grupo. As abas de 2 a 9
// grupos foram transcritas da planilha. Em 10 grupos, a planilha repete o
// 2º MG4 no Jogo 8 e deixa o 1º MG4 de fora; usamos 1º MG4 para que as 20
// duplas classificadas apareçam uma única vez. Os formatos 11 e 12 seguem a
// mesma distribuição, corrigindo as cópias incompletas dessas abas.



function App() {
  const [locationHref, setLocationHref] = useState(() => window.location.href);
  const routeParams = new URL(locationHref).searchParams;
  const publicId = routeParams.get("public");
  const arenaId = routeParams.get("organizacao") || routeParams.get("arena");
  const circuitId = routeParams.get("circuito");
  const memberIdentifier = routeParams.get("membro")
    || (!routeParams.get("aba") ? routeParams.get("perfil") : null);
  const signupType = routeParams.get("cadastro");
  const wantsLogin = routeParams.get("entrar") === "1";
  const publicMode = routeParams.get("publico") === "1";

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState(() => getAuthFlowFromLocation());
  const [authCallbackError, setAuthCallbackError] = useState(() => getAuthCallbackError());
  const [authNotice, setAuthNotice] = useState(null);
  const activeUserIdRef = useRef(null);

  useEffect(() => subscribePlatformNavigation(setLocationHref), []);

  async function reconcileOwnProfile() {
    const result = await supabase.rpc("reconcile_my_profile");
    const { error } = result;

    // A função existe na correção de banco desta atualização. Enquanto ela
    // ainda não tiver sido aplicada, o restante do fluxo continua funcionando
    // normalmente e não exibe um erro técnico para o organizador.
    if (error && !/reconcile_my_profile|function.*does not exist/i.test(`${error.message || ""} ${error.code || ""}`)) {
      console.warn("Não foi possível concluir a preparação do perfil:", error);
    }

    return result;
  }

  async function activateOrganizationAccess() {
    const { data, error } = await supabase.rpc("activate_my_organization");
    if (error) throw error;

    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data?.session?.user) {
      throw refreshed.error || new Error("Não foi possível atualizar a permissão da organização.");
    }

    const nextSession = refreshed.data.session;
    const nextProfile = data?.profile || await loadProfile(nextSession.user.id, {
      waitForAccess: false,
      emailConfirmed: true,
    });

    setSession(nextSession);
    activeUserIdRef.current = nextSession.user.id;
    if (nextProfile) {
      setProfile(nextProfile);
      saveCachedProfile(nextSession.user.id, nextProfile);
    }

    navigatePlatform({ aba: "ajustes", perfil: "publicacoes", identidade: "organizacao" });
    return data;
  }

  async function loadProfile(userId, { waitForAccess = false, emailConfirmed = false } = {}) {
    const attempts = waitForAccess ? 6 : 1;
    let lastProfile = null;

    if (waitForAccess) {
      await reconcileOwnProfile();
    }

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar perfil:", error);

        if (!waitForAccess || attempt === attempts - 1) {
          const cachedProfile = readCachedProfile(userId);
          if (!lastProfile && cachedProfile && isRetryableConnectionError(error)) {
            setProfile(cachedProfile);
            return cachedProfile;
          }
          if (!lastProfile) setProfile(null);
          return lastProfile;
        }
      } else if (data) {
        lastProfile = data;
        setProfile(data);
        saveCachedProfile(userId, data);

        const status = String(data.status || "").toLowerCase();
        const isStableProfile =
          status === "active" ||
          status === "blocked" ||
          status === "expired" ||
          (!emailConfirmed && isProfilePendingEmailConfirmation(data));

        if (!waitForAccess || isStableProfile || attempt === attempts - 1) {
          return data;
        }
      } else if (!waitForAccess) {
        setProfile(null);
        return null;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    setProfile(lastProfile);
    return lastProfile;
  }

  async function refreshProfile() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      console.error("Não foi possível atualizar a sessão:", error);
      return null;
    }

    setSession((current) => (current ? { ...current, user: data.user } : current));
    activeUserIdRef.current = data.user.id;

    setLoading(true);
    const nextProfile = await loadProfile(data.user.id, {
      waitForAccess: true,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
    });
    setLoading(false);
    return nextProfile;
  }

  async function endRecoveryFlow(nextNotice = null, scope = "local") {
    try {
      await supabase.auth.signOut({ scope });
    } catch (error) {
      console.error("Não foi possível encerrar a sessão de recuperação:", error);
    } finally {
      clearAuthCallbackUrl();
      activeUserIdRef.current = null;
      setSession(null);
      setProfile(null);
      setAuthFlow(null);
      setAuthCallbackError(null);
      setAuthNotice(nextNotice);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const callbackError = getAuthCallbackError();
      const callbackFlow = callbackError ? null : getAuthFlowFromLocation();

      if (callbackError) {
        setAuthCallbackError(callbackError);
        clearAuthCallbackUrl();
      }

      setAuthFlow(callbackFlow);

      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session);
      activeUserIdRef.current = data.session?.user?.id || null;

      // A recuperação tem prioridade sobre qualquer Dashboard: o token desse
      // link só pode ser usado para trocar a senha.
      if (callbackFlow === "recovery") {
        setLoading(false);
        return;
      }

      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id, {
          waitForAccess: true,
          emailConfirmed: Boolean(data.session.user.email_confirmed_at),
        });
      }

      if (!active) return;

      if (callbackFlow === "confirm" && data.session?.user?.email_confirmed_at) {
        clearAuthCallbackUrl();
        setAuthFlow(null);
      }

      setLoading(false);
    }

    async function handleAuthEvent(event, newSession) {
      if (!active) return;

      const previousUserId = activeUserIdRef.current;
      const nextUserId = newSession?.user?.id || null;
      setSession(newSession);

      if (event === "PASSWORD_RECOVERY") {
        activeUserIdRef.current = nextUserId;
        setAuthCallbackError(null);
        setAuthNotice(null);
        setAuthFlow("recovery");
        setLoading(false);
        return;
      }

      // A renovação automática de token acontece ao voltar para a aba. Ela
      // não deve desmontar o Dashboard, pois isso apagava as abas abertas.
      if (event === "TOKEN_REFRESHED" && previousUserId === nextUserId) return;

      if (!nextUserId) {
        activeUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      activeUserIdRef.current = nextUserId;
      const isSameUser = previousUserId === nextUserId;

      if (isSameUser) {
        if (event === "USER_UPDATED") {
          await loadProfile(nextUserId, {
            waitForAccess: true,
            emailConfirmed: Boolean(newSession?.user?.email_confirmed_at),
          });

          if (getAuthFlowFromLocation() === "confirm" && newSession?.user?.email_confirmed_at) {
            clearAuthCallbackUrl();
            setAuthFlow(null);
          }
        }
        return;
      }

      setLoading(true);
      await loadProfile(nextUserId, {
        waitForAccess: true,
        emailConfirmed: Boolean(newSession?.user?.email_confirmed_at),
      });

      if (!active) return;

      if (getAuthFlowFromLocation() === "confirm" && newSession?.user?.email_confirmed_at) {
        clearAuthCallbackUrl();
        setAuthFlow(null);
      }

      setLoading(false);
    }

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // O Supabase mantém um bloqueio interno enquanto notifica mudanças da
      // sessão. Consultas iniciadas no mesmo callback podem ficar aguardando
      // esse bloqueio e deixar o retorno do e-mail parado em uma tela vazia.
      window.setTimeout(() => {
        void handleAuthEvent(event, newSession);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (memberIdentifier) {
    return (
      <UnifiedPlatformFrame
        activePanel="profile"
        hasSession={Boolean(session)}
        onNavigate={(panel) => navigateFromPublicProfile(panel, Boolean(session))}
        onSignup={session ? undefined : () => navigatePlatform({ cadastro: "conta" })}
        onAccountAction={() => navigatePlatform(session ? {} : { entrar: "1" })}
      >
        <PublicMemberProfilePageView supabase={supabase} identifier={memberIdentifier} embedded />
      </UnifiedPlatformFrame>
    );
  }

  if (publicId) {
    return <UnifiedPublicArenaProfile publicId={publicId} session={session} />;
  }

  if (arenaId) {
    return <UnifiedPublicArenaProfile arenaId={arenaId} initialCircuitId={circuitId} session={session} />;
  }

  if (publicMode && authFlow !== "recovery") {
    return <PublicPlatformHome session={session} />;
  }

  if (loading) {
    return <PlatformLoadingScreen message="Carregando Torneio 360..." />;
  }

  if (authFlow === "recovery") {
    return (
      <Login
        key="password-recovery"
        initialMode="resetPassword"
        recoverySession={session}
        onRecoveryFinished={(notice) => endRecoveryFlow(notice, "global")}
        onRecoveryExit={() => endRecoveryFlow()}
      />
    );
  }

  if (!session && !wantsLogin && !signupType && !authCallbackError && !authNotice) {
    if (MARKETING_LANDING_V2_ENABLED) {
      return (
        <MarketingLandingV2
          onLogin={() => navigatePlatform({ entrar: "1" })}
          onSignup={() => navigatePlatform({ cadastro: "conta" })}
          onExplore={() => navigatePlatform({ publico: "1" })}
        />
      );
    }
    return <PublicPlatformHome />;
  }

  if (!session) {
    return (
      <UnifiedPlatformFrame
        activePanel="overview"
        hasSession={false}
        title={signupType ? "Criar conta" : "Entrar"}
        eyebrow="Conta única"
        description="Acesse a mesma plataforma para acompanhar eventos, participar e organizar."
        onNavigate={(panel) => navigateFromPublicProfile(panel, false)}
        onSignup={signupType ? undefined : () => navigatePlatform({ cadastro: "conta" })}
        onAccountAction={signupType ? () => navigatePlatform({ entrar: "1" }) : undefined}
      >
        <Login
          key={`guest-${signupType ? "signup" : "login"}`}
          embedded
          initialMode={authCallbackError ? "forgotPassword" : signupType ? "signup" : "login"}
          initialNotice={authCallbackError || authNotice}
        />
      </UnifiedPlatformFrame>
    );
  }

  const sessionRole = String(session.user?.app_metadata?.role || "organizer").toLowerCase();
  const renderMemberWorkspace = (organizationAccess) => (
    <MemberProfileWorkspaceView
      supabase={supabase}
      user={session.user}
      accessProfile={profile}
      organizationAccess={organizationAccess}
      onActivateOrganization={activateOrganizationAccess}
      onLogout={logout}
      publicPlatformHomeRuntime={publicPlatformHomeRuntime}
    />
  );

  if (["athlete", "visitor", "spectator"].includes(sessionRole)) {
    return renderMemberWorkspace({ state: "available" });
  }

  if (!profile) {
    return <ProfileUnavailable onRetry={refreshProfile} onLogout={logout} />;
  }

  if (!session.user?.email_confirmed_at && isProfilePendingEmailConfirmation(profile)) {
    return (
      <EmailConfirmationPending
        email={session.user?.email}
        onRefresh={refreshProfile}
      />
    );
  }

  const today = getBrazilTodayISO();
  const expired = Boolean(profile.expires_at && profile.expires_at < today);
  const hasActivePeriod = !profile.expires_at || profile.expires_at >= today;
  const status = String(profile.status || "").toLowerCase();
  const isActive = status === "active";
  const isExplicitlyBlocked = ["blocked", "suspended", "inactive", "expired"].includes(status);

  if (!isActive && !expired && !isExplicitlyBlocked) {
    return <AccessPreparing onRetry={refreshProfile} onLogout={logout} />;
  }

  if (expired || !isActive || !hasActivePeriod) {
    return renderMemberWorkspace({
      state: status === "suspended" ? "suspended" : status === "blocked" ? "blocked" : "expired",
      profile,
      regularizationUrl: getPlanRegularizationWhatsAppUrl(profile, session.user),
    });
  }

  return (
    <Dashboard
      profile={profile}
      user={session.user}
      onProfileChange={setProfile}
      onReconcileOwnProfile={reconcileOwnProfile}
    />
  );
}


function EmailConfirmationPending(props) {
  return (
    <EmailConfirmationPendingScreen
      {...props}
      supabase={supabase}
      onLogout={logout}
    />
  );
}

function openOrganizerAccess() {
  navigatePlatform({ entrar: "1" });
}

function openOrganizerPanel() {
  navigatePlatform();
}

function LazyArenaPhoto(props) {
  return <LazyArenaPhotoView {...props} fetchPublicArenaPhoto={fetchPublicArenaPhoto} />;
}

function PublicPlatformHome({ session = null }) {
  return (
    <PublicPlatformHomeController
      session={session}
      runtime={publicPlatformHomeRuntime}
    />
  );
}
function Login(props) {
  return (
    <LoginScreen
      {...props}
      supabase={supabase}
      tagline={TORNEIO360_TAGLINE}
    />
  );
}

function Dashboard(props) {
  return (
    <OrganizerWorkspaceDashboard
      {...props}
      supabase={supabase}
      publicPlatformHomeRuntime={publicPlatformHomeRuntime}
    />
  );
}

function PublicArenaHeroHeader(props) {
  return (
    <PublicArenaHeroHeaderView
      {...props}
      tagline={TORNEIO360_TAGLINE}
      onBack={() => navigatePlatform()}
      onOrganizerAccess={openOrganizerAccess}
    />
  );
}
function PublicArenaTournamentCards(props) {
  return (
    <PublicArenaTournamentCardsView
      {...props}
      getRegistrationDeadline={getTournamentRegistrationDeadline}
      isRegistrationOpen={isRegistrationDeadlineOpen}
      getModalityName={getModalityDisplayName}
      formatDate={formatDateBR}
      sortTournaments={sortTournamentsByEventSchedule}
      RegistrationStatus={PublicRegistrationStatus}
    />
  );
}
const publicArenaPageRuntime = {
  PublicArenaHeroHeader,
  PublicArenaTournamentCards,
  PublicCircuitScreen,
  PublicTournamentScreen,
  fetchPublicArenaBundle,
  fetchPublicArenaEventsPage,
  fetchPublicArenaInitialView,
  fetchPublicArenaPhoto,
  fetchPublicCircuitCover,
  fetchPublicCircuitDetail,
  fetchPublicTournamentCover,
  fetchPublicTournamentDetail,
  refreshPublicTournamentDetail,
  loadPublicOrganizationGallery: (organizationId) => loadPublicOrganizationGallery({ supabase, organizationId }),
};

function PublicArenaPage(props) {
  return <PublicArenaPageController {...props} runtime={publicArenaPageRuntime} />;
}

function UnifiedPublicArenaProfile({ session = null, ...props }) {
  const hasSession = Boolean(session);
  return (
    <UnifiedPlatformFrame
      activePanel="profile"
      hasSession={hasSession}
      onNavigate={(panel) => navigateFromPublicProfile(panel, hasSession)}
      onSignup={hasSession ? undefined : () => navigatePlatform({ cadastro: "conta" })}
      onAccountAction={() => navigatePlatform(hasSession ? {} : { entrar: "1" })}
    >
      <PublicArenaPage {...props} session={session} embedded />
    </UnifiedPlatformFrame>
  );
}

const publicTournamentPageRuntime = {
  PublicArenaHeroHeader,
  PublicArenaTournamentCards,
  PublicCircuitScreen,
  PublicTournamentScreen,
  fetchPublicCircuitDetail,
  supabase,
};

function PublicTournamentPage(props) {
  return <PublicTournamentPageController {...props} runtime={publicTournamentPageRuntime} />;
}

const publicCircuitScreenRuntime = {
  RankingTable,
  buildPublicCircuitRankingGroups,
  fetchPublicCircuitRankingAll,
  fetchPublicCircuitRankingPage,
  tagline: TORNEIO360_TAGLINE,
};

function PublicCircuitScreen(props) {
  return <PublicCircuitScreenView {...props} runtime={publicCircuitScreenRuntime} />;
}

const publicTournamentScreenRuntime = {
  CupGroupRankingView,
  CupPodiumView,
  PublicCupBracketView,
  RankingView,
  ScheduleView,
  SimpleFormatInfoButton,
  TournamentFormatInfoButton,
  TournamentTimingSummary,
  calculateRanking,
  getSafeCupPresentation,
  getTournamentTimingSummary,
  supabase,
  tagline: TORNEIO360_TAGLINE,
};

function PublicTournamentScreen(props) {
  return (
    <PublicTournamentScreenView
      {...props}
      experienceMode={props.initialTab === "inscricao" ? "registration" : "view"}
      runtime={publicTournamentScreenRuntime}
    />
  );
}

const torneio360Root = globalThis.__torneio360ReactRoot || createRoot(document.getElementById("root"));
if (import.meta.env.DEV) globalThis.__torneio360ReactRoot = torneio360Root;

torneio360Root.render(
  <>
    <React.Suspense
      fallback={<PlatformLoadingScreen />}
    >
      <App />
    </React.Suspense>
    <InstallAppBanner />
    <AppUpdateNotice />
  </>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Não foi possível registrar o atalho instalável:", error);
    });
  });
}
