import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import { isIndividualCupType } from "../../domain/modalityClassification.mjs";
import {
  isCearenseSecondParallelEnabled,
  isCearenseThirdParallelEnabled,
} from "../../domain/cupFormat.mjs";
export function ParallelDisputeChoice({
  kind,
  enabled,
  onEnabledChange,
  name,
  onNameChange,
  teamCount,
  individual = false,
  getCearenseFormatSummary,
  FormatExplanationButton,
}) {
  const isSecond = kind === "second";
  const ordinal = isSecond ? "2ª" : "3ª";
  const summary = getCearenseFormatSummary(teamCount, false, individual);
  const participantPlural = individual ? "jogadores" : "duplas";
  const thirdSummary = summary.thirdParallel;
  const helpSections = isSecond ? [
    {
      title: `Quem participa com ${summary.teamCount} ${participantPlural}`,
      content: <><p>Depois que todos os jogos dos grupos terminarem, o <strong>1º e o 2º lugar de cada grupo</strong> seguem exclusivamente para a Eliminatória Principal.</p><p>As demais posições — 3º, 4º e seguintes — formam esta disputa. Com a quantidade escolhida, serão <strong>{summary.initialParallelCount} participantes na 2ª disputa paralela</strong>.</p></>,
    },
    {
      title: "Como os participantes são ordenados",
      content: <><p>Primeiro entram os 3º colocados, do melhor grupo para o pior grupo. Depois vêm os 4º colocados, seguindo a mesma ordem, e assim por diante.</p><p>Essa ordem define as cabeças da chave e a prioridade dos BYEs. Sempre que for possível, o sistema evita que participantes do mesmo grupo se enfrentem logo na primeira rodada.</p></>,
    },
    {
      title: "Chave, BYEs e avanço",
      content: <><p>A disputa começa em <strong>{summary.parallelOpeningRound}</strong>, numa chave de {summary.parallelBracketSize} posições.</p><p>{summary.parallelByes > 0 ? `Como existem ${summary.initialParallelCount} participantes, serão concedidos ${summary.parallelByes} BYE${summary.parallelByes === 1 ? "" : "s"} aos mais bem ordenados.` : "A chave fica completa e começa sem BYEs."} Quem vence avança; quem perde é eliminado. O último participante restante será campeão, e o derrotado da final será vice-campeão.</p></>,
    },
    {
      title: "Independência da disputa",
      content: <p>Os confrontos e placares desta chave são separados da Eliminatória Principal e da 3ª disputa paralela. Um resultado aqui não altera nenhuma das outras chaves.</p>,
    },
    {
      title: "O que acontece ao escolher Sim ou Não",
      content: <><p><strong>Sim:</strong> a plataforma mostra a aba, os jogos, o ranking e o pódio próprios desta disputa para o organizador e os visitantes.</p><p><strong>Não:</strong> ela fica totalmente oculta, não aparece para os visitantes e não impede o encerramento do torneio. Se for ativada depois, os dados internos já calculados serão preservados.</p></>,
    },
  ] : [
    {
      title: `Origem dos participantes com ${summary.teamCount} ${participantPlural}`,
      content: thirdSummary.eligibleCount > 0
        ? <><p>Esta disputa não recebe participantes eliminados na fase de grupos. Ela recebe <strong>{thirdSummary.eligibleCount} participantes</strong>: os derrotados nas quartas de final e, quando existir, também os derrotados na fase imediatamente anterior.</p><p>Nesta quantidade, as fases de origem são: <strong>{thirdSummary.sourceRound}</strong>. Se não houver quartas, entram os dois derrotados das semifinais.</p></>
        : <p>Com {summary.teamCount} {participantPlural}, a Eliminatória Principal possui apenas uma final. Por isso, <strong>não existem participantes derrotados suficientes para formar a 3ª disputa paralela</strong>.</p>,
    },
    {
      title: "Como a chave será montada",
      content: thirdSummary.eligibleCount > 0
        ? <><p>Para esta quantidade, o formato começa em <strong>{thirdSummary.openingRound}</strong>, com {thirdSummary.matchCount} {thirdSummary.matchCount === 1 ? "partida" : "partidas"} no total.</p><p>{thirdSummary.byeCount > 0 ? `A chave terá ${thirdSummary.byeCount} BYE${thirdSummary.byeCount === 1 ? "" : "s"}, entregues primeiro às duplas eliminadas nas quartas.` : "A chave começa sem BYEs."} Quando houver eliminadas da fase anterior, elas entram antes; as eliminadas nas quartas entram depois ou recebem a prioridade disponível.</p></>
        : <p>Nenhuma chave será exibida porque não há participantes elegíveis nesta configuração.</p>,
    },
    {
      title: "O que esta disputa não altera",
      content: <p>Ela é independente da Eliminatória Principal e da 2ª disputa paralela. Seus jogos têm placares, campeão e vice-campeão próprios. Nenhum resultado desta chave muda os confrontos das outras duas.</p>,
    },
    {
      title: "O que acontece ao escolher Sim ou Não",
      content: <><p><strong>Sim:</strong> quando houver participantes elegíveis, a aba e os confrontos serão mostrados ao organizador e aos visitantes.</p><p><strong>Não:</strong> esta disputa fica totalmente oculta e não impede o encerramento do torneio. Ela poderá ser ativada posteriormente sem apagar os dados internos já calculados.</p></>,
    },
  ];

  return (
    <div className="parallelChoiceCard">
      <div className="parallelChoiceHeading">
        <div>
          <strong>Realizar {ordinal} disputa paralela?</strong>
          <span>Escolha obrigatória</span>
        </div>
        <FormatExplanationButton
          iconOnly
          ariaLabel={`Entenda como funciona a ${ordinal} disputa paralela`}
          eyebrow="Ajuda sobre o formato"
          title={`Como funciona a ${ordinal} disputa paralela`}
          intro={`Explicação calculada para a configuração atual de ${summary.teamCount} ${participantPlural}.`}
          sections={helpSections}
        />
      </div>

      <div className="parallelChoiceOptions" role="radiogroup" aria-label={`Realizar ${ordinal} disputa paralela?`}>
        <button
          type="button"
          role="radio"
          aria-checked={enabled === true}
          className={enabled === true ? "selected yes" : ""}
          onClick={() => onEnabledChange(true)}
        >
          Sim
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={enabled === false}
          className={enabled === false ? "selected no" : ""}
          onClick={() => onEnabledChange(false)}
        >
          Não
        </button>
      </div>

      {typeof enabled !== "boolean" ? (
        <p className="parallelChoiceRequired">Escolha Sim ou Não para continuar.</p>
      ) : null}

      {enabled === true ? (
        <div className="parallelChoiceName">
          <label>Nome da {ordinal} disputa paralela</label>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={`${ordinal} Disputa Paralela`}
            required
          />
        </div>
      ) : null}
    </div>
  );
}
export default function TournamentFormatInfoButton({
  data,
  config,
  publicView = false,
  getCearenseFormatSummary,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const isPlayRanking = config.type === "playranking";
  const isSunset = config.type === "sunset";
  const isIndividualCup = isIndividualCupType(config);
  const isSupported = config.type === "cearense" || isIndividualCup || isPlayRanking || isSunset;
  const participantPlural = isIndividualCup ? "jogadores" : "duplas";
  const teamCount = data.cupConfig?.teamCount || config.defaultTeams;
  const summary = useMemo(
    () => getCearenseFormatSummary(
      teamCount,
      isPlayRanking,
      isIndividualCup,
      isSunset ? data.cupConfig?.groupFormation : "automatic"
    ),
    [teamCount, isPlayRanking, isIndividualCup, isSunset, data.cupConfig?.groupFormation]
  );
  const secondParallelEnabled = isPlayRanking || isCearenseSecondParallelEnabled(data);
  const thirdParallelEnabled = !isPlayRanking && isCearenseThirdParallelEnabled(data);
  const visibleBracketNames = isSunset ? [
    "a Eliminatória Principal",
    `a ${data.cupConfig?.repechageName || "1ª Disputa Paralela"}`,
    `a ${data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}`,
    `a ${data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}`,
    `a ${data.cupConfig?.sunsetBracketName || "Etapa Sunset"}`,
  ] : [
    "a Eliminatória Principal",
    ...(secondParallelEnabled ? [isPlayRanking ? "a Disputa Paralela" : `a ${data.cupConfig?.repechageName || "2ª Disputa Paralela"}`] : []),
    ...(thirdParallelEnabled ? [`a ${data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}`] : []),
  ];
  const criteriaStepNumber = isSunset
    ? 8
    : isPlayRanking
    ? 6
    : 4 + Number(secondParallelEnabled) + Number(thirdParallelEnabled);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open]);

  if (!isSupported) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`formatInfoTrigger ${publicView ? "public" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CircleHelp aria-hidden="true" />
        <span>Como funciona com {summary.teamCount} {participantPlural}</span>
      </button>

      {open && createPortal(
        <div
          className="formatInfoOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="formatInfoDialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Explicação do formato ${isSunset ? "Copa Sunset" : getModalityDisplayName(config.type === "playranking" ? "Modelo Play Ranking" : "Campeonato Cearense")}`}
          >
            <header className="formatInfoHeader">
              <div>
                <span>Formato calculado para {summary.teamCount} {participantPlural}</span>
                <h2>{isSunset ? "Copa Sunset" : isPlayRanking ? "Modelo Torneio 360" : isIndividualCup ? "Torneio modelo Campeonato Cearense — Individual" : "Torneio modelo Campeonato Cearense"}</h2>
                <p>Veja o caminho dos participantes desde os grupos até {visibleBracketNames.join(", ").replace(/, ([^,]*)$/, " e $1")}.</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fechar explicação">×</button>
            </header>

            <div className={`formatInfoHighlights ${isPlayRanking ? "hasTransfer" : ""}`} aria-label="Resumo do formato">
              <div><strong>{summary.groupCount}</strong><span>{summary.groupCount === 1 ? "grupo" : "grupos"}</span></div>
              <div><strong>{summary.mainCount}</strong><span>na principal</span></div>
              {secondParallelEnabled ? <div><strong>{summary.initialParallelCount}</strong><span>na paralela após os grupos</span></div> : null}
              {isPlayRanking ? <div><strong>+{summary.transferredCount}</strong><span>vindas da primeira fase</span></div> : null}
              {thirdParallelEnabled && !isSunset ? <div><strong>{summary.thirdParallel.eligibleCount}</strong><span>na 3ª paralela</span></div> : null}
              {isSunset ? <div><strong>Até 4</strong><span>campeãs na etapa Sunset</span></div> : null}
            </div>

            <div className="formatInfoSections">
              <article>
                <span className="formatInfoStep">1</span>
                <div>
                  <h3>Fase de grupos</h3>
                  <p>Os {summary.teamCount} participantes serão distribuídos em <strong>{summary.groupDescription}</strong>.</p>
                  <p>Cada participante fará <strong>{summary.gamesPerTeamDescription} jogos</strong> na fase de grupos, totalizando {summary.groupMatches} partidas.</p>
                  {isPlayRanking
                    ? <p>A classificação de cada grupo segue: vitórias, saldo de games, confronto direto, coeficiente e sorteio. Em confronto direto circular, o sistema ignora esse critério e passa ao coeficiente. O Total de Games permanece visível somente como estatística.</p>
                    : <p>A classificação de cada grupo segue: vitórias, saldo de games, confronto direto quando restarem exatamente dois participantes empatados e sorteio quando três ou mais permanecerem empatados.</p>}
                </div>
              </article>

              <article>
                <span className="formatInfoStep">2</span>
                <div>
                  <h3>Destino depois dos grupos</h3>
                  <p>O 1º e o 2º lugar de cada grupo avançam. Assim, <strong>{summary.mainCount} participantes</strong> entram na Eliminatória Principal.</p>
                  {secondParallelEnabled ? (
                    <p>Os outros <strong>{summary.initialParallelCount} participantes</strong> entram na {isPlayRanking ? "Disputa Paralela" : (data.cupConfig?.repechageName || "2ª Disputa Paralela")}.</p>
                  ) : (
                    <p>Os participantes abaixo do 2º lugar não participam de uma disputa paralela visível neste evento.</p>
                  )}
                </div>
              </article>

              <article>
                <span className="formatInfoStep">3</span>
                <div>
                  <h3>Eliminatória Principal</h3>
                  <p>A chave começa em <strong>{summary.mainOpeningRound}</strong>, com tamanho de {summary.mainBracketSize} posições.</p>
                  <p>{summary.mainByes > 0 ? `${summary.mainByes} participante${summary.mainByes === 1 ? " recebe" : "s recebem"} BYE nessa abertura.` : "A primeira fase começa sem BYEs."}</p>
                </div>
              </article>

              {isPlayRanking ? (
                <article className="formatInfoTransfer">
                  <span className="formatInfoStep">4</span>
                  <div>
                    <h3>A diferença do Modelo Torneio 360</h3>
                    <p>Quando todos os placares de {summary.mainOpeningRound} estiverem preenchidos, as <strong>{summary.transferredCount} duplas derrotadas nos jogos dessa primeira fase</strong> também entram na Disputa Paralela.</p>
                    <p>As derrotadas das fases seguintes continuam eliminadas da Principal e não mudam mais de chave.</p>
                    <p>Entre elas, fica à frente quem perdeu pela menor diferença de games; depois, quem fez mais games na derrota e, em seguida, quem teve a melhor campanha nos grupos.</p>
                    <p>Elas recebem prioridade na montagem. Quando precisam jogar na abertura da Paralela, enfrentam uma dupla que já veio dos grupos — nunca outra transferida, sempre que matematicamente possível.</p>
                  </div>
                </article>
              ) : null}

              {secondParallelEnabled ? (
                <article>
                  <span className="formatInfoStep">{isPlayRanking ? 5 : 4}</span>
                  <div>
                    <h3>{isPlayRanking ? "Disputa Paralela" : (data.cupConfig?.repechageName || "2ª Disputa Paralela")}</h3>
                    {isPlayRanking ? (
                      <>
                        <p>A chave terá <strong>{summary.finalParallelCount} duplas</strong>: {summary.initialParallelCount} vindas dos grupos e {summary.transferredCount} da primeira fase da Principal.</p>
                        <p>{summary.parallelByes > 0 ? `A chave terá ${summary.parallelBracketSize} posições e ${summary.parallelByes} BYE${summary.parallelByes === 1 ? "" : "s"}.` : `A chave terá ${summary.parallelBracketSize} posições, sem BYEs.`} Sempre que possível, o sistema também evita um confronto imediato entre duplas do mesmo grupo.</p>
                      </>
                    ) : (
                      <>
                        <p>Participam os <strong>{summary.initialParallelCount} participantes que terminarem abaixo do 2º lugar</strong> nos grupos. Todos os 3º colocados são ordenados primeiro; depois vêm os 4º colocados e as posições seguintes. Dentro de cada posição, vale a ordem do melhor grupo para o pior.</p>
                        <p>A chave começa em <strong>{summary.parallelOpeningRound}</strong>, com {summary.parallelBracketSize} posições. {summary.parallelByes > 0 ? `Os ${summary.parallelByes} participantes mais bem ordenados recebem BYE.` : "Não haverá BYEs."} Sempre que possível, participantes do mesmo grupo não se enfrentam na abertura.</p>
                        <p>Quem vence avança e quem perde é eliminado. Esta disputa possui final, campeã e vice-campeã próprias.</p>
                      </>
                    )}
                  </div>
                </article>
              ) : null}

              {thirdParallelEnabled && !isSunset ? (
                <article>
                  <span className="formatInfoStep">{secondParallelEnabled ? 5 : 4}</span>
                  <div>
                    <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                    {summary.thirdParallel.eligibleCount > 0 ? (
                      <>
                        <p>Entram <strong>{summary.thirdParallel.eligibleCount} participantes</strong> derrotados em {summary.thirdParallel.sourceRound}: os eliminados nas quartas e, quando existir, também os eliminados na fase imediatamente anterior.</p>
                        <p>A chave começa em <strong>{summary.thirdParallel.openingRound}</strong>, com {summary.thirdParallel.matchCount} {summary.thirdParallel.matchCount === 1 ? "partida" : "partidas"}. {summary.thirdParallel.byeCount > 0 ? `Os ${summary.thirdParallel.byeCount} BYE${summary.thirdParallel.byeCount === 1 ? "" : "s"} são destinados primeiro às eliminadas nas quartas.` : "Não haverá BYEs."} Ela terá campeã e vice-campeã próprias.</p>
                      </>
                    ) : (
                      <p>Com {summary.teamCount} {participantPlural}, a Principal possui apenas uma final e não gera participantes suficientes para formar esta disputa.</p>
                    )}
                  </div>
                </article>
              ) : null}

              {isSunset ? (
                <>
                  <article>
                    <span className="formatInfoStep">5</span>
                    <div>
                      <h3>{data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}</h3>
                      <p>Recebe exclusivamente as duplas derrotadas na fase de oitavas da Eliminatória Principal. Quando a abertura da chave de 16 tiver BYEs, entram apenas as derrotadas nos confrontos realmente disputados.</p>
                      <p>Quando não houver eliminadas suficientes nas oitavas para formar esta chave, a dupla vice-campeã da Eliminatória Principal será considerada automaticamente a vencedora da 2ª disputa paralela.</p>
                    </div>
                  </article>
                  <article>
                    <span className="formatInfoStep">6</span>
                    <div>
                      <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                      <p>Recebe exclusivamente as quatro — ou menos, quando houver BYEs — duplas derrotadas nas quartas de final da Eliminatória Principal.</p>
                      <p>Com duas participantes, haverá final direta; com quatro, semifinais e final.</p>
                    </div>
                  </article>
                  <article>
                    <span className="formatInfoStep">7</span>
                    <div>
                      <h3>{data.cupConfig?.sunsetBracketName || "Etapa Sunset"}</h3>
                      <p>A campeã da Principal enfrenta a campeã da 1ª disputa paralela. Na outra semifinal, a campeã da 2ª disputa paralela enfrenta a campeã da 3ª disputa paralela.</p>
                      <p>Quando a 2ª disputa paralela usar a classificação automática descrita acima, o vice da Principal ocupa essa vaga. As vencedoras das duas semifinais disputam a final geral.</p>
                    </div>
                  </article>
                </>
              ) : null}

              <article>
                <span className="formatInfoStep">{criteriaStepNumber}</span>
                <div>
                  <h3>Critérios e independência das chaves</h3>
                  {isPlayRanking ? (
                    <p>Dentro de cada grupo, a ordem é vitórias, saldo de games, confronto direto, coeficiente e sorteio. O coeficiente é a média, partida a partida, da divisão dos games feitos pelo total de games jogados. Em confronto circular, o sistema passa diretamente ao coeficiente. O Total de Games aparece apenas como estatística da tabela. Entre grupos, campeões, segundos colocados e participantes da paralela são ordenados separadamente por percentual de vitórias, saldo médio, coeficiente e sorteio.</p>
                  ) : (
                    <p>Os melhores grupos são definidos comparando somente os campeões. O saldo do campeão de grupo com quatro participantes é dividido por 1,5; em empate, o organizador realiza o sorteio. Todo o grupo herda essa posição MG.</p>
                  )}
                  <p>{visibleBracketNames.length > 1 ? `${visibleBracketNames.slice(0, -1).join(", ")} e ${visibleBracketNames.at(-1)}` : visibleBracketNames[0]} {visibleBracketNames.length > 1 ? "seguem separadas" : "segue independente"}, com confrontos e resultados próprios.</p>
                </div>
              </article>
            </div>

            <footer className="formatInfoFooter">
              {publicView ? <span>Esta explicação é somente para consulta.</span> : <span>O resumo se atualiza automaticamente quando a quantidade de participantes muda.</span>}
              <button type="button" onClick={() => setOpen(false)}>Entendi</button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
