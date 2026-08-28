import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
const podium = read("src/features/ranking/CupPodiumView.jsx");
const galleryCover = read("src/features/media/organizationGalleryCover.mjs");
const migration = read("supabase/migrations/202608270006_registration_identity_notifications.sql");
const unifiedRegistrationMigration = read("supabase/migrations/202608270007_unified_athlete_registration.sql");
const achievementsMigration = read("supabase/migrations/202608280001_fixed_doubles_and_athlete_achievements.sql");
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
    && registration.includes("Endereço único do outro atleta da dupla")
    && registration.includes("findTournamentPartnerByHandle")
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
    && registration.includes("Esse é o seu próprio perfil")
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
    && organizer.includes("Confirmar 1º, 2º e 3º")
    && podium.includes("approvalPodium"),
  "As conquistas oficiais deixaram de registrar o pódio completo confirmado pela organização."
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

console.log("Inscrição conectada: PDF, dupla, notificações, identidade e galeria passaram.");
