import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVerifiedPodiumEntries } from "../src/domain/athleteAchievementEntries.mjs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const organizer = read("src/OrganizerWorkspace.jsx");
const registration = read("src/features/registration/TournamentRegistrationPanel.jsx");
const payment = read("src/features/registration/TournamentPaymentPanel.jsx");
const notifications = read("src/features/notifications/NotificationCenter.jsx");
const publicTournament = read("src/features/publicArena/PublicTournamentScreen.jsx");
const registrants = read("src/features/profile/OrganizationRegistrantsPanel.jsx");
const organizationPublications = read("src/features/profile/OrganizationProfileContentPresentation.jsx");
const galleryCover = read("src/features/media/organizationGalleryCover.mjs");
const migration = read("supabase/migrations/202608270006_registration_identity_notifications.sql");
const unifiedRegistrationMigration = read("supabase/migrations/202608270007_unified_athlete_registration.sql");
const achievementsMigration = read("supabase/migrations/202608280001_fixed_doubles_and_athlete_achievements.sql");
const persistentAchievementsMigration = read("supabase/migrations/202608280006_persistent_athlete_achievements.sql");
const registrationControlsMigration = read("supabase/migrations/202608290001_registration_controls_and_live_search.sql");
const registrationStyles = read("src/styles/60-tournament-registration.css");
const unifiedProfileStyles = read("src/styles/51-unified-profile.css");

assert.ok(
  organizer.includes("uploadTournamentRegulationsPdf")
    && organizer.includes('accept="application/pdf"')
    && migration.includes("'tournament-regulations'")
    && migration.includes("array['application/pdf']"),
  "O regulamento deixou de usar o fluxo seguro de PDF."
);

assert.ok(
  registration.includes("requiresFixedDoubles(modalityConfig[type])")
    && registration.includes("Atleta que está se inscrevendo")
    && registration.includes("form.athleteHandle")
    && registration.includes("Encontre o outro atleta da dupla")
    && registration.includes("searchTournamentPartnerCandidates")
    && migration.includes("find_tournament_partner_by_handle")
    && migration.includes("partner_status")
    && achievementsMigration.includes("tournament_type_requires_fixed_doubles"),
  "A dupla fixa deixou de usar endereço único, confirmação ou modalidade compatível."
);

assert.ok(
  unifiedRegistrationMigration.includes("add column if not exists athlete_handle")
    && unifiedRegistrationMigration.includes("private.provision_member_profile(auth.uid())")
    && !unifiedRegistrationMigration.includes("current_account_role() <> 'athlete'")
    && unifiedRegistrationMigration.includes("'is_self', partner_row.user_id = auth.uid()")
    && registrationControlsMigration.includes("member.display_name, member.handle")
    && registrationStyles.includes(".registrationPartnerLookup.found > span:first-of-type"),
  "A mesma conta deixou de usar o perfil de atleta ou a procura do próprio @ voltou a ser confusa."
);

assert.ok(
  payment.includes("Finalizar inscrição")
    && !payment.includes('type="radio"')
    && payment.includes("submissionNotice")
    && migration.includes("registration_submitted"),
  "O pagamento perdeu o botão funcional, o retorno próximo ou a notificação da organização."
);

assert.ok(
  notifications.includes("Aceitar dupla")
    && notifications.includes("Recusar")
    && notifications.includes('item.data?.partner_status === "pending"')
    && migration.includes("respond_to_tournament_partner_invitation")
    && migration.includes("list_my_platform_notifications"),
  "A central de notificações ou a resposta ao convite de dupla regrediu."
);

assert.ok(
  organizer.includes("userNavigationStartedRef.current = true")
    && organizer.includes("if (userNavigationStartedRef.current) return false")
    && organizer.includes('activePanel === "notificacoes"'),
  "Uma restauração tardia ainda pode substituir o clique atual em Notificações."
);

assert.ok(
  organizationPublications.includes('useState("tournaments")')
    && organizationPublications.includes('publicationFilter === "circuits"')
    && organizationPublications.includes("circuitStatusFilter")
    && organizationPublications.includes("statusFilter"),
  "Torneios e circuitos deixaram de ter áreas e subdivisões próprias no perfil da organização."
);

