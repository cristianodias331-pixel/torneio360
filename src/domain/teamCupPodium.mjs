import { getGameWinnerId, getGameLoserId } from "./bracketProgression.mjs";
import { getMatchElapsedSeconds } from "./matchTimer.mjs";
import { resolveTeamCupGame, teamName, teamLegWinner } from "./teamCup.mjs";

// Same cup podium rule: final decides champion/runner-up; third-place match
// decides bronze. Use series winners, never the sum of games, for placements.
export function teamCupPodium(data, phase = "main") {
  if (phase === "repechage" && !data.cupConfig.repechageEnabled) return [];
  const final = data.brackets.find(g => g.phase === phase && g.roundName === "Final");
  if (!final) return [];
  const resolved = resolveTeamCupGame(data, final);
  const champion = getGameWinnerId(resolved, data), runner = getGameLoserId(resolved, data);
  if (champion == null || runner == null) return [];
  const times = new Map();
  for (const stored of [...data.schedule.flat(), ...data.brackets]) {
    if (stored.phase === "repechage" && !data.cupConfig.repechageEnabled) continue;
    const game = resolveTeamCupGame(data, stored);
    const seconds = (game.teamCupLegs || []).reduce((sum, leg) => sum + (teamLegWinner(leg, data.winningScore) ? getMatchElapsedSeconds(leg) : 0), 0);
    for (const id of [...game.ids1, ...game.ids2]) times.set(id, (times.get(id) || 0) + seconds);
  }
  const entry = (id, position) => {
    const team = data.players.teams[id];
    return { id, position, name: teamName(team), playTimeSeconds: times.get(id) || 0,
      participants: team.athletes.map(athlete => athlete.name + (athlete.id === team.captainId ? " (C)" : "")) };
  };
  const podium = [entry(champion, "🏆 Campeão"), entry(runner, "🥈 Vice")];
  const third = data.brackets.find(g => g.phase === phase && g.roundName === "3º lugar");
  const bronze = third ? getGameWinnerId(resolveTeamCupGame(data, third), data) : null;
  if (bronze != null) podium.push(entry(bronze, "🥉 3º lugar"));
  return podium;
}
