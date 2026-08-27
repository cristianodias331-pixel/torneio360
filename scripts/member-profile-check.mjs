import {
  createMemberProfileFallback,
  MAX_MEMBER_GALLERY_PHOTOS,
  normalizeMemberHandle,
  normalizeMemberGalleryPhotos,
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
  validateMemberProfile,
} from "../src/domain/memberProfile.mjs";
import { loadPublicMemberPublications } from "../src/services/memberProfileApi.mjs";

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
  galleryPhotos: ["https://example.test/foto-1.webp", "https://example.test/foto-2.webp"],
  isPublic: false,
});
assert(validation.valid, "O perfil válido deve passar pela validação.");
assert(validation.profile.isPublic === true, "O perfil esportivo deve permanecer público.");

const rpcPayload = toMemberProfileRpcPayload(validation.profile);
assert(rpcPayload.p_display_name === "Pessoa Teste", "O nome deve chegar ao RPC.");
assert(rpcPayload.p_handle === "pessoa.teste", "O identificador deve chegar ao RPC.");
assert(rpcPayload.p_cover_url.endsWith("capa.webp"), "A capa deve chegar ao RPC.");
assert(rpcPayload.p_is_public === true, "O RPC nunca deve tornar o perfil esportivo privado.");

const databaseProfile = normalizeMemberProfile({
  user_id: "member-1",
  display_name: "Nome no banco",
  photo_url: "foto.webp",
  cover_url: "capa.webp",
  gallery_photos: ["foto-1.webp", "foto-2.webp"],
  followers_count: 32,
  is_public: false,
}, fallback);
assert(databaseProfile.displayName === "Nome no banco", "O retorno do banco deve ser normalizado.");
assert(databaseProfile.isPublic === true, "O perfil armazenado deve ser tratado como público.");
assert(databaseProfile.galleryPhotos.length === 2, "As fotos públicas devem ser normalizadas.");
assert(databaseProfile.followersCount === 32, "A contagem de seguidores deve ser normalizada.");

const galleryOverflow = validateMemberProfile({
  ...fallback,
  galleryPhotos: Array.from({ length: MAX_MEMBER_GALLERY_PHOTOS + 1 }, (_, index) => `foto-${index}.webp`),
});
assert(!galleryOverflow.valid, "A sétima foto deve ser rejeitada.");

const publicationCalls = [];
const publicationResult = await loadPublicMemberPublications({
  supabase: {
    rpc: async (name, payload) => {
      publicationCalls.push({ name, payload });
      return { data: { items: [{ id: `${payload.p_kind}-1` }] }, error: null };
    },
  },
  organizationId: "organization-1",
});
assert(publicationCalls.length === 2, "O perfil público deve consultar torneios e circuitos.");
assert(publicationCalls.every((call) => call.name === "list_public_arena_events_page"), "As publicações devem usar a paginação pública existente.");
assert(publicationCalls.every((call) => call.payload.p_organizer_id === "organization-1"), "As publicações devem permanecer limitadas à organização vinculada.");
assert(publicationResult.tournaments.length === 1, "Os torneios públicos devem chegar à aba Publicações.");
assert(publicationResult.circuits.length === 1, "Os circuitos públicos devem chegar à aba Publicações.");

console.log("Perfil unificado: perfil público, galeria, publicações e payload passaram.");