assert.ok(
  achievementsMigration.includes("create table if not exists public.athlete_achievements")
    && achievementsMigration.includes("approve_tournament_podium")
    && organizer.includes("automaticAchievementCandidates")
    && organizer.includes("automaticAchievementAttemptsRef")
    && !organizer.includes("Identidades pendentes no pódio")
    && !organizer.includes("Confirmar 1º, 2º e 3º"),
  "As conquistas oficiais deixaram de ser sincronizadas automaticamente e sem bloqueio."
);

assert.ok(
  persistentAchievementsMigration.includes("history_locked_at")
    && persistentAchievementsMigration.includes("interval '24 hours'")
    && persistentAchievementsMigration.includes("on delete set null")
    && persistentAchievementsMigration.includes("tournament_name")
    && persistentAchievementsMigration.includes("organization_name")
    && persistentAchievementsMigration.includes("left join public.tournaments"),
  "A conquista deixou de manter um histórico independente após a janela de correção de 24 horas."
);

const partialPairEntries = buildVerifiedPodiumEntries({
  podium: [{ name: "Atleta Verificado + Atleta sem perfil" }],
  identityIndex: new Map([["atleta verificado", { user_id: "verified-1" }]]),
  bracketName: "Principal",
});
assert.equal(partialPairEntries.length, 1, "A pessoa verificada da dupla deve receber a conquista mesmo sem identidade do parceiro.");
assert.equal(partialPairEntries[0].athlete_user_id, "verified-1");
assert.equal(partialPairEntries[0].partner_user_id, null, "A identidade ausente do parceiro não pode impedir ou fabricar vínculo.");

const verifiedPairEntries = buildVerifiedPodiumEntries({
  podium: [{ name: "Atleta Um + Atleta Dois" }],
  identityIndex: new Map([
    ["atleta um", { user_id: "verified-1" }],
    ["atleta dois", { user_id: "verified-2" }],
  ]),
  bracketName: "Principal",
});
assert.equal(verifiedPairEntries.length, 2, "Cada atleta verificado da dupla deve receber a própria conquista.");
assert.equal(verifiedPairEntries[0].partner_user_id, "verified-2");
assert.equal(verifiedPairEntries[1].partner_user_id, "verified-1");

assert.deepEqual(
  buildVerifiedPodiumEntries({
    podium: [{ name: "Atleta sem perfil" }],
    identityIndex: new Map(),
  }),
  [],
  "Participantes sem perfil verificado devem ser ignorados sem bloquear o torneio."
);

assert.ok(
  publicTournament.includes("AthleteIdentityLink")
    && publicTournament.includes("renderParticipant={renderParticipant}")
    && registrants.includes("openAthleteProfile")
    && registrants.includes("registration.athlete?.handle"),
  "Foto, nome e endereço do atleta deixaram de abrir o perfil nos torneios."
);

assert.ok(
  organizer.includes("excludeOrganizationCoverFromGallery")
    && galleryCover.includes("samplesMatch")
    && galleryCover.includes("mediaUrlKey"),
  "A capa da organização voltou a ocupar espaço na galeria."
);

assert.ok(
  unifiedProfileStyles.includes("align-items: start")
    && unifiedProfileStyles.includes("border-color: #10b981 !important"),
  "A foto voltou a descer no perfil ou a organização perdeu sua identificação verde."
);

assert.ok(
  registrants.includes('second: "2-digit"')
    && registrants.includes('timeZone: "America/Sao_Paulo"')
    && registrants.includes("º inscrito")
    && registrants.includes("registrationOrder"),
  "A organização perdeu a hora exata ou a ordem cronológica das inscrições."
);

assert.ok(
  registrants.includes("registration.partner")
    && registrants.includes("organizationReceiptModal")
    && registrants.includes("removeRegistration")
    && registration.includes("withdrawRegistration")
    && registration.includes("withdrawPartnership")
    && registrationControlsMigration.includes("remove_organization_tournament_registration")
    && registrationControlsMigration.includes("cancel_my_tournament_partnership"),
  "Os dois perfis, o comprovante interno ou os controles de desistência/exclusão regrediram."
);

console.log("Inscrição conectada: PDF, dupla, notificações, identidade e galeria passaram.");
