import React, { useEffect, useState } from "react";
import { createTeamCupData, drawTeamCaptains, drawTeamMembers, generateTeamCupGroups, generateTeamCupBrackets,
  TEAM_COUNTS, TEAM_LEVELS, teamSize, teamName, teamCupRankings, teamCupQualified, shuffleTeamCup,
  teamLegAvailable, teamLegWinner, teamMatchState, resolveTeamCupGame, updateTeamCupLeg } from "../../domain/teamCup.mjs";
import { formatMatchDuration, getMatchElapsedSeconds } from "../../domain/matchTimer.mjs";
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
  return <article className="tc-match" aria-label={"Confronto " + number}>
    <header className="tc-match-header"><span>{round} · Confronto {number}</span><span className={state.winner ? "tc-status tc-done" : "tc-status"}>{status}</span></header>
    <table className="tc-score-table">
      <colgroup><col className="tc-team-col" /><col /><col /><col /><col /></colgroup>
      <thead><tr><th scope="col">Equipes</th>{labels.map((label, i) => <th scope="col" key={label}>
        <button type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}><b>{i + 1}ª</b><small>{label}</small></button>
      </th>)}<th scope="col">Total<small>vitórias</small></th></tr></thead>
      <tbody>{[1, 2].map((side, row) => {
        const team = data.players.teams[game["ids" + side]?.[0]];
        return <tr key={side} className={state.winner === "team" + side ? "tc-winner" : ""}>
          <th scope="row"><strong>{team ? teamName(team) : game.isBye ? "BYE" : "Aguardando"}</strong>
            {team && <span className="tc-roster">{team.athletes.map(a => a.name + (a.id === team.captainId ? " (C)" : "")).join(" · ")}</span>}</th>
          {game.teamCupLegs.map((part, i) => <td key={i} className={selected === i ? "tc-selected" : ""}>
            {game.isBye || (i === 2 && !state.decider) ? <span title={i === 2 ? "Somente em caso de empate em 1 a 1" : "Avanço direto"}>—</span>
              : readOnly ? <strong>{part["s" + side] === "" ? "—" : part["s" + side]}</strong>
              : <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                aria-label={(team ? teamName(team) : "Aguardando") + " · " + labels[i] + " · games"}
                value={part["s" + side]} disabled={!teamLegAvailable(data, game, i) || lockedGroups}
                onFocus={() => setSelected(i)}
                onChange={e => { if (/^\d?$/.test(e.target.value)) onLegChange(game.matchKey, i, { ["s" + side]: e.target.value }); }} />}
          </td>)}<td className="tc-total">{game.isBye ? "—" : state.wins[row]}</td>
        </tr>;
      })}</tbody>
    </table>
    {!game.isBye && <footer className="tc-match-controls">
      <strong>{labels[selected]}</strong>
      {readOnly ? <span>{leg.courtNumberOverride ? "Quadra " + leg.courtNumberOverride : "Quadra a definir"}</span>
        : <select aria-label={"Quadra · confronto " + number + " · " + labels[selected]} value={leg.courtNumberOverride || ""}
          disabled={!playable || Boolean(finished) || lockedGroups} onChange={e => onLegChange(game.matchKey, selected, { courtNumberOverride: e.target.value })}>
          <option value="">Escolher quadra</option>{[...new Set([...(courtOptions || []), leg.courtNumberOverride].filter(Boolean))].map(c => <option key={c} value={c}>Quadra {c}</option>)}
        </select>}
      <span className="tc-timer">{finished ? "Finalizada" : leg.inProgress ? "Em jogo" : "A chamar"} · {formatMatchDuration(getMatchElapsedSeconds(leg, now))}</span>
      {!readOnly && <>
        <button type="button" disabled={!playable || Boolean(finished) || !leg.courtNumberOverride || lockedGroups} onClick={call}>Chamar jogo</button>
        <button type="button" className="tc-primary" disabled={!playable || Boolean(finished) || lockedGroups}
          onClick={() => onLegChange(game.matchKey, selected, { inProgress: !leg.inProgress })}>{leg.inProgress ? "Pausar" : "Iniciar cronômetro"}</button>
      </>}
      {selected === 2 && !state.decider && <small>Disponível somente se as duas primeiras partidas terminarem em 1 a 1.</small>}
      {announcementStatus && <small role="status">{announcementStatus}</small>}
    </footer>}
  </article>;
}

