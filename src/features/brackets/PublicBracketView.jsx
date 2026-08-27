import React from "react";
import { UniversalMatchCard } from "../matchOperations/MatchSchedule.jsx";

export function PublicScheduleView({ schedule, showGroupName = false, courtNumbers = [], renderParticipant = null }) {
  return (
    <div className="schedule readOnlySchedule publicSchedule">
      {schedule.map((round, roundIndex) => (
        <div className="roundCard readOnlyRoundCard publicReadOnlyRound" key={roundIndex}>
          <div className="roundHeader"><h3>Rodada {roundIndex + 1}</h3></div>

          {round.map((game, gameIndex) => (
            <UniversalMatchCard
              key={gameIndex}
              game={game}
              phaseLabel={showGroupName && game.groupName ? `${game.groupName} · Rodada ${roundIndex + 1}` : `Rodada ${roundIndex + 1}`}
              courtNumbers={courtNumbers}
              readOnly
              renderParticipant={renderParticipant}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PublicCupBracketView({
  groupedBrackets,
  mainTitle = "Chave principal",
  repechageTitle = "Disputa paralela",
  secondParallelTitle = "2ª Disputa Paralela",
  thirdRepechageTitle = "3ª Disputa Paralela",
  sunsetFinalTitle = "Etapa Sunset",
  courtNumbers = [],
  renderParticipant = null,
}) {
  const mainRounds = Array.isArray(groupedBrackets?.main) ? groupedBrackets.main : [];
  const repechageRounds = Array.isArray(groupedBrackets?.repechage) ? groupedBrackets.repechage : [];
  const secondParallelRounds = Array.isArray(groupedBrackets?.secondParallel) ? groupedBrackets.secondParallel : [];
  const thirdParallelRounds = Array.isArray(groupedBrackets?.thirdParallel) ? groupedBrackets.thirdParallel : [];
  const sunsetFinalRounds = Array.isArray(groupedBrackets?.sunsetFinal) ? groupedBrackets.sunsetFinal : [];

  if (mainRounds.length === 0 && repechageRounds.length === 0 && secondParallelRounds.length === 0 && thirdParallelRounds.length === 0 && sunsetFinalRounds.length === 0) return null;

  return (
    <div className="cupBrackets publicCupBrackets bracketTreeCollection">
      {mainRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={mainRounds}
          title={mainRounds[0]?.bracketTitle || mainTitle}
          variant="main"
          courtNumbers={courtNumbers}
          renderParticipant={renderParticipant}
        />
      ) : null}
      {repechageRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={repechageRounds}
          title={repechageRounds[0]?.bracketTitle || repechageTitle}
          variant="repechage"
          courtNumbers={courtNumbers}
          renderParticipant={renderParticipant}
        />
      ) : null}
      {secondParallelRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={secondParallelRounds}
          title={secondParallelRounds[0]?.bracketTitle || secondParallelTitle}
          variant="repechage"
          courtNumbers={courtNumbers}
          renderParticipant={renderParticipant}
        />
      ) : null}
      {thirdParallelRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={thirdParallelRounds}
          title={thirdParallelRounds[0]?.bracketTitle || thirdRepechageTitle}
          variant="repechage"
          courtNumbers={courtNumbers}
          renderParticipant={renderParticipant}
        />
      ) : null}
      {sunsetFinalRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={sunsetFinalRounds}
          title={sunsetFinalRounds[0]?.bracketTitle || sunsetFinalTitle}
          variant="main"
          courtNumbers={courtNumbers}
          renderParticipant={renderParticipant}
        />
      ) : null}
    </div>
  );
}

export function PublicBracketColumn({ rounds = [], title, variant, courtNumbers = [], renderParticipant = null }) {
  if (rounds.length === 0) return null;

  const isPlacementRound = (round) => {
    const normalizedTitle = String(round?.title || "").toLocaleLowerCase("pt-BR");
    return normalizedTitle.includes("3º")
      || normalizedTitle.includes("3°")
      || normalizedTitle.includes("terceiro");
  };
  const treeRounds = rounds.filter((round) => !isPlacementRound(round));
  const placementRounds = rounds.filter(isPlacementRound);
  const openingGames = Math.max(1, treeRounds[0]?.games?.length || 1);

  const renderPublicBracketGame = (game, round) => (
    <UniversalMatchCard
      game={game}
      phaseLabel={round.title || title}
      courtNumbers={courtNumbers}
      readOnly
      isBye={Boolean(game.isBye)}
      renderParticipant={renderParticipant}
    />
  );

  return (
    <section className={`bracketColumn bracketTree publicBracketColumn publicBracketColumn--${variant || "main"}`}>
      <div className="bracketTreeHeading">
        <div>
          <span>Chave eliminatória</span>
          {title ? <h3 className="publicBracketTitle">{title}</h3> : null}
        </div>
        <span className="bracketSwipeHint">Deslize para acompanhar as fases →</span>
      </div>

      <div className="bracketTreeViewport" tabIndex="0" aria-label={`Chave ${title}. Role horizontalmente para acompanhar as fases.`}>
        <div className="bracketTreeCanvas" style={{ "--bracket-opening-games": openingGames }}>
          {treeRounds.map((round, roundIndex) => (
            <section className="roundCard publicBracketRound bracketRoundLane" key={`${round.title}-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader"><h3>{round.title || title}</h3></div>
              <div className="bracketRoundTrack">
                {round.games.map((game, gameIndex) => (
                  <div
                    className={`bracketMatchNode ${roundIndex > 0 ? "hasPrevious" : ""} ${roundIndex < treeRounds.length - 1 ? "hasNext" : ""} ${gameIndex % 2 === 0 ? "isTopSeed" : "isBottomSeed"}`}
                    key={game.matchKey}
                  >
                    {renderPublicBracketGame(game, round)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {placementRounds.length > 0 ? (
        <div className="bracketPlacementSection publicBracketPlacementSection">
          {placementRounds.map((round, roundIndex) => (
            <section className="roundCard publicBracketRound bracketPlacementRound" key={`${round.title}-placement-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader"><h3>{round.title}</h3></div>
              <div className="bracketPlacementGames">
                {round.games.map((game) => <div key={game.matchKey}>{renderPublicBracketGame(game, round)}</div>)}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
