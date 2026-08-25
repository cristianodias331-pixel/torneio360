import React, { useEffect, useMemo, useRef, useState } from "react";
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

export function RankingTable({
  title,
  rows,
  rankingCriteria,
  showPodium = true,
  shareConfig = null,
  columns = null,
  showGames = true,
  circuitAction = null,
  CircuitButton,
  progressive = false,
  initialRowCount = 30,
  searchPlaceholder = "Pesquisar atleta ou dupla",
  remotePagination = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const pageSize = Math.max(10, Number(initialRowCount) || 30);
  const [rankingSearch, setRankingSearch] = useState("");
  const [visibleRowCount, setVisibleRowCount] = useState(pageSize);
  const lastRemoteSearchRef = useRef("");
  const remoteSearchHandlerRef = useRef(remotePagination?.onSearch);
  remoteSearchHandlerRef.current = remotePagination?.onSearch;
  const remoteMode = remotePagination?.enabled === true;
  const criteria = getRankingCriteria(rankingCriteria);
  const baseColumns = Array.isArray(columns) && columns.length
    ? columns
    : criteria.order.map((key) => ({ key, label: getRankingColumnLabel(key) }));
  const hasPlayTime = safeRows.some((row) => Number(row.playTimeSeconds || 0) > 0);
  const visibleColumns = hasPlayTime && !baseColumns.some(({ key }) => key === "playTimeSeconds")
    ? [...baseColumns, { key: "playTimeSeconds", label: getRankingColumnLabel("playTimeSeconds") }]
    : baseColumns;
  const effectiveShareConfig = shareConfig
    ? {
      ...shareConfig,
      rankingCriteria: criteria.value,
      columns: Array.isArray(shareConfig.columns) && shareConfig.columns.length
        ? shareConfig.columns
        : visibleColumns,
    }
    : null;
  const indexedRows = useMemo(
    () => safeRows.map((row, rankingIndex) => ({ row, rankingIndex })),
    [safeRows]
  );
  const filteredRows = useMemo(() => {
    if (remoteMode) return indexedRows;
    const normalizedSearch = rankingSearch.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return indexedRows;
    return indexedRows.filter(({ row }) => (
      String(row?.name || "").toLocaleLowerCase("pt-BR").includes(normalizedSearch)
    ));
  }, [indexedRows, rankingSearch, remoteMode]);
  const renderedRows = progressive && !remoteMode
    ? filteredRows.slice(0, visibleRowCount)
    : filteredRows;
  const remoteTotal = Math.max(0, Number(remotePagination?.total) || 0);
  const remoteAllTotal = Math.max(remoteTotal, Number(remotePagination?.allTotal) || 0);
  const showProgressiveControls = remoteMode
    ? remoteAllTotal > pageSize || Boolean(rankingSearch) || remotePagination?.loading === true
    : progressive && safeRows.length > pageSize;

  useEffect(() => {
    setVisibleRowCount(pageSize);
  }, [pageSize, rankingSearch, safeRows]);

  useEffect(() => {
    if (!remoteMode || typeof remoteSearchHandlerRef.current !== "function") return undefined;
    const normalizedSearch = rankingSearch.trim();
    if (normalizedSearch === lastRemoteSearchRef.current) return undefined;
    const timer = window.setTimeout(() => {
      lastRemoteSearchRef.current = normalizedSearch;
      remoteSearchHandlerRef.current(normalizedSearch);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [rankingSearch, remoteMode]);

  return (
    <div className="rankingTablePanel">
      <div className="rankingTableHeading">
        <h3>{title}</h3>
        <div className="rankingHeadingActions">
          <RankingShareButton config={effectiveShareConfig} compact />
          {circuitAction && CircuitButton ? <CircuitButton {...circuitAction} /> : null}
        </div>
      </div>

      {showProgressiveControls ? (
        <div className="rankingProgressiveToolbar">
          <label className="rankingProgressiveSearch">
            <span className="srOnly">Pesquisar em {title}</span>
            <input
              type="search"
              value={rankingSearch}
              onChange={(event) => setRankingSearch(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
          <small>{remoteMode && remotePagination?.loading
            ? "Atualizando ranking…"
            : `Exibindo ${renderedRows.length} de ${remoteMode ? remoteTotal : filteredRows.length}`}</small>
        </div>
      ) : null}

      {remoteMode && remotePagination?.error ? (
        <p className="rankingProgressiveError" role="alert">{remotePagination.error}</p>
      ) : null}

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
            {renderedRows.map(({ row: p, rankingIndex }) => {
              const storedPosition = Number(p.rankPosition || p.rank_position || 0);
              const displayIndex = storedPosition > 0 ? storedPosition - 1 : rankingIndex;
              return (
              <tr key={p.id || `${p.name}-${displayIndex}`}>
                <td className="rankingRankCell">{showPodium ? podium(displayIndex) : displayIndex + 1}</td>
                <td className="rankingNameCell">{p.name}</td>
                {visibleColumns.map(({ key }) => (
                  <td className="rankingStatCell" key={key}>{formatRankingMetricValue(key, p[key])}</td>
                ))}
                {showGames ? <td className="rankingStatCell">{p.played}</td> : null}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {progressive && visibleRowCount < filteredRows.length ? (
        <button
          type="button"
          className="rankingLoadMoreButton"
          onClick={() => setVisibleRowCount((current) => current + pageSize)}
        >
          Carregar mais {Math.min(pageSize, filteredRows.length - visibleRowCount)} nome(s)
        </button>
      ) : null}
      {remoteMode && remotePagination?.hasMore ? (
        <button
          type="button"
          className="rankingLoadMoreButton"
          onClick={remotePagination.onLoadMore}
          disabled={remotePagination.loading === true}
        >
          {remotePagination.loading
            ? "Carregando nomes…"
            : `Carregar mais ${Math.min(pageSize, Math.max(0, remoteTotal - renderedRows.length))} nome(s)`}
        </button>
      ) : null}
    </div>
  );
}
