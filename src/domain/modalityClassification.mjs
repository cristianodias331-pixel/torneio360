export function isCupType(config) {
  return (typeof config?.cupMode === "string" && config.cupMode.trim() !== "")
    || config?.type === "cup"
    || config?.type === "cup18"
    || config?.type === "cup21"
    || config?.type === "copinha"
    || config?.type === "cearense"
    || config?.type === "cearenseIndividual"
    || config?.type === "playranking"
    || config?.type === "sunset";
}

export function isMixedType(config) {
  return typeof config?.type === "string" && config.type.startsWith("mixed");
}

export function isFixedTeamType(config) {
  return typeof config?.type === "string" && config.type.startsWith("fixed");
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

export function requiresFixedDoubles(config) {
  return Boolean(
    config
    && !isIndividualCupType(config)
    && (isFixedTeamType(config) || isCupType(config))
  );
}
