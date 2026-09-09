import { createCearenseGroups } from "./cupGroups.mjs";
import { teamName, validateTeamCupTeams } from "./teamCup.mjs";

const receipt = () => ({ id: `T360-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`, createdAt: new Date().toISOString() });
const roster = data => data.players.teams.map(team => ({ id: team.id, name: teamName(team), captainId: team.captainId,
  athletes: team.athletes.map(a => ({ id: a.id, name: a.name, gender: a.gender, level: a.level })) }));
const signature = teams => JSON.stringify([...teams].sort((a, b) => a.id.localeCompare(b.id)));

export function recordTeamCupCaptainDraw(data) {
  if (data.teamCup.drawStage !== "captains") throw new Error("Sorteie primeiro os capitães.");
  const drawVideo = { ...receipt(), version: 1, mode: data.teamCup.balanced ? "balanced" : "random", captains: roster(data) };
  return { ...data, teamCup: { ...data.teamCup, drawVideo } };
}
export function recordTeamCupMemberDraw(data) {
  validateTeamCupTeams(data);
  const record = data.teamCup.drawVideo;
  if (data.teamCup.drawStage !== "complete" || !record?.captains) return data;
  const teams = roster(data);
  if (teams.some(t => !record.captains.some(c => c.id === t.id && c.captainId === t.captainId))) throw new Error("Os capitães mudaram entre os sorteios. Confira a formação.");
  return { ...data, teamCup: { ...data.teamCup, drawVideo: { ...record, captains: record.captains.map(c => ({ ...c, name: teams.find(t => t.id === c.id).name })), teams, completedAt: new Date().toISOString() } } };
}
function groupRoster(data) {
  validateTeamCupTeams(data);
  const teams = roster(data), ids = data.teamCup.groupOrder;
  const order = ids || teams.map(t => t.id);
  if (order.length !== teams.length || new Set(order).size !== teams.length || order.some(id => !teams.some(t => t.id === id))) throw new Error("Revise a formação dos grupos.");
  return createCearenseGroups(teams.length).map(g => ({ title: g.name, teams: g.teamIds.map(i => teams.find(t => t.id === order[i])) }));
}
export function recordTeamCupGroupVideo(data, mode = data.teamCup.groupMode || "manual") {
  const groups = groupRoster(data);
  const previous = data.teamCup.groupVideo;
  const groupVideo = previous?.mode === mode && JSON.stringify(previous.groups) === JSON.stringify(groups)
    ? previous : { ...receipt(), version: 1, mode, groups };
  return { ...data, teamCup: { ...data.teamCup, groupVideo } };
}
export function getTeamCupVideoSnapshot(data, tournament, kind) {
  const base = { tournamentName: tournament?.name || "Times/Equipes", modalityName: `Times/Equipes · ${data.teamCup.kind === "squad" ? "Squad" : "Trio"}` };
  if (kind === "teams") {
    const record = data.teamCup.drawVideo;
    if (data.teamCup.formation !== "random" || data.teamCup.drawStage !== "complete" || !record?.teams) throw new Error("Conclua o sorteio dos capitães e dos integrantes para gerar o vídeo único dos times.");
    if (signature(record.teams) !== signature(roster(data))) throw new Error("A formação foi editada depois do sorteio. O vídeo anterior não representa mais os times atuais.");
    return structuredClone({ ...base, ...record, kind: "team-cup-teams", headerLabel: "SORTEIO DOS TIMES" });
  }
  if (!data.teamCup.groupOrder && !data.schedule?.length) throw new Error("Salve a formação dos grupos antes de gerar o vídeo.");
  const groups = groupRoster(data), saved = data.teamCup.groupVideo;
  const record = saved && JSON.stringify(saved.groups) === JSON.stringify(groups) ? saved : { ...receipt(), mode: "manual", groups };
  return structuredClone({ ...base, ...record, kind: "team-cup-groups", headerLabel: record.mode === "random" ? "SORTEIO DOS GRUPOS" : "FORMAÇÃO DOS GRUPOS" });
}

export function teamCupVideoScenes(snapshot) {
  const scenes = [{ type: "intro", duration: 1200, title: snapshot.headerLabel }];
  const pages = (items, size, type, duration) => {
    for (let i = 0; i < items.length; i += size) scenes.push({ type, duration, items: items.slice(i, i + size) });
  };
  if (snapshot.kind === "team-cup-teams") {
    scenes.push({ type: "motion", duration: 5000, title: "SORTEIO DOS CAPITÃES", names: snapshot.captains.map(t => t.athletes[0].name) });
    pages(snapshot.captains, 4, "captains", 3500);
    scenes.push({ type: "motion", duration: 5000, title: "SORTEIO DOS INTEGRANTES", names: snapshot.teams.flatMap(t => t.athletes.filter(a => a.id !== t.captainId).map(a => a.name)) });
    pages(snapshot.teams, 2, "teams", 5000);
  } else {
    // A manual/level-based arrangement is never presented as a random draw.
    if (snapshot.mode === "random") scenes.push({ type: "motion", duration: 5000, title: "SORTEIO DOS GRUPOS", names: snapshot.groups.flatMap(g => g.teams.map(t => t.name)) });
    pages(snapshot.groups, 1, "groups", 5500);
  }
  return scenes;
}
