import { normalizeCircuitParticipantKey } from "../circuitNameIdentity.mjs";
import { classifyParticipantGender } from "../fixedMixedTeamOrder.mjs";
import { formatParticipantName } from "./participantNames.mjs";
import { isCupType, isIndividualCupType, isMixedType } from "./modalityClassification.mjs";

export const participantGenderValues = {
  masculine: "masculino",
  feminine: "feminino",
  unknown: "nao_informado",
};

export const tournamentGenderModes = {
  masculine: "masculino",
  feminine: "feminino",
  mixed: "mista",
  open: "livre",
  other: "outro",
  unknown: "",
};

const validTournamentGenderModes = new Set(Object.values(tournamentGenderModes));

const validGenders = new Set(Object.values(participantGenderValues));

export function getParticipantGenderKey(name) {
  return normalizeCircuitParticipantKey(name, false);
}

export function normalizeParticipantGender(value) {
  const normalized = String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  if (["m", "masc", "masculino", "homem", "male", "masculine"].includes(normalized)) {
    return participantGenderValues.masculine;
  }
  if (["f", "fem", "feminino", "mulher", "female", "feminine"].includes(normalized)) {
    return participantGenderValues.feminine;
  }
  return participantGenderValues.unknown;
}

export function normalizeTournamentGenderMode(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (["m", "masc", "masculino", "homem", "homens"].includes(normalized)) {
    return tournamentGenderModes.masculine;
  }
  if (["f", "fem", "feminino", "mulher", "mulheres"].includes(normalized)) {
    return tournamentGenderModes.feminine;
  }
  if (["misto", "mista", "mixed"].includes(normalized)) {
    return tournamentGenderModes.mixed;
  }
  if (["livre", "open", "aberto", "aberta"].includes(normalized)) {
    return tournamentGenderModes.open;
  }
  if (["outro", "outra"].includes(normalized)) {
    return tournamentGenderModes.other;
  }
  return tournamentGenderModes.unknown;
}

export function inferTournamentGenderMode(data = {}) {
  const explicit = normalizeTournamentGenderMode(data.participantGenderMode || data.genderMode);
  if (validTournamentGenderModes.has(explicit) && explicit) return explicit;

  const legacyGender = String(data.gender || "");
  const normalizedLegacy = legacyGender
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
  if (/mista|misto/u.test(normalizedLegacy)) return tournamentGenderModes.mixed;
  if (/masculin|\bmasc\b/u.test(normalizedLegacy) && !/feminin/u.test(normalizedLegacy)) {
    return tournamentGenderModes.masculine;
  }
  if (/feminin|\bfem\b/u.test(normalizedLegacy) && !/masculin/u.test(normalizedLegacy)) {
    return tournamentGenderModes.feminine;
  }
  if (/\blivre\b|\bopen\b|\babert[oa]\b/u.test(normalizedLegacy)) return tournamentGenderModes.open;
  return tournamentGenderModes.unknown;
}

export function getTournamentGenderLabel(mode, customLabel = "") {
  const normalizedMode = normalizeTournamentGenderMode(mode);
  if (normalizedMode === tournamentGenderModes.masculine) return "Masculino";
  if (normalizedMode === tournamentGenderModes.feminine) return "Feminino";
  if (normalizedMode === tournamentGenderModes.mixed) return "Mista";
  if (normalizedMode === tournamentGenderModes.open) return "Livre";
  if (normalizedMode === tournamentGenderModes.other) return String(customLabel || "").trim();
  return "";
}

export function getOppositeParticipantGender(gender) {
  const normalizedGender = normalizeParticipantGender(gender);
  if (normalizedGender === participantGenderValues.masculine) return participantGenderValues.feminine;
  if (normalizedGender === participantGenderValues.feminine) return participantGenderValues.masculine;
  return participantGenderValues.unknown;
}

