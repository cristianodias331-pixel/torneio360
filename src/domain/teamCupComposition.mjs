import { inferTournamentGenderMode, tournamentGenderModes } from "./participantGenderRegistry.mjs";

export const teamCupIsMixed = data => inferTournamentGenderMode(data) === tournamentGenderModes.mixed;
export function teamCupFixedGender(data) {
  const mode = inferTournamentGenderMode(data);
  return mode === tournamentGenderModes.masculine ? "H" : mode === tournamentGenderModes.feminine ? "M" : "";
}
export const teamCupTrioComposition = data => data.teamCup?.trioComposition === "1H2M" ? "1H2M" : "2H1M";
export function teamCupGenderQuota(data) {
  const size = data.teamCup?.kind === "squad" ? 4 : 3, fixed = teamCupFixedGender(data);
  if (fixed) return { H: fixed === "H" ? size : 0, M: fixed === "M" ? size : 0 };
  // Preserve the established Squad rules for older/open competitions too.
  if (size === 4) return { H: 2, M: 2 };
  if (teamCupIsMixed(data)) return teamCupTrioComposition(data) === "1H2M" ? { H: 1, M: 2 } : { H: 2, M: 1 };
  return null;
}
export const teamCupMixedSquad = data => data.teamCup?.kind === "squad" && !teamCupFixedGender(data);
export function teamCupCompositionLabel(data) {
  const fixed = teamCupFixedGender(data), quota = teamCupGenderQuota(data);
  if (fixed) return fixed === "H" ? "Masculino" : "Feminino";
  if (!quota) return "composição livre";
  return `${quota.H} ${quota.H === 1 ? "homem" : "homens"} e ${quota.M} ${quota.M === 1 ? "mulher" : "mulheres"}`;
}

// Inherit only inside this tournament, never in global athlete profiles.
// Mixed composition changes initialize vacancies, preserving named athletes.
export function applyTeamCupComposition(data) {
  const fixed = teamCupFixedGender(data), quota = teamCupGenderQuota(data);
  const key = `${inferTournamentGenderMode(data)}:${data.teamCup.kind}:${teamCupTrioComposition(data)}`;
  const initialize = data.teamCup.compositionDefaultsKey !== key;
  if (!fixed && !initialize) return data;
  const genders = new Map();
  const teams = data.players.teams.map(team => {
    const remaining = quota && { ...quota };
    if (remaining) for (const a of team.athletes) if (String(a.name || "").trim() && a.gender in remaining) remaining[a.gender]--;
    const athletes = team.athletes.map(a => {
      let gender = fixed || a.gender;
      if (!fixed && initialize && quota && !String(a.name || "").trim()) {
        gender = remaining.H > 0 ? "H" : remaining.M > 0 ? "M" : a.gender;
        if (gender in remaining) remaining[gender]--;
      }
      genders.set(a.id, gender);
      return gender === a.gender ? a : { ...a, gender };
    });
    return { ...team, athletes };
  });
  return { ...data, players: { ...data.players, teams }, teamCup: { ...data.teamCup, compositionDefaultsKey: key,
    pool: (data.teamCup.pool || []).map(a => ({ ...a, gender: fixed || (String(a.name || "").trim() ? a.gender : genders.get(a.id)) || a.gender })) } };
}

export function setTeamCupTrioComposition(data, composition) {
  if (!teamCupIsMixed(data) || data.teamCup.kind !== "trio" || !["2H1M", "1H2M"].includes(composition)) {
    throw new Error("Escolha uma composição válida para o trio misto.");
  }
  return applyTeamCupComposition({ ...data, teamCup: { ...data.teamCup, trioComposition: composition } });
}
