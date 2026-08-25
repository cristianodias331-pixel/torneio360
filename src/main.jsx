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
  OrganizerWorkspaceDashboard,
  PublicArenaPageController,
  PublicCircuitScreenView,
  PublicCupBracketView,
  PublicPlatformHomeController,
  PublicTournamentPageController,
  PublicTournamentScreenView,
  SimpleFormatInfoButton,
} from "./features/appShell/lazyFeatures.jsx";
import {
  AccessPreparing,
  Blocked,
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
  formatStatusBR,
} from "./domain/statusFormatting.mjs";
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
  createCupPresentation,
} from "./domain/cupPresentation.mjs";
import "./style.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || "https://dttutybojealkvuywszt.supabase.co";
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
  fetchPublicArenaPhoto,
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
  const routeParams = new URLSearchParams(window.location.search);
  const publicId = routeParams.get("public");
  const arenaId = routeParams.get("arena");
  const wantsLogin = routeParams.get("entrar") === "1";
  const publicMode = routeParams.get("publico") === "1";

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState(() => getAuthFlowFromLocation());
  const [authCallbackError, setAuthCallbackError] = useState(() => getAuthCallbackError());
  const [authNotice, setAuthNotice] = useState(null);
  const activeUserIdRef = useRef(null);

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

  if (publicId || arenaId) {
    return <PublicArenaPage publicId={publicId} arenaId={arenaId} />;
  }

  if (publicMode && authFlow !== "recovery") {
    return <PublicPlatformHome session={session} />;
  }

  if (loading) {
    return (
      <div className="loadingPage">
        <div className="loadingCard">
          <div className="loadingSpinner" aria-hidden="true" />
          <p>Carregando Torneio 360...</p>
        </div>
      </div>
    );
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

  if (!session && !wantsLogin && !authCallbackError && !authNotice) {
    return <PublicPlatformHome />;
  }

  if (!session) {
    return (
      <Login
        key="guest-login"
        initialMode={authCallbackError ? "forgotPassword" : "login"}
        initialNotice={authCallbackError || authNotice}
      />
    );
  }

  const sessionRole = String(session.user?.app_metadata?.role || "organizer").toLowerCase();
  if (["athlete", "visitor", "spectator"].includes(sessionRole)) {
    return <PublicPlatformHome session={session} />;
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
    return (
      <Blocked
        plan={profile.plan || "Não informado"}
        status={formatStatusBR(profile.status)}
        expiresAt={profile.expires_at ? formatDateBR(profile.expires_at) : "Não definido"}
        regularizationUrl={getPlanRegularizationWhatsAppUrl(profile, session.user)}
        autoRedirect={status !== "suspended"}
        onBrowse={() => window.location.assign(`${window.location.origin}/?publico=1`)}
        onLogout={logout}
      />
    );
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
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "acesso";
  url.searchParams.set("entrar", "1");
  window.location.assign(url.toString());
}

function openOrganizerPanel() {
  const url = new URL(window.location.origin);
  window.location.assign(url.toString());
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
  return <OrganizerWorkspaceDashboard {...props} supabase={supabase} />;
}

function PublicArenaHeroHeader(props) {
  return (
    <PublicArenaHeroHeaderView
      {...props}
      tagline={TORNEIO360_TAGLINE}
      onBack={() => window.location.assign(window.location.origin)}
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
};

function PublicArenaPage(props) {
  return <PublicArenaPageController {...props} runtime={publicArenaPageRuntime} />;
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
  tagline: TORNEIO360_TAGLINE,
};

function PublicTournamentScreen(props) {
  return <PublicTournamentScreenView {...props} runtime={publicTournamentScreenRuntime} />;
}

const torneio360Root = globalThis.__torneio360ReactRoot || createRoot(document.getElementById("root"));
if (import.meta.env.DEV) globalThis.__torneio360ReactRoot = torneio360Root;

torneio360Root.render(
  <>
    <React.Suspense
      fallback={(
        <div className="loadingPage" role="status" aria-label="Carregando área do Torneio 360">
          <div className="loadingCard">
            <div className="loadingSpinner" aria-hidden="true" />
            <p>Carregando área do Torneio 360...</p>
          </div>
        </div>
      )}
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
