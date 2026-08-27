import { getTeamName } from "./cupGroups.mjs";
import {
  isCupType,
  isFixedTeamType,
  isIndividualCupType,
  isMixedType,
} from "./modalityClassification.mjs";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isAutomaticParticipant(value) {
  const name = normalizeName(value);
  return !name || [
    /^atleta \d+(?: da dupla \d+)?$/,
    /^jogador \d+$/,
    /^participante \d+$/,
    /^homem \d+$/,
    /^mulher \d+$/,
  ].some((pattern) => pattern.test(name));
}

function groupApprovedIdentities(identities) {
  const groups = new Map();
  [...(identities || [])]
    .sort((first, second) => {
      const firstTime = Date.parse(first.registered_at || first.created_at || "") || Number.MAX_SAFE_INTEGER;
      const secondTime = Date.parse(second.registered_at || second.created_at || "") || Number.MAX_SAFE_INTEGER;
      if (firstTime !== secondTime) return firstTime - secondTime;
      if (first.registration_role !== second.registration_role) return first.registration_role === "athlete" ? -1 : 1;
      return String(first.registration_id || "").localeCompare(String(second.registration_id || ""));
    })
    .forEach((identity) => {
      const registrationId = String(identity.registration_id || identity.user_id || "");
      if (!registrationId) return;
      if (!groups.has(registrationId)) groups.set(registrationId, { registrationId, athlete: null, partner: null });
      const group = groups.get(registrationId);
      if (identity.registration_role === "partner") group.partner = identity;
      else group.athlete = identity;
    });
  return [...groups.values()].filter((group) => group.athlete?.display_name);
}

function findNameIndex(values, name) {
  const key = normalizeName(name);
  return (values || []).findIndex((value) => normalizeName(value) === key);
}

function createParticipantLink(group, identity, path, previousName) {
  return {
    registrationId: group.registrationId,
    role: identity.registration_role || (identity === group.partner ? "partner" : "athlete"),
    userId: identity.user_id || "",
    handle: identity.handle || "",
    displayName: identity.display_name || "",
    photoUrl: identity.photo_url || "",
    path,
    previousName: previousName || "",
  };
}

function getLinkedParticipantName(data, path) {
  if (path?.kind === "team") return data.players?.teams?.[path.index]?.[path.field] || "";
  if (path?.kind === "normal") return data.players?.[path.index] || "";
  if (path?.kind === "men" || path?.kind === "women") return data.players?.[path.kind]?.[path.index] || "";
  return "";
}

function getAutomaticName(path) {
  if (path?.kind === "team") return `Atleta ${path.field === "b" ? 2 : 1} da dupla ${path.index + 1}`;
  if (path?.kind === "normal") return `Jogador ${path.index + 1}`;
  if (path?.kind === "men") return `Homem ${path.index + 1}`;
  if (path?.kind === "women") return `Mulher ${path.index + 1}`;
  return "";
}

function restoreLinkedParticipant(data, link) {
  const path = link?.path;
  if (!path || normalizeName(getLinkedParticipantName(data, path)) !== normalizeName(link.displayName)) return false;
  const restoredName = link.previousName || getAutomaticName(path);
  if (path.kind === "team" && data.players?.teams?.[path.index]) data.players.teams[path.index][path.field] = restoredName;
  else if (path.kind === "normal" && Array.isArray(data.players)) data.players[path.index] = restoredName;
  else if ((path.kind === "men" || path.kind === "women") && Array.isArray(data.players?.[path.kind])) data.players[path.kind][path.index] = restoredName;
  else return false;
  return true;
}

function getMatchParticipantNames(players, config, ids = []) {
  if (!Array.isArray(ids) || !ids.length) return [];
  if (isMixedType(config)) {
    const names = [...(players?.men || []), ...(players?.women || [])];
    return ids.map((id) => names[id] || "");
  }
  if (isFixedTeamType(config) || isCupType(config)) {
    return ids.map((id) => getTeamName(players?.teams?.[id]));
  }
  return ids.map((id) => players?.[id] || "");
}

function refreshMatchParticipantNames(value, players, config) {
  if (Array.isArray(value)) return value.map((item) => refreshMatchParticipantNames(item, players, config));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, refreshMatchParticipantNames(item, players, config)]));
  if (Array.isArray(next.ids1) && next.ids1.length) next.team1 = getMatchParticipantNames(players, config, next.ids1);
  if (Array.isArray(next.ids2) && next.ids2.length) next.team2 = getMatchParticipantNames(players, config, next.ids2);
  return next;
}

