import {
  loadOrganizationRegistrants,
  setOrganizationRegistrationPayment,
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

const paymentCalls = [];
await setOrganizationRegistrationPayment({
  supabase: {
    rpc: async (name, payload) => {
      paymentCalls.push({ name, payload });
      return { data: { id: "registration-1", payment_status: "paid" }, error: null };
    },
  },
  registrationId: "registration-1",
  paymentStatus: "paid",
});

assert(paymentCalls[0].name === "set_organization_registration_payment_status", "O pagamento deve ser alterado somente pelo RPC da organização.");
assert(paymentCalls[0].payload.p_registration_id === "registration-1", "A atualização deve permanecer vinculada à inscrição escolhida.");
assert(paymentCalls[0].payload.p_payment_status === "paid", "O estado de pagamento deve ser enviado sem texto livre.");

console.log("Inscritos da organização: agrupamentos, pagamentos, procura de dupla e fallback passaram.");