export default function TeamCupWorkspace({ data, setData, tournament, onBack, onShare, savingStatus = "", readOnly = false, unavailableCourts = [], courtOptions = data.courtNumbers }) {
  const [tab, setTab] = useState(data.schedule.length ? "games" : "teams");
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
  return <section className="tc-workspace">
    <header className="tc-page-header">
      <div><span className="tc-eyebrow">COPA · TIMES/EQUIPES · {data.teamCup.kind === "squad" ? "SQUAD" : "TRIO"}</span><h1>{tournament.name}</h1>
        <p>{teams.length} equipes · {teamSize(data)} atletas por equipe · Capitão incluído na equipe</p></div>
      <div className="tc-actions">{onBack && <button type="button" onClick={onBack}>Voltar</button>}{!readOnly && onShare && <button type="button" onClick={onShare}>Compartilhar</button>}
        {!readOnly && <span className="tc-save" role="status">{savingStatus}</span>}</div>
    </header>
    <nav className="tc-tabs" aria-label="Times/Equipes">{[["teams", "Equipes"], ["games", "Rodadas e placares"], ["ranking", "Classificação"], ["brackets", "Eliminatórias"]].map(([key, label]) =>
      <button type="button" key={key} aria-current={tab === key ? "page" : undefined} className={tab === key ? "tc-active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {message && <p className="tc-message" role="alert">{message}</p>}
    {tab === "teams" && <>
      {!readOnly && <section className="tc-panel"><h2>Formato e formação</h2><div className="tc-fields">
        <Field label="Formato"><select value={data.teamCup.kind} disabled={locked} onChange={e => reconfigure(teams.length, e.target.value)}><option value="trio">Trio · 3 atletas, composição livre</option><option value="squad">Squad · 2 homens e 2 mulheres</option></select></Field>
        <Field label="Quantidade de equipes"><select value={teams.length} disabled={locked} onChange={e => reconfigure(Number(e.target.value), data.teamCup.kind)}>{TEAM_COUNTS.map(n => <option key={n} value={n}>{n} equipes</option>)}</select></Field>
        <Field label="Formação"><select value={data.teamCup.formation} disabled={locked} onChange={e => formation(e.target.value)}><option value="fixed">Equipes já definidas</option><option value="random">Sorteio de capitães e integrantes</option></select></Field>
        <Field label="Games por partida"><select value={data.winningScore} disabled={locked} onChange={e => change(d => ({ ...d, winningScore: Number(e.target.value) }))}><option value={4}>4 games</option><option value={6}>6 games</option></select></Field>
        <Field label="1ª disputa paralela"><select value={data.cupConfig.repechageEnabled ? "yes" : "no"} disabled={locked} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, repechageEnabled: e.target.value === "yes" } }))}><option value="no">Não realizar</option><option value="yes">Sim · Consolation</option></select></Field>
        <Field label="Nome da disputa paralela"><input value={data.cupConfig.repechageName} disabled={locked || !data.cupConfig.repechageEnabled} maxLength={70} onChange={e => change(d => ({ ...d, cupConfig: { ...d.cupConfig, repechageName: e.target.value } }))} /></Field>
      </div><p className="tc-help">Grupos de 3, usando grupos de 4 quando necessário. Os dois melhores de cada grupo avançam. Somente os eliminados dos grupos entram no Consolation.</p>
        <p className="tc-help">{data.teamCup.kind === "squad" ? "Squad: masculina e feminina podem ocorrer simultaneamente em quadras diferentes. Desempate com dupla mista." : "Trio: duas partidas em sequência; a terceira ocorre somente em caso de empate. As substituições ficam a cargo da equipe."}</p>
        <p className="tc-help">As três partidas usam a mesma regra de games. Quem vencer duas ganha o confronto.</p>
        {locked && <p className="tc-help">Formação e regras protegidas: os grupos já foram gerados.</p>}
      </section>}
      {!readOnly && random && !locked && <section className="tc-panel"><h2>Sorteio em duas etapas</h2><div className="tc-actions">
        <label className="tc-check"><input type="checkbox" checked={data.teamCup.designatedCaptains} disabled={data.teamCup.drawStage !== "pending"} onChange={e => editSetting("designatedCaptains", e.target.checked)} />Definir previamente quem pode ser capitão</label>
        <label className="tc-check"><input type="checkbox" checked={data.teamCup.balanced} disabled={data.teamCup.drawStage !== "pending"} onChange={e => editSetting("balanced", e.target.checked)} />Equilibrar equipes por nível</label>
      </div><p className="tc-help">H = homem · M = mulher. {data.teamCup.designatedCaptains ? "Marque exatamente " + teams.length + " capitães para o sorteio separado." : "O primeiro sorteio seleciona um atleta para liderar cada equipe."} O equilíbrio considera também os capitães; não garante forças idênticas.</p>
        <div className="tc-pool">{data.teamCup.pool.map((a, i) => athleteRow(a, i))}</div><div className="tc-actions">
          <button type="button" className="tc-primary" disabled={data.teamCup.drawStage !== "pending"} onClick={() => change(d => drawTeamCaptains(d))}>1. Sortear capitães</button>
          <button type="button" className="tc-primary" disabled={data.teamCup.drawStage !== "captains"} onClick={() => change(d => drawTeamMembers(d))}>2. Sortear integrantes</button>
          <span>{data.teamCup.drawStage === "complete" ? "Equipes formadas" : data.teamCup.drawStage === "captains" ? "Capitães definidos · falta sortear integrantes" : "Aguardando o primeiro sorteio"}</span>
        </div></section>}
      <div className="tc-team-grid">{teams.map((team, i) => <section className="tc-panel" key={team.id}>
        {readOnly ? <h2>{teamName(team)}</h2> : <Field label={"Nome da equipe " + (i + 1)}><input value={team.name} maxLength={60} onChange={e => editTeam(i, { name: e.target.value })} /></Field>}
        {readOnly || locked || (random && data.teamCup.drawStage !== "pending") ? <ul className="tc-member-list">{team.athletes.map(a => <li key={a.id}>{a.name || "A definir"} {a.id === team.captainId && <span className="tc-captain">Capitão/ã</span>}</li>)}</ul> : !random && team.athletes.map((a, j) => athleteRow(a, j, i))}
        {random && data.teamCup.drawStage === "pending" && !locked && <p className="tc-help">Aguardando sorteio.</p>}
      </section>)}</div>
      {!readOnly && !locked && <div className="tc-actions tc-bottom"><button type="button" className="tc-primary" disabled={random && data.teamCup.drawStage !== "complete"} onClick={() => change(d => generateTeamCupGroups(d))}>Sortear grupos e gerar confrontos</button><span>As equipes ficam protegidas após gerar os grupos.</span></div>}
    </>}
{tab === "games" && (locked ? data.schedule.map((games, r) => <section className="tc-round" key={r}><h2>Rodada {r + 1}</h2>{games.map((game, g) => <TeamCupMatchCard key={game.matchKey} data={data} game={game} number={g + 1} round={game.groupName} now={now} onLegChange={onLegChange} readOnly={readOnly} courtOptions={courtOptions} />)}</section>) : <p className="tc-panel">Os confrontos aparecem depois de formar as equipes e sortear os grupos.</p>)}
    {tab === "ranking" && <>
      <p className="tc-help">Ordem: vitórias em confrontos → saldo de games → total de games → confronto direto → sorteio. O saldo soma os games das partidas concluídas de cada confronto finalizado, incluindo o desempate.</p>
      <div className="tc-team-grid">{groups.map(group => <section className="tc-panel" key={group.id}><h2>{group.name}</h2><table className="tc-ranking"><thead><tr><th>Equipe</th><th title="Confrontos jogados">J</th><th title="Confrontos vencidos">V</th><th>SG</th><th title="Total de games">TG</th></tr></thead><tbody>{group.rows.map((row, i) => <tr key={row.id}><th>{i + 1}. {row.name}<small>{groupsDone && !group.unresolvedTieIds.length ? i < 2 ? "Principal" : data.cupConfig.repechageEnabled ? "Consolation" : "Eliminado" : ""}</small></th><td>{row.played}</td><td>{row.w}</td><td>{row.bal > 0 ? "+" : ""}{row.bal}</td><td>{row.pts}</td></tr>)}</tbody></table>
        {group.unresolvedTieIds.length > 0 && <div className="tc-tie"><p>Empate: {group.rows.filter(r => group.unresolvedTieIds.includes(r.id)).map(r => r.name).join(", ")}.</p>{!readOnly && !data.brackets.length && <button type="button" onClick={() => drawTie("tieBreakOverrides", String(group.id), group.unresolvedTieIds)}>Sortear desempate do grupo</button>}</div>}
      </section>)}</div>
      {campaignTies.map(tie => <section className="tc-panel" key={tie.tieKey}><p>Empate de campanha ({tie.scope}): {tie.rows.map(r => r.name).join(", ")}.</p>{!readOnly && !data.brackets.length && <button type="button" onClick={() => drawTie("campaignTieBreakOverrides", tie.tieKey, tie.teamIds)}>Sortear ordem de campanha</button>}</section>)}
      {!locked && <p className="tc-panel">A classificação aparece após gerar os grupos.</p>}
    </>}
    {tab === "brackets" && <>
      {!data.brackets.length && <section className="tc-panel"><h2>Eliminatórias</h2><p>Conclua os grupos e resolva eventuais empates na aba Classificação.</p>{!readOnly && <button type="button" className="tc-primary" disabled={!groupsDone} onClick={() => change(d => generateTeamCupBrackets(d))}>Gerar eliminatórias{data.cupConfig.repechageEnabled ? " e Consolation" : ""}</button>}</section>}
      {bracketSections.map(section => {
        const [phase, round] = section.split("|");
        const games = data.brackets.filter(g => g.phase === phase && g.roundName === round);
        return <section className="tc-round" key={section}><h2>{phase === "main" ? data.cupConfig.mainBracketName : data.cupConfig.repechageName} · {round}</h2>{games.map((game, i) => <TeamCupMatchCard key={game.matchKey} data={data} game={game} number={i + 1} round={round} now={now} onLegChange={onLegChange} readOnly={readOnly} courtOptions={courtOptions} />)}</section>;
      })}
    </>}
  </section>;
}
