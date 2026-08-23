export const BRAZILIAN_STATES = Object.freeze([
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
]);

const brazilianCitiesCache = new Map();

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function normalizeBrazilianState(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return "";

  return BRAZILIAN_STATES.find((state) => (
    normalizeSearchText(state.code) === normalized
    || normalizeSearchText(state.name) === normalized
  ))?.code || "";
}

export async function loadBrazilianCities(stateValue, { signal } = {}) {
  const stateCode = normalizeBrazilianState(stateValue);
  if (!stateCode) return [];
  if (brazilianCitiesCache.has(stateCode)) {
    return brazilianCitiesCache.get(stateCode);
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios?orderBy=nome`,
    { signal }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar as cidades deste estado.");
  }

  const data = await response.json();
  const cities = [...new Set(
    (Array.isArray(data) ? data : [])
      .map((city) => String(city?.nome || "").trim())
      .filter(Boolean)
  )];
  brazilianCitiesCache.set(stateCode, cities);
  return cities;
}
