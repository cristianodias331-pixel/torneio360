import {
  loadOrganizationRegistrants,
  openOrganizationRegistrationReceipt,
  reviewOrganizationRegistration,
} from "../src/services/organizationRegistrantsApi.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

assert(rpcCalls[0].name === "get_my_organization_registrations", "A organização deve carregar suas inscrições pelo RPC protegido.");
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

console.log("Inscritos da organização: agrupamentos, comprovantes privados, aprovação, procura de dupla e fallback passaram.");
