import React, { useState } from "react";
import { ChevronDown, Grid3X3 } from "lucide-react";
import { normalizeCourtNumberValue } from "../../domain/courtNumbers.mjs";

export function VoiceRepeatSelector({ voiceRepeat, setVoiceRepeat }) {
  return (
    <div className="voiceRepeatBox">
      <span>🔊 Chamada de Jogos</span>

      <select
        value={voiceRepeat}
        onChange={(e) => setVoiceRepeat(Number(e.target.value))}
      >
        <option value={1}>Apenas 1 vez</option>
        <option value={2}>2 vezes</option>
      </select>
    </div>
  );
}
export function CourtBadge({ label, editable = false, onClick = null }) {
  const content = (
    <>
      <span>{label}</span>
      {editable ? <ChevronDown aria-hidden="true" /> : null}
    </>
  );

  if (editable) {
    return (
      <button
        type="button"
        className="courtNameBadge courtNameBadgeEditable"
        onClick={onClick}
        title="Alterar a quadra deste jogo"
        aria-label={`${label}. Toque para alterar a quadra deste jogo.`}
      >
        {content}
      </button>
    );
  }

  return <strong className="courtNameBadge">{content}</strong>;
}

export function CourtConfigPanel({ courtNumbers, onCommit, onReset, onOpenCourtCenter, centralCourtNumbers = [] }) {
  return (
    <section className="courtConfigPanel" aria-labelledby="court-config-title">
      <div className="courtConfigHeader">
        <div>
          <span className="courtConfigEyebrow">Organização das partidas</span>
          <h3 id="court-config-title">Quadras do torneio</h3>
          <p>Defina somente o número de cada quadra. A palavra “Quadra” permanecerá fixa em todos os jogos.</p>
        </div>
        <button type="button" className="courtConfigReset" onClick={onReset}>Restaurar padrão</button>
      </div>

      <div className="courtConfigCentralLink">
        <div>
          <Grid3X3 aria-hidden="true" />
          <span>
            <strong>Central compartilhada</strong>
            <small>
              {centralCourtNumbers.length
                ? `${centralCourtNumbers.length} quadra(s) física(s) informada(s) para este local.`
                : "Informe as quadras físicas disponíveis para todos os torneios abertos."}
            </small>
          </span>
        </div>
        <button type="button" onClick={onOpenCourtCenter}>Abrir Central de Quadras</button>
      </div>

      <div className="courtConfigGrid">
        {courtNumbers.map((number, index) => (
          <label className="courtConfigField" key={index}>
            <span>Posição {index + 1}</span>
            <div className="courtNumberInputWrap">
              <strong>Quadra</strong>
              <input
                defaultValue={number}
                key={`${index}-${number}`}
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={String(index + 1)}
                aria-label={`Número da quadra na posição ${index + 1}`}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                }}
                onBlur={(event) => onCommit(index, event.target.value)}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="courtConfigExample">
        <span>Exemplo:</span>
        <strong>Quadra 1</strong>
        <strong>Quadra 2</strong>
        <strong>Quadra 4</strong>
        <strong>Quadra 5</strong>
      </div>
    </section>
  );
}

export function CourtAssignmentModal({ editor, courtNumbers, unavailableNumbers = [], currentNumber, usedNumbers = [], onSelect, onClose }) {
  const [customNumber, setCustomNumber] = useState("");
  const [pendingSelection, setPendingSelection] = useState(null);
  const normalizedCurrent = normalizeCourtNumberValue(currentNumber);
  const unavailableSet = new Set(unavailableNumbers.map(normalizeCourtNumberValue).filter(Boolean));
  const usedSet = new Set(usedNumbers.map(normalizeCourtNumberValue).filter(Boolean));
  const selectableNumbers = Array.from(new Set(
    courtNumbers.map((number, index) => normalizeCourtNumberValue(number) || String(index + 1))
  )).filter((number) => number !== normalizedCurrent);
  const restoreNumber = normalizeCourtNumberValue(
    courtNumbers[Math.max(0, Number(editor?.game?.court || 1) - 1)] || String(editor?.game?.court || 1)
  );
  const courtOptions = selectableNumbers.map((number) => ({
    number,
    status: unavailableSet.has(number) ? "unavailable" : usedSet.has(number) ? "occupied" : "free",
  }));
  const freeOptions = courtOptions.filter((option) => option.status === "free");
  const occupiedOptions = courtOptions.filter((option) => option.status !== "free");
  const hasUnavailableOptions = occupiedOptions.some((option) => option.status === "unavailable");

  function getSelectionStatus(number) {
    if (unavailableSet.has(number)) return "unavailable";
    if (usedSet.has(number)) return "occupied";
    if (!selectableNumbers.includes(number)) return "new";
    return "free";
  }

  function requestSelection(value) {
    const number = normalizeCourtNumberValue(value);
    if (!number || number === normalizedCurrent) return;
    setPendingSelection({ number, status: getSelectionStatus(number) });
  }

  function confirmSelection() {
    if (!pendingSelection) return;
    onSelect(pendingSelection.number, { confirmed: true });
  }

  const pendingCopy = pendingSelection?.status === "occupied"
    ? {
        eyebrow: "Quadra em uso",
        title: `A Quadra ${pendingSelection.number} já está ocupada`,
        message: "Confirme somente se deseja manter dois jogos usando esse mesmo número de quadra.",
        action: `Usar Quadra ${pendingSelection.number}`,
      }
    : pendingSelection?.status === "unavailable"
      ? {
          eyebrow: "Quadra indisponível",
          title: `A Quadra ${pendingSelection.number} está indisponível`,
          message: "Essa quadra foi marcada como indisponível na Central. Confirme somente se o uso for intencional.",
          action: `Usar Quadra ${pendingSelection.number}`,
        }
      : pendingSelection?.status === "new"
        ? {
            eyebrow: "Nova quadra",
            title: `Adicionar a Quadra ${pendingSelection.number}?`,
            message: "Esse número será adicionado à Central de Quadras e aplicado a este jogo.",
            action: "Adicionar e usar",
          }
        : {
            eyebrow: "Quadra livre",
            title: `Usar a Quadra ${pendingSelection?.number}?`,
            message: "A quadra está livre e será aplicada a este jogo.",
            action: "OK, usar quadra",
          };

  return (
    <div className="courtEditorOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="courtEditorSheet" role="dialog" aria-modal="true" aria-labelledby="court-editor-title">
        <div className="courtEditorHandle" aria-hidden="true" />
        <div className="courtEditorHeader">
          <div>
            <span>Alteração rápida</span>
            <h2 id="court-editor-title">Escolha o número da quadra</h2>
            <p>Se o número estiver ocupado em um torneio aberto, você poderá escolher outra quadra ou confirmar a repetição.</p>
          </div>
          <button type="button" className="courtEditorClose" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="courtEditorCurrent">
          <small>Quadra atual</small>
          <CourtBadge label={`Quadra ${normalizedCurrent || editor?.game?.court || 1}`} />
        </div>

        {pendingSelection ? (
          <div className={`courtEditorConfirmation ${pendingSelection.status}`}>
            <span>{pendingCopy.eyebrow}</span>
            <h3>{pendingCopy.title}</h3>
            <p>{pendingCopy.message}</p>
            <div className="courtEditorConfirmationActions">
              <button type="button" className="courtEditorConfirmationCancel" onClick={() => setPendingSelection(null)}>
                Cancelar
              </button>
              <button type="button" className="courtEditorConfirmationSubmit" onClick={confirmSelection}>
                {pendingCopy.action}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="courtEditorColumns">
              <section className="courtEditorColumn free" aria-labelledby="court-free-title">
                <div className="courtEditorColumnHeader">
                  <div>
                    <span>Disponíveis</span>
                    <h3 id="court-free-title">Quadras livres</h3>
                  </div>
                  <strong>{freeOptions.length}</strong>
                </div>
                <div className="courtEditorColumnList">
                  {freeOptions.length ? freeOptions.map(({ number }) => (
                    <button
                      type="button"
                      className="courtEditorOption free"
                      key={number}
                      onClick={() => requestSelection(number)}
                    >
                      <span>Quadra {number}</span>
                      <small>Livre</small>
                    </button>
                  )) : <p className="courtEditorEmpty">Nenhuma quadra livre.</p>}
                </div>
              </section>

              <section className="courtEditorColumn occupied" aria-labelledby="court-occupied-title">
                <div className="courtEditorColumnHeader">
                  <div>
                    <span>Atenção</span>
                    <h3 id="court-occupied-title">{hasUnavailableOptions ? "Ocupadas / indisponíveis" : "Quadras ocupadas"}</h3>
                  </div>
                  <strong>{occupiedOptions.length}</strong>
                </div>
                <div className="courtEditorColumnList">
                  {occupiedOptions.length ? occupiedOptions.map(({ number, status }) => (
                    <button
                      type="button"
                      className={`courtEditorOption ${status}`}
                      key={number}
                      onClick={() => requestSelection(number)}
                    >
                      <span>Quadra {number}</span>
                      <small>{status === "unavailable" ? "Indisponível" : "Em uso"}</small>
                    </button>
                  )) : <p className="courtEditorEmpty">Nenhuma quadra ocupada.</p>}
                </div>
              </section>
            </div>

            <div className="courtEditorCustom">
              <label htmlFor="custom-court-number">Outro número</label>
              <div className="courtEditorNumberInput">
                <strong>Quadra</strong>
                <input
                  id="custom-court-number"
                  value={customNumber}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="5"
                  onChange={(event) => setCustomNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
                <button type="button" disabled={!normalizeCourtNumberValue(customNumber)} onClick={() => requestSelection(customNumber)}>Aplicar</button>
              </div>
            </div>

            <button
              type="button"
              className="courtEditorRestore"
              disabled={!restoreNumber || restoreNumber === normalizedCurrent}
              onClick={() => requestSelection(restoreNumber)}
            >
              Restaurar quadra padrão deste jogo
            </button>
          </>
        )}
      </section>
    </div>
  );
}

export function ConfirmDuplicateCourtModal({ kind, number, onCancel, onConfirm }) {
  const isDefaultConfiguration = kind === "default";

  return (
    <div className="courtDuplicateOverlay" role="presentation">
      <section className="courtDuplicateModal" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-court-title">
        <div className="courtDuplicateIcon">!</div>
        <span className="courtDuplicateEyebrow">Número já utilizado</span>
        <h2 id="duplicate-court-title">A Quadra {number} já está em uso</h2>
        <p>
          {isDefaultConfiguration
            ? "Se você confirmar, duas posições da configuração usarão o mesmo número de quadra."
            : "Se você confirmar, dois jogos ficarão identificados com o mesmo número de quadra."}
        </p>
        <div className="courtDuplicatePreview">
          <CourtBadge label={`Quadra ${number}`} />
          <strong>{isDefaultConfiguration ? "Número repetido na configuração" : "2 jogos com este número"}</strong>
        </div>
        <div className="courtDuplicateActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" onClick={onConfirm}>Confirmar repetição</button>
        </div>
      </section>
    </div>
  );
}

export function CourtOccupancyModal({ conflict, onChoose }) {
  if (!conflict) return null;
  const wasMarkedUnavailable = conflict.markedUnavailable === true;
  const freeCourtNumbers = Array.isArray(conflict.freeCourtNumbers)
    ? conflict.freeCourtNumbers
    : [];

  return (
    <div className="courtDuplicateOverlay courtOccupancyOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onChoose("cancel");
    }}>
      <section className="courtDuplicateModal courtOccupancyModal" role="dialog" aria-modal="true" aria-labelledby="court-occupancy-title">
        <div className="courtDuplicateIcon">!</div>
        <span className="courtDuplicateEyebrow">{wasMarkedUnavailable ? "Quadra indisponível" : "Quadra em uso"}</span>
        <h2 id="court-occupancy-title">
          A Quadra {conflict.number} {wasMarkedUnavailable ? "está marcada como indisponível" : "já está ocupada"}
        </h2>
        {wasMarkedUnavailable ? (
          <p>Essa numeração foi marcada como indisponível na Central de Quadras.</p>
        ) : (
          <p>
            <strong>{conflict.usage?.tournamentName}</strong> está usando essa quadra em
            {" "}<strong>{conflict.usage?.gameLabel}</strong>.
          </p>
        )}
        <p>
          {freeCourtNumbers.length
            ? "Escolha uma quadra livre informada pelo organizador ou mantenha o número se o uso for intencional."
            : "Não há outra quadra livre na configuração atual. Você ainda pode manter o número se o uso for intencional."}
        </p>
        <div className="courtDuplicateActions courtOccupancyActions">
          <button type="button" className="secondaryBtn" onClick={() => onChoose("cancel")}>Cancelar</button>
          <button type="button" className="courtKeepNumberBtn" onClick={() => onChoose("same")}>Usar Quadra {conflict.number}</button>
          {freeCourtNumbers.map((number) => (
            <button
              type="button"
              className="courtNextFreeBtn"
              key={number}
              onClick={() => onChoose(`free:${number}`)}
            >
              Usar Quadra {number} livre
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ParticipantOccupancyModal({ conflict, onChoose }) {
  if (!conflict) return null;

  return (
    <div className="courtDuplicateOverlay participantOccupancyOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onChoose("cancel");
    }}>
      <section className="courtDuplicateModal participantOccupancyModal" role="alertdialog" aria-modal="true" aria-labelledby="participant-occupancy-title">
        <div className="courtDuplicateIcon">!</div>
        <span className="courtDuplicateEyebrow">Participante já está jogando</span>
        <h2 id="participant-occupancy-title">Há participantes em outro jogo</h2>
        <p>O jogo pode ser chamado, mas os participantes abaixo já aparecem em outro confronto em andamento.</p>

        <ul className="participantOccupancyList">
          {conflict.conflicts.map((item, index) => (
            <li key={`${item.gameLabel}-${item.courtLabel}-${index}`}>
              <strong>{item.participants.map((participant) => participant.name).join(" e ")}</strong>
              <span>{item.gameLabel} · {item.courtLabel}</span>
            </li>
          ))}
        </ul>

        <p className="participantOccupancyHint">Se a repetição for intencional, você ainda pode iniciar este jogo.</p>
        <div className="courtDuplicateActions participantOccupancyActions">
          <button type="button" className="secondaryBtn" onClick={() => onChoose("cancel")}>Cancelar</button>
          <button type="button" className="participantOccupancyConfirmBtn" onClick={() => onChoose("continue")}>
            Chamar mesmo assim
          </button>
        </div>
      </section>
    </div>
  );
}
