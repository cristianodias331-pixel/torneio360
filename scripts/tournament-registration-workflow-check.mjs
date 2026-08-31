import {
  cancelMyTournamentPartnership,
  cancelMyTournamentRegistration,
  loadMyTournamentRegistrationCheckout,
  searchTournamentPartnerCandidates,
  submitTournamentRegistrationWorkflow,
  validateRegistrationReceipt,
} from "../src/services/tournamentRegistrationApi.mjs";
import { saveMyMemberProfile } from "../src/services/memberProfileApi.mjs";
import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
const supabase = {
  rpc: async (name, payload) => {
    calls.push({ type: "rpc", name, payload });
    if (name === "get_my_tournament_registration_checkout_v2") {
      return { data: { registration: null, athlete: { display_name: "Atleta Teste", gender: "Masculino" } }, error: null };
    }
    if (name === "validate_tournament_registration_eligibility") {
      return { data: { eligible: true, requires_partner: true, gender_mode: "mista" }, error: null };
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
assert(checkout.checkout.athlete.gender === "Masculino", "A inscrição deve usar a categoria esportiva obrigatória do perfil.");

const registrationPanelSource = readFileSync(new URL("../src/features/registration/TournamentRegistrationPanel.jsx", import.meta.url), "utf8");
assert(registrationPanelSource.includes('<select value={form.gender}') && registrationPanelSource.includes('<option value="Masculino">Masculino</option>') && registrationPanelSource.includes('<option value="Feminino">Feminino</option>'), "A categoria esportiva da inscrição deve ser selecionável, sem digitação livre.");
assert(registrationPanelSource.includes("saveMyMemberProfile") && registrationPanelSource.includes("A escolha será salva no seu perfil ao finalizar a inscrição."), "A escolha feita na inscrição deve ser persistida no perfil do atleta.");
assert(!registrationPanelSource.includes("Dados aproveitados do seu perfil") && !registrationPanelSource.includes("Atleta que está se inscrevendo") && !registrationPanelSource.includes("Mão dominante</span>"), "A inscrição não deve repetir os dados esportivos já conhecidos pelo atleta.");
assert(!registrationPanelSource.includes("As sugestões aparecem enquanto você digita"), "A busca da dupla não deve exibir a explicação redundante sobre sugestões.");
assert(registrationPanelSource.includes("Complete apenas o que falta no perfil") && registrationPanelSource.includes("Formação da dupla"), "Somente pendências do perfil e decisões próprias da inscrição devem aparecer.");

const profileCalls = [];
const profileSupabase = { rpc: async (name, payload) => {
  profileCalls.push({ name, payload });
  if (name === "upsert_my_member_profile_v4") return { data: { ...payload, gender: payload.p_gender, sports: payload.p_sports }, error: null };
  if (name === "replace_my_member_profile_photos") return { data: [], error: null };
  return { data: null, error: { message: `RPC inesperado: ${name}` } };
} };
await saveMyMemberProfile({
  supabase: profileSupabase,
  profile: { userId: "athlete-1", displayName: "Atleta Teste", gender: "Feminino", sports: ["Beach Tennis"], galleryPhotos: [] },
  fallback: { userId: "athlete-1", displayName: "Atleta Teste" },
});
assert(profileCalls.find((call) => call.name === "upsert_my_member_profile_v4")?.payload.p_gender === "Feminino", "A seleção da inscrição deve chegar ao perfil como categoria esportiva válida.");

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
const eligibilityCall = calls.find((call) => call.name === "validate_tournament_registration_eligibility");
assert(eligibilityCall?.payload.p_looking_for_partner === true, "O banco deve validar dupla fixa e categoria esportiva antes de preparar a inscrição.");
assert(submitCall.payload.p_looking_for_partner === true, "A procura de dupla deve ser conectada à mesma inscrição.");
assert(submitCall.payload.p_payment_proof_path === uploadCall.path, "O banco deve receber somente o caminho privado do arquivo.");

assert(validateRegistrationReceipt({ name: "arquivo.exe", type: "application/octet-stream", size: 10 }), "Arquivos executáveis devem ser bloqueados.");
assert(validateRegistrationReceipt({ name: "grande.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }), "Arquivos acima de 10 MB devem ser bloqueados.");

const controlsCalls = [];
const controlsSupabase = { rpc: async (name, payload) => {
  controlsCalls.push({ name, payload });
  if (name === "search_tournament_partner_candidates_v2") return { data: [{ user_id: "athlete-2", display_name: "Dupla Teste", handle: "dupla.teste", gender: "Feminino" }], error: null };
  return { data: { registration_id: "registration-1" }, error: null };
} };
const candidates = await searchTournamentPartnerCandidates({ supabase: controlsSupabase, tournamentId: "tournament-1", query: "Dupla" });
assert(candidates.candidates[0].handle === "dupla.teste", "A busca deve sugerir atletas pelo nome e devolver o @ único.");
await cancelMyTournamentPartnership({ supabase: controlsSupabase, registrationId: "registration-1" });
await cancelMyTournamentRegistration({ supabase: controlsSupabase, registrationId: "registration-1" });
assert(controlsCalls.some((call) => call.name === "cancel_my_tournament_partnership"), "O atleta deve conseguir desfazer a parceria antes da aprovação.");
assert(controlsCalls.some((call) => call.name === "cancel_my_tournament_registration"), "O atleta deve conseguir desistir antes da aprovação.");

console.log("Inscrição: perfil reaproveitado, busca dinâmica, desistência, comprovante privado e análise passaram.");
