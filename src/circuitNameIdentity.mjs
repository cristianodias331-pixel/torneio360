function compactCircuitName(value, fallback = "") {
  const compacted = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return compacted || fallback;
}

function removeDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function normalizeSingleCircuitName(value) {
  return removeDiacritics(compactCircuitName(value))
    .toLocaleLowerCase("pt-BR");
}

function splitCircuitTeam(value) {
  return compactCircuitName(value)
    .split(/\s*\+\s*/)
    .map((part) => compactCircuitName(part))
    .filter(Boolean);
}

function countDiacritics(value) {
  return (String(value || "").normalize("NFD").match(/\p{M}/gu) || []).length;
}

function preferSingleNameSpelling(currentValue, incomingValue) {
  const current = compactCircuitName(currentValue);
  const incoming = compactCircuitName(incomingValue);
  if (!current) return incoming;
  if (!incoming) return current;
  if (normalizeSingleCircuitName(current) !== normalizeSingleCircuitName(incoming)) return current;

  const currentWords = current.split(" ");
  const incomingWords = incoming.split(" ");
  if (currentWords.length !== incomingWords.length) {
    return countDiacritics(incoming) > countDiacritics(current) ? incoming : current;
  }

  return currentWords.map((currentWord, index) => {
    const incomingWord = incomingWords[index];
    if (normalizeSingleCircuitName(currentWord) !== normalizeSingleCircuitName(incomingWord)) return currentWord;
    return countDiacritics(incomingWord) > countDiacritics(currentWord) ? incomingWord : currentWord;
  }).join(" ");
}

export function normalizeCircuitParticipantKey(value, isTeam = false) {
  const parts = (isTeam ? splitCircuitTeam(value) : [compactCircuitName(value, "Sem nome")])
    .map(normalizeSingleCircuitName)
    .filter(Boolean);

  if (isTeam && parts.length > 1) {
    return parts.sort((first, second) => first.localeCompare(second, "pt-BR")).join(" + ");
  }

  return parts[0] || "sem nome";
}

export function chooseCircuitParticipantDisplayName(currentValue, incomingValue, isTeam = false) {
  const current = compactCircuitName(currentValue);
  const incoming = compactCircuitName(incomingValue);
  if (!current) return incoming || "Sem nome";
  if (!incoming) return current;
  if (normalizeCircuitParticipantKey(current, isTeam) !== normalizeCircuitParticipantKey(incoming, isTeam)) return current;
  if (!isTeam) return preferSingleNameSpelling(current, incoming);

  const currentParts = splitCircuitTeam(current);
  const incomingParts = splitCircuitTeam(incoming);
  const availableIncoming = incomingParts.map((part) => ({ key: normalizeSingleCircuitName(part), part, used: false }));

  return currentParts.map((currentPart) => {
    const key = normalizeSingleCircuitName(currentPart);
    const match = availableIncoming.find((candidate) => !candidate.used && candidate.key === key);
    if (!match) return currentPart;
    match.used = true;
    return preferSingleNameSpelling(currentPart, match.part);
  }).join(" + ");
}
