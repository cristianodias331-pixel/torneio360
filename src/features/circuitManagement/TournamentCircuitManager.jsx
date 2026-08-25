import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, GitBranch, PlusCircle, X } from "lucide-react";

export function TournamentCircuitButton({ onClick, managed = false }) {
  if (typeof onClick !== "function") return null;

  return (
    <button type="button" className="tournamentCircuitButton" onClick={onClick} aria-label={managed ? "Gerenciar circuitos" : "Adicionar ao circuito"}>
      <GitBranch aria-hidden="true" />
      <span className="tournamentCircuitButtonLabel">
        {managed ? "Gerenciar circuitos" : "+ Adicionar ao circuito"}
      </span>
    </button>
  );
}
export function TournamentCircuitManagerModal({
  tournament,
  compatibleCircuits = [],
  currentCircuitIds = [],
  onClose,
  onSave,
  onCreate,
}) {
  const initialIds = useMemo(
    () => currentCircuitIds.map((id) => String(id)),
    [currentCircuitIds]
  );
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState("");
  const savingRef = useRef(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  useEffect(() => {
    setSelectedIds(initialIds);
    setConfirmRemoval(false);
  }, [tournament?.id, initialIds]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const selectedSet = new Set(selectedIds);
  const initialSet = new Set(initialIds);
  const removedCount = initialIds.filter((id) => !selectedSet.has(id)).length;
  const changed = selectedIds.length !== initialIds.length
    || selectedIds.some((id) => !initialSet.has(id));

  function toggleCircuit(circuitId) {
    const normalizedId = String(circuitId);
    setSelectedIds((current) => current.includes(normalizedId)
      ? current.filter((id) => id !== normalizedId)
      : [...current, normalizedId]);
    setConfirmRemoval(false);
  }

  async function submitChanges() {
    if (!changed || savingRef.current) return;
    if (removedCount > 0 && !confirmRemoval) {
      setConfirmRemoval(true);
      return;
    }

    savingRef.current = true;
    setSavingAction("save");
    setSaving(true);
    let saved = false;
    try {
      saved = await onSave?.(selectedIds);
    } finally {
      savingRef.current = false;
      setSavingAction("");
      setSaving(false);
    }
    if (saved) onClose?.();
  }

  async function startNewCircuit() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingAction("create");
    setSaving(true);
    let started = false;
    try {
      started = await onCreate?.();
    } finally {
      savingRef.current = false;
      setSavingAction("");
      setSaving(false);
    }
    if (started) onClose?.();
  }

  return createPortal(
    <div className="tournamentCircuitOverlay" role="presentation" onMouseDown={() => !saving && onClose?.()}>
      <section
        className="tournamentCircuitDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-circuit-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="tournamentCircuitDialogHeader">
          <div>
            <span className="tournamentCircuitEyebrow">Circuitos e temporadas</span>
            <h2 id="tournament-circuit-dialog-title">
              {initialIds.length > 0 ? "Gerenciar circuitos" : "Adicionar ao circuito"}
            </h2>
            <p><strong>{tournament?.name}</strong> pode participar dos circuitos compatíveis abaixo.</p>
          </div>
          <button type="button" className="tournamentCircuitClose" onClick={onClose} disabled={saving} aria-label="Fechar">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="tournamentCircuitDialogBody">
          {compatibleCircuits.length > 0 ? (
            <div className="tournamentCircuitChoiceList" aria-label="Circuitos compatíveis">
              {compatibleCircuits.map((circuit) => {
                const circuitId = String(circuit.id);
                const selected = selectedSet.has(circuitId);
                const tournamentCount = (circuit.tournamentIds || []).length;
                return (
                  <button
                    type="button"
                    className={`tournamentCircuitChoice ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    key={circuitId}
                    onClick={() => toggleCircuit(circuitId)}
                  >
                    <span className="tournamentCircuitCheck" aria-hidden="true">{selected ? "✓" : ""}</span>
                    <span>
                      <strong>{circuit.name}</strong>
                      <small>{tournamentCount} {tournamentCount === 1 ? "torneio cadastrado" : "torneios cadastrados"}</small>
                    </span>
                    {selected ? <em>Selecionado</em> : <em>Adicionar</em>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tournamentCircuitEmpty">
              <GitBranch aria-hidden="true" />
              <strong>Nenhum circuito compatível criado ainda</strong>
              <p>Crie um circuito novo e este torneio já ficará selecionado como a primeira etapa.</p>
            </div>
          )}

          {confirmRemoval ? (
            <div className="tournamentCircuitRemovalWarning" role="alert">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>Confirmar retirada?</strong>
                <p>{removedCount} circuito(s) deixarão de usar este torneio no ranking. O torneio, seus jogos e placares serão preservados.</p>
              </div>
            </div>
          ) : null}

          <div className="tournamentCircuitCreateDivider"><span>ou</span></div>
          <button type="button" className="tournamentCircuitCreateNew" onClick={startNewCircuit} disabled={saving} aria-busy={savingAction === "create"}>
            <PlusCircle aria-hidden="true" /> {savingAction === "create" ? "Abrindo criação do circuito..." : "Criar novo circuito com este torneio"}
          </button>
        </div>

        <footer className="tournamentCircuitDialogActions">
          <button type="button" className="secondaryBtn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="tournamentCircuitSave" onClick={submitChanges} disabled={!changed || saving} aria-busy={savingAction === "save"}>
            {saving ? "Salvando..." : confirmRemoval ? "Sim, salvar alterações" : "Salvar nos circuitos"}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
