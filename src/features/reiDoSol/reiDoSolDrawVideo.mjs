import { createShuffleVideoSnapshot } from '../media/shuffleVideoExport.mjs';
import { GROUPS } from '../../domain/reiDoSol.mjs';

// Reuse the platform's receipt and video format. Record the actual result once;
// reopening or exporting this receipt must never run another draw.
export function createReiDoSolDrawVideo(names, scope = 'names', tournament = null) {
  const label = scope === 'names' ? 'Ordem sorteada' : `Desempate · ${scope === 'qualifying' ? 'Classificatória' : GROUPS.find(group => group.id === scope)?.name || scope}`;
  const snapshot = createShuffleVideoSnapshot(
    { players: names }, { type: 'reiDoSol', name: 'Rei do Sol' },
    tournament || { name: 'Rei do Sol · Prévia local', type: 'Rei do Sol' },
  );
  return { ...snapshot, scope, headerLabel: tournament ? 'REI DO SOL · SORTEIO' : 'PRÉVIA LOCAL · SORTEIO', sections: [{ title: label, entries: [...names] }] };
}
