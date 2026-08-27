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
const galleryCover = read("src/features/media/organizationGalleryCover.mjs");
const migration = read("supabase/migrations/202608270006_registration_identity_notifications.sql");

assert.ok(
  organizer.includes("uploadTournamentRegulationsPdf")
    && organizer.includes('accept="application/pdf"')
    && migration.includes("'tournament-regulations'")
    && migration.includes("array['application/pdf']"),
  "O regulamento deixou de usar o fluxo seguro de PDF."
);

assert.ok(
  registration.includes("isFixedTeamType(config) || isCupType(config)")
    && registration.includes("Endereço único do atleta da dupla")
    && registration.includes("findTournamentPartnerByHandle")
    && migration.includes("find_tournament_partner_by_handle")
    && migration.includes("partner_status"),
  "A dupla fixa deixou de usar endereço único, confirmação ou modalidade compatível."
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

console.log("Inscrição conectada: PDF, dupla, notificações, identidade e galeria passaram.");
