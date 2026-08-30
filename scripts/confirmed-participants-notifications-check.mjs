import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyApprovedRegistrationsToTournamentData } from "../src/domain/tournamentRegistrationParticipants.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";

const data = {
  players: {
    teams: Array.from({ length: 5 }, (_, index) => ({
      a: `Atleta 1 da dupla ${index + 1}`,
      b: `Atleta 2 da dupla ${index + 1}`,
    })),
  },
  schedule: [[{
    ids1: [0],
    ids2: [1],
    team1: ["Atleta 1 da dupla 1 + Atleta 2 da dupla 1"],
    team2: ["Atleta 1 da dupla 2 + Atleta 2 da dupla 2"],
  }]],
};
const identities = [
  { registration_id: "registration-1", registered_at: "2026-08-27T12:00:00Z", registration_role: "athlete", user_id: "athlete-1", handle: "cristiano", display_name: "Cristiano Pessoa", photo_url: "athlete.jpg" },
  { registration_id: "registration-1", registered_at: "2026-08-27T12:00:00Z", registration_role: "partner", user_id: "athlete-2", handle: "danilo", display_name: "Danilo Silva", photo_url: "partner.jpg" },
];

const merged = applyApprovedRegistrationsToTournamentData(data, modalityConfig["Super 10 (Dupla Fixa)"], identities);
assert.equal(merged.changed, true, "A inscrição aprovada deve ocupar uma vaga automática.");
assert.deepEqual(merged.data.players.teams[0], { a: "Cristiano Pessoa", b: "Danilo Silva" });
assert.deepEqual(merged.data.schedule[0][0].team1, ["Cristiano Pessoa + Danilo Silva"], "Os jogos devem receber os nomes reais.");
assert.equal(merged.data.approvedRegistrationParticipants.length, 2, "A identidade clicável dos dois atletas deve ser preservada.");
assert.equal(applyApprovedRegistrationsToTournamentData(merged.data, modalityConfig["Super 10 (Dupla Fixa)"], identities).changed, false, "A sincronização deve ser idempotente.");

const individualApprovals = [
  identities[0],
  { ...identities[1], registration_id: "registration-2", registration_role: "athlete" },
];
const separated = applyApprovedRegistrationsToTournamentData(data, modalityConfig["Super 10 (Dupla Fixa)"], individualApprovals);
assert.equal(separated.data.players.teams[1].a, "Danilo Silva", "Inscrições individuais devem ocupar vagas provisórias distintas.");
const paired = applyApprovedRegistrationsToTournamentData(separated.data, modalityConfig["Super 10 (Dupla Fixa)"], identities);
assert.deepEqual(paired.data.players.teams[0], { a: "Cristiano Pessoa", b: "Danilo Silva" }, "A dupla formada deve ocupar uma única vaga.");
assert.equal(paired.data.players.teams[1].a, "Atleta 1 da dupla 2", "A vaga provisória anterior precisa ser liberada sem duplicar o atleta.");

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const chrome = read("src/features/appShell/PlatformChrome.jsx");
const notifications = read("src/features/notifications/NotificationCenter.jsx");
const notificationHook = read("src/features/notifications/useUnreadNotificationCount.js");
const organizerWorkspace = read("src/OrganizerWorkspace.jsx");
const lightbox = read("src/features/publicArena/PublicArenaPresentation.jsx");
const arenaController = read("src/features/publicArena/PublicArenaPageController.jsx");
const tournamentScreen = read("src/features/publicArena/PublicTournamentScreen.jsx");
const registrants = read("src/features/profile/OrganizationRegistrantsPanel.jsx");
const organizationProfilePresentation = read("src/features/profile/OrganizationProfilePresentation.jsx");
const migration = read("supabase/migrations/202608270008_confirmed_participants_and_notifications.sql");
const publicOrganizationProfileMigration = read("supabase/migrations/202608270009_public_organization_real_profile.sql");
const feedStyles = read("src/styles/53-public-social-platform.css");
const loadingStyles = read("src/styles/22-public-links-and-interactions.css");
const coverStyles = read("src/styles/41-responsive-public-covers.css");
const navigationStyles = read("src/styles/56-unified-navigation.css");
const registrantStyles = read("src/styles/58-organization-registrants.css");
const tournamentJourneyStyles = read("src/styles/62-public-tournament-journey.css");
const main = read("src/main.jsx");
const publicHome = read("src/features/publicArena/PublicPlatformHomeController.jsx");

