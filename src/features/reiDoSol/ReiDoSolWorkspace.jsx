import '../../styles/31-matches-and-brackets.css';
import './reiDoSol.css';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Sun, Trophy, Swords, Settings, Film, Share2, ChevronDown, Grid3X3 } from 'lucide-react';
import ScheduleView, { UniversalMatchCard } from '../matchOperations/MatchSchedule.jsx';
import { CourtAssignmentModal } from '../matchOperations/MatchControls.jsx';
import { speakGame, speakRound, stopSpeech } from '../matchOperations/speechAnnouncements.mjs';
import ShuffleVideoModal from '../media/ShuffleVideoModal.jsx';
import { createShuffleVideoFile, downloadShuffleVideo } from '../media/shuffleVideoExport.mjs';
import { createReiDoSolDrawVideo } from './reiDoSolDrawVideo.mjs';
import ReiDoSolTieBreakDraw from './ReiDoSolTieBreakDraw.jsx';
import ReiDoSolManualTie from './ReiDoSolManualTie.jsx';
import ParticipantImportModal from '../participantManagement/ParticipantManagement.jsx';
import { ConfirmRegenerationModal, NoticeModal } from '../dialogs/ConfirmationDialogs.jsx';
import FormatExplanationButton from '../tournamentConfig/FormatExplanationButton.jsx';
import { getScoreWinnerSide, normalizeScoreInput } from '../../domain/scoreRules.mjs';
import { startMatchTimer, stopMatchTimer } from '../../domain/matchTimer.mjs';
import { getGameCourtNumber, applyCourtNumberToGame } from '../../domain/courtNumbers.mjs';
import { GROUPS, CRITERIA, COEFFICIENT_HELP, withNames, phaseRanking, createFinals, allGames, findGame, shuffle, groupChampion, shuffleParticipants, generateQualifying, importParticipantNames, finalsFollowQualification } from '../../domain/reiDoSol.mjs';
import ReiDoSolChampions from './ReiDoSolChampions.jsx';
import ReiDoSolParticipants, { ReiDoSolShuffleOverlay } from './ReiDoSolParticipants.jsx';
import ReiDoSolRankingTable from './ReiDoSolRankingTable.jsx';
import { groupColorStyle, applyManualTieOrder } from '../../domain/reiDoSol.mjs';

import { reiDoSolState, applyReiDoSolState, resizeReiDoSol } from '../../domain/reiDoSolData.mjs';

