import React, { useId, useState } from 'react';
import { isValidTieOrder } from '../../domain/reiDoSol.mjs';

export default function ReiDoSolManualTie({ tie, players, onSave, onCancel }) {
  const id = useId();
  const [order, setOrder] = useState(() => tie.ids.map(() => ''));
  const valid = isValidTieOrder(tie.ids, order);
  return <form className="rds-manual-tie" aria-label="Escolha manual do organizador" onSubmit={event => { event.preventDefault(); if (valid) onSave(order); }}>
    <strong>Escolha manual do organizador</strong>
    <p>Defina a ordem somente entre estes empatados. A primeira posição fica à frente das demais; os critérios anteriores e os placares não mudam.</p>
    <div className="rds-manual-tie-positions">
      {order.map((athlete, index) => <label key={index} htmlFor={`${id}-${index}`}>
        {index + 1}º entre os empatados
        <select id={`${id}-${index}`} value={athlete} required onChange={event => {
          const next = event.target.value === '' ? '' : Number(event.target.value);
          setOrder(current => current.map((value, position) => position === index ? next : value));
        }}>
          <option value="">Selecione o atleta</option>
          {tie.ids.map(athleteId => <option key={athleteId} value={athleteId} disabled={order.some((value, position) => position !== index && value === athleteId)}>{players[athleteId]}</option>)}
        </select>
      </label>)}
    </div>
    <div className="rds-tie-actions">
      <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
      <button type="submit" className="primaryBtn" disabled={!valid}>Salvar escolha manual</button>
    </div>
  </form>;
}