export function normalizeParticipantGenderRegistry(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source).flatMap(([sourceKey, sourceEntry]) => {
    const entry = sourceEntry && typeof sourceEntry === "object" && !Array.isArray(sourceEntry)
      ? sourceEntry
      : { gender: sourceEntry };
    const name = formatParticipantName(entry.name || sourceKey);
    const key = getParticipantGenderKey(name);
    const gender = normalizeParticipantGender(entry.gender);
    if (!key || key === "sem nome" || !validGenders.has(gender) || gender === participantGenderValues.unknown) return [];
    return [[key, {
      name,
      gender,
      confirmed: gender !== participantGenderValues.unknown && entry.confirmed !== false,
      updatedAt: String(entry.updatedAt || entry.updated_at || ""),
    }]];
  });

  return Object.fromEntries(entries);
}

export function mergeParticipantGenderRegistries(...registries) {
  const merged = {};
  registries.forEach((registry) => {
    Object.entries(normalizeParticipantGenderRegistry(registry)).forEach(([key, entry]) => {
      const current = merged[key];
      if (!current || entry.confirmed || !current.confirmed) {
        merged[key] = {
          ...current,
          ...entry,
          name: current?.name && current.name.normalize("NFD").length > entry.name.normalize("NFD").length
            ? current.name
            : entry.name,
        };
      }
    });
  });
  return merged;
}

