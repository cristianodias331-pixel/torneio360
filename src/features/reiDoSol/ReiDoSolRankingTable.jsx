import React from 'react';
import { RankingTable } from '../ranking/RankingTables.jsx';
import { CRITERIA, COEFFICIENT_HELP, RANKING_COLUMNS, GROUPS, groupColorStyle } from '../../domain/reiDoSol.mjs';

export default function ReiDoSolRankingTable({ title, ranking, qualifying = false, destinationFor = null, group: finalGroup = null, shareContext = {} }) {
  // Follow the ranked athlete, not the visible row index after search/pagination.
  const cutoffId = qualifying && ranking.rows.length > 16 ? ranking.rows[15].id : null;
  const positions = new Map(ranking.rows.map((row, index) => [row.id, index + 1]));
  return <div className="rds-ranking-section">
    <p className="rds-criteria"><strong>Critérios de classificação:</strong><br />{CRITERIA}</p>
    <RankingTable title={title} rows={ranking.rows} rankingCriteria="wins_balance_points" columns={RANKING_COLUMNS}
      showPodium={false} progressive={qualifying} initialRowCount={32} nameColumnLabel="Atleta"
      renderName={row => {
        const tiedIds = ranking.pending.find(tie => tie.ids.includes(row.id))?.ids || [row.id];
        const tiedPositions = tiedIds.map(id => positions.get(id));
        const firstPosition = Math.min(...tiedPositions);
        const lastPosition = Math.max(...tiedPositions);
        // Pending draws elsewhere must not hide an already guaranteed place.
        // A tie across 16/17 cannot be labeled until it has been resolved.
        const qualificationStatus = qualifying && ranking.complete
          ? lastPosition <= 16 ? 'Classificado' : firstPosition > 16 ? 'Desclassificado' : null
          : null;
        const firstGroup = Math.floor((firstPosition - 1) / 4);
        const lastGroup = Math.floor((lastPosition - 1) / 4);
        const destination = qualifying
          ? qualificationStatus === 'Classificado' && firstGroup === lastGroup ? GROUPS[firstGroup]?.name : null
          : destinationFor?.(row);
        const group = GROUPS.find(item => item.name === destination);
        return <span className="rds-rank-name" data-qualification-cutoff={cutoffId !== null && row.id === cutoffId ? 'true' : undefined} title={`Coeficiente sem arredondamento para classificação: ${row.coefficient}`}>
          <span className="rds-rank-label"><span>{row.name}</span>{group && <small className="rds-rank-group" style={groupColorStyle(group)}>{group.name}</small>}{qualificationStatus && <small className={`rds-rank-status ${positions.get(row.id) <= 16 ? 'is-qualified' : 'is-eliminated'}`}>{qualificationStatus}</small>}</span>
          {cutoffId !== null && row.id === cutoffId && <span className="srOnly">Limite das 16 vagas: a linha abaixo separa os classificados dos eliminados quando a classificação estiver definida.</span>}
        </span>;
      }}
      shareConfig={ranking.settled ? {
        ...shareContext, title: shareContext.title || 'PRÉVIA · Rei do Sol', subtitle: `${title} · ${CRITERIA}`, columns: RANKING_COLUMNS,
        criteriaLabel: CRITERIA,
        groups: [{ title, rows: ranking.rows.map((row, index) => {
          const group = qualifying ? GROUPS[Math.floor(index / 4)] : finalGroup;
          return { ...row, ...(group ? { badge: { label: group.name, color: group.palette.ink, background: group.palette.tint, accent: group.color } } : {}) };
        }) }],
      } : null}
    />
    <p className="rds-ranking-help">{COEFFICIENT_HELP} Desempates seguem a ordem acima e são definidos ao concluir a fase.</p>
  </div>;
}