export function applyApprovedRegistrationsToTournamentData(data, config, identities = []) {
  const groups = groupApprovedIdentities(identities);
  if (!data || !config) return { data, changed: false };

  const next = structuredClone(data);
  const activeKeys = new Set(groups.flatMap((group) => [
    group.athlete ? `${group.registrationId}:${group.athlete.registration_role || "athlete"}` : "",
    group.partner ? `${group.registrationId}:${group.partner.registration_role || "partner"}` : "",
  ]).filter(Boolean));
  const previousLinks = Array.isArray(next.approvedRegistrationParticipants)
    ? [...next.approvedRegistrationParticipants]
    : [];
  const links = previousLinks.filter((link) => activeKeys.has(`${link.registrationId}:${link.role}`));
  const linkedKeys = new Set(links.map((item) => `${item.registrationId}:${item.role}`));
  let changed = links.length !== previousLinks.length;
  previousLinks
    .filter((link) => !activeKeys.has(`${link.registrationId}:${link.role}`))
    .forEach((link) => { changed = restoreLinkedParticipant(next, link) || changed; });

  const linkIdentity = (group, identity, path, previousName) => {
    if (!identity || linkedKeys.has(`${group.registrationId}:${identity.registration_role || "athlete"}`)) return;
    const link = createParticipantLink(group, identity, path, previousName);
    links.push(link);
    linkedKeys.add(`${group.registrationId}:${link.role}`);
    changed = true;
  };

  if ((isFixedTeamType(config) || isCupType(config)) && !isIndividualCupType(config)) {
    const teams = Array.isArray(next.players?.teams) ? next.players.teams : [];
    groups.forEach((group) => {
      const athleteName = group.athlete.display_name;
      const partnerName = group.partner?.display_name || "";
      let teamIndex = teams.findIndex((team) => normalizeName(team?.a) === normalizeName(athleteName));
      if (teamIndex < 0) {
        teamIndex = teams.findIndex((team) => isAutomaticParticipant(team?.a) && (!partnerName || isAutomaticParticipant(team?.b)));
      }
      if (teamIndex < 0) return;
      const previousAthleteName = teams[teamIndex].a;
      if (isAutomaticParticipant(teams[teamIndex].a)) {
        teams[teamIndex].a = athleteName;
        changed = true;
      }
      linkIdentity(group, group.athlete, { kind: "team", index: teamIndex, field: "a" }, previousAthleteName);
      if (group.partner && (isAutomaticParticipant(teams[teamIndex].b) || normalizeName(teams[teamIndex].b) === normalizeName(partnerName))) {
        const previousPartnerName = teams[teamIndex].b;
        if (isAutomaticParticipant(teams[teamIndex].b)) {
          teams[teamIndex].b = partnerName;
          changed = true;
        }
        linkIdentity(group, group.partner, { kind: "team", index: teamIndex, field: "b" }, previousPartnerName);
      }
    });
  } else if (isIndividualCupType(config)) {
    const teams = Array.isArray(next.players?.teams) ? next.players.teams : [];
    groups.forEach((group) => {
      const name = group.athlete.display_name;
      let index = teams.findIndex((participant) => normalizeName(participant?.a) === normalizeName(name));
      if (index < 0) index = teams.findIndex((participant) => isAutomaticParticipant(participant?.a));
      if (index < 0) return;
      const previousName = teams[index].a;
      if (isAutomaticParticipant(teams[index].a)) {
        teams[index].a = name;
        changed = true;
      }
      linkIdentity(group, group.athlete, { kind: "team", index, field: "a" }, previousName);
    });
  } else if (isMixedType(config)) {
    const men = Array.isArray(next.players?.men) ? next.players.men : [];
    const women = Array.isArray(next.players?.women) ? next.players.women : [];
    groups.forEach((group) => {
      const name = group.athlete.display_name;
      let kind = "men";
      let index = findNameIndex(men, name);
      if (index < 0) {
        kind = "women";
        index = findNameIndex(women, name);
      }
      if (index < 0) {
        kind = "men";
        index = men.findIndex(isAutomaticParticipant);
      }
      if (index < 0) {
        kind = "women";
        index = women.findIndex(isAutomaticParticipant);
      }
      if (index < 0) return;
      const values = kind === "men" ? men : women;
      const previousName = values[index];
      if (isAutomaticParticipant(values[index])) {
        values[index] = name;
        changed = true;
      }
      linkIdentity(group, group.athlete, { kind, index }, previousName);
    });
  } else {
    const players = Array.isArray(next.players) ? next.players : [];
    groups.forEach((group) => {
      const name = group.athlete.display_name;
      let index = findNameIndex(players, name);
      if (index < 0) index = players.findIndex(isAutomaticParticipant);
      if (index < 0) return;
      const previousName = players[index];
      if (isAutomaticParticipant(players[index])) {
        players[index] = name;
        changed = true;
      }
      linkIdentity(group, group.athlete, { kind: "normal", index }, previousName);
    });
  }

  if (!changed) return { data, changed: false };
  next.approvedRegistrationParticipants = links;
  const refreshed = refreshMatchParticipantNames(next, next.players, config);
  return { data: refreshed, changed: true };
}
