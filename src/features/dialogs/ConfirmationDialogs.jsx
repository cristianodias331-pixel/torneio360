import React from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";

export function NoticeModal({ notice, onClose }) {
  if (!notice) return null;

  const icon = {
    success: "✅",
    error: "⚠️",
    info: "ℹ️",
    warning: "⚠️",
  }[notice.type || "info"];

  return createPortal(
    <div className="confirmOverlay">
      <div className={`confirmBox noticeBox ${notice.type || "info"}`}>
        <div className="confirmIcon">{icon}</div>
        <h2>{notice.title}</h2>
        <p>{notice.message}</p>

        <div className="confirmActions">
          <button type="button" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
export function ConfirmModal({ target, onCancel, onConfirm }) {
  if (!target) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">⚠️</div>
        <h2>Mover para a lixeira?</h2>

        <p>
          O torneio <strong>{target.name}</strong> será movido para a lixeira e
          poderá ser recuperado em até 30 dias.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Mover para lixeira</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmCircuitDeleteModal({ target, onCancel, onConfirm }) {
  if (!target) return null;

  return (
    <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="delete-circuit-title">
      <div className="confirmBox circuitDeleteConfirmBox">
        <div className="confirmIcon"><Trash2 aria-hidden="true" /></div>
        <span className="confirmEyebrow">Mover para a lixeira</span>
        <h2 id="delete-circuit-title">Mover “{target.name}” para a lixeira?</h2>
        <p>
          O circuito ficará disponível para recuperação por 30 dias. Todos os torneios vinculados continuarão salvos normalmente.
        </p>

        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Manter circuito</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Mover para lixeira</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmTrashPermanentDeleteModal({ action, busy, onCancel, onConfirm }) {
  if (!action) return null;
  const isCircuit = action.kind === "circuits";
  const itemLabel = action.ids.length === 1
    ? (isCircuit ? "circuito" : "torneio")
    : (isCircuit ? "circuitos" : "torneios");

  return createPortal(
    <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="trash-permanent-delete-title">
      <div className="confirmBox trashPermanentDeleteConfirmBox">
        <div className="confirmIcon"><Trash2 aria-hidden="true" /></div>
        <span className="confirmEyebrow">Ação permanente</span>
        <h2 id="trash-permanent-delete-title">
          {action.all ? `Excluir todos os ${itemLabel}?` : `Excluir ${action.ids.length} ${itemLabel}?`}
        </h2>
        <p>Esta ação não pode ser desfeita. Os itens selecionados serão apagados definitivamente da plataforma.</p>
        {isCircuit ? <p>Os torneios vinculados continuarão salvos.</p> : null}
        <div className="confirmActions">
          <button type="button" className="secondaryBtn" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" disabled={busy} onClick={onConfirm}>
            {busy ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmClearScoresModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">🧹</div>
        <h2>Apagar somente os placares?</h2>

        <p>
          Todos os placares preenchidos deste campeonato serão apagados. A tabela
          e os participantes serão mantidos.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Sim, apagar</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmClearTableModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">🗑️</div>
        <h2>Apagar todos os jogos e placares?</h2>

        <p>
          Os participantes serão mantidos, mas todos os jogos, rodadas, placares
          e chaves deste torneio serão removidos.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Sim, apagar tudo</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmRegenerationModal({ confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;

  return createPortal(
    <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="regeneration-confirm-title">
      <div className="confirmBox regenerationConfirmBox">
        <div className="confirmIcon" aria-hidden="true">{"\u26a0\ufe0f"}</div>
        <span className="confirmEyebrow">Atenção antes de continuar</span>
        <h2 id="regeneration-confirm-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>

        <ul className="regenerationImpactList">
          {confirmation.impacts.map((impact) => <li key={impact}>{impact}</li>)}
        </ul>

        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="regenerationConfirmBtn" onClick={onConfirm}>
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmModalityChangeModal({ confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;

  return createPortal(
    <div className="confirmOverlay modalityChangeConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="modality-change-title">
      <div className="confirmBox regenerationConfirmBox">
        <div className="confirmIcon" aria-hidden="true">⚠️</div>
        <span className="confirmEyebrow">Alteração estrutural</span>
        <h2 id="modality-change-title">Trocar a modalidade deste torneio?</h2>
        <p>
          A modalidade será alterada de <strong>{getModalityDisplayName(confirmation.fromType)}</strong> para <strong>{getModalityDisplayName(confirmation.toType)}</strong>.
        </p>
        <ul className="regenerationImpactList">
          <li>Nome, datas, local, foto e informações do evento serão preservados.</li>
          <li>Participantes serão reiniciados conforme a nova modalidade.</li>
          <li>Rodadas, chaves, sorteios e placares incompatíveis serão removidos.</li>
        </ul>
        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="regenerationConfirmBtn" onClick={onConfirm}>Trocar modalidade</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmEventGroupModalityChangeModal({ confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;

  return createPortal(
    <div className="confirmOverlay modalityChangeConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="event-group-modality-change-title">
      <div className="confirmBox regenerationConfirmBox">
        <div className="confirmIcon" aria-hidden="true">⚠️</div>
        <span className="confirmEyebrow">Alteração estrutural</span>
        <h2 id="event-group-modality-change-title">Trocar {confirmation.count === 1 ? "a modalidade desta categoria" : `as modalidades de ${confirmation.count} categorias`}?</h2>
        <p>Os dados gerais do evento serão preservados, mas cada categoria alterada será preparada para seu novo formato.</p>
        <ul className="regenerationImpactList">
          <li>Nomes, datas, locais, fotos e informações públicas serão preservados.</li>
          <li>Participantes serão reiniciados nas categorias cuja modalidade mudou.</li>
          <li>Rodadas, chaves, sorteios e placares incompatíveis dessas categorias serão removidos.</li>
        </ul>
        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="regenerationConfirmBtn" onClick={onConfirm}>Trocar modalidade</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
