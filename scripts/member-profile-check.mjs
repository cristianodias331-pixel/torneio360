import {
  createMemberProfileFallback,
  normalizeMemberHandle,
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
  validateMemberProfile,
} from "../src/domain/memberProfile.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fallback = createMemberProfileFallback({
  user: { id: "member-1", email: "pessoa@teste.com" },
  accessProfile: { name: "Pessoa Teste" },
});

assert(fallback.displayName === "Pessoa Teste", "O perfil legado deve preencher somente o nome pessoal inicial.");
assert(fallback.photoUrl === "", "A foto da arena não deve virar foto pessoal.");
assert(normalizeMemberHandle(" @Meu Nome ") === "meunome", "O nome de usuário deve ser normalizado.");

const validation = validateMemberProfile({
  ...fallback,
  handle: "pessoa.teste",
  coverUrl: "https://example.test/capa.webp",
});
assert(validation.valid, "O perfil válido deve passar pela validação.");

const rpcPayload = toMemberProfileRpcPayload(validation.profile);
assert(rpcPayload.p_display_name === "Pessoa Teste", "O nome deve chegar ao RPC.");
assert(rpcPayload.p_handle === "pessoa.teste", "O identificador deve chegar ao RPC.");
assert(rpcPayload.p_cover_url.endsWith("capa.webp"), "A capa deve chegar ao RPC.");

const databaseProfile = normalizeMemberProfile({
  user_id: "member-1",
  display_name: "Nome no banco",
  photo_url: "foto.webp",
  cover_url: "capa.webp",
  is_public: false,
}, fallback);
assert(databaseProfile.displayName === "Nome no banco", "O retorno do banco deve ser normalizado.");
assert(databaseProfile.isPublic === false, "A privacidade escolhida deve ser preservada.");

console.log("Perfil unificado: normalização, privacidade e payload passaram.");