assert.ok(chrome.includes("navUnreadDot") && notificationHook.includes("!item.read_at"), "O sino perdeu o indicador de não visualizadas.");
assert.ok(notifications.includes("automaticViewRef") && notifications.includes("broadcastUnreadNotificationCount(0)"), "Abrir a central deve registrar a visualização.");
assert.ok(lightbox.includes("createPortal") && lightbox.includes("document.body"), "A imagem ampliada voltou a ficar sob a barra superior.");
assert.ok(feedStyles.includes("grid-template-columns: minmax(230px, 31%)") && feedStyles.includes('"poster organization"') && feedStyles.includes("object-fit: contain") && feedStyles.includes("background: #081629 !important"), "A publicação perdeu o cartão horizontal com o cartaz completo.");
assert.ok(feedStyles.includes(".embeddedPublicTournament > .platformEntityHeader") && feedStyles.includes("max-width: 1180px !important"), "O cabeçalho do torneio voltou a ficar desalinhado do conteúdo.");
assert.ok(organizerWorkspace.includes('profileIdentitySwitcherIcon${memberProfile.photoUrl') && organizerWorkspace.includes('profileIdentitySwitcherIcon${organizerProfile.photoUrl'), "O seletor de perfis deixou de usar as fotos do atleta e da organização.");
assert.ok(organizerWorkspace.includes("<OrganizationProfilePresentation") && lightbox.includes("<OrganizationProfilePresentation"), "O perfil próprio e o perfil visitado deixaram de usar a mesma apresentação real.");
assert.ok(organizationProfilePresentation.includes("canEdit = false") && organizationProfilePresentation.includes("canManageRegistrants = false"), "A apresentação compartilhada perdeu a separação entre visualização, edição e gestão privada.");
assert.ok(lightbox.includes("canEdit={false}") && lightbox.includes("canManageRegistrants={false}"), "O visitante voltou a receber permissões do proprietário.");
assert.ok(publicOrganizationProfileMigration.includes("'cover_url'") && publicOrganizationProfileMigration.includes("update of name, arena_name, city, state, photo_url, cover_url"), "A capa real da organização deixou de acompanhar o perfil público.");
assert.ok(registrants.includes("Formar duplas com inscritos individuais") && registrants.includes("pairSelectedRegistrations"), "A organização perdeu a montagem de duplas.");
assert.ok(migration.includes("pair_approved_tournament_registrations") && migration.includes("paired_into_registration_id"), "O banco deixou de conectar as inscrições individuais pareadas.");
assert.ok(arenaController.includes("EmbeddedArenaLoadingState") && arenaController.includes("EMBEDDED_ARENA_LOADING_MIN_DURATION_MS = 650") && loadingStyles.includes("embeddedArenaLoadingSkeleton"), "O perfil voltou ao carregamento demorado e sem estrutura visual.");
assert.ok(arenaController.includes("initialTournamentRequestRef") && arenaController.includes("directoryItem || {") && arenaController.includes("public_id: targetPublicId"), "Um link direto de torneio voltou a depender de o evento estar na página atual da lista da organização.");
assert.ok(coverStyles.includes("grid-template-columns: clamp(220px, 23vw, 264px)") && coverStyles.includes("width: min(72vw, 224px)"), "O cartaz do torneio perdeu o enquadramento responsivo.");
assert.ok(tournamentScreen.includes("publicAthleteEntry") && tournamentScreen.includes("publicAthleteGroupHeader") && coverStyles.includes("PARTICIPANTES PÚBLICOS"), "A lista pública de participantes perdeu os cartões de duplas.");
assert.ok(coverStyles.includes("-webkit-text-fill-color: transparent") && navigationStyles.replaceAll("\r\n", "\n").includes(".publicAthleteEntry\n  > .athleteIdentityLink"), "A dupla voltou a duplicar o conector ou perdeu contraste no modo escuro.");
assert.ok(coverStyles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") && coverStyles.includes("width: 52px !important") && coverStyles.includes("align-content: center"), "Os inscritos perderam as fotos maiores, o agrupamento em duplas ou o alinhamento vertical.");
assert.ok(tournamentScreen.includes("dedicatedRegistrationFlow") && tournamentScreen.includes("publicTournamentPrimaryAction") && !tournamentScreen.includes('setActivePublicTab("inscricao")'), "Consulta e inscrição voltaram a disputar as mesmas abas.");
assert.ok(main.includes('experienceMode={props.initialTab === "inscricao" ? "registration" : "view"}') && !main.includes("<TournamentWorkspaceScreen"), "Ver torneio voltou a abrir a tela administrativa ou perdeu o fluxo dedicado de inscrição.");
assert.ok(publicHome.includes('navigatePlatform({ public: item.public_id, inscricao: "1" })') && !publicHome.includes("if (!hasSession) {\n          openSignup();"), "Inscrever-se voltou a desviar o visitante antes de apresentar o fluxo e as informações do torneio.");
assert.ok(tournamentJourneyStyles.includes("publicTournamentRegistrationExperience") && tournamentJourneyStyles.includes("theme-dark") && tournamentJourneyStyles.includes("@media (max-width: 760px)"), "A jornada pública perdeu a adaptação para tema escuro ou celular.");
assert.ok(registrants.includes("organizationRegistrantControls") && registrants.includes("Organizar inscritos") && registrantStyles.includes("selectedForPair"), "A gestão de inscritos perdeu a hierarquia visual e a seleção de duplas.");

console.log("Notificações, fotos e participantes confirmados passaram.");
