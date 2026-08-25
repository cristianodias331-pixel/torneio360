import { modalityConfig } from "./modalityConfig.mjs";
import { isMixedType } from "./modalityClassification.mjs";
import {
  getTournamentGenderLabel,
  inferTournamentGenderMode,
  normalizeTournamentGenderMode,
  tournamentGenderModes,
} from "./participantGenderRegistry.mjs";

export const tournamentListGenderFilters = {
  all: "all",
  masculine: "masculino",
  feminine: "feminino",
  mixed: "mista_livre",
};

export function getEffectiveTournamentGenderMode(type, value) {
  if (isMixedType(modalityConfig[type])) return tournamentGenderModes.mixed;
  return normalizeTournamentGenderMode(value);
}

export function getTournamentListGenderFilter(type, details = {}) {
  const genderMode = getEffectiveTournamentGenderMode(type, inferTournamentGenderMode(details));
  if (genderMode === tournamentGenderModes.masculine) return tournamentListGenderFilters.masculine;
  if (genderMode === tournamentGenderModes.feminine) return tournamentListGenderFilters.feminine;
  if (genderMode === tournamentGenderModes.mixed || genderMode === tournamentGenderModes.open) {
    return tournamentListGenderFilters.mixed;
  }
  return "";
}

export function matchesTournamentListGenderFilter(type, details, filter = tournamentListGenderFilters.all) {
  return filter === tournamentListGenderFilters.all
    || getTournamentListGenderFilter(type, details) === filter;
}

export function getGenderCompatibleTournamentTypes(types, genderMode) {
  const normalizedMode = normalizeTournamentGenderMode(genderMode);
  if (
    normalizedMode !== tournamentGenderModes.masculine
    && normalizedMode !== tournamentGenderModes.feminine
  ) {
    return types;
  }

  return (types || []).filter((type) => !isMixedType(modalityConfig[type]));
}

export function getCompatibleTournamentType(currentType, genderMode, types) {
  const compatibleTypes = getGenderCompatibleTournamentTypes(types, genderMode);
  return compatibleTypes.includes(currentType)
    ? currentType
    : (compatibleTypes[0] || currentType);
}

export function getStoredTournamentGenderFields(type, mode, customLabel = "") {
  const participantGenderMode = getEffectiveTournamentGenderMode(type, mode);
  return {
    participantGenderMode,
    genderOther: participantGenderMode === tournamentGenderModes.other ? String(customLabel || "").trim() : "",
    gender: getTournamentGenderLabel(participantGenderMode, customLabel),
  };
}

export function getEditableTournamentGenderFields(details = {}, type = "") {
  const inferredMode = inferTournamentGenderMode(details);
  const participantGenderMode = getEffectiveTournamentGenderMode(
    type,
    inferredMode || tournamentGenderModes.open
  );
  return {
    category: String(details.category || ""),
    participantGenderMode,
    genderOther: participantGenderMode === tournamentGenderModes.other
      ? String(details.genderOther || details.gender || "")
      : String(details.genderOther || ""),
  };
}

export function getTournamentClassificationLabels(details = {}) {
  const category = String(details.category || "").trim();
  const structuredGender = getTournamentGenderLabel(
    inferTournamentGenderMode(details),
    details.genderOther
  );
  const gender = String(structuredGender || details.gender || "").trim();
  return [...new Set([category, gender].filter(Boolean))];
}
