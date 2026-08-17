export function formatParticipantName(value) {
  const connectors = new Set(["da", "das", "de", "do", "dos", "e"]);
  const words = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(" ");

  return words.map((word, index) => {
    if (!word || (index > 0 && connectors.has(word))) return word;
    return word.replace(/(^|[-'’])(\p{L})/gu, (_, prefix, letter) => (
      `${prefix}${letter.toLocaleUpperCase("pt-BR")}`
    ));
  }).join(" ");
}
