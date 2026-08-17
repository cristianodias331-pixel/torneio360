import React from "react";

export function TournamentTimingSummaryView({ summary, compact = false, formatDuration }) {
  if (!summary.complete) return null;

  return (
    <aside className={`tournamentTimingSummary ${compact ? "is-compact" : ""}`} aria-label="Resumo da cronometragem do torneio">
      <span className="tournamentTimingIcon" aria-hidden="true">⏱</span>
      <span>
        <small>Tempo geral do torneio</small>
        <strong>{formatDuration(summary.durationSeconds)}</strong>
      </span>
      <em>{summary.timedGames} {summary.timedGames === 1 ? "partida cronometrada" : "partidas cronometradas"}</em>
    </aside>
  );
}

export function TournamentMatchStatusSummaryView({ summary, compact = false, vertical = false }) {
  return (
    <div className={`tournamentMatchStatusSummary ${compact ? "is-compact" : ""} ${vertical ? "is-vertical" : ""}`} aria-label="Resumo dos jogos">
      <span className="summaryStatus is-in-progress"><i aria-hidden="true" />Em andamento <strong>{summary.inProgress}</strong></span>
      <span className="summaryStatus is-finished"><i aria-hidden="true" />Finalizados <strong>{summary.finished}</strong></span>
      <span className="summaryStatus is-waiting"><i aria-hidden="true" />Aguardando chamada <strong>{summary.waiting}</strong></span>
    </div>
  );
}
