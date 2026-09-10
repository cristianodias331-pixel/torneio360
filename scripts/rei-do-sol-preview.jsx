// Local preview only: no production tournament, authentication or cloud writes.
import '../src/style.css';
import './rei-do-sol-preview.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Users, Sun, Trophy, Swords, Settings, Moon, Film } from 'lucide-react';
import ScheduleView, { UniversalMatchCard } from '../src/features/matchOperations/MatchSchedule.jsx';
import { CourtAssignmentModal } from '../src/features/matchOperations/MatchControls.jsx';
import { speakGame, speakRound, stopSpeech } from '../src/features/matchOperations/speechAnnouncements.mjs';
import ShuffleVideoModal from '../src/features/media/ShuffleVideoModal.jsx';
import { createShuffleVideoFile, downloadShuffleVideo } from '../src/features/media/shuffleVideoExport.mjs';
import { createReiDoSolDrawVideo } from './rei-do-sol-draw-video.mjs';
import ReiDoSolTieBreakDraw from './ReiDoSolTieBreakDraw.jsx';
import ReiDoSolManualTie from './ReiDoSolManualTie.jsx';
import ParticipantImportModal from '../src/features/participantManagement/ParticipantManagement.jsx';
import { ConfirmRegenerationModal, NoticeModal } from '../src/features/dialogs/ConfirmationDialogs.jsx';
import FormatExplanationButton from '../src/features/tournamentConfig/FormatExplanationButton.jsx';
import { getScoreWinnerSide, normalizeScoreInput } from '../src/domain/scoreRules.mjs';
import { startMatchTimer, stopMatchTimer } from '../src/domain/matchTimer.mjs';
import { getGameCourtNumber, applyCourtNumberToGame } from '../src/domain/courtNumbers.mjs';
import { GROUPS, CRITERIA, COEFFICIENT_HELP, makeExample, withNames, phaseRanking, createFinals, allGames, findGame, shuffle, groupChampion, shuffleParticipants, generateQualifying, importParticipantNames, finalsFollowQualification } from './rei-do-sol-model.mjs';
import ReiDoSolChampions from './ReiDoSolChampions.jsx';
import ReiDoSolParticipants, { ReiDoSolShuffleOverlay } from './ReiDoSolParticipants.jsx';
import ReiDoSolRankingTable from './ReiDoSolRankingTable.jsx';
import { groupColorStyle, applyManualTieOrder } from './rei-do-sol-model.mjs';

const STORAGE = 'torneio360-rei-do-sol-local-preview-v1';
const courts = ['1', '2', '3', '4'];
const scenarios = { finals: 'Fase final zerada', progress: 'Classificatória em andamento', qualifying: 'Classificatória concluída', empty: 'Torneio sem placares', finished: 'Torneio concluído' };
const tabs = [['organization', 'Organização', Settings], ['qualifying', 'Classificatória', Swords], ['finals', 'Fase final', Sun], ['ranking', 'Ranking', Trophy]];
function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (saved?.version === 1 && Array.isArray(saved.players) && saved.players.length >= 16 && Array.isArray(saved.qualifying) && Array.isArray(saved.finals)) return saved;
  } catch { /* The sample also works without browser storage. */ }
  return makeExample();
}

