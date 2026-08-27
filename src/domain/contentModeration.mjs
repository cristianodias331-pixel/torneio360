const MODERATION_MESSAGE = "Este texto contém conteúdo não permitido pela plataforma. Revise antes de continuar.";

const blockedTerms = [
  "pornografia", "pornografico", "pornografica", "porno", "porn", "pornhub", "xvideos", "xhamster",
  "hentai", "onlyfans", "nudes", "nudez", "sexo explicito", "conteudo adulto", "video adulto",
  "sexo oral", "sexo anal", "masturbacao", "fetiche sexual", "acompanhante sexual", "garota de programa",
  "puta", "putaria", "putinha", "prostituta", "prostituicao", "vagabunda", "vadia",
  "caralho", "cacete", "porra", "foder", "foda se", "fodase", "fudido", "fudida",
  "filho da puta", "filha da puta", "vai tomar no cu", "tomar no cu", "cuzao", "arrombado", "arrombada",
  "merda", "buceta", "xoxota", "piroca", "pau no cu", "rola", "punheta",
];

const compactBlockedTerms = [
  "pornografia", "pornografico", "pornografica", "pornhub", "xvideos", "xhamster", "onlyfans",
  "masturbacao", "prostituicao", "filhodaputa", "filhadaputa", "vaitomarnocu", "paunocu",
];

const leetMap = Object.freeze({
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeModeratedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[013457@$]/g, (character) => leetMap[character] || character)
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function moderatePublicText(value) {
  const normalized = normalizeModeratedText(value);
  if (!normalized) return { allowed: true, message: "" };

  const padded = ` ${normalized} `;
  const compact = normalized.replace(/\s+/g, "");
  const blocked = blockedTerms.some((term) => {
    const normalizedTerm = normalizeModeratedText(term);
    return new RegExp(`(?:^|\\s)${escapeRegex(normalizedTerm).replace(/\\ /g, "\\s+")}(?:$|\\s)`, "u").test(padded.trim());
  }) || compactBlockedTerms.some((term) => compact.includes(normalizeModeratedText(term).replace(/\s+/g, "")));

  return blocked
    ? { allowed: false, message: MODERATION_MESSAGE }
    : { allowed: true, message: "" };
}

export function validatePublicTextFields(fields = {}) {
  for (const [field, value] of Object.entries(fields)) {
    const result = moderatePublicText(value);
    if (!result.allowed) return { ...result, field };
  }
  return { allowed: true, field: "", message: "" };
}

export function getContentModerationMessage() {
  return MODERATION_MESSAGE;
}
