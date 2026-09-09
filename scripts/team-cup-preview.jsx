// Local fixture only. Never imports the production client or contacts Supabase.
import "../src/style.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createOrganizerWorkspace } from "../src/OrganizerWorkspace.jsx";
import PublicTournamentScreen from "../src/features/publicArena/PublicTournamentScreen.jsx";
import { createInitialData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createTeamCupData, generateTeamCupGroups, generateTeamCupBrackets, updateTeamCupLeg, teamCupQualified, TEAM_LEVELS, drawTeamCaptains, drawTeamMembers } from "../src/domain/teamCup.mjs";
import { recordTeamCupCaptainDraw, recordTeamCupMemberDraw, recordTeamCupGroupVideo } from "../src/domain/teamCupVideo.mjs";
const query = new URLSearchParams(location.search);
const kind = query.get("kind") || "trio";
const fixtureKey = "team-cup-visual-fixture-" + kind + (query.has("participants") ? "-participants-v2" : query.has("setup") ? "-setup" : query.has("finals") ? "-finals" : "") + (query.has("empty") ? "-empty" : "") + (query.has("videos") ? "-videos-v1" : "") + (query.has("podium") ? "-podium-v1" : "");
function initial() {
  const base = createInitialData("Times/Equipes", modalityConfig["Times/Equipes"]);
  const data = createTeamCupData({ ...base, winningScore: 6 }, query.has("participants") ? 9 : 6, kind);
  if (query.has("setup") || query.has("empty")) return data;
  const names = ["Cristiano", "Danilo", "Cristian", "Layner", "Nicolas", "Guilherme", "Maria", "Ana", "Júlia", "Fernanda", "Beatriz", "Carolina"];
  data.players.teams.forEach((t, i) => t.athletes.forEach((a, j) => a.name = names[(i * 3 + j) % names.length] + " " + (i + 1) + (j + 1)));
  if (query.has("videos")) {
    data.teamCup.formation = "random";
    data.teamCup.pool = structuredClone(data.players.teams.flatMap(t => t.athletes));
    const drawn = recordTeamCupMemberDraw(drawTeamMembers(recordTeamCupCaptainDraw(drawTeamCaptains(data))));
    return recordTeamCupGroupVideo(generateTeamCupGroups(drawn), "random");
  }
  if (query.has("participants")) {
    data.players.teams.forEach((team, i) => team.athletes.forEach((a, j) => {
      const examples = a.gender === "H" ? names.slice(0, 6) : names.slice(6);
      a.name = examples[(i + j) % examples.length] + " " + (i + 1) + (j + 1);
      a.level = TEAM_LEVELS[(i + j) % TEAM_LEVELS.length];
    }));
    return data;
  }
  let fixture = generateTeamCupGroups(data, () => .4);
  if (query.has("finals") || query.has("podium")) {
    fixture.cupConfig.repechageEnabled = true;
    for (const game of fixture.schedule.flat()) {
      const firstWins = game.ids1[0] < game.ids2[0];
      for (let leg = 0; leg < 2; leg++) fixture = updateTeamCupLeg(fixture, game.matchKey, leg, { s1: firstWins ? "6" : "2", s2: firstWins ? "2" : "6" });
    }
    for (const tie of teamCupQualified(fixture).unresolvedCampaignTies) fixture.cupConfig.campaignTieBreakOverrides[tie.tieKey] = tie.teamIds;
    fixture = generateTeamCupBrackets(fixture);
    if (query.has("podium")) for (const game of fixture.brackets) if (!game.isBye) {
      for (let leg = 0; leg < 2; leg++) fixture = updateTeamCupLeg(fixture, game.matchKey, leg, { s1: "6", s2: "3" });
    }
  }
  return fixture;
}
const mockSupabase = { from: () => ({ upsert: async () => ({ error: null }) }) };
const { TournamentScreen } = createOrganizerWorkspace({ supabase: mockSupabase });
function Preview() {
  const [record, setRecord] = useState(() => ({ id: fixtureKey, type: "Times/Equipes", name: "Copa Times/Equipes · teste local",
    user_id: "fixture-user", revision: 1, updated_at: "2026-09-09T12:00:00Z", data: JSON.parse(localStorage.getItem(fixtureKey) || "null") || initial() }));
  const [theme, setTheme] = useState("dark");
  const [saves, setSaves] = useState(0);
  async function save(payload) {
    const tournament = { ...record, data: payload.data, last_change_id: payload.changeId, revision: (record.revision || 1) + 1, updated_at: new Date().toISOString() };
    localStorage.setItem(fixtureKey, JSON.stringify(tournament.data));
    setRecord(tournament); setSaves(n => n + 1);
    return { ok: true, tournament, savedData: tournament.data };
  }
  return <><aside style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 12 }}><strong>PRÉVIA LOCAL · sem banco de dados</strong>
    <button onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); document.documentElement.dataset.theme = next; }}>Alternar tema</button>
    <a href="?participants=1">Participantes Trio</a><a href="?participants=1&kind=squad">Participantes Squad</a><a href="?participants=1&empty=1">Testar Colar lista</a><a href="?kind=trio">Trio</a><a href="?kind=squad">Squad</a><a href="?setup=1">Cadastro vazio</a><a href="?kind=squad&setup=1">Cadastro Squad</a><a href={"?finals=1&kind=" + kind}>Chaves prontas</a><a href={"?public=1&kind=" + kind}>Visão pública</a><span role="status">Salvamentos locais: {saves}</span></aside>
    {query.has("public") ? <PublicTournamentScreen tournament={record} runtime={{}} />
      : <div className={`proDashboard playAppShell theme-${theme}`}><main className="playMain"><div className="tournamentWorkspaceContent"><TournamentScreen tournament={record} userId="fixture-user" onBack={() => {}} onSave={save} onOpenCourtCenter={() => alert("Central de Quadras · prévia local")} centralCourtNumbers={["1", "2", "3", "4", "5", "6"]} /></div></main></div>}
  </>;
}
const root = createRoot(document.getElementById("root"));
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
