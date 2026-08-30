const pairingCategoryAliases = new Map([
  ["iniciante", "iniciante"],
  ["principiante", "iniciante"],
  ["beginner", "iniciante"],
  ["novato", "iniciante"],
  ["novata", "iniciante"],
]);

export function normalizePairingCategory(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
  return pairingCategoryAliases.get(normalized) || normalized;
}

export function arePairingCategoriesCompatible(first, second) {
  return normalizePairingCategory(first) === normalizePairingCategory(second);
}
