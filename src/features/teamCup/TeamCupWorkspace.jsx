import React, { useEffect, useState } from "react";
import { ChevronDown, Flame, Grid3X3, Share2, Trophy, Users } from "lucide-react";
import { RankingTable } from "../ranking/RankingTables.jsx";
import FormatExplanationButton from "../tournamentConfig/FormatExplanationButton.jsx";
import { createTeamCupData, drawTeamCaptains, drawTeamMembers, generateTeamCupGroups, generateTeamCupBrackets,
  TEAM_COUNTS, TEAM_LEVELS, teamSize, teamName, teamCupRankings, teamCupQualified, shuffleTeamCup,
  teamLegAvailable, teamLegWinner, teamMatchState, resolveTeamCupGame, updateTeamCupLeg } from "../../domain/teamCup.mjs";
import { formatMatchDuration, getMatchElapsedSeconds } from "../../domain/matchTimer.mjs";
import "../../styles/31-matches-and-brackets.css";
import "./teamCup.css";

const legTitles = kind => kind === "squad" ? ["Masculina", "Feminina", "Mista"] : ["1ª partida", "2ª partida", "Desempate"];
function Field({ label, children }) { return <label className="tc-field"><span>{label}</span>{children}</label>; }

export function TeamCupMatchCard({ data, game: storedGame, number, round, onLegChange, readOnly = false, now = Date.now(), courtOptions = data.courtNumbers }) {
  const [selected, setSelected] = useState(0);
  const [announcementStatus, setAnnouncementStatus] = useState("");
  const game = resolveTeamCupGame(data, storedGame);
  const state = teamMatchState(game, data.winningScore);
  const labels = legTitles(data.teamCup.kind);
  const leg = game.teamCupLegs[selected];
  const playable = teamLegAvailable(data, game, selected);
  const finished = teamLegWinner(leg, data.winningScore);
  const lockedGroups = game.phase === "groups" && data.brackets.length > 0;
  const status = game.isBye ? "BYE · avanço direto" : !game.ids1.length || !game.ids2.length ? "Aguardando definição"
    : state.winner ? "Confronto finalizado" : state.decider ? "Desempate necessário" : "Melhor de 3 partidas";
  const call = () => {
    const names = [game.ids1[0], game.ids2[0]].map(i => teamName(data.players.teams[i]));
    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(labels[selected] + ". " + names[0] + " contra " + names[1] + ". Quadra " + leg.courtNumberOverride + ".");
      speech.onerror = () => setAnnouncementStatus("Não foi possível reproduzir a chamada. Verifique o áudio do navegador.");
      setAnnouncementStatus("Chamada: " + names.join(" × ") + " · Quadra " + leg.courtNumberOverride);
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
      {readOnly ? <strong className="courtNameBadge">{leg.courtNumberOverride ? "Quadra " + leg.courtNumberOverride : "Quadra a definir"}</strong>
        : <select className="courtNameBadge" aria-label={"Quadra · confronto " + number + " · " + labels[selected]} value={leg.courtNumberOverride || ""}
          disabled={!playable || Boolean(finished) || lockedGroups} onChange={e => onLegChange(game.matchKey, selected, { courtNumberOverride: e.target.value })}>
          <option value="">Escolher quadra</option>{[...new Set([...(courtOptions || []), leg.courtNumberOverride].filter(Boolean))].map(c => <option key={c} value={c}>Quadra {c}</option>)}
        </select>}
      {!readOnly && <button type="button" className="voiceBtn matchCallButton" disabled={!playable || Boolean(finished) || !leg.courtNumberOverride || lockedGroups} onClick={call}>🔊 Chamar jogo</button>}
    </div>}
    <div className="tc-score-heading tc-score-columns"><span>Equipes</span>{labels.map((label, i) =>
      <button type="button" key={label} aria-pressed={selected === i} aria-label={"Selecionar " + label} onClick={() => setSelected(i)}><b>{i + 1}ª</b><small>{label}</small></button>)}<span>Total<small>vitórias</small></span></div>
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
    {!game.isBye && <footer className="tc-match-note">
      <span><b>{labels[selected]}</b> · {status}</span>
      {selected === 2 && !state.decider && <small>Disponível somente se as duas primeiras partidas terminarem em 1 a 1.</small>}
      {announcementStatus && <small role="status">{announcementStatus}</small>}
    </footer>}
  </article>;
}

