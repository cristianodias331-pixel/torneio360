// Local fixture only. Never imports the production client or contacts Supabase.
import "../src/style.css";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createOrganizerWorkspace } from "../src/OrganizerWorkspace.jsx";
import PublicTournamentScreen from "../src/features/publicArena/PublicTournamentScreen.jsx";
import { createInitialData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createTeamCupData, generateTeamCupGroups, generateTeamCupBrackets, updateTeamCupLeg, teamCupQualified, TEAM_COUNTS, TEAM_LEVELS, drawTeamCaptains, drawTeamMembers } from "../src/domain/teamCup.mjs";
import { recordTeamCupCaptainDraw, recordTeamCupMemberDraw, recordTeamCupGroupVideo, getTeamCupVideoSnapshot, teamCupVideoScenes } from "../src/domain/teamCupVideo.mjs";
import { drawTeamCupVideoFrame } from "../src/features/teamCup/teamCupVideoExport.mjs";
import { loadShareImage, TORNEIO360_LOGO } from "../src/features/media/canvasTools.mjs";
import { inferTournamentGenderMode } from "../src/domain/participantGenderRegistry.mjs";
import { getStoredTournamentGenderFields } from "../src/domain/tournamentGenderConfig.mjs";
const query = new URLSearchParams(location.search);
const kind = query.get("kind") || "trio";
const count = TEAM_COUNTS.includes(Number(query.get("count"))) ? Number(query.get("count")) : query.has("participants") ? 9 : 6;
const fixtureKey = "team-cup-visual-fixture-" + kind + (query.has("participants") ? "-participants-v2" : query.has("setup") ? "-setup" : query.has("finals") ? "-finals" : "") + (query.has("empty") ? "-empty" : "") + (query.has("videos") ? "-videos-v1" : "") + (query.has("podium") ? "-podium-v1" : "") + (query.has("focus") ? "-focus-test" : "") + (query.has("count") ? `-${count}-teams` : "");
function initial() {
  const base = createInitialData("Times/Equipes", modalityConfig["Times/Equipes"]);
  const data = createTeamCupData({ ...base, winningScore: query.get("games") === "4" ? 4 : 6,
    ...(query.has("composition") ? { participantGenderMode: query.get("composition") } : {}) }, count, kind);
  if (query.has("setup") || query.has("empty")) return data;
  const names = ["Cristiano", "Danilo", "Cristian", "Layner", "Nicolas", "Guilherme", "Maria", "Ana", "Júlia", "Fernanda", "Beatriz", "Carolina"];
  data.players.teams.forEach((t, i) => t.athletes.forEach((a, j) => a.name = names[(i * 3 + j) % names.length] + " " + (i + 1) + (j + 1)));
  if (query.has("video-frames")) data.players.teams.forEach((t, i) => t.athletes.forEach((a, j) => {
    a.level = TEAM_LEVELS[(i + j) % TEAM_LEVELS.length];
    if (query.has("long-names")) a.name = "W".repeat(98) + String.fromCharCode(65 + i, 65 + j);
  }));
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
function VideoFramePreview({ data, tournament }) {
  const canvas = useRef(null);
  const [kind, setKind] = useState("teams"), [page, setPage] = useState(0), [count, setCount] = useState(1);
  useEffect(() => {
    let cancelled = false;
    async function render() {
      await document.fonts?.ready;
      const logo = await loadShareImage(TORNEIO360_LOGO);
      if (cancelled) return;
      const snapshot = getTeamCupVideoSnapshot(data, tournament, kind), ctx = canvas.current.getContext("2d");
      const scenes = teamCupVideoScenes(snapshot, { measure: (text, font) => { ctx.font = font; return ctx.measureText(text).width; } });
      const frames = scenes.filter(s => s.type === (kind === "teams" ? "teams" : "groups"));
      setCount(frames.length);
      const scene = frames[Math.min(page, frames.length - 1)];
      drawTeamCupVideoFrame(ctx, snapshot, scene, 0, { logo }, scenes.indexOf(scene), scenes.length);
    }
    render();
    return () => { cancelled = true; };
  }, [data, tournament, kind, page]);
  return <main style={{ padding: 16, background: "#102137", color: "white" }}><h1>Quadros reais do vídeo · teste local</h1>
    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}><button onClick={() => { setKind("teams"); setPage(0); }}>Vídeo dos times</button><button onClick={() => { setKind("groups"); setPage(0); }}>Vídeo dos grupos</button>
      <button disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><button disabled={page >= count - 1} onClick={() => setPage(page + 1)}>Próxima</button><span>{page + 1}/{count}</span></div>
    <canvas ref={canvas} width={720} height={1280} style={{ display: "block", width: 360, maxWidth: "100%" }} aria-label="Quadro do vídeo" />
  </main>;
}
function Preview() {
  const [record, setRecord] = useState(() => ({ id: fixtureKey, type: "Times/Equipes", name: "Copa Times/Equipes · teste local",
    user_id: "fixture-user", revision: 1, updated_at: "2026-09-09T12:00:00Z", data: (!query.has("focus") && JSON.parse(localStorage.getItem(fixtureKey) || "null")) || initial() }));
  const [theme, setTheme] = useState("dark");
  const [saves, setSaves] = useState(0);
  if (query.has("video-frames")) return <VideoFramePreview data={record.data} tournament={record} />;
  async function save(payload) {
    const tournament = { ...record, data: payload.data, last_change_id: payload.changeId, revision: (record.revision || 1) + 1, updated_at: new Date().toISOString() };
    if (!query.has("focus")) localStorage.setItem(fixtureKey, JSON.stringify(tournament.data));
    setRecord(tournament); setSaves(n => n + 1);
    return { ok: true, tournament, savedData: tournament.data };
  }
  return <><aside style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 12 }}><strong>PRÉVIA LOCAL · sem banco de dados</strong>
    <button onClick={() => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); document.documentElement.dataset.theme = next; }}>Alternar tema</button>
    <label style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>Composição da prévia
      <select aria-label="Composição da prévia" value={inferTournamentGenderMode(record.data)} onChange={event => save({ data: { ...record.data, ...getStoredTournamentGenderFields(record.type, event.target.value) } })}>
        <option value="">Não definida</option><option value="outro">Outra</option><option value="livre">Livre</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option><option value="mista">Mista</option>
      </select>
    </label>
    <a href="?participants=1">Participantes Trio</a><a href="?participants=1&kind=squad">Participantes Squad</a><a href="?participants=1&empty=1">Testar Colar lista</a><a href="?kind=trio">Trio</a><a href="?kind=squad">Squad</a><a href="?setup=1">Cadastro vazio</a><a href="?kind=squad&setup=1">Cadastro Squad</a><a href={"?finals=1&kind=" + kind}>Chaves prontas</a><a href={"?public=1&kind=" + kind}>Visão pública</a><span role="status">Salvamentos locais: {saves}</span></aside>
    {query.has("public") ? <PublicTournamentScreen tournament={record} runtime={{}} />
      : <div className={`proDashboard playAppShell theme-${theme}`}><main className="playMain"><div className="tournamentWorkspaceContent"><TournamentScreen tournament={record} userId="fixture-user" onBack={() => {}} onSave={save} onOpenCourtCenter={() => alert("Central de Quadras · prévia local")} centralCourtNumbers={["1", "2", "3", "4", "5", "6"]} /></div></main></div>}
  </>;
}
const root = createRoot(document.getElementById("root"));
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
