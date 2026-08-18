import React from "react";
import { formatMatchTotalDuration } from "../../domain/matchTimer.mjs";
import { getPodiumInitials } from "../media/canvasTools.mjs";
import RankingShareButton from "../rankingShare/RankingShareButton.jsx";
import { TournamentCircuitButton } from "../circuitManagement/TournamentCircuitManager.jsx";

export default function CupPodiumView({ podium, title = "Principal", variant = "main", shareContext = null, circuitAction = null }) {
  if (!podium || podium.length === 0) return null;

  const podiumLimit = variant === "parallel" ? 1 : 3;
  const podiumPlaces = podium.slice(0, podiumLimit).map((item, index) => ({ ...item, place: index + 1 }));
  const displayOrder = podiumPlaces.length === 1
    ? podiumPlaces
    : [podiumPlaces[1], podiumPlaces[0], podiumPlaces[2]].filter(Boolean);
  const shareConfig = shareContext ? {
    ...shareContext,
    title: `${shareContext.title || title} — ${title}`,
    presentation: "podium",
    podium: podiumPlaces,
    podiumVariant: variant,
    groups: [{
      title: `Pódio da ${title}`,
      rows: podiumPlaces.map((item) => ({ name: item.name, playTimeSeconds: item.playTimeSeconds })),
    }],
  } : null;

  return (
    <div className={`cupPodiumBox ${variant === "parallel" ? "parallelPodiumBox" : "mainPodiumBox"}`}>
      <div className="cupPodiumHeading">
        <div>
          <span>Pódio oficial</span>
          <h3>{title}</h3>
        </div>
        <div className="rankingHeadingActions">
          <RankingShareButton config={shareConfig} compact />
          {circuitAction ? <TournamentCircuitButton {...circuitAction} /> : null}
        </div>
      </div>

      <div className={`cupPodiumGrid ${podiumPlaces.length === 1 ? "singleChampion" : ""}`}>
        {displayOrder.map((item) => (
          <div className={`cupPodiumItem cupPodiumPlace${item.place}`} key={`${item.position}-${item.name}`}>
            <span className="cupPodiumCrown" aria-hidden="true">{item.place === 1 ? "♛" : ""}</span>
            <span className="cupPodiumAvatar">{getPodiumInitials(item.name)}</span>
            <strong>{item.position}</strong>
            <span className="cupPodiumName">{item.name}</span>
            {Number(item.playTimeSeconds || 0) > 0 ? (
              <span className="cupPodiumTime">Tempo em jogo: {formatMatchTotalDuration(item.playTimeSeconds)}</span>
            ) : null}
            <span className="cupPodiumStep" aria-hidden="true">{item.place}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
