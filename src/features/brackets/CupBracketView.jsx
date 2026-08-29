import React from "react";
import { VoiceRepeatSelector } from "../matchOperations/MatchControls.jsx";
import { UniversalMatchCard } from "../matchOperations/MatchSchedule.jsx";

export default function CupBracketView({
  groupedBrackets,
  data,
  updateBracketScore,
  toggleBracketGameStatus = null,
  voiceRepeat = 1,
  setVoiceRepeat,
  winningScore = 4,
  courtNumbers = data.courtNumbers || [],
  onEditCourt = null,
  speakGame,
  speakBracketRound,
  stopSpeech,
  MatchStatusSummary,
}) {
  const currentPhaseMatchKeys = [...new Set(
    Object.values(groupedBrackets || {}).flatMap((rounds) => (
      Array.isArray(rounds)
        ? rounds.flatMap((round) => (
          Array.isArray(round?.games)
            ? round.games.map((game) => game?.matchKey).filter(Boolean)
            : []
        ))
        : []
    ))
  )];

  return (
    <div>
      <VoiceRepeatSelector
        voiceRepeat={voiceRepeat}
        setVoiceRepeat={setVoiceRepeat}
      />

      <MatchStatusSummary
        data={data}
        scope="bracket"
        bracketMatchKeys={currentPhaseMatchKeys}
      />

      <div className="cupBrackets bracketTreeCollection">
        {groupedBrackets.main?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.mainBracketName || "Principal"}
            rounds={groupedBrackets.main}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={courtNumbers}
            onEditCourt={onEditCourt}
            attendanceData={data}
            speakGame={speakGame}
            speakBracketRound={speakBracketRound}
            stopSpeech={stopSpeech}
          />
        )}

        {groupedBrackets.repechage?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.repechageName || "Repescagem"}
            rounds={groupedBrackets.repechage}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={courtNumbers}
            onEditCourt={onEditCourt}
            attendanceData={data}
            speakGame={speakGame}
            speakBracketRound={speakBracketRound}
            stopSpeech={stopSpeech}
          />
        )}

        {groupedBrackets.secondParallel?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}
            rounds={groupedBrackets.secondParallel}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={courtNumbers}
            onEditCourt={onEditCourt}
            attendanceData={data}
            speakGame={speakGame}
            speakBracketRound={speakBracketRound}
            stopSpeech={stopSpeech}
          />
        )}

        {groupedBrackets.thirdParallel?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}
            rounds={groupedBrackets.thirdParallel}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={courtNumbers}
            onEditCourt={onEditCourt}
            attendanceData={data}
            speakGame={speakGame}
            speakBracketRound={speakBracketRound}
            stopSpeech={stopSpeech}
          />
        )}

        {groupedBrackets.sunsetFinal?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.sunsetBracketName || "Etapa Sunset"}
            rounds={groupedBrackets.sunsetFinal}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={courtNumbers}
            onEditCourt={onEditCourt}
            attendanceData={data}
            speakGame={speakGame}
            speakBracketRound={speakBracketRound}
            stopSpeech={stopSpeech}
          />
        )}
      </div>
    </div>
  );
}
export function BracketColumn({
  title,
  rounds,
  updateBracketScore,
  toggleBracketGameStatus = null,
  voiceRepeat = 1,
  winningScore = 4,
  courtNumbers = [],
  onEditCourt = null,
  attendanceData = null,
  speakGame,
  speakBracketRound,
  stopSpeech,
}) {
  const isPlacementRound = (round) => {
    const normalizedTitle = String(round?.title || "").toLocaleLowerCase("pt-BR");
    return normalizedTitle.includes("3º")
      || normalizedTitle.includes("3°")
      || normalizedTitle.includes("terceiro");
  };
  const treeRounds = rounds.filter((round) => !isPlacementRound(round));
  const placementRounds = rounds.filter(isPlacementRound);
  const openingGames = Math.max(1, treeRounds[0]?.games?.length || 1);

  const renderBracketGame = (game, round) => {
    const blocked =
      game.isBye
      || !game.ids1?.length
      || !game.ids2?.length
      || game.team1?.[0] === "Aguardando"
      || game.team2?.[0] === "Aguardando";

    return (
      <UniversalMatchCard
        game={game}
        phaseLabel={round.title === "Disputa Paralela" ? title : round.title}
        courtNumbers={courtNumbers}
        winningScore={winningScore}
        blocked={blocked}
        isBye={Boolean(game.isBye)}
        onEditCourt={onEditCourt && !game.isBye ? () => onEditCourt({ scope: "bracket", matchKey: game.matchKey, game }) : null}
        onScoreChange={!game.isBye ? (field, value) => updateBracketScore(game.matchKey, field, value) : null}
        onStatusToggle={!game.isBye && toggleBracketGameStatus ? () => toggleBracketGameStatus(game.matchKey) : null}
        onCallGame={!game.isBye ? () => {
          // Chamar o confronto também inicia sua operação de quadra. O modo
          // startOnly impede que uma nova chamada pare um cronômetro ativo.
          toggleBracketGameStatus?.(game.matchKey, { startOnly: true });
          speakGame(game, {
            roundLabel: `${round.title} da chave ${title}`,
            includeGroup: false,
            repeat: voiceRepeat,
            courtNumbers,
          });
        } : null}
        attendanceData={attendanceData}
      />
    );
  };

  return (
    <section className={`bracketColumn bracketTree ${rounds?.[0]?.games?.[0]?.phase === "repechage" ? "repechageBracket" : "mainBracket"}`}>
      <div className="bracketTreeHeading">
        <div>
          <span>Chave eliminatória</span>
          <h3>{title}</h3>
        </div>
        <span className="bracketSwipeHint">Deslize para acompanhar as fases →</span>
      </div>

      <div className="bracketTreeViewport" tabIndex="0" aria-label={`Chave ${title}. Role horizontalmente para acompanhar as fases.`}>
        <div className="bracketTreeCanvas" style={{ "--bracket-opening-games": openingGames }}>
          {treeRounds.map((round, roundIndex) => (
            <section className="roundCard bracketRoundLane" key={`${round.title}-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader">
                <h3>{round.title === "Disputa Paralela" ? title : round.title}</h3>
                <div className="voiceActions bracketRoundActions">
                  <button type="button" className="voiceBtn" onClick={() => speakBracketRound(round, voiceRepeat, courtNumbers)}>
                    🔊 Chamar fase
                  </button>
                  <button type="button" className="secondaryBtn stopBtn" onClick={stopSpeech}>⏹️ Parar</button>
                </div>
              </div>

              <div className="bracketRoundTrack">
                {round.games.map((game, gameIndex) => (
                  <div
                    className={`bracketMatchNode ${roundIndex > 0 ? "hasPrevious" : ""} ${roundIndex < treeRounds.length - 1 ? "hasNext" : ""} ${gameIndex % 2 === 0 ? "isTopSeed" : "isBottomSeed"}`}
                    key={game.matchKey}
                  >
                    {renderBracketGame(game, round)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {placementRounds.length > 0 ? (
        <div className="bracketPlacementSection">
          {placementRounds.map((round, roundIndex) => (
            <section className="roundCard bracketPlacementRound" key={`${round.title}-placement-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader">
                <h3>{round.title}</h3>
                <div className="voiceActions bracketRoundActions">
                  <button type="button" className="voiceBtn" onClick={() => speakBracketRound(round, voiceRepeat, courtNumbers)}>🔊 Chamar fase</button>
                  <button type="button" className="secondaryBtn stopBtn" onClick={stopSpeech}>⏹️ Parar</button>
                </div>
              </div>
              <div className="bracketPlacementGames">
                {round.games.map((game) => <div key={game.matchKey}>{renderBracketGame(game, round)}</div>)}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
