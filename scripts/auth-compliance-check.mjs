import {
  isValidBrazilianTaxId,
  isValidCnpj,
  isValidCpf,
  normalizeBrazilianTaxId,
} from "../src/domain/authValidation.mjs";
import {
  createMemberProfileFallback,
  validateMemberProfile,
} from "../src/domain/memberProfile.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(normalizeBrazilianTaxId("529.982.247-25") === "52998224725", "O CPF deve ser normalizado somente para validação local.");
assert(isValidCpf("529.982.247-25"), "Um CPF com dígitos verificadores válidos deve ser aceito.");
assert(!isValidCpf("111.111.111-11"), "CPF com todos os dígitos repetidos deve ser recusado.");
assert(isValidCnpj("11.222.333/0001-81"), "Um CNPJ com dígitos verificadores válidos deve ser aceito.");
assert(!isValidCnpj("11.111.111/1111-11"), "CNPJ inválido deve ser recusado.");
assert(isValidBrazilianTaxId("52998224725", "cpf"), "A escolha CPF deve usar a validação correspondente.");
assert(isValidBrazilianTaxId("11222333000181", "cnpj"), "A escolha CNPJ deve usar a validação correspondente.");

const athlete = createMemberProfileFallback({
  user: {
    id: "athlete-1",
    email: "atleta@teste.com",
    user_metadata: { sports_category: "B", dominant_hand: "Canhoto", shirt_size: "M" },
  },
});
const athleteValidation = validateMemberProfile(athlete);
assert(athleteValidation.valid, "Os dados esportivos válidos do atleta devem passar.");
assert(athleteValidation.profile.sportsCategory === "B", "A categoria deve aparecer no perfil do atleta.");
assert(athleteValidation.profile.dominantHand === "Canhoto", "A mão dominante deve ser preservada.");
assert(athleteValidation.profile.shirtSize === "M", "O tamanho da camiseta deve ficar nos detalhes.");

console.log("Cadastro protegido: CPF/CNPJ local, concordâncias e dados esportivos passaram.");
