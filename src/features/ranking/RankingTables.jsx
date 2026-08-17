import React from "react";
import RankingShareButton from "../rankingShare/RankingShareButton.jsx";
import { isMixedType } from "../../domain/modalityClassification.mjs";
import {
  formatRankingMetricValue,
  getRankingColumnLabel,
  getRankingCriteria,
} from "../../domain/rankingCriteria.mjs";

function podium(i) {
  if (i === 0) return "🏆";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return i + 1;
}

export default function RankingView({ ranking, type, rankingCriteria, shareContext = null, circuitAction = null, modalityConfig, CircuitButton }) {
  const config = modalityConfig[type];

  if (isMixedType(config)) {
    const menLimit = config.men;
    const men = ranking.filter((p) => p.id < menLimit);
    const women = ranking.filter((p) => p.id >= menLimit);

    return (
      <div className="twoCols">
        <RankingTable
          title="Ranking Masculino"
          rows={men}
          rankingCriteria={rankingCriteria}
          shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking Masculino", rows: men }] } : null}
          circuitAction={circuitAction}
          CircuitButton={CircuitButton}
        />
        <RankingTable
          title="Ranking Feminino"
          rows={women}
          rankingCriteria={rankingCriteria}
          shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking Feminino", rows: women }] } : null}
        />
      </div>
    );
  }

  return (
    <RankingTable
      title="Ranking do dia"
      rows={ranking}
      rankingCriteria={rankingCriteria}
      shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking do dia", rows: ranking }] } : null}
      circuitAction={circuitAction}
      CircuitButton={CircuitButton}
    />
  );
}

export function RankingTable({ title, rows, rankingCriteria, showPodium = true, shareConfig = null, columns = null, showGames = true, circuitAction = null, CircuitButton }) {
  const criteria = getRankingCriteria(rankingCriteria);
  const baseColumns = Array.isArray(columns) && columns.length
    ? columns
    : criteria.order.map((key) => ({ key, label: getRankingColumnLabel(key) }));
  const hasPlayTime = rows.some((row) => Number(row.playTimeSeconds || 0) > 0);
  const visibleColumns = hasPlayTime && !baseColumns.some(({ key }) => key === "playTimeSeconds")
    ? [...baseColumns, { key: "playTimeSeconds", label: getRankingColumnLabel("playTimeSeconds") }]
    : baseColumns;
  const effectiveShareConfig = shareConfig ? { ...shareConfig, rankingCriteria: criteria.value, columns: visibleColumns } : null;

  return (
    <div className="rankingTablePanel">
      <div className="rankingTableHeading">
        <h3>{title}</h3>
        <div className="rankingHeadingActions">
          <RankingShareButton config={effectiveShareConfig} compact />
          {circuitAction && CircuitButton ? <CircuitButton {...circuitAction} /> : null}
        </div>
      </div>

      <p className="rankingScrollHint" aria-hidden="true">Deslize a tabela para ver todos os dados →</p>
      <div
        className="rankingTableScroll"
        tabIndex="0"
        aria-label={`Tabela ${title}; deslize horizontalmente para ver todas as colunas`}
      >
        <table className="rankingTable">
          <thead>
            <tr>
              <th className="rankingRankCell">#</th>
              <th className="rankingNameCell">Nome</th>
              {visibleColumns.map(({ key, label }) => (
                <th className="rankingStatCell" key={key}>{label}</th>
              ))}
              {showGames ? <th className="rankingStatCell">Jogos</th> : null}
            </tr>
          </thead>

          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td className="rankingRankCell">{showPodium ? podium(i) : i + 1}</td>
                <td className="rankingNameCell">{p.name}</td>
                {visibleColumns.map(({ key }) => (
                  <td className="rankingStatCell" key={key}>{formatRankingMetricValue(key, p[key])}</td>
                ))}
                {showGames ? <td className="rankingStatCell">{p.played}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
