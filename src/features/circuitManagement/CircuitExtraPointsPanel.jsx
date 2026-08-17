import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Trash2, UserRound } from "lucide-react";
import { formatParticipantName } from "../../domain/participantNames.mjs";
import {
  circuitRankingModes,
  getCircuitManualParticipantKey,
  normalizeCircuitPointValue,
  normalizeCircuitRankingSettings,
} from "../../domain/circuitRankingSettings.mjs";
import FormatExplanationButton from "../tournamentConfig/FormatExplanationButton.jsx";

export default function CircuitExtraPointsPanel({ circuit, rankingGroups, onSave }) {
  const settings = normalizeCircuitRankingSettings(circuit?.rankingSettings);
  const usesCircuitPoints = settings.mode === circuitRankingModes.placement || settings.sourceCircuitIds.length > 0;
  const participantLabel = settings.identity === "team" ? "dupla" : "atleta";
  const targets = (rankingGroups || []).flatMap((group) => (group.rows || []).map((row) => ({
    id: String(row.id || ""), name: row.name, groupKey: group.key || "geral", groupTitle: group.title,
  })));
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState({ targetId: "", label: "", points: "", note: "" });
  const emptyManualForm = { id: "", name: "", groupKey: settings.rankingDivision === "gender" ? "masculino" : "geral", points: "", wins: "", totalGames: "", balance: "", played: "", note: "" };
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [deleteId, setDeleteId] = useState("");
  const [manualDeleteId, setManualDeleteId] = useState("");
  const [manualConfirm, setManualConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  async function addExtraPoint() {
    const target = targets.find((item) => item.id === form.targetId);
    const points = normalizeCircuitPointValue(form.points);
    if (!target || !form.label.trim() || points <= 0) return;
    const nextEntry = {
      id: typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `extra-${Date.now()}`,
      targetId: target.id,
      targetName: target.name,
      groupKey: target.groupKey,
      label: form.label.trim(),
      note: form.note.trim(),
      points,
      createdAt: new Date().toISOString(),
    };
    const saved = await onSave({ ...settings, extraPoints: [...settings.extraPoints, nextEntry] });
    if (saved) setForm({ targetId: "", label: "", points: "", note: "" });
  }

  async function removeExtraPoint() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const saved = await onSave({ ...settings, extraPoints: settings.extraPoints.filter((entry) => entry.id !== deleteId) });
      if (saved) setDeleteId("");
    } finally {
      setDeleting(false);
    }
  }

  function getManualPayload() {
    const name = formatParticipantName(manualForm.name);
    if (!name) return null;
    return {
      id: manualForm.id || (typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `manual-${Date.now()}`),
      name,
      groupKey: settings.rankingDivision === "gender" ? manualForm.groupKey : "geral",
      points: normalizeCircuitPointValue(manualForm.points),
      wins: normalizeCircuitPointValue(manualForm.wins),
      totalGames: normalizeCircuitPointValue(manualForm.totalGames),
      balance: Number.isFinite(Number(manualForm.balance)) ? Math.round(Number(manualForm.balance)) : 0,
      played: normalizeCircuitPointValue(manualForm.played),
      note: manualForm.note.trim(),
      createdAt: settings.manualParticipants.find((entry) => entry.id === manualForm.id)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function persistManualParticipant(payload) {
    if (!payload || manualSaving) return;
    setManualSaving(true);
    try {
      const nextManualParticipants = manualForm.id
        ? settings.manualParticipants.map((entry) => entry.id === manualForm.id ? payload : entry)
        : [...settings.manualParticipants, payload];
      const saved = await onSave({ ...settings, manualParticipants: nextManualParticipants });
      if (saved) {
        setManualForm({ ...emptyManualForm, groupKey: settings.rankingDivision === "gender" ? "masculino" : "geral" });
        setManualConfirm(null);
      }
    } finally {
      setManualSaving(false);
    }
  }

  function requestManualSave() {
    const payload = getManualPayload();
    if (!payload) return;
    const normalizedName = getCircuitManualParticipantKey(payload.name, settings.identity === "team");
    const duplicateManual = settings.manualParticipants.find((entry) => (
      entry.id !== manualForm.id
      && entry.groupKey === payload.groupKey
      && getCircuitManualParticipantKey(entry.name, settings.identity === "team") === normalizedName
    ));
    if (duplicateManual) {
      setManualConfirm({ kind: "duplicate", name: duplicateManual.name });
      return;
    }
    const existingRankingTarget = targets.find((target) => (
      target.groupKey === payload.groupKey
      && getCircuitManualParticipantKey(target.name, settings.identity === "team") === normalizedName
    ));
    if (!manualForm.id && existingRankingTarget) {
      setManualConfirm({ kind: "existing", payload, name: existingRankingTarget.name });
      return;
    }
    void persistManualParticipant(payload);
  }

  function editManualParticipant(entry) {
    setManualOpen(true);
    setManualForm({
      id: entry.id,
      name: entry.name,
      groupKey: entry.groupKey,
      points: String(entry.points),
      wins: String(entry.wins),
      totalGames: String(entry.totalGames),
      balance: String(entry.balance),
      played: String(entry.played),
      note: entry.note,
    });
  }

  async function removeManualParticipant() {
    if (!manualDeleteId || deleting) return;
    setDeleting(true);
    try {
      const saved = await onSave({ ...settings, manualParticipants: settings.manualParticipants.filter((entry) => entry.id !== manualDeleteId) });
      if (saved) {
        setManualDeleteId("");
        if (manualForm.id === manualDeleteId) setManualForm(emptyManualForm);
      }
    } finally {
      setDeleting(false);
    }
  }

  return <div className={`circuitExtraPointsPanel ${usesCircuitPoints ? "usesPoints" : "usesPerformance"}`}>
    <div className="circuitManualAdjustmentsHeader">
      <div>
        <span>Ajustes manuais</span>
        <strong>Participantes e resultados complementares</strong>
        <small>{usesCircuitPoints
          ? "Inclua participantes que ainda não aparecem nas etapas ou conceda uma pontuação extra."
          : "Inclua participantes e informe manualmente vitórias, Total de Games, saldo e jogos."}</small>
      </div>
      <FormatExplanationButton
        iconOnly
        ariaLabel="Entenda os ajustes manuais do ranking"
        eyebrow="Ajustes manuais"
        title="Como complementar o ranking do circuito"
        intro="O formato das etapas define o cálculo automático. Esta área serve apenas para incluir ou complementar informações sob responsabilidade do organizador."
        sections={[
          { title: "Participante ausente", content: <p>Adicione um {participantLabel} que ainda não apareceu nos torneios e informe os valores que devem entrar no ranking.</p> },
          { title: "Soma automática", content: <p>Se o mesmo nome aparecer posteriormente em uma etapa, os resultados conquistados serão somados aos valores manuais, sem criar outro participante.</p> },
          ...(usesCircuitPoints ? [{ title: "Pontuação extra", content: <p>O bônus é somado diretamente ao total de pontos. Vitórias, games, saldo e jogos só mudam quando forem informados no cadastro manual.</p> }] : []),
        ]}
      />
    </div>
    <div className="circuitRankingManualActions">
      <button type="button" className="circuitManualParticipantButton" onClick={() => setManualOpen((value) => !value)}><UserRound aria-hidden="true" /> {manualOpen ? "Fechar inclusão manual" : `Adicionar ${participantLabel} manualmente`}</button>
      {usesCircuitPoints ? <button type="button" className="circuitExtraPointsButton" onClick={() => setOpen((value) => !value)}><Gift aria-hidden="true" /> {open ? "Fechar pontos extras" : "Adicionar pontuação extra"}</button> : null}
    </div>
    {manualOpen ? <div className="circuitManualParticipantContent">
      <div className="circuitSettingsTitleRow"><div><strong>Inclusão manual no ranking</strong><span>Cadastre um {participantLabel} que ainda não participou das etapas.</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda a inclusão manual" eyebrow="Ranking manual" title="Como a inclusão manual funciona" intro="Os valores informados entram no ranking do circuito e permanecem editáveis pelo organizador." sections={[{ title: "Soma automática", content: <p>Se o mesmo nome participar de uma etapa posteriormente, os resultados do torneio serão somados aos valores cadastrados aqui.</p> }, { title: "Campos do ranking", content: <p>Informe {usesCircuitPoints ? "pontos, " : ""}vitórias, Total de Games, saldo e jogos. Use zero nos campos que não devem alterar a classificação.</p> }, { title: "Identificação", content: <p>O sistema unifica automaticamente nomes que diferem somente pela acentuação. Use nome e sobrenome para diferenciar homônimos.</p> }]} /></div>
      <div className="circuitManualParticipantForm">
        <label className="manualNameField"><span>{settings.identity === "team" ? "Nome da dupla" : "Nome do atleta"}</span><input value={manualForm.name} onChange={(event) => setManualForm((previous) => ({ ...previous, name: event.target.value }))} onBlur={() => setManualForm((previous) => ({ ...previous, name: formatParticipantName(previous.name) }))} placeholder={settings.identity === "team" ? "Ex: Ana + Beatriz" : "Ex: Ana Beatriz"} /></label>
        {settings.rankingDivision === "gender" ? <label><span>Ranking</span><select value={manualForm.groupKey} onChange={(event) => setManualForm((previous) => ({ ...previous, groupKey: event.target.value }))}><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></label> : null}
        {usesCircuitPoints ? <label><span>Pontos</span><input type="number" min="0" step="1" value={manualForm.points} onChange={(event) => setManualForm((previous) => ({ ...previous, points: event.target.value }))} /></label> : null}
        <label><span>Vitórias</span><input type="number" min="0" step="1" value={manualForm.wins} onChange={(event) => setManualForm((previous) => ({ ...previous, wins: event.target.value }))} /></label>
        <label><span>Total de Games</span><input type="number" min="0" step="1" value={manualForm.totalGames} onChange={(event) => setManualForm((previous) => ({ ...previous, totalGames: event.target.value }))} /></label>
        <label><span>Saldo</span><input type="number" step="1" value={manualForm.balance} onChange={(event) => setManualForm((previous) => ({ ...previous, balance: event.target.value }))} /></label>
        <label><span>Jogos</span><input type="number" min="0" step="1" value={manualForm.played} onChange={(event) => setManualForm((previous) => ({ ...previous, played: event.target.value }))} /></label>
        <label className="manualNoteField"><span>Observação opcional</span><input value={manualForm.note} onChange={(event) => setManualForm((previous) => ({ ...previous, note: event.target.value }))} placeholder="Ex: Pontuação transferida" /></label>
        <div className="manualFormActions">{manualForm.id ? <button type="button" className="secondaryBtn" onClick={() => setManualForm(emptyManualForm)}>Cancelar edição</button> : null}<button type="button" className="circuitManualSave" disabled={!manualForm.name.trim() || manualSaving} onClick={requestManualSave}>{manualSaving ? "Salvando..." : manualForm.id ? "Salvar alterações" : "Adicionar ao ranking"}</button></div>
      </div>
      {settings.manualParticipants.length ? <div className="circuitManualHistory"><strong>Cadastros manuais</strong>{settings.manualParticipants.map((entry) => <article key={entry.id}><div><b>{entry.name}</b><span>{usesCircuitPoints ? `${entry.points} pts · ` : ""}{entry.wins} vit. · {entry.totalGames} games · saldo {entry.balance} · {entry.played} jogo(s){entry.note ? ` — ${entry.note}` : ""}</span></div><div className="circuitManualHistoryActions"><button type="button" className="manualEditButton" onClick={() => editManualParticipant(entry)}>Editar</button><button type="button" className="manualDeleteButton" onClick={() => setManualDeleteId(entry.id)}>Excluir</button></div></article>)}</div> : <p className="circuitExtraEmpty">Nenhum {participantLabel} incluído manualmente.</p>}
    </div> : null}
    {usesCircuitPoints && open ? <div className="circuitExtraPointsContent">
      <div className="circuitSettingsTitleRow"><div><strong>Pontuações extras</strong><span>O valor é somado ao total e participa do primeiro critério do ranking.</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda a pontuação extra" eyebrow="Bônus do organizador" title="Como os pontos extras funcionam" intro="Use somente para ajustes ou premiações definidos pelo regulamento do circuito." sections={[{ title: "Total do ranking", content: <p>O bônus é somado diretamente aos pontos conquistados nas etapas. Por isso, ele altera imediatamente a ordem principal do ranking.</p> }, { title: "Identificação", content: <p>Escolha o atleta ou a dupla, informe um motivo claro e registre uma observação se necessário.</p> }, { title: "Transparência", content: <p>O histórico permanece visível no circuito e pode ser removido pelo organizador mediante confirmação.</p> }]} /></div>
      <div className="circuitExtraPointsForm">
        <label><span>Atleta ou dupla</span><select value={form.targetId} onChange={(event) => setForm((previous) => ({ ...previous, targetId: event.target.value }))}><option value="">Escolha no ranking</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}{rankingGroups.length > 1 ? ` — ${target.groupTitle}` : ""}</option>)}</select></label>
        <label><span>Motivo</span><input value={form.label} onChange={(event) => setForm((previous) => ({ ...previous, label: event.target.value }))} placeholder="Ex: Bônus da etapa" /></label>
        <label><span>Pontos</span><input type="number" min="1" step="1" value={form.points} onChange={(event) => setForm((previous) => ({ ...previous, points: event.target.value }))} /></label>
        <label className="circuitExtraNote"><span>Observação opcional</span><input value={form.note} onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))} /></label>
        <button type="button" className="circuitExtraSave" disabled={!form.targetId || !form.label.trim() || normalizeCircuitPointValue(form.points) <= 0} onClick={() => void addExtraPoint()}>Somar ao total</button>
      </div>
      {settings.extraPoints.length ? <div className="circuitExtraHistory"><strong>Histórico</strong>{settings.extraPoints.map((entry) => <article key={entry.id}><div><b>+{entry.points} · {entry.targetName}</b><span>{entry.label}{entry.note ? ` — ${entry.note}` : ""}</span></div><button type="button" onClick={() => setDeleteId(entry.id)}>Excluir</button></article>)}</div> : <p className="circuitExtraEmpty">Nenhuma pontuação extra adicionada.</p>}
    </div> : null}
    {deleteId ? createPortal(
      <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="extra-point-delete-title">
        <div className="confirmBox extraPointDeleteConfirmBox">
          <div className="confirmIcon" aria-hidden="true"><Trash2 /></div>
          <span className="confirmEyebrow">Pontuação extra</span>
          <h2 id="extra-point-delete-title">Excluir esta pontuação extra?</h2>
          <p>O valor será retirado do total do participante e o ranking será recalculado imediatamente.</p>
          <div className="confirmActions">
            <button type="button" className="secondaryBtn" disabled={deleting} onClick={() => setDeleteId("")}>Cancelar</button>
            <button type="button" className="deleteBtn" disabled={deleting} onClick={() => void removeExtraPoint()}>{deleting ? "Excluindo..." : "Sim, excluir"}</button>
          </div>
        </div>
      </div>,
      document.body
    ) : null}
    {manualDeleteId ? createPortal(
      <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="manual-participant-delete-title"><div className="confirmBox extraPointDeleteConfirmBox"><div className="confirmIcon" aria-hidden="true"><Trash2 /></div><span className="confirmEyebrow">Cadastro manual</span><h2 id="manual-participant-delete-title">Excluir este atleta do ranking?</h2><p>Todos os valores inseridos manualmente serão retirados. Resultados conquistados em torneios continuarão preservados.</p><div className="confirmActions"><button type="button" className="secondaryBtn" disabled={deleting} onClick={() => setManualDeleteId("")}>Cancelar</button><button type="button" className="deleteBtn" disabled={deleting} onClick={() => void removeManualParticipant()}>{deleting ? "Excluindo..." : "Sim, excluir"}</button></div></div></div>, document.body
    ) : null}
    {manualConfirm ? createPortal(
      <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="manual-participant-confirm-title"><div className="confirmBox manualParticipantConfirmBox"><div className="confirmIcon" aria-hidden="true"><UserRound /></div><span className="confirmEyebrow">Inclusão manual</span><h2 id="manual-participant-confirm-title">{manualConfirm.kind === "duplicate" ? "Este cadastro manual já existe" : "Somar ao atleta existente?"}</h2><p>{manualConfirm.kind === "duplicate" ? `${manualConfirm.name} já possui um cadastro manual. Use o botão Editar no histórico para evitar valores duplicados.` : `${manualConfirm.name} já aparece no ranking. Os valores manuais serão somados aos resultados que ele já conquistou.`}</p><div className="confirmActions"><button type="button" className="secondaryBtn" disabled={manualSaving} onClick={() => setManualConfirm(null)}>{manualConfirm.kind === "duplicate" ? "Entendi" : "Cancelar"}</button>{manualConfirm.kind === "existing" ? <button type="button" className="confirmBtn" disabled={manualSaving} onClick={() => void persistManualParticipant(manualConfirm.payload)}>{manualSaving ? "Salvando..." : "Sim, somar valores"}</button> : null}</div></div></div>, document.body
    ) : null}
  </div>;
}
