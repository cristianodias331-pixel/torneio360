import {
  createMemberProfileFallback,
  MAX_MEMBER_GALLERY_PHOTOS,
  normalizeMemberHandle,
  normalizeMemberGalleryPhotos,
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
  validateMemberProfile,
} from "../src/domain/memberProfile.mjs";
import {
  loadMyAthleteActivity,
  loadPublicAthleteActivity,
} from "../src/services/athleteActivityApi.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fallback = createMemberProfileFallback({
  user: { id: "member-1", email: "pessoa@teste.com" },
  accessProfile: { name: "Pessoa Teste" },
});

assert(fallback.displayName === "Pessoa Teste", "O perfil legado deve preencher somente o nome pessoal inicial.");
assert(fallback.photoUrl === "", "A foto da arena não deve virar foto pessoal.");
assert(fallback.galleryPhotos.length === 0, "A galeria deve começar vazia.");
assert(fallback.followersCount === 0, "O perfil deve começar sem seguidores artificiais.");
assert(normalizeMemberHandle(" @Meu Nome ") === "meunome", "O nome de usuário deve ser normalizado.");
assert(normalizeMemberGalleryPhotos(["foto-1.webp", "", "foto-2.webp"]).length === 2, "A galeria deve ignorar posições vazias.");

const validation = validateMemberProfile({
  ...fallback,
  handle: "pessoa.teste",
  coverUrl: "https://example.test/capa.webp",
  sportsCategory: "Iniciante",
  dominantHand: "Destro",
  whatsapp: "85999999999",
  telegram: "pessoa_teste",
  instagram: "pessoa.teste",
  showContacts: true,
  galleryPhotos: ["https://example.test/foto-1.webp", "https://example.test/foto-2.webp"],
  isPublic: false,
});
assert(validation.valid, "O perfil válido deve passar pela validação.");
assert(validation.profile.isPublic === true, "O perfil esportivo deve permanecer público.");

const rpcPayload = toMemberProfileRpcPayload(validation.profile);
assert(rpcPayload.p_display_name === "Pessoa Teste", "O nome deve chegar ao RPC.");
assert(rpcPayload.p_handle === "pessoa.teste", "O identificador deve chegar ao RPC.");
assert(rpcPayload.p_cover_url.endsWith("capa.webp"), "A capa deve chegar ao RPC.");
assert(rpcPayload.p_sports_category === "Iniciante", "A categoria deve chegar ao RPC.");
assert(rpcPayload.p_dominant_hand === "Destro", "A mão dominante deve chegar ao RPC.");
assert(rpcPayload.p_whatsapp === "85999999999", "O contato autorizado deve chegar ao RPC privado.");
assert(rpcPayload.p_show_contacts === true, "A autorização de contato deve chegar ao RPC.");

const databaseProfile = normalizeMemberProfile({
  user_id: "member-1",
  display_name: "Nome no banco",
  photo_url: "foto.webp",
  cover_url: "capa.webp",
  gallery_photos: ["foto-1.webp", "foto-2.webp"],
  followers_count: 32,
  sports_category: "Iniciante",
  dominant_hand: "Destro",
  show_contacts: true,
  is_public: false,
}, fallback);
assert(databaseProfile.displayName === "Nome no banco", "O retorno do banco deve ser normalizado.");
assert(databaseProfile.isPublic === true, "O perfil armazenado deve ser tratado como público.");
assert(databaseProfile.galleryPhotos.length === 2, "As fotos públicas devem ser normalizadas.");
assert(databaseProfile.followersCount === 32, "A contagem de seguidores deve ser normalizada.");
assert(databaseProfile.sportsCategory === "Iniciante", "A categoria armazenada deve ser normalizada.");
assert(databaseProfile.dominantHand === "Destro", "A mão dominante armazenada deve ser normalizada.");

const galleryOverflow = validateMemberProfile({
  ...fallback,
  galleryPhotos: Array.from({ length: MAX_MEMBER_GALLERY_PHOTOS + 1 }, (_, index) => `foto-${index}.webp`),
});
assert(!galleryOverflow.valid, "A sétima foto deve ser rejeitada.");

const activityCalls = [];
const activitySupabase = {
  rpc: async (name, payload) => {
    activityCalls.push({ name, payload });
    if (name === "get_my_registration_workflows") {
      return { data: [{ id: "registration-1", workflow_status: "submitted" }], error: null };
    }
    return { data: { registrations: [{ id: "registration-1" }], circuits: [], partner_matches: [], challenges: [] }, error: null };
  },
};
const ownActivityResult = await loadMyAthleteActivity({
  supabase: activitySupabase,
});
const publicActivityResult = await loadPublicAthleteActivity({
  supabase: activitySupabase,
  userId: "member-1",
});
assert(activityCalls[0].name === "get_my_registration_workflows", "O próprio perfil deve carregar o estado da inscrição e do comprovante.");
assert(activityCalls[1].name === "get_my_athlete_activity", "O próprio perfil deve carregar inscrições, duplas e desafios.");
assert(activityCalls[2].name === "get_public_athlete_activity", "O visitante deve carregar somente participações públicas.");
assert(activityCalls[2].payload.p_user_id === "member-1", "A atividade pública deve permanecer vinculada ao atleta visitado.");
assert(ownActivityResult.activity.registrations.length === 1, "As inscrições do atleta devem chegar à aba Torneios/Circuitos.");
assert(ownActivityResult.activity.registrations[0].workflow_status === "submitted", "O atleta deve acompanhar o comprovante em análise.");
assert(publicActivityResult.activity.registrations.length === 1, "As participações confirmadas devem chegar ao perfil público.");

const unavailableActivity = await loadMyAthleteActivity({
  supabase: {
    rpc: async () => ({ data: null, error: { code: "PGRST202", message: "get_my_athlete_activity" } }),
  },
});
assert(unavailableActivity.schemaAvailable === false, "A interface deve preservar os dados quando a migração ainda não estiver aplicada.");

console.log("Perfil unificado: dados esportivos, contatos protegidos, atividades, duplas e desafios passaram.");