const tabs = [['organization', 'Organização', Settings], ['qualifying', 'Classificatória', Swords], ['finals', 'Fase final', Sun], ['ranking', 'Ranking', Trophy]];
export default function ReiDoSolWorkspace({ data, setData, tournament, onBack, onShare, savingBadge,
  readOnly = false, onOpenCourtCenter, courtOptions = data.courtNumbers, unavailableCourts = [],
  embedded = false, activeTab, onTabChange, activeOrganizationTab, onOrganizationTabChange, shareContext: publicShareContext }) {
  const state = reiDoSolState(data);
  const courts = courtOptions?.length ? courtOptions : ['1', '2', '3', '4'];
  const [localTab, setLocalTab] = useState(readOnly && state.qualifying.length ? 'qualifying' : 'organization');
  const tab = activeTab ?? localTab;
  const setTab = next => { setLocalTab(next); onTabChange?.(next); };
  const [localOrganizationTab, setLocalOrganizationTab] = useState('format');
  const organizationTab = activeOrganizationTab ?? localOrganizationTab;
  const setOrganizationTab = next => { setLocalOrganizationTab(next); onOrganizationTabChange?.(next); };
  const [headerDetailsOpen, setHeaderDetailsOpen] = useState(false);
  const [theme, setTheme] = useState(() => typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme || 'light');
  const [count, setCount] = useState(String(state.players.length));
  useEffect(() => setCount(String(state.players.length)), [state.players.length]);
  useEffect(() => {
    const update = () => setTheme(document.documentElement.dataset.theme || 'light');
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => observer.disconnect();
  }, []);
  const organizer = data.publicInfo?.organizer || {};
  const shareContext = { title: tournament.name, subtitle: 'Rei do Sol',
    arenaName: organizer.arenaName || organizer.organizerName || 'Torneio 360', arenaPhotoUrl: organizer.photoUrl || '', ...publicShareContext };
  const countValid = Number.isSafeInteger(Number(count)) && Number(count) >= 16;
  const countChanged = Number(count) !== state.players.length;
  function setState(value, options = {}) {
    if (readOnly) return false;
    let accepted = false;
    try {
      setData(currentData => {
        const current = reiDoSolState(currentData);
        // A confirmation or animation must not overwrite newer remote changes.
        if (typeof value !== 'function' && JSON.stringify(current) !== JSON.stringify(state))
          throw new Error('Os dados mudaram. Revise o torneio antes de repetir esta ação.');
        const next = typeof value === 'function' ? value(current) : value;
        accepted = true;
        return next === current ? currentData : applyReiDoSolState(currentData, next);
      }, options);
    } catch (error) { setNotice({ type: 'warning', title: 'Revise a alteração', message: error.message }); }
    return accepted;
  }
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
  useEffect(() => () => stopSpeech(), []);
  const config = { 'Rei do Sol': { type: 'reiDoSol', total: state.players.length, label: 'Atleta' } };
  const qualification = phaseRanking(state.players, state.qualifying, state.target, state.draws.qualifying);
  const finalsCurrent = finalsFollowQualification(state.finals, qualification);
  const finalRankings = state.finals.map(group => ({ group: { ...group, ...GROUPS.find(item => item.id === group.id) }, ranking: phaseRanking(state.players, group.schedule, state.target, state.draws[group.id], group.ids) }));
  const tell = message => setNotice({ type: 'info', title: 'Rei do Sol', message });
  const confirm = (title, message, impacts, run, confirmLabel = 'Confirmar') => {
    if (readOnly) return;
    const expected = JSON.stringify(state);
    setConfirmation({ title, message, impacts, confirmLabel, run: () => {
      let unchanged = false;
      setData(current => { unchanged = JSON.stringify(reiDoSolState(current)) === expected; return current; });
      if (!unchanged) return tell('Os dados mudaram. Revise o torneio antes de repetir esta ação.');
      run();
    } });
  };
  function changeCount() {
    if (readOnly) return;
    const quantity = Number(count);
    if (!Number.isSafeInteger(quantity) || quantity < 16) return tell('Informe uma quantidade inteira, a partir de 16 atletas.');
    if (quantity === state.players.length) return;
    const run = () => {
      setState(reiDoSolState(resizeReiDoSol(data, quantity)), { allowScoreRegression: true });
      setImportBackup(null);
    };
    if (state.qualifying.length || state.finals.length || quantity < state.players.length)
      return confirm('Alterar a quantidade de atletas?', 'Confira o impacto antes de confirmar.',
        ['As rodadas, jogos, placares e desempates serão removidos.', 'Os nomes e presenças das vagas mantidas serão preservados.', 'Ao reduzir, os nomes das últimas vagas serão removidos.'], run, 'Alterar quantidade');
    run();
  }

  function requestShuffle() {
    if (!state.players.some(name => String(name).trim())) return tell('Adicione os nomes antes do sorteio.');
    const run = () => {
      const result = shuffleParticipants(state);
      result.lastShuffleVideo = createReiDoSolDrawVideo(result.players, 'names', tournament);
      setShuffleResult(result);
    };
    if (state.namesShuffled || state.qualifying.length || state.finals.length) {
      confirm('Sortear os nomes novamente?', 'Um novo sorteio muda a posição dos participantes.', [
        'As rodadas, os jogos e os placares atuais deste torneio serão apagados.',
        'Os grupos finais e seus resultados também serão removidos.',
        'Os participantes cadastrados e suas presenças serão mantidos.',
      ], run, 'Sim, sortear novamente');
    } else run();
  }

  function requestGenerate() {
    if (state.players.some(name => !String(name).trim())) return tell('Preencha os nomes dos participantes antes de criar as rodadas e os jogos.');
    const run = () => {
      const next = generateQualifying(state, courts.length);
      if (!setState(next, { allowScoreRegression: true })) return;
      setTab('qualifying');
      setNotice({ type: 'success', title: 'Rodadas e jogos criados', message: `Foram criados ${next.qualifying.length} rodadas e ${next.qualifying.flat().length} jogos. Cada atleta fará quatro partidas, com quatro parceiros diferentes.` });
    };
    if (state.qualifying.length || state.finals.length) {
      confirm('Criar rodadas e jogos novamente?', 'Os confrontos serão gerados usando a ordem atual dos participantes, sem outro sorteio.', [
        'As rodadas, os jogos e os placares atuais deste torneio serão substituídos.',
        'Os grupos finais e seus resultados serão removidos.',
        'A lista de participantes e o sorteio dos nomes serão mantidos.',
      ], run, 'Sim, criar novamente');
    } else run();
  }

  function applyImport(players, summary) {
    setImportBackup({ players: [...state.players], participantAttendance: [...state.participantAttendance], participantGenders: state.participantGenders });
    if (!setState(current => importParticipantNames(current, players, summary))) return;
    setImporting(false);
    setNotice({ type: 'success', title: 'Lista importada', message: `${summary.imported} nomes preenchidos. Agora você pode sortear os nomes e criar as rodadas e os jogos.` });
  }

  function undoImport() {
    if (!importBackup) return;
    setState(current => ({ ...current, ...importBackup }));
    setImportBackup(null);
  }

  function changeScore(key, field, raw) {
    if (readOnly || !/^\d*$/.test(raw)) return false;
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
    }, { allowScoreRegression: true });
    if (scope === 'qualifying' && state.finals.length) {
      confirm('Corrigir a classificatória?', 'A correção pode mudar os classificados e seus grupos.', ['A fase final deste torneio será desfeita, incluindo seus placares.', 'Depois da correção, gere novamente os quatro grupos.'], commit, 'Corrigir placar');
      return false;
    }
    return commit();
  }

  function conflict(candidate, next) {
    const ids = [...candidate.ids1, ...candidate.ids2];
    return allGames(next).find(game => game.matchKey !== candidate.matchKey && game.inProgress && !getScoreWinnerSide(game, next.target) && (
      getGameCourtNumber(game, courts) === getGameCourtNumber(candidate, courts) || [...game.ids1, ...game.ids2].some(id => ids.includes(id))
    ));
  }
  function startGames(keys, announce = null) {
    if (readOnly) return;
    const next = structuredClone(state);
    for (const key of keys) {
      const game = findGame(next, key);
      if (!game || getScoreWinnerSide(game, next.target)) continue;
      if (unavailableCourts.map(String).includes(String(getGameCourtNumber(game, courts))) || conflict(game, next)) { tell('Há um atleta ou uma quadra em jogo. Finalize ou pause a partida anterior, ou escolha uma quadra livre.'); return; }
      if (!game.inProgress) { startMatchTimer(game); game.inProgress = true; }
    }
    if (setState(next)) announce?.();
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
    setDraw({ phase: 'drawing', title: 'Desempate individual', winner: names[0], orderNames: names,
      candidates: tie.ids.map(id => state.players[id]), scope, signature: tie.signature, order,
      video: createReiDoSolDrawVideo(names, scope, tournament) });
  }
  function finishTie() {
    if (!draw || draw.phase !== 'drawing') return;
    const accepted = setState(current => {
      const checked = applyManualTieOrder(current, draw.scope, draw.signature, draw.order);
      return { ...checked,
        draws: { ...checked.draws, [draw.scope]: { ...checked.draws[draw.scope], [draw.signature]: draw.order } },
        drawVideos: { ...checked.drawVideos, [draw.scope]: { ...checked.drawVideos[draw.scope], [draw.signature]: draw.video } } };
    });
    if (!accepted) { setDraw(null); return; }
    setDraw(current => ({ ...current, phase: 'result' }));
  }
  function saveManualTie(scope, tie, order) {
    try {
      applyManualTieOrder(state, scope, tie.signature, order);
      if (!setState(current => applyManualTieOrder(current, scope, tie.signature, order))) return;
      setManualTie(null);
      setNotice({ type: 'success', title: 'Escolha manual salva', message: `Ordem definida pelo organizador: ${order.map((id, index) => `${index + 1}º ${state.players[id]}`).join(' · ')}. Nenhum sorteio foi realizado.` });
    } catch (error) {
      setNotice({ type: 'warning', title: 'Revise o desempate', message: error.message });
    }
  }
  function generateFinals() {
    if (!qualification.settled) return tell('Conclua todos os jogos da classificatória e resolva os empates pendentes.');
    const run = () => {
      setState(current => ({ ...current, finals: createFinals(phaseRanking(current.players, current.qualifying, current.target, current.draws.qualifying)), draws: { qualifying: current.draws.qualifying || {} }, drawVideos: { qualifying: current.drawVideos?.qualifying || {} } }), { allowScoreRegression: true });
      setTab('finals');
    };
    if (state.finals.length) return confirm('Gerar a fase final novamente?', 'Os mesmos classificados serão distribuídos pela posição na classificatória.', ['Somente os placares e sorteios da fase final serão zerados.'], run);
    run();
  }

  function tiePanel(scope, ranking) {
    if (readOnly) return ranking.complete && ranking.pending.length ? <p className="rds-info">Desempate aguardando definição pelo organizador.</p> : null;
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
    return <ReiDoSolRankingTable shareContext={shareContext} title={title} ranking={ranking} qualifying={qualifying} group={group}
      destinationFor={qualifying && qualification.settled ? row => GROUPS[Math.floor(qualification.rows.findIndex(item => item.id === row.id) / 4)]?.name || null : null} />;
  }
  const commonSchedule = {
    statusData: state, readOnly,
    winningScore: state.target, courtNumbers: courts, voiceRepeat: repeat, setVoiceRepeat: setRepeat,
    onEditCourt: setEditor, stopSpeech,
    speakGame: (game, options) => startGames([game.matchKey], () => speakGame(game, options)),
    speakRound: (round, index, options) => startGames(round.map(game => game.matchKey), () => speakRound(round, index, options)),
  };

  return <><section className={`${embedded ? 'rds-embedded' : 'appPage'} rds-preview rds-workspace theme-${embedded ? 'light' : theme}`} inert={Boolean(draw || shuffleResult || confirmation)}>
      {!embedded && <header className={`tournamentWorkspaceHeader ${headerDetailsOpen ? 'detailsOpen' : ''}`}>
        <div><div className="tournamentHeaderTitleRow"><h1>{tournament.name}</h1></div>
          <div className="tournamentHeaderMeta" id="rds-header-details"><span><Trophy aria-hidden="true" /> Rei do Sol</span><span><Users aria-hidden="true" /> {state.players.length} atletas · {state.target} games por set</span></div></div>
        <div className="actions tournamentHeaderActions"><button type="button" className="tournamentHeaderDetailsToggle" aria-controls="rds-header-details" aria-expanded={headerDetailsOpen} onClick={() => setHeaderDetailsOpen(open => !open)}>Informações <ChevronDown aria-hidden="true" /></button>{!readOnly && onShare && <button type="button" className="tournamentHeaderShareButton" onClick={onShare}><Share2 aria-hidden="true" /> Compartilhar</button>}{onBack && <button type="button" onClick={onBack}>Voltar</button>}</div>
      </header>}
      {!embedded && <nav className={`tournamentTopTabs ${readOnly ? 'publicTournamentTabs' : ''}`} aria-label="Etapas do Rei do Sol">{tabs.map(([id, label, Icon]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon aria-hidden="true" size={18} />{readOnly && id === 'organization' ? 'Participantes' : label}</button>)}</nav>}

      {tab === 'organization' && <section className="card rds-panel">
        <div className="rds-section-heading"><div><h2>{readOnly ? "Participantes" : "Organização do torneio"}</h2><p>O cadastro continua individual. As duplas mudam a cada jogo.</p></div>
          {!readOnly && savingBadge}
        </div>
        {!readOnly && <nav className="organizationSubTabs" aria-label="Configuração do torneio">
          <button type="button" className={organizationTab === 'format' ? 'active' : ''} onClick={() => setOrganizationTab('format')}>Formato do torneio</button>
          <button type="button" className={organizationTab === 'players' ? 'active' : ''} onClick={() => setOrganizationTab('players')}>Participantes</button>
          {onOpenCourtCenter && <button type="button" className="organizationCourtCenterShortcut" onClick={onOpenCourtCenter}><Grid3X3 aria-hidden="true" /> Quadras</button>}
        </nav>}
        {(readOnly || organizationTab === 'format') && <div className="organizationPanel cupConfigBox">
          {!readOnly && <div className="rds-format-count">
            <label htmlFor="rds-player-count">Quantidade de atletas</label>
            <div className="rds-count-controls">
              <div className="rds-count-field"><Users aria-hidden="true" size={20} /><input id="rds-player-count" type="number" inputMode="numeric" min="16" step="1" value={count} aria-describedby="rds-count-help" aria-invalid={!countValid} onChange={event => setCount(event.target.value)} /><span>atletas</span></div>
              <button type="button" className="primaryBtn" disabled={!countValid || !countChanged} onClick={changeCount}>Aplicar quantidade</button>
            </div>
            <p id="rds-count-help">Mínimo de 16 atletas. {state.target} games por set, conforme a criação do torneio.</p>
          </div>}
          <FormatExplanationButton label="Como funciona o Rei do Sol" title="Rei do Sol" eyebrow="Formato do torneio" intro="Uma classificação individual em jogos de duplas, com troca de parceiros."
            sections={[{ title: 'Classificatória', content: <p>A partir de 16 atletas. Cada atleta faz quatro jogos, sempre com parceiros diferentes. O sorteio equilibra participações e evita repetições; não usa nível técnico.</p> }, { title: 'Fase final', content: <p>Os 16 primeiros formam Ouro, Prata, Bronze e Lango, nesta ordem. Cada grupo tem quatro atletas e três jogos. Todos começam do zero e cada grupo tem seu campeão.</p> }, { title: 'Desempate', content: <p>{CRITERIA}. O confronto direto decide entre dois empatados, considerando somente partidas em lados opostos. Se não decidir, aplica-se o coeficiente. Persistindo o empate, o organizador pode sortear ou escolher manualmente a ordem. {COEFFICIENT_HELP}</p> }]} />
        {!readOnly && <div className="rds-metrics"><div><Users /><strong>{state.players.length} atletas</strong><span>Inscrição individual</span></div><div><Swords /><strong>4 jogos por atleta</strong><span>4 parceiros diferentes</span></div><div><Sun /><strong>16 classificados</strong><span>4 grupos finais</span></div><div><Trophy /><strong>4 campeões</strong><span>Um em cada grupo</span></div></div>}</div>}
        {!readOnly && organizationTab === 'players' && <ReiDoSolParticipants data={state} config={config} onImport={() => setImporting(true)} onUndoImport={importBackup ? undoImport : null} onShuffle={requestShuffle} onGenerate={requestGenerate} onVideo={() => setVideoSnapshot(state.lastShuffleVideo)}
          onSetAllAttendance={confirmed => setState(current => ({ ...current, participantAttendance: current.players.map(() => confirmed) }))}
          updatePlayer={({ index }, name) => { setImportBackup(null); setState(current => ({ ...current, players: current.players.map((old, i) => i === index ? name : old) })); }}
          updateParticipantAttendance={({ index }, value) => setState(current => ({ ...current, participantAttendance: current.participantAttendance.map((old, i) => i === index ? value : old) }))} />}
        {readOnly && <ol className="rds-public-participants">{state.players.map((name, index) => <li key={index}><span>{index + 1}</span>{name || 'Vaga disponível'}</li>)}</ol>}
      </section>}

      {tab === 'qualifying' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Classificatória</h2><p>{qualification.completed} de {qualification.total} jogos concluídos · 4 partidas por atleta · Ranking individual</p></div></div>
        <p className="rds-info">Cada atleta tem quatro parceiros diferentes. Os 16 melhores avançam; a pontuação não é levada para a final.</p>
        {state.qualifying.length ? <ScheduleView {...commonSchedule} schedule={withNames(state.qualifying, state.players)} updateScore={(r, g, field, value) => changeScore(state.qualifying[r][g].matchKey, field, value)} onStatusToggle={(r, g) => toggle(state.qualifying[r][g].matchKey)} /> : <div className="infoBox"><p>{readOnly ? 'Aguardando a criação dos jogos pelo organizador.' : 'Clique em “Criar rodadas e jogos”, em Participantes, para montar os confrontos.'}</p>{!readOnly && <button type="button" className="secondaryBtn" onClick={() => { setTab('organization'); setOrganizationTab('players'); }}>Ir para Participantes</button>}</div>}
        {tiePanel('qualifying', qualification)}
        {table(qualification.settled ? 'Classificação da primeira fase' : 'Classificação provisória', qualification, true)}
      </section>}

      {tab === 'finals' && <section className="rds-panel">
        <div className="rds-section-heading"><div><h2>Fase final</h2><p>Quatro grupos. Três jogos em cada grupo. Um campeão por grupo.</p></div>
          <div className="rds-finals-actions"><span className="rds-zero">Pontuação começa do zero</span>{!readOnly && <button type="button" className="primaryBtn" disabled={!qualification.settled} onClick={generateFinals}><Sun aria-hidden="true" size={18} />{state.finals.length ? 'Gerar fase final novamente' : 'Gerar fase final'}</button>}</div>
        </div>
        <p className="rds-info">Os grupos são formados pela posição na classificatória. Não há mata-mata: em cada grupo, todos jogam com todos como parceiros.</p>
        {!finalsCurrent && <div className="infoBox rds-finals-warning"><strong>Confira a fase final após a atualização dos critérios.</strong><p>Os grupos salvos ainda não correspondem à classificação atual. Os jogos e placares foram preservados. Resolva os desempates da classificatória e gere a fase final novamente antes de definir os campeões.</p><button type="button" className="secondaryBtn" onClick={() => setTab('qualifying')}>Revisar classificatória</button></div>}
        {!state.finals.length ? <div className="rds-empty"><Sun size={32} /><h3>{qualification.settled ? 'Classificatória concluída' : 'Aguardando a classificatória'}</h3><p>{qualification.settled ? readOnly ? 'Aguardando o organizador gerar a fase final.' : 'Use “Gerar fase final” acima para distribuir os 16 classificados.' : 'Conclua os jogos e os desempates para distribuir os 16 classificados.'}</p><button type="button" className="secondaryBtn" onClick={() => setTab('qualifying')}>Ver classificatória</button></div> : <div className="rds-group-grid">
          {finalRankings.map(({ group, ranking }) => <article className="rds-group" key={group.id} style={groupColorStyle(group)}>
            <header><div><span>{group.range} da classificatória</span><h3>Grupo {group.name}</h3></div><span>{ranking.completed}/3 jogos</span></header>
            <ol className="rds-members">{group.ids.map(id => <li key={id}><span>{qualification.settled ? `${qualification.rows.findIndex(row => row.id === id) + 1}º` : '—'}</span>{state.players[id]}</li>)}</ol>
            <div className="rds-group-games">{withNames(group.schedule, state.players).flat().map((game, index) => <UniversalMatchCard readOnly={readOnly} key={game.matchKey} game={game} phaseLabel={`${group.name} · Jogo ${index + 1}`} winningScore={state.target} courtNumbers={courts} attendanceData={state}
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
        <ReiDoSolChampions shareContext={shareContext} finalRankings={finalsCurrent ? finalRankings : []} renderTiePanel={tiePanel} />
        <p className="rds-info">As tabelas de pontuação continuam nas abas Classificatória e Fase final, apenas para acompanhar os jogos e os critérios de desempate.</p>
      </section>}
    </section>
    <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    <ConfirmRegenerationModal confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.run; setConfirmation(null); action(); }} />
    {draw && createPortal(<ReiDoSolTieBreakDraw key={draw.video.id} draw={draw} onComplete={finishTie} onClose={() => { setVideoSnapshot(draw.video); setDraw(null); }} />, document.body)}
    {videoSnapshot && createPortal(<ShuffleVideoModal snapshot={videoSnapshot} arenaName={shareContext.arenaName} arenaPhotoUrl={shareContext.arenaPhotoUrl} createVideoFile={createShuffleVideoFile} downloadVideo={downloadShuffleVideo} onClose={() => setVideoSnapshot(null)} />, document.body)}
    {importing && <ParticipantImportModal type="Rei do Sol" data={state} modalityConfig={config} onClose={() => setImporting(false)} onApply={applyImport} />}
    {shuffleResult && <ReiDoSolShuffleOverlay names={state.players} onComplete={() => { const accepted = setState(shuffleResult, { allowScoreRegression: true }); setShuffleResult(null); if (accepted) { setImportBackup(null); setVideoSnapshot(shuffleResult.lastShuffleVideo); } }} />}
    {editor && <CourtAssignmentModal editor={editor} courtNumbers={courts} currentNumber={getGameCourtNumber(findGame(state, editor.game.matchKey) || editor.game, courts)} currentLabel={`Quadra ${getGameCourtNumber(editor.game, courts)}`}
      unavailableNumbers={[...unavailableCourts, ...allGames(state).filter(game => game.inProgress && game.matchKey !== editor.game.matchKey).map(game => getGameCourtNumber(game, courts))]}
      onClose={() => setEditor(null)} onSelect={number => { setState(current => { const next = structuredClone(current); const game = findGame(next, editor.game.matchKey); if (game) applyCourtNumberToGame(game, number, courts); return next; }); setEditor(null); }} />}
  </>;
}