export default function TeamCupWorkspace({ data, setData, tournament, onBack, onShare, onOpenCourtCenter, savingStatus = "", savingBadge, readOnly = false, unavailableCourts = [], courtOptions = data.courtNumbers }) {
  const [tab, setTab] = useState(readOnly && data.schedule.length ? "games" : "teams");
  const [organizationTab, setOrganizationTab] = useState("format");
  const [matchesTab, setMatchesTab] = useState("groups");
  const [headerDetailsOpen, setHeaderDetailsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const locked = data.schedule.length > 0;
  const random = data.teamCup.formation === "random";
  const teams = data.players.teams;
  const groups = locked ? teamCupRankings(data) : [];
  const groupsDone = locked && data.schedule.flat().every(g => teamMatchState(g, data.winningScore).winner);
  const campaignTies = groupsDone && !groups.some(g => g.unresolvedTieIds.length) ? teamCupQualified(data).unresolvedCampaignTies.filter(t => t.scope !== "paralela" || data.cupConfig.repechageEnabled) : [];
  function change(transform) {
    if (readOnly) return;
    setMessage("");
    setData(current => {
      try { return transform(current); } catch (error) { setMessage(error.message); return current; }
    });
  }
  function editSetting(key, value) { change(d => ({ ...d, teamCup: { ...d.teamCup, [key]: value } })); }
  function reconfigure(count, kind) {
    if (locked) return;
    const hasNames = teams.some(t => t.athletes.some(a => a.name.trim())) || data.teamCup.pool.some(a => a.name.trim());
    if (hasNames && !window.confirm("Alterar a quantidade ou o formato reinicia somente o cadastro desta nova competição. Continuar?")) return;
    change(d => createTeamCupData(d, count, kind));
  }
  function formation(value) {
    if (locked || value === data.teamCup.formation) return;
    if (data.teamCup.drawStage !== "pending" && !window.confirm("Reiniciar a formação? Os atletas serão mantidos na lista do sorteio.")) return;
    change(d => {
      const pool = d.teamCup.formation === "fixed" ? d.players.teams.flatMap(t => t.athletes) : d.teamCup.pool;
      let nextTeams = d.players.teams;
      if (value === "fixed" && nextTeams.some(t => t.athletes.length !== teamSize(d))) {
        nextTeams = nextTeams.map((t, i) => ({ ...t, athletes: pool.slice(i * teamSize(d), (i + 1) * teamSize(d)), captainId: pool[i * teamSize(d)]?.id }));
      }
      return { ...d, players: { ...d.players, teams: nextTeams }, teamCup: { ...d.teamCup, formation: value, pool: structuredClone(pool), drawStage: "pending" } };
    });
  }
  function editTeam(index, patch) { change(d => ({ ...d, players: { ...d.players, teams: d.players.teams.map((t, i) => i === index ? { ...t, ...patch, ...(patch.name !== undefined ? { a: patch.name } : {}) } : t) } })); }
  function editAthlete(index, athleteIndex, key, value) {
    change(d => {
      const copy = structuredClone(d);
      const athlete = index === null ? copy.teamCup.pool[athleteIndex] : copy.players.teams[index].athletes[athleteIndex];
      athlete[key] = value;
      return copy;
    });
  }
  function athleteRow(a, i, teamIndex = null) {
    const frozen = readOnly || locked || (teamIndex === null && data.teamCup.drawStage !== "pending");
    return <div className="tc-athlete" key={a.id}>
      <span className="tc-athlete-index">{i + 1}</span>
      <input aria-label={"Atleta " + (i + 1) + (teamIndex === null ? "" : " · " + teamName(teams[teamIndex]))} placeholder={"Nome do atleta " + (i + 1)} maxLength={100}
        value={a.name} disabled={frozen} onChange={e => editAthlete(teamIndex, i, "name", e.target.value)} />
      <select aria-label={"Composição · " + (a.name || "atleta " + (i + 1))} value={a.gender} disabled={frozen} onChange={e => editAthlete(teamIndex, i, "gender", e.target.value)}><option value="H">H</option><option value="M">M</option></select>
      {!readOnly && <select aria-label={"Nível · " + (a.name || "atleta " + (i + 1))} value={a.level} disabled={frozen} onChange={e => editAthlete(teamIndex, i, "level", e.target.value)}>
        <option value="">Nível</option>{TEAM_LEVELS.map(l => <option key={l}>{l}</option>)}
      </select>}
      {teamIndex === null ? data.teamCup.designatedCaptains && <label className="tc-check"><input type="checkbox" checked={Boolean(a.captainCandidate)} disabled={frozen}
        onChange={e => editAthlete(null, i, "captainCandidate", e.target.checked)} />Cap.</label> : <label className="tc-check" title="Capitão ou capitã">
        <input type="radio" name={"captain-" + teams[teamIndex].id} checked={teams[teamIndex].captainId === a.id} disabled={frozen || random}
          onChange={() => editTeam(teamIndex, { captainId: a.id })} />Cap.</label>}
    </div>;
  }
  function onLegChange(key, i, patch) {
    change(d => {
      const game = [...d.schedule.flat(), ...d.brackets].find(g => g.matchKey === key);
      const court = String(patch.courtNumberOverride ?? game?.teamCupLegs[i]?.courtNumberOverride ?? "");
      if ((patch.inProgress || ("courtNumberOverride" in patch && game?.teamCupLegs[i]?.inProgress)) && unavailableCourts.map(String).includes(court)) throw new Error("Essa quadra está indisponível ou em uso por outro torneio.");
      return updateTeamCupLeg(d, key, i, patch);
    });
  }
  function drawTie(field, key, ids) {
    change(d => {
      if (d.brackets.length) throw new Error("As eliminatórias já foram geradas.");
      return { ...d, cupConfig: { ...d.cupConfig, [field]: { ...d.cupConfig[field], [key]: shuffleTeamCup(ids) } } };
    });
  }
  const bracketSections = [...new Set(data.brackets.map(g => g.phase + "|" + g.roundName))];
  const saveIndicator = readOnly ? null : savingBadge || <span className="savingBadge saved">💾 {savingStatus}</span>;
  const matchCard = (game, number, round) => <TeamCupMatchCard key={game.matchKey} data={data} game={game} number={number} round={round} now={now} onLegChange={onLegChange} readOnly={readOnly} courtOptions={courtOptions} />;
  return <section className="appPage tc-workspace">
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
        <Field label="Quantidade de equipes"><select value={teams.length} disabled={locked} onChange={e => reconfigure(Number(e.target.value), data.teamCup.kind)}>{TEAM_COUNTS.map(n => <option key={n} value={n}>{n} equipes</option>)}</select></Field>
        <Field label="Nome da chave principal"><input value={data.cupConfig.mainBracketName} maxLength={70} disabled={locked} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, mainBracketName: e.target.value } }))} /></Field>
        <Field label="Formação da equipe"><select value={data.teamCup.kind} disabled={locked} onChange={e => reconfigure(teams.length, e.target.value)}><option value="trio">Trio · 3 atletas, composição livre</option><option value="squad">Squad · 2 homens e 2 mulheres</option></select></Field>
        <Field label="Formação"><select value={data.teamCup.formation} disabled={locked} onChange={e => formation(e.target.value)}><option value="fixed">Equipes já definidas</option><option value="random">Sorteio de capitães e integrantes</option></select></Field>
        <Field label="Games por partida"><select value={data.winningScore} disabled={locked} onChange={e => change(d => ({ ...d, winningScore: Number(e.target.value) }))}><option value={4}>4 games</option><option value={6}>6 games</option></select></Field>
      </div>
        <div className="tc-format-explanation"><FormatExplanationButton label={`Como funciona com ${teams.length} equipes`} eyebrow={`Formato calculado para ${teams.length} equipes`} title={`Times/Equipes · ${data.teamCup.kind === "squad" ? "Squad" : "Trio"}`}
          sections={[
            { title: "Grupos e classificação", content: <p>Grupos de 3, usando grupos de 4 quando necessário. Os dois melhores de cada grupo avançam. Somente os eliminados dos grupos entram no Consolation, quando habilitado.</p> },
            { title: "Partidas do confronto", content: <p>{data.teamCup.kind === "squad" ? "Masculina e feminina podem ocorrer simultaneamente em quadras diferentes. Em 1 a 1, a equipe escolhe a dupla mista para o desempate." : "Duas partidas em sequência; a terceira ocorre somente em caso de empate em 1 a 1. As duplas e substituições ficam a cargo da equipe."}</p> },
            { title: "Resultado e capitães", content: <p>As três partidas usam a mesma regra de games. Quem vencer duas ganha o confronto. O capitão ou a capitã faz parte da equipe.</p> },
          ]} /></div>
        <div className="twoCols tc-fields">
          <div className="parallelDisputeChoice"><div className="parallelChoiceHeading"><strong>Realizar 1ª disputa paralela?</strong></div>
            <div className="parallelChoiceOptions" role="radiogroup" aria-label="Realizar 1ª disputa paralela?">{[[true, "Sim"], [false, "Não"]].map(([enabled, label]) => <button key={label} type="button" role="radio" aria-checked={data.cupConfig.repechageEnabled === enabled} disabled={locked}
              className={data.cupConfig.repechageEnabled === enabled ? "selected " + (enabled ? "yes" : "no") : ""} onClick={() => change(d => ({ ...d, cupConfig: { ...d.cupConfig, repechageEnabled: enabled } }))}>{label}</button>)}</div>
          </div>
          {data.cupConfig.repechageEnabled && <Field label="Nome da 1ª disputa paralela"><input value={data.cupConfig.repechageName} disabled={locked} maxLength={70} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, repechageName: e.target.value } }))} /></Field>}
        </div>
        {locked && <p className="tc-help">Formação e regras protegidas: os grupos já foram gerados.</p>}
      </div>}
      {(readOnly || organizationTab === "players") && <div className="organizationPanel">
      {!readOnly && random && !locked && <section className="tc-panel"><h2>Sorteio em duas etapas</h2><div className="tc-actions">
        <label className="tc-check"><input type="checkbox" checked={data.teamCup.designatedCaptains} disabled={data.teamCup.drawStage !== "pending"} onChange={e => editSetting("designatedCaptains", e.target.checked)} />Definir previamente quem pode ser capitão</label>
        <label className="tc-check"><input type="checkbox" checked={data.teamCup.balanced} disabled={data.teamCup.drawStage !== "pending"} onChange={e => editSetting("balanced", e.target.checked)} />Equilibrar equipes por nível</label>
      </div><p className="tc-help">H = homem · M = mulher. {data.teamCup.designatedCaptains ? "Marque exatamente " + teams.length + " capitães para o sorteio separado." : "O primeiro sorteio seleciona um atleta para liderar cada equipe."} O equilíbrio considera também os capitães; não garante forças idênticas.</p>
        <div className="tc-pool">{data.teamCup.pool.map((a, i) => athleteRow(a, i))}</div><div className="tc-actions">
          <button type="button" className="actionShuffleBtn" disabled={data.teamCup.drawStage !== "pending"} onClick={() => change(d => drawTeamCaptains(d))}>1. Sortear capitães</button>
          <button type="button" className="actionShuffleBtn" disabled={data.teamCup.drawStage !== "captains"} onClick={() => change(d => drawTeamMembers(d))}>2. Sortear integrantes</button>
          <span>{data.teamCup.drawStage === "complete" ? "Equipes formadas" : data.teamCup.drawStage === "captains" ? "Capitães definidos · falta sortear integrantes" : "Aguardando o primeiro sorteio"}</span>
        </div></section>}
      <div className="tc-team-grid">{teams.map((team, i) => <section className="tc-panel" key={team.id}>
        {readOnly ? <h2>{teamName(team)}</h2> : <Field label={"Nome da equipe " + (i + 1)}><input value={team.name} maxLength={60} onChange={e => editTeam(i, { name: e.target.value })} /></Field>}
        {readOnly || locked || (random && data.teamCup.drawStage !== "pending") ? <ul className="tc-member-list">{team.athletes.map(a => <li key={a.id}>{a.name || "A definir"} {a.id === team.captainId && <span className="tc-captain">Capitão/ã</span>}</li>)}</ul> : !random && team.athletes.map((a, j) => athleteRow(a, j, i))}
        {random && data.teamCup.drawStage === "pending" && !locked && <p className="tc-help">Aguardando sorteio.</p>}
      </section>)}</div>
      </div>}
    </section>}
    {(tab === "groups" || tab === "ranking") && <section className="card">
      <div className="cardTitleRow"><h2>{tab === "groups" ? "Grupos" : "Ranking"}</h2>{saveIndicator}</div>
      {tab === "groups" && !readOnly && !locked && <><p>Forme as equipes em Organização → Participantes. Depois, sorteie os grupos e gere os confrontos.</p><div className="actions"><button type="button" className="actionGenerateBtn" disabled={random && data.teamCup.drawStage !== "complete"} onClick={() => change(d => generateTeamCupGroups(d))}>Sortear grupos e gerar confrontos</button></div></>}
      <h3>Classificação dos grupos</h3>
      <p className="tc-help">Ordem: vitórias em confrontos → saldo de games → total de games → confronto direto → sorteio. O saldo soma os games das partidas concluídas de cada confronto finalizado, incluindo o desempate.</p>
      <div className="tc-team-grid">{groups.map(group => <section key={group.id}>
        <RankingTable title={group.name} rows={group.rows} rankingCriteria="wins_balance_points" showPodium={false} columns={[{ key: "w", label: "Vitórias" }, { key: "bal", label: "Saldo de games" }, { key: "pts", label: "Total de games" }]} />
        {groupsDone && !group.unresolvedTieIds.length && <p className="tc-help">Principal: {group.rows.slice(0, 2).map(r => r.name).join(", ")}. {data.cupConfig.repechageEnabled ? "Consolation" : "Eliminados"}: {group.rows.slice(2).map(r => r.name).join(", ")}.</p>}
        {group.unresolvedTieIds.length > 0 && <div className="tc-tie"><p>Empate: {group.rows.filter(r => group.unresolvedTieIds.includes(r.id)).map(r => r.name).join(", ")}.</p>{!readOnly && !data.brackets.length && <button type="button" onClick={() => drawTie("tieBreakOverrides", String(group.id), group.unresolvedTieIds)}>Sortear desempate do grupo</button>}</div>}
      </section>)}</div>
      {campaignTies.map(tie => <section className="tc-panel" key={tie.tieKey}><p>Empate de campanha ({tie.scope}): {tie.rows.map(r => r.name).join(", ")}.</p>{!readOnly && !data.brackets.length && <button type="button" onClick={() => drawTie("campaignTieBreakOverrides", tie.tieKey, tie.teamIds)}>Sortear ordem de campanha</button>}</section>)}
      {!locked && <p className="tc-panel">A classificação aparece após gerar os grupos.</p>}
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
      {bracketSections.filter(section => section.startsWith(matchesTab + "|")).map(section => {
        const [phase, round] = section.split("|");
        const games = data.brackets.filter(g => g.phase === phase && g.roundName === round);
        return <section className="tc-round" key={section}><h3>{phase === "main" ? data.cupConfig.mainBracketName : data.cupConfig.repechageName} · {round}</h3><div className="tc-match-grid">{games.map((game, i) => matchCard(game, i + 1, round))}</div></section>;
      })}
      </>}
    </section>}
  </section>;
}
