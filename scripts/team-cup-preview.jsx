// Local fixture only. Never imports the production client or contacts Supabase.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createOrganizerWorkspace } from "../src/OrganizerWorkspace.jsx";
import PublicTournamentScreen from "../src/features/publicArena/PublicTournamentScreen.jsx";
import { createInitialData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createTeamCupData, generateTeamCupGroups } from "../src/domain/teamCup.mjs";
import "../src/style.css";
const query = new URLSearchParams(location.search);
const kind = query.get("kind") || "trio";
const fixtureKey = "team-cup-local-fixture-" + kind + (query.has("setup") ? "-setup" : "");
function initial() {
  const base = createInitialData("Times/Equipes", modalityConfig["Times/Equipes"]);
  const data = createTeamCupData({ ...base, winningScore: 6 }, 6, kind);
  if (query.has("setup")) return data;
  const names = ["Cristiano", "Danilo", "Cristian", "Layner", "Nicolas", "Guilherme", "Maria", "Ana", "Júlia", "Fernanda", "Beatriz", "Carolina"];
  data.players.teams.forEach((t, i) => t.athletes.forEach((a, j) => a.name = names[(i * 3 + j) % names.length] + " " + (i + 1) + (j + 1)));
  return generateTeamCupGroups(data, () => .4);
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
    <a href="?kind=trio">Trio</a><a href="?kind=squad">Squad</a><a href="?setup=1">Cadastro vazio</a><a href="?kind=squad&setup=1">Cadastro Squad</a><a href={"?public=1&kind=" + kind}>Visão pública</a><span role="status">Salvamentos locais: {saves}</span></aside>
    {query.has("public") ? <PublicTournamentScreen tournament={record} runtime={{}} />
      : <TournamentScreen tournament={record} userId="fixture-user" onBack={() => {}} onSave={save} centralCourtNumbers={["1", "2", "3", "4", "5", "6"]} />}
  </>;
}
const root = createRoot(document.getElementById("root"));
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
