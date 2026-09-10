import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, Undo2, Film } from 'lucide-react';
import { PlayerInputs } from '../participantManagement/ParticipantManagement.jsx';
import { SHUFFLE_DURATION_SECONDS, SHUFFLE_MOVEMENT_INTERVAL_MS, createShuffleAnimationItems, moveShuffleAnimationItems } from '../media/shuffleAnimation.mjs';

export default function ReiDoSolParticipants({ data, config, onImport, onUndoImport, onShuffle, onGenerate, onVideo, onSetAllAttendance, updatePlayer, updateParticipantAttendance }) {
  return <>
    <h3>Participantes</h3>
    <div className="participantImportBar">
      <div>
        <strong><ClipboardPaste aria-hidden="true" /> Preencher vários participantes</strong>
        <p>Cole uma lista do WhatsApp ou de outro lugar, use nome e sobrenome e confira as vagas antes de aplicar.</p>
      </div>
      <div className="participantImportActions">
        {onUndoImport && <button type="button" className="secondaryBtn" onClick={onUndoImport}><Undo2 aria-hidden="true" /> Desfazer importação</button>}
        <button type="button" onClick={onImport}><ClipboardPaste aria-hidden="true" /> Colar lista</button>
      </div>
    </div>
    <div className="participantAttendanceToolbar">
      <div><strong>Presença no local</strong><span>{data.players.filter((_, index) => data.participantAttendance?.[index] === true).length} de {data.players.length} confirmados</span></div>
      <div className="participantAttendanceBulkActions">
        <button type="button" className="confirmAllParticipantsBtn" onClick={() => onSetAllAttendance(true)}>Confirmar todos</button>
        <button type="button" className="pendingAllParticipantsBtn" onClick={() => onSetAllAttendance(false)}>Ausentar todos</button>
      </div>
    </div>
    <div className="rds-participant-list">
      <PlayerInputs type="Rei do Sol" data={data} modalityConfig={config} updatePlayer={updatePlayer} updateParticipantAttendance={updateParticipantAttendance} />
    </div>
    <div className="actions">
      <button type="button" className="actionShuffleBtn" onClick={onShuffle}>Sortear nomes</button>
      <button type="button" className="actionGenerateBtn" onClick={onGenerate}>Criar rodadas e jogos</button>
      {data.lastShuffleVideo && <button type="button" className="shuffleVideoReopenButton" onClick={onVideo}><Film aria-hidden="true" /> Vídeo do último sorteio</button>}
    </div>
    {data.namesShuffled && <p className="rds-info">Nomes sorteados. Use “Criar rodadas e jogos” para montar os confrontos na ordem sorteada.</p>}
  </>;
}

export function ReiDoSolShuffleOverlay({ names, onComplete }) {
  const [seconds, setSeconds] = useState(SHUFFLE_DURATION_SECONDS);
  const [items, setItems] = useState(() => createShuffleAnimationItems(names));
  useEffect(() => {
    const movement = setInterval(() => setItems(current => moveShuffleAnimationItems(current)), SHUFFLE_MOVEMENT_INTERVAL_MS);
    const countdown = setInterval(() => setSeconds(current => Math.max(0, current - 1)), 1000);
    return () => { clearInterval(movement); clearInterval(countdown); };
  }, []);
  useEffect(() => { if (seconds === 0) onComplete(); }, [seconds, onComplete]);
  return createPortal(<div className="shuffleOverlay" role="dialog" aria-modal="true" aria-label="Sorteio dos participantes">
    <div className="shuffleBox">
      <div className="shuffleHeader"><div><span className="shuffleEyebrow">Sorteio em andamento</span><h2>Sorteando nomes...</h2><p>Os participantes estão trocando de posição até a formação final.</p></div><div className="shuffleTimer" aria-live="polite">{seconds}s</div></div>
      <div className="shuffleStage">{items.map(item => <div className="floatingName" key={item.id} title={item.name} style={{ left: `${item.left}%`, top: `${item.top}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }}><span>{item.name}</span></div>)}</div>
      <div className="shuffleProgress"><div /></div>
    </div>
  </div>, document.body);
}
