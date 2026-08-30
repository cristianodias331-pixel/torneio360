import fs from "node:fs";
import {
  loadOrganizationRegistrants,
  openOrganizationRegistrationReceipt,
  pairApprovedOrganizationRegistrations,
  removeOrganizationRegistration,
  reviewOrganizationRegistration,
} from "../src/services/organizationRegistrantsApi.mjs";
import { arePairingCategoriesCompatible } from "../src/domain/pairingCategory.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const registrationMigration = fs.readFileSync(new URL("../supabase/migrations/202608290002_registration_gender_and_fixed_pairs.sql", import.meta.url), "utf8");
const homologationPairMigration = fs.readFileSync(new URL("../supabase/migrations/202608300004_pair_partner_search_registrations.sql", import.meta.url), "utf8");
const pairingAliasesMigration = fs.readFileSync(new URL("../supabase/migrations/202608300005_pairing_category_aliases.sql", import.meta.url), "utf8");
const registrantsPanelSource = fs.readFileSync(new URL("../src/features/profile/OrganizationRegistrantsPanel.jsx", import.meta.url), "utf8");
const registrantsStyles = fs.readFileSync(new URL("../src/styles/58-organization-registrants.css", import.meta.url), "utf8");

assert(registrationMigration.includes("can_view_registration_receipt"), "A organização deve poder ler o comprovante privado do torneio que administra.");
assert(registrationMigration.includes("registration_receipts_participant_read"), "A política privada do bucket deve autorizar atleta e organização responsável.");
assert(registrationMigration.includes("pair_approved_tournament_registrations"), "O banco deve formar duplas entre inscrições individuais aprovadas.");
assert(registrationMigration.includes("partner_search.active = true"), "Somente atletas realmente procurando dupla podem ser unidos pela organização.");
assert(registrationMigration.includes("get_my_organization_registrations_v2"), "O painel deve carregar a versão que preserva os dois perfis e comprovantes.");
assert(registrationMigration.includes("'partner_registration'"), "A inscrição principal deve trazer o comprovante do segundo atleta da dupla.");
assert(registrantsPanelSource.includes("organizationPairFloatingAction"), "A ação de formar dupla deve continuar visível depois da seleção.");
assert(registrantsPanelSource.includes("Comprovante da dupla"), "A organização deve conseguir abrir o comprovante dos dois atletas.");
assert(homologationPairMigration.includes("get_my_organization_registrations_v2"), "A homologação deve enviar a categoria esportiva dos atletas para a seleção da dupla.");
assert(homologationPairMigration.includes("pair_approved_tournament_registrations"), "A homologação deve gravar a dupla formada pela organização.");
assert(homologationPairMigration.includes("paired_into_registration_id is null"), "Depois de formada, a dupla deve aparecer uma única vez no painel.");
assert(pairingAliasesMigration.includes("t360_pairing_category_key"), "O banco deve reconhecer rótulos equivalentes de nível técnico.");
assert(pairingAliasesMigration.includes("'principiante', 'beginner'"), "Principiante e Iniciante devem ser compatíveis também no banco.");
assert(!registrantsPanelSource.includes("getPairCompatibilityError(pairMate, registration)"), "O segundo atleta deve poder ser selecionado antes da validação final da dupla.");
assert(registrantsPanelSource.includes("pairSelectionError"), "A incompatibilidade deve ser explicada junto à ação de formar dupla.");
assert(registrantsStyles.includes("justify-self: start") && registrantsStyles.includes("border: 0 !important"), "O perfil do inscrito deve ficar à esquerda e sem uma segunda moldura.");
assert(registrantsStyles.includes(".organizationRegistrantAvatar") && registrantsStyles.includes("border: 0 !important"), "A foto do perfil não deve receber uma moldura adicional.");
assert(arePairingCategoriesCompatible("Principiante", "Iniciante"), "Principiante e Iniciante devem representar o mesmo nível técnico na formação da dupla.");
assert(!arePairingCategoriesCompatible("Iniciante", "Categoria C"), "Níveis técnicos realmente diferentes devem continuar protegidos.");

