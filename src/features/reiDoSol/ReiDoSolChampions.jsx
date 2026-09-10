import React from 'react';
import { Trophy } from 'lucide-react';
import CupPodiumView from '../ranking/CupPodiumView.jsx';
import { GROUPS, groupChampion, groupColorStyle } from '../../domain/reiDoSol.mjs';

// The results screen awards one individual title per group, not four podiums.
// Detailed standings remain available in their respective competition phases.
export default function ReiDoSolChampions({ finalRankings, renderTiePanel, shareContext = null }) {
  return <div className="rds-group-grid rds-champions-grid">
    {GROUPS.map(group => {
      const ranking = finalRankings.find(item => item.group.id === group.id)?.ranking;
      const champion = groupChampion(ranking);
      const championTies = ranking?.pending.filter(tie => tie.ids.includes(ranking.rows[0]?.id)) || [];
      return <article className="rds-group rds-champion-result" key={group.id} style={groupColorStyle(group)} aria-label={`Campeão ${group.name}`}>
        {champion ? <CupPodiumView
          title={`Campeão ${group.name}`}
          podium={[{ ...champion, position: 'Campeão' }]}
          variant="parallel"
          showPlayTime={false}
          shareContext={{ ...(shareContext || { title: 'PRÉVIA · Rei do Sol' }), subtitle: `Campeão ${group.name}${shareContext ? '' : ' · Dados simulados'}`, podiumPalette: { ...group.palette, accent: group.color }, podiumHeadingLabel: `CAMPEÃO ${group.name.toLocaleUpperCase('pt-BR')}` }}
        /> : <>
          <header><h3>Campeão {group.name}</h3><Trophy size={24} /></header>
          <div className="rds-champion-pending">
            <Trophy size={38} aria-hidden="true" />
            <strong>Aguardando definição</strong>
            <p>{!ranking ? 'Aguardando a formação dos grupos finais.' : ranking.complete ? 'Resolva o empate pela liderança para definir o campeão.' : `${ranking.completed}/3 jogos concluídos neste grupo.`}</p>
          </div>
          {championTies.length > 0 && renderTiePanel?.(group.id, { ...ranking, pending: championTies })}
        </>}
      </article>;
    })}
  </div>;
}
