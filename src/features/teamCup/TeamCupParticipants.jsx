import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ClipboardPaste, Crown, GripVertical, Grid3X3, Layers, Search, Shuffle, SlidersHorizontal, Users, X } from "lucide-react";
import { TEAM_LEVELS, drawTeamCaptains, drawTeamMembers, teamName, teamSize } from "../../domain/teamCup.mjs";
import { applyTeamCupOrganization, buildTeamCupImportPreview, importTeamCupList, isTeamCupVacancy, organizeTeamCupGroups, organizationLocked, organizationSignature,
  participantEntries, prepareTeamCupFormation, swapTeamCupAthletes, swapTeamCupGroupItems,
  teamCupOrganizationGroups, teamLevelValue, updateTeamCupParticipant } from "../../domain/teamCupOrganization.mjs";
import "./teamCupParticipants.css";
import { useTeamCupDrawPresentation } from "./TeamCupDrawPresentation.jsx";
import TeamCupVideoActions from "./TeamCupVideoActions.jsx";
import { recordTeamCupCaptainDraw, recordTeamCupMemberDraw, recordTeamCupGroupVideo } from "../../domain/teamCupVideo.mjs";

function Dialog({ title, eyebrow, intro, onClose, children, footer, busy = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = () => { if (!busy) onClose(); };
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button")?.focus();
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const controls = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(e => e.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus?.(); };
  }, []);
  return createPortal(<div className="tcorg-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeRef.current(); }}>
    <section className="tcorg-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
      <header className="tcorg-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{intro}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar janela"><X /></button></header>
      <div className="tcorg-body" inert={busy}>{children}</div><footer className="tcorg-footer" inert={busy}><div><b>Alterações seguras</b><small>Somente esta competição. Os perfis dos atletas não serão modificados.</small></div><div className="tcorg-actions">{footer}</div></footer>
    </section>
  </div>, document.body);
}