const rpcCalls = [];
const richResult = await loadOrganizationRegistrants({
  supabase: {
    rpc: async (name, payload) => {
      rpcCalls.push({ name, payload });
      return {
        data: [{
          id: "registration-1",
          athlete_name: "Atleta Teste",
          payment_status: "paid",
          workflow_status: "approved",
          payment_proof_path: "athlete-1/registration-1/comprovante.pdf",
          looking_for_partner: true,
          tournament: { id: "tournament-1", name: "Torneio Teste", type: "Super 8", data: {} },
        }],
        error: null,
      };
    },
  },
  tournaments: [],
});

assert(rpcCalls[0].name === "get_my_organization_registrations_v2", "A organização deve carregar inscrições, categorias esportivas e comprovantes pelo RPC protegido atual.");
assert(richResult.schemaAvailable === true, "O painel deve reconhecer a estrutura completa do banco.");
assert(richResult.registrations[0].payment_status === "paid", "O pagamento confirmado deve chegar ao painel.");
assert(richResult.registrations[0].looking_for_partner === true, "A procura por dupla deve chegar ao painel.");

const tournament = { id: "tournament-2", name: "Torneio Local", type: "Super 6", data: { category: "Iniciante" } };
const fallbackResult = await loadOrganizationRegistrants({
  supabase: {
    rpc: async () => ({ data: null, error: { code: "PGRST202", message: "get_my_organization_registrations" } }),
    from: () => ({
      select: () => ({
        in: () => ({
          order: async () => ({
            data: [{
              id: "registration-2",
              tournament_id: "tournament-2",
              athlete_user_id: "athlete-2",
              athlete_name: "Atleta Local",
              partner_name: "",
              category: "",
              status: "pending",
              created_at: "2026-08-27T12:00:00Z",
            }],
            error: null,
          }),
        }),
      }),
    }),
  },
  tournaments: [tournament],
});

assert(fallbackResult.schemaAvailable === false, "A falta da migração deve ser informada sem ocultar os inscritos atuais.");
assert(fallbackResult.registrations.length === 1, "O fallback deve preservar os inscritos dos torneios da organização.");
assert(fallbackResult.registrations[0].category === "Iniciante", "A categoria do torneio deve preencher uma inscrição legada.");
assert(fallbackResult.registrations[0].payment_status === "pending", "Uma inscrição sem gestão financeira deve permanecer pendente.");

const reviewCalls = [];
await reviewOrganizationRegistration({
  supabase: {
    rpc: async (name, payload) => {
      reviewCalls.push({ name, payload });
      return { data: { id: "registration-1", workflow_status: "approved" }, error: null };
    },
  },
  registrationId: "registration-1",
  decision: "approved",
});

assert(reviewCalls[0].name === "review_tournament_registration_workflow", "A validação deve passar pelo RPC protegido da organização.");
assert(reviewCalls[0].payload.p_registration_id === "registration-1", "A atualização deve permanecer vinculada à inscrição escolhida.");
assert(reviewCalls[0].payload.p_decision === "approved", "A decisão deve ser enviada sem texto livre.");

const receiptUrl = await openOrganizationRegistrationReceipt({
  supabase: {
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path, expiresIn) => ({ data: { signedUrl: `private://${bucket}/${path}?ttl=${expiresIn}` }, error: null }),
      }),
    },
  },
  path: "athlete-1/registration-1/comprovante.pdf",
});
assert(receiptUrl.includes("registration-receipts"), "O comprovante deve ser aberto por URL privada e temporária.");

const pairCalls = [];
await pairApprovedOrganizationRegistrations({
  supabase: { rpc: async (name, payload) => { pairCalls.push({ name, payload }); return { data: { paired_count: 1 }, error: null }; } },
  registrationIds: ["registration-1", "registration-2"],
});
assert(pairCalls[0].name === "pair_approved_tournament_registrations", "A formação da dupla deve passar pelo RPC protegido da organização.");
assert(pairCalls[0].payload.p_registration_ids.length === 2, "Os dois atletas selecionados devem chegar juntos ao banco.");

const removeCalls = [];
await removeOrganizationRegistration({
  supabase: { rpc: async (name, payload) => { removeCalls.push({ name, payload }); return { data: { status: "cancelled" }, error: null }; } },
  registrationId: "registration-1",
});
assert(removeCalls[0].name === "remove_organization_tournament_registration", "A exclusão deve passar pelo RPC protegido da organização.");
assert(removeCalls[0].payload.p_registration_id === "registration-1", "A organização deve remover somente a inscrição selecionada.");

console.log("Inscritos da organização: dois perfis, comprovante privado, aprovação, exclusão e fallback passaram.");
