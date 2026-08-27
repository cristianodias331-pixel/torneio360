import {
  loadMyTournamentRegistrationCheckout,
  submitTournamentRegistrationWorkflow,
  validateRegistrationReceipt,
} from "../src/services/tournamentRegistrationApi.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
const supabase = {
  rpc: async (name, payload) => {
    calls.push({ type: "rpc", name, payload });
    if (name === "get_my_tournament_registration_checkout") {
      return { data: { registration: null, athlete: { display_name: "Atleta Teste" } }, error: null };
    }
    if (name === "prepare_my_tournament_registration") {
      return { data: { registration: { id: "registration-1" } }, error: null };
    }
    if (name === "submit_my_tournament_registration_proof_v2") {
      return { data: { id: "registration-1", workflow_status: "submitted" }, error: null };
    }
    return { data: null, error: { message: `RPC inesperado: ${name}` } };
  },
  auth: {
    getUser: async () => ({ data: { user: { id: "athlete-1" } }, error: null }),
  },
  storage: {
    from: (bucket) => ({
      upload: async (path, file, options) => {
        calls.push({ type: "upload", bucket, path, file, options });
        return { data: { path }, error: null };
      },
    }),
  },
};

const checkout = await loadMyTournamentRegistrationCheckout({ supabase, tournamentId: "tournament-1" });
assert(checkout.schemaAvailable === true, "A jornada deve reconhecer a estrutura aplicada.");
assert(checkout.checkout.athlete.display_name === "Atleta Teste", "Os dados do perfil devem preencher a inscrição.");

const receipt = { name: "pix.pdf", type: "application/pdf", size: 2048 };
const submitted = await submitTournamentRegistrationWorkflow({
  supabase,
  tournamentId: "tournament-1",
  athleteName: "Atleta Teste",
  category: "Iniciante",
  paymentMethod: "pix",
  receipt,
  lookingForPartner: true,
});

assert(submitted.workflow_status === "submitted", "A inscrição deve aguardar análise após o envio.");
const uploadCall = calls.find((call) => call.type === "upload");
assert(uploadCall.bucket === "registration-receipts", "O comprovante deve usar o bucket privado dedicado.");
assert(uploadCall.path === "athlete-1/registration-1/comprovante.pdf", "O caminho deve vincular atleta e inscrição.");
assert(uploadCall.options.upsert === true && uploadCall.options.contentType === "application/pdf", "O envio deve preservar o tipo e permitir reenvio controlado.");
const submitCall = calls.find((call) => call.name === "submit_my_tournament_registration_proof_v2");
assert(submitCall.payload.p_looking_for_partner === true, "A procura de dupla deve ser conectada à mesma inscrição.");
assert(submitCall.payload.p_payment_proof_path === uploadCall.path, "O banco deve receber somente o caminho privado do arquivo.");

assert(validateRegistrationReceipt({ name: "arquivo.exe", type: "application/octet-stream", size: 10 }), "Arquivos executáveis devem ser bloqueados.");
assert(validateRegistrationReceipt({ name: "grande.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }), "Arquivos acima de 10 MB devem ser bloqueados.");

console.log("Inscrição: perfil reaproveitado, comprovante privado, procura de dupla e análise passaram.");
