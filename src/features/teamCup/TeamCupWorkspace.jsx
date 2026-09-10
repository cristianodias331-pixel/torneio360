import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Flame, Grid3X3, Share2, Trophy, Users } from "lucide-react";
import { RankingTable } from "../ranking/RankingTables.jsx";
import CupPodiumView from "../ranking/CupPodiumView.jsx";
import { CourtAssignmentModal } from "../matchOperations/MatchControls.jsx";
import { teamCupPodium } from "../../domain/teamCupPodium.mjs";
import FormatExplanationButton from "../tournamentConfig/FormatExplanationButton.jsx";
import TeamCupParticipants from "./TeamCupParticipants.jsx";
import { ConfirmRegenerationModal } from "../dialogs/ConfirmationDialogs.jsx";
import { useTeamCupDrawPresentation } from "./TeamCupDrawPresentation.jsx";
import TeamCupVideoActions from "./TeamCupVideoActions.jsx";
import { recordTeamCupGroupVideo } from "../../domain/teamCupVideo.mjs";
import { reconfigureTeamCup, teamCupFormatChangeNeedsConfirmation, setTeamCupFormation, generateTeamCupGroups, generateTeamCupBrackets,
  TEAM_COUNTS, teamSize, teamName, teamCupRankings, teamCupQualified, shuffleTeamCup, setTeamCupConsolationEnabled,
  teamLegAvailable, teamLegWinner, teamMatchState, resolveTeamCupGame, updateTeamCupLeg, teamCupCourtNumber } from "../../domain/teamCup.mjs";
import { formatMatchDuration, getMatchElapsedSeconds } from "../../domain/matchTimer.mjs";
import "../../styles/31-matches-and-brackets.css";
import "./teamCup.css";

const legTitles = kind => kind === "squad" ? ["1º set masculino", "2º set feminino", "3º set misto de desempate"] : ["1º set", "2º set", "3º set de desempate"];
function Field({ label, children }) { return <label className="tc-field"><span>{label}</span>{children}</label>; }

