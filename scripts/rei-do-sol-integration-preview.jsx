import '../src/style.css';
import '../src/styles/41-responsive-public-covers.css';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReiDoSolWorkspace from '../src/features/reiDoSol/ReiDoSolWorkspace.jsx';
import TeamCupWorkspace from '../src/features/teamCup/TeamCupWorkspace.jsx';
import PublicTournamentScreen from '../src/features/publicArena/PublicTournamentScreen.jsx';
import { createInitialData } from '../src/domain/tournamentDataNormalization.mjs';
import { modalityConfig } from '../src/domain/modalityConfig.mjs';
import { applyReiDoSolState } from '../src/domain/reiDoSolData.mjs';
import { makeExample } from '../src/domain/reiDoSol.mjs';
import { createTeamCupData, generateTeamCupGroups, generateTeamCupBrackets, teamCupQualified, updateTeamCupLeg } from '../src/domain/teamCup.mjs';
import { createTournamentOperations } from '../src/domain/tournamentOperations.mjs';
const params = new URLSearchParams(location.search);
const type = params.get('type') === 'teamCup' ? 'Times/Equipes' : 'Rei do Sol';
const publicView = params.has('public');
// Match a fresh public route (41 is loaded by its controllers in production).
// Organizer density/navigation styles must not mask spectator-only regressions.
if (!publicView) {
  await import('../src/styles/30-organizer-event-management.css');
  await import('../src/styles/40-organizer-data-and-navigation.css');
  await import('../src/styles/42-workspace-density-and-courts.css');
}
const theme = publicView ? 'light' : params.get('theme') === 'light' ? 'light' : 'dark';
const scenario = params.get('scenario') || 'empty';
const kind = params.get('kind') === 'squad' ? 'squad' : 'trio';
const initial = createInitialData(type, modalityConfig[type]);
function makeFixture() {
  if (type === 'Rei do Sol') {
    if (scenario === 'empty') return initial;
    const count = Math.min(64, Math.max(16, Number(params.get('count')) || 20));
    const state = makeExample(count, 4, scenario === 'qualifying' ? 'finals' : scenario);
    if (scenario === 'qualifying') state.finals = [];
    return applyReiDoSolState(initial, state);
  }
  let data = createTeamCupData(initial, 6, kind);
  if (scenario === 'empty') return data;
  data.players.teams.forEach((team, i) => team.athletes.forEach((athlete, j) => { athlete.name = `Participante ${i + 1} ${j + 1}`; }));
  data = generateTeamCupGroups(data, () => .4);
  if (scenario === 'progress') return data;
  data.cupConfig.repechageEnabled = true;
  for (const game of data.schedule.flat()) for (let leg = 0; leg < 2; leg++) {
    const firstWins = game.ids1[0] < game.ids2[0];
    data = updateTeamCupLeg(data, game.matchKey, leg, { s1: firstWins ? '4' : '1', s2: firstWins ? '1' : '4' });
  }
  for (const tie of teamCupQualified(data).unresolvedCampaignTies) data.cupConfig.campaignTieBreakOverrides[tie.tieKey] = tie.teamIds;
  if (scenario === 'qualifying') return data;
  data = generateTeamCupBrackets(data);
  if (scenario === 'finished') for (const game of data.brackets) if (!game.isBye) {
    for (let leg = 0; leg < 2; leg++) data = updateTeamCupLeg(data, game.matchKey, leg, { s1: '4', s2: '2' });
  }
  return data;
}
const fixture = { ...makeFixture(), coverImageUrl: '/torneio360-profile.png',
  eventStartTime: '18:00', eventDate: '2026-09-11', location: 'Arena de teste', registrationDeadline: '2026-09-10',
  publicInfo: { visibility: { showArenaName: true, showOrganizerName: true, showInstagram: true, showCityState: true },
    organizer: { arenaName: 'Torneio 360', organizerName: 'Organizador de demonstração', photoUrl: '/torneio360-profile.png', instagramHandle: 'torneio360', city: 'Fortaleza', state: 'CE' } } };
const runtime = { getTournamentTimingSummary: createTournamentOperations().getTournamentTimingSummary, tagline: 'Gestão inteligente de torneios' };
document.documentElement.dataset.theme = theme;
document.title = `${type}${type === 'Times/Equipes' ? ` · ${kind === 'squad' ? 'Squad' : 'Trio'}` : ''} · Prévia local`;
function previewLink(patch) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) next.delete(key);
    else next.set(key, value);
  }
  return `?${next.toString()}`;
}
function IntegrationPreview() {
  const [data, update] = useState(fixture);
  const current = useRef(data);
  const setData = (value) => { const next = typeof value === 'function' ? value(current.current) : value; current.current = next; update(next); };
  const tournament = { id: `public-shell-preview-${type}-${kind}-${scenario}`, name: `${type} · teste da integração`, type, data };
  const Workspace = type === 'Rei do Sol' ? ReiDoSolWorkspace : TeamCupWorkspace;
  return <>
    <aside role="note" style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
      <strong>Teste local · dados em memória, sem nuvem</strong>
      <a href={previewLink({ type: 'reiDoSol', kind: null })}>Rei do Sol</a>
      <a href={previewLink({ type: 'teamCup', kind: 'trio' })}>Trio</a>
      <a href={previewLink({ type: 'teamCup', kind: 'squad' })}>Squad</a>
      <a href={previewLink({ public: publicView ? null : '1' })}>{publicView ? 'Visão do organizador' : 'Visão pública'}</a>
      {!publicView && <a href={previewLink({ theme: theme === 'dark' ? 'light' : 'dark' })}>Alternar tema</a>}
    </aside>
    {publicView ? <PublicTournamentScreen tournament={tournament} organizer={{ arenaName: 'Torneio 360' }} onBackToArena={() => alert('Retorno ao perfil da organização · apenas teste local')} runtime={runtime} />
      : <div className={`proDashboard playAppShell theme-${theme}`}><main className="playMain"><div className="tournamentWorkspaceContent">
        <Workspace data={data} setData={setData} tournament={tournament} savingBadge={<span>Somente teste local</span>} />
      </div></main></div>}
  </>;
}
const root = createRoot(document.getElementById('root'));
root.render(<IntegrationPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