export function setParticipantGender(registry, name, gender, { confirmed = true } = {}) {
  const next = normalizeParticipantGenderRegistry(registry);
  const formattedName = formatParticipantName(name);
  const key = getParticipantGenderKey(formattedName);
  if (!key || key === "sem nome") return next;
  const normalizedGender = normalizeParticipantGender(gender);
  if (normalizedGender === participantGenderValues.unknown) {
    delete next[key];
    return next;
  }
  next[key] = {
    name: formattedName,
    gender: normalizedGender,
    confirmed: normalizedGender !== participantGenderValues.unknown && Boolean(confirmed),
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export function getParticipantGender(registry, name, { confirmedOnly = false } = {}) {
  const entry = normalizeParticipantGenderRegistry(registry)[getParticipantGenderKey(name)];
  if (!entry || (confirmedOnly && !entry.confirmed)) return participantGenderValues.unknown;
  return entry.gender;
}

export function orderConfirmedMixedTeams(teams, registry) {
  if (!Array.isArray(teams)) return [];

  return teams.map((team) => {
    const firstGender = getParticipantGender(registry, team?.a, { confirmedOnly: true });
    const secondGender = getParticipantGender(registry, team?.b, { confirmedOnly: true });

    return firstGender === participantGenderValues.feminine
      && secondGender === participantGenderValues.masculine
      ? { ...team, a: team.b, b: team.a }
      : team;
  });
}

function isAutomaticParticipantName(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("pt-BR");
  return !normalized || /^(?:atleta [12](?: da dupla \d+)?|participante \d+|jogador \d+|homem \d+|mulher \d+)$/u.test(normalized);
}

function categoryGender(value) {
  const normalized = String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  if (/masculin|\bmasc\b/u.test(normalized) && !/feminin|mista|misto/u.test(normalized)) return participantGenderValues.masculine;
  if (/feminin|\bfem\b/u.test(normalized) && !/masculin|mista|misto/u.test(normalized)) return participantGenderValues.feminine;
  return participantGenderValues.unknown;
}

function suggestedNameGender(name) {
  const classified = classifyParticipantGender(name);
  if (classified === "masculine") return participantGenderValues.masculine;
  if (classified === "feminine") return participantGenderValues.feminine;
  return participantGenderValues.unknown;
}

export function collectTournamentGenderCandidates(tournament, config) {
  const data = tournament?.data || {};
  const explicitRegistry = normalizeParticipantGenderRegistry(data.participantGenders);
  const tournamentGenderMode = inferTournamentGenderMode(data);
  const category = tournamentGenderMode === tournamentGenderModes.masculine
    ? participantGenderValues.masculine
    : tournamentGenderMode === tournamentGenderModes.feminine
      ? participantGenderValues.feminine
      : categoryGender(data.gender);
  const candidates = [];

  function add(name, suggestion = participantGenderValues.unknown, source = "unknown") {
    if (isAutomaticParticipantName(name)) return;
    const formattedName = formatParticipantName(name);
    const key = getParticipantGenderKey(formattedName);
    const explicit = explicitRegistry[key];
    const normalizedSuggestion = normalizeParticipantGender(suggestion);
    const suggestedGender = normalizedSuggestion !== participantGenderValues.unknown
      ? normalizedSuggestion
      : suggestedNameGender(formattedName);
    candidates.push({
      key,
      name: formattedName,
      gender: explicit?.gender || participantGenderValues.unknown,
      confirmed: Boolean(explicit?.confirmed),
      suggestion: explicit?.gender && explicit.confirmed
        ? explicit.gender
        : (category !== participantGenderValues.unknown ? category : suggestedGender),
      source: explicit?.confirmed ? "confirmed" : source,
      tournamentId: tournament?.id,
      tournamentName: tournament?.name || data.eventName || "Torneio",
    });
  }

  if (isMixedType(config)) {
    (data.players?.men || []).forEach((name) => add(name, participantGenderValues.masculine, "format"));
    (data.players?.women || []).forEach((name) => add(name, participantGenderValues.feminine, "format"));
    return candidates;
  }

  if ((config?.type === "fixed12" || config?.type === "fixed16" || isCupType(config)) && !isIndividualCupType(config)) {
    (data.players?.teams || []).forEach((team) => {
      add(team?.a, category, category !== participantGenderValues.unknown ? "category" : "position");
      add(team?.b, category, category !== participantGenderValues.unknown ? "category" : "position");
    });
    return candidates;
  }

  const names = isIndividualCupType(config)
    ? (data.players?.teams || []).map((participant) => participant?.a)
    : (Array.isArray(data.players) ? data.players : []);
  names.forEach((name) => add(name, category, category !== participantGenderValues.unknown ? "category" : "name"));
  return candidates;
}

export function mergeTournamentGenderCandidates(tournaments = [], modalityConfigs = {}) {
  const byKey = new Map();
  tournaments.forEach((tournament) => {
    const config = modalityConfigs[tournament?.type];
    if (!config || tournament?.data?.deletedAt) return;
    collectTournamentGenderCandidates(tournament, config).forEach((candidate) => {
      const current = byKey.get(candidate.key);
      if (!current) {
        byKey.set(candidate.key, { ...candidate, tournaments: [candidate.tournamentName] });
        return;
      }
      const suggestions = new Set([current.suggestion, candidate.suggestion].filter((value) => value && value !== participantGenderValues.unknown));
      byKey.set(candidate.key, {
        ...current,
        name: current.name || candidate.name,
        gender: current.confirmed ? current.gender : candidate.confirmed ? candidate.gender : current.gender,
        confirmed: current.confirmed || candidate.confirmed,
        suggestion: suggestions.size === 1 ? [...suggestions][0] : participantGenderValues.unknown,
        source: current.confirmed ? current.source : candidate.confirmed ? candidate.source : suggestions.size === 1 ? current.source : "conflict",
        tournaments: [...new Set([...(current.tournaments || []), candidate.tournamentName])],
      });
    });
  });
  return [...byKey.values()].sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

export function resolveTournamentParticipantGender({ tournament, settings, name, fallbackGender = participantGenderValues.unknown }) {
  const circuitRegistry = settings?.genderRegistry;
  const tournamentRegistry = tournament?.data?.participantGenders;
  const explicit = getParticipantGender(
    mergeParticipantGenderRegistries(circuitRegistry, tournamentRegistry),
    name,
    { confirmedOnly: true }
  );
  if (explicit !== participantGenderValues.unknown) return explicit;

  const tournamentGenderMode = inferTournamentGenderMode(tournament?.data);
  const category = tournamentGenderMode === tournamentGenderModes.masculine
    ? participantGenderValues.masculine
    : tournamentGenderMode === tournamentGenderModes.feminine
      ? participantGenderValues.feminine
      : categoryGender(tournament?.data?.gender);
  if (category !== participantGenderValues.unknown) return category;
  return normalizeParticipantGender(fallbackGender);
}