export function TeamCupMatchCard({ data, game: storedGame, number, round, onLegChange, onRegisterCourtNumber, readOnly = false, now = Date.now(), courtOptions = data.courtNumbers, unavailableCourts = [] }) {
  const [selected, setSelected] = useState(0);
  const [courtEditorOpen, setCourtEditorOpen] = useState(false);
  const [announcementStatus, setAnnouncementStatus] = useState("");
  useEffect(() => {
    if (!courtEditorOpen) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector('[aria-labelledby="court-editor-title"]');
    dialog?.querySelector("button")?.focus();
    function key(event) {
      if (event.key === "Escape") { event.preventDefault(); setCourtEditorOpen(false); }
      if (event.key === "Tab") {
        const controls = [...(dialog?.querySelectorAll('button:not(:disabled), input:not(:disabled)') || [])].filter(e => e.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus?.(); };
  }, [courtEditorOpen]);
  const game = resolveTeamCupGame(data, storedGame);
  const state = teamMatchState(game, data.winningScore);
  const labels = legTitles(data.teamCup.kind);
  const leg = game.teamCupLegs[selected];
  const courtNumber = teamCupCourtNumber(data, game, selected, courtOptions);
  const playable = teamLegAvailable(data, game, selected);
  const finished = teamLegWinner(leg, data.winningScore);
  const lockedGroups = game.phase === "groups" && data.brackets.length > 0;
  const call = () => {
    const names = [game.ids1[0], game.ids2[0]].map(i => teamName(data.players.teams[i]));
    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(labels[selected] + ". " + names[0] + " contra " + names[1] + ". Quadra " + courtNumber + ".");
      speech.onerror = () => setAnnouncementStatus("Não foi possível reproduzir a chamada. Verifique o áudio do navegador.");
      setAnnouncementStatus("Chamada: " + names.join(" × ") + " · Quadra " + courtNumber);
      speech.lang = "pt-BR"; window.speechSynthesis.speak(speech);
    } else setAnnouncementStatus("Este navegador não oferece chamada por voz. Use os times e a quadra exibidos no card.");
  };
  const timerClass = `matchCardStatus ${game.isBye ? "is-bye" : finished ? "is-finished" : !playable ? "is-blocked" : leg.inProgress ? "is-in-progress" : "is-waiting"}`;
  const timerContent = <><span>{game.isBye ? "BYE" : finished ? "Finalizado" : !playable ? "Aguardando" : leg.inProgress ? "● Em jogo" : "▷ A chamar"}</span>{!game.isBye && <time className="matchStatusTimer">{formatMatchDuration(getMatchElapsedSeconds(leg, now))}</time>}</>;
  return <article className={`gameCard universalMatchCard tc-match ${state.winner || game.isBye ? "gameFinished" : "gameWaiting"} ${game.isBye ? "universalMatchCard--bye" : ""}`} aria-label={round + " · Confronto " + number}>
    <div className="matchCardMeta"><span className="matchCardPhase">{round}</span>
      {!readOnly && playable && !finished && !lockedGroups ? <button type="button" className={timerClass} aria-pressed={Boolean(leg.inProgress)}
        title={leg.inProgress ? "Pausar cronômetro" : "Iniciar cronômetro"} aria-label={labels[selected] + (leg.inProgress ? " · Pausar cronômetro" : " · Iniciar cronômetro")}
        onClick={() => onLegChange(game.matchKey, selected, { inProgress: !leg.inProgress })}>{timerContent}</button> : <span className={timerClass}>{timerContent}</span>}
    </div>
    {!game.isBye && <div className="matchCardControls">
      {readOnly ? <strong className="courtNameBadge">Quadra {courtNumber}</strong>
        : <button type="button" className="courtNameBadge" aria-label={"Quadra · confronto " + number + " · " + labels[selected]}
          disabled={!playable || Boolean(finished) || lockedGroups} onClick={() => setCourtEditorOpen(true)}>
          Quadra {courtNumber} <ChevronDown size={13} aria-hidden="true" />
        </button>}
      {!readOnly && <button type="button" className="voiceBtn matchCallButton" disabled={!playable || Boolean(finished) || lockedGroups} onClick={call}>🔊 Chamar jogo</button>}
    </div>}
    <div className="tc-score-heading tc-score-columns"><span>Equipes</span>{labels.map((label, i) =>
      <button type="button" key={label} title={label} aria-pressed={selected === i} aria-label={"Selecionar " + label} onClick={() => setSelected(i)}><b>{i + 1}º</b><small className="tc-set-label">Set
        {data.teamCup.kind === "squad" && <span className="tc-set-detail">{["Masculino", "Feminino", "Misto"][i]}</span>}
        {i === 2 && <span className="tc-set-detail">Desempate</span>}
      </small></button>)}<span>Total<small>sets</small></span></div>
    <div className="matchTeamStack">{[1, 2].map((side, row) => {
        const team = data.players.teams[game["ids" + side]?.[0]];
        return <React.Fragment key={side}>{side === 2 && <div className="matchVsDivider" aria-hidden="true"><span>VS</span></div>}
          <div className={`matchTeamRow tc-score-columns ${state.winner === "team" + side ? "is-winner" : state.winner ? "is-loser" : ""} ${game.isBye && !team ? "is-bye" : ""}`}>
          <div className="tc-team-identity"><span className="matchTeamName">{team ? teamName(team) : game.isBye ? "BYE" : "Aguardando"}</span>
            {team && <span className="tc-roster">{team.athletes.map(a => a.name + (a.id === team.captainId ? " (C)" : "")).join(" · ")}</span>}</div>
          {game.teamCupLegs.map((part, i) => <span key={i} className="matchScoreCell">
            {game.isBye || (i === 2 && !state.decider) ? <span title={i === 2 ? "Somente em caso de empate em 1 a 1" : "Avanço direto"}>—</span>
              : readOnly ? <output className="matchScoreOutput">{part["s" + side] === "" ? "—" : part["s" + side]}</output>
              : <input className="matchScoreInput" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                aria-label={(team ? teamName(team) : "Aguardando") + " · " + labels[i] + " · games"}
                value={part["s" + side]} disabled={!teamLegAvailable(data, game, i) || lockedGroups}
                onFocus={() => setSelected(i)}
                onChange={e => { if (/^\d?$/.test(e.target.value)) onLegChange(game.matchKey, i, { ["s" + side]: e.target.value }); }} />}
          </span>)}<span className="tc-total">{game.isBye ? "—" : state.wins[row]}</span>
        </div></React.Fragment>;
      })}</div>
    {!game.isBye && ((selected === 2 && !state.decider) || announcementStatus) && <footer className="tc-match-note">
      {selected === 2 && !state.decider && <small>3º set de desempate disponível somente em caso de empate em 1 a 1 nos sets.</small>}
      {announcementStatus && <small role="status">{announcementStatus}</small>}
    </footer>}
    {courtEditorOpen && !readOnly && createPortal(<CourtAssignmentModal editor={{ game: { ...leg, court: game.court || leg.court } }}
      courtNumbers={[...new Set([...(courtOptions || []), ...(data.courtNumbers || [])])]}
      currentNumber={courtNumber}
      unavailableNumbers={unavailableCourts}
      usedNumbers={[...data.schedule.flat(), ...data.brackets].flatMap(g => (g.teamCupLegs || []).flatMap((l, i) => l !== leg && l.inProgress && !teamLegWinner(l, data.winningScore) ? [teamCupCourtNumber(data, g, i, courtOptions)] : []))}
      onSelect={value => { onLegChange(game.matchKey, selected, { courtNumberOverride: value }); onRegisterCourtNumber?.(value); setCourtEditorOpen(false); }}
      onClose={() => setCourtEditorOpen(false)} />, document.body)}
  </article>;
}

export default function TeamCupWorkspace({ data, setData, tournament, onBack, onShare, onOpenCourtCenter, onRegisterCourtNumber, savingStatus = "", savingBadge, readOnly = false, unavailableCourts = [], courtOptions = data.courtNumbers }) {
  const [tab, setTab] = useState(readOnly && data.schedule.length ? "games" : "teams");
  const [organizationTab, setOrganizationTab] = useState("format");
  const [matchesTab, setMatchesTab] = useState("groups");
  const [headerDetailsOpen, setHeaderDetailsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [formatConfirmation, setFormatConfirmation] = useState(null);
  const drawPresentation = useTeamCupDrawPresentation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const locked = data.schedule.length > 0;
  const random = data.teamCup.formation === "random";
  const teams = data.players.teams;
  const groups = locked ? teamCupRankings(data) : [];
  const groupsDone = locked && data.schedule.flat().every(g => teamMatchState(g, data.winningScore).winner);
  const campaignTies = groupsDone && !groups.some(g => g.unresolvedTieIds.length) ? teamCupQualified(data).unresolvedCampaignTies : [];
  const missingParallel = data.brackets.length > 0 && !data.brackets.some(g => g.phase === "repechage");
  useEffect(() => { if (!data.cupConfig.repechageEnabled && matchesTab === "repechage") setMatchesTab("main"); }, [data.cupConfig.repechageEnabled, matchesTab]);
  function change(transform, options) {
    if (readOnly) return;
    setMessage("");
    setData(current => {
      try { return transform(current); } catch (error) { setMessage(error.message); return current; }
    }, options);
  }
  function reconfigure(count, kind) {
    if (teamCupFormatChangeNeedsConfirmation(data, count, kind)) {
      setFormatConfirmation({ count, kind, source: JSON.stringify(data),
        title: "Alterar a configuração das equipes?",
        message: `O torneio passará a ter ${count} equipes no formato ${kind === "squad" ? "Squad" : "Trio"}.`,
        impacts: ["As rodadas, os jogos, os placares e as chaves atuais serão apagados.",
          "Os nomes que couberem nas novas vagas serão preservados; vagas removidas sairão desta competição.",
          "Será necessário criar novamente as rodadas e os jogos."],
        confirmLabel: "Sim, alterar configuração" });
      return;
    }
    change(d => reconfigureTeamCup(d, count, kind));
  }
  function confirmFormatChange() {
    const { count, kind, source } = formatConfirmation;
    setFormatConfirmation(null);
    change(d => {
      if (JSON.stringify(d) !== source) throw new Error("Os dados foram atualizados. Confira a configuração atual e selecione a alteração novamente.");
      return reconfigureTeamCup(d, count, kind, { confirmed: true });
    }, { allowScoreRegression: true });
  }
  function formation(value) {
    change(d => setTeamCupFormation(d, value));
  }
  function onLegChange(key, i, patch) {
    change(d => {
      const game = [...d.schedule.flat(), ...d.brackets].find(g => g.matchKey === key);
      const court = String(patch.courtNumberOverride || teamCupCourtNumber(d, game, i, courtOptions));
      if ((patch.inProgress || ("courtNumberOverride" in patch && game?.teamCupLegs[i]?.inProgress)) && unavailableCourts.map(String).includes(court)) throw new Error("Essa quadra está indisponível ou em uso por outro torneio.");
      const next = updateTeamCupLeg(d, key, i, patch.inProgress ? { ...patch, courtNumberOverride: court } : patch);
      return patch.courtNumberOverride ? { ...next, courtNumbers: [...new Set([...(next.courtNumbers || []), patch.courtNumberOverride])] } : next;
    });
  }
  function presentDraw(title, names, transform) {
    if (readOnly || drawPresentation.busy) return;
    try {
      const source = JSON.stringify(data), next = transform(data);
      setMessage("");
      drawPresentation.present({ title, names, onReveal: () => change(current => {
        if (JSON.stringify(current) !== source) throw new Error("Os dados foram atualizados durante o sorteio. Confira a situação atual e sorteie novamente.");
        return next;
      }) });
    } catch (error) { setMessage(error.message); }
  }
  function drawTie(field, key, ids) {
    presentDraw("Sorteando desempate...", ids.map(id => teamName(teams[id])), d => {
      if (d.brackets.length && !(field === "campaignTieBreakOverrides" && missingParallel && campaignTies.some(t => t.tieKey === key && t.scope === "paralela"))) throw new Error("As eliminatórias já foram geradas.");
      const next = { ...d, cupConfig: { ...d.cupConfig, [field]: { ...d.cupConfig[field], [key]: shuffleTeamCup(ids) } } };
      return setTeamCupConsolationEnabled(next, next.cupConfig.repechageEnabled);
    });
  }
  function generateGroups() {
    if (data.teamCup.groupOrder) change(d => recordTeamCupGroupVideo(generateTeamCupGroups(d)));
    else presentDraw("Sorteando grupos...", teams.map(t => teamName(t)), d => recordTeamCupGroupVideo(generateTeamCupGroups(d), "random"));
  }
  const bracketSections = [...new Set(data.brackets.map(g => g.phase + "|" + g.roundName))];
  const saveIndicator = readOnly ? null : savingBadge || <span className="savingBadge saved">💾 {savingStatus}</span>;
  const matchCard = (game, number, round) => <TeamCupMatchCard key={game.matchKey} data={data} game={game} number={number} round={round} now={now} onLegChange={onLegChange} onRegisterCourtNumber={onRegisterCourtNumber} readOnly={readOnly} courtOptions={courtOptions} unavailableCourts={unavailableCourts} />;
  return <><section className="appPage tc-workspace" inert={drawPresentation.busy || Boolean(formatConfirmation)}>
    <header className={`tournamentWorkspaceHeader ${headerDetailsOpen ? "detailsOpen" : ""}`}>
      <div><div className="tournamentHeaderTitleRow"><h1>{tournament.name}</h1></div>
        <div className="tournamentHeaderMeta" id="tc-header-details"><span><Trophy aria-hidden="true" /> Times/Equipes · {data.teamCup.kind === "squad" ? "Squad" : "Trio"}</span><span><Users aria-hidden="true" /> {teams.length} equipes · {teamSize(data)} atletas por equipe</span></div></div>
      <div className="actions tournamentHeaderActions"><button type="button" className="tournamentHeaderDetailsToggle" aria-controls="tc-header-details" aria-expanded={headerDetailsOpen} onClick={() => setHeaderDetailsOpen(open => !open)}>Informações <ChevronDown aria-hidden="true" /></button>{!readOnly && onShare && <button type="button" className="tournamentHeaderShareButton" onClick={onShare}><Share2 aria-hidden="true" /> Compartilhar</button>}{onBack && <button type="button" onClick={onBack}>Voltar</button>}</div>
    </header>
    <nav className={`tournamentTopTabs ${readOnly ? "publicTournamentTabs" : ""}`} aria-label="Organização do torneio">{[["teams", readOnly ? "Equipes" : "Organização", Users], ["groups", "Grupos", Grid3X3], ["games", "Partidas", Flame], ["ranking", "Ranking", Trophy]].map(([key, label, Icon]) =>
      <button type="button" key={key} aria-current={tab === key ? "page" : undefined} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon aria-hidden="true" /> {label}</button>)}</nav>
    {message && <p className="tc-message" role="alert">{message}</p>}
    {tab === "teams" && <section className="card">
      <div className="cardTitleRow"><h2>{readOnly ? "Equipes" : "Organização do torneio"}</h2>{saveIndicator}</div>
      {!readOnly && <nav className="organizationSubTabs" aria-label="Configuração do torneio">
        <button type="button" className={organizationTab === "format" ? "active" : ""} onClick={() => setOrganizationTab("format")}>Formato do torneio</button>
        <button type="button" className={organizationTab === "players" ? "active" : ""} onClick={() => setOrganizationTab("players")}>Participantes</button>
        {onOpenCourtCenter && <button type="button" className="organizationCourtCenterShortcut" onClick={onOpenCourtCenter}><Grid3X3 aria-hidden="true" /> Quadras</button>}
      </nav>}
      {!readOnly && organizationTab === "format" && <div className="organizationPanel cupConfigBox"><div className="twoCols tc-fields">
        <Field label="Formação da equipe"><select value={data.teamCup.kind} onChange={e => reconfigure(teams.length, e.target.value)}><option value="trio">Trio · 3 atletas, composição livre</option><option value="squad">Squad · 2 atletas do masculino e 2 do feminino</option></select></Field>
        <Field label="Quantidade de equipes"><select value={teams.length} onChange={e => reconfigure(Number(e.target.value), data.teamCup.kind)}>{TEAM_COUNTS.map(n => <option key={n} value={n}>{n} equipes</option>)}</select></Field>
        <Field label="Formação"><select value={data.teamCup.formation} onChange={e => formation(e.target.value)}><option value="fixed">Equipes já definidas</option><option value="random">Sorteio de capitães e integrantes</option></select></Field>
        <Field label="Nome da chave principal"><input value={data.cupConfig.mainBracketName} maxLength={70} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, mainBracketName: e.target.value } }))} /></Field>
        <Field label="Games por set"><select value={data.winningScore} onChange={e => change(d => ({ ...d, winningScore: Number(e.target.value) }))}><option value={4}>4 games</option><option value={6}>6 games</option></select></Field>
      </div>
        <div className="tc-format-explanation"><FormatExplanationButton label={`Como funciona com ${teams.length} equipes`} eyebrow={`Formato calculado para ${teams.length} equipes`} title={`Times/Equipes · ${data.teamCup.kind === "squad" ? "Squad" : "Trio"}`}
          sections={[
            { title: "Grupos e classificação", content: <p>Grupos de 3, usando grupos de 4 quando necessário. Os dois melhores de cada grupo avançam. Somente os eliminados dos grupos entram no Consolation, quando habilitado.</p> },
            { title: "Sets da partida", content: <p>{data.teamCup.kind === "squad" ? "O 1º set (masculino) e o 2º set (feminino) podem ocorrer simultaneamente em quadras diferentes. Em 1 a 1, a equipe escolhe a dupla mista para o 3º set de desempate." : "1º set e 2º set em sequência; o 3º set de desempate ocorre somente em caso de empate em 1 a 1. As duplas e substituições ficam a cargo da equipe."}</p> },
            { title: "Resultado e capitães", content: <p>Os três sets usam a mesma regra de games. Quem vencer dois sets ganha a partida entre as equipes. O capitão ou a capitã faz parte da equipe.</p> },
          ]} /></div>
        <div className="twoCols tc-fields">
          <div className="parallelDisputeChoice"><div className="parallelChoiceHeading"><strong>Realizar 1ª disputa paralela?</strong></div>
            <div className="parallelChoiceOptions" role="radiogroup" aria-label="Realizar 1ª disputa paralela?">{[[true, "Sim"], [false, "Não"]].map(([enabled, label]) => <button key={label} type="button" role="radio" aria-checked={data.cupConfig.repechageEnabled === enabled}
              className={data.cupConfig.repechageEnabled === enabled ? "selected " + (enabled ? "yes" : "no") : ""} onClick={() => change(d => setTeamCupConsolationEnabled(d, enabled))}>{label}</button>)}</div>
            <p className="tc-help">A chave é preparada junto às eliminatórias. Sim exibe a disputa; Não apenas a oculta, sem apagar os placares.</p>
          </div>
          {data.cupConfig.repechageEnabled && <Field label="Nome da 1ª disputa paralela"><input value={data.cupConfig.repechageName} maxLength={70} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, repechageName: e.target.value } }))} /></Field>}
        </div>
      </div>}
      {organizationTab === "players" && !readOnly && <div className="organizationPanel"><TeamCupParticipants data={data} tournament={tournament} onChange={change} /></div>}
      {readOnly && <div className="tc-team-grid">{teams.map(team => <section className="tc-panel" key={team.id}><h2>{teamName(team)}</h2>
        <ul className="tc-member-list">{team.athletes.map(a => <li key={a.id}>{a.name || "A definir"} {a.id === team.captainId && <span className="tc-captain">Capitão/ã</span>}</li>)}</ul>
      </section>)}</div>}
    </section>}
    {tab === "groups" && <section className="card">
      <div className="cardTitleRow"><h2>{tab === "groups" ? "Grupos" : "Ranking"}</h2>{saveIndicator}</div>
      {tab === "groups" && !readOnly && <TeamCupVideoActions data={data} tournament={tournament} only="groups" />}
      {tab === "groups" && !readOnly && !locked && <><p>Forme as equipes em Organização → Participantes. Salve a formação em Organizar grupos e depois gere os confrontos.</p><div className="actions"><button type="button" className="actionGenerateBtn" disabled={drawPresentation.busy || (random && data.teamCup.drawStage !== "complete")} onClick={generateGroups}>{data.teamCup.groupOrder ? "Gerar fase de grupos" : "Sortear grupos e gerar confrontos"}</button></div></>}
      <h3>Classificação dos grupos</h3>
      <p className="tc-help">Ordem: vitórias em confrontos → saldo de games → total de games → confronto direto → sorteio. O saldo soma os games dos sets concluídos de cada partida finalizada, incluindo o desempate.</p>
      <div className="tc-team-grid">{groups.map(group => <section key={group.id}>
        <RankingTable title={group.name} rows={group.rows} rankingCriteria="wins_balance_points" showPodium={false}
          nameColumnLabel="Equipe" renderName={row => {
            const team = teams[row.id];
            return <div className="tc-group-team"><span>{row.name}</span>
              {team && <span className="tc-roster">{team.athletes.map(a => a.name + (a.id === team.captainId ? " (C)" : "")).join(" · ")}</span>}
            </div>;
          }} columns={[{ key: "w", label: "Vitórias" }, { key: "bal", label: "Saldo de games" }, { key: "pts", label: "Total de games" }]} />
        {groupsDone && !group.unresolvedTieIds.length && <p className="tc-help">Principal: {group.rows.slice(0, 2).map(r => r.name).join(", ")}. {data.cupConfig.repechageEnabled ? "Consolation" : "Eliminados"}: {group.rows.slice(2).map(r => r.name).join(", ")}.</p>}
        {group.unresolvedTieIds.length > 0 && <div className="tc-tie"><p>Empate: {group.rows.filter(r => group.unresolvedTieIds.includes(r.id)).map(r => r.name).join(", ")}.</p>{!readOnly && !data.brackets.length && <button type="button" onClick={() => drawTie("tieBreakOverrides", String(group.id), group.unresolvedTieIds)}>Sortear desempate do grupo</button>}</div>}
      </section>)}</div>
      {campaignTies.map(tie => <section className="tc-panel" key={tie.tieKey}><p>Empate de campanha ({tie.scope === "paralela" ? "eliminados dos grupos" : tie.scope}): {tie.rows.map(r => r.name).join(", ")}.</p>{!readOnly && (!data.brackets.length || (missingParallel && tie.scope === "paralela")) && <button type="button" onClick={() => drawTie("campaignTieBreakOverrides", tie.tieKey, tie.teamIds)}>Sortear ordem de campanha</button>}</section>)}
      {!locked && <p className="tc-panel">A classificação aparece após gerar os grupos.</p>}
    </section>}
    {tab === "ranking" && <section className="card">
      <div className="cardTitleRow"><h2>Ranking</h2>{saveIndicator}</div>
      <div className="cupRankingSplit">{[["main", data.cupConfig.mainBracketName || "Principal"], ...(data.cupConfig.repechageEnabled ? [["repechage", data.cupConfig.repechageName || "Consolation"]] : [])].map(([phase, title]) => {
        const podium = teamCupPodium(data, phase);
        return <div className="cupRankingPanel" key={phase}><h3>{title}</h3>{podium.length ? <CupPodiumView podium={podium} title={title} variant={phase === "main" ? "main" : "parallel"}
          shareContext={{ title: tournament.name, modalityName: `Times/Equipes · ${data.teamCup.kind === "squad" ? "Squad" : "Trio"}`, rankingCriteria: "wins_balance_points" }} /> : <p>Finalize {phase === "main" ? "a chave principal" : "a disputa paralela"} para ver o pódio.</p>}</div>;
      })}</div>
    </section>}
    {tab === "games" && <section className="card tournamentMatchesSection">
      <div className="cardTitleRow"><h2>Partidas</h2>{saveIndicator}</div>
      <nav className="matchesSubTabs" aria-label="Fases da competição">{[["groups", "Fase de grupos"], ["main", "Chaves finais"], ...(data.cupConfig.repechageEnabled ? [["repechage", data.cupConfig.repechageName || "Consolation"]] : [])].map(([key, label]) =>
        <button type="button" key={key} className={matchesTab === key ? "active" : ""} onClick={() => setMatchesTab(key)}>{label}</button>)}</nav>
      {matchesTab === "groups" ? locked ? <div className="schedule">{[...new Set(data.schedule.flat().map(g => g.groupName))].map(name => <section className="roundCard scheduleGroupSection" key={name}>
        <div className="roundHeader scheduleGroupHeader"><h3><span>Grupo</span> <strong>{name.replace(/^grupo\s+/i, "")}</strong></h3></div>
        {data.schedule.flatMap((games, r) => games.map((game, g) => game.groupName === name ? matchCard(game, g + 1, "Rodada " + (r + 1)) : null))}
      </section>)}</div> : <p>Os confrontos aparecem depois de formar as equipes e sortear os grupos.</p> : <>
      {!data.brackets.length && <><p>Conclua os grupos e resolva eventuais empates na aba Grupos. Depois, gere as chaves finais.</p>{!readOnly && <div className="actions"><button type="button" className="actionGenerateBtn" disabled={!groupsDone} onClick={() => change(d => generateTeamCupBrackets(d))}>Gerar chaves finais{data.cupConfig.repechageEnabled ? " e Consolation" : ""}</button></div>}</>}
      {matchesTab === "repechage" && missingParallel && <p>Resolva o empate de campanha dos eliminados na aba Grupos para definir os confrontos.</p>}
      {bracketSections.filter(section => section.startsWith(matchesTab + "|") && (matchesTab !== "repechage" || data.cupConfig.repechageEnabled)).map(section => {
        const [phase, round] = section.split("|");
        const games = data.brackets.filter(g => g.phase === phase && g.roundName === round);
        return <section className="tc-round" key={section}><h3>{phase === "main" ? data.cupConfig.mainBracketName : data.cupConfig.repechageName} · {round}</h3><div className="tc-match-grid">{games.map((game, i) => matchCard(game, i + 1, round))}</div></section>;
      })}
      </>}
    </section>}
  </section><ConfirmRegenerationModal confirmation={formatConfirmation} onCancel={() => setFormatConfirmation(null)} onConfirm={confirmFormatChange} />{drawPresentation.overlay}</>;
}
