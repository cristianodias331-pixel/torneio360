import {
  getContentModerationMessage,
  moderatePublicText,
  normalizeModeratedText,
  validatePublicTextFields,
} from "../src/domain/contentModeration.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const allowedExamples = [
  "Arena Beach Sports",
  "Categoria B",
  "Canhoto no lado esquerdo",
  "Circuito de Verão 2026",
];

for (const example of allowedExamples) {
  assert(moderatePublicText(example).allowed, `O texto legítimo deve ser aceito: ${example}`);
}

const blockedExamples = [
  "conteúdo adulto",
  "p0rn0gr4fia",
  "vai.tomar.no.cu",
  "f i l h o d a p u t a",
];

for (const example of blockedExamples) {
  const result = moderatePublicText(example);
  assert(!result.allowed, "Conteúdo impróprio, inclusive disfarçado, deve ser bloqueado.");
  assert(result.message === getContentModerationMessage(), "A mensagem deve explicar o bloqueio sem repetir o termo.");
}

assert(normalizeModeratedText("CATEGORIA Á") === "categoria a", "A normalização deve remover acentos e caixa.");

const fieldValidation = validatePublicTextFields({
  nome: "Torneio Família",
  descricao: "conteúdo adulto",
});
assert(!fieldValidation.allowed, "A validação conjunta deve rejeitar o primeiro campo impróprio.");
assert(fieldValidation.field === "descricao", "A validação deve identificar o campo que precisa ser revisto.");

console.log("Moderação pública: textos legítimos, proibidos e disfarçados passaram.");