function ImportDialog({ data, onChange, onClose }) {
  const [rows, setRows] = useState([{ key: 0, name: "", gender: "", level: "" }]);
  const rowKey = useRef(1);
  const [mode, setMode] = useState("available"), [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [signature] = useState(() => organizationSignature(data));
  const [error, setError] = useState("");
  let preview, parseError = "";
  try { preview = buildTeamCupImportPreview(data, rows, mode); }
  catch (e) { parseError = e.message; preview = buildTeamCupImportPreview(data, [], mode); }
  const canApply = preview.imported > 0 && !preview.overflow && !preview.duplicates && !parseError;
  function editRows(next) { setRows(next); setReplaceConfirmed(false); setError(""); }
  function editRow(key, patch) { editRows(rows.map(row => row.key === key ? { ...row, ...patch } : row)); }
  function pasteNames(index, text) {
    const pasted = text.split(/\r?\n/).filter(line => line.trim()).map(line => {
      const [name, gender = "", level = "", ...extra] = line.split(/\t|;/);
      if (extra.length) throw new Error("Use somente as três colunas: Nome, Masculino/Feminino e Nível.");
      const genders = { masculino: "H", feminino: "M", h: "H", m: "M" };
      return { key: rowKey.current++, name, gender: genders[gender.trim().toLocaleLowerCase("pt-BR")] || gender.trim(),
        level: TEAM_LEVELS.find(l => l.toLocaleLowerCase("pt-BR") === level.trim().toLocaleLowerCase("pt-BR")) || level.trim() };
    });
    if (!pasted.length) return;
    // Replace only the edited row; every other draft row remains in the list.
    const current = rows[index];
    if (!pasted[0].gender) pasted[0].gender = current.gender;
    if (!pasted[0].level) pasted[0].level = current.level;
    editRows([...rows.slice(0, index), ...pasted, ...rows.slice(index + 1)]);
  }
  function readPaste(index, text) { try { pasteNames(index, text); } catch (e) { setError(e.message); } }
  function apply() {
    if (!canApply) return;
    if (mode === "replace" && !replaceConfirmed) { setReplaceConfirmed(true); return; }
    try {
      const options = { replaceConfirmed, signature };
      importTeamCupList(data, rows, mode, options);
      onChange(current => importTeamCupList(current, rows, mode, options)); onClose();
    }
    catch (e) { setError(e.message); }
  }
  return <Dialog title="Colar lista de participantes" eyebrow="TIMES/EQUIPES" intro="Cole a lista na coluna Nome, com um atleta por linha. Depois selecione Masculino/Feminino e Nível nas colunas ao lado. Numeração, marcadores e emojis são retirados na prévia." onClose={onClose}
    footer={<><button type="button" className="tcorg-import-cancel" onClick={onClose}>Cancelar</button><button type="button" className="tcorg-import-apply" disabled={!canApply} onClick={apply}><Check /> {mode === "replace" ? replaceConfirmed ? "Sim, substituir todos" : "Revisar substituição" : "Aplicar lista"}</button></>}>
    <div className="tcorg-import-modes" aria-label="Modo da importação">{[
      ["available", "Preencher vagas ainda não editadas", "Recomendado — preserva todos os nomes digitados."],
      ["replace", "Substituir todos os participantes", "Substitui os nomes atuais e exige confirmação."],
    ].map(([key, title, description]) => <button type="button" key={key} className={mode === key ? "selected" : ""} aria-pressed={mode === key} onClick={() => { setMode(key); setReplaceConfirmed(false); setError(""); }}><strong>{title}</strong><small>{description}</small></button>)}</div>
    <div className="tcorg-import-editor" aria-label="Lista a importar">
      <div className="tcorg-import-columns" aria-hidden="true"><b>Nome do atleta</b><b>Masculino/Feminino</b><b>Nível</b></div>
      <div className="tcorg-import-rows">{rows.map((row, i) => <div className="tcorg-import-row" key={row.key}>
        <label><span>Nome do atleta</span><textarea rows={1} aria-label={`Nome do atleta ${i + 1}`} placeholder={i === 0 ? "Cole os nomes aqui, um por linha" : "Nome e sobrenome"} value={row.name}
          onPaste={e => { const text = e.clipboardData.getData("text/plain"); if (/[\n\t;]/.test(text)) { e.preventDefault(); readPaste(i, text); } }}
          onChange={e => /[\n\t;]/.test(e.target.value) ? readPaste(i, e.target.value) : editRow(row.key, { name: e.target.value })} /></label>
        <label><span>Masculino/Feminino</span><select aria-label={`Masculino ou Feminino do atleta ${i + 1}`} value={row.gender} onChange={e => editRow(row.key, { gender: e.target.value })}><option value="">Conforme vaga</option><option value="H">Masculino</option><option value="M">Feminino</option></select></label>
        <label><span>Nível</span><select aria-label={`Nível do atleta ${i + 1}`} value={row.level} onChange={e => editRow(row.key, { level: e.target.value })}><option value="">{mode === "replace" ? "Não definido" : "Conforme vaga"}</option>{TEAM_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
        <button type="button" className="tcorg-remove-row" aria-label={`Remover linha ${i + 1}`} onClick={() => editRows(rows.length === 1 ? [{ key: rowKey.current++, name: "", gender: "", level: "" }] : rows.filter(r => r.key !== row.key))}><X /></button>
      </div>)}</div>
      <button type="button" className="tcorg-add-row" onClick={() => editRows([...rows, { key: rowKey.current++, name: "", gender: "", level: "" }])}>+ Adicionar atleta</button>
    </div>
    <p className="tcorg-hint">“Conforme vaga” mantém a composição da posição disponível, sem inferir pelo nome. Na substituição, os níveis anteriores são apagados; confira a prévia. Nomes dos times e posições dos capitães são mantidos.</p>
    <div className="tcorg-import-summary" aria-live="polite"><div><b>{preview.imported}</b><span>nomes a preencher</span></div><div><b>{preview.preserved}</b><span>nomes preservados</span></div><div><b>{preview.vacancies}</b><span>vagas restantes</span></div></div>
    {(error || parseError || preview.overflow > 0 || preview.duplicates > 0 || preview.ignored > 0 || replaceConfirmed) && <div className="tcorg-error" role="alert">
      {(error || parseError) && <p>{error || parseError}</p>}
      {preview.overflow > 0 && <p>{preview.overflow} nome(s) não cabem nas vagas disponíveis. Ajuste a lista antes de aplicar.</p>}
      {preview.duplicates > 0 && <p>Há {preview.duplicates} nome(s) repetido(s). Diferencie os atletas homônimos.</p>}
      {preview.ignored > 0 && <p>{preview.ignored} linha(s) ignorada(s) por não conter um nome válido.</p>}
      {replaceConfirmed && <p><b>Confirmação final:</b> os nomes e níveis atuais serão substituídos pela prévia abaixo. As vagas restantes ficarão sem nome. Clique em “Sim, substituir todos” para confirmar.</p>}
    </div>}
    <section className="tcorg-import-preview"><div className="tcorg-preview-bar"><b>Prévia antes de aplicar</b><small>É assim que os participantes ficarão.</small></div>
      <div className="tcorg-import-result">{preview.entries.map(({ athlete: a, team }, i) => <div className="tcorg-import-result-row" key={a.id}>
        <div><b>{i + 1}. {isTeamCupVacancy(a) ? "Vaga disponível" : a.name}</b><small>{team ? teamName(team) + (team.captainId === a.id ? " · Capitão/ã" : "") : "Lista para sorteio"} · {isTeamCupVacancy(a) ? "Vaga" : preview.importedIds.includes(a.id) ? "Novo" : "Preservado"}</small></div>
        <span>{a.gender === "H" ? "Masculino" : "Feminino"}</span><span>{a.level || "Nível não definido"}</span>
      </div>)}</div>
    </section>
  </Dialog>;
}

function OrganizationDialog({ data, tournament, onChange, onClose }) {
  const [draft, setDraft] = useState(() => structuredClone(data));
  const [signature] = useState(() => organizationSignature(data));
  const [stage, setStage] = useState("teams");
  const [error, setError] = useState(""), [selection, setSelection] = useState(null);
  const drawPresentation = useTeamCupDrawPresentation();
  const dragged = useRef(null);
  const locked = organizationLocked(data), random = draft.teamCup.formation === "random";
  const groups = teamCupOrganizationGroups(draft), teams = draft.players.teams;
  const formed = !random || draft.teamCup.drawStage === "complete";
  const allAthletes = participantEntries(draft).map(e => e.athlete);
  const defined = allAthletes.filter(a => TEAM_LEVELS.includes(a.level)).length;
  function edit(transform) { if (locked || drawPresentation.busy) return; try { setDraft(transform(draft)); setError(""); } catch (e) { setError(e.message); } }
  function draw(stage) {
    if (locked || drawPresentation.busy) return;
    try {
      const captains = stage === "captains";
      const next = captains ? recordTeamCupCaptainDraw(drawTeamCaptains(draft)) : recordTeamCupMemberDraw(drawTeamMembers(draft));
      const captainIds = new Set(draft.players.teams.map(t => t.captainId));
      const candidates = draft.teamCup.pool.filter(a => captains ? !draft.teamCup.designatedCaptains || a.captainCandidate : !captainIds.has(a.id));
      setError("");
      drawPresentation.present({ title: captains ? "Sorteando capitães..." : "Sorteando integrantes...", names: candidates.map(a => a.name), onReveal: () => setDraft(next) });
    } catch (e) { setError(e.message); }
  }
  function swap(target, source = selection) {
    if (!source) { setSelection(target); return; }
    if (source.kind === target.kind && source.id === target.id) { setSelection(null); return; }
    edit(d => swapTeamCupGroupItems(d, source, target)); setSelection(null);
  }
  function dragProps(item) {
    return { draggable: !locked, onDragStart: e => { dragged.current = item; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.kind); },
      onDragEnd: () => { dragged.current = null; }, onDragOver: e => { if (dragged.current?.kind === item.kind) e.preventDefault(); },
      onDrop: e => { e.preventDefault(); e.stopPropagation(); if (dragged.current) swap(item, dragged.current); dragged.current = null; } };
  }
  function save() {
    try {
      const next = recordTeamCupGroupVideo({ ...draft, teamCup: { ...draft.teamCup, groupOrder: groups.flatMap(g => g.teamIds) } });
      applyTeamCupOrganization(data, next, signature);
      onChange(current => applyTeamCupOrganization(current, next, signature)); onClose();
    } catch (e) { setError(e.message); }
  }
  const modes = stage === "groups"
    ? [["manual", "Manual", "Troque equipes inteiras de posição.", Grid3X3], ["balanced", "Níveis equilibrados", "Distribui a força média entre os grupos.", SlidersHorizontal], ["similar", "Mesmo nível junto", "Aproxima equipes de força semelhante.", Layers]]
    : [["manual", "Manual", "Equipes fixas e capitães definidos por você.", Users], ["balanced", "Sorteio equilibrado", "Equilibra os níveis, considerando os capitães.", SlidersHorizontal], ["random", "Sorteio aleatório", "Primeiro capitães, depois os integrantes.", Shuffle]];
  const mode = stage === "groups" ? draft.teamCup.groupMode || "manual" : random ? draft.teamCup.balanced ? "balanced" : "random" : "manual";
  return <><Dialog busy={drawPresentation.busy} title="Organizar equipes e grupos" eyebrow={`COPA · TIMES/EQUIPES · ${draft.teamCup.kind.toUpperCase()}`} intro="Primeiro, coloque os nomes em Colar lista ou manualmente. Depois, forme as equipes e organize os grupos da sua forma." onClose={onClose}
    footer={<><button type="button" onClick={onClose}>{locked ? "Fechar" : "Cancelar"}</button>{!locked && <button type="button" className="tcorg-save" onClick={save}><Check /> Salvar formação</button>}</>}>
    <nav className="tcorg-stages" aria-label="Etapas da organização"><button type="button" className={stage === "teams" ? "active" : ""} onClick={() => { setStage("teams"); setSelection(null); }}>1. Equipes e capitães</button><button type="button" className={stage === "groups" ? "active" : ""} onClick={() => { setStage("groups"); setSelection(null); }}>2. Grupos da copa</button></nav>
    <TeamCupVideoActions data={draft} tournament={tournament} draft={!locked} only={stage === "teams" ? "teams" : "groups"} />
    {locked && <p className="tcorg-hint">Somente consulta: os jogos já foram gerados e a formação está protegida.</p>}
    <div className="tcorg-modes">{modes.map(([key, title, text, Icon]) => <button type="button" key={key} className={mode === key ? "selected" : ""} aria-pressed={mode === key} disabled={locked || (stage === "groups" && !formed)}
      onClick={() => { setSelection(null); edit(d => stage === "groups" ? organizeTeamCupGroups(d, key) : prepareTeamCupFormation(d, key)); }}><Icon /><span><b>{title}</b><small>{text}</small></span></button>)}</div>
    {error && <p className="tcorg-error" role="alert">{error}</p>}
    {stage === "groups" ? <>
      {!formed ? <p className="tcorg-hint">Conclua o sorteio de capitães e integrantes na etapa 1 para distribuir as equipes nos grupos.</p> : <div className="tcorg-preview">
        <div className="tcorg-preview-bar"><div><b>Prévia dos grupos</b><small>{groups.length} grupos · {teams.length} equipes</small></div><p>{selection ? "Agora escolha o destino para trocar de posição." : "Arraste uma equipe ou clique em duas para trocar. Para trocar todos, use a barra do grupo."}</p><span className="tcorg-level-count">{defined}/{allAthletes.length} níveis definidos</span></div>
        <div className="tcorg-group-grid">{groups.map(group => <section className="tcorg-group" key={group.id}>
          <button type="button" className={`tcorg-group-bar ${selection?.kind === "group" && selection.id === group.id ? "selected" : ""}`} disabled={locked} aria-label={`Trocar ${group.name}`} onClick={() => swap({ kind: "group", id: group.id })} {...dragProps({ kind: "group", id: group.id })}><span><GripVertical /> {group.name}</span><small>{group.teamIds.length} vagas</small></button>
          {group.teamIds.map((id, i) => { const team = teams.find(t => t.id === id), value = teamLevelValue(team), completeLevels = team.athletes.length === teamSize(draft) && team.athletes.every(a => TEAM_LEVELS.includes(a.level));
            return <div className="tcorg-team-slot" key={id}><span className="tcorg-slot-number">{i + 1}</span><button type="button" className={`tcorg-team-tile ${selection?.kind === "team" && selection.id === id ? "selected" : ""}`} disabled={locked} aria-label={`Trocar ${teamName(team)}`} onClick={() => swap({ kind: "team", id })} {...dragProps({ kind: "team", id })}><GripVertical /><span><b>{teamName(team)}</b><small>{team.athletes.map(a => (a.name || "A definir") + (a.id === team.captainId ? " (C)" : "")).join(" · ")}</small></span></button><div className="tcorg-team-level"><small>NÍVEL MÉDIO</small><span>{completeLevels ? TEAM_LEVELS[Math.round(value) - 1] : "A definir"}</span></div></div>;
          })}
        </section>)}</div>
        <p className="tcorg-hint">Os níveis individuais são editados na lista ou em Equipes e capitães. Aqui, cada time permanece inteiro. O equilíbrio é aproximado; não muda a classificação V → SG → total de games.</p>
      </div>}
    </> : <>
      {random && !locked && <div className="tcorg-draw"><label><input type="checkbox" checked={draft.teamCup.designatedCaptains} disabled={draft.teamCup.drawStage !== "pending"} onChange={e => edit(d => ({ ...d, teamCup: { ...d.teamCup, designatedCaptains: e.target.checked } }))} /> Definir previamente quem pode ser capitão</label>
        <p>O capitão integra o time. {draft.teamCup.designatedCaptains ? `Marque exatamente ${teams.length} capitães abaixo.` : "O primeiro sorteio escolhe um capitão por equipe."} {draft.teamCup.kind === "squad" && "Squad mantém 2 atletas do masculino e 2 do feminino."}</p>
        <div className="tcorg-candidates">{draft.teamCup.pool.map(a => <label key={a.id}><input type="checkbox" checked={Boolean(a.captainCandidate)} disabled={!draft.teamCup.designatedCaptains || draft.teamCup.drawStage !== "pending"} onChange={e => edit(d => updateTeamCupParticipant(d, a.id, { captainCandidate: e.target.checked }))} /><span>{a.name || "Nome não preenchido"}</span><small>{a.gender === "H" ? "Masculino" : "Feminino"} · {a.level || "Sem nível"}</small></label>)}</div>
        <div className="tcorg-actions"><button type="button" disabled={drawPresentation.busy || draft.teamCup.drawStage !== "pending"} onClick={() => draw("captains")}>1. Sortear capitães</button><button type="button" disabled={drawPresentation.busy || draft.teamCup.drawStage !== "captains"} onClick={() => draw("members")}>2. Sortear integrantes</button><span>{draft.teamCup.drawStage === "complete" ? "Equipes formadas" : draft.teamCup.drawStage === "captains" ? "Capitães sorteados; faltam os integrantes" : "Aguardando sorteio"}</span></div>
      </div>}
      <div className="tcorg-roster-grid">{teams.map(team => <section className="tcorg-roster" key={team.id}><label>Nome da equipe<input value={team.name} maxLength={60} disabled={locked} onChange={e => edit(d => ({ ...d, players: { ...d.players, teams: d.players.teams.map(t => t.id === team.id ? { ...t, name: e.target.value, a: e.target.value } : t) } }))} /></label>
        {random && draft.teamCup.drawStage === "pending" ? <p>Aguardando sorteio dos capitães.</p> : team.athletes.map(a => <div className="tcorg-roster-row" key={a.id}><div><b>{a.name || "A definir"}</b><small>{a.gender === "H" ? "Masculino" : "Feminino"}</small></div>
          <select aria-label={`Nível de ${a.name || a.id}`} value={a.level} disabled={locked || (random && draft.teamCup.drawStage !== "complete")} onChange={e => edit(d => updateTeamCupParticipant(d, a.id, { level: e.target.value }))}><option value="">Nível</option>{TEAM_LEVELS.map(level => <option key={level}>{level}</option>)}</select>
          <label className="tcorg-captain"><input type="radio" name={`modal-captain-${team.id}`} disabled={locked || random} checked={team.captainId === a.id} onChange={() => edit(d => ({ ...d, players: { ...d.players, teams: d.players.teams.map(t => t.id === team.id ? { ...t, captainId: a.id } : t) } }))} /><Crown /> Cap.</label>
          {!locked && !random && <select className="tcorg-swap-athlete" aria-label={`Trocar ${a.name || a.id} de equipe`} value="" onChange={e => edit(d => swapTeamCupAthletes(d, a.id, e.target.value))}><option value="">Trocar com…</option>{teams.filter(t => t.id !== team.id).flatMap(t => t.athletes.filter(other => teamSize(draft) !== 4 || other.gender === a.gender).map(other => <option key={other.id} value={other.id}>{other.name || "A definir"} · {teamName(t)}</option>))}</select>}
        </div>)}
      </section>)}</div><p className="tcorg-hint">Nas trocas manuais, a vaga de capitão fica com quem entra nela; confira a marcação antes de salvar. A plataforma não escolhe a dupla que entra em quadra.</p>
    </>}
  </Dialog>{drawPresentation.overlay}</>;
}

export default function TeamCupParticipants({ data, tournament, onChange }) {
  const [search, setSearch] = useState(""), [dialog, setDialog] = useState(null);
  const locked = organizationLocked(data), entries = participantEntries(data);
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtered = entries.filter(e => normalize(e.athlete.name + " " + (e.team ? teamName(e.team) : "")).includes(normalize(search)));
  const filled = entries.filter(e => e.athlete.name.trim()).length;
  return <div className="tcp-participants">
    <div className="tcp-summary"><span><b>{filled}/{data.players.teams.length * teamSize(data)}</b> vagas preenchidas</span><span><b>{entries.filter(e => TEAM_LEVELS.includes(e.athlete.level)).length}</b> níveis definidos</span><span>{teamSize(data) === 4 ? "Squad · 2H + 2M" : "Trio · composição livre"}</span></div>
    <div className="tcp-toolbar"><button type="button" className="tcp-paste" disabled={locked} onClick={() => setDialog("paste")}><ClipboardPaste /> Colar lista</button><button type="button" className="tcp-organize" onClick={() => setDialog("organize")}><Grid3X3 /> Organizar grupos</button><label className="tcp-search"><Search /><input aria-label="Buscar pelo nome do atleta" placeholder="Buscar pelo nome do atleta" type="search" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    <TeamCupVideoActions data={data} tournament={tournament} />
    <p className="tc-help">{locked ? "Jogos gerados: nomes e formação protegidos. Você pode buscar atletas e consultar a organização." : "Preencha os atletas abaixo ou cole uma lista. Em Organizar grupos, defina equipes, capitães e a distribuição dos times."}</p>
    <div className="tcp-list">{filtered.map(({ athlete: a, team }, i) => <div className="tcp-row" key={a.id}>
      <span className="tcp-number">{i + 1}</span><label className="tcp-name"><span>{team ? teamName(team) : "Lista para sorteio"}{team?.captainId === a.id ? " · Capitão/ã" : ""}</span><input aria-label={`Nome de ${a.name || a.id}`} placeholder="Nome do atleta" maxLength={100} value={a.name} disabled={locked || data.teamCup.drawStage === "captains"} onChange={e => onChange(d => updateTeamCupParticipant(d, a.id, { name: e.target.value }))} /></label>
      <label className="tcp-gender"><span>Masculino/Feminino</span><select aria-label={`Composição de ${a.name || a.id}`} value={a.gender} disabled={locked || data.teamCup.drawStage === "captains"} onChange={e => onChange(d => updateTeamCupParticipant(d, a.id, { gender: e.target.value }))}><option value="H">Masculino</option><option value="M">Feminino</option></select></label>
      <label className="tcp-level"><span>Nível</span><select aria-label={`Nível de ${a.name || a.id}`} value={a.level} disabled={locked || data.teamCup.drawStage === "captains"} onChange={e => onChange(d => updateTeamCupParticipant(d, a.id, { level: e.target.value }))}><option value="">Não definido</option>{TEAM_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
    </div>)}</div>{!filtered.length && <p className="tc-help">Nenhum atleta encontrado para essa busca.</p>}
    {dialog === "paste" && <ImportDialog data={data} onChange={onChange} onClose={() => setDialog(null)} />}
    {dialog === "organize" && <OrganizationDialog data={data} tournament={tournament} onChange={onChange} onClose={() => setDialog(null)} />}
  </div>;
}