function Preview() {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState('finals');
  const [theme, setTheme] = useState('dark');
  const [count, setCount] = useState(String(state.players.length));
  const [target, setTarget] = useState(state.target);
  const [scenario, setScenario] = useState('finals');
  const [repeat, setRepeat] = useState(1);
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [draw, setDraw] = useState(null);
  const [manualTie, setManualTie] = useState(null);
  const [editor, setEditor] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importBackup, setImportBackup] = useState(null);
  const [shuffleResult, setShuffleResult] = useState(null);
  const [videoSnapshot, setVideoSnapshot] = useState(null);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); setSaved(true); }
    catch { setSaved(false); }
  }, [state]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => () => stopSpeech(), []);
  const config = { 'Rei do Sol': { type: 'reiDoSol', total: state.players.length, label: 'Atleta' } };
  const qualification = phaseRanking(state.players, state.qualifying, state.target, state.draws.qualifying);
  const finalsCurrent = finalsFollowQualification(state.finals, qualification);
  const finalRankings = state.finals.map(group => ({ group: { ...group, ...GROUPS.find(item => item.id === group.id) }, ranking: phaseRanking(state.players, group.schedule, state.target, state.draws[group.id], group.ids) }));
  const tell = message => setNotice({ type: 'info', title: 'Prévia do Rei do Sol', message });
  const confirm = (title, message, impacts, run, confirmLabel = 'Confirmar na prévia') => setConfirmation({ title, message, impacts, run, confirmLabel });

  function loadExample() {
    const quantity = Number(count);
    if (!Number.isSafeInteger(quantity) || quantity < 16) return tell('Informe uma quantidade inteira, a partir de 16 atletas.');
    // A local preview safeguard, not a modality limit.
    if (quantity > 256) return tell('Esta prévia interativa foi limitada a 256 atletas para manter os testes leves. Não é um limite proposto para a modalidade.');
    confirm('Carregar outro exemplo?', 'Isso substitui somente os dados desta prévia local.', ['Os nomes, placares e sorteios de teste atuais serão substituídos.', 'Nenhum torneio do site oficial será alterado.'], () => {
      setState(makeExample(quantity, target, scenario));
      setImportBackup(null);
      setTab(scenario === 'finals' ? 'finals' : scenario === 'finished' ? 'ranking' : 'qualifying');
      setEditor(null);
    }, 'Carregar exemplo');
  }

  function requestShuffle() {
    if (!state.players.some(name => String(name).trim())) return tell('Adicione os nomes antes do sorteio.');
    const run = () => {
      const result = shuffleParticipants(state);
      result.lastShuffleVideo = createReiDoSolDrawVideo(result.players);
      setShuffleResult(result);
    };
    if (state.namesShuffled || state.qualifying.length || state.finals.length) {
      confirm('Sortear os nomes novamente?', 'Um novo sorteio muda a posição dos participantes.', [
        'As rodadas, os jogos e os placares atuais desta prévia serão apagados.',
        'Os grupos finais e seus resultados também serão removidos.',
        'Os participantes cadastrados e suas presenças serão mantidos.',
      ], run, 'Sim, sortear novamente');
    } else run();
  }

  function requestGenerate() {
    if (state.players.some(name => !String(name).trim())) return tell('Preencha os nomes dos participantes antes de criar as rodadas e os jogos.');
    const run = () => {
      const next = generateQualifying(state, courts.length);
      setState(next);
      setTab('qualifying');
      setNotice({ type: 'success', title: 'Rodadas e jogos criados', message: `Foram criados ${next.qualifying.length} rodadas e ${next.qualifying.flat().length} jogos. Cada atleta fará quatro partidas, com quatro parceiros diferentes.` });
    };
    if (state.qualifying.length || state.finals.length) {
      confirm('Criar rodadas e jogos novamente?', 'Os confrontos serão gerados usando a ordem atual dos participantes, sem outro sorteio.', [
        'As rodadas, os jogos e os placares atuais desta prévia serão substituídos.',
        'Os grupos finais e seus resultados serão removidos.',
        'A lista de participantes e o sorteio dos nomes serão mantidos.',
      ], run, 'Sim, criar novamente');
    } else run();
  }

  function applyImport(players, summary) {
    setImportBackup({ players: [...state.players], participantAttendance: [...state.participantAttendance], participantGenders: state.participantGenders });
    setState(current => importParticipantNames(current, players, summary));
    setImporting(false);
    setNotice({ type: 'success', title: 'Lista importada', message: `${summary.imported} nomes preenchidos. Agora você pode sortear os nomes e criar as rodadas e os jogos.` });
  }

  function undoImport() {
    if (!importBackup) return;
    setState(current => ({ ...current, ...importBackup }));
    setImportBackup(null);
  }

  function changeScore(key, field, raw) {
    if (!/^\d*$/.test(raw)) return false;
    const value = normalizeScoreInput(raw, state.target);
    const original = findGame(state, key);
    if (!original || original[field] === value) return false;
    const scope = key.startsWith('qual-') ? 'qualifying' : key.split('-')[0];
    const commit = () => setState(current => {
      const next = structuredClone(current);
      const game = findGame(next, key);
      if (!game) return current;
      const wasFinished = Boolean(getScoreWinnerSide(game, next.target));
      game[field] = value;
      const finished = Boolean(getScoreWinnerSide(game, next.target));
      if (finished) {
        if (!wasFinished) stopMatchTimer(game, { finished: true });
        game.inProgress = false;
      } else if (wasFinished) {
        delete game.matchTimerFinishedAt;
        game.inProgress = false;
      }
      next.draws[scope] = {};
      next.drawVideos = { ...next.drawVideos, [scope]: {} };
      if (scope === 'qualifying') { next.finals = []; next.draws = { qualifying: {} }; next.drawVideos = {}; }
      return next;
    });
    if (scope === 'qualifying' && state.finals.length) {
      confirm('Corrigir a classificatória?', 'A correção pode mudar os classificados e seus grupos.', ['A fase final desta prévia será desfeita, incluindo seus placares.', 'Depois da correção, gere novamente os quatro grupos.'], commit, 'Corrigir placar');
      return false;
    }
    commit();
    return true;
  }

  function conflict(candidate, next) {
    const ids = [...candidate.ids1, ...candidate.ids2];
    return allGames(next).find(game => game.matchKey !== candidate.matchKey && game.inProgress && !getScoreWinnerSide(game, next.target) && (
      getGameCourtNumber(game, courts) === getGameCourtNumber(candidate, courts) || [...game.ids1, ...game.ids2].some(id => ids.includes(id))
    ));
  }
  function startGames(keys, announce = null) {
    const next = structuredClone(state);
    for (const key of keys) {
      const game = findGame(next, key);
      if (!game || getScoreWinnerSide(game, next.target)) continue;
      if (conflict(game, next)) { tell('Há um atleta ou uma quadra em jogo. Finalize ou pause a partida anterior, ou escolha uma quadra livre.'); return; }
      if (!game.inProgress) { startMatchTimer(game); game.inProgress = true; }
    }
    setState(next);
    announce?.();
  }
  function toggle(key) {
    const currentGame = findGame(state, key);
    if (!currentGame || getScoreWinnerSide(currentGame, state.target)) return;
    if (!currentGame.inProgress) return startGames([key]);
    setState(current => {
      const next = structuredClone(current);
      const game = findGame(next, key);
      stopMatchTimer(game); game.inProgress = false;
      return next;
    });
  }
  function resolveTie(scope, tie) {
    if (draw) return;
    const order = shuffle(tie.ids);
    const names = order.map(id => state.players[id]);
    setDraw({ phase: 'drawing', title: 'Desempate individual · prévia', winner: names[0], orderNames: names,
      candidates: tie.ids.map(id => state.players[id]), scope, signature: tie.signature, order,
      video: createReiDoSolDrawVideo(names, scope) });
  }
  function finishTie() {
    if (!draw || draw.phase !== 'drawing') return;
    setState(current => ({ ...current,
      draws: { ...current.draws, [draw.scope]: { ...current.draws[draw.scope], [draw.signature]: draw.order } },
      drawVideos: { ...current.drawVideos, [draw.scope]: { ...current.drawVideos?.[draw.scope], [draw.signature]: draw.video } },
    }));
    setDraw(current => ({ ...current, phase: 'result' }));
  }
  function saveManualTie(scope, tie, order) {
    try {
      const next = applyManualTieOrder(state, scope, tie.signature, order);
      setState(next);
      setManualTie(null);
      setNotice({ type: 'success', title: 'Escolha manual salva', message: `Ordem definida pelo organizador: ${order.map((id, index) => `${index + 1}º ${state.players[id]}`).join(' · ')}. Nenhum sorteio foi realizado.` });
    } catch (error) {
      setNotice({ type: 'warning', title: 'Revise o desempate', message: error.message });
    }
  }
  function generateFinals() {
    if (!qualification.settled) return tell('Conclua todos os jogos da classificatória e resolva os empates pendentes.');
    const run = () => {
      setState(current => ({ ...current, finals: createFinals(qualification), draws: { qualifying: current.draws.qualifying || {} }, drawVideos: { qualifying: current.drawVideos?.qualifying || {} } }));
      setTab('finals');
    };
    if (state.finals.length) return confirm('Gerar a fase final novamente?', 'Os mesmos classificados serão distribuídos pela posição na classificatória.', ['Somente os placares e sorteios da fase final local serão zerados.'], run);
    run();
  }

  function tiePanel(scope, ranking) {
    const lastVideo = Object.entries(state.drawVideos?.[scope] || {}).filter(([signature]) => state.draws[scope]?.[signature]).at(-1)?.[1];
    if (!ranking.complete) return null;
    return <>
    {ranking.pending.length > 0 && <div className="infoBox tieBreakPanel rds-ties">
      <strong>Empate pendente — sorteio ou escolha manual</strong>
      <p>O empate persistiu após vitórias, saldo de games, total de games, confronto direto e coeficiente. O organizador pode sortear ou definir manualmente a ordem entre os empatados.</p>
      {ranking.pending.map(tie => <div className="rds-tie-item" key={tie.signature}>
        <div className="rds-actions">
        <span>{tie.ids.map(id => state.players[id]).join(' · ')}</span>
        <div className="rds-tie-actions">
          <button type="button" className="secondaryBtn" disabled={Boolean(draw)} onClick={() => { setManualTie(null); resolveTie(scope, tie); }}>Sortear desempate</button>
          <button type="button" className="secondaryBtn" disabled={Boolean(draw)} aria-expanded={manualTie?.scope === scope && manualTie.signature === tie.signature} onClick={() => setManualTie({ scope, signature: tie.signature })}>Escolher manualmente</button>
        </div>
        </div>
        {manualTie?.scope === scope && manualTie.signature === tie.signature && <ReiDoSolManualTie tie={tie} players={state.players} onCancel={() => setManualTie(null)} onSave={order => saveManualTie(scope, tie, order)} />}
      </div>)}
    </div>}
    {lastVideo && <button type="button" className="shuffleVideoReopenButton" onClick={() => setVideoSnapshot(lastVideo)}><Film aria-hidden="true" /> Vídeo do último desempate</button>}
    </>;
  }
  function table(title, ranking, qualifying = false, group = null) {
    return <ReiDoSolRankingTable title={title} ranking={ranking} qualifying={qualifying} group={group}
      destinationFor={qualifying && qualification.settled ? row => GROUPS[Math.floor(qualification.rows.findIndex(item => item.id === row.id) / 4)]?.name || null : null} />;
  }
  const commonSchedule = {
    statusData: state,
    winningScore: state.target, courtNumbers: courts, voiceRepeat: repeat, setVoiceRepeat: setRepeat,
    onEditCourt: setEditor, stopSpeech,
    speakGame: (game, options) => startGames([game.matchKey], () => speakGame(game, options)),
    speakRound: (round, index, options) => startGames(round.map(game => game.matchKey), () => speakRound(round, index, options)),
  };

  return <div className={`proDashboard playAppShell theme-${theme} rds-preview`}>
    <main className="playMain"><div className="tournamentWorkspaceContent">
      <aside className="rds-preview-banner"><span><b>PRÉVIA LOCAL</b> · Dados simulados · Nada publicado no site oficial</span><span>{saved ? 'Salvo só neste navegador' : 'Armazenamento indisponível: mantenha esta aba aberta'}</span></aside>
      <header className="tournamentWorkspaceHeader rds-header">
        <div className="rds-brand"><img src="/torneio360-logo.png" alt="Torneio 360" /><div><span>Nova modalidade</span><h1>Rei do Sol</h1><p>Duplas rotativas. Classificação individual.</p></div></div>
        <button className="secondaryBtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Moon size={16} /> Tema {theme === 'dark' ? 'claro' : 'escuro'}</button>
      </header>
      <details className="rds-sandbox"><summary>Testar outros exemplos <span>{state.players.length} atletas · {state.target} games por set</span></summary>
        <div className="rds-demo-controls">
          <label>Quantidade de atletas<input type="number" min="16" max="256" value={count} onChange={event => setCount(event.target.value)} /></label>
          <label>Games por set<select value={target} onChange={event => setTarget(Number(event.target.value))}><option value={4}>4 games</option><option value={6}>6 games</option></select></label>
          <label>Exemplo<select value={scenario} onChange={event => setScenario(event.target.value)}>{Object.entries(scenarios).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="primaryBtn" onClick={loadExample}>Carregar exemplo</button>
        </div><p>Controles apenas da prévia. Você pode testar também 17 ou 19 atletas. Os placares e eventuais sorteios do exemplo são fictícios.</p>
      </details>
      <nav className="tournamentTopTabs rds-tabs" aria-label="Etapas do Rei do Sol">{tabs.map(([id, label, Icon]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={18} />{label}</button>)}</nav>

      {tab === 'organization' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Organização do torneio</h2><p>O cadastro continua individual. As duplas mudam a cada jogo.</p></div>
          <FormatExplanationButton label="Como funciona o Rei do Sol" title="Rei do Sol" eyebrow="Formato do torneio" intro="Uma classificação individual em jogos de duplas, com troca de parceiros."
            sections={[{ title: 'Classificatória', content: <p>A partir de 16 atletas. Cada atleta faz quatro jogos, sempre com parceiros diferentes. O sorteio equilibra participações e evita repetições; não usa nível técnico.</p> }, { title: 'Fase final', content: <p>Os 16 primeiros formam Ouro, Prata, Bronze e Lango, nesta ordem. Cada grupo tem quatro atletas e três jogos. Todos começam do zero e cada grupo tem seu campeão.</p> }, { title: 'Desempate', content: <p>{CRITERIA}. O confronto direto decide entre dois empatados, considerando somente partidas em lados opostos. Se não decidir, aplica-se o coeficiente. Persistindo o empate, o organizador pode sortear ou escolher manualmente a ordem. {COEFFICIENT_HELP}</p> }]} />
        </div>
        <div className="rds-metrics"><div><Users /><strong>{state.players.length} atletas</strong><span>Inscrição individual</span></div><div><Swords /><strong>4 jogos por atleta</strong><span>4 parceiros diferentes</span></div><div><Sun /><strong>16 classificados</strong><span>4 grupos finais</span></div><div><Trophy /><strong>4 campeões</strong><span>Um em cada grupo</span></div></div>
        <ReiDoSolParticipants data={state} config={config} onImport={() => setImporting(true)} onUndoImport={importBackup ? undoImport : null} onShuffle={requestShuffle} onGenerate={requestGenerate} onVideo={() => setVideoSnapshot(state.lastShuffleVideo)}
          onSetAllAttendance={confirmed => setState(current => ({ ...current, participantAttendance: current.players.map(() => confirmed) }))}
          updatePlayer={({ index }, name) => { setImportBackup(null); setState(current => ({ ...current, players: current.players.map((old, i) => i === index ? name : old) })); }}
          updateParticipantAttendance={({ index }, value) => setState(current => ({ ...current, participantAttendance: current.participantAttendance.map((old, i) => i === index ? value : old) }))} />
      </section>}

      {tab === 'qualifying' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Classificatória</h2><p>{qualification.completed} de {qualification.total} jogos concluídos · 4 partidas por atleta · Ranking individual</p></div><button className="primaryBtn" disabled={!qualification.settled} onClick={generateFinals}>{state.finals.length ? 'Gerar fase final novamente' : 'Gerar fase final'}</button></div>
        <p className="rds-info">Cada atleta tem quatro parceiros diferentes. Os 16 melhores avançam; a pontuação não é levada para a final.</p>
        {state.qualifying.length ? <ScheduleView {...commonSchedule} schedule={withNames(state.qualifying, state.players)} updateScore={(r, g, field, value) => changeScore(state.qualifying[r][g].matchKey, field, value)} onStatusToggle={(r, g) => toggle(state.qualifying[r][g].matchKey)} /> : <div className="infoBox"><p>Clique em “Criar rodadas e jogos”, na Organização, para montar os confrontos.</p><button type="button" className="secondaryBtn" onClick={() => setTab('organization')}>Ir para Organização</button></div>}
        {tiePanel('qualifying', qualification)}
        {table(qualification.settled ? 'Classificação da primeira fase' : 'Classificação provisória', qualification, true)}
      </section>}

      {tab === 'finals' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Fase final</h2><p>Quatro grupos. Três jogos em cada grupo. Um campeão por grupo.</p></div><span className="rds-zero">Pontuação começa do zero</span></div>
        <p className="rds-info">Os grupos são formados pela posição na classificatória. Não há mata-mata: em cada grupo, todos jogam com todos como parceiros.</p>
        {!finalsCurrent && <div className="infoBox rds-finals-warning"><strong>Confira a fase final após a atualização dos critérios.</strong><p>Os grupos salvos ainda não correspondem à classificação atual. Os jogos e placares foram preservados. Resolva os desempates da classificatória e gere a fase final novamente antes de definir os campeões.</p><button type="button" className="secondaryBtn" onClick={() => setTab('qualifying')}>Revisar classificatória</button></div>}
        {!state.finals.length ? <div className="rds-empty"><Sun size={32} /><h3>Aguardando a classificatória</h3><p>Conclua os jogos e os desempates para distribuir os 16 classificados.</p><button className="primaryBtn" onClick={() => setTab('qualifying')}>Ir para a classificatória</button></div> : <div className="rds-group-grid">
          {finalRankings.map(({ group, ranking }) => <article className="rds-group" key={group.id} style={groupColorStyle(group)}>
            <header><div><span>{group.range} da classificatória</span><h3>Grupo {group.name}</h3></div><span>{ranking.completed}/3 jogos</span></header>
            <ol className="rds-members">{group.ids.map(id => <li key={id}><span>{qualification.settled ? `${qualification.rows.findIndex(row => row.id === id) + 1}º` : '—'}</span>{state.players[id]}</li>)}</ol>
            <div className="rds-group-games">{withNames(group.schedule, state.players).flat().map((game, index) => <UniversalMatchCard key={game.matchKey} game={game} phaseLabel={`${group.name} · Jogo ${index + 1}`} winningScore={state.target} courtNumbers={courts} attendanceData={state}
              onScoreChange={(field, value) => changeScore(game.matchKey, field, value)} onStatusToggle={() => toggle(game.matchKey)} onCallGame={() => startGames([game.matchKey], () => speakGame(game, { courtNumbers: courts, repeat }))} onEditCourt={() => setEditor({ game })} />)}</div>
            {finalsCurrent && groupChampion(ranking) && <div className="rds-champion"><Trophy size={20} /><span>Campeão {group.name}<strong>{groupChampion(ranking).name}</strong></span></div>}
            {tiePanel(group.id, ranking)}
            {table(`Ranking ${group.name}`, ranking, false, group)}
          </article>)}
        </div>}
      </section>}

      {tab === 'ranking' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Campeões do Rei do Sol</h2><p>Um campeão Ouro, um Prata, um Bronze e um Lango. Sem vice ou terceiro lugar.</p></div></div>
        <p className="rds-criteria">{CRITERIA}</p>
        {!finalsCurrent && <p className="rds-info">Os critérios foram atualizados. Revise a classificatória e gere novamente os grupos finais. Os jogos salvos estão preservados na aba Fase final, mas ainda não podem definir os campeões.</p>}
        <ReiDoSolChampions finalRankings={finalsCurrent ? finalRankings : []} renderTiePanel={tiePanel} />
        <p className="rds-info">As tabelas de pontuação continuam nas abas Classificatória e Fase final, apenas para acompanhar os jogos e os critérios de desempate.</p>
      </section>}
      <footer className="rds-footer">Rei do Sol · Prévia para aprovação · Os cards, placares, chamadas e tabelas reutilizam os componentes da plataforma.</footer>
    </div></main>
    <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    <ConfirmRegenerationModal confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.run; setConfirmation(null); action(); }} />
    {draw && createPortal(<ReiDoSolTieBreakDraw key={draw.video.id} draw={draw} onComplete={finishTie} onClose={() => { setVideoSnapshot(draw.video); setDraw(null); }} />, document.body)}
    {videoSnapshot && createPortal(<ShuffleVideoModal snapshot={videoSnapshot} arenaName="Prévia local" arenaPhotoUrl="" createVideoFile={createShuffleVideoFile} downloadVideo={downloadShuffleVideo} onClose={() => setVideoSnapshot(null)} />, document.body)}
    {importing && <ParticipantImportModal type="Rei do Sol" data={state} modalityConfig={config} onClose={() => setImporting(false)} onApply={applyImport} />}
    {shuffleResult && <ReiDoSolShuffleOverlay names={state.players} onComplete={() => { setState(shuffleResult); setShuffleResult(null); setImportBackup(null); setVideoSnapshot(shuffleResult.lastShuffleVideo); }} />}
    {editor && <CourtAssignmentModal editor={editor} courtNumbers={courts} currentNumber={getGameCourtNumber(findGame(state, editor.game.matchKey) || editor.game, courts)} currentLabel={`Quadra ${getGameCourtNumber(editor.game, courts)}`}
      unavailableNumbers={allGames(state).filter(game => game.inProgress && game.matchKey !== editor.game.matchKey).map(game => getGameCourtNumber(game, courts))}
      onClose={() => setEditor(null)} onSelect={number => { setState(current => { const next = structuredClone(current); const game = findGame(next, editor.game.matchKey); if (game) applyCourtNumberToGame(game, number, courts); return next; }); setEditor(null); }} />}
  </div>;
}

const root = createRoot(document.getElementById('root'));
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
