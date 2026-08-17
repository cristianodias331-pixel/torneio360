export function isCupType(config) {
  return config?.type === "cup"
    || config?.type === "cup18"
    || config?.type === "cup21"
    || config?.type === "copinha"
    || config?.type === "cearense"
    || config?.type === "cearenseIndividual"
    || config?.type === "playranking"
    || config?.type === "sunset";
}

export function isMixedType(config) {
  return config?.type === "mixed10"
    || config?.type === "mixed12"
    || config?.type === "mixed16"
    || config?.type === "mixed20";
}

export function isFlexibleSimpleType(config) {
  return config?.type === "simple8";
}

export function isReizinhoType(config) {
  return config?.type === "reizinho";
}

export function isIndividualCupType(config) {
  return config?.type === "cearenseIndividual" || config?.individualCup === true;
}
