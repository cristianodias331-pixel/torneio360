import React from "react";
import { isIndividualCupType } from "../../domain/modalityClassification.mjs";
import {
  getReizinhoPlayerCount,
  getSimplePlayerCount,
} from "../../domain/modalitySettings.mjs";

export function SimpleConfigPanel({
  data,
  config,
  onPlayerCountChange,
  SimpleFormatInfoButton,
}) {
  const playerCount = getSimplePlayerCount(config, data);

  return (
    <div className="cupConfigBox simpleConfigBox">
      <div className="twoCols participantAttendanceColumns">
        <div>
          <label>Quantidade de jogadores</label>
          <select
            value={playerCount}
            onChange={(event) => onPlayerCountChange(Number(event.target.value))}
          >
            {config.allowedPlayerCounts.map((count) => (
              <option key={count} value={count}>{count} jogadores</option>
            ))}
          </select>
        </div>

        <div className="simpleFormatHelp">
          <SimpleFormatInfoButton data={data} config={config} />
        </div>
      </div>
    </div>
  );
}

export function ReizinhoConfigPanel({ data, config, onPlayerCountChange }) {
  const playerCount = getReizinhoPlayerCount(config, data);
  const isTraditional = playerCount === 4;

  return (
    <div className="cupConfigBox simpleConfigBox reizinhoConfigBox">
      <div className="twoCols participantAttendanceColumns">
        <div>
          <label>Quantidade de atletas</label>
          <select value={playerCount} onChange={(event) => onPlayerCountChange(Number(event.target.value))}>
            <option value={4}>4 atletas — Reizinho tradicional</option>
            <option value={6}>6 atletas — modelo da planilha</option>
          </select>
        </div>
        <div className="infoBox reizinhoFormatSummary">
          {isTraditional ? (
            <>
              <p><strong>Reizinho tradicional:</strong> 3 rodadas e 3 partidas.</p>
              <p>Cada atleta forma dupla exatamente uma vez com cada outro atleta.</p>
            </>
          ) : (
            <>
              <p><strong>Formato com 6 atletas:</strong> 5 rodadas e 15 partidas, conforme a planilha.</p>
              <p>Em cada rodada são formadas 3 duplas, que jogam entre si. Cada atleta faz dupla exatamente uma vez com cada outro atleta.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CupConfigPanel({
  data,
  config,
  updateCupConfig,
  showInfo = true,
  TournamentFormatInfoButton,
  ParallelDisputeChoice,
}) {
  const cupConfig = data.cupConfig || {};
  const isFixedCupSize = config.type === "cup18" || config.type === "cup21";
  const isCup18 = config.type === "cup18";
  const isCup21 = config.type === "cup21";
  const isCopinha = config.type === "copinha";
  const isCearense = config.type === "cearense" || config.type === "cearenseIndividual";
  const isIndividualCup = isIndividualCupType(config);
  const isPlayRanking = config.type === "playranking";
  const isSunset = config.type === "sunset";
  const isCearenseFamily = isCearense || isPlayRanking || isSunset;
  const canChooseAllFourGroups = isSunset
    && Number(cupConfig.teamCount || config.defaultTeams) % 4 === 0;

  return (
    <div className="cupConfigBox">
      <div className="twoCols participantAttendanceColumns">
        <div>
          <label>Quantidade de {isIndividualCup ? "jogadores" : "duplas"}</label>
          <select
            value={cupConfig.teamCount || config.defaultTeams}
            onChange={(event) => updateCupConfig("teamCount", Number(event.target.value))}
            disabled={isFixedCupSize}
          >
            {config.allowedTeamCounts.map((count) => (
              <option key={count} value={count}>{count} {isIndividualCup ? "jogadores" : "duplas"}</option>
            ))}
          </select>
          {showInfo && isCearenseFamily ? (
            <TournamentFormatInfoButton data={data} config={config} />
          ) : null}
        </div>

        <div>
          <label>Nome da chave principal</label>
          <input
            value={cupConfig.mainBracketName || config.defaultMainBracketName}
            onChange={(event) => updateCupConfig("mainBracketName", event.target.value)}
            placeholder="Principal"
          />
        </div>

        {canChooseAllFourGroups ? (
          <div className="sunsetGroupFormationChoice">
            <div className="parallelChoiceHeading">
              <div>
                <strong>Como os grupos serão formados?</strong>
                <span>Escolha entre a distribuição automática e grupos completos de quatro duplas.</span>
              </div>
            </div>
            <div className="parallelChoiceOptions" role="radiogroup" aria-label="Formação dos grupos da Copa Sunset">
              <button
                type="button"
                role="radio"
                aria-checked={(cupConfig.groupFormation || "automatic") === "automatic"}
                className={(cupConfig.groupFormation || "automatic") === "automatic" ? "selected yes" : ""}
                onClick={() => updateCupConfig("groupFormation", "automatic")}
              >
                Automática
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={cupConfig.groupFormation === "all-four"}
                className={cupConfig.groupFormation === "all-four" ? "selected yes" : ""}
                onClick={() => updateCupConfig("groupFormation", "all-four")}
              >
                Todos os grupos com 4 duplas
              </button>
            </div>
          </div>
        ) : null}

        {isCearense ? (
          <ParallelDisputeChoice
            kind="second"
            enabled={cupConfig.secondRepechageEnabled}
            onEnabledChange={(value) => updateCupConfig("secondRepechageEnabled", value)}
            name={cupConfig.repechageName ?? config.defaultRepechageName}
            onNameChange={(value) => updateCupConfig("repechageName", value)}
            teamCount={cupConfig.teamCount || config.defaultTeams}
            individual={isIndividualCup}
          />
        ) : (
          <div>
            <label>{isCopinha ? "Nome da consolação" : isSunset ? "Nome da 1ª disputa paralela" : isCearenseFamily || isCup18 || isCup21 ? "Nome da disputa paralela" : "Nome da repescagem"}</label>
            <input
              value={cupConfig.repechageName || config.defaultRepechageName}
              onChange={(event) => updateCupConfig("repechageName", event.target.value)}
              placeholder={isCopinha ? "Consolação" : isCearenseFamily || isCup18 || isCup21 ? "Disputa Paralela" : "Repescagem"}
            />
          </div>
        )}

        {isCearense ? (
          <ParallelDisputeChoice
            kind="third"
            enabled={cupConfig.thirdRepechageEnabled}
            onEnabledChange={(value) => updateCupConfig("thirdRepechageEnabled", value)}
            name={cupConfig.thirdRepechageName ?? config.defaultThirdRepechageName}
            onNameChange={(value) => updateCupConfig("thirdRepechageName", value)}
            teamCount={cupConfig.teamCount || config.defaultTeams}
            individual={isIndividualCup}
          />
        ) : null}

        {isSunset ? (
          <>
            <div>
              <label>Nome da 2ª disputa paralela</label>
              <input
                value={cupConfig.secondParallelName || config.defaultSecondParallelName}
                onChange={(event) => updateCupConfig("secondParallelName", event.target.value)}
                placeholder="2ª Disputa Paralela"
              />
            </div>
            <div>
              <label>Nome da 3ª disputa paralela</label>
              <input
                value={cupConfig.thirdRepechageName || config.defaultThirdRepechageName}
                onChange={(event) => updateCupConfig("thirdRepechageName", event.target.value)}
                placeholder="3ª Disputa Paralela"
              />
            </div>
            <div>
              <label>Nome da etapa entre campeãs</label>
              <input
                value={cupConfig.sunsetBracketName || config.defaultSunsetBracketName}
                onChange={(event) => updateCupConfig("sunsetBracketName", event.target.value)}
                placeholder="Etapa Sunset"
              />
            </div>
          </>
        ) : null}
      </div>

      {showInfo && !isCearenseFamily && (
        <div className="infoBox">
          {isCup18 ? (
            <>
              <p><strong>Formato:</strong> 18 duplas divididas em 6 grupos de 3.</p>
              <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
              <p><strong>Classificação:</strong> 1º e 2º de cada grupo avançam. Os 2 melhores terceiros também entram na chave principal.</p>
              <p><strong>Chave principal:</strong> 14 duplas, com os 2 melhores gerais entrando direto nas quartas.</p>
              <p><strong>Disputa paralela:</strong> os 4 terceiros restantes jogam todos contra todos.</p>
            </>
          ) : isCup21 ? (
            <>
              <p><strong>Formato:</strong> 21 duplas divididas em 7 grupos de 3.</p>
              <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
              <p><strong>Chave principal:</strong> passam 1º e 2º de cada grupo. As 2 melhores campanhas recebem BYE para as quartas.</p>
              <p><strong>Disputa paralela:</strong> os 7 terceiros colocados entram; o melhor terceiro recebe BYE para a semifinal.</p>
            </>
          ) : isCopinha ? (
            <>
              <p><strong>Formato:</strong> escolha de 6 a 36 duplas, sempre em grupos de 3.</p>
              <p><strong>Fase de grupos:</strong> cada dupla joga duas partidas.</p>
              <p><strong>Classificação:</strong> vitórias, saldo de games, confronto direto e, se ainda necessário, sorteio registrado pelo organizador.</p>
              <p><strong>Chaves:</strong> 1º e 2º de cada grupo entram na chave principal; a partir de 3 grupos, os 3º colocados seguem para a consolação.</p>
            </>
          ) : (
            <>
              <p><strong>Formato:</strong> grupos de 3 duplas.</p>
              <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
              <p><strong>Classificação:</strong> 1º e 2º de cada grupo avançam para a chave principal. O 3º vai para a repescagem.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
