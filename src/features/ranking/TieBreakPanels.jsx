import React from "react";
import { Dices, Trophy } from "lucide-react";
import { getOfficialCearenseAdjustedBalance } from "../../domain/campaignRanking.mjs";
import { RankingTable } from "./RankingTables.jsx";

export function TieBreakDrawOverlay({ draw, onClose }) {
  const isDrawing = draw.phase === "drawing";

  return (
    <div className="tieBreakDrawOverlay" role="alertdialog" aria-modal="true" aria-live="polite">
      <div className={`tieBreakDrawCard ${isDrawing ? "drawing" : "result"}`}>
        <div className="tieBreakDrawIcon">{isDrawing ? <Dices /> : <Trophy />}</div>
        <span className="tieBreakDrawEyebrow">{isDrawing ? "Sorteio em andamento" : "Sorteio concluído"}</span>
        <h2>{draw.title}</h2>

        {isDrawing ? (
          <>
            <div className="tieBreakDrawCountdown">{draw.seconds}</div>
            <div className="tieBreakDrawSpotlight">{draw.spotlight}</div>
            <div className="tieBreakDrawCandidates">
              {draw.candidates.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}
            </div>
            <div className="tieBreakDrawProgress"><span /></div>
            <p>Aguarde 5 segundos. A ordem está sendo definida aleatoriamente.</p>
          </>
        ) : (
          <>
            <span className="tieBreakWinnerLabel">Vencedor do sorteio</span>
            <strong className="tieBreakWinnerName">{draw.winner}</strong>
            <div className="tieBreakResultOrder">
              {draw.orderNames.map((name, index) => (
                <span key={`${name}-${index}`}><b>{index + 1}º</b>{name}</span>
              ))}
            </div>
            <button type="button" onClick={onClose}>Entendi</button>
          </>
        )}
      </div>
    </div>
  );
}
export function CopinhaTieBreakPanel({
  groupRankings,
  onResolveTie,
  groupCampaignTies = [],
  onResolveGroupTie,
  campaignTies = [],
  onResolveCampaignTie,
  isCearense = false,
  isOfficialCearense = false,
  drawInProgress = false,
}) {
  const tiedGroups = (groupRankings || []).filter((group) => group.unresolvedTieIds?.length > 1);
  const isPlayRanking = groupRankings?.[0]?.rankingMode === "playranking";

  if (!tiedGroups.length && !groupCampaignTies.length && !campaignTies.length) return null;

  return (
    <div className="infoBox tieBreakPanel">
      <div className="tieBreakIntro">
        <span className="tieBreakIntroIcon"><Dices /></span>
        <p>
          <strong>Desempate por sorteio necessário</strong>
          {isPlayRanking
            ? "As duplas abaixo permaneceram iguais após vitórias, saldo de games, confronto direto e coeficiente. Faça o sorteio antes de gerar as chaves."
            : isOfficialCearense
            ? "As duplas abaixo permaneceram iguais em vitórias e saldo. Entre duas duplas vale o confronto direto; entre três ou mais, faça o sorteio antes de gerar as chaves."
            : isCearense
            ? "As duplas abaixo permaneceram iguais em vitórias, saldo e Total de Games. Faça o sorteio antes de gerar as chaves."
            : "Há duplas empatadas após todos os critérios de classificação. Faça o sorteio antes de continuar."}
        </p>
      </div>

      <div className="tieBreakList">
        {tiedGroups.map((group) => {
          const tiedRows = group.rows.filter((row) => group.unresolvedTieIds.includes(row.id));

          return (
            <div className="tieBreakItem" key={group.id}>
              <span><strong>{group.name}</strong>{tiedRows.map((row) => row.name).join(" · ")}</span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveTie(group.id, group.unresolvedTieIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}

        {groupCampaignTies.map((tie) => {
          const groups = groupRankings.filter((group) => tie.groupIds.includes(group.id));

          return (
            <div className="tieBreakItem" key={`campaign-${tie.tieKey}`}>
              <span><strong>Melhor campanha empatada</strong>{groups.map((group) => group.name).join(" · ")}</span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveGroupTie?.(tie.tieKey, tie.groupIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}

        {campaignTies.map((tie) => {
          const scopeLabel = {
            campeoes: "Campeões de grupo",
            segundos: "Segundos colocados",
            paralela: "Disputa Paralela",
          }[tie.scope] || "Campanhas entre grupos";

          return (
            <div className="tieBreakItem" key={tie.tieKey}>
              <span>
                <strong>{scopeLabel}</strong>
                {tie.rows.map((row) => {
                  if (isOfficialCearense) {
                    const adjusted = getOfficialCearenseAdjustedBalance(row);
                    return `${row.name} (saldo ajustado ${(adjusted.numerator / adjusted.denominator).toFixed(2)})`;
                  }
                  return `${row.name} (${((row.w / Math.max(1, row.played)) * 100).toFixed(2)}% vit.; saldo médio ${(row.bal / Math.max(1, row.played)).toFixed(2)}; média de games ${(row.pts / Math.max(1, row.played)).toFixed(2)})`;
                }).join(" · ")}
              </span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveCampaignTie?.(tie.tieKey, tie.teamIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CupGroupRankingView({ groupRankings, rankingCriteria, className = "", renderParticipant = null }) {
  const isOfficialCearense = groupRankings?.[0]?.rankingMode === "cearense-official";
  const isPlayRanking = groupRankings?.[0]?.rankingMode === "playranking";
  const hasDefinedGroupOrder = isOfficialCearense && groupRankings.every((group) => group.groupRank);
  const effectiveCriteria = ["copinha", "cearense-official", "playranking"].includes(groupRankings?.[0]?.rankingMode)
    ? "wins_balance_points"
    : rankingCriteria;
  const columns = isPlayRanking
    ? [
      { key: "w", label: "Vitórias" },
      { key: "bal", label: "Saldo de games" },
      { key: "coefficient", label: "Coeficiente" },
      { key: "pts", label: "Total de Games" },
    ]
    : null;

  return (
    <div className={`${hasDefinedGroupOrder ? "cearenseGroupRankingStack" : "twoCols"} ${className}`.trim()}>
      {groupRankings.map((group) => (
        <RankingTable
          key={group.id}
          title={hasDefinedGroupOrder && group.groupRank
            ? `${group.groupRank}º melhor grupo · ${group.name}`
            : group.name}
          rows={group.rows}
          rankingCriteria={effectiveCriteria}
          columns={columns}
          showPodium={false}
          renderParticipant={renderParticipant}
        />
      ))}
    </div>
  );
}
